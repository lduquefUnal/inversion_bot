#!/usr/bin/env python3
"""
Etapa 4: Inferencia en Vivo V2 (Oráculo MLOps + Métricas Cuantitativas & Fundamentales)
---------------------------------------------------------------------------------------
Genera 'flujo_datos/predicciones_v2.json' ordenado descendentemente por 'Probabilidad_Exito_%'.
Incluye:
  - Veredicto V2, Kelly Position Sizing, Stop Loss ATR $, Trailing Stop $.
  - Drawdown 52W %, RSI 2D / 14D, FCF, P/E Ratio, Beta.
"""

import os
import re
import json
import pandas as pd
import numpy as np
import joblib

MODELOS_DIR = os.path.join(os.path.dirname(__file__), "..", "Modelos")
FLUJO_DATOS_DIR = os.path.join(os.path.dirname(__file__), "..", "flujo_datos")
MERCADO_JSON_PATH = os.path.join(FLUJO_DATOS_DIR, "mercado.json")
PREDICCIONES_JSON_PATH = os.path.join(FLUJO_DATOS_DIR, "predicciones_v2.json")
FRONTEND_PUBLIC_PATH = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "predicciones_v2.json")

MODEL_PATH = os.path.join(MODELOS_DIR, "lightgbm_v2.pkl")
METADATA_PATH = os.path.join(MODELOS_DIR, "modelo_metadata.json")

def limpiar_float(val, default=0.0):
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    match = re.search(r"[-+]?\d*\.\d+|\d+", str(val))
    if match:
        return float(match.group())
    return default

def asignar_categoria(drawdown_52w, rsi14, tendencia_sana):
    if drawdown_52w < -35 and rsi14 < 32:
        return "Cazador Dips"
    elif tendencia_sana and drawdown_52w <= -20:
        return "Sweet Spot"
    elif tendencia_sana:
        return "Recup. Rapida"
    else:
        return "Cuchillos Cayendo"

def calcular_position_sizing_kelly(prob, benefit_risk_ratio=1.8):
    p = prob
    q = 1.0 - p
    b = benefit_risk_ratio
    f_star = p - (q / b)
    half_kelly = max(0.0, f_star / 2.0)
    return round(min(0.25, half_kelly) * 100, 1)

