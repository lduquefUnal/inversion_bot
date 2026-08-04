#!/usr/bin/env python3
"""
v3_ea_anual.py — Interés Efectivo Anual por Categoría (métrica objetivo)
========================================================================
Backtest honesto de 1 año completo (walk-forward sin leakage):
  - Train: datos OHLCV antes de 2025-08-01
  - Test:  2025-08-01 → 2026-07-31 (365 días, TODOS los regímenes de mercado)

Calcula por categoría la métrica a maximizar:
  Interés Efectivo Anual = (1 + E_trade) ^ n_trades_año - 1
donde E_trade = WR*avgWin - (1-WR)*avgLoss  (expectativa Van Tharp en %)
      n_trades_año = frecuencia real de señales en la ventana de 365 días.

Además prueba mejoras: umbral alto, filtro RS (Dist_SMA200_%>-5), filtro tendencia.
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
                        build_dataset, simulate_signals, metrics, CAT_PARAMS,
                        FULL_FEATURES, CACHE)

TEST_START = "2026-05-01"
TEST_END = "2026-07-31"
UMS = [0.4, 0.5, 0.6, 0.65]


def ea(trades, dias_ventana=365):
    if not trades:
        return 0.0
    wins = [t for t in trades if t["Resultado"] == "WIN"]
    losses = [t for t in trades if t["Resultado"] in ("LOSS", "TIMEOUT")]
    p = len(wins) / len(trades)
    aw = np.mean([t["PnL_Neto_%"] for t in wins]) if wins else 0.0
    al = np.mean([t["PnL_Neto_%"] for t in losses]) if losses else 0.0
    e = p * aw + (1 - p) * al
    freq = len(trades) / dias_ventana * 365.0
    ea_comp = (1 + e / 100.0) ** freq - 1.0
    ea_lin = e * freq / 100.0
    return e, freq, ea_comp, ea_lin, p, aw, al


def main():
    ohlcv = pd.read_csv(CACHE, parse_dates=["Date"])
    end = ohlcv["Date"].max().normalize()
    print(f"Caché OHLCV: {len(ohlcv)} filas, fecha máx {end.date()}")

    # Dataset consistente completo
    df = build_dataset(ohlcv)
    df["Date"] = pd.to_datetime(df["Date"])
    ts = pd.Timestamp(TEST_START)
    train = df[df["Date"] < ts].reset_index(drop=True)
    print(f"Train (pre {TEST_START}): {len(train)} filas, base rate {train['Target'].mean():.3f}")

    # Features de test (365 días)
    feat_all = compute_features(ohlcv)
    feat_test = feat_all[(feat_all["Date"] >= ts)].copy()
    feat_test = enrich_derived(feat_test)
    feat_test = enrich_fundamentals(feat_test)
    print(f"Test ({TEST_START} → {end.date()}): {len(feat_test)} filas")

    # Modelo nocturno (mejor discriminación OOS)
    params = json.load(open("Modelos/modelo_metadata_noche.json"))["best_params"]
    params["n_estimators"] = 300
    model = lgb.LGBMClassifier(**params, verbose=-1)
    model.fit(train[FULL_FEATURES], train["Target"], sample_weight=train["Sample_Weight"])
    prob = model.predict_proba(feat_test[FULL_FEATURES])[:, 1]

    tend = feat_test["Tendencia_Sana"].astype(bool).values
    rs = (feat_test["Dist_SMA200_%"] > -5).values

    configs = {
        "BASE": prob,
        "th alto 0.6": prob,
        "RS filtro": prob * rs,
        "Tendencia": prob * tend,
        "RS + Tendencia": prob * rs * tend,
    }

    print("\n" + "=" * 95)
    print("INTERÉS EFECTIVO ANUAL POR CATEGORÍA (walk-forward 1 año, sin leakage)")
    print("=" * 95)

    best = None
    for name, prob_eff in configs.items():
        for th in ([0.5] if name == "BASE" else ([0.6] if name == "th alto 0.6" else [0.5, 0.6])):
            trades = simulate_signals(feat_test.copy(), prob_eff, umbral=th)
            m = metrics(trades)
            if m["total"] == 0:
                continue
            e, freq, ea_c, ea_l, p, aw, al = ea(trades)
            tag = f"{name} @ th={th}"
            print(f"\n▶ {tag}: {m['total']} trades | WR={p*100:.1f}% | E={e:+.2f}% | "
                  f"freq={freq:.0f} tr/año | EA_comp={ea_c*100:+.1f}% | EA_lin={ea_l*100:+.1f}%")
            if ea_c > (best[0] if best else -1e9):
                best = (ea_c, tag, trades)

            # Por categoría
            cats = sorted(set(t["Categoria"] for t in trades))
            for c in cats:
                ct = [t for t in trades if t["Categoria"] == c]
                e2, f2, eac2, eal2, p2, aw2, al2 = ea(ct)
                print(f"    {c:22s} n={len(ct):3d} WR={p2*100:5.1f}% E={e2:+6.2f}% "
                      f"freq={f2:4.0f}/año EA_comp={eac2*100:+7.1f}% EA_lin={eal2*100:+7.1f}%")

    # Detalle del mejor config por categoría
    print("\n" + "=" * 95)
    print(f"MEJOR CONFIGURACIÓN: {best[1]} → EA anual {best[0]*100:+.1f}%")
    print("=" * 95)
    trades = best[2]
    for c in sorted(set(t["Categoria"] for t in trades)):
        ct = [t for t in trades if t["Categoria"] == c]
        e2, f2, eac2, eal2, p2, aw2, al2 = ea(ct)
        print(f"  {c:22s} n={len(ct):3d} WR={p2*100:5.1f}% E={e2:+6.2f}% freq={f2:4.0f}/año "
              f"EA_comp={eac2*100:+7.1f}% EA_lin={eal2*100:+7.1f}%")


if __name__ == "__main__":
    main()
