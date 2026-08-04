---
name: mlops-inversion-bot
description: Flujo MLOps completo para InversionBot. Usar cuando el usuario quiere entrenar, evaluar, optimizar o desplegar el modelo LightGBM de señales de inversión (dip screening), ajustar CAT_PARAMS (TP/SL/días por categoría), analizar resultados de backtesting honesto OOS, hacer fine-tuning con Optuna, revisar FULL_FEATURES (21 variables), o refactorizar el pipeline hacia la arquitectura MLOps de 4 fases (src/, pipelines/, Hydra, MLflow, DVC). También activar cuando el usuario mencione bt_honesto, v3_finetune, walk-forward, EA%, grid de parámetros, o quiere agregar variables para fine-tuning.
---

# Skill: MLOps Pipeline — InversionBot V3.6

El sistema hace **screening de dips** con LightGBM para generar señales de compra por categoría. La métrica a maximizar es el **Interés Efectivo Anual (EA%) por categoría**, no el win rate aislado. Capital rotativo fijo ~$100–150/trade (estilo SmartDCA).

**Meta operativa:** WR > 35% + EA% > 40% por ventana OOS. (WR > 50% + EA > 40% simultáneo es matemáticamente inviable en validación honesta — ver §5.)

---

## 1. Arquitectura Objetivo (Refactoring Incremental — 4 Fases)

La arquitectura se migra de forma incremental, sin romper el sistema de producción:

```
Fase 1 → Separar bt_honesto.py en módulos (src/features, src/backtesting, src/evaluation)
Fase 2 → Crear pipelines/ donde cada script orqueste una etapa (ingesta, train, optim, infer)
Fase 3 → Incorporar Hydra (configs/) + MLflow (mlruns/) para versionado reproducible
Fase 4 → Añadir DVC (dvc.yaml) + GitHub Actions para automatización end-to-end
```

**Estructura objetivo:**
```
InversionBot/
├── data/          raw/ · external/ · interim/ · processed/ · features/
├── models/        production/ · experiments/ · registry/ · calibration/
├── notebooks/
├── configs/       train.yaml · inference.yaml · backtest.yaml · categories.yaml
├── src/           ingestion/ · features/ · training/ · inference/
│                  backtesting/ · evaluation/ · optimization/ · utils/ · visualization/
├── pipelines/
├── tests/
├── frontend/
├── mlruns/
├── dvc.yaml
└── pyproject.toml
```

---

## 2. Fuentes de Verdad Actuales

| Archivo | Rol |
|---|---|
| `flujo_ml/bt_honesto.py` | **SSOT**: `compute_features`, `build_dataset`, `simulate_signals`, `metrics`, `calibration`, `CAT_PARAMS`, `FULL_FEATURES`, `CACHE` |
| `flujo_ml/4_inferencia_oraculo.py` | Inferencia en vivo → `flujo_datos/predicciones_v2.json` + `frontend/public/` |
| `flujo_ml/13_iterar_noche.py` | Sesión nocturna: Optuna + walk-forward + recalibración |
| `flujo_ml/v3_finetune.py` | Fine-tuning con validación doble OOS (W2→selección, W1→confirmación) |
| `flujo_ml/v3_objetivo.py` | Búsqueda objetivo con restricciones de rango válido |
| `flujo_ml/v3_grid_completo.py` | Grid 1008 combos (TP×SL×días) — solo usar para análisis, no para selección directa |
| `Modelos/lightgbm_v3.pkl` | Modelo producción actual (21 features, th=0.5, AUC ~0.571 OOS) |
| `Modelos/ohclv_cache.csv` | 500 días / 227 tickers (2025-03-19 → 2026-07-31) |

> **REGLA CRÍTICA:** No editar `bt_honesto.py` sin mantener consistencia train/test. Las features y `CAT_PARAMS` en entrenamiento e inferencia deben ser idénticas. Cambiar una feature en entrenamiento sin actualizar `4_inferencia_oraculo.py` invalida toda la cadena.

---

## 3. Feature Engineering — V3_FEATURES (33 variables)

```python
V3_FEATURES = [
    # Categoría (one-hot)
    "Cat_Sweet_Spot", "Cat_Cazador_Dips", "Cat_Recup_Rapida", "Cat_Cuchillos_Cayendo",
    # RSI familia (Connors)
    "RSI_2", "RSI_4", "RSI_7", "RSI_14",
    # Volatilidad y bandas
    "ATR_%", "BB_PctB", "BB_Width",         # BB_Width = (Upper-Lower)/SMA20
    # Flujo de capital
    "CMF_20", "CMF_Slope_3D",               # CMF_Slope_3D = CMF - CMF.shift(3)
    # Distancias y tendencia
    "Dist_SMA200_%", "RVOL_5D",
    "Return_5D_%", "Return_20D_%", "Tendencia_Sana", "Impulse_System",
    "Drawdown_52W_%", "Dist_52W_High_%", "RS_Rating",
    # NUEVAS 2024-2025
    "Consecutive_Down_Days",  # Streak bajista Connors (más predictivo que RSI crudo)
    "ATR_Regime",             # ATR / avg_ATR20 — filtro anti-crash (>1.5 = no operar)
    "RSI2_Pct100",            # Percentil RSI2 en 100 obs — extremo real vs ruido
    # Derivadas de riesgo
    "RR_Ratio", "ATR_Risk_Pct", "TP_ATR", "Abs_Drawdown", "RSI2_DD", "RSI2_RSI14",
    # Fundamentales
    "FCF_log", "Beta",
]  # Total: 33 features
```

