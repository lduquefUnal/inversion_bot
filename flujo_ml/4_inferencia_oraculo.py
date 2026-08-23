#!/usr/bin/env python3
"""
flujo_ml/4_inferencia_oraculo.py — Inferencia V4 Tactical Oráculo en Vivo
---------------------------------------------------------------------------------------
Genera 'flujo_datos/predicciones_v2.json' y 'frontend/public/predicciones_v2.json'.
Utiliza el modelo LightGBM V4 (lightgbm_v4.pkl) y las 12 características tácticas seleccionadas
(v4_selected.json) con ponderación dinámica de Beta_60D por intervalo de tiempo.
"""

import os
import re
import sys
import json
import pickle
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from bt_honesto import (compute_features, enrich_derived, enrich_fundamentals,
                        CAT_PARAMS, CACHE, MODELOS, ROOT, parse_fcf)

FLUJO_DATOS_DIR = os.path.join(ROOT, "flujo_datos")
MERCADO_JSON_PATH = os.path.join(FLUJO_DATOS_DIR, "mercado.json")
PREDICCIONES_JSON_PATH = os.path.join(FLUJO_DATOS_DIR, "predicciones_v2.json")
FRONTEND_PUBLIC_PATH = os.path.join(ROOT, "frontend", "public", "predicciones_v2.json")
MODEL_V4_PATH = os.path.join(MODELOS, "lightgbm_v4.pkl")
META_V4_PATH = os.path.join(MODELOS, "modelo_metadata_v4.json")
SELECTED_V4_PATH = os.path.join(MODELOS, "v4_selected.json")


def limpiar_float(val, default=0.0):
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    match = re.search(r"[-+]?\d*\.\d+|\d+", str(val))
    if match:
        return float(match.group())
    return default


def calcular_position_sizing_kelly(prob, benefit_risk_ratio=2.0):
    p = prob
    q = 1.0 - p
    b = benefit_risk_ratio
    f_star = p - (q / b)
    half_kelly = max(0.0, f_star / 2.0)
    return round(min(0.25, half_kelly) * 100, 1)


