#!/usr/bin/env python3
"""
flujo_ml/binance_mvp_signales.py — Generador de Señales MVP para Binance
==========================================================================
Modo Paper Trading (sin dinero real). Lee datos de mercado públicos de
Binance, calcula señales usando el modelo LightGBM V4 ya entrenado, y
guarda las señales en flujo_datos/ para revisión humana.

Diseñado para correr en GitHub Actions cada 4 horas (franjas de tiempo).
NO ejecuta órdenes reales. Solo genera señales candidatas.
"""
import os
import sys
import json
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "flujo_ml"))
sys.path.insert(0, ROOT)
import bt_honesto as bt

MODELOS = os.path.join(ROOT, "Modelos")
FLUJO_DATOS = os.path.join(ROOT, "flujo_datos")
MODEL_V4_PATH = os.path.join(MODELOS, "lightgbm_v4.pkl")
META_V4_PATH = os.path.join(MODELOS, "modelo_metadata_v4.json")
SEÑALES_PATH = os.path.join(FLUJO_DATOS, "binance_signales.json")
ESTADO_PATH = os.path.join(FLUJO_DATOS, "binance_estado.json")

logging.basicConfig(level=logging.INFO, format="%(asctime)s | [BINANCE MVP] | %(levelname)s | %(message)s")
log = logging.getLogger("binance_mvp")

# Universo de cripto en Binance (spot, liquido)
TICKERS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT", "XRPUSDT", "DOGEUSDT", "LINKUSDT", "AVAXUSDT"]

# Mapping de categorías del modelo a acciones
CATEGORIA_ACCION = {
    "Sweet Spot": "COMPRAR",
    "Recup. Rapida": "COMPRAR",
    "Cazador Dips": "COMPRAR",
    "Cuchillos Cayendo": "ESPERAR",  # Solo en tendencia bajista confirmada
}

def cargar_modelo_v4():
    import pickle
    with open(MODEL_V4_PATH, "rb") as f:
        model = pickle.load(f)
    with open(META_V4_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)
    return model, meta

def obtener_velas_binance(ticker="BTCUSDT", intervalo="1d", limite=200):
    """
    Obtiene velas (klines) de Binance API pública (sin autenticación).
    Retorna DataFrame con columnas estandarizadas.
    """
    import urllib.request
    url = f"https://api.binance.com/api/v3/klines?symbol={ticker}&interval={intervalo}&limit={limite}"
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        filas = []
        for k in data:
            filas.append({
                "timestamp": pd.to_datetime(k[0], unit="ms"),
                "open": float(k[1]),
                "high": float(k[2]),
                "low": float(k[3]),
                "close": float(k[4]),
                "volume": float(k[5]),
                "ticker": ticker,
            })
        return pd.DataFrame(filas)
    except Exception as e:
        log.warning(f"No se pudieron obtener velas para {ticker}: {e}")
        return pd.DataFrame()

def calcular_features_basicos(df):
    """Calcula las features que el modelo V4 necesita (subconjunto disponible sin datos fundamentales)."""
    df = df.sort_values("timestamp").reset_index(drop=True)

    # bt.atr espera columnas High/Low/Close con mayúsculas
    df_ohlc = df.rename(columns={"high": "High", "low": "Low", "close": "Close"})

    df["RSI_14"] = bt.rsi(df["close"], 14) if hasattr(bt, "rsi") else np.nan
    df["ATR_%"] = bt.atr(df_ohlc, 14) if hasattr(bt, "atr") else np.nan
    df["Dist_SMA200_%"] = (df["close"] - df["close"].rolling(200).mean()) / df["close"].rolling(200).mean() * 100
    df["Dist_SMA50_%"] = (df["close"] - df["close"].rolling(50).mean()) / df["close"].rolling(50).mean() * 100
    df["RVOL_5D"] = df["volume"] / df["volume"].rolling(5).mean()
    df["Return_5D_%"] = df["close"].pct_change(5) * 100
    df["Drawdown_52W_%"] = (df["close"] - df["close"].rolling(252).max()) / df["close"].rolling(252).max() * 100
    df["Drawdown_10W_%"] = (df["close"] - df["close"].rolling(50).max()) / df["close"].rolling(50).max() * 100
    df["Drawdown_5W_%"] = (df["close"] - df["close"].rolling(25).max()) / df["close"].rolling(25).max() * 100
    df["Abs_Drawdown"] = df["Drawdown_5W_%"].abs()
    df["TP_ATR"] = 0.15  # placeholder, alineado con CAT_PARAMS
    atr_serie = df["ATR_%"] if "ATR_%" in df.columns else pd.Series([np.nan]*len(df))
    df["ATR_Risk_Pct"] = atr_serie.abs().fillna(0.0)
    df["Vol_Ratio_20_50"] = df["close"].rolling(20).mean() / df["close"].rolling(50).mean()
    df["GARCH_Regime"] = 1.0  # placeholder simplificado
    df["MACD_Hist"] = 0.0     # placeholder
    df["Beta_60D"] = 1.0      # placeholder
    return df

