# Informe de EDA Cuantitativo V5 y Estudio de Ablación (Receta Karpathy)

## 1. Multicolinealidad en Features V4 Actuales (Matriz Spearman entre Drawdowns)
| Feature | Drawdown_52W_% | Drawdown_10W_% | Drawdown_5W_% | Abs_Drawdown | Dist_SMA200_% | Dist_SMA50_% |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Drawdown_52W_%** | 1.0 | 0.764 | 0.617 | -1.0 | 0.727 | 0.509 |
| **Drawdown_10W_%** | 0.764 | 1.0 | 0.835 | -0.764 | 0.585 | 0.762 |
| **Drawdown_5W_%** | 0.617 | 0.835 | 1.0 | -0.617 | 0.416 | 0.671 |
| **Abs_Drawdown** | -1.0 | -0.764 | -0.617 | 1.0 | -0.727 | -0.509 |
| **Dist_SMA200_%** | 0.727 | 0.585 | 0.416 | -0.727 | 1.0 | 0.656 |
| **Dist_SMA50_%** | 0.509 | 0.762 | 0.671 | -0.509 | 0.656 | 1.0 |

> [!caution] **Diagnóstico de Redundancia Crítica**
> Las correlaciones entre `Drawdown_52W_%`, `Abs_Drawdown`, `Drawdown_10W_%` y `Drawdown_5W_%` superan **0.85 a 1.00**.
> Mantener 6 variables de drawdown en un modelo de 12 características diluye el poder discriminante y provoca que el modelo confunda cualquier caída catastrófica con una oportunidad de compra masiva.

## 2. Poder Predictivo Univariado vs Target (Ganadores vs Perdedores)
| Característica | Spearman Rho | Cohen's d | Mutual Info | Media Ganadores | Media Perdedores |
|---|:---:|:---:|:---:|:---:|:---:|
| `TP_ATR` | -0.2756 | -0.5352 | 0.0439 | 2.375 | 3.929 |
| `ATR_%` | +0.2305 | -0.0114 | 0.0294 | 6.443 | 462.240 |
| `Drawdown_10W_%` | -0.2040 | -0.4557 | 0.0243 | -20.392 | -14.700 |
| `Abs_Drawdown` | +0.2038 | +0.4805 | 0.0259 | 35.488 | 25.423 |
| `Drawdown_52W_%` | -0.2038 | -0.4805 | 0.0258 | -35.488 | -25.423 |
| `Tendencia_Sana` | -0.1632 | -0.4376 | 0.0145 | 0.217 | 0.416 |
| `Drawdown_5W_%` | -0.1580 | -0.3504 | 0.0108 | -14.297 | -10.914 |
| `Dist_SMA200_%` | -0.1231 | -0.1115 | 0.0163 | -4.094 | 1.003 |
| `Dist_SMA50_%` | -0.1148 | -0.1447 | 0.0088 | -3.739 | -1.279 |
| `RSI_2` | +0.0631 | +0.1536 | 0.0055 | 38.831 | 32.834 |
| `MACD_Hist` | +0.0515 | +0.0060 | 0.0064 | 0.065 | -23.851 |
| `Bear_Power_Delta_3D` | +0.0487 | -0.0089 | 0.0000 | -1.022 | -0.030 |
| `Price_Reversal_Giro` | +0.0482 | +0.1214 | 0.0036 | 0.538 | 0.477 |
| `Reversal_Higher_Low` | +0.0434 | +0.1085 | 0.0047 | 0.431 | 0.378 |
| `CMF_Slope_3D` | +0.0405 | +0.0956 | 0.0000 | -0.007 | -0.015 |
| `CMF_20` | -0.0380 | -0.0990 | 0.0005 | -0.025 | -0.010 |
| `Green_Candle` | +0.0255 | +0.0640 | 0.0059 | 0.418 | 0.387 |
| `RSI_7` | +0.0183 | +0.0448 | 0.0000 | 44.576 | 43.584 |
| `GARCH_Regime` | +0.0159 | +0.0624 | 0.0000 | 0.993 | 0.978 |
| `Bear_Power_ATR` | +0.0102 | -0.0070 | 0.0000 | -1.707 | -0.971 |
| `Bull_Power_ATR` | +0.0075 | -0.0070 | 0.0012 | -0.796 | -0.065 |
| `RS_vs_SPY_5D` | -0.0070 | -0.0037 | 0.0089 | -0.302 | 19.408 |
| `Kalman_Slope` | -0.0068 | -0.0307 | 0.0067 | -0.417 | -0.330 |
| `RVOL_5D` | -0.0055 | -0.0022 | 0.0041 | 1.011 | 1.012 |
| `Vol_Ratio_20_50` | +0.0054 | +0.0216 | 0.0000 | 1.011 | 1.007 |
| `RSI_14` | -0.0042 | -0.0146 | 0.0000 | 45.948 | 46.180 |
| `Lower_Shadow_%` | -0.0037 | -0.0082 | 0.0015 | 0.274 | 0.275 |

## 3. Estudio de Ablación (Comparativa de Configuraciones de Features)
| Configuración | N° Feat | LogLoss | ROC-AUC | PR-AUC | Umbral Óptimo | Win Rate | PnL Promedio / Trade | Trades |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Config_A_Baseline_V4** | 12 | 0.4766 | 0.6553 | 0.2804 | 0.36 | 30.5% | -0.20% | 4229 |
| **Config_B_V5_Nuevas_Features** | 12 | 0.4770 | 0.6515 | 0.2763 | 0.60 | 38.0% | +1.16% | 50 |
| **Config_C_V5_Equilibrada_Maestra** | 12 | 0.4770 | 0.6534 | 0.2782 | 0.66 | 51.9% | +3.78% | 27 |