def ejecutar_inferencia():
    if not os.path.exists(MODEL_V4_PATH) or not os.path.exists(SELECTED_V4_PATH):
        print("❌ Error: Faltan archivos del modelo V4 (lightgbm_v4.pkl o v4_selected.json).")
        return

    print("🔮 [1/3] Cargando modelo LightGBM V4 Tactical...")
    with open(MODEL_V4_PATH, "rb") as f:
        model = pickle.load(f)
    
    with open(SELECTED_V4_PATH, "r", encoding="utf-8") as f:
        selected_info = json.load(f)
    selected_features = selected_info["selected_features"]

    th_optimo = 0.22
    if os.path.exists(META_V4_PATH):
        meta = json.load(open(META_V4_PATH, "r", encoding="utf-8"))
        th_optimo = meta.get("best_threshold", 0.22)

    mercado_data = json.load(open(MERCADO_JSON_PATH, "r", encoding="utf-8")) if os.path.exists(MERCADO_JSON_PATH) else {}
    ohlcv = pd.read_csv(CACHE, parse_dates=["Date"]) if os.path.exists(CACHE) else None

    if ohlcv is None or ohlcv.empty:
        print("❌ Error: ohclv_cache.csv no existe para inferencia.")
        return

    # Trazabilidad de Staleness en días hábiles
    ohlcv["Date"] = pd.to_datetime(ohlcv["Date"])
    max_ohlcv_dt = ohlcv["Date"].max()
    max_ohlcv_str = max_ohlcv_dt.strftime("%Y-%m-%d")
    now_dt = pd.Timestamp.now().normalize()

    if max_ohlcv_dt.normalize() >= now_dt:
        staleness_dias = 0
    else:
        b_range = pd.bdate_range(start=max_ohlcv_dt.normalize() + pd.Timedelta(days=1), end=now_dt)
        staleness_dias = len(b_range)

    print(f"📊 [2/3] Calculando features V4 Tactical · Último OHLCV: {max_ohlcv_str} · Staleness: {staleness_dias}d...")
    
    latest_ohlcv_df = ohlcv.sort_values("Date").groupby("Ticker").last().reset_index()
    price_map_ohlcv = dict(zip(latest_ohlcv_df["Ticker"], latest_ohlcv_df["Close"]))

    feat_all = compute_features(ohlcv)
    feat_all = enrich_derived(feat_all)
    feat_all = enrich_fundamentals(feat_all)

    latest_feats = feat_all.groupby("Ticker").last().reset_index()

    activos = mercado_data.get("TOP_25_DIPS", []) + mercado_data.get("TOP_50_DIPS", [])
    seen_tickers = set()
    unique_activos = []
    for a in activos:
        tk = a.get("Ticker")
        if tk and tk not in seen_tickers:
            seen_tickers.add(tk)
            unique_activos.append(a)

    for tk in latest_feats["Ticker"].unique():
        if tk and tk not in seen_tickers:
            seen_tickers.add(tk)
            unique_activos.append({"Ticker": tk, "Nombre": tk})

    resultados = []

    for a in unique_activos:
        ticker = a.get("Ticker")
        row = latest_feats[latest_feats["Ticker"] == ticker]
        if row.empty:
            continue
        r = row.iloc[0]

        precio_ohlcv = float(price_map_ohlcv.get(ticker, r.get("Close", 0.0))) if pd.notna(price_map_ohlcv.get(ticker)) else 0.0
        precio_mercado = limpiar_float(a.get("Precio Actual"), 0.0)
        precio_actual = precio_ohlcv if precio_ohlcv > 0 else (precio_mercado if precio_mercado > 0 else 100.0)
        precio_actual = round(precio_actual, 2)

        cat = r["Categoria"] if pd.notna(r["Categoria"]) else "Sweet Spot"
        params = CAT_PARAMS.get(cat, {"tp": 0.10, "sl": 0.04, "limite_dias": 11})

        atr_pct = float(r["ATR_%"])
        
        # Asignación Dinámica Fina por Volatilidad ATR (sin enteros rígidos)
        tp_mult = 2.4 if cat == "Sweet Spot" else (2.2 if cat == "Recup. Rapida" else 2.0)
        sl_mult = 1.0
        
        tp_pct = round(max(4.0, min(30.0, tp_mult * atr_pct)), 2)
        sl_pct = round(max(2.0, min(15.0, sl_mult * atr_pct)), 2)
        tp_atr = round(tp_pct / max(0.01, atr_pct), 2)

        feat_dict = {col: float(r.get(col, 0.0)) for col in selected_features}
        feat_vector = pd.DataFrame([feat_dict])
        prob = float(model.predict(feat_vector)[0])
        prob_pct = round(prob * 100.0, 1)

        position_size_pct = calcular_position_sizing_kelly(prob, benefit_risk_ratio=(tp_pct / max(0.1, sl_pct)))
        stop_loss_atr_precio = round(max(0.01, precio_actual * (1.0 - (sl_pct / 100.0))), 2)
        take_profit_precio = round(precio_actual * (1.0 + (tp_pct / 100.0)), 2)

        if prob >= th_optimo:
            veredicto = "BUY"
            emoji = "💎"
        elif prob >= (th_optimo - 0.05):
            veredicto = "WATCH"
            emoji = "👀"
        else:
            veredicto = "HOLD"
            emoji = "⏳"

        pe_raw = a.get("Valor Mercado (P/E Ratio)", a.get("P/E Ratio", a.get("PER", "N/A")))
        pe_ratio = pe_raw if pe_raw not in (None, "", "N/A") else "N/A"
        fcf = a.get("FCF", a.get("Free Cash Flow", "N/A"))
        beta = a.get("Beta", a.get("Beta (Volatilidad)", "N/A"))

        resultados.append({
            "Ticker": ticker,
            "Nombre": a.get("Nombre", ticker),
            "Categoria": cat,
            "Precio_Actual": precio_actual,
            "Probabilidad_Exito_%": prob_pct,
            "Veredicto_V2": veredicto,
            "Veredicto": veredicto,
            "Emoji": emoji,
            "Position_Sizing_Kelly_%": position_size_pct,
            "Take_Profit_%": tp_pct,
            "Take_Profit_$": take_profit_precio,
            "Stop_Loss_%": sl_pct,
            "Stop_Loss_ATR_$": stop_loss_atr_precio,
            "TP_ATR": tp_atr,
            "Limite_Dias": params["limite_dias"],
            "Umbral_Optimo_%": round(th_optimo * 100.0, 1),
            "Drawdown_52W_%": round(float(r["Drawdown_52W_%"]), 1),
            "Dist_SMA50_%": round(float(r["Dist_SMA50_%"]), 1),
            "Drawdown_10W_%": round(float(r["Drawdown_10W_%"]), 1),
            "Drawdown_5W_%": round(float(r["Drawdown_5W_%"]), 1),
            "Beta_60D": round(float(r.get("Beta_60D", 1.0)), 2),
            "Kalman_Slope": round(float(r.get("Kalman_Slope", 0.0)), 4),
            "GARCH_Regime": round(float(r.get("GARCH_Regime", 1.0)), 2),
            "RSI_2D": round(float(r["RSI_2"]), 1),
            "RSI_14D": round(float(r["RSI_14"]), 1),
            "ATR_%": round(atr_pct, 2),
            "Dist_SMA200_%": round(float(r["Dist_SMA200_%"]), 1),
            "Tendencia_Sana": int(r["Tendencia_Sana"]),
            "FCF": fcf,
            "PE_Ratio": pe_ratio,
            "Beta": beta,
            "Fecha_Ultimo_OHLCV": max_ohlcv_str,
            "Staleness_Dias": staleness_dias,
        })

    resultados = sorted(resultados, key=lambda x: x["Probabilidad_Exito_%"], reverse=True)

    payload = {
        "modelo_version": "V4.0_Tactical",
        "fecha_inferencia": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "fecha_ultimo_ohlcv": max_ohlcv_str,
        "staleness_dias": staleness_dias,
        "staleness_warning": f"⚠️ Atención: Datos OHLCV congelados hace {staleness_dias} días hábiles." if staleness_dias > 2 else None,
        "total_analizados": len(resultados),
        "total_buys": len([x for x in resultados if x["Veredicto"] == "BUY"]),
        "predicciones": resultados
    }

    with open(PREDICCIONES_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    if os.path.exists(os.path.dirname(FRONTEND_PUBLIC_PATH)):
        with open(FRONTEND_PUBLIC_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"✅ [3/3] Inferencia V4 completada: {len(resultados)} predichos · {payload['total_buys']} señales BUY.")
    print(f"   Saved to: {PREDICCIONES_JSON_PATH}")

if __name__ == "__main__":
    ejecutar_inferencia()
