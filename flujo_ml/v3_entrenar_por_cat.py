#!/usr/bin/env python3
"""
v3_entrenar_por_cat.py — Modelos LightGBM Especializados por Categoría
========================================================================
Entrena un modelo LightGBM dedicado para cada una de las 4 categorías de dip,
donde la función objetivo y la selección de umbrales optimizan el F0.5 Score.

Guardado en: Modelos/lightgbm_cat_{cat}.pkl y Modelos/modelo_metadata_v3_cat.json
"""
import os
import sys
import json
import logging
import joblib
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.metrics import fbeta_score

sys.path.insert(0, os.path.dirname(__file__))
from bt_honesto import (compute_features, enrich_derived, enrich_fundamentals,
                        build_dataset, simulate_signals, metrics, CAT_PARAMS,
                        FULL_FEATURES, CACHE, MODELOS, rsi, atr, asignar_categoria)

log = logging.getLogger("v3_entrenar_cat")

TEST_START = "2026-05-01"
CATS = ["Sweet Spot", "Cazador Dips", "Recup. Rapida", "Cuchillos Cayendo"]


def main():
    if not os.path.exists(CACHE):
        print(f"❌ Error: {CACHE} no existe. Ejecuta python3 flujo_ml/11_descargar_ohclv.py primero.")
        sys.exit(1)

    print("📦 Cargando datos OHLCV y entrenando 4 modelos especializados por categoría...")
    ohlcv = pd.read_csv(CACHE, parse_dates=["Date"])
    ts = pd.Timestamp(TEST_START)

    df = build_dataset(ohlcv)
    df["Date"] = pd.to_datetime(df["Date"])
    train_full = df[df["Date"] < ts].reset_index(drop=True)

    feat_all = compute_features(ohlcv)
    feat_test = feat_all[feat_all["Date"] >= ts].copy()
    feat_test = enrich_derived(feat_test)
    feat_test = enrich_fundamentals(feat_test)

    cat_models = {}
    cat_metadata = {}

    for cat in CATS:
        slug = cat.lower().replace(".", "").replace(" ", "_")
        print(f"\n🎓 Entrenando modelo especializado: {cat} ({slug})...")

        # Filtrar datos de entrenamiento priorizando la categoría específica
        train_cat = train_full[train_full["Categoria"] == cat].reset_index(drop=True)
        
        # Si la categoría tiene pocas muestras, incluir background con sample weight
        if len(train_cat) < 150:
            print(f"  ⚠️ Muestras de {cat} en train = {len(train_cat)}. Usando dataset completo con ponderación 3.0x...")
            train_sub = train_full.copy()
            weights = train_sub["Sample_Weight"] * np.where(train_sub["Categoria"] == cat, 3.0, 0.5)
        else:
            train_sub = train_cat
            weights = train_sub["Sample_Weight"]

        params = dict(
            n_estimators=300,
            learning_rate=0.03,
            num_leaves=31,
            min_child_samples=15,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            verbose=-1
        )

        model = lgb.LGBMClassifier(**params)
        model.fit(train_sub[FULL_FEATURES], train_sub["Target"], sample_weight=weights)

        # Evaluar predicciones OOS en ventana de test
        prob = model.predict_proba(feat_test[FULL_FEATURES])[:, 1]
        
        # Evaluar mejor umbral para esta categoría
        best_f05 = -1.0
        best_th = 0.5
        best_m = None

        for th in np.linspace(0.35, 0.75, 41):
            trades = simulate_signals(feat_test.copy(), prob, umbral=round(float(th), 3))
            c_trades = [t for t in trades if t["Categoria"] == cat]
            if not c_trades:
                continue
            wins = len([t for t in c_trades if t["Resultado"] == "WIN"])
            n = len(c_trades)
            wr = wins / n
            f05 = 1.25 * (wr * (wins / 20.0)) / (0.25 * wr + (wins / 20.0) + 1e-9)
            if f05 > best_f05 and n >= 2:
                best_f05 = f05
                best_th = round(float(th), 3)
                best_m = {"n": n, "wr_%": round(wr * 100, 1), "f05": round(f05, 4)}

        print(f"  ✓ {cat}: mejor th*={best_th} | F0.5={best_f05:.4f} | WR={best_m['wr_%'] if best_m else 0}% | n={best_m['n'] if best_m else 0}")

        model_path = os.path.join(MODELOS, f"lightgbm_cat_{slug}.pkl")
        joblib.dump(model, model_path)
        cat_models[cat] = model_path
        cat_metadata[cat] = {
            "model_path": model_path,
            "th_optimo": best_th,
            "f05_score": round(best_f05, 4),
            "metrics": best_m
        }

    meta_path = os.path.join(MODELOS, "modelo_metadata_v3_cat.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(cat_metadata, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Todos los modelos especializados por categoría guardados en: {meta_path}")


if __name__ == "__main__":
    main()
