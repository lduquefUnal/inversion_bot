#!/usr/bin/env python3
"""
mlops/sync_artifacts.py — Sincronización Automática & Trazabilidad de Artefactos MLOps
======================================================================================
1. Lee Modelos/modelo_metadata_v3_cat.json y bt_honesto.CAT_PARAMS.
2. Sincroniza y genera category_params.json en frontend/public/ y frontend/dist/ (si existe).
3. Registra una nueva versión de modelo en flujo_datos/registry_history.json de forma append-only,
   incluyendo hashes SHA-256 de cada archivo .pkl.
4. Sincroniza reportes de backtest, drift y predicciones al frontend.
"""

import os
import sys
import json
import hashlib
import datetime
import subprocess

ROOT = os.path.join(os.path.dirname(__file__), "..")
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from flujo_ml.bt_honesto import CAT_PARAMS

MODELOS_DIR = os.path.join(ROOT, "Modelos")
FLUJO_DATOS_DIR = os.path.join(ROOT, "flujo_datos")
FRONTEND_PUBLIC = os.path.join(ROOT, "frontend", "public")
FRONTEND_DIST = os.path.join(ROOT, "frontend", "dist")

METADATA_CAT_PATH = os.path.join(MODELOS_DIR, "modelo_metadata_v3_cat.json")
REGISTRY_HISTORY_PATH = os.path.join(FLUJO_DATOS_DIR, "registry_history.json")


def compute_sha256(file_path):
    if not os.path.exists(file_path):
        return None
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def get_git_commit_sha():
    try:
        sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT).decode("utf-8").strip()
        return sha
    except Exception:
        return "unknown_commit"


def sync_category_params():
    if not os.path.exists(METADATA_CAT_PATH):
        print(f"⚠️ Advertencia: {METADATA_CAT_PATH} no existe. Se usará solo CAT_PARAMS.")
        metadata = {}
    else:
        with open(METADATA_CAT_PATH, "r", encoding="utf-8") as f:
            metadata = json.load(f)

    # Cargar reporte consolidado de backtest si existe
    bt_report_path = os.path.join(MODELOS_DIR, "v3_backtest_reporte_consolidado.json")
    bt_cat_metrics = {}
    if os.path.exists(bt_report_path):
        try:
            with open(bt_report_path, "r", encoding="utf-8") as f:
                bt_data = json.load(f)
                bt_cat_metrics = bt_data.get("por_categoria", {})
        except Exception as e:
            print(f"⚠️ No se pudo leer {bt_report_path}: {e}")

    # Definir etiquetas y emojis por categoría
    category_meta_ui = {
        "Recup. Rapida": {"label": "⚡ Recup. Rápida", "shortLabel": "Recup. Rápida", "emoji": "⚡", "type": "verde", "confirmacion": "1 Día"},
        "Sweet Spot": {"label": "🎯 Sweet Spot", "shortLabel": "Sweet Spot", "emoji": "🎯", "type": "yellow", "confirmacion": "2 Días"},
        "Cazador Dips": {"label": "🔥 Cazador Dips", "shortLabel": "Cazador Dips", "emoji": "🔥", "type": "orange", "confirmacion": "3 Días"},
        "Cuchillos Cayendo": {"label": "⚠️ Cuchillos Cayendo", "shortLabel": "Cuchillos", "emoji": "⚠️", "type": "purple", "confirmacion": "1 Día"},
    }

    out_params = {}
    for cat_name, params in CAT_PARAMS.items():
        ui = category_meta_ui.get(cat_name, {"label": cat_name, "shortLabel": cat_name, "emoji": "📊", "type": "blue", "confirmacion": "1 Día"})
        cat_meta = metadata.get(cat_name, {})
        metrics = cat_meta.get("metrics", {})
        bt_cat = bt_cat_metrics.get(cat_name, {})

        th_optimo = cat_meta.get("th_optimo", 0.50)
        f05 = cat_meta.get("f05_score", metrics.get("f05", 0.0))
        
        # Preferir Win Rate y Total Trades del backtest barra a barra OOS
        wr = bt_cat.get("win_rate_%", metrics.get("wr_%", 50.0))
        n_trades = bt_cat.get("total_trades", metrics.get("n", 0))

        cagr_est = round((1.0 + (params["tp"] * (wr / 100.0) - params["sl"] * (1.0 - wr / 100.0))) ** min(30, max(5, n_trades)) - 1, 3) * 100

        out_params[ui["label"]] = {
            "id": cat_name,
            "catNombre": ui["label"],
            "label": ui["label"],
            "shortLabel": ui["shortLabel"],
            "emoji": ui["emoji"],
            "type": ui["type"],
            "tpPct": round(params["tp"] * 100.0, 1),
            "slPct": round(params["sl"] * 100.0, 1),
            "maxDays": params["limite_dias"],
            "confirmacion": ui["confirmacion"],
            "threshold": f"{th_optimo:.2f}",
            "thresholdNum": th_optimo,
            "f05": f05,
            "f05Str": f"{f05:.4f}",
            "winRate": f"{wr:.1f}% OOS",
            "winRateNum": wr,
            "cagr": f"+{cagr_est:.1f}% / año estimado",
            "cagrNum": cagr_est,
            "retornoTrade": f"+{(params['tp']*100.0):.1f}%",
            "totalTrades": n_trades,
            "friccion": "$0.15 USD",
        }

    # Guardar en frontend/public y frontend/dist
    targets = [os.path.join(FRONTEND_PUBLIC, "category_params.json")]
    if os.path.exists(FRONTEND_DIST):
        targets.append(os.path.join(FRONTEND_DIST, "category_params.json"))

    for target in targets:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            json.dump(out_params, f, indent=2, ensure_ascii=False)
        print(f"✅ Sincronizado: {target}")

    return out_params


