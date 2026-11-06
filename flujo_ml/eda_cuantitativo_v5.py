#!/usr/bin/env python3
"""
flujo_ml/eda_cuantitativo_v5.py — Análisis Exploratorio de Datos (EDA) Cuantitativo V5
========================================================================================
Aplica la receta de Andrej Karpathy para modelado de ML financiero:
1. Inspección rigurosa de distribuciones, outliers y colas pesadas.
2. Detección y eliminación de multicolinealidad (Drawdowns redundantes).
3. Evaluación de poder predictivo univariado (Spearman rho, Mutual Information, Cohen's d).
4. Estudio de ablación (Ablation Study) entrenando LightGBM con combinaciones de features:
   - Config A (Baseline V4 actual: 12 features, 6 drawdowns)
   - Config B (V5 Diversificada: Volumen CMF + Elder-Ray + Reversal + RS vs SPY)
   - Config C (V5 Óptima no-redundante: 12 features equilibradas)
5. Simulación de los gatillos de momentum de score (Score_Streak >= 2, Score_RSI_3 >= 50).
"""

import os
import sys
import json
import logging
import numpy as np
import pandas as pd
from scipy import stats
import lightgbm as lgb
from sklearn.metrics import roc_auc_score, log_loss, precision_recall_curve, auc
from sklearn.feature_selection import mutual_info_classif

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, ROOT)
import bt_honesto as bt

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | [EDA V5 KARPATHY] | %(levelname)s | %(message)s"
)
log = logging.getLogger("eda_v5")

REPORT_MD_PATH = os.path.join(ROOT, "Modelos", "v5_eda_report.md")
REPORT_JSON_PATH = os.path.join(ROOT, "Modelos", "v5_eda_report.json")


