#!/usr/bin/env python3
"""
v3_objetivo.py — Combos que cumplen WR>50% y EA%>40% en AMBAS ventanas
======================================================================
Evalúa todas las combinaciones TP{8,10,12,15}×SL{3,4,5,6,8}×días{7,11,15}
en W2 (Feb-Abr) y W1 (May-Jul), cada una con modelo reentrenado sin leakage.
Filtra por WR>50% Y EA%>40% en las dos ventanas (métrica sin Kelly).
"""
import os
import sys
import json
import numpy as np
import pandas as pd
import lightgbm as lgb

sys.path.insert(0, os.path.dirname(__file__))
from bt_honesto import (compute_features, enrich_derived, enrich_fundamentals,
                        FULL_FEATURES, CACHE)
from v3_grid_completo import build_ds, simulate, ea_of, SKILL_TARGET

TPS = [0.08, 0.10, 0.12, 0.15]
SLS = [0.03, 0.04, 0.05, 0.06, 0.08]
DIAS = [7, 11, 15]
CATS = ["Sweet Spot", "Cazador Dips", "Recup. Rapida", "Cuchillos Cayendo"]
WR_MIN, EA_MIN = 0.50, 0.40


def main():
    ohlcv = pd.read_csv(CACHE, parse_dates=["Date"])
    params = json.load(open("Modelos/modelo_metadata_noche.json"))["best_params"]
    params["n_estimators"] = 300

    windows = {"W2": "2026-02-01", "W1": "2026-05-01"}
    data = {}
    for label, cutoff in windows.items():
        ts = pd.Timestamp(cutoff)
        feat_test = compute_features(ohlcv)
        feat_test = feat_test[feat_test["Date"] >= ts].copy()
        feat_test = enrich_derived(feat_test)
        feat_test = enrich_fundamentals(feat_test)
        dias_probs = {}
        for dias in DIAS:
            df = build_ds(ohlcv, SKILL_TARGET, dias)
            df["Date"] = pd.to_datetime(df["Date"])
            trn = df[df["Date"] < ts].reset_index(drop=True)
            m = lgb.LGBMClassifier(**params, verbose=-1)
            m.fit(trn[FULL_FEATURES], trn["Target"], sample_weight=trn["Sample_Weight"])
            dias_probs[dias] = m.predict_proba(feat_test[FULL_FEATURES])[:, 1]
        data[label] = (feat_test, dias_probs)

    rows = []
    for cat in CATS:
        for dias in DIAS:
            for tp in TPS:
                for sl in SLS:
                    stats = {}
                    for label in ("W2", "W1"):
                        feat, pr = data[label]
                        trades = simulate(feat, pr[dias], dias, tp, sl)
                        ct = [t for t in trades if t["Categoria"] == cat]
                        r = ea_of(ct)
                        stats[label] = {"n": r["n"] if r else 0,
                                        "wr": r["wr"] if r else 0,
                                        "e": r["e"] if r else 0,
                                        "ea": r["ea_lin"] if r else 0}
                    ok = (stats["W2"]["n"] >= 8 and stats["W1"]["n"] >= 8 and
                          stats["W2"]["wr"] > WR_MIN and stats["W1"]["wr"] > WR_MIN and
                          stats["W2"]["ea"] > EA_MIN and stats["W1"]["ea"] > EA_MIN)
                    if ok:
                        rows.append({"cat": cat, "tp": tp, "sl": sl, "dias": dias,
                                     "W2_n": stats["W2"]["n"], "W2_wr": round(stats["W2"]["wr"]*100,1),
                                     "W2_e": round(stats["W2"]["e"],2), "W2_ea": round(stats["W2"]["ea"]*100,1),
                                     "W1_n": stats["W1"]["n"], "W1_wr": round(stats["W1"]["wr"]*100,1),
                                     "W1_e": round(stats["W1"]["e"],2), "W1_ea": round(stats["W1"]["ea"]*100,1)})

    dfr = pd.DataFrame(rows)
    print(f"Combos con WR>50% Y EA>40% en AMBAS ventanas: {len(dfr)}\n")
    if len(dfr):
        for _, r in dfr.sort_values("W1_ea", ascending=False).iterrows():
            print(f"  {r['cat']:22s} TP={r.tp*100:3.0f}% SL={r.sl*100:3.0f}% días={r.dias:2d} | "
                  f"W2: n={r.W2_n:3d} WR={r.W2_wr:5.1f}% EA={r.W2_ea:+6.1f}% | "
                  f"W1: n={r.W1_n:3d} WR={r.W1_wr:5.1f}% EA={r.W1_ea:+6.1f}%")
    else:
        print("Ninguno cumple el criterio estricto. Mejores cercanos por categoría:")
        best = []
        for cat in CATS:
            cand = []
            for dias in DIAS:
                for tp in TPS:
                    for sl in SLS:
                        feat, pr = data["W1"]
                        trades = simulate(feat, pr[dias], dias, tp, sl)
                        ct = [t for t in trades if t["Categoria"] == cat]
                        r = ea_of(ct)
                        if r and r["n"] >= 8:
                            cand.append((r["wr"], r["ea_lin"], tp, sl, dias))
            if cand:
                cand.sort(key=lambda x: -x[1])
                w, ea_, tp, sl, dias = cand[0]
                print(f"  {cat:22s} TP={tp*100:3.0f}% SL={sl*100:3.0f}% días={dias:2d} WR={w*100:5.1f}% EA={ea_*100:+6.1f}%")

    dfr.to_csv("Modelos/objetivo_resultados.csv", index=False)
    print("\n✅ Guardado: Modelos/objetivo_resultados.csv")


if __name__ == "__main__":
    main()
