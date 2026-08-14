#!/usr/bin/env python3
"""
v3_drift_monitor.py — Registrador Histórico MLOps y Monitor de Drift (Data & Concept)
====================================================================================
Genera y actualiza un archivo JSON ligero (sin duplicar binarios .pkl) que almacena
la evolución cronológica del rendimiento de los modelos y métricas de drift por categoría:

Archivos generados/actualizados:
- flujo_datos/historico_modelos_mlops.json
- frontend/public/historico_modelos_mlops.json
"""

import os
import sys
import json
import math
import datetime
import urllib.request
import urllib.error
import numpy as np
import pandas as pd

ROOT = os.path.join(os.path.dirname(__file__), "..")
MODELOS_DIR = os.path.join(ROOT, "Modelos")
FLUJO_DATOS_DIR = os.path.join(ROOT, "flujo_datos")
FRONTEND_PUBLIC_DIR = os.path.join(ROOT, "frontend", "public")

DATASET_PATH = os.path.join(MODELOS_DIR, "v3_dataset.csv")
METADATA_CAT_PATH = os.path.join(MODELOS_DIR, "modelo_metadata_v3_cat.json")
HISTORICO_JSON_PATH = os.path.join(FLUJO_DATOS_DIR, "historico_modelos_mlops.json")
FRONTEND_HISTORICO_PATH = os.path.join(FRONTEND_PUBLIC_DIR, "historico_modelos_mlops.json")

# Features numéricas clave para monitorear Data Drift vía Population Stability Index (PSI)
DRIFT_FEATURES = [
    "RSI_2", "RSI_14", "ATR_%", "BB_PctB", "BB_Width",
    "CMF_20", "Dist_SMA200_%", "RVOL_5D", "Drawdown_52W_%",
    "RS_Rating", "Consecutive_Down_Days", "ATR_Regime", "RR_Ratio"
]

sys.path.insert(0, os.path.dirname(__file__))
from bt_honesto import CAT_PARAMS

# Parámetros unificados derivados de la fuente única (bt_honesto.CAT_PARAMS)
CAT_BENCHMARKS = {
    cat: {
        "tp": p["tp"],
        "sl": p["sl"],
        "dias": p["limite_dias"],
        "label": cat
    }
    for cat, p in CAT_PARAMS.items()
}


def calculate_psi(reference, actual, num_buckets=10):
    """Calcula el Population Stability Index (PSI) entre la distribución de referencia y la reciente."""
    ref = np.asarray(reference.dropna())
    act = np.asarray(actual.dropna())

    if len(ref) < 30 or len(act) < 10:
        return 0.0, "SIN_DATOS"

    percentiles = np.linspace(0, 100, num_buckets + 1)
    buckets = np.percentile(ref, percentiles)
    buckets[0] -= 1e-5
    buckets[-1] += 1e-5

    ref_counts, _ = np.histogram(ref, bins=buckets)
    act_counts, _ = np.histogram(act, bins=buckets)

    ref_pct = ref_counts / (len(ref) + 1e-9)
    act_pct = act_counts / (len(act) + 1e-9)

    ref_pct = np.where(ref_pct == 0, 1e-4, ref_pct)
    act_pct = np.where(act_pct == 0, 1e-4, act_pct)

    psi_value = np.sum((act_pct - ref_pct) * np.log(act_pct / ref_pct))
    
    if psi_value < 0.10:
        status = "NO_DRIFT"
    elif psi_value < 0.25:
        status = "MODERATE_DRIFT"
    else:
        status = "HIGH_DRIFT"

    return round(float(psi_value), 4), status


def audit_data_drift():
    if not os.path.exists(DATASET_PATH):
        return {"overall_status": "NO_DATASET", "high_drift_count": 0, "features": {}}

    df = pd.read_csv(DATASET_PATH)
    df["Date"] = pd.to_datetime(df["Date"])
    
    max_date = df["Date"].max()
    cutoff_date = max_date - pd.Timedelta(days=90)

    train_ref = df[df["Date"] < cutoff_date]
    recent_actual = df[df["Date"] >= cutoff_date]

    feature_drifts = {}
    high_drift_count = 0

    for col in DRIFT_FEATURES:
        if col in train_ref.columns and col in recent_actual.columns:
            psi, status = calculate_psi(train_ref[col], recent_actual[col])
            feature_drifts[col] = {
                "psi": psi,
                "status": status,
                "ref_mean": round(float(train_ref[col].mean()), 2),
                "act_mean": round(float(recent_actual[col].mean()), 2)
            }
            if status == "HIGH_DRIFT":
                high_drift_count += 1

    overall_status = "HEALTHY" if high_drift_count == 0 else "DRIFT_ALERT"

    return {
        "overall_status": overall_status,
        "high_drift_count": high_drift_count,
        "features": feature_drifts
    }


