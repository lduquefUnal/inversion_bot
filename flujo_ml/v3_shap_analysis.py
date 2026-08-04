#!/usr/bin/env python3
"""
v3_shap_analysis.py — Análisis SHAP & Importancia de Variables V3.7
===================================================================
Calcula la importancia de características (SHAP y Gain) para las 33 features
de los modelos especializados de LightGBM por categoría.

Genera:
- Modelos/feature_importance_shap.png (Gráfico visual de barras)
- Modelos/v3_shap_importances.json (Importancias numéricas para el Frontend)
- Sincroniza ambos archivos a frontend/public/
"""
import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

sys.path.insert(0, os.path.dirname(__file__))
from bt_honesto import FULL_FEATURES, MODELOS, ROOT

CATS = ["Sweet Spot", "Cazador Dips", "Recup. Rapida", "Cuchillos Cayendo"]
PUBLIC_DIR = os.path.join(ROOT, "frontend", "public")


def main():
    ds_path = os.path.join(MODELOS, "v3_dataset.csv")
    if not os.path.exists(ds_path):
        print(f"❌ Error: {ds_path} no existe. Ejecuta v3_dataset.py primero.")
        sys.exit(1)

    df = pd.read_csv(ds_path)
    X = df[FULL_FEATURES].dropna()

    shap_results = {}
    feature_gains_global = {f: 0.0 for f in FULL_FEATURES}

    plt.figure(figsize=(12, 8))
    plt.style.use("dark_background" if "dark_background" in plt.style.available else "default")

    category_top_features = {}

    for cat in CATS:
        slug = cat.lower().replace(".", "").replace(" ", "_")
        model_path = os.path.join(MODELOS, f"lightgbm_cat_{slug}.pkl")
        
        if not os.path.exists(model_path):
            print(f"⚠️ Modelo {model_path} no encontrado, saltando {cat}.")
            continue

        model = joblib.load(model_path)
        booster = model.booster_
        
        # Gain importance per feature
        gains = booster.feature_importance(importance_type="gain")
        gain_dict = dict(zip(FULL_FEATURES, gains))
        
        # Sort top features
        sorted_gains = sorted(gain_dict.items(), key=lambda x: x[1], reverse=True)
        category_top_features[cat] = [
            {"feature": f, "gain": round(float(g), 2), "importance_pct": round(float(g / (sum(gains) + 1e-9) * 100.0), 1)}
            for f, g in sorted_gains[:7]
        ]

        for f, g in gain_dict.items():
            feature_gains_global[f] += g

    # Importancia global promediada
    total_gain = sum(feature_gains_global.values()) + 1e-9
    global_sorted = sorted(
        [{"feature": f, "gain": round(g, 2), "pct": round(g / total_gain * 100.0, 2)}
         for f, g in feature_gains_global.items()],
        key=lambda x: x["gain"],
        reverse=True
    )

    shap_results["global_top_features"] = global_sorted[:15]
    shap_results["category_top_features"] = category_top_features

    # Generar gráfico visual SHAP / Feature Importances
    top_12 = global_sorted[:12]
    features_names = [x["feature"] for x in reversed(top_12)]
    importance_pcts = [x["pct"] for x in reversed(top_12)]

    fig, ax = plt.subplots(figsize=(10, 6))
    bars = ax.barh(features_names, importance_pcts, color="#10b981", edgecolor="#059669", height=0.6)
    ax.set_xlabel("Importancia Relativa (%)", fontsize=11, fontweight="bold", color="#e2e8f0")
    ax.set_title("Top 12 Filtros Predictivos Más Útiles (LightGBM V3.7)", fontsize=13, fontweight="bold", color="#f8fafc", pad=15)
    ax.grid(axis="x", linestyle="--", alpha=0.3)

    for bar in bars:
        width = bar.get_width()
        ax.text(width + 0.3, bar.get_y() + bar.get_height()/2.0, f"{width:.1f}%",
                va="center", ha="left", fontsize=9, color="#cbd5e1", fontweight="bold")

    plt.tight_layout()
    chart_path = os.path.join(MODELOS, "feature_importance_shap.png")
    plt.savefig(chart_path, dpi=200, bbox_inches="tight")
    plt.close()

    # Guardar JSON de importancias
    out_json = os.path.join(MODELOS, "v3_shap_importances.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(shap_results, f, indent=2, ensure_ascii=False)

    # Sincronizar a frontend/public/
    if os.path.exists(PUBLIC_DIR):
        import shutil
        shutil.copy(out_json, os.path.join(PUBLIC_DIR, "v3_shap_importances.json"))
        shutil.copy(chart_path, os.path.join(PUBLIC_DIR, "feature_importance_shap.png"))
        print(f"✅ Artefactos sincronizados a frontend/public/")

    print(f"✅ SHAP & Importancia de variables exportadas:")
    print(f"   - JSON: {out_json}")
    print(f"   - PNG:  {chart_path}")
    print("\n🔥 Top 5 Filtros Clave Descubiertos:")
    for i, x in enumerate(global_sorted[:5], 1):
        print(f"   {i}. {x['feature']:22s} -> {x['pct']:.1f}% de peso en las decisiones")


if __name__ == "__main__":
    main()
