# 🔄 Estado del Proyecto — InversionBot (Handoff para nuevo agente)

Fecha: 2026-08-03 · Última sesión: V3.5→V3.6 (bugs, grid EA, fine-tuning, limpieza)

---

## 1. Misión / Objetivo de negocio
Sistema de **screening de dips** que genera señales de compra con probabilidad de éxito (LightGBM), simulando backtest honesto trade-a-trade con TP/SL/días por categoría. La **métrica a maximizar es el Interés Efectivo Anual (EA%) por categoría** (no el win rate aislado), con capital rotativo fijo (~$100-150/trade, estilo SmartDCA).

Meta del usuario (aún **no alcanzada**): **WR > 50% y EA% > 40%** simultáneamente. Ver §5: es un trade-off matemático imposible con validación OOS honesta.

## 2. Directorios clave
| Ruta | Contenido |
|---|---|
| `flujo_ml/bt_honesto.py` | **FUENTE ÚNICA DE VERDAD**: `compute_features`, `build_dataset`, `simulate_signals`, `metrics`, `calibration`, `CAT_PARAMS` (TP/SL/días por categoría), `FULL_FEATURES` (21 features), `CACHE`=`Modelos/ohclv_cache.csv` |
| `flujo_ml/4_inferencia_oraculo.py` | Inferencia en vivo → `flujo_datos/predicciones_v2.json` + `frontend/public/`. **CORREGIDO**: RSI_2D real (antes fabricado ×0.7), PE_Ratio real (`Valor Mercado (P/E Ratio)`), categorías alineadas |
| `flujo_ml/13_iterar_noche.py` | Sesión nocturna V2.6: Optuna + walk-forward + recalibración |
| `flujo_ml/v3_*.py` | Familia V3 (ver §4) |
| `Modelos/` | Modelos `.pkl` + metadatos + caché OHLCV + resultados grid |
| `flujo_datos/` | `mercado.json` (input), `predicciones_v2.json`, `backtest_45d.json` |
| `frontend/` | React + Vite; `public/predicciones_v2.json` es la fuente para la web |
| `.agent/` | Skills: `SWING_TRADING_SKILL.md` (Connors/O'Neil/Tharp), `QUANT_RISK_SKILL.md` (Kelly/ATR), `PONYTAIL_SKILL.md` (concisión), `context.md`, `PROMPTS_INVESTIGACION.md` |

## 3. Artefactos en producción (los únicos con referencias activas)
- `Modelos/lightgbm_v2.pkl` + `modelo_metadata.json` → inferencia web (9 features, el de producción)
- `Modelos/lightgbm_noche.pkl` + `modelo_metadata_noche.json` → mejor discriminación OOS (21 features `FULL_FEATURES`, AUC 0.571, Spearman +0.10)
- `Modelos/lightgbm_v3.pkl` + `modelo_metadata_v3.json` → modelo final V3 (config actual/11d/th0.5)
- `Modelos/ohclv_cache.csv` → 500 días / 227 tickers (2025-03-19 → 2026-07-31)
- `Modelos/dataset_entrenamiento.csv`, `v3_dataset.csv`, `grid_ea_resultados.csv`, `finetune_resultados.csv`, `objetivo_resultados.csv`

## 4. Últimas modificaciones (V3.5 / V3.6)
1. **Bugs corregidos en `4_inferencia_oraculo.py`:**
   - `RSI_2D` se fabricaba como `RSI_14 × 0.7` (campo `RSI 7D` inexistente → fallback). Ahora `indicadores_reales()` calcula RSI_2/RSI_14/ATR_%/Dist_SMA200_%/Drawdown_52W_%/Tendencia desde el caché OHLCV. Ej: NTLA 18.7→41.4.
   - `PE_Ratio` 100% 'N/A' → campo real `Valor Mercado (P/E Ratio)`. 52/59 con valor.
   - `asignar_categoria()` alineada con `1_extraer_dataset.py` (exige rsi2<15 Recup, rsi2<5 Cuchillos).
2. **Auditoría features:** el modelo de producción v2 usa solo 9 features; `FULL_FEATURES` (21) con `Dist_SMA200_%`, `RVOL_5D`, `Return_5D_%`, `RR_Ratio`, `RSI2_DD`, `FCF_log`, `Beta` mejora AUC. **Pendiente: reentrenar producción con FULL_FEATURES.**
3. **V3 NN:** MLP no supera al GBM (AUC 0.555 vs 0.571). Se descarta NN con features actuales.
4. **Grid completo EA** (`v3_grid_completo.py`): TP{5,8,10,12,15,20}×SL{3,4,5,6,8,10}×días{5,7,11,15,21,30,45} = 1008 combos. **PROBLEMA DETECTADO:** los máximos (TP20%, 30-45d) eran sobreajuste a la ventana W1 (may-jul).
5. **Fine-tuning corregido** (`v3_finetune.py` + `v3_objetivo.py`): restringido a **7-15 días** (preferencia usuario + skill), TP 8-15%, con **validación doble OOS** (selección W2 feb-abr → confirmación W1 may-jul). Resultado robusto (§5).
6. **Limpieza:** eliminados `.pkl`/`.json` en desuso (lightgbm_v2_ft, isotonic_*, lightgbm_v3_skill, calibracion_reporte, reglas_extraidas, parametros_optimizados_categoria, v3_backtest_honesto, v3_nn_reporte, dataset_connors_quant). Quedan solo los 6 artefactos con referencias.

## 5. Resultados clave del backtesting honesto
**Contexto:** caché = 500 días. Ventanas usadas: W2 (Feb-Abr 2026, cutoff 2026-02-01), W1 (May-Jul 2026, cutoff 2026-05-01). Siempre entrenar con cutoff anterior a la ventana de test (sin leakage).

**V2.6 original:** th=0.5 → 11 trades, WR 36.4%, PnL +1.16% (45d bajista).

**Mejores combos robustos (sobreviven AMBAS ventanas OOS, n≥8, EA>40%):**
| Categoría | Combo | WR | EA W2 | EA W1 |
|---|---|---|---|---|
| **Cazador Dips** | **TP8/SL4/11d** | 39-41% | +77% | +93% |
| Cazador Dips | TP8/SL3/11d | 33% | +51% | +89% |
| **Cuchillos** | **TP15/SL3/7d** | 20% | +239% | +151% |
| **Sweet Spot** | **TP8/SL5/11d** | 44-50% | ~+42% | +42% |

**Combo más rentable por categoría (solo W1, no validado):** Recup TP20/SL5/30d E+6.14% → **NO confiable** (falla en W2).

**CONCLUSIÓN IMPORTANTE:** **no existe ninguna combinación con WR>50% Y EA>40% en ambas ventanas.** WR alto (50%+) solo con TP 5% (EA≈0-40%). El trade-off real: Cazador TP8/SL4/11d (WR 39%, EA +77-93%) es el mejor balance. La meta del usuario es inalcanzable con honestidad OOS → hay que relajar a WR>35% + EA>40%, o aceptar el mejor trade-off.

**Interpretación de métricas (NO usar EA compuesto o Kelly como headline):**
- `EA_lineal = E × trades/año` (capital rotativo fijo) → la métrica honesta para $100/trade
- `EA_comp = (1+E)^freq-1` → engañoso (asume 100% capital secuencial, da 1500%+)
- `EA_kelly` → conservador con half-Kelly (daba +0.7-3.3%) pero el usuario **no usa Kelly**
- `$ = EA_lineal × $100-150/trade`

## 6. Skills de referencia (.agent/)
- `MLOPS_INVERSION_SKILL.md` **(NUEVA V3.6)**: Pipeline MLOps completo — FULL_FEATURES 21 vars, CAT_PARAMS validados, ventanas OOS, fine-tuning con Optuna, métricas correctas (EA_lineal), inferencia en producción, reglas de mantenimiento de bt_honesto.py. Arquitectura objetivo de 4 fases (src/, pipelines/, Hydra, MLflow, DVC).
- `SWING_TRADING_SKILL.md`: Marco teórico 4 categorías con TP/SL sugeridos (Connors RSI(2), CANSLIM, Van Tharp). §3 tiene los combos **validados empíricamente** (OOS doble V3.6) que difieren de los sugeridos teóricos — usar esos para producción.
- `QUANT_RISK_SKILL.md`: Kelly, ATR sizing, trailing stop.
- `PONYTAIL_SKILL.md`: respuesta directa, sin verbosidad, sin sobre-ingeniería.
- ~~`DRAWIO_SKILL.md`~~: eliminada (incompleta, no referenciada).
- `references/PROMPTS_INVESTIGACION.md`: movida de `.agent/` raíz a `references/` (es documentación, no skill formal).

## 7. Siguientes pasos (priorizados)
1. **[RECOMENDADO] Fijar config operativa final** para frontend con los combos robustos de §5: Cazador TP8/SL4/11d + Cuchillos TP15/SL3/7d + (opcional) Sweet TP8/SL5/11d. Descartar Recup y los TP20/plazos largos (sobreajuste).
2. **Reentrenar modelo de producción (`lightgbm_v2.pkl`) con `FULL_FEATURES`** (21) para que la web use las features que mejoran AUC. Requiere actualizar `4_inferencia_oraculo.py` (ya tiene `indicadores_reales`) y `2_entrenar_lightgbm.py` o usar `bt_honesto.build_dataset`.
3. **Decidir umbral:** los combos robustos usan th=0.5. Probar th=0.5 vs 0.6 en los combos finales.
4. **Generar JSON para frontend:** `backtest_45d.json` con los combos finales + métricas por categoría (E%/trade, EA%, WR con contexto de RR). Existe `14_generar_backtest_json.py`.
5. **Corregir tesis de la meta:** documentar al usuario que WR>50%+EA>40% es inviable OOS; proponer WR>35%+EA>40%.
6. **Considerar más historia OHLCV** (solo hay 500 días; más años daría validación más robusta).

## 8. Riesgos / notas
- El caché OHLCV empieza 2025-03-19 → no hay suficiente historia para walk-forward de años completos (máx ~90 días de test útil).
- `mercado.json` no tiene `Historia_Precios` (se elimina al serializar) → la inferencia depende del caché OHLCV.
- Los EA% altos (100-400%) son sensibles a la frecuencia de señales; en mercado bajista (45d hostil, QQQ -5.6%) caen.
- NO editar `bt_honesto.py` sin mantener consistencia train/test (features y CAT_PARAMS idénticos).
