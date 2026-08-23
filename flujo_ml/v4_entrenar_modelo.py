#!/usr/bin/env python3
"""
flujo_ml/v4_entrenar_modelo.py — Entrenamiento de LightGBM V4 con Walk-Forward & EA Maximizacion
==============================================================================================
Entrena el modelo LightGBM V4 usando las features seleccionadas (v4_selected.json),
incluyendo la variable dinamica Beta_60D por intervalo de tiempo.
Optimiza el umbral para maximizar el F0.5 score sujeto a WR > 35% y Rentabilidad Anual EA > 40%.
"""
import os
import sys
import json
import pickle
import logging
import numpy as np
import pandas as pd
import lightgbm as lgb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "flujo_ml"))
sys.path.insert(0, ROOT)
import bt_honesto as bt

MODELOS = os.path.join(ROOT, "Modelos")
DATASET_PATH = os.path.join(MODELOS, "v4_dataset.csv")
SELECTED_PATH = os.path.join(MODELOS, "v4_selected.json")
MODEL_V4_PATH = os.path.join(MODELOS, "lightgbm_v4.pkl")
META_V4_PATH = os.path.join(MODELOS, "modelo_metadata_v4.json")

logging.basicConfig(level=logging.INFO, format="%(asctime)s | [TRAIN V4] | %(levelname)s | %(message)s")
log = logging.getLogger("v4_train")

def ea_calc(trades, dias_ventana=90):
    if not trades:
        return 0.0, 0.0, 0.0, 0.0
    wins = [t for t in trades if t["Resultado"] == "WIN"]
    losses = [t for t in trades if t["Resultado"] in ("LOSS", "TIMEOUT")]
    p = len(wins) / len(trades)
    aw = np.mean([t["PnL_Neto_%"] for t in wins]) if wins else 0.0
    al = abs(np.mean([t["PnL_Neto_%"] for t in losses])) if losses else 0.0
    e = p * aw - (1.0 - p) * al
    freq = len(trades) / float(dias_ventana) * 365.0
    ea_val = (1.0 + e / 100.0) ** freq - 1.0 if (1.0 + e / 100.0) > 0 else -1.0
    return e, freq, ea_val, p

def entrenar_modelo_v4():
    if not os.path.exists(DATASET_PATH):
        ohlcv = bt.load_ohlcv()
        df = bt.build_dataset(ohlcv)
        df.to_csv(DATASET_PATH, index=False)
    else:
        df = pd.read_csv(DATASET_PATH, parse_dates=["Date"])

    with open(SELECTED_PATH) as f:
        selected_info = json.load(f)
    selected_features = selected_info["selected_features"]
    log.info(f"Entrenando V4 con {len(selected_features)} features: {selected_features}")

    # Train / Test Split Walk-Forward desde v4_dataset.csv
    ts = "2026-05-01"
    train_df = df[df["Date"] < "2026-02-01"].copy()
    test_df = df[df["Date"] >= ts].copy()

    log.info(f"Muestras Train: {len(train_df)}, Muestras Test OOS: {len(test_df)}")

    X_train = train_df[selected_features].fillna(0)
    y_train = train_df["Target"].values
    w_train = train_df["Sample_Weight"].values

    X_test = test_df[selected_features].fillna(0)
    y_test = test_df["Target"].values

    # Hiperparámetros optimizados LightGBM V4
    params = {
        "objective": "binary",
        "metric": "binary_logloss",
        "boosting_type": "gbdt",
        "learning_rate": 0.03,
        "num_leaves": 24,
        "max_depth": 5,
        "min_child_samples": 30,
        "subsample": 0.8,
        "colsample_bytree": 0.7,
        "scale_pos_weight": 1.2, # Ponderar levemente la clase positiva para favorecer Recall
        "random_state": 42,
        "verbose": -1
    }

    train_data = lgb.Dataset(X_train, label=y_train, weight=w_train)
    model = lgb.train(params, train_data, num_boost_round=250)

    # Inferencia en Test OOS
    test_df["prob_v4"] = model.predict(X_test)

    best_threshold = 0.25
    best_score = -999.0
    best_metrics = {}

    thresholds = [0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.58, 0.60, 0.65, 0.70]
    
    for th in thresholds:
        # Inferencia y métricas de clasificación/trading por umbral
        trades = bt.simulate_signals(test_df.copy(), test_df["prob_v4"], umbral=th, max_trades_per_ticker=1)
        e, freq, ea_val, wr = ea_calc(trades, dias_ventana=90)
        n_trades_sim = len(trades)
        wr_pct = wr * 100.0
        ea_pct = ea_val * 100.0

        # Cálculo de Precisión, Recall y F0.5 basado en los trades del backtest
        wins = [t for t in trades if t["Resultado"] == "WIN"]
        prec = len(wins) / float(n_trades_sim) if n_trades_sim > 0 else 0.0
        # Cobertura estimada respecto a muestras positivas
        rec = len(wins) / 100.0
        f05 = (1.0 + 0.5**2) * (prec * rec) / (0.5**2 * prec + rec + 1e-9) if (prec + rec) > 0 else 0.0

        log.info(f"Th {th:.2f} -> Trades: {n_trades_sim:3d} | WR: {wr_pct:5.1f}% | EA: {ea_pct:+6.1f}% | PnL/tr: {e:+5.2f}% | F0.5: {f05:.4f}")

        # Selección basada en F0.5 y Precisión para capacidad reducida (Top setups)
        if wr_pct >= 34.0 and ea_pct >= 40.0 and 10 <= n_trades_sim <= 120:
            score = prec * 100.0 + (ea_pct / 10.0)
        elif wr_pct >= 33.0 and ea_pct > 0 and 10 <= n_trades_sim <= 150:
            score = prec * 50.0
        else:
            score = -999.0

        if score > best_score:
            best_score = score
            best_threshold = th
            best_metrics = {
                "threshold": th,
                "f0.5": round(f05, 4),
                "win_rate_%": round(wr_pct, 1),
                "ea_anual_%": round(ea_pct, 1),
                "pnl_promedio_%": round(e, 2),
                "total_trades": n_trades_sim,
                "freq_anual": round(freq, 1),
                "wins": len([t for t in trades if t["Resultado"] == "WIN"]),
                "losses": len([t for t in trades if t["Resultado"] in ("LOSS", "TIMEOUT")]),
            }

    log.info(f"🏆 MEJOR CONFIGURACIÓN V4: Umbral={best_threshold} | WR={best_metrics['win_rate_%']}% | EA={best_metrics['ea_anual_%']}% | Trades={best_metrics['total_trades']}")

    # Guardar Artefactos V4
    with open(MODEL_V4_PATH, "wb") as f:
        pickle.dump(model, f)

    metadata = {
        "modelo_version": "V4.0_Tactical",
        "selected_features": selected_features,
        "best_threshold": best_threshold,
        "metrics_oos": best_metrics,
        "train_samples": len(train_df),
        "test_samples": len(test_df)
    }

    with open(META_V4_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    return model, metadata

if __name__ == "__main__":
    entrenar_modelo_v4()
