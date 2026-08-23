#!/usr/bin/env python3
"""
flujo_ml/v4_auditor_agent.py — Agente Auditor Paralelo de V4 (Cobertura, Calidad & Sanidad de Lógica)
======================================================================================================
Modulo de auditoria automatizada que ejecuta verificaciones por etapa:
- Stage 1: Entorno, cache OHLCV y baseline.
- Stage 2: Cobertura, Calidad (nulos, inf, atipicos) y Lógica de variables de entrenamiento.
- Stage 3: Ranking de seleccion por correlacion + SHAP.
- Stage 4: Evaluacion Walk-Forward del modelo V4 vs V3.7 baseline.
- Stage 5: Integridad del JSON de inferencia en vivo (predicciones_v2.json).
"""
import os
import sys
import json
import logging
import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELOS = os.path.join(ROOT, "Modelos")
CACHE = os.path.join(MODELOS, "ohclv_cache.csv")
DATASET_V4 = os.path.join(MODELOS, "v4_dataset.csv")
RANKING_V4 = os.path.join(MODELOS, "v4_feature_ranking.csv")
SELECTED_V4 = os.path.join(MODELOS, "v4_selected.json")
MODEL_V4 = os.path.join(MODELOS, "lightgbm_v4.pkl")
PRED_JSON = os.path.join(ROOT, "flujo_datos", "predicciones_v2.json")
AUDIT_LOG = os.path.join(ROOT, "flujo_ml", "v4_audit_report.json")

logging.basicConfig(level=logging.INFO, format="%(asctime)s | [AUDITOR V4] | %(levelname)s | %(message)s")
log = logging.getLogger("v4_auditor")

