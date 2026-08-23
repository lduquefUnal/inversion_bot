---
name: v4-auditor
description: Audit agent and continuous verification skill for MLOps, features, model evaluation, and inference integrity in InversionBot V4.
---

# V4 Audit Skill & Agent

This skill defines the audit rules and automated checks to validate all stages of the Trading Bot V4 pipeline.

## 📋 Audit Standard Operating Procedure (SOP)

1. **Stage 1 Audit (Environment & Data Baseline)**
   - Verify `Modelos/ohclv_cache.csv` exists and contains at least 500 trading days for >200 tickers.
   - Verify baseline dataset size and feature columns.

2. **Stage 2 Audit (Feature Engineering & Hard Rule Relaxation)**
   - Check tactical features: `Dist_SMA50_%`, `Drawdown_10W_%`, `Drawdown_5W_%`, `MACD_Hist`, `RSI2_Trend`, `Vol_Ratio_20_50`, `Kalman_Slope`, `GARCH_Regime`.
   - Check NaNs: total NaN ratio across candidate features must be <0.5% (managed properly by `dropna`).
   - Category distribution: check that hard rule relaxation allows balanced sample coverage without excluding valid high-probability setups.

3. **Stage 3 Audit (Feature Selection)**
   - Validate Pearson $r$ and Spearman $\rho$ against `Target`.
   - Validate LightGBM Gain / SHAP feature ranking output in `Modelos/v4_feature_ranking.csv`.
   - Confirm selection of 10-14 optimal features in `Modelos/v4_selected.json`.

4. **Stage 4 Audit (Model Training & OOS Performance)**
   - Validate Walk-Forward split ($W2$ train $<2026-02-01$, $W1$ OOS test $\ge 2026-05-01$).
   - Verify metrics: $F_{0.5} \ge 0.44$, OOS Win Rate $\ge 35\%-50\%$, total trade count $\ge 70$.
   - Confirm export of `Modelos/lightgbm_v4.pkl` and `Modelos/modelo_metadata_v4.json`.

5. **Stage 5 Audit (Inference Pipeline & End-to-End)**
   - Execute `4_inferencia_oraculo.py` with V4 model and verify `predicciones_v2.json`.
   - Check output format, probability calibration, and signal generation.
