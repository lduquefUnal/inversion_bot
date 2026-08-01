#!/usr/bin/env python3
"""
Etapa 2: MLOps — Entrenamiento LightGBM Definitivo sobre Universo Expandido (200+ Activos)
-----------------------------------------------------------------------------------------
Entrena sobre el dataset masivo balanceado incorporando Connors RSI(2D), F0.5-Score y Fricción.
"""

import os
import json
import time
import numpy as np
import pandas as pd
import joblib
import lightgbm as lgb
from sklearn.metrics import roc_auc_score, precision_score, recall_score, f1_score, fbeta_score, roc_curve, precision_recall_curve
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

MODELOS_DIR = os.path.join(os.path.dirname(__file__), "..", "Modelos")
DATASET_PATH = os.path.join(MODELOS_DIR, "dataset_entrenamiento.csv")

MODEL_PATH = os.path.join(MODELOS_DIR, "lightgbm_v2.pkl")
METADATA_PATH = os.path.join(MODELOS_DIR, "modelo_metadata.json")
IMG_FEATURE_IMP = os.path.join(MODELOS_DIR, "feature_importance.png")
IMG_ROC_PR = os.path.join(MODELOS_DIR, "curva_roc_pr.png")
IMG_ROLLING = os.path.join(MODELOS_DIR, "rolling_window_performance.png")

FEATURE_COLS = [
    "Cat_Sweet_Spot", "Cat_Cazador_Dips", "Cat_Recup_Rapida", "Cat_Cuchillos_Cayendo",
    "RSI_2", "RSI_14", "ATR_%", "Tendencia_Sana", "Drawdown_52W_%"
]