class V4AuditorAgent:
    def __init__(self):
        self.report = {"stages": {}, "overall_passed": True}

    def audit_stage_1(self):
        """Audit baseline environment & OHLCV cache"""
        log.info("Auditing Stage 1: Environment & OHLCV Cache...")
        if not os.path.exists(CACHE):
            res = {"status": "FAIL", "reason": f"Cache {CACHE} missing"}
            self.report["stages"]["stage_1"] = res
            return False
        
        df_cache = pd.read_csv(CACHE)
        n_tickers = df_cache["Ticker"].nunique()
        n_rows = len(df_cache)
        
        passed = n_tickers >= 150 and n_rows >= 50000
        res = {
            "status": "PASS" if passed else "FAIL",
            "tickers_count": n_tickers,
            "total_rows": n_rows,
            "min_date": df_cache["Date"].min(),
            "max_date": df_cache["Date"].max(),
        }
        self.report["stages"]["stage_1"] = res
        log.info(f"Stage 1 Result: {res['status']} ({n_tickers} tickers, {n_rows} rows)")
        return passed

    def audit_stage_2(self, df_v4=None):
        """
        Audit Stage 2: Cobertura, Calidad (nulos, inf, atipicos) y Lógica de Variables
        """
        log.info("Auditing Stage 2: Cobertura, Calidad (nulos/inf/atípicos) & Lógica de Variables...")
        if df_v4 is None:
            if os.path.exists(DATASET_V4):
                df_v4 = pd.read_csv(DATASET_V4)
            else:
                res = {"status": "FAIL", "reason": "Dataset V4 no generado todavía"}
                self.report["stages"]["stage_2"] = res
                return False
        
        target_features = [
            "RSI_2", "RSI_7", "RSI_14", "ATR_%", "Dist_SMA200_%", "Dist_SMA50_%",
            "Drawdown_52W_%", "Drawdown_10W_%", "Drawdown_5W_%", "Dist_52W_High_%",
            "MACD_Hist", "RSI2_Trend", "Vol_Ratio_20_50", "Kalman_Slope", "GARCH_Regime",
            "RR_Ratio", "ATR_Risk_Pct", "TP_ATR", "Abs_Drawdown", "RSI2_DD", "RSI2_RSI14"
        ]

        # 1. Cobertura Check
        n_samples = len(df_v4)
        cat_dist = df_v4["Categoria"].value_counts().to_dict() if "Categoria" in df_v4.columns else {}
        n_tickers = df_v4["Ticker"].nunique() if "Ticker" in df_v4.columns else 0
        
        # 2. Quality: Check NaNs & Infs
        nan_dict = {}
        inf_dict = {}
        zero_std_cols = []
        outlier_warnings = {}
        logic_errors = []

        for col in target_features:
            if col not in df_v4.columns:
                nan_dict[col] = "MISSING_COLUMN"
                continue
            
            series = df_v4[col].dropna()
            nan_count = df_v4[col].isna().sum() + (len(df_v4) - len(series))
            inf_count = np.isinf(df_v4[col]).sum()
            
            if nan_count > 0:
                nan_dict[col] = int(nan_count)
            if inf_count > 0:
                inf_dict[col] = int(inf_count)

            # Check for constant/degenerate features
            std_val = float(series.std()) if len(series) > 0 else 0
            if std_val < 1e-6:
                zero_std_cols.append(col)

            # Outlier / extreme scale checks
            min_val, max_val = float(series.min()), float(series.max())
            if "RSI" in col and "Trend" not in col and (min_val < 0 or max_val > 100):
                outlier_warnings[col] = f"RSI fuera de rango [0,100]: min={min_val}, max={max_val}"
            elif "Drawdown" in col and max_val > 1.0:
                outlier_warnings[col] = f"Drawdown positivo atípico: max={max_val}%"
            elif abs(max_val) > 1e5 or abs(min_val) > 1e5:
                outlier_warnings[col] = f"Escala extrema o atípico desproporcionado: min={min_val}, max={max_val}"

        # 3. Dynamic Logic Sanity Check (Structural relationship check)
        # e.g., Drawdown_5W_% >= Drawdown_10W_% >= Drawdown_52W_% for the same record (since peak is max over window)
        if "Drawdown_5W_%" in df_v4.columns and "Drawdown_52W_%" in df_v4.columns:
            invalid_dd = (df_v4["Drawdown_5W_%"] < df_v4["Drawdown_52W_%"] - 1e-5).sum()
            if invalid_dd > 0:
                logic_errors.append(f"Inconsistencia lógica DD: {invalid_dd} filas donde DD_5W < DD_52W")

        # Logical target check
        if "Target" in df_v4.columns:
            target_mean = float(df_v4["Target"].mean())
            if target_mean < 0.1 or target_mean > 0.8:
                logic_errors.append(f"Balance de Target atípico: {target_mean*100:.1f}% positivos")

        passed = (
            len(nan_dict) == 0 and
            len(inf_dict) == 0 and
            len(zero_std_cols) == 0 and
            len(logic_errors) == 0 and
            n_samples > 10000 and
            len(cat_dist) >= 4
        )

        res = {
            "status": "PASS" if passed else "FAIL",
            "total_samples": n_samples,
            "unique_tickers": n_tickers,
            "category_distribution": cat_dist,
            "nan_counts": nan_dict,
            "inf_counts": inf_dict,
            "degenerate_constant_cols": zero_std_cols,
            "outlier_warnings": outlier_warnings,
            "logic_errors": logic_errors,
        }
        self.report["stages"]["stage_2"] = res
        log.info(f"Stage 2 Quality & Logic Audit Result: {res['status']}")
        log.info(f" -> Muestras: {n_samples}, Tickers: {n_tickers}, Categorias: {cat_dist}")
        if not passed:
            log.warning(f" -> Detalle fallas: NaN={nan_dict}, Inf={inf_dict}, Logic={logic_errors}, Constant={zero_std_cols}")
        return passed

    def audit_stage_3(self):
        """Audit Feature Selection Engine"""
        log.info("Auditing Stage 3: Feature Selection Engine...")
        if not os.path.exists(RANKING_V4) or not os.path.exists(SELECTED_V4):
            res = {"status": "FAIL", "reason": "Ranking or Selected JSON missing"}
            self.report["stages"]["stage_3"] = res
            return False

        with open(SELECTED_V4) as f:
            selected_info = json.load(f)
        
        df_rank = pd.read_csv(RANKING_V4)
        selected_feats = selected_info.get("selected_features", [])
        
        passed = 8 <= len(selected_feats) <= 16 and len(df_rank) >= 20
        res = {
            "status": "PASS" if passed else "FAIL",
            "selected_count": len(selected_feats),
            "selected_features": selected_feats,
            "top_3_spearman": df_rank.sort_values(by="abs_spearman", ascending=False)[["feature", "spearman"]].head(3).to_dict(orient="records"),
            "top_3_importance": df_rank.sort_values(by="importance", ascending=False)[["feature", "importance"]].head(3).to_dict(orient="records") if "importance" in df_rank.columns else []
        }
        self.report["stages"]["stage_3"] = res
        log.info(f"Stage 3 Result: {res['status']} (Selected {len(selected_feats)} features)")
        return passed

    def audit_stage_4(self, metrics_v4=None):
        """Audit LightGBM V4 Model Metrics OOS"""
        log.info("Auditing Stage 4: LightGBM V4 Model & Walk-Forward Metrics...")
        meta_path = os.path.join(MODELOS, "modelo_metadata_v4.json")
        if metrics_v4 is None and os.path.exists(meta_path):
            with open(meta_path) as f:
                metrics_v4 = json.load(f).get("metrics_oos", {})

        if not metrics_v4:
            res = {"status": "FAIL", "reason": "Metrics metadata missing"}
            self.report["stages"]["stage_4"] = res
            return False

        f05 = metrics_v4.get("f0.5", 0)
        wr = metrics_v4.get("win_rate_%", 0)
        trades = metrics_v4.get("total_trades", 0)
        ea = metrics_v4.get("ea_anual_%", 0)

        passed = wr >= 30.0 and trades >= 50 and ea >= 40.0
        res = {
            "status": "PASS" if passed else "FAIL",
            "f0.5_oos": f05,
            "win_rate_%": wr,
            "ea_anual_%": ea,
            "total_trades": trades,
            "full_metrics": metrics_v4
        }
        self.report["stages"]["stage_4"] = res
        log.info(f"Stage 4 Result: {res['status']} (WR={wr:.1f}%, EA={ea:+.1f}%, Trades={trades})")
        return passed

    def audit_stage_5(self):
        """Audit Final Live Inference JSON"""
        log.info("Auditing Stage 5: Inferences JSON (predicciones_v2.json)...")
        if not os.path.exists(PRED_JSON):
            res = {"status": "FAIL", "reason": "predicciones_v2.json missing"}
            self.report["stages"]["stage_5"] = res
            return False

        with open(PRED_JSON) as f:
            data = json.load(f)

        preds = data.get("predicciones", [])
        version = data.get("modelo_version", "unknown")
        
        buyers = [p for p in preds if p.get("Veredicto_V2") == "BUY"]
        
        passed = len(preds) > 50 and len(buyers) > 0
        res = {
            "status": "PASS" if passed else "FAIL",
            "modelo_version": version,
            "total_tickers": len(preds),
            "buy_signals": len(buyers),
            "top_buyers": [b.get("Ticker") for b in sorted(buyers, key=lambda x: x.get("Probabilidad_%", 0), reverse=True)[:5]]
        }
        self.report["stages"]["stage_5"] = res
        log.info(f"Stage 5 Result: {res['status']} ({len(preds)} tickers, {len(buyers)} BUY signals, Version: {version})")
        return passed

    def save_report(self):
        with open(AUDIT_LOG, "w", encoding="utf-8") as f:
            json.dump(self.report, f, indent=2, ensure_ascii=False)
        log.info(f"Audit report written to {AUDIT_LOG}")


if __name__ == "__main__":
    auditor = V4AuditorAgent()
    auditor.audit_stage_1()
    if os.path.exists(DATASET_V4):
        auditor.audit_stage_2()
    auditor.save_report()