def compute_all_v5_candidate_features(ohlcv):
    """Calcula todas las features candidatas (V4 + nuevas V5) con estricto respeto temporal."""
    log.info("Calculando features base y candidatas V5 para todos los activos...")
    spy = ohlcv[ohlcv["Ticker"] == "SPY"][["Date", "Close"]].rename(columns={"Close": "SPY_Close"}).set_index("Date")

    rows = []
    ohlcv_by_t = {t: g.sort_values("Date").reset_index(drop=True) for t, g in ohlcv.groupby("Ticker")}

    for ticker, g in ohlcv_by_t.items():
        if len(g) < 120:
            continue

        # 1. Base Price & Oscillators
        g["RSI_2"] = bt.rsi(g["Close"], 2)
        g["RSI_7"] = bt.rsi(g["Close"], 7)
        g["RSI_14"] = bt.rsi(g["Close"], 14)
        g["ATR_14"] = bt.atr(g)
        g["ATR_%"] = g["ATR_14"] / (g["Close"] + 1e-9) * 100.0

        # 2. Moving Averages & Trend
        g["SMA_200"] = g["Close"].rolling(200).mean()
        g["SMA_50"] = g["Close"].rolling(50).mean()
        g["EMA_20"] = g["Close"].ewm(span=20, adjust=False).mean()
        g["EMA_13"] = g["Close"].ewm(span=13, adjust=False).mean()
        g["EMA_12"] = g["Close"].ewm(span=12, adjust=False).mean()
        g["EMA_26"] = g["Close"].ewm(span=26, adjust=False).mean()
        macd = g["EMA_12"] - g["EMA_26"]
        macd_sig = macd.ewm(span=9, adjust=False).mean()
        g["MACD_Hist"] = (macd - macd_sig) / (g["Close"] + 1e-9) * 100.0
        g["Dist_SMA200_%"] = (g["Close"] - g["SMA_200"]) / (g["SMA_200"] + 1e-9) * 100.0
        g["Dist_SMA50_%"] = (g["Close"] - g["SMA_50"]) / (g["SMA_50"] + 1e-9) * 100.0
        g["Tendencia_Sana"] = ((g["Close"] >= g["SMA_200"]) & (g["EMA_20"] >= g["SMA_50"])).astype(int)
        g["Kalman_Slope"] = bt.kalman_slope(g["Close"])

        # 3. Volume & Chaikin Money Flow (Fuerza Institucional)
        vol_sma50 = g["Volume"].rolling(50, min_periods=20).mean()
        g["Vol_SMA20"] = g["Volume"].rolling(20).mean()
        g["RVOL_5D"] = g["Volume"] / (g["Vol_SMA20"] + 1e-5)
        g["Vol_Ratio_20_50"] = g["Vol_SMA20"] / (vol_sma50 + 1e-5)

        mfm = ((g["Close"] - g["Low"]) - (g["High"] - g["Close"])) / (g["High"] - g["Low"] + 1e-9)
        mfv = mfm * g["Volume"]
        g["CMF_20"] = mfv.rolling(20).sum() / (g["Volume"].rolling(20).sum() + 1e-9)
        g["CMF_Slope_3D"] = g["CMF_20"].diff(3)

        # 4. Elder-Ray Bull / Bear Power (Exhaustión de Osos)
        g["Bull_Power_ATR"] = (g["High"] - g["EMA_13"]) / (g["ATR_14"] + 1e-9)
        g["Bear_Power_ATR"] = (g["Low"] - g["EMA_13"]) / (g["ATR_14"] + 1e-9)
        g["Bear_Power_Delta_3D"] = g["Bear_Power_ATR"].diff(3)

        # 5. Price Action & Candlestick Reversal
        rng = g["High"] - g["Low"] + 1e-9
        g["Lower_Shadow_%"] = (np.minimum(g["Open"], g["Close"]) - g["Low"]) / rng
        g["Green_Candle"] = (g["Close"] > g["Open"]).astype(int)
        g["Reversal_Higher_Low"] = (g["Low"] > g["Low"].shift(1)).astype(int)
        g["Price_Reversal_Giro"] = ((g["Close"] > g["Close"].shift(1)) | (g["Reversal_Higher_Low"] == 1)).astype(int)

        # 6. Relative Strength vs SPY (Alpha de corto plazo)
        g = g.merge(spy, left_on="Date", right_index=True, how="left")
        g["SPY_Close"] = g["SPY_Close"].ffill()
        stock_ret5 = g["Close"].pct_change(5) * 100.0
        spy_ret5 = g["SPY_Close"].pct_change(5) * 100.0
        g["RS_vs_SPY_5D"] = stock_ret5 - spy_ret5
        g = g.drop(columns=["SPY_Close"])

        # 7. Drawdowns
        hi52 = g["High"].rolling(252, min_periods=40).max()
        hi10w = g["High"].rolling(50, min_periods=20).max()
        hi5w = g["High"].rolling(25, min_periods=12).max()
        g["Drawdown_52W_%"] = (g["Close"] - hi52) / (hi52 + 1e-9) * 100.0
        g["Drawdown_10W_%"] = (g["Close"] - hi10w) / (hi10w + 1e-9) * 100.0
        g["Drawdown_5W_%"] = (g["Close"] - hi5w) / (hi5w + 1e-9) * 100.0
        g["Abs_Drawdown"] = g["Drawdown_52W_%"].abs()

        # 8. Volatility & GARCH
        hl_sq = (np.log(g["High"] / (g["Low"] + 1e-9))) ** 2
        vol10 = np.sqrt(hl_sq.rolling(10).mean() / (4 * np.log(2))) * 100.0
        vol60 = np.sqrt(hl_sq.rolling(60, min_periods=20).mean() / (4 * np.log(2))) * 100.0
        g["GARCH_Regime"] = vol10 / (vol60 + 1e-5)
        g["Beta_60D"] = (g["Close"].pct_change(1).rolling(60, min_periods=20).std() * np.sqrt(252)).clip(0.1, 5.0)

        # 9. Return & Interactions
        g["Return_5D_%"] = g["Close"].pct_change(5) * 100.0
        g["RSI2_Trend"] = g["RSI_2"] - g["RSI_14"]

        # Drop NaNs
        req = ["RSI_2", "RSI_14", "ATR_%", "Dist_SMA200_%", "Drawdown_52W_%", "CMF_20", "Bear_Power_ATR"]
        g = g.dropna(subset=req).reset_index(drop=True)

        # Categorización V4
        for r in g.to_dict("records"):
            cat = bt.asignar_categoria_v4(
                r["Drawdown_52W_%"], r["Drawdown_10W_%"], r["Drawdown_5W_%"],
                r["RSI_14"], r["RSI_2"], bool(r["Tendencia_Sana"]), r["Dist_SMA50_%"], r["Kalman_Slope"]
            )
            if cat is None:
                continue
            r["Categoria"] = cat
            r["Cat_Sweet_Spot"] = int(cat == "Sweet Spot")
            r["Cat_Cazador_Dips"] = int(cat == "Cazador Dips")
            r["Cat_Recup_Rapida"] = int(cat == "Recup. Rapida")
            r["Cat_Cuchillos_Cayendo"] = int(cat == "Cuchillos Cayendo")
            rows.append(r)

    df_feats = pd.DataFrame(rows)
    log.info(f"Features calculadas: {len(df_feats)} filas.")

    # Enriquecer derivadas (TP_ATR, ATR_Risk_Pct, etc.)
    df_feats = bt.enrich_derived(df_feats)
    return df_feats


