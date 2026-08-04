#!/usr/bin/env python3
"""
v3_skill_backtest.py — V3: Backtest honesto con target de la SKILL
==================================================================
Re-entrena el modelo con los TP/SL de SWING_TRADING_SKILL.md (target más
discriminativo según validación OOS: AUC 0.623 vs 0.571) y evalúa el
backtest honesto real de los últimos 45 días con esos mismos parámetros.

Reporta: WR real, expectancia (Van Tharp), R-múltiplos, profit factor.
"""
import os
import sys
import json
import math
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.metrics import fbeta_score, roc_auc_score
from scipy.stats import spearmanr

sys.path.insert(0, os.path.dirname(__file__))
from bt_honesto import (rsi, atr, asignar_categoria, CAT_PARAMS, enrich_derived,
                        enrich_fundamentals, compute_features, simulate_signals,
                        metrics, calibration, MODELOS, CACHE, load_fundamentals)

# TP/SL de la SKILL (más agresivos, mejor R-múltiplo)
SKILL_PARAMS = {
    "Sweet Spot":        {"tp": 0.15, "sl": 0.08, "limite_dias": 11},
    "Cazador Dips":      {"tp": 0.12, "sl": 0.08, "limite_dias": 11},
    "Recup. Rapida":     {"tp": 0.15, "sl": 0.05, "limite_dias": 11},
    "Cuchillos Cayendo": {"tp": 0.08, "sl": 0.05, "limite_dias": 11},
}

FEATS = ["Cat_Sweet_Spot", "Cat_Cazador_Dips", "Cat_Recup_Rapida", "Cat_Cuchillos_Cayendo",
         "RSI_2", "RSI_7", "RSI_14", "ATR_%", "Dist_SMA200_%", "RVOL_5D", "Return_5D_%",
         "Tendencia_Sana", "Drawdown_52W_%", "RR_Ratio", "ATR_Risk_Pct", "TP_ATR",
         "Abs_Drawdown", "RSI2_DD", "RSI2_RSI14", "FCF_log", "Beta"]


def build_skill_dataset(ohlcv, horizon=11):
    rows = []
    for ticker, g in ohlcv.groupby("Ticker"):
        g = g.sort_values("Date").reset_index(drop=True)
        if len(g) < 60:
            continue
        g["RSI_2"] = rsi(g["Close"], 2); g["RSI_7"] = rsi(g["Close"], 7); g["RSI_14"] = rsi(g["Close"], 14)
        g["ATR_%"] = atr(g) / g["Close"] * 100.0
        g["SMA_200"] = g["Close"].rolling(200).mean(); g["SMA_50"] = g["Close"].rolling(50).mean()
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
            cat = asignar_categoria(r["Drawdown_52W_%"], r["RSI_14"], r["RSI_2"], bool(r["Tendencia_Sana"]))
            if cat is None:
                continue
            p = SKILL_PARAMS[cat]
            tp_price, sl_price = r["Close"] * (1 + p["tp"]), r["Close"] * (1 - p["sl"])
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
            w = math.exp(-math.log(2) * (days_old / 90.0))
            rows.append({"Date": r["Date"], "Ticker": ticker, "Categoria": cat,
                         "Cat_Sweet_Spot": int(cat == "Sweet Spot"), "Cat_Cazador_Dips": int(cat == "Cazador Dips"),
                         "Cat_Recup_Rapida": int(cat == "Recup. Rapida"), "Cat_Cuchillos_Cayendo": int(cat == "Cuchillos Cayendo"),
                         "Close": r["Close"], "High": r["High"], "Low": r["Low"],
                         "RSI_2": r["RSI_2"], "RSI_7": r["RSI_7"], "RSI_14": r["RSI_14"], "ATR_%": r["ATR_%"],
                         "Dist_SMA200_%": r["Dist_SMA200_%"], "RVOL_5D": r["RVOL_5D"], "Return_5D_%": r["Return_5D_%"],
                         "Tendencia_Sana": int(r["Tendencia_Sana"]), "Drawdown_52W_%": r["Drawdown_52W_%"],
                         "Sample_Weight": round(w, 4), "Target": target, "TP_Pct": p["tp"] * 100.0, "SL_Pct": p["sl"] * 100.0})
    df = pd.DataFrame(rows)
    df = enrich_derived(df)
    df = enrich_fundamentals(df)
    return df


