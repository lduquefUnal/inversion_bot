#!/usr/bin/env python3
"""
Etapa 6: Generación del Reporte CSV con Métricas Reales MLOps por Categoría (F0.5-Score)
---------------------------------------------------------------------------------------
Exporta 'Modelos/reporte_optimizador_categorias.csv' calculando las métricas reales del
modelo LightGBM (Precisión, Recall, F0.5-Score, Win Rate %, CAGR % y Total Trades) por categoría.
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.metrics import precision_score, recall_score, fbeta_score

MODELOS_DIR = os.path.join(os.path.dirname(__file__), "..", "Modelos")
DATASET_PATH = os.path.join(MODELOS_DIR, "dataset_entrenamiento.csv")
MODEL_PATH = os.path.join(MODELOS_DIR, "lightgbm_v2.pkl")
METADATA_PATH = os.path.join(MODELOS_DIR, "modelo_metadata.json")
CSV_SAVE_PATH = os.path.join(MODELOS_DIR, "reporte_optimizador_categorias.csv")

CATEGORIAS_CONFIG = {
    "🎯 Sweet Spot":        {"tp": 0.15, "sl": 0.08, "confirmacion": 2, "max_days": 14},
    "🔥 Cazador Dips":      {"tp": 0.12, "sl": 0.08, "confirmacion": 1, "max_days": 21},
    "⚡ Recup. Rápida":     {"tp": 0.15, "sl": 0.05, "confirmacion": 1, "max_days": 7},
    "⚠️ Cuchillos Cayendo": {"tp": 0.05, "sl": 0.05, "confirmacion": 2, "max_days": 7},
}

def generar_csv():
    if not os.path.exists(DATASET_PATH) or not os.path.exists(MODEL_PATH):
        print("❌ Error: Faltan archivos del dataset o modelo.")
        return

    df = pd.read_csv(DATASET_PATH)
    model = joblib.load(MODEL_PATH)

    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)

    features = meta["features"]
    umbral = meta["umbral_optimo"]

    X = df[features]
    probs = model.predict_proba(X)[:, 1]
    df['Prob_V2'] = probs
    df['Pred_V2'] = (probs >= umbral).astype(int)

    filas = []

    for cat_name, params in CATEGORIAS_CONFIG.items():
        cat_key = cat_name.replace("🎯 ", "").replace("🔥 ", "").replace("⚡ ", "").replace("⚠️ ", "")
        if cat_key == "Recup. Rápida":
            cat_key = "Recup. Rapida"

        df_cat = df[df['Categoria'] == cat_key]

        if len(df_cat) > 0:
            y_true = df_cat['Target']
            y_pred = df_cat['Pred_V2']

            prec = precision_score(y_true, y_pred, zero_division=0) * 100.0
            rec = recall_score(y_true, y_pred, zero_division=0) * 100.0
            f05 = fbeta_score(y_true, y_pred, beta=0.5, zero_division=0)

            trades_eval = int(np.sum(y_pred == 1))
            win_rate = prec if trades_eval > 0 else (y_true.mean() * 100.0)

            ret_trade = (win_rate / 100.0 * params['tp']) - ((1 - win_rate / 100.0) * params['sl'])
            cagr = ((1 + ret_trade) ** 12 - 1) * 100.0 if ret_trade > -0.5 else 0.0
        else:
            prec, rec, f05, win_rate, cagr, ret_trade, trades_eval = 0, 0, 0, 0, 0, 0, 0

        filas.append({
            "Categoria": cat_name,
            "Target_TP": f"+{int(params['tp']*100)}%",
            "Stop_Loss_SL": f"-{int(params['sl']*100)}%",
            "Precision_WinRate_%": f"{win_rate:.1f}%",
            "Recall_Cobertura_%": f"{rec:.1f}%",
            "F0.5_Score": round(f05, 3),
            "Ritmo_Anualizado_CAGR_%": f"+{cagr:.1f}% / año",
            "Retorno_Prom_Trade_%": f"+{ret_trade*100:.2f}%",
            "Total_Señales_V2": trades_eval,
            "Total_Muestras_Históricas": len(df_cat)
        })

    df_reporte = pd.DataFrame(filas)
    df_reporte.to_csv(CSV_SAVE_PATH, index=False)
    print(f"✅ CSV MLOps exportado a: {CSV_SAVE_PATH}")
    print("\n📋 REPORT DE MÉTRICAS ML REALES POR CATEGORÍA:")
    print(df_reporte.to_string(index=False))

if __name__ == "__main__":
    generar_csv()