def generar_senales(modelo, features_seleccionadas, umbral=0.45):
    """Genera señales para todos los tickers del universo."""
    senales = []
    for ticker in TICKERS:
        df = obtener_velas_binance(ticker)
        if df.empty or len(df) < 60:
            log.warning(f"{ticker}: datos insuficientes ({len(df)} velas)")
            continue

        df = calcular_features_basicos(df)
        ultima = df.iloc[-1]

        # Construir vector de features para el modelo
        try:
            X = np.array([[ultima.get(f, 0.0) for f in features_seleccionadas]], dtype=float)
            proba = float(modelo.predict(X)[0])
        except Exception as e:
            log.warning(f"{ticker}: error prediciendo: {e}")
            continue

        precio = float(ultima["close"])
        accion = "ESPERAR"
        categoria = "N/A"
        confianza = "BAJA"

        if proba >= umbral:
            # Asignar categoría heurística basada en drawdown y tendencia
            dd5w = float(ultima.get("Drawdown_5W_%", 0))
            dd10w = float(ultima.get("Drawdown_10W_%", 0))
            dist_sma50 = float(ultima.get("Dist_SMA50_%", 0))

            if dd5w < -10 and dist_sma50 < -5:
                categoria = "Cazador Dips"
                accion = "COMPRAR"
            elif dd10w < -15 and dist_sma50 < -8:
                categoria = "Sweet Spot"
                accion = "COMPRAR"
            elif dd5w < -5 and dist_sma50 > -5:
                categoria = "Recup. Rapida"
                accion = "COMPRAR"
            else:
                categoria = "Cuchillos Cayendo"
                accion = "ESPERAR"

            if proba >= 0.60:
                confianza = "ALTA"
            elif proba >= 0.50:
                confianza = "MEDIA"
            else:
                confianza = "BAJA"

        senales.append({
            "ticker": ticker,
            "precio": round(precio, 4),
            "probabilidad": round(proba, 4),
            "umbral": umbral,
            "accion": accion,
            "categoria": categoria,
            "confianza": confianza,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "dd_5w_%": round(float(ultima.get("Drawdown_5W_%", 0)), 2),
            "dist_sma50_%": round(float(ultima.get("Dist_SMA50_%", 0)), 2),
            "nota": "Paper trading - sin ejecución real. Revisar antes de operar.",
        })

    return senales

def main():
    os.makedirs(FLUJO_DATOS, exist_ok=True)

    modelo, meta = cargar_modelo_v4()
    features = meta.get("selected_features", [])
    umbral = float(meta.get("best_threshold", 0.45))

    log.info(f"Modelo V4 cargado. Features: {len(features)} | Umbral: {umbral}")

    senales = generar_senales(modelo, features, umbral)

    # Guardar señales
    salida = {
        "generado_utc": datetime.now(timezone.utc).isoformat(),
        "modelo_version": meta.get("modelo_version", "V4.0_Tactical"),
        "umbral": umbral,
        "modo": "paper_trading_sin_dinero_real",
        "senales": senales,
    }
    with open(SEÑALES_PATH, "w", encoding="utf-8") as f:
        json.dump(salida, f, indent=2, ensure_ascii=False)

    # Guardar estado para el humano
    compras = [s for s in senales if s["accion"] == "COMPRAR"]
    estado = {
        "generado_utc": salida["generado_utc"],
        "total_ticker": len(senales),
        "senales_compra": len(compras),
        "mejores_oportunidades": sorted(compras, key=lambda x: -x["probabilidad"])[:5],
        "requiere_accion_humana": len(compras) > 0,
        "nota": "Revisar señales y aprobar/rechazar antes de ejecutar en Binance.",
    }
    with open(ESTADO_PATH, "w", encoding="utf-8") as f:
        json.dump(estado, f, indent=2, ensure_ascii=False)

    log.info(f"Señales generadas: {len(senales)} tickers | {len(compras)} oportunidades de compra")
    log.info(f"Archivos: {SEÑALES_PATH}, {ESTADO_PATH}")

if __name__ == "__main__":
    main()
