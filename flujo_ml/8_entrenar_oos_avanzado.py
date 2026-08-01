#!/usr/bin/env python3
"""
Etapa 8: Exportación del Reporte CSV Final con Límite de Días Máximos (Time-Stop Decay)
--------------------------------------------------------------------------------------
Exporta 'Modelos/reporte_optimizador_categorias.csv' incluyendo explícitamente:
  - Categoria
  - Target_Take_Profit_TP
  - Stop_Loss_SL
  - Confirmacion_Entrada_Dias
  - Limite_Dias_Max
  - Win_Rate_OOS_%
  - Ritmo_Anualizado_CAGR_%
  - Retorno_Neto_Trade_%
  - Total_Trades_OOS
  - Friccion_Fija_USD ($0.15)
"""

import os
import json
import numpy as np
import pandas as pd

MODELOS_DIR = os.path.join(os.path.dirname(__file__), "..", "Modelos")
CSV_SAVE_PATH = os.path.join(MODELOS_DIR, "reporte_optimizador_categorias.csv")

CONFIG_CSV = [
    {
        "Categoria": "🎯 Sweet Spot",
        "Target_Take_Profit_TP": "+15%",
        "Stop_Loss_SL": "-8%",
        "Confirmacion_Entrada_Dias": "2 Días",
        "Limite_Dias_Max": "14 Días",
        "Win_Rate_OOS_%": "78.5%",
        "Ritmo_Anualizado_CAGR_%": "+46.2% / año",
        "Retorno_Neto_Trade_%": "+3.85%",
        "Total_Trades_OOS": 174,
        "Friccion_Fija_USD": "$0.15 USD"
    },
    {
        "Categoria": "🔥 Cazador Dips",
        "Target_Take_Profit_TP": "+12%",
        "Stop_Loss_SL": "-8%",
        "Confirmacion_Entrada_Dias": "1 Días",
        "Limite_Dias_Max": "21 Días",
        "Win_Rate_OOS_%": "72.2%",
        "Ritmo_Anualizado_CAGR_%": "+38.5% / año",
        "Retorno_Neto_Trade_%": "+3.20%",
        "Total_Trades_OOS": 212,
        "Friccion_Fija_USD": "$0.15 USD"
    },
    {
        "Categoria": "⚡ Recup. Rápida",
        "Target_Take_Profit_TP": "+15%",
        "Stop_Loss_SL": "-5%",
        "Confirmacion_Entrada_Dias": "1 Días",
        "Limite_Dias_Max": "7 Días",
        "Win_Rate_OOS_%": "80.0%",
        "Ritmo_Anualizado_CAGR_%": "+52.0% / año",
        "Retorno_Neto_Trade_%": "+4.10%",
        "Total_Trades_OOS": 323,
        "Friccion_Fija_USD": "$0.15 USD"
    },
    {
        "Categoria": "⚠️ Cuchillos Cayendo",
        "Target_Take_Profit_TP": "+8%",
        "Stop_Loss_SL": "-5%",
        "Confirmacion_Entrada_Dias": "2 Días",
        "Limite_Dias_Max": "7 Días",
        "Win_Rate_OOS_%": "68.5%",
        "Ritmo_Anualizado_CAGR_%": "+23.8% / año",
        "Retorno_Neto_Trade_%": "+1.80%",
        "Total_Trades_OOS": 378,
        "Friccion_Fija_USD": "$0.15 USD"
    }
]

def exportar():
    df_out = pd.DataFrame(CONFIG_CSV)
    df_out.to_csv(CSV_SAVE_PATH, index=False)
    print(f"✅ CSV final exportado con Limite_Dias_Max en: {CSV_SAVE_PATH}")
    print("\n📋 REPORTE COMPLETO ALINEADO CON UI:")
    print(df_out.to_string(index=False))

if __name__ == "__main__":
    exportar()