**Cálculo correcto de indicadores reales (crítico para inferencia):**
```python
# En 4_inferencia_oraculo.py → función indicadores_reales()
# RSI_2D:            calculado desde historial OHLCV real del caché (NO fabricado)
# ATR_%:             ATR_14 / precio × 100 desde caché
# Dist_SMA200_%:     (precio - SMA200) / SMA200 × 100
# Drawdown_52W_%:    (precio - max_52w) / max_52w × 100
# PE_Ratio:          campo real 'Valor Mercado (P/E Ratio)' de mercado.json
```

**Asignación de categorías (alineada con 1_extraer_dataset.py):**
```python
# Recup:     rsi2 < 15  AND  close > sma200
# Sweet:     rsi2 < 15  AND  drawdown in [-20%, -40%]
# Cazador:   rsi2 >= 15 AND drawdown > -35%  (o RSI_14 < 32)
# Cuchillos: rsi2 < 5   AND  close < sma200  ← exige rsi2 < 5, NO < 15
```

---

## 4. Pipeline de Entrenamiento

```
ohclv_cache.csv  →  compute_features()  →  build_dataset()
                                              ↓
                               train_lightgbm(FULL_FEATURES)
                                              ↓
                              calibrate(isotonic / Platt)
                                              ↓
                         walk_forward_validation(cutoff=W2, W1)
                                              ↓
                              evaluate_oos(AUC, Spearman, F0.5)
```

**Ventanas de validación OOS:**
- **W2:** cutoff 2026-02-01 → test Feb–Abr 2026 (mercado mixto)
- **W1:** cutoff 2026-05-01 → test May–Jul 2026 (mercado bajista, QQQ -5.6%)

Un combo es **robusto** si supera ambas ventanas. Combos que solo ganan en W1 o W2 son sobreajuste.

---

## 5. CAT_PARAMS — Combos Validados (Estado V3.6)

Únicos combos que sobreviven ambas ventanas OOS con n ≥ 8 trades y EA > 40%:

| Categoría | Combo Recomendado | WR | EA% W2 | EA% W1 | Nota |
|---|---|---|---|---|---|
| **Cazador Dips** | TP 8% / SL 4% / 11d | 39–41% | +77% | +93% | Mejor balance |
| Cazador Dips | TP 8% / SL 3% / 11d | 33% | +51% | +89% | Alternativa |
| **Cuchillos** | TP 15% / SL 3% / 7d | 20% | +239% | +151% | Alto EA, WR bajo |
| **Sweet Spot** | TP 8% / SL 5% / 11d | 44–50% | ~+42% | +42% | Más estable |
| ~~Recup TP20/SL5/30d~~ | — | — | falla | +6.14% | NO USAR — sobreajuste |

> TP > 15%, plazos > 21d, o combos que solo ganan en una ventana → descartar siempre.

---

## 6. Fine-Tuning con Optuna — Reglas

```python
# Rango válido (preferencia usuario + validación empírica V3.6)
TP_RANGE    = (8, 15)    # %
SL_RANGE    = (3, 8)     # %
DIAS_RANGE  = (7, 15)    # días de retención máxima
THRESHOLD   = 0.5        # umbral de clasificación base

# Protocolo de validación doble:
# 1. Selección en W2 (Feb-Abr) como validación primaria
# 2. Confirmación en W1 (May-Jul) — si falla aquí, descartar aunque gane en W2
```

**Variables candidatas para fine-tuning adicional:**
- `threshold`: probar 0.45 / 0.5 / 0.55 / 0.6 (más threshold = menos trades, más WR)
- `min_trades_filter`: descartar combos con n < 8 por categoría
- `rvol_min`: filtro RVOL_5D > 1.0 en la señal de entrada
- `rsi2_dd_min`: filtro RSI2_DD mínimo (evita entrar en momentum bajista fuerte)
- `dist_sma200_max`: límite de distancia a SMA200 para no comprar en extensión

---

## 7. Métricas — Cuáles usar y cuáles evitar

```python
# CORRECTO — EA_lineal (capital rotativo fijo, lo que el usuario realmente hace)
EA_lineal = E_por_trade * trades_año         # ej: +5% × 12 = +60%/año

# ENGAÑOSO — EA_compuesto (asume reinversión 100% del capital, da 1500%+)
EA_comp = (1 + E) ** freq - 1

# Dólares reales:
Ganancia_año = EA_lineal * capital_por_trade  # ej: 60% × $125 = $75/año
```