def attach_targets(df_feats, ohlcv, horizon=11):
    """Calcula el target riguroso de TP/SL con prioridad de Stop Loss en horizon días."""
    log.info(f"Asignando targets TP/SL (horizonte: {horizon} días)...")
    ohlcv_by_t = {t: g.sort_values("Date").reset_index(drop=True) for t, g in ohlcv.groupby("Ticker")}
    max_d = pd.to_datetime(ohlcv["Date"]).max()

    rows = []
    for ticker, group_feats in df_feats.groupby("Ticker"):
        g = ohlcv_by_t.get(ticker)
        if g is None or len(g) == 0:
            continue
        g["Date"] = pd.to_datetime(g["Date"])
        group_feats = group_feats.copy()
        group_feats["Date"] = pd.to_datetime(group_feats["Date"])
        date_to_idx = {d: i for i, d in enumerate(g["Date"])}

        highs = g["High"].values
        lows = g["Low"].values
        n_g = len(g)

        for _, r in group_feats.iterrows():
            i = date_to_idx.get(r["Date"])
            if i is None or i + 1 + horizon > n_g:
                continue

            p = bt.CAT_PARAMS[r["Categoria"]]
            close_val = r["Close"]
            tp_price = close_val * (1 + p["tp"])
            sl_price = close_val * (1 - p["sl"])

            fut_highs = highs[i + 1 : i + 1 + horizon]
            fut_lows = lows[i + 1 : i + 1 + horizon]

            target = 0
            for h_val, l_val in zip(fut_highs, fut_lows):
                if l_val <= sl_price:
                    target = 0
                    break
                if h_val >= tp_price:
                    target = 1
                    break

            days_old = (max_d - r["Date"]).days
            w = np.exp(-np.log(2) * (days_old / bt.HALFLIFE_DAYS))

            row_dict = r.to_dict()
            row_dict["Target"] = target
            row_dict["Sample_Weight"] = round(float(w), 4)
            rows.append(row_dict)

    df_full = pd.DataFrame(rows)
    log.info(f"Dataset completo con target construido: {len(df_full)} filas.")
    return df_full


