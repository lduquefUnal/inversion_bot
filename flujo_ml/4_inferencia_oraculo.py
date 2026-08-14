#!/usr/bin/env python3
"""
Etapa 4: Inferencia en Vivo V3.7 (Oráculo MLOps con Modelos Especializados)
---------------------------------------------------------------------------------------
Genera 'flujo_datos/predicciones_v2.json' ordenado descendentemente por 'Probabilidad_Exito_%'.
Consume los modelos especializados V3.7 (lightgbm_cat_*.pkl) y la metadata modelo_metadata_v3_cat.json.
Sincroniza el resultado con 'frontend/public/predicciones_v2.json'.
"""

import os
import re
import sys
import json
import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
from bt_honesto import (compute_features, enrich_derived, enrich_fundamentals,
                        FULL_FEATURES, CAT_PARAMS, CACHE, MODELOS, ROOT,
                        asignar_categoria, parse_fcf)

FLUJO_DATOS_DIR = os.path.join(ROOT, "flujo_datos")
MERCADO_JSON_PATH = os.path.join(FLUJO_DATOS_DIR, "mercado.json")
PREDICCIONES_JSON_PATH = os.path.join(FLUJO_DATOS_DIR, "predicciones_v2.json")
FRONTEND_PUBLIC_PATH = os.path.join(ROOT, "frontend", "public", "predicciones_v2.json")
METADATA_CAT_PATH = os.path.join(MODELOS, "modelo_metadata_v3_cat.json")


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
    if not os.path.exists(METADATA_CAT_PATH) or not os.path.exists(MERCADO_JSON_PATH):
        print("❌ Error: Faltan archivos necesarios (metadata_v3_cat o mercado.json).")
        return

    print("🔮 [1/3] Cargando modelos especializados por categoría V3.7...")
    metadata_cat = json.load(open(METADATA_CAT_PATH, "r", encoding="utf-8"))
    
    cat_models = {}
    cat_thresholds = {}
    for cat in ["Sweet Spot", "Cazador Dips", "Recup. Rapida", "Cuchillos Cayendo"]:
        slug = cat.lower().replace(".", "").replace(" ", "_")
        m_file = os.path.join(MODELOS, f"lightgbm_cat_{slug}.pkl")
        if os.path.exists(m_file):
            cat_models[cat] = joblib.load(m_file)
            cat_thresholds[cat] = metadata_cat[cat]["th_optimo"]
        else:
            print(f"⚠️ Modelo {m_file} no encontrado.")

    mercado_data = json.load(open(MERCADO_JSON_PATH, "r", encoding="utf-8"))
    ohlcv = pd.read_csv(CACHE, parse_dates=["Date"]) if os.path.exists(CACHE) else None

    if ohlcv is None or ohlcv.empty:
        print("❌ Error: ohclv_cache.csv no existe para inferencia.")
        return

    # Trazabilidad de Staleness en días hábiles (Market Business Days)
    ohlcv["Date"] = pd.to_datetime(ohlcv["Date"])
    max_ohlcv_dt = ohlcv["Date"].max()
    max_ohlcv_str = max_ohlcv_dt.strftime("%Y-%m-%d")
    now_dt = pd.Timestamp.now().normalize()

    if max_ohlcv_dt.normalize() >= now_dt:
        staleness_dias = 0
    else:
        # Medir días hábiles entre la última fecha OHLCV y hoy
        b_range = pd.bdate_range(start=max_ohlcv_dt.normalize() + pd.Timedelta(days=1), end=now_dt)
        staleness_dias = len(b_range)

    print(f"📊 [2/3] Calculando features V3 · Último OHLCV: {max_ohlcv_str} · Staleness: {staleness_dias} días hábiles...")
    
    # Mapeo del último precio de cierre absoluto en OHLCV por Ticker (independiente de categorías)
    latest_ohlcv_df = ohlcv.sort_values("Date").groupby("Ticker").last().reset_index()
    price_map_ohlcv = dict(zip(latest_ohlcv_df["Ticker"], latest_ohlcv_df["Close"]))

    feat_all = compute_features(ohlcv)
    feat_all = enrich_derived(feat_all)
    feat_all = enrich_fundamentals(feat_all)

    # Último vector de cada ticker para features
    latest_feats = feat_all.groupby("Ticker").last().reset_index()

    activos = mercado_data.get("TOP_25_DIPS", []) + mercado_data.get("TOP_50_DIPS", [])
    seen_tickers = set()
    unique_activos = []
    for a in activos:
        tk = a.get("Ticker")
        if tk and tk not in seen_tickers:
            seen_tickers.add(tk)
            unique_activos.append(a)

    # Incluir TODOS los tickers del universo OHLCV para garantizar cobertura total de precios en el portafolio
    for tk in latest_feats["Ticker"].unique():
        if tk and tk not in seen_tickers:
            seen_tickers.add(tk)
            unique_activos.append({"Ticker": tk, "Nombre": tk})

    resultados = []

    for a in unique_activos:
        ticker = a.get("Ticker")

        # Buscar fila de features
        row = latest_feats[latest_feats["Ticker"] == ticker]
        if row.empty:
            continue
        r = row.iloc[0]

        # Priorizar el último precio de cierre de OHLCV (fresco) del mapa absoluto
        precio_ohlcv = float(price_map_ohlcv.get(ticker, r.get("Close", 0.0))) if pd.notna(price_map_ohlcv.get(ticker)) else 0.0
        precio_mercado = limpiar_float(a.get("Precio Actual"), 0.0)
        precio_actual = precio_ohlcv if precio_ohlcv > 0 else (precio_mercado if precio_mercado > 0 else 100.0)
        precio_actual = round(precio_actual, 2)

        cat = r["Categoria"] if pd.notna(r["Categoria"]) else "Sweet Spot"
        model = cat_models.get(cat, list(cat_models.values())[0])
        th_optimo = cat_thresholds.get(cat, 0.50)
        params = CAT_PARAMS.get(cat, {"tp": 0.10, "sl": 0.04, "limite_dias": 11})

        feat_vector = pd.DataFrame([r[FULL_FEATURES]])
        prob = float(model.predict_proba(feat_vector)[0, 1])
        prob_pct = round(prob * 100.0, 1)

        position_size_pct = calcular_position_sizing_kelly(prob, benefit_risk_ratio=params["tp"]/params["sl"])
        atr_pct = float(r["ATR_%"])
        atr_valor = precio_actual * (atr_pct / 100.0)
        stop_loss_atr_precio = round(max(0.01, precio_actual * (1.0 - params["sl"])), 2)
        take_profit_precio = round(precio_actual * (1.0 + params["tp"]), 2)

        if prob >= th_optimo:
            veredicto = "BUY"
            emoji = "💎"
        elif prob >= (th_optimo - 0.10):
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
            "Veredicto": veredicto,
            "Emoji": emoji,
            "Position_Sizing_Kelly_%": position_size_pct,
            "Take_Profit_%": params["tp"] * 100.0,
            "Take_Profit_$": take_profit_precio,
            "Stop_Loss_%": params["sl"] * 100.0,
            "Stop_Loss_ATR_$": stop_loss_atr_precio,
            "Limite_Dias": params["limite_dias"],
            "Umbral_Optimo_%": round(th_optimo * 100.0, 1),
            "Drawdown_52W_%": round(float(r["Drawdown_52W_%"]), 1),
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

    print(f"✅ [3/3] Inferencia completada: {len(resultados)} predichos · {payload['total_buys']} señales BUY.")
    print(f"   Último OHLCV: {max_ohlcv_str} | Staleness: {staleness_dias}d hábiles")
    print(f"   Saved to: {PREDICCIONES_JSON_PATH} & {FRONTEND_PUBLIC_PATH}")


if __name__ == "__main__":
    ejecutar_inferencia()
