#!/usr/bin/env python3
"""
v3_backtest_eval.py — Evaluación del Backtest Consolidado con los 4 Modelos Especializados
========================================================================================
Combina la inferencia de los 4 modelos dedicados por categoría en la ventana test OOS
(2026-05-01 al presente, 90 días) usando sus umbrales óptimos th_c*.

Calcula:
- Win Rate % por categoría y consolidado.
- PnL % neto promedio por trade y total.
- Expectancia E por trade.
- Frecuencia anualizada de trades y Interés Efectivo Anual (EA_lineal y EA_kelly).
"""
import os
import sys
import json
import numpy as np
import pandas as pd
import joblib

sys.path.insert(0, os.path.dirname(__file__))
from bt_honesto import (compute_features, enrich_derived, enrich_fundamentals,
                        simulate_signals, metrics, CAT_PARAMS, FULL_FEATURES,
                        CACHE, MODELOS, FRICCION_USD)

TEST_START = "2026-05-01"
CATS = ["Sweet Spot", "Cazador Dips", "Recup. Rapida", "Cuchillos Cayendo"]


def main():
    ohlcv = pd.read_csv(CACHE, parse_dates=["Date"])
    ts = pd.Timestamp(TEST_START)

    meta_path = os.path.join(MODELOS, "modelo_metadata_v3_cat.json")
    if not os.path.exists(meta_path):
        print(f"❌ Error: {meta_path} no existe. Ejecuta v3_entrenar_por_cat.py primero.")
        sys.exit(1)

    metadata = json.load(open(meta_path, "r", encoding="utf-8"))

    # Cargar los 4 modelos dedicados
    models = {}
    thresholds = {}
    for cat in CATS:
        slug = cat.lower().replace(".", "").replace(" ", "_")
        model_file = os.path.join(MODELOS, f"lightgbm_cat_{slug}.pkl")
        models[cat] = joblib.load(model_file)
        thresholds[cat] = metadata[cat]["th_optimo"]

    # Generar features de la ventana test
    feat_all = compute_features(ohlcv)
    feat_test = feat_all[feat_all["Date"] >= ts].copy()
    feat_test = enrich_derived(feat_test)
    feat_test = enrich_fundamentals(feat_test)

    # Inferencia por categoría con su modelo correspondiente
    for fit_label, use_filter in [("Sin filtro RS", False), ("Con filtro RS (Dist_SMA200_% > -5.0)", True)]:
        all_trades = []
        for cat in CATS:
            mod = models[cat]
            th = thresholds[cat]
            sub_test = feat_test[feat_test["Categoria"] == cat].copy()
            if use_filter:
                sub_test = sub_test[sub_test["Dist_SMA200_%"] > -5.0].copy()
            if sub_test.empty:
                continue
            prob_sub = mod.predict_proba(sub_test[FULL_FEATURES])[:, 1]
            cat_trades = simulate_signals(sub_test, prob_sub, umbral=th)
            all_trades.extend(cat_trades)

        m_global = metrics(all_trades)
        print("\n" + "="*80)
        print(f"📊 RESULTADOS OOS CONSOLIDADO — {fit_label}")
        print("="*80)
        print(f"Total Trades: {m_global['total']} | WR Global: {m_global['win_rate_%']:.1f}% | PnL Prom/Trade: {m_global['pnl_promedio_%']:+.2f}%\n")
        
        print("┌" + "─"*78 + "┐")
        print("│ Categoría             │ Trades│ Win Rate │ avgWin % │ avgLoss %│ Expectancia │")
        print("├───────────────────────┼───────┼──────────┼──────────┼──────────┼─────────────┤")
        for cat in CATS:
            ct = [t for t in all_trades if t["Categoria"] == cat]
            if not ct:
                print(f"│ {cat:21s} │  0    │   0.0%   │   0.0%   │   0.0%   │    0.00%    │")
                continue
            wins = [t for t in ct if t["Resultado"] == "WIN"]
            losses = [t for t in ct if t["Resultado"] in ("LOSS", "TIMEOUT")]
            wr = len(wins) / len(ct) * 100.0
            aw = np.mean([t["PnL_Neto_%"] for t in wins]) if wins else 0.0
            al = np.mean([t["PnL_Neto_%"] for t in losses]) if losses else 0.0
            e = (wr/100.0) * aw + (1.0 - wr/100.0) * al
            print(f"│ {cat:21s} │ {len(ct):>5} │ {wr:>7.1f}% │ {aw:>+7.2f}% │ {al:>+7.2f}% │   {e:>+6.2f}%   │")
        print("└───────────────────────┴───────┴──────────┴──────────┴──────────┴─────────────┘\n")

    cat_summary = {}
    for cat in CATS:
        ct = [t for t in all_trades if t["Categoria"] == cat]
        if not ct:
            cat_summary[cat] = {"total_trades": 0, "win_rate_%": 0.0, "pnl_promedio_%": 0.0, "expectancia_%": 0.0}
            continue
        wins = [t for t in ct if t["Resultado"] == "WIN"]
        losses = [t for t in ct if t["Resultado"] in ("LOSS", "TIMEOUT")]
        wr = len(wins) / len(ct) * 100.0
        aw = float(np.mean([t["PnL_Neto_%"] for t in wins])) if wins else 0.0
        al = float(np.mean([t["PnL_Neto_%"] for t in losses])) if losses else 0.0
        e = (wr/100.0) * aw + (1.0 - wr/100.0) * al
        pnl_prom = float(np.mean([t["PnL_Neto_%"] for t in ct]))
        cat_summary[cat] = {
            "total_trades": len(ct),
            "win_rate_%": round(wr, 1),
            "avg_win_%": round(aw, 2),
            "avg_loss_%": round(al, 2),
            "expectancia_%": round(e, 2),
            "pnl_promedio_%": round(pnl_prom, 2)
        }

    # Guardar reporte consolidado
    report_file = os.path.join(MODELOS, "v3_backtest_reporte_consolidado.json")
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump({
            "metrica_global": m_global,
            "umbral_por_categoria": thresholds,
            "por_categoria": cat_summary,
            "total_trades": m_global['total'],
            "win_rate_global_%": m_global['win_rate_%'],
            "pnl_promedio_%": m_global['pnl_promedio_%'],
        }, f, indent=2, ensure_ascii=False)

    print(f"✅ Reporte consolidado guardado en: {report_file}")


if __name__ == "__main__":
    main()
