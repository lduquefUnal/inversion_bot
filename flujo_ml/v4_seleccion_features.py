#!/usr/bin/env python3
"""
flujo_ml/v4_seleccion_features.py — Selección de Features por Correlación y SHAP / Gain
========================================================================================
Paso 1: Correlación univariada (Pearson r, Spearman rho) vs Target en entrenamiento (Date < 2026-02-01).
Paso 2: Entrenamiento exploratorio de LightGBM para extraer Feature Importance (Gain).
Paso 3: Selección de las mejores 10-14 características para reducir la dimensionalidad y evitar overfitting.
"""
import os
import sys
import json
import logging
import numpy as np
import pandas as pd
import lightgbm as lgb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, ROOT)
import bt_honesto as bt

MODELOS = os.path.join(ROOT, "Modelos")
DATASET_PATH = os.path.join(MODELOS, "v4_dataset.csv")
RANKING_PATH = os.path.join(MODELOS, "v4_feature_ranking.csv")
SELECTED_PATH = os.path.join(MODELOS, "v4_selected.json")

logging.basicConfig(level=logging.INFO, format="%(asctime)s | [FEATURE SELECTION V4] | %(levelname)s | %(message)s")
log = logging.getLogger("v4_seleccion")

def seleccionar_features():
    if not os.path.exists(DATASET_PATH):
        log.info("Cargando OHLCV para construir v4_dataset.csv...")
        ohlcv = bt.load_ohlcv()
        df = bt.build_dataset(ohlcv)
        df.to_csv(DATASET_PATH, index=False)
    else:
        df = pd.read_csv(DATASET_PATH, parse_dates=["Date"])

    # Filtro estricto de train para selección (sin data leakage del test set OOS)
    train_df = df[df["Date"] < "2026-02-01"].copy()
    log.info(f"Muestras de entrenamiento para selección: {len(train_df)}")

    candidate_cols = [
        "Cat_Sweet_Spot", "Cat_Cazador_Dips", "Cat_Recup_Rapida", "Cat_Cuchillos_Cayendo",
        "RSI_2", "RSI_7", "RSI_14", "ATR_%", "Dist_SMA200_%", "RVOL_5D",
        "Return_5D_%", "Tendencia_Sana", "Drawdown_52W_%",
        "Dist_SMA50_%", "Drawdown_10W_%", "Drawdown_5W_%", "Dist_52W_High_%",
        "MACD_Hist", "RSI2_Trend", "Vol_Ratio_20_50", "Kalman_Slope", "GARCH_Regime",
        "RR_Ratio", "ATR_Risk_Pct", "TP_ATR", "Abs_Drawdown", "RSI2_DD", "RSI2_RSI14",
        "FCF_log", "Beta"
    ]

    # Filtrar solo columnas presentes en train_df
    candidate_cols = [c for c in candidate_cols if c in train_df.columns]

    y = train_df["Target"].values
    weights = train_df["Sample_Weight"].values if "Sample_Weight" in train_df.columns else None

    ranking = []
    for col in candidate_cols:
        series = train_df[col].fillna(0).values
        pearson_r = float(np.corrcoef(series, y)[0, 1]) if np.std(series) > 1e-6 else 0.0
        spearman_rho = float(pd.Series(series).corr(pd.Series(y), method="spearman")) if np.std(series) > 1e-6 else 0.0
        ranking.append({
            "feature": col,
            "pearson": round(pearson_r, 4),
            "abs_pearson": round(abs(pearson_r), 4),
            "spearman": round(spearman_rho, 4),
            "abs_spearman": round(abs(spearman_rho), 4)
        })

    df_rank = pd.DataFrame(ranking)

    # Paso 2: Modelo exploratorio LightGBM para Feature Importance (Gain)
    X = train_df[candidate_cols].fillna(0)
    lgb_dataset = lgb.Dataset(X, label=y, weight=weights)
    params = {
        "objective": "binary",
        "metric": "binary_logloss",
        "boosting_type": "gbdt",
        "n_estimators": 150,
        "learning_rate": 0.05,
        "num_leaves": 31,
        "random_state": 42,
        "verbose": -1,
    }
    model = lgb.train(params, lgb_dataset)
    importances = model.feature_importance(importance_type="gain")
    
    imp_dict = dict(zip(candidate_cols, importances))
    df_rank["importance"] = df_rank["feature"].map(imp_dict).round(2)
    df_rank["norm_importance"] = (df_rank["importance"] / df_rank["importance"].sum()).round(4)

    # Score combinado = Rank(abs_spearman) + Rank(importance)
    df_rank["rank_spearman"] = df_rank["abs_spearman"].rank(ascending=False)
    df_rank["rank_importance"] = df_rank["importance"].rank(ascending=False)
    df_rank["composite_score"] = df_rank["rank_spearman"] + df_rank["rank_importance"]

    df_rank = df_rank.sort_values(by="composite_score", ascending=True).reset_index(drop=True)
    df_rank.to_csv(RANKING_PATH, index=False)
    log.info(f"Ranking guardado en {RANKING_PATH}")

    # Seleccionar Top 12 características (evitando redundancias idénticas)
    selected_features = df_rank["feature"].head(12).tolist()

    # Garantizar que al menos estén presentes las variables tácticas clave V4
    tactical_must = ["Dist_SMA50_%", "Drawdown_10W_%", "Drawdown_5W_%"]
    for t in tactical_must:
        if t in candidate_cols and t not in selected_features:
            selected_features.append(t)

    selected_info = {
        "n_selected": len(selected_features),
        "selected_features": selected_features,
        "top_features_with_scores": df_rank.head(15).to_dict(orient="records")
    }

    with open(SELECTED_PATH, "w", encoding="utf-8") as f:
        json.dump(selected_info, f, indent=2, ensure_ascii=False)

    log.info(f"Seleccionadas {len(selected_features)} features principales: {selected_features}")
    return df_rank, selected_features

if __name__ == "__main__":
    seleccionar_features()