def calcular_expectancia_y_ea(wr_pct, cat_key):
    cfg = CAT_BENCHMARKS.get(cat_key, {"tp": 0.15, "sl": 0.05, "dias": 7})
    wr = wr_pct / 100.0
    tp = cfg["tp"]
    sl = cfg["sl"]
    
    # Expectancia por trade con fricción de $0.15 USD (aprox 0.15% en capital promedio)
    e_trade = (wr * tp) - ((1.0 - wr) * sl) - 0.0015
    e_trade_pct = round(e_trade * 100.0, 2)
    
    return e_trade_pct


def publical_historial_a_supabase(historial):
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not service_role_key:
        print("ℹ️ Note: SUPABASE_URL no configurado para publicar historial MLOps.")
        return

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    endpoint = f"{supabase_url}/rest/v1/mlops_historial"
    
    row = {
        "fecha": now_iso,
        "payload": historial
    }

    payload_bytes = json.dumps(row, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(endpoint, data=payload_bytes, method="POST")
    req.add_header("apikey", service_role_key)
    req.add_header("Authorization", f"Bearer {service_role_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "resolution=merge-duplicates")

    try:
        with urllib.request.urlopen(req) as resp:
            print(f"✅ Historial MLOps publicado en Supabase (status {resp.getcode()})")
    except Exception as e:
        print(f"ℹ️ Supabase MLOps sync info: {e}")


def main():
    print("📊 [MLOps Registry] Generando historial de rendimiento y auditoría de drift...")
    
    # 1. Cargar Metadata de modelos por categoría
    if not os.path.exists(METADATA_CAT_PATH):
        print(f"❌ Error: {METADATA_CAT_PATH} no existe.")
        return

    meta = json.load(open(METADATA_CAT_PATH, "r", encoding="utf-8"))
    
    # 2. Auditar Data Drift (PSI)
    drift_data = audit_data_drift()

    # 3. Construir entrada del registro para esta ejecución
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    rendimiento_categorias = []

    for cat_key, label_cfg in CAT_BENCHMARKS.items():
        data = meta.get(cat_key, {})
        metrics = data.get("metrics", {})
        wr = metrics.get("wr_%", 45.0)
        n_trades = metrics.get("n", 0)
        f05 = data.get("f05_score", 0.0)
        th = data.get("th_optimo", 0.40)
        
        e_trade = calcular_expectancia_y_ea(wr, cat_key)
        
        status_cat = "HEALTHY"
        if wr < 35.0:
            status_cat = "CONCEPT_DRIFT_CRITICAL"
        elif wr < 40.0:
            status_cat = "DEGRADATION_WARNING"

        rendimiento_categorias.append({
            "categoria_key": cat_key,
            "categoria": label_cfg["label"],
            "win_rate_%": wr,
            "f05_score": f05,
            "th_optimo": th,
            "expectancia_trade_%": f"{e_trade:+.2f}%",
            "trades_oos": n_trades,
            "status_drift": status_cat
        })

    registro_ejecucion = {
        "fecha_ejecucion": now_str,
        "version_pipeline": "V3.7",
        "universo_activos": "Institucional Filtrado (227 Tickers)",
        "rendimiento_por_categoria": rendimiento_categorias,
        "data_drift_psi_summary": {
            "overall_status": drift_data.get("overall_status", "HEALTHY"),
            "high_drift_features_count": drift_data.get("high_drift_count", 0)
        }
    }

    # 4. Cargar historial existente (Append-Only)
    historial = []
    if os.path.exists(HISTORICO_JSON_PATH):
        try:
            historial = json.load(open(HISTORICO_JSON_PATH, "r", encoding="utf-8"))
        except Exception:
            historial = []

    # Filtrar ejecuciones del mismo minuto para evitar duplicados en pruebas consecutivas
    minute_str = now_str[:16]
    historial = [h for h in historial if h.get("fecha_ejecucion", "")[:16] != minute_str]
    historial.insert(0, registro_ejecucion)

    # 5. Guardar JSONs
    with open(HISTORICO_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(historial, f, indent=2, ensure_ascii=False)

    if os.path.exists(FRONTEND_PUBLIC_DIR):
        with open(FRONTEND_HISTORICO_PATH, "w", encoding="utf-8") as f:
            json.dump(historial, f, indent=2, ensure_ascii=False)

    print(f"✅ Historial MLOps guardado en {HISTORICO_JSON_PATH} y {FRONTEND_HISTORICO_PATH} ({len(historial)} registros históricos).")

    # 6. Intentar sincronización opcional a Supabase
    publical_historial_a_supabase(historial)


if __name__ == "__main__":
    main()