def entrenar():
    t_start = time.time()
    if not os.path.exists(DATASET_PATH):
        print(f"❌ Error: No existe {DATASET_PATH}.")
        return

    print("🧠 [1/5] Cargando dataset de 200+ activos para optimización estricta F0.5-Score...")
    df = pd.read_csv(DATASET_PATH)

    X = df[FEATURE_COLS]
    y = df["Target"]
    weights = df["Sample_Weight"]

    df['Date'] = pd.to_datetime(df['Date'])
    df = df.sort_values('Date').reset_index(drop=True)

    unique_dates = df['Date'].unique()
    num_splits = 5
    split_size = len(unique_dates) // num_splits

    cv_scores = []
    print("\n🔄 [2/5] Ejecutando Ventanas Deslizantes (Walk-Forward CV)...")

    for i in range(1, num_splits):
        train_dates = unique_dates[: i * split_size]
        test_dates = unique_dates[i * split_size : (i + 1) * split_size]

        train_mask = df['Date'].isin(train_dates)
        test_mask = df['Date'].isin(test_dates)

        X_tr, y_tr, w_tr = df.loc[train_mask, FEATURE_COLS], df.loc[train_mask, "Target"], df.loc[train_mask, "Sample_Weight"]
        X_te, y_te = df.loc[test_mask, FEATURE_COLS], df.loc[test_mask, "Target"]

        if len(y_te) == 0 or y_te.nunique() < 2:
            continue

        clf_cv = lgb.LGBMClassifier(n_estimators=150, learning_rate=0.03, num_leaves=31, random_state=42, verbose=-1)
        clf_cv.fit(X_tr, y_tr, sample_weight=w_tr)

        probs_te = clf_cv.predict_proba(X_te)[:, 1]
        best_f05_cv = fbeta_score(y_te, (probs_te >= 0.65).astype(int), beta=0.5, zero_division=0)
        cv_scores.append(best_f05_cv * 100)

    # Entrenamiento del Modelo Definitivo
    print("\n⚡ [3/5] Entrenando modelo LightGBM definitivo...")
    model = lgb.LGBMClassifier(n_estimators=200, learning_rate=0.03, num_leaves=31, random_state=42, verbose=-1)
    model.fit(X, y, sample_weight=weights)

    probs = model.predict_proba(X)[:, 1]

    best_thresh = 0.65
    best_f05 = 0.0

    for th in np.linspace(0.40, 0.85, 46):
        preds_th = (probs >= th).astype(int)
        f05 = fbeta_score(y, preds_th, beta=0.5, zero_division=0)
        if f05 > best_f05:
            best_f05 = f05
            best_thresh = th

    preds_opt = (probs >= best_thresh).astype(int)
    auc_score = roc_auc_score(y, probs)
    precision_val = precision_score(y, preds_opt, zero_division=0)
    recall_val = recall_score(y, preds_opt, zero_division=0)
    f1_val = f1_score(y, preds_opt, zero_division=0)
    f05_val = fbeta_score(y, preds_opt, beta=0.5, zero_division=0)

    print("\n🎯 [4/5] Resultados MLOps Definitivos (200+ Activos):")
    print(f"  • Umbral Óptimo Seleccionado (F0.5): {best_thresh:.2f}")
    print(f"  • Precisión / Win Rate:               {precision_val * 100:.2f}%")
    print(f"  • Recall / Cobertura:                {recall_val * 100:.2f}%")
    print(f"  • F0.5-Score:                        {f05_val:.3f}")
    print(f"  • ROC-AUC Score:                      {auc_score:.3f}")

    joblib.dump(model, MODEL_PATH)

    metadata = {
        "fecha_entrenamiento": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_activos_universo": 219,
        "criterio_optimizacion": "F0.5-Score (Beta=0.5)",
        "umbral_optimo": round(best_thresh, 2),
        "f05_score": round(f05_val, 3),
        "precision_%": round(precision_val * 100, 2),
        "recall_%": round(recall_val * 100, 2),
        "f1_score": round(f1_val, 3),
        "roc_auc_score": round(auc_score, 3),
        "features": FEATURE_COLS
    }

    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    print("\n🎨 [5/5] Generando gráficos MLOps...")
    importances = model.feature_importances_
    sorted_idx = np.argsort(importances)
    plt.figure(figsize=(9, 6))
    plt.barh(np.array(FEATURE_COLS)[sorted_idx], importances[sorted_idx], color="#3b82f6")
    plt.title("Importancia de Variables (200+ Activos)", fontsize=12, fontweight='bold')
    plt.xlabel("Feature Importance (Split Count)")
    plt.tight_layout()
    plt.savefig(IMG_FEATURE_IMP, dpi=150)
    plt.close()

    fpr, tpr, _ = roc_curve(y, probs)
    prec_c, rec_c, _ = precision_recall_curve(y, probs)

    fig, ax = plt.subplots(1, 2, figsize=(12, 5))
    ax[0].plot(fpr, tpr, color="#10b981", label=f"ROC AUC = {auc_score:.3f}")
    ax[0].plot([0, 1], [0, 1], 'k--', alpha=0.4)
    ax[0].set_title("Curva ROC")
    ax[0].legend(loc="lower right")

    ax[1].plot(rec_c, prec_c, color="#6366f1", label=f"F0.5 Score = {f05_val:.3f}")
    ax[1].set_title("Curva Precision-Recall")
    ax[1].legend(loc="lower left")
    plt.tight_layout()
    plt.savefig(IMG_ROC_PR, dpi=150)
    plt.close()

    plt.figure(figsize=(9, 4.5))
    plt.plot(range(1, len(cv_scores) + 1), cv_scores, marker='o', color='#3b82f6', linewidth=2.5)
    plt.axhline(y=np.mean(cv_scores), color='#ef4444', linestyle='--', label=f'Promedio: {np.mean(cv_scores):.1f}%')
    plt.title("Rendimiento Walk-Forward CV (200+ Activos)", fontsize=11, fontweight='bold')
    plt.tight_layout()
    plt.savefig(IMG_ROLLING, dpi=150)
    plt.close()

    t_duration = round(time.time() - t_start, 2)
    print(f"💾 Entrenamiento masivo completado en {t_duration}s.")

if __name__ == "__main__":
    entrenar()
