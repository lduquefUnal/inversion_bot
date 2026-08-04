#!/usr/bin/env python3
"""
v3_finetune.py — Fine-tuning restringido: plazos 7-15 días, TP 8-15%, SL 3-8%
================================================================================
Corrige el error del grid anterior (sobreajuste a W1: TP20% y 30-45 días eran
máximos de UNA ventana, no robustos). Aquí:
  - Solo plazos 7, 11, 15 días (preferencia usuario + skill 3-5 días max)
  - TP 8, 10, 12, 15% · SL 3, 4, 5, 6, 8%
  - Validación DOBLE: selección en W2 (Feb-Abr) y confirmación OOS en W1 (May-Jul)
    (se entrena con cutoff antes de cada ventana, sin leakage)
"""
import os
import sys
import json
import math
import numpy as np
import pandas as pd
import lightgbm as lgb

sys.path.insert(0, os.path.dirname(__file__))
from bt_honesto import (compute_features, enrich_derived, enrich_fundamentals,
                        rsi, atr, asignar_categoria, FULL_FEATURES, CACHE)
from v3_grid_completo import build_ds, simulate, ea_of, SKILL_TARGET

TPS = [0.08, 0.10, 0.12, 0.15]
SLS = [0.03, 0.04, 0.05, 0.06, 0.08]
DIAS = [7, 11, 15]
CATS = ["Sweet Spot", "Cazador Dips", "Recup. Rapida", "Cuchillos Cayendo"]


def main():
    ohlcv = pd.read_csv(CACHE, parse_dates=["Date"])
    params = json.load(open("Modelos/modelo_metadata_noche.json"))["best_params"]
    params["n_estimators"] = 300

    # Ventanas
    windows = {"W2 (Feb-Abr)": "2026-02-01", "W1 (May-Jul)": "2026-05-01"}
    probs_by_win = {}
    for label, cutoff in windows.items():
        ts = pd.Timestamp(cutoff)
        feat_all = compute_features(ohlcv)
        feat_test = feat_all[feat_all["Date"] >= ts].copy()
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
        probs_by_win[label] = (feat_test, dias_probs)

    # Selección en W2 (todas las combos), luego validar top en W1
    sel = []
    feat2, pr2 = probs_by_win["W2 (Feb-Abr)"]
    for cat in CATS:
        for dias in DIAS:
            for tp in TPS:
                for sl in SLS:
                    trades = simulate(feat2, pr2[dias], dias, tp, sl)
                    ct = [t for t in trades if t["Categoria"] == cat]
                    r = ea_of(ct)
                    if r and r["n"] >= 8 and r["e"] > 0:
                        sel.append({"cat": cat, "tp": tp, "sl": sl, "dias": dias,
                                    "n": r["n"], "wr": r["wr"], "e": r["e"],
                                    "ea_lin": r["ea_lin"]})

    df_sel = pd.DataFrame(sel)
    print("Combos rentables en W2 (n≥8, E>0):", len(df_sel))
    print("\nTOP 3 por categoría seleccionados en W2 → validados OOS en W1:\n")
    feat1, pr1 = probs_by_win["W1 (May-Jul)"]
    results = []
    for cat in CATS:
        c = df_sel[df_sel.cat == cat].sort_values("ea_lin", ascending=False).head(3)
        if len(c) == 0:
            print(f"  {cat}: ningún combo rentable en W2")
            continue
        for _, row in c.iterrows():
            trades = simulate(feat1, pr1[row.dias], row.dias, row.tp, row.sl)
            ct = [t for t in trades if t["Categoria"] == row["cat"]]
            r1 = ea_of(ct)
            wr1 = r1["wr"] * 100 if r1 and r1["n"] else 0
            e1 = r1["e"] if r1 and r1["n"] else 0
            ea1 = r1["ea_lin"] * 100 if r1 and r1["n"] else 0
            n1 = r1["n"] if r1 else 0
            ok = "✅" if (r1 and r1["n"] >= 8 and e1 > 0) else "❌"
            results.append({**row, "n_W1": n1, "wr_W1": wr1, "e_W1": e1, "ea_W1": ea1, "ok": ok})
            print(f"  {row['cat']:22s} TP={row.tp*100:3.0f}% SL={row.sl*100:3.0f}% días={row.dias:2d} | "
                  f"W2: n={row.n:3d} WR={row.wr*100:5.1f}% E={row.e:+5.2f}% → "
                  f"W1(OOS): n={n1:3d} WR={wr1:5.1f}% E={e1:+5.2f}% EA={ea1:+6.1f}% {ok}")

    # Guardar
    pd.DataFrame(results).to_csv("Modelos/finetune_resultados.csv", index=False)
    print("\n✅ Guardado: Modelos/finetune_resultados.csv")


if __name__ == "__main__":
    main()