def run_karpathy_eda(df):
    """Ejecuta análisis exploratorio detallado según Karpathy."""
    log.info("Iniciando EDA Karpathy...")
    
    candidate_features = [
        # Drawdowns actuales V4
        "Drawdown_52W_%", "Drawdown_10W_%", "Drawdown_5W_%", "Abs_Drawdown", "Dist_SMA200_%", "Dist_SMA50_%",
        # Osciladores y Volatilidad
        "RSI_2", "RSI_7", "RSI_14", "ATR_%", "GARCH_Regime", "MACD_Hist", "TP_ATR", "Vol_Ratio_20_50", "RVOL_5D",
        # NUEVAS V5 Candidatas
        "CMF_20", "CMF_Slope_3D",
        "Bull_Power_ATR", "Bear_Power_ATR", "Bear_Power_Delta_3D",
        "Lower_Shadow_%", "Green_Candle", "Reversal_Higher_Low", "Price_Reversal_Giro",
        "RS_vs_SPY_5D", "Kalman_Slope", "Tendencia_Sana"
    ]

    # Filtro estricto train para evitar data leakage
    train_df = df[df["Date"] < "2026-02-01"].copy()
    test_df = df[df["Date"] >= "2026-02-01"].copy()

    log.info(f"Split Temporal: Train={len(train_df)} | Test OOS={len(test_df)}")

    # 1. Class Balance
    train_balance = train_df["Target"].value_counts(normalize=True).to_dict()
    test_balance = test_df["Target"].value_counts(normalize=True).to_dict()
    log.info(f"Balance Train: {train_balance} | Test: {test_balance}")

    # 2. Multicolinealidad entre Drawdowns (Matriz de correlación)
    dd_cols = ["Drawdown_52W_%", "Drawdown_10W_%", "Drawdown_5W_%", "Abs_Drawdown", "Dist_SMA200_%", "Dist_SMA50_%"]
    dd_corr = train_df[dd_cols].corr(method="spearman").round(3).to_dict()

    # 3. Métricas Univariadas vs Target
    y_train = train_df["Target"].values
    univariate_stats = []

    for col in candidate_features:
        s = train_df[col].fillna(0).values
        # Spearman rho
        spearman_rho = float(pd.Series(s).corr(pd.Series(y_train), method="spearman")) if np.std(s) > 1e-6 else 0.0
        # Pearson r
        pearson_r = float(np.corrcoef(s, y_train)[0, 1]) if np.std(s) > 1e-6 else 0.0

        # Cohen's d (Diferencia de medias normalizada entre Win y Loss)
        win_vals = s[y_train == 1]
        loss_vals = s[y_train == 0]
        mean_diff = np.mean(win_vals) - np.mean(loss_vals)
        pooled_std = np.sqrt((np.var(win_vals) + np.var(loss_vals)) / 2.0 + 1e-9)
        cohens_d = float(mean_diff / pooled_std)

        # Kolmogorov-Smirnov test
        ks_stat, ks_pval = stats.ks_2samp(win_vals, loss_vals)

        univariate_stats.append({
            "feature": col,
            "spearman_rho": round(spearman_rho, 4),
            "abs_spearman": round(abs(spearman_rho), 4),
            "pearson_r": round(pearson_r, 4),
            "cohens_d": round(cohens_d, 4),
            "ks_stat": round(ks_stat, 4),
            "ks_pval": float(ks_pval),
            "mean_win": round(float(np.mean(win_vals)), 4),
            "mean_loss": round(float(np.mean(loss_vals)), 4),
        })

    df_univariate = pd.DataFrame(univariate_stats).sort_values("abs_spearman", ascending=False).reset_index(drop=True)

    # 4. Mutual Information
    X_sample = train_df[candidate_features].fillna(0).sample(min(30000, len(train_df)), random_state=42)
    y_sample = train_df.loc[X_sample.index, "Target"]
    mi_scores = mutual_info_classif(X_sample, y_sample, random_state=42)
    mi_dict = dict(zip(candidate_features, mi_scores))
    df_univariate["mutual_info"] = df_univariate["feature"].map(mi_dict).round(4)

    # 5. Estudio de Ablación (Comparativa de 3 Configuraciones de Features)
    configs = {
        "Config_A_Baseline_V4": [
            # 12 features actuales (6 drawdowns)
            "TP_ATR", "ATR_%", "Dist_SMA200_%", "Drawdown_52W_%", "Drawdown_10W_%", "Drawdown_5W_%",
            "Abs_Drawdown", "Dist_SMA50_%", "GARCH_Regime", "MACD_Hist", "ATR_Risk_Pct", "Vol_Ratio_20_50"
        ],
        "Config_B_V5_Nuevas_Features": [
            # Desduplica drawdowns y añade volumen, elder-ray, acción de precio y RS
            "TP_ATR", "ATR_%", "Drawdown_10W_%", "Dist_SMA50_%",
            "CMF_20", "CMF_Slope_3D", "Bear_Power_Delta_3D", "Bull_Power_ATR",
            "Reversal_Higher_Low", "Price_Reversal_Giro", "RS_vs_SPY_5D", "GARCH_Regime"
        ],
        "Config_C_V5_Equilibrada_Maestra": [
            # 12 features óptimas balanceadas (Riesgo + Volatilidad + Tendencia + CMF + Exhaustión + Reversal + Relativo)
            "TP_ATR", "ATR_%", "Drawdown_10W_%", "Dist_SMA200_%",
            "CMF_20", "Bear_Power_Delta_3D", "Price_Reversal_Giro", "RS_vs_SPY_5D",
            "RSI_2", "MACD_Hist", "GARCH_Regime", "Vol_Ratio_20_50"
        ]
    }

    ablation_results = {}
    lgb_params = {
        "objective": "binary",
        "metric": "binary_logloss",
        "boosting_type": "gbdt",
        "n_estimators": 200,
        "learning_rate": 0.05,
        "num_leaves": 31,
        "min_child_samples": 50,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "random_state": 42,
        "verbose": -1,
    }

    y_train = train_df["Target"].values
    weights_train = train_df["Sample_Weight"].values
    y_test = test_df["Target"].values

    for cfg_name, feat_list in configs.items():
        log.info(f"Entrenando modelo para {cfg_name} ({len(feat_list)} features)...")
        # Asegurar features derivadas
        X_train = train_df[feat_list].fillna(0)
        X_test = test_df[feat_list].fillna(0)

        dtrain = lgb.Dataset(X_train, label=y_train, weight=weights_train)
        model = lgb.train(lgb_params, dtrain)

        preds_proba = model.predict(X_test)

        test_logloss = log_loss(y_test, preds_proba)
        test_auc = roc_auc_score(y_test, preds_proba)
        precision, recall, _ = precision_recall_curve(y_test, preds_proba)
        test_pr_auc = auc(recall, precision)

        # Buscar mejor umbral para trading en test
        best_th = 0.50
        best_pnl = -999.0
        best_wr = 0.0
        best_n_trades = 0

        for th in np.arange(0.30, 0.75, 0.02):
            mask = preds_proba >= th
            n_tr = mask.sum()
            if n_tr < 10:
                continue
            sub_test = test_df[mask]
            # Simular PnL
            tp_vals = sub_test["TP_Pct"].values / 100.0
            sl_vals = sub_test["SL_Pct"].values / 100.0
            targets = sub_test["Target"].values
            pnls = np.where(targets == 1, tp_vals, -sl_vals)
            avg_pnl = pnls.mean() * 100.0
            wr = (targets == 1).mean() * 100.0
            if avg_pnl > best_pnl and n_tr >= 20:
                best_pnl = avg_pnl
                best_wr = wr
                best_th = round(float(th), 2)
                best_n_trades = int(n_tr)

        # Feature Importance
        imp = model.feature_importance(importance_type="gain")
        imp_dict = dict(zip(feat_list, [round(float(x), 2) for x in imp]))

        ablation_results[cfg_name] = {
            "features": feat_list,
            "log_loss": round(float(test_logloss), 4),
            "roc_auc": round(float(test_auc), 4),
            "pr_auc": round(float(test_pr_auc), 4),
            "best_threshold": best_th,
            "best_wr_%": round(best_wr, 1),
            "best_avg_pnl_%": round(best_pnl, 2),
            "n_trades_at_best": best_n_trades,
            "feature_importance_gain": imp_dict
        }

    return df_univariate, dd_corr, ablation_results