def expectancy(trades):
    m = metrics(trades)
    if m["total"] == 0:
        return {"expectancy_pct": 0, "expectancy_R": 0, "profit_factor": 0}
    wins = [t for t in trades if t["Resultado"] == "WIN"]
    losses = [t for t in trades if t["Resultado"] in ("LOSS", "TIMEOUT")]
    aw = float(np.mean([t["PnL_Neto_%"] for t in wins])) if wins else 0.0
    al = float(np.mean([t["PnL_Neto_%"] for t in losses])) if losses else 0.0
    p = len(wins) / len(trades)
    e = p * aw + (1 - p) * al
    r = float(np.mean([t["SL_%"] for t in trades])) if trades else 1.0
    return {"win_rate": p, "avg_win": round(aw, 2), "avg_loss": round(al, 2),
            "expectancy_pct": round(e, 2), "expectancy_R": round(e / max(r, 0.01), 2),
            "profit_factor": round(sum(t["PnL_Neto_%"] for t in wins) / max(abs(sum(t["PnL_Neto_%"] for t in losses)), 1e-9), 2)}


def main():
    ohlcv = pd.read_csv(CACHE, parse_dates=["Date"])
    end_date = ohlcv["Date"].max().normalize()
    test_start = end_date - pd.Timedelta(days=45)

    df = build_skill_dataset(ohlcv)
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values("Date").reset_index(drop=True)
    train = df[df["Date"] < test_start].reset_index(drop=True)
    print(f"Train skill (pre-test): {len(train)} filas, base rate {train['Target'].mean():.3f}")

    # Features de test (para simulación con TP/SL de la skill)
    feat_all = compute_features(ohlcv)
    feat_test = feat_all[feat_all["Date"] >= test_start].copy()
    feat_test = enrich_derived(feat_test)
    feat_test = enrich_fundamentals(feat_test)
    print(f"Test: {len(feat_test)} filas")

    # Optimizar hiperparámetros brevemente sobre walk-forward del target skill
    base_params = json.load(open(os.path.join(MODELOS, "modelo_metadata_noche.json")))["best_params"]
    params = dict(base_params)
    params["n_estimators"] = 300

    model = lgb.LGBMClassifier(**params, verbose=-1)
    model.fit(train[FEATS], train["Target"], sample_weight=train["Sample_Weight"])
    prob = model.predict_proba(feat_test[FEATS])[:, 1]

    # Simular con TP/SL de la skill (parche temporal en CAT_PARAMS)
    orig = dict(CAT_PARAMS)
    CAT_PARAMS.update(SKILL_PARAMS)
    try:
        results = {}
        print("\n📊 BACKTEST HONESTO — target + TP/SL de la SKILL:")
        for th in [0.4, 0.45, 0.5, 0.55]:
            trades = simulate_signals(feat_test.copy(), prob, umbral=th)
            m = metrics(trades)
            e = expectancy(trades)
            results[str(th)] = {"metrics": m, "expectancy": e}
            print(f"\n  th={th}: {m['total']} trades | WR={m['win_rate_%']}% | PnL prom={m['pnl_promedio_%']}%")
            if m["total"] > 0:
                print(f"     Expectancy={e['expectancy_pct']}% ({e['expectancy_R']}R) | PF={e['profit_factor']} | avgW={e['avg_win']}% avgL={e['avg_loss']}%")
            for c in calibration(trades):
                print(f"       {c['bucket']:>10} n={c['n']:>3} WR={c['wr_real_%']:>5.1f}%")

        # Guardar mejor modelo V3
        out_model = os.path.join(MODELOS, "lightgbm_v3_skill.pkl")
        out_meta = os.path.join(MODELOS, "modelo_metadata_v3_skill.json")
        import joblib
        joblib.dump(model, out_model)
        meta = {
            "fecha": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
            "estrategia": "TP/SL de SWING_TRADING_SKILL.md (Recup 15/5, Sweet 15/8, Cazador 12/8, Cuchillos 8/5)",
            "params": params, "features": FEATS,
            "test_start": str(test_start.date()), "test_end": str(end_date.date()),
            "resultados_umbral": results,
        }
        json.dump(meta, open(out_meta, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        print(f"\n✅ Guardado: {out_model} · {out_meta}")
    finally:
        CAT_PARAMS.clear()
        CAT_PARAMS.update(orig)


if __name__ == "__main__":
    main()