> **Kelly eliminado:** el usuario opera con capital fijo por trade ($100–150), no Kelly. Las fórmulas Kelly (f* = p - (1-p)/b) generaban confusión y no reflejan el sizing real.

**Métricas que sí importan (en orden):**
1. `E%` por trade — esperanza por operación (más honesta)
2. `EA_lineal` — retorno anual real con capital rotativo
3. `WR` — siempre con contexto de RR (WR=33% con RR=3:1 es bueno)
4. `AUC OOS` — discriminación del modelo, target > 0.57
5. `Spearman(prob, E%)` — correlación predicción→rentabilidad, target > +0.10
6. `F0.5` — penaliza falsos positivos más que FN (preferible en señales de compra)

---

## 8. Inferencia en Producción

```
mercado.json → indicadores_reales(caché OHLCV) → asignar_categoria()
                                                      ↓
                                       lightgbm_v3.pkl.predict_proba()
                                                      ↓
                                  filtrar(proba >= threshold=0.5)
                                                      ↓
                              predicciones_v2.json → frontend/public/
```

**Dependencias críticas:**
- `mercado.json` no tiene `Historia_Precios` (se elimina al serializar) → inferencia depende del caché OHLCV.
- Si el ticker no está en el caché → features técnicas no calculables → señal descartada.
- `PE_Ratio` viene del campo real `'Valor Mercado (P/E Ratio)'` de `mercado.json` (52/59 tickers tienen valor).

---

## 9. Próximos Pasos Priorizados

1. **[INMEDIATO]** Fijar config operativa: Cazador TP8/SL4/11d + Cuchillos TP15/SL3/7d + Sweet TP8/SL5/11d. Actualizar `CAT_PARAMS` en `bt_honesto.py`.
2. **[PENDIENTE]** Correr `v3_dataset.py` para regenerar `Modelos/v3_dataset.csv` con las 33 features (BB_Width, CMF_Slope_3D, Consecutive_Down_Days, ATR_Regime, RSI2_Pct100).
3. **[PENDIENTE]** Reentrenar `lightgbm_v3.pkl` con las 33 features y comparar AUC OOS vs 0.571 actual.
4. **[PENDIENTE]** Probar threshold 0.5 vs. 0.6 en combos finales.
5. **[PENDIENTE]** Generar `backtest_45d.json` con combos finales via `14_generar_backtest_json.py`.
6. **[OBJETIVO REVISADO]** Meta alcanzable con validación honesta: **WR > 35% + EA > 40%** (WR > 50% + EA > 40% simultáneo es matemáticamente inviable — WR > 50% solo ocurre con TP≤5% que aplana EA).
7. **[TESTS]** Correr `python3 -m pytest flujo_ml/tests/ -v` después de cualquier cambio en bt_honesto o v3_dataset.
8. **[ARQUITECTURA]** Iniciar Fase 1: separar `bt_honesto.py` en `src/features/`, `src/backtesting/`, `src/evaluation/`.

## 10. Scripts activos en `flujo_ml/` (14 — tras limpieza V3.6)

| Script | Rol |
|---|---|
| `bt_honesto.py` | **SSOT** — features, dataset, simulate, metrics, logging |
| `v3_dataset.py` | `add_skill_features()` + 33 `V3_FEATURES` |
| `v3_entrenar_modelo.py` | Entrena grid config×días×th, guarda `lightgbm_v3.pkl` |
| `v3_grid_completo.py` | `build_ds()` + `simulate()` + `ea_of()` — importado por finetune/objetivo |
| `v3_finetune.py` | Validación doble OOS (W2→selección, W1→confirmación) |
| `v3_objetivo.py` | Busca combos WR>35% + EA>40% |
| `v3_validar.py` | Valida combos ganadores en ventana independiente |
| `v3_ea_anual.py` | EA_lineal + EA_comp por categoría, ventana 365d |
| `v3_skill_backtest.py` | Backtest con TP/SL de la skill (AUC 0.623 vs 0.571) |
| `n13.py` | Shim de compatibilidad (reexporta bt_honesto) |
| `13_iterar_noche.py` | Optuna walk-forward nocturno — produce `modelo_metadata_noche.json` |
| `11_descargar_ohclv.py` | Actualiza caché OHLCV |
| `14_generar_backtest_json.py` | Salida JSON para frontend |
| `4_inferencia_oraculo.py` | Inferencia en vivo → `predicciones_v2.json` |
| `tests/test_bt_honesto.py` | 16 tests: categorías, simulate, metrics, no-leakage |
| `tests/test_features.py` | 15 tests: BB_Width, streak, ATR_Regime, V3_FEATURES |

> Eliminados en V3.6: `1_extraer_dataset.py`, `2_entrenar_lightgbm.py`, `3_evaluar_y_reglas.py`, `5_*`, `6_*`, `7_*`, `8_*`, `9_*`, `10_*`, `12_*`, `v3_backtest.py` (MLP), `v3_nn_model.py` (MLP).