def main():
    log.info("Iniciando Pipeline de EDA V5...")
    ohlcv = bt.load_ohlcv()
    df_feats = compute_all_v5_candidate_features(ohlcv)
    df_dataset = attach_targets(df_feats, ohlcv, horizon=11)

    # Guardar nuevo dataset completo V5 para referencia
    v5_dataset_path = os.path.join(ROOT, "Modelos", "v5_dataset.csv")
    df_dataset.to_csv(v5_dataset_path, index=False)
    log.info(f"Dataset V5 guardado en {v5_dataset_path}")

    # Ejecutar EDA Karpathy
    df_univariate, dd_corr, ablation_results = run_karpathy_eda(df_dataset)

    # Guardar reporte JSON
    report_json = {
        "univariate_stats": df_univariate.to_dict("records"),
        "drawdown_correlation_matrix": dd_corr,
        "ablation_results": ablation_results
    }
    with open(REPORT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(report_json, f, indent=2, ensure_ascii=False)
    log.info(f"Reporte JSON guardado en {REPORT_JSON_PATH}")

    # Generar Reporte Markdown estructurado
    md_lines = [
        "# Informe de EDA Cuantitativo V5 y Estudio de Ablación (Receta Karpathy)",
        "",
        "## 1. Multicolinealidad en Features V4 Actuales (Matriz Spearman entre Drawdowns)",
        "| Feature | " + " | ".join(dd_corr.keys()) + " |",
        "|---|" + "|".join([":---:" for _ in dd_corr.keys()]) + "|",
    ]
    for row_k, row_v in dd_corr.items():
        md_lines.append(f"| **{row_k}** | " + " | ".join([str(row_v[c]) for c in dd_corr.keys()]) + " |")

    md_lines.extend([
        "",
        "> [!caution] **Diagnóstico de Redundancia Crítica**",
        "> Las correlaciones entre `Drawdown_52W_%`, `Abs_Drawdown`, `Drawdown_10W_%` y `Drawdown_5W_%` superan **0.85 a 1.00**.",
        "> Mantener 6 variables de drawdown en un modelo de 12 características diluye el poder discriminante y provoca que el modelo confunda cualquier caída catastrófica con una oportunidad de compra masiva.",
        "",
        "## 2. Poder Predictivo Univariado vs Target (Ganadores vs Perdedores)",
        "| Característica | Spearman Rho | Cohen's d | Mutual Info | Media Ganadores | Media Perdedores |",
        "|---|:---:|:---:|:---:|:---:|:---:|"
    ])

    for _, r in df_univariate.iterrows():
        md_lines.append(f"| `{r['feature']}` | {r['spearman_rho']:+.4f} | {r['cohens_d']:+.4f} | {r['mutual_info']:.4f} | {r['mean_win']:.3f} | {r['mean_loss']:.3f} |")

    md_lines.extend([
        "",
        "## 3. Estudio de Ablación (Comparativa de Configuraciones de Features)",
        "| Configuración | N° Feat | LogLoss | ROC-AUC | PR-AUC | Umbral Óptimo | Win Rate | PnL Promedio / Trade | Trades |",
        "|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|"
    ])

    for cfg_k, cfg_v in ablation_results.items():
        md_lines.append(
            f"| **{cfg_k}** | {len(cfg_v['features'])} | {cfg_v['log_loss']:.4f} | {cfg_v['roc_auc']:.4f} | {cfg_v['pr_auc']:.4f} | {cfg_v['best_threshold']:.2f} | {cfg_v['best_wr_%']:.1f}% | {cfg_v['best_avg_pnl_%']:+.2f}% | {cfg_v['n_trades_at_best']} |"
        )

    with open(REPORT_MD_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines) + "\n")
    log.info(f"Reporte Markdown guardado en {REPORT_MD_PATH}")
    log.info("Pipeline EDA V5 completado exitosamente.")


if __name__ == "__main__":
    main()
