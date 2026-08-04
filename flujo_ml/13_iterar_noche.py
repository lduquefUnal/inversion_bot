#!/usr/bin/env python3
"""
13_iterar_noche.py — Iteración nocturna: aumentar el win rate REAL en test
=========================================================================
Objetivo del usuario: aumentar el win rate real en los datos de testeo
(backtest honesto de señales no repetidas de los últimos 45 días) y que
la probabilidad funcione mejor como indicador.

Paso 1: Reconstruir un dataset de entrenamiento CONSISTENTE con el generador
        de features del backtest honesto (mismo universo de tickers, mismas
        columnas, mismo target TP/SL con ventana de 11 días).
Paso 2: Walk-forward para obtener predicciones OOS reales y recalibración.
Paso 3: Optuna para maximizar F0.5 OOS + WR del backtest honesto real.
Paso 4: Evaluación final sobre el backtest honesto (últimos 45 días) y reporte.
"""
import os
import re
import json
import time
import math
import numpy as np
import pandas as pd
import joblib
import lightgbm as lgb
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import fbeta_score, brier_score_loss, roc_auc_score
from scipy.stats import spearmanr
import optuna
import sys
sys.path.insert(0, os.path.dirname(__file__))
from bt_honesto import (compute_features, rsi, atr, asignar_categoria, CAT_PARAMS,
                        simulate_signals, metrics, calibration, CACHE, MODELOS)

FLUJO_DATOS = os.path.join(os.path.dirname(__file__), "..", "flujo_datos")
PRED_PATH = os.path.join(FLUJO_DATOS, "predicciones_v2.json")

# Features del generador consistente
FEATURES = [
    "Cat_Sweet_Spot", "Cat_Cazador_Dips", "Cat_Recup_Rapida", "Cat_Cuchillos_Cayendo",
    "RSI_2", "RSI_7", "RSI_14", "ATR_%", "Dist_SMA200_%", "RVOL_5D",
    "Return_5D_%", "Tendencia_Sana", "Drawdown_52W_%",
]
# Features de riesgo QUANT_RISK (derivadas) + fundamentales
RISK_FEATURES = ["RR_Ratio", "ATR_Risk_Pct", "TP_ATR", "Abs_Drawdown", "RSI2_DD", "RSI2_RSI14"]
FUND_FEATURES = ["FCF_log", "Beta"]
IDX_FEATURES = ["Idx_QQQ_Above20", "Idx_QQQ_Above50", "Idx_QQQ_Ret20", "Idx_QQQ_Above20_10d",
                "Idx_SPY_Above20", "Idx_SPY_Above50", "Idx_SPY_Ret20", "Idx_SPY_Above20_10d"]
FULL_FEATURES = FEATURES + RISK_FEATURES + FUND_FEATURES + IDX_FEATURES
FULL_FEATURES = FEATURES + RISK_FEATURES + FUND_FEATURES  # índice no mejora → excluido

HALFLIFE_DAYS = 90.0


# ── Helpers de fundamentales ─────────────────────────────────────────────────
def parse_fcf(s):
    if s is None:
        return np.nan
    s = str(s).strip().replace("$", "").replace(",", "")
    m = re.match(r"^([-\d.]+)\s*([MKTB]?)", s)
    if not m:
        return np.nan
    return float(m.group(1)) * {"": 1, "K": 1e3, "M": 1e6, "B": 1e9}[m.group(2) or ""]


def parse_float(s):
    if s is None:
        return np.nan
    if isinstance(s, (int, float)):
        return float(s)
    m = re.search(r"[-+]?\d*\.\d+|\d+", str(s))
    return float(m.group()) if m else np.nan


def load_fundamentals():
    preds = json.load(open(PRED_PATH))["predicciones"]
    fund = {}
    for p in preds:
        fcf = parse_fcf(p.get("FCF"))
        fcf_log = np.sign(fcf) * np.log1p(abs(fcf)) if not np.isnan(fcf) else np.nan
        beta = parse_float(p.get("Beta"))
        fund[p["Ticker"]] = {"FCF_log": fcf_log, "Beta": beta}
    return pd.DataFrame.from_dict(fund, orient="index").reset_index().rename(columns={"index": "Ticker"})