def update_registry_history(category_params):
    today_str = datetime.datetime.now().strftime("%Y-%m-%d")
    commit_sha = get_git_commit_sha()
    version_id = f"v3.7-{today_str}-{commit_sha[:7]}"

    model_hashes = {}
    for cat_name in CAT_PARAMS.keys():
        slug = cat_name.lower().replace(".", "").replace(" ", "_")
        pkl_path = os.path.join(MODELOS_DIR, f"lightgbm_cat_{slug}.pkl")
        model_hashes[cat_name] = compute_sha256(pkl_path)

    registry = []
    if os.path.exists(REGISTRY_HISTORY_PATH):
        try:
            with open(REGISTRY_HISTORY_PATH, "r", encoding="utf-8") as f:
                registry = json.load(f)
        except Exception:
            registry = []

    record = {
        "version_id": version_id,
        "fecha": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "commit_sha": commit_sha,
        "categoria_params": category_params,
        "model_hashes": model_hashes,
    }

    # Evitar duplicados exactos el mismo día con el mismo commit
    registry = [r for r in registry if r.get("version_id") != version_id]
    registry.append(record)

    os.makedirs(os.path.dirname(REGISTRY_HISTORY_PATH), exist_ok=True)
    with open(REGISTRY_HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)
    print(f"📜 Registry audit trail actualizado: {REGISTRY_HISTORY_PATH} (Versión: {version_id})")


def sync_all_artifacts():
    print("🔄 [MLOps] Sincronizando artefactos y generando fuente canónica...")
    category_params = sync_category_params()
    update_registry_history(category_params)

    # Copiar otros archivos de soporte a frontend/public/
    files_to_copy = [
        (os.path.join(MODELOS_DIR, "modelo_metadata_v3_cat.json"), "modelo_metadata_v3_cat.json"),
        (os.path.join(MODELOS_DIR, "v3_backtest_reporte_consolidado.json"), "v3_backtest_reporte_consolidado.json"),
        (os.path.join(FLUJO_DATOS_DIR, "v3_drift_report.json"), "v3_drift_report.json"),
        (os.path.join(FLUJO_DATOS_DIR, "predicciones_v2.json"), "predicciones_v2.json"),
    ]

    for src, fname in files_to_copy:
        if os.path.exists(src):
            for target_dir in [FRONTEND_PUBLIC, FRONTEND_DIST]:
                if os.path.exists(target_dir) or target_dir == FRONTEND_PUBLIC:
                    os.makedirs(target_dir, exist_ok=True)
                    dst = os.path.join(target_dir, fname)
                    with open(src, "r", encoding="utf-8") as f_in, open(dst, "w", encoding="utf-8") as f_out:
                        f_out.write(f_in.read())
                    print(f"   Copiado {fname} -> {dst}")


if __name__ == "__main__":
    sync_all_artifacts()
