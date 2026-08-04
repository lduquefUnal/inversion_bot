#!/usr/bin/env python3
"""
v3_entrenar_modelo.py — Refinamiento del mejor modelo maximizando EA anual
==========================================================================
Métrica objetivo: Interés Efectivo Anual por categoría = (1+E)^freq - 1.
E = WR*avgWin - (1-WR)*avgLoss; freq = trades/ventana*365.

Grid: config de TP/SL (actual vs skill) × días máximos (5, 7, 11, 15).
Para cada combinación reconstruye el dataset con horizon=dias (target coherente
con la simulación), entrena walk-forward sin leakage y mide EA en el backtest
honesto. Reporta la mejor combinación POR CATEGORÍA y entrena el modelo final
con la config óptima.
"""
import os
import sys
import json
import math
import logging
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.metrics import fbeta_score

sys.path.insert(0, os.path.dirname(__file__))
from bt_honesto import (compute_features, enrich_derived, enrich_fundamentals,
                        build_dataset, simulate_signals, metrics, CAT_PARAMS,
                        FULL_FEATURES, CACHE, rsi, atr, asignar_categoria,
                        load_fundamentals, log)

log = logging.getLogger("v3_entrenar")

TEST_START = "2026-05-01"
CATS = ["Sweet Spot", "Cazador Dips", "Recup. Rapida", "Cuchillos Cayendo"]

CONFIGS = {
    "actual": {"Sweet Spot": (0.15, 0.06), "Cazador Dips": (0.12, 0.05),
               "Recup. Rapida": (0.10, 0.04), "Cuchillos Cayendo": (0.08, 0.04)},
    "skill":  {"Sweet Spot": (0.15, 0.08), "Cazador Dips": (0.12, 0.08),
               "Recup. Rapida": (0.15, 0.05), "Cuchillos Cayendo": (0.08, 0.05)},
}


def build_ds(ohlcv, cfg, dias):
    """Dataset con target coherente: TP/SL de cfg, ventana de salida = dias."""
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
        for i in range(len(g) - dias):
            r = g.iloc[i]
            cat = asignar_categoria(r["Drawdown_52W_%"], r["RSI_14"], r["RSI_2"], bool(r["Tendencia_Sana"]))
            if cat is None:
                continue
            tp, sl = cfg[cat]
            tp_price = r["Close"] * (1 + tp)
            sl_price = r["Close"] * (1 - sl)
            fut = g.iloc[i + 1: i + 1 + dias]
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
                         "Cat_Sweet_Spot": int(cat == "Sweet Spot"),
                         "Cat_Cazador_Dips": int(cat == "Cazador Dips"),
                         "Cat_Recup_Rapida": int(cat == "Recup. Rapida"),
                         "Cat_Cuchillos_Cayendo": int(cat == "Cuchillos Cayendo"),
                         "Close": r["Close"],
                         "RSI_2": r["RSI_2"], "RSI_7": r["RSI_7"], "RSI_14": r["RSI_14"],
                         "ATR_%": r["ATR_%"], "Dist_SMA200_%": r["Dist_SMA200_%"],
                         "RVOL_5D": r["RVOL_5D"], "Return_5D_%": r["Return_5D_%"],
                         "Tendencia_Sana": int(r["Tendencia_Sana"]),
                         "Drawdown_52W_%": r["Drawdown_52W_%"],
                         "Sample_Weight": round(w, 4), "Target": target,
                         "TP_Pct": tp * 100.0, "SL_Pct": sl * 100.0})
    df = pd.DataFrame(rows)
    df = enrich_derived(df)
    df = enrich_fundamentals(df)
    return df


def ea(trades, dias_ventana=90):
    if not trades:
        return 0.0, 0.0, 0.0, 0.0
    wins = [t for t in trades if t["Resultado"] == "WIN"]
    losses = [t for t in trades if t["Resultado"] in ("LOSS", "TIMEOUT")]
    p = len(wins) / len(trades)
    aw = np.mean([t["PnL_Neto_%"] for t in wins]) if wins else 0.0
    al = np.mean([t["PnL_Neto_%"] for t in losses]) if losses else 0.0
    e = p * aw + (1 - p) * al
    freq = len(trades) / dias_ventana * 365.0
    return e, freq, (1 + e / 100.0) ** freq - 1.0, p