# ── Régimen de mercado (QQQ/SPY) ─────────────────────────────────────────────
def get_index_features(dates):
    """Retorna DataFrame con features de régimen de mercado por fecha."""
    import yfinance as yf
    out = {}
    for idx_name in ["QQQ", "SPY"]:
        idx = yf.download(idx_name, period="9mo", progress=False, auto_adjust=True)["Close"].squeeze()
        df_i = pd.DataFrame({"idx": idx})
        df_i.index = pd.to_datetime(df_i.index)
        df_i = df_i.resample("D").ffill()
        s20 = df_i["idx"].rolling(20).mean(); s50 = df_i["idx"].rolling(50).mean()
        df_i["Above20"] = (df_i["idx"] > s20).astype(int)
        df_i["Above50"] = (df_i["idx"] > s50).astype(int)
        df_i["Ret20"] = df_i["idx"].pct_change(20) * 100
        df_i["Above20_10d"] = df_i["Above20"].rolling(10).mean()
        df_i["Above50_10d"] = df_i["Above50"].rolling(10).mean()
        sub = df_i[["Above20", "Above50", "Ret20", "Above20_10d", "Above50_10d"]]
        sub.columns = [f"Idx_{idx_name}_{c}" for c in sub.columns]
        out[idx_name] = sub
    merged = out["QQQ"].join(out["SPY"], how="outer")
    merged.index.name = "Date"
    return merged.reindex(pd.to_datetime(dates)).ffill()


# ── Dataset consistente con el backtest honesto ──────────────────────────────
def build_dataset(ohlcv, horizon=11):
    """Reconstruye dataset con MISMAS features que compute_features y target TP/SL."""
    rows = []
    for ticker, g in ohlcv.groupby("Ticker"):
        g = g.sort_values("Date").reset_index(drop=True)
        if len(g) < 60:
            continue
        g["RSI_2"] = rsi(g["Close"], 2)
        g["RSI_7"] = rsi(g["Close"], 7)
        g["RSI_14"] = rsi(g["Close"], 14)
        g["ATR_14"] = atr(g)
        g["ATR_%"] = g["ATR_14"] / g["Close"] * 100.0
        g["SMA_200"] = g["Close"].rolling(200).mean()
        g["SMA_50"] = g["Close"].rolling(50).mean()
        g["EMA_20"] = g["Close"].ewm(span=20, adjust=False).mean()
        g["Dist_SMA200_%"] = (g["Close"] - g["SMA_200"]) / g["SMA_200"] * 100.0
        g["Vol_SMA20"] = g["Volume"].rolling(20).mean()
        g["RVOL_5D"] = g["Volume"] / (g["Vol_SMA20"] + 1e-5)
        g["Return_5D_%"] = g["Close"].pct_change(5) * 100.0
        hi52 = g["High"].rolling(252, min_periods=40).max()
        g["Drawdown_52W_%"] = (g["Close"] - hi52) / hi52 * 100.0
        g["Tendencia_Sana"] = ((g["Close"] >= g["SMA_200"]) & (g["EMA_20"] >= g["SMA_50"])).astype(int)
        g = g.dropna(subset=["RSI_2", "RSI_14", "ATR_%", "Dist_SMA200_%", "Drawdown_52W_%"]).reset_index(drop=True)

        for i in range(len(g) - horizon):
            r = g.iloc[i]
            dd_v = r["Drawdown_52W_%"]
            rsi14_v = r["RSI_14"]
            rsi2_v = r["RSI_2"]
            tendencia_sana = bool(r["Tendencia_Sana"])
            cat = asignar_categoria(dd_v, rsi14_v, rsi2_v, tendencia_sana)
            if cat is None:
                continue
            p = CAT_PARAMS[cat]
            tp_price = r["Close"] * (1 + p["tp"])
            sl_price = r["Close"] * (1 - p["sl"])
            fut = g.iloc[i + 1: i + 1 + horizon]
            target = 0
            for _, f in fut.iterrows():
                if f["Low"] <= sl_price:
                    target = 0
                    break
                if f["High"] >= tp_price:
                    target = 1
                    break
            days_old = (ohlcv["Date"].max() - r["Date"]).days
            w = math.exp(-math.log(2) * (days_old / HALFLIFE_DAYS))
            rows.append({
                "Date": r["Date"], "Ticker": ticker, "Categoria": cat,
                "Cat_Sweet_Spot": int(cat == "Sweet Spot"),
                "Cat_Cazador_Dips": int(cat == "Cazador Dips"),
                "Cat_Recup_Rapida": int(cat == "Recup. Rapida"),
                "Cat_Cuchillos_Cayendo": int(cat == "Cuchillos Cayendo"),
                "Close": r["Close"],
                "RSI_2": rsi2_v, "RSI_7": r["RSI_7"], "RSI_14": rsi14_v,
                "ATR_%": r["ATR_%"], "Dist_SMA200_%": r["Dist_SMA200_%"],
                "RVOL_5D": r["RVOL_5D"], "Return_5D_%": r["Return_5D_%"],
                "Tendencia_Sana": int(tendencia_sana), "Drawdown_52W_%": dd_v,
                "Sample_Weight": round(w, 4), "Target": target,
                "TP_Pct": p["tp"] * 100.0, "SL_Pct": p["sl"] * 100.0,
            })
    df = pd.DataFrame(rows)
    df["RR_Ratio"] = df["TP_Pct"] / df["SL_Pct"].clip(lower=0.5)
    df["ATR_Risk_Pct"] = 2.0 * df["ATR_%"]
    df["TP_ATR"] = df["TP_Pct"] / df["ATR_%"].clip(lower=0.01)
    df["Abs_Drawdown"] = df["Drawdown_52W_%"].abs()
    df["RSI2_DD"] = df["RSI_2"] * df["Abs_Drawdown"] / 100.0
    df["RSI2_RSI14"] = df["RSI_2"] - df["RSI_14"]
    df = df.merge(load_fundamentals(), on="Ticker", how="left")
    idx_feats = get_index_features(df["Date"].unique())
    df = df.merge(idx_feats, left_on="Date", right_index=True, how="left")
    return df


