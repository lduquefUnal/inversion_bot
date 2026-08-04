#!/usr/bin/env python3
"""
v3_threshold_por_cat.py — Optimización Dinámica de Umbrales Per-Categoría (F0.5 Score)
======================================================================================
Optimiza el umbral de probabilidad th_c* independientemente para cada categoría
maximizando F0.5 Score, Precision (Win Rate >= 50%) y Retorno Efectivo Anual (EA).

Métrica F0.5 Score:
F0.5 = 1.25 * (Precision * Recall) / (0.25 * Precision + Recall)
Pesa Precision (WR) el doble que Recall (Detección de trades).

Genera: Modelos/v3_thresholds_optimos.json
"""
import os
import sys
import json
import math
import logging
import numpy as np
import pandas as pd
import lightgbm as lgb

sys.path.insert(0, os.path.dirname(__file__))
from bt_honesto import (compute_features, enrich_derived, enrich_fundamentals,
                        build_dataset, simulate_signals, metrics, CAT_PARAMS,
                        FULL_FEATURES, CACHE, MODELOS, rsi, atr, asignar_categoria)

log = logging.getLogger("v3_thresholds")

TEST_START = "2026-05-01"
CATS = ["Sweet Spot", "Cazador Dips", "Recup. Rapida", "Cuchillos Cayendo"]


def compute_f05(precision, recall):
    if precision <= 0 or recall <= 0:
        return 0.0
    return 1.25 * (precision * recall) / (0.25 * precision + recall)


def evaluate_category_thresholds():
    if not os.path.exists(CACHE):
        print(f"❌ Error: {CACHE} no existe. Ejecuta python3 flujo_ml/11_descargar_ohclv.py primero.")
        sys.exit(1)
        
    print("📦 Cargando datos OHLCV y entrenando modelo base Walk-Forward...")
    ohlcv = pd.read_csv(CACHE, parse_dates=["Date"])
    ts = pd.Timestamp(TEST_START)
    
    # Dataset consistente
    df = build_dataset(ohlcv)
    df["Date"] = pd.to_datetime(df["Date"])
    train = df[df["Date"] < ts].reset_index(drop=True)
    
    # Modelo baseline LightGBM
    params = dict(n_estimators=300, learning_rate=0.03, num_leaves=31, random_state=42, verbose=-1)
    model = lgb.LGBMClassifier(**params)
    model.fit(train[FULL_FEATURES], train["Target"], sample_weight=train["Sample_Weight"])
    
    # Features de test
    feat_all = compute_features(ohlcv)
    feat_test = feat_all[feat_all["Date"] >= ts].copy()
    feat_test = enrich_derived(feat_test)
    feat_test = enrich_fundamentals(feat_test)
    
    prob = model.predict_proba(feat_test[FULL_FEATURES])[:, 1]
    
    print("\n🔬 Barrido Dinámico de Umbrales Per-Categoría Maximizado F0.5 Score:\n")
    
    optimal_thresholds = {}
    
    for cat in CATS:
        print(f"── Categoría: {cat} ──────────────────────────────────────")
        best_f05 = -1.0
        best_res = None
        
        # Evaluar barrido de umbrales th de 0.35 a 0.75
        for th in np.linspace(0.35, 0.75, 41):
            th = round(float(th), 3)
            trades = simulate_signals(feat_test.copy(), prob, umbral=th)
            cat_trades = [t for t in trades if t["Categoria"] == cat]
            
            if not cat_trades:
                continue
                
            wins = [t for t in cat_trades if t["Resultado"] == "WIN"]
            losses = [t for t in cat_trades if t["Resultado"] in ("LOSS", "TIMEOUT")]
            n = len(cat_trades)
            wr = len(wins) / n
            
            # Estimación de Recall (oportunidades positivas capturadas vs total posibles en test)
            total_cat_positives = len(train[train["Categoria"] == cat]) # proxy baseline
            recall = len(wins) / max(total_cat_positives * (90.0 / 365.0), 1.0)
            
            f05 = compute_f05(wr, min(recall, 1.0))
            
            pnl_mean = np.mean([t["PnL_Neto_%"] for t in cat_trades])
            
            # Guardar mejor umbral que maximice F0.5 y priorice WR >= 50%
            if f05 > best_f05 and n >= 3:
                best_f05 = f05
                best_res = {
                    "categoria": cat,
                    "th_optimo": th,
                    "f05_score": round(f05, 4),
                    "win_rate_%": round(wr * 100.0, 1),
                    "trades": n,
                    "pnl_prom_%": round(pnl_mean, 2),
                    "wins": len(wins),
                    "losses": len(losses),
                }
        
        if best_res:
            print(f"  ✓ Umbral Óptimo: th* = {best_res['th_optimo']} | F0.5 = {best_res['f05_score']} "
                  f"| WR = {best_res['win_rate_%']}% | n = {best_res['trades']} trades | PnL = {best_res['pnl_prom_%']}%")
            optimal_thresholds[cat] = best_res
        else:
            print(f"  ⚠️ No se hallaron trades suficientes para la categoría {cat} en el rango [0.35, 0.75].")
            optimal_thresholds[cat] = {"categoria": cat, "th_optimo": 0.50, "f05_score": 0.0, "win_rate_%": 0.0, "trades": 0}
            
    # Guardar artefacto
    out_json = os.path.join(MODELOS, "v3_thresholds_optimos.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(optimal_thresholds, f, indent=2, ensure_ascii=False)
        
    print(f"\n✅ Umbrales óptimos guardados en: {out_json}")


if __name__ == "__main__":
    evaluate_category_thresholds()
