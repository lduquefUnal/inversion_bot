#!/usr/bin/env python3
"""
Etapa 3: Extracción de Reglas, Desglose de Win Rate por Categoría/Sector y Métricas Financieras
--------------------------------------------------------------------------------------------------
Calcula la tasa de éxito (Win Rate) detallada por Categoría de Activo, desglosada por tipo
de instrumento (Índices, ETFs Sectoriales, Tech, Cripto), y mide los tiempos de ejecución.
"""

import os
import json
import time
import numpy as np
import pandas as pd
import joblib
from sklearn.tree import DecisionTreeClassifier, export_text

MODELOS_DIR = os.path.join(os.path.dirname(__file__), "..", "Modelos")
DATASET_PATH = os.path.join(MODELOS_DIR, "dataset_entrenamiento.csv")
MODEL_PATH = os.path.join(MODELOS_DIR, "lightgbm_v2.pkl")
METADATA_PATH = os.path.join(MODELOS_DIR, "modelo_metadata.json")
REGLAS_SAVE_PATH = os.path.join(MODELOS_DIR, "reglas_extraidas.json")

# Clasificación de Tickers por Sector / Tipo de Activo
SECTORES = {
    "Índices & ETFs Sectoriales": ["SPY", "QQQ", "IWM", "DIA", "VTI", "VOO", "XLK", "XLF", "XLE", "XLV", "XLI", "XLU", "XLP", "XLY", "SMH", "SOXX", "ARKK", "XME", "XOP"],
    "Tecnología & Semiconductores": ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "AMD", "TSLA", "META", "AVGO", "ORCL", "INTC", "QCOM", "ARM", "MU", "TSM", "ASML"],
    "Criptomonedas & Blockchain": ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "AVAX-USD", "LINK-USD", "DOT-USD", "ADA-USD", "XRP-USD"],
    "Oro, Commodities & Bonos": ["GLD", "SLV", "USO", "UNG", "DBA", "HYG", "TIPS", "TLT", "IEF", "GLDM", "SILJ", "COPX", "LIT", "SQM", "URNJ", "URNM"]
}

def evaluar_y_extraer_reglas():
    t_start = time.time()
    if not os.path.exists(MODEL_PATH) or not os.path.exists(DATASET_PATH):
        print("❌ Error: No se encuentran el modelo o el dataset en Modelos/.")
        return

    print("📈 [1/3] Calculando desgloses de Win Rate por Categoría y Sector...")
    df = pd.read_csv(DATASET_PATH)
    model = joblib.load(MODEL_PATH)

    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)

    features = meta["features"]
    umbral = meta["umbral_optimo"]

    X = df[features]
    y = df["Target"]

    probs = model.predict_proba(X)[:, 1]
    df['Probability'] = probs
    df['Signal'] = (probs >= umbral).astype(int)

    trades = df[df['Signal'] == 1].copy()
    num_trades = len(trades)
    win_rate = (trades['Target'] == 1).mean() * 100 if num_trades > 0 else 0.0

    # --- 1. Desglose de Win Rate por Categoría de Activo ---
    win_rate_por_categoria = {}
    for cat, group in trades.groupby("Categoria"):
        cat_trades = len(group)
        cat_win = (group['Target'] == 1).mean() * 100 if cat_trades > 0 else 0.0
        win_rate_por_categoria[cat] = {
            "win_rate_%": round(cat_win, 2),
            "total_operaciones": cat_trades
        }

    # --- 2. Desglose de Win Rate por Sector / Tipo de Instrumento ---
    win_rate_por_sector = {}
    for sector_nombre, tickers in SECTORES.items():
        sector_group = trades[trades['Ticker'].isin(tickers)]
        sec_trades = len(sector_group)
        sec_win = (sector_group['Target'] == 1).mean() * 100 if sec_trades > 0 else 0.0
        win_rate_por_sector[sector_nombre] = {
            "win_rate_%": round(sec_win, 2),
            "total_operaciones": sec_trades
        }

    # --- 3. Métricas Financieras Globales ---
    returns = np.where(trades['Target'] == 1, 0.13, -0.07) if num_trades > 0 else np.array([0])
    mean_return = float(np.mean(returns))
    std_return = float(np.std(returns)) if len(returns) > 1 else 0.01

    sharpe_ratio = float((mean_return / (std_return + 1e-8)) * np.sqrt(24))
    downside = returns[returns < 0]
    sortino_ratio = float((mean_return / (np.std(downside) + 1e-8)) * np.sqrt(24)) if len(downside) > 0 else 99.0

    gross_p = float(returns[returns > 0].sum())
    gross_l = float(abs(returns[returns < 0].sum()))
    profit_factor = float(gross_p / gross_l) if gross_l > 0 else 99.0

    expectancy = float((win_rate/100.0 * 0.13) - ((1 - win_rate/100.0) * 0.07))

    t_eval_duration = round(time.time() - t_start, 2)

    print("\n🎯 RESUMEN DE WIN RATE POR CATEGORÍA:")
    for cat, info in win_rate_por_categoria.items():
        print(f"  • {cat}: {info['win_rate_%']}% ({info['total_operaciones']} ops)")

    print("\n🏛️ RESUMEN DE WIN RATE POR SECTOR / ÍNDICES:")
    for sec, info in win_rate_por_sector.items():
        print(f"  • {sec}: {info['win_rate_%']}% ({info['total_operaciones']} ops)")

    reporte = {
        "tiempo_evaluación_segundos": t_eval_duration,
        "metricas_globales": {
            "win_rate_global_%": round(win_rate, 2),
            "sharpe_ratio": round(sharpe_ratio, 2),
            "sortino_ratio": round(sortino_ratio, 2),
            "profit_factor": round(profit_factor, 2),
            "expectancy_pct_por_trade": round(expectancy * 100, 2),
            "total_operaciones": num_trades
        },
        "win_rate_por_categoría": win_rate_por_categoria,
        "win_rate_por_sector": win_rate_por_sector
    }

    with open(REGLAS_SAVE_PATH, "w", encoding="utf-8") as f:
        json.dump(reporte, f, indent=2, ensure_ascii=False)

    print(f"\n✅ [3/3] Reporte completo guardado en: {REGLAS_SAVE_PATH}")

if __name__ == "__main__":
    evaluar_y_extraer_reglas()