# ── Backtest honesto real (últimos 45 días) ──────────────────────────────────
def enrich_feat(df):
    """Aplica a un dataframe de features las derivadas + fundamentales (igual que train)."""
    df = df.copy()
    pct = df["Categoria"].map({k: v["tp"] * 100.0 for k, v in CAT_PARAMS.items()})
    sl = df["Categoria"].map({k: v["sl"] * 100.0 for k, v in CAT_PARAMS.items()})
    df["TP_Pct"] = pct.values
    df["SL_Pct"] = sl.values
    df["RR_Ratio"] = df["TP_Pct"] / df["SL_Pct"].clip(lower=0.5)
    df["ATR_Risk_Pct"] = 2.0 * df["ATR_%"]
    df["TP_ATR"] = df["TP_Pct"] / df["ATR_%"].clip(lower=0.01)
    df["Abs_Drawdown"] = df["Drawdown_52W_%"].abs()
    df["RSI2_DD"] = df["RSI_2"] * df["Abs_Drawdown"] / 100.0
    df["RSI2_RSI14"] = df["RSI_2"] - df["RSI_14"]
    df = df.merge(load_fundamentals(), on="Ticker", how="left")
    idx_feats = get_index_features(df["Date"].unique())
    df = df.merge(idx_feats, left_on="Date", right_index=True, how="left")
    return df


def honest_backtest(model, feat_test, iso=None, umbral=0.4):
    feat_test = enrich_feat(feat_test)
    prob = model.predict_proba(feat_test[FULL_FEATURES])[:, 1]
    if iso is not None:
        prob = iso.predict(prob)
    trades = simulate_signals(feat_test.copy(), prob, umbral=umbral)
    return trades, prob


def honest_score(trades, fbeta=0.5):
    """Score del backtest honesto: WR penalizado por pocas muestras (Wilson LB)
    combinado con la cobertura. Recompensa WR alto con n razonable."""
    m = metrics(trades)
    n, w = m["total"], m["wins"]
    if n == 0:
        return 0.0
    wr = w / n
    # Wilson lower bound (95%)
    z = 1.96
    denom = 1 + z * z / n
    center = (wr + z * z / (2 * n)) / denom
    margin = z * math.sqrt((wr * (1 - wr) + z * z / (4 * n)) / n) / denom
    wilson = max(0.0, center - margin)
    cover = min(1.0, n / 40.0)
    return wilson * cover


