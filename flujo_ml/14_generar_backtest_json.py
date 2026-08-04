#!/usr/bin/env python3
"""
14_generar_backtest_json.py — Genera backtest_45d.json con el BACKTEST HONESTO
==============================================================================
Usa el modelo nocturno (lightgbm_noche.pkl, seed única, prob cruda) sobre las
señales no repetidas de los últimos 45 días y escribe el JSON que lee la UI.
"""
import os
import json
import numpy as np
import pandas as pd
import joblib
import sys
sys.path.insert(0, os.path.dirname(__file__))
from bt_honesto import compute_features, simulate_signals, metrics, calibration, CACHE
from n13 import enrich_feat, FULL_FEATURES

ROOT = os.path.join(os.path.dirname(__file__), "..")
MODELOS = os.path.join(ROOT, "Modelos")
FLUJO_DATOS = os.path.join(ROOT, "flujo_datos")
PUBLIC = os.path.join(ROOT, "frontend", "public")
UMBRAL = 0.5


def main():
    model = joblib.load(os.path.join(MODELOS, "lightgbm_noche.pkl"))
    ohlcv = pd.read_csv(CACHE, parse_dates=["Date"])
    end_date = ohlcv["Date"].max().normalize()
    test_start = end_date - pd.Timedelta(days=45)

    feat = compute_features(ohlcv)
    feat_test = feat[feat["Date"] >= test_start].copy()
    feat_test = enrich_feat(feat_test)
    prob = model.predict_proba(feat_test[FULL_FEATURES])[:, 1]
    trades = simulate_signals(feat_test, prob, umbral=UMBRAL)
    m = metrics(trades)

    print(f"Backtest honesto 45d (th={UMBRAL}): {m}")

    # Agrupar por categoría
    por_cat = {}
    for t in trades:
        por_cat.setdefault(t["Categoria"], []).append(t)
    resumen_cat = {}
    for cat, ts in por_cat.items():
        resumen_cat[cat] = metrics(ts)

    data = {
        "fecha": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "ventana": f"{test_start.date()} → {end_date.date()}",
        "metodologia": "backtest honesto: entrada al precio de cierre del día de señal, "
                       "señales no repetidas (1 trade por ticker), sin leakage (modelo entrenado "
                       "solo con datos anteriores a la ventana)",
        "umbral": UMBRAL,
        "resumen": m,
        "resumen_por_categoria": resumen_cat,
        "calibracion": calibration(trades),
        "trades": trades,
    }
    for path in [os.path.join(FLUJO_DATOS, "backtest_45d.json"),
                 os.path.join(PUBLIC, "backtest_45d.json")]:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"✅ Guardado: {path}")


if __name__ == "__main__":
    main()