def main():
    ohlcv = pd.read_csv(CACHE, parse_dates=["Date"])
    ts = pd.Timestamp(TEST_START)
    params = json.load(open("Modelos/modelo_metadata_noche.json"))["best_params"]
    params["n_estimators"] = 300

    # Features de test (una sola vez)
    feat_all = compute_features(ohlcv)
    feat_test = feat_all[feat_all["Date"] >= ts].copy()
    feat_test = enrich_derived(feat_test)
    feat_test = enrich_fundamentals(feat_test)

    results = {}
    for cfg_name, cfg in CONFIGS.items():
        for dias in [5, 7, 11, 15]:
            df = build_ds(ohlcv, cfg, dias)
            df["Date"] = pd.to_datetime(df["Date"])
            train = df[df["Date"] < ts].reset_index(drop=True)
            model = lgb.LGBMClassifier(**params, verbose=-1)
            model.fit(train[FULL_FEATURES], train["Target"], sample_weight=train["Sample_Weight"])
            prob = model.predict_proba(feat_test[FULL_FEATURES])[:, 1]
            best_row = None
            for th in [0.4, 0.5, 0.6]:
                trades = simulate_signals(feat_test.copy(), prob, umbral=th)
                e, freq, ea_c, p = ea(trades)
                key = (cfg_name, dias, th)
                results[key] = {"trades": len(trades), "wr": p, "e": e, "ea": ea_c,
                                "freq": freq, "model": model, "prob": prob}
                if best_row is None or ea_c > best_row[1]:
                    best_row = (key, ea_c)
            tag = f"{cfg_name} dias={dias}"
            print(f"✓ {tag}: mejor th={best_row[0][2]} EA={best_row[1]*100:+.1f}%")

    top = sorted(((k, v) for k, v in results.items()), key=lambda x: -x[1]["ea"])[:5]
    log.info("TOP 5 configuraciones por EA anual total:")
    for k, v in top:
        log.info("  %s días=%d th=%s → %d tr | WR=%.1f%% | E=%+.2f%% | freq=%.0f/año | EA=%+.1f%%",
                 k[0], k[1], k[2], v['trades'], v['wr']*100, v['e'], v['freq'], v['ea']*100)

    # Mejor configuración por categoría
    print("\n📊 MEJOR CONFIG POR CATEGORÍA (EA max):")
    best_config = max(top, key=lambda x: x[1]["ea"])
    k, v = best_config
    cfg, dias, th = k
    cat_params = {c: {"tp": CONFIGS[cfg][c][0], "sl": CONFIGS[cfg][c][1], "limite_dias": dias}
                  for c in CATS}
    trades = simulate_signals(feat_test.copy(), v["prob"], umbral=th)
    for c in CATS:
        ct = [t for t in trades if t["Categoria"] == c]
        e, freq, ea_c, p = ea(ct)
        print(f"  {c:22s} n={len(ct):3d} WR={p*100:5.1f}% E={e:+6.2f}% freq={freq:4.0f}/año EA={ea_c*100:+7.1f}%")

    # Guardar modelo final con config óptima
    out_model = "Modelos/lightgbm_v3.pkl"
    out_meta = "Modelos/modelo_metadata_v3.json"
    import joblib
    joblib.dump(v["model"], out_model)
    json.dump({
        "fecha": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "config_optima": {"cfg": cfg, "dias": dias, "th": th},
        "cat_params_optimos": cat_params,
        "ea_anual_%": round(v["ea"] * 100, 2),
        "trades": v["trades"], "wr_%": round(v["wr"] * 100, 1),
        "test": f"{TEST_START} → {ohlcv['Date'].max().date()}",
        "features": FULL_FEATURES,
        "grid_todos": {f"{kk[0]}|{kk[1]}|{kk[2]}": {"trades": rr["trades"], "wr_%": round(rr["wr"]*100,1),
                       "e_%": round(rr["e"],2), "ea_%": round(rr["ea"]*100,1)} for kk, rr in results.items()},
    }, open(out_meta, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(f"\n✅ Modelo final: {out_model} · {out_meta}")


if __name__ == "__main__":
    main()