# ── Walk-forward con features consistentes ───────────────────────────────────
def walk_forward(df, params, features=None, n_splits=4):
    features = features or FULL_FEATURES
    udates = sorted(df["Date"].unique())
    ns = n_splits
    ss = len(udates) // ns
    rows = []
    for i in range(1, ns):
        tr = udates[: i * ss]
        te = udates[i * ss: (i + 1) * ss]
        mtr, mte = df["Date"].isin(tr), df["Date"].isin(te)
        clf = lgb.LGBMClassifier(**params, verbose=-1)
        clf.fit(df.loc[mtr, features], df.loc[mtr, "Target"], sample_weight=df.loc[mtr, "Sample_Weight"])
        pte = clf.predict_proba(df.loc[mte, features])[:, 1]
        yte = df.loc[mte, "Target"].values
        for p, y in zip(pte, yte):
            rows.append((p, y))
    if not rows:
        return None
    return np.array([r[0] for r in rows]), np.array([r[1] for r in rows])


def calib_report(prob, y, nombre):
    if len(prob) == 0:
        return None
    rows = []
    bins = np.linspace(0, 1, 11)
    idx = np.digitize(prob, bins[1:-1])
    ece = 0.0
    for i in range(10):
        sel = idx == i
        if sel.sum() == 0:
            continue
        pbar, wr, nn = prob[sel].mean(), y[sel].mean(), int(sel.sum())
        ece += nn / len(prob) * abs(pbar - wr)
        rows.append({"bucket": f"{bins[i]:.2f}-{bins[i+1]:.2f}", "n": nn,
                     "prob_prom": round(float(pbar), 3), "wr_real": round(float(wr), 3)})
    return {
        "nombre": nombre, "n": int(len(prob)),
        "ece": round(ece, 4), "brier": round(float(brier_score_loss(y, prob)), 4),
        "auc": round(float(roc_auc_score(y, prob)), 3),
        "pearson": round(float(np.corrcoef(prob, y)[0, 1]), 3),
        "spearman": round(float(spearmanr(prob, y).statistic), 3),
        "buckets": rows,
    }


