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
    trades = simulate_signals(feat_test, prob, umbral=UMBRAL, modo_timeout=False)
    trades_timeout = simulate_signals(feat_test, prob, umbral=UMBRAL, modo_timeout=True)
    
    m = metrics(trades)
    m_timeout = metrics(trades_timeout)

    print(f"Backtest honesto 45d Estándar (th={UMBRAL}): {m}")
    print(f"Backtest honesto 45d Timeout (th={UMBRAL}): {m_timeout}")

    # Agrupar por categoría
    por_cat = {}
    for t in trades:
        por_cat.setdefault(t["Categoria"], []).append(t)
    resumen_cat = {}
    for cat, ts in por_cat.items():
        resumen_cat[cat] = metrics(ts)

    # Mapear datos de Timeout por Ticker + Fecha_Entrada a la lista principal
    timeout_map = {(t["Ticker"], t["Fecha_Entrada"]): t for t in trades_timeout}
    for t in trades:
        key = (t["Ticker"], t["Fecha_Entrada"])
        if key in timeout_map:
            to_trade = timeout_map[key]
            t["Precio_Salida_Timeout"] = to_trade["Precio_Salida"]
            t["Resultado_Timeout"] = to_trade["Resultado"]
            t["PnL_Timeout_%"] = to_trade["PnL_%"]
            t["PnL_Neto_Timeout_%"] = to_trade["PnL_Neto_%"]

    data = {
        "fecha": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "ventana": f"{test_start.date()} → {end_date.date()}",
        "metodologia": "backtest honesto: entrada al precio de cierre del día de señal, "
                       "señales no repetidas (1 trade por ticker), sin leakage (modelo entrenado "
                       "solo con datos anteriores a la ventana)",
        "umbral": UMBRAL,
        "resumen": m,
        "resumen_timeout": m_timeout,
        "resumen_por_categoria": resumen_cat,
        "calibracion": calibration(trades),
        "trades": trades,
        "trades_timeout": trades_timeout,
    }
    for path in [os.path.join(FLUJO_DATOS, "backtest_45d.json"),
                 os.path.join(PUBLIC, "backtest_45d.json")]:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"✅ Guardado: {path}")



if __name__ == "__main__":
    main()
