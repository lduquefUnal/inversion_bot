#!/usr/bin/env python3
"""
Etapa 5: Optimización Cuantitativa Vectorizada de Parámetros por Categoría
-------------------------------------------------------------------------
Vectorizado con NumPy para evaluar rápidamente el espacio de búsqueda (Grid Search)
de TP, SL y Max Days por categoría.
"""

import os
import json
import itertools
import numpy as np
import pandas as pd

MODELOS_DIR = os.path.join(os.path.dirname(__file__), "..", "Modelos")
DATASET_PATH = os.path.join(MODELOS_DIR, "dataset_entrenamiento.csv")
PARAMS_OPTIMOS_PATH = os.path.join(MODELOS_DIR, "parametros_optimizados_categoria.json")

PARAM_GRID = {
    "tp": [0.05, 0.08, 0.10, 0.12, 0.15, 0.18, 0.20],
    "sl": [0.04, 0.05, 0.06, 0.08, 0.10],
    "max_days": [5, 7, 10, 14, 21]
}

CATEGORIAS = ["Sweet Spot", "Cazador Dips", "Recup. Rapida", "Cuchillos Cayendo"]

def optimizar_parametros():
    if not os.path.exists(DATASET_PATH):
        print(f"❌ Error: No se encuentra {DATASET_PATH}.")
        return

    print("🔎 [1/3] Cargando dataset histórico (Grid Search Vectorizado)...")
    df = pd.read_csv(DATASET_PATH)

    resultados_optimos = {}

    for cat in CATEGORIAS:
        df_cat = df[df['Categoria'] == cat].copy().reset_index(drop=True)
        if len(df_cat) < 50:
            continue

        print(f"\n⚡ Optimizando parámetros para: [{cat}] ({len(df_cat)} muestras)...")

        ret_5d = df_cat['Return_5D_%'].to_numpy() / 100.0
        ret_10d = df_cat['Return_10D_%'].to_numpy() / 100.0

        max_ret = np.maximum(ret_5d, ret_10d)
        min_ret = np.minimum(ret_5d, ret_10d)

        best_score = -999.0
        best_combination = None
        best_win_rate = 0.0
        best_trades = 0

        for tp, sl, max_days in itertools.product(PARAM_GRID["tp"], PARAM_GRID["sl"], PARAM_GRID["max_days"]):
            # Máscara vectorizada rápida
            is_sl = min_ret <= -sl
            is_tp = (max_ret >= tp) & (~is_sl)

            num_wins = np.sum(is_tp)
            num_total = len(df_cat)
            win_rate = (num_wins / num_total) * 100.0 if num_total > 0 else 0.0

            returns = np.where(is_tp, tp, np.where(is_sl, -sl, 0.0))
            mean_ret = np.mean(returns)
            std_ret = np.std(returns) if len(returns) > 1 else 0.01

            sharpe = (mean_ret / (std_ret + 1e-8)) * np.sqrt(24)

            if win_rate >= 10.0 and sharpe > best_score:
                best_score = float(sharpe)
                best_combination = {"tp": tp, "sl": sl, "max_days": max_days}
                best_win_rate = round(win_rate, 2)
                best_trades = int(num_wins)

        if best_combination:
            resultados_optimos[cat] = {
                "tp": best_combination["tp"],
                "sl": best_combination["sl"],
                "max_days": best_combination["max_days"],
                "tp_pct": f"+{best_combination['tp']*100:.0f}%",
                "sl_pct": f"-{best_combination['sl']*100:.0f}%",
                "win_rate_esperado_%": best_win_rate,
                "sharpe_ratio_estimado": round(best_score, 2),
                "total_éxitos_simulados": best_trades
            }
            print(f"  🏆 Mejor Configuración para {cat}: TP +{best_combination['tp']*100:.0f}% | SL -{best_combination['sl']*100:.0f}% | {best_combination['max_days']}d (WinRate: {best_win_rate}% | Sharpe: {best_score:.2f})")

    with open(PARAMS_OPTIMOS_PATH, "w", encoding="utf-8") as f:
        json.dump(resultados_optimos, f, indent=2, ensure_ascii=False)

    print(f"\n✅ [3/3] Parámetros óptimos guardados en: {PARAMS_OPTIMOS_PATH}")

if __name__ == "__main__":
    optimizar_parametros()