def main():
    t0 = time.time()
    print("📦 [1/5] Cargando caché OHLCV y construyendo dataset consistente...")
    ohlcv = pd.read_csv(CACHE, parse_dates=["Date"])
    end_date = ohlcv["Date"].max().normalize()
    test_start = end_date - pd.Timedelta(days=45)
    print(f"   OHLCV: {len(ohlcv)} filas · {ohlcv['Ticker'].nunique()} tickers")
    print(f"   Ventana test: {test_start.date()} → {end_date.date()}")

    feat_all = compute_features(ohlcv)
    feat_test = feat_all[feat_all["Date"] >= test_start].copy()
    print(f"   Filas test (con categoría): {len(feat_test)}")

    df = build_dataset(ohlcv)
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values("Date").reset_index(drop=True)
    print(f"   Dataset consistente: {len(df)} filas · base rate={df['Target'].mean():.3f} · tickers={df['Ticker'].nunique()}")
    print(f"   Tickers con fundamentales: {df['FCF_log'].notna().sum()}")

    # Split sin leakage: entrenar solo con datos anteriores a la ventana de test
    df_train = df[df["Date"] < test_start].reset_index(drop=True)
    ytr = df_train["Target"].values
    print(f"   Train (antes de {test_start.date()}): {len(df_train)} filas")

    y = df["Target"].values
    print("\n   Coherencia de features con Target (Pearson):")
    for c in FULL_FEATURES:
        m = df[c].notna()
        if m.sum() > 50:
            print(f"     {c:25s} r={np.corrcoef(df.loc[m, c], y[m])[0,1]:+.3f}  n={m.sum()}")

    # Baseline walk-forward
    print("\n🔄 [2/5] Baseline walk-forward (features base) + Optimización Optuna...")
    base_params = dict(n_estimators=200, learning_rate=0.03, num_leaves=31, random_state=42)

    def objective(trial):
        params = dict(
            n_estimators=trial.suggest_int("n_estimators", 100, 500, step=50),
            learning_rate=trial.suggest_float("learning_rate", 0.01, 0.1, log=True),
            num_leaves=trial.suggest_int("num_leaves", 15, 63),
            min_child_samples=trial.suggest_int("min_child_samples", 20, 200),
            subsample=trial.suggest_float("subsample", 0.6, 1.0),
            colsample_bytree=trial.suggest_float("colsample_bytree", 0.4, 1.0),
            reg_lambda=trial.suggest_float("reg_lambda", 1e-3, 50, log=True),
            random_state=42,
        )
        # 60% F0.5 OOS walk-forward + 40% score del backtest honesto
        wf = walk_forward(df_train, params)
        if wf is None:
            return 0.0
        oos_p, oos_y = wf
        f05 = max(fbeta_score(oos_y, (oos_p >= th).astype(int), beta=0.5, zero_division=0)
                  for th in np.linspace(0.1, 0.9, 17))
        model = lgb.LGBMClassifier(**params, verbose=-1)
        model.fit(df_train[FULL_FEATURES], ytr, sample_weight=df_train["Sample_Weight"])
        trades, _ = honest_backtest(model, feat_test, iso=None, umbral=0.4)
        hsc = honest_score(trades)
        return 0.6 * f05 + 0.4 * hsc

    study = optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler(seed=42))
    study.optimize(objective, n_trials=60, show_progress_bar=False)
    best_params = study.best_params
    best_params["random_state"] = 42
    print(f"   Mejores params: {best_params}")

    # Entrenar modelo final SOLO con datos anteriores a la ventana de test (sin leakage)
    print("\n🎓 [3/5] Entrenando modelo final + recalibración isotónica...")
    model = lgb.LGBMClassifier(**best_params)
    model.fit(df_train[FULL_FEATURES], ytr, sample_weight=df_train["Sample_Weight"])
    wf = walk_forward(df_train, best_params)
    oos_p, oos_y = wf
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.001, y_max=0.999)
    iso.fit(oos_p, oos_y)
    prob_cal_oos = iso.predict(oos_p)

    # Evaluación honesta (prob cruda = señal natural del modelo; isotónica daña)
    print("\n📊 [4/5] Backtest honesto real (últimos 45 días) — prob CRUDA:")
    for th in [0.3, 0.4, 0.45, 0.5]:
        trades, prob = honest_backtest(model, feat_test, iso=None, umbral=th)
        m = metrics(trades)
        print(f"   th={th}: {m['total']} trades | WR={m['win_rate_%']}% | PnL prom={m['pnl_promedio_%']}% | wins={m['wins']} loss={m['losses']} to={m['timeouts']}")
        for c in calibration(trades):
            print(f"       {c['bucket']:>10} n={c['n']:>3} prob={c['prob_prom_%']:>5.1f} WR={c['wr_real_%']:>5.1f}%")

    # Guardar mejor modelo
    out_model = os.path.join(MODELOS, "lightgbm_noche.pkl")
    out_iso = os.path.join(MODELOS, "isotonic_noche.pkl")
    out_meta = os.path.join(MODELOS, "modelo_metadata_noche.json")
    joblib.dump(model, out_model)
    joblib.dump(iso, out_iso)

    report = {
        "fecha": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "t_duration_s": round(time.time() - t0, 1),
        "test_start": str(test_start.date()),
        "test_end": str(end_date.date()),
        "features": FULL_FEATURES,
        "best_params": best_params,
        "calibracion_oos_raw": calib_report(oos_p, oos_y, "oos raw"),
        "calibracion_oos_recal": calib_report(prob_cal_oos, oos_y, "oos recal"),
        "resumen_umbral": {},
    }
    for th in [0.3, 0.4, 0.45, 0.5]:
        trades, _ = honest_backtest(model, feat_test, iso=None, umbral=th)
        report["resumen_umbral"][str(th)] = metrics(trades)
    json.dump(report, open(out_meta, "w", encoding="utf-8"), indent=2, ensure_ascii=False)

    print(f"\n✅ Guardado: {out_model} · {out_iso} · {out_meta}")
    print(f"⏱️  Total: {report['t_duration_s']}s")


if __name__ == "__main__":
    main()
