#!/usr/bin/env python3
"""
v3_validar.py — Validación OOS de los combos ganadores del grid
================================================================
Los combos fueron seleccionados maximizando EA en la ventana W1 (May-Jul 2026).
Aquí se re-entrenan modelos con cutoff 2026-02-01 y se evalúan LOS MISMOS combos
en una ventana independiente W2 (Feb-Abr 2026) — validación out-of-sample real.

Reporta por categoría y total: % por trade (E), WR, EA% lineal, $ anual.
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
from v3_grid_completo import build_ds, simulate, ea_of, SKILL_TARGET, CAPITAL

# Combos ganadores del grid (seleccionados en W1: May-Jul 2026)
WINNERS = {
    "Recup. Rapida":     (0.20, 0.05, 30),
    "Cuchillos Cayendo": (0.20, 0.03, 7),
    "Sweet Spot":        (0.05, 0.10, 45),
    "Cazador Dips":      (0.08, 0.10, 15),
}

WINDOWS = {
    "W1 (selección, May-Jul)": "2026-05-01",
    "W2 (validación, Feb-Abr)": "2026-02-01",
}


def run_window(ohlcv, cutoff, label):
    params = json.load(open("Modelos/modelo_metadata_noche.json"))["best_params"]
    params["n_estimators"] = 300
    ts = pd.Timestamp(cutoff)
    feat_all = compute_features(ohlcv)
    feat_test = feat_all[feat_all["Date"] >= ts].copy()
    feat_test = enrich_derived(feat_test)
    feat_test = enrich_fundamentals(feat_test)
    n_test = len(feat_test)

    dias_set = sorted(set(d for _, _, d in WINNERS.values()))
    probs = {}
    for dias in dias_set:
        df = build_ds(ohlcv, SKILL_TARGET, dias)
        df["Date"] = pd.to_datetime(df["Date"])
        train = df[df["Date"] < ts].reset_index(drop=True)
        m = lgb.LGBMClassifier(**params, verbose=-1)
        m.fit(train[FULL_FEATURES], train["Target"], sample_weight=train["Sample_Weight"])
        probs[dias] = m.predict_proba(feat_test[FULL_FEATURES])[:, 1]

    print(f"\n{'='*100}\n{label}  (cutoff {cutoff}, test n={n_test} filas)\n{'='*100}")
    all_trades = []
    for cat, (tp, sl, dias) in WINNERS.items():
        trades = simulate(feat_test, probs[dias], dias, tp, sl)
        ct = [t for t in trades if t["Categoria"] == cat]
        r = ea_of(ct)
        all_trades.extend(ct)
        if r is None or r["n"] == 0:
            print(f"  {cat:22s} n=0")
            continue
        print(f"  {cat:22s} TP={tp*100:3.0f}% SL={sl*100:3.0f}% días={dias:2d} | "
              f"n={r['n']:3d} WR={r['wr']*100:5.1f}% | E={r['e']:+5.2f}%/trade | "
              f"freq={r['freq']:4.0f}/año | EA%={r['ea_lin']*100:+7.1f}% | ${r['usd']:+6.0f}/año")
    rt = ea_of(all_trades)
    if rt and rt["n"]:
        print(f"  {'TOTAL':22s} n={rt['n']:3d} WR={rt['wr']*100:5.1f}% | "
              f"E={rt['e']:+5.2f}%/trade | freq={rt['freq']:4.0f}/año | "
              f"EA%={rt['ea_lin']*100:+7.1f}% | ${rt['usd']:+6.0f}/año")


def main():
    ohlcv = pd.read_csv(CACHE, parse_dates=["Date"])
    for label, cutoff in WINDOWS.items():
        run_window(ohlcv, cutoff, label)


if __name__ == "__main__":
    main()