def ejecutar_inferencia():
    if not os.path.exists(MODEL_PATH) or not os.path.exists(MERCADO_JSON_PATH):
        print("❌ Error: Faltan archivos necesarios (modelo o mercado.json).")
        return

    print("🔮 [1/3] Cargando modelo Algoritmo V2 (200+ Activos)...")
    model = joblib.load(MODEL_PATH)

    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)

    with open(MERCADO_JSON_PATH, "r", encoding="utf-8") as f:
        mercado_data = json.load(f)

    features = meta["features"]
    umbral = meta["umbral_optimo"]
    win_rate_test = meta.get("precision_%", 80.0)

    activos = mercado_data.get("TOP_25_DIPS", []) + mercado_data.get("TOP_50_DIPS", [])
    if not activos:
        print("⚠️ No hay activos disponibles en mercado.json.")
        return

    # Deduplicar activos por Ticker
    seen_tickers = set()
    unique_activos = []
    for a in activos:
        tk = a.get("Ticker")
        if tk and tk not in seen_tickers:
            seen_tickers.add(tk)
            unique_activos.append(a)

    print(f"📡 [2/3] Calculando Probabilidades, Position Sizing y Métricas para {len(unique_activos)} activos...")
    resultados = []

    for a in unique_activos:
        ticker = a.get("Ticker")
        precio_actual = limpiar_float(a.get("Precio Actual"), 100.0)

        rsi_14 = limpiar_float(a.get("RSI 14D"), 50.0)
        rsi_2 = limpiar_float(a.get("RSI 7D"), rsi_14 * 0.7)
        dist_sma200 = limpiar_float(a.get("Distancia a SMA200"), 0.0)
        dist_sma50 = limpiar_float(a.get("Distancia a SMA50"), 0.0)
        dist_ema20 = limpiar_float(a.get("Distancia a EMA20"), 0.0)
        atr_pct = limpiar_float(a.get("ATR_%"), 2.5)
        dd_52w = limpiar_float(a.get("Drawdown 52W %"), -10.0)

        # Fundamentales & Volatilidad
        fcf = a.get("FCF", a.get("Free Cash Flow", "N/A"))
        pe_ratio = a.get("P/E Ratio", a.get("PER", "N/A"))
        beta = a.get("Beta", a.get("Beta (Volatilidad)", "N/A"))

        tendencia_sana = 1 if (dist_sma200 >= 0 and dist_ema20 >= dist_sma50) else 0
        cat = asignar_categoria(dd_52w, rsi_14, tendencia_sana == 1)

        feat_vector = pd.DataFrame([{
            "Cat_Sweet_Spot": 1 if cat == "Sweet Spot" else 0,
            "Cat_Cazador_Dips": 1 if cat == "Cazador Dips" else 0,
            "Cat_Recup_Rapida": 1 if cat == "Recup. Rapida" else 0,
            "Cat_Cuchillos_Cayendo": 1 if cat == "Cuchillos Cayendo" else 0,
            "RSI_2": rsi_2,
            "RSI_14": rsi_14,
            "ATR_%": atr_pct,
            "Tendencia_Sana": tendencia_sana,
            "Drawdown_52W_%": dd_52w
        }])[features]

        prob = float(model.predict_proba(feat_vector)[0, 1])
        prob_pct = round(prob * 100, 1)

        position_size_pct = calcular_position_sizing_kelly(prob)
        atr_valor = precio_actual * (atr_pct / 100.0)
        stop_loss_atr_precio = round(max(0.01, precio_actual - (2.0 * atr_valor)), 2)
        trailing_stop_precio = round(max(0.01, precio_actual - (1.5 * atr_valor)), 2)

        if prob >= umbral:
            veredicto = "BUY"
            emoji = "💎"
        elif prob >= (umbral - 0.15):
            veredicto = "WATCH"
            emoji = "🟡"
        else:
            veredicto = "HOLD"
            emoji = "🟢"

        res = {
            "Ticker": ticker,
            "Nombre": a.get("Nombre", ticker),
            "Categoria": cat,
            "Precio_Actual": precio_actual,
            "Probabilidad_Exito_%": prob_pct,
            "Umbral_Requerido_%": round(umbral * 100, 1),
            "Veredicto_V2": veredicto,
            "Emoji": emoji,
            "Position_Sizing_Kelly_%": position_size_pct,
            "Stop_Loss_ATR_USD": stop_loss_atr_precio,
            "Trailing_Stop_USD": trailing_stop_precio,
            "WinRate_Modelo_%": win_rate_test,
            "Drawdown_52W_%": dd_52w,
            "RSI_14D": rsi_14,
            "RSI_2D": round(rsi_2, 1),
            "FCF": fcf,
            "PE_Ratio": pe_ratio,
            "Beta": beta
        }
        resultados.append(res)

    # Ordenar descendentemente por Probabilidad_Exito_%
    resultados = sorted(resultados, key=lambda x: x["Probabilidad_Exito_%"], reverse=True)

    payload = {
        "fecha_inferencia": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_activos_evaluados": len(resultados),
        "umbral_corte_%": round(umbral * 100, 1),
        "predicciones": resultados
    }

    with open(PREDICCIONES_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    if os.path.exists(os.path.dirname(FRONTEND_PUBLIC_PATH)):
        with open(FRONTEND_PUBLIC_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"✅ [3/3] Inferencia V2 completada. Ordenada por Probabilidad_Exito_% ({len(resultados)} activos).")

if __name__ == "__main__":
    ejecutar_inferencia()
