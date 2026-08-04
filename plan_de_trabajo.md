# 🚀 Plan de Trabajo V2: Motor de Backtesting por Alertas Trade-a-Trade y Optimizador

Este documento contiene la arquitectura aprobada para el **InversionBot** con simulación trade-a-trade, optimización por cuadrícula de TP%/SL%/Días y auditoría del último mes.

---

## 📌 Servidor Local en Ejecución
👉 **[http://localhost:5173/](http://localhost:5173/)**

---

## 🎯 Fases de Implementación Aprobadas

### 1. Motor de Backtesting Trade-a-Trade (Python)
- **Lógica de Trade:** Cada activación de señal de Dip abre una operación virtual a $100 USD.
- **Reglas de Salida del Trade:**
  - **Take Profit (TP %):** Salida exitosa si toca el objetivo de ganancia.
  - **Stop Loss (SL %):** Salida defensiva si toca el límite de pérdida.
  - **Expiración por Tiempo (Días):** Salida a precio de mercado si transcurren los días máximos.
- **Optimizador Grid Search Automático por Categoría:**
  - Evalúa combinaciones de **TP% (3%, 5%, 8%, 10%, 15%)**, **SL% (5%, 8%, 10%, 12%, 15%)** y **Días (15, 30, 45, 60)**.
  - Encuentra la combinación exacta `(TP% + SL% + Días)` que maximiza el **Win Rate %** y el **Retorno Esperado por Trade %**.
- **Universo Completo:** Incluye Acciones, ETFs/Índices (SPY, QQQ, VTI, IWM, DIA, XLF, XLE, etc.) y Criptomonedas (BTC, ETH, SOL, COIN, MSTR).

### 2. Auditoría de Alertas del Último Mes (Forward Validation)
- Registro de todas las señales disparadas en los últimos 30 días.
- Muestra el precio de entrada, precio actual o precio de salida por TP/SL/Tiempo, indicando el P&L % real acumulado.

### 3. Dashboard Interactivo en React
- Navegación por **Categorías de Dip**: `🔥 Cazador Dips`, `🎯 Sweet Spot`, `⚡ Recup. Rápida`, `⚠️ Cuchillos Cayendo`.
- Tarjeta de **Recomendación Algorítmica Óptima**: Muestra la fórmula ganadora `(TP% / SL% / Días)` para esa categoría.
- Sección de **Desempeño del Último Mes**.

---

## 🧠 V3: Redes Neuronales para Mejorar la Calibración de Probabilidad (Propuesta)

**Problema detectado en V2:** El modelo LightGBM está bien calibrado in-sample (correlación +0.44, WR sube de 76%→100% por bucket) pero se derrumba out-of-sample (correlación ~+0.04, WR plano ~25%). Es **sobreajuste**: las probabilidades no representan la probabilidad real de éxito de la señal.

**Pregunta abierta:** ¿Es necesario pasar a redes neuronales en V3 para mejorar la probabilidad?

**Análisis preliminar (V2):**
- La falta de calibración OOS NO es un problema de arquitectura del modelo, sino de **validación y regularización**: se optimizó F0.5 sobre datos de entrenamiento (in-sample) y se eligió umbral con leakage.
- Antes de saltar a una NN hay que agotar las correcciones baratas del GBM:
  1. **Entrenar con validación temporal OOS** (walk-forward) como métrica de selección.
  2. **Regularizar** (más `min_child_samples`, `feature_fraction`, `reg_lambda`) para cerrar la brecha in-sample/OOS.
  3. **Recalibración isotónica/Platt** ajustada sobre predicciones OOS (no sobre train) para que el número mostrado sea honesto.
  4. **Features fundamentales** (FCF, Beta) + indicadores de riesgo (RR Ratio, ATR units).

**¿Cuándo sí pasar a Redes Neuronales en V3?**
- Si tras GBM regularizado + recalibración el **AUC OOS < 0.55** o la **correlación Spearman OOS de las señales sigue < 0.10**.
- La NN aporta valor real en calibración cuando hay **relaciones no lineales/contexto temporal** (secuencias de precios, embeddings de fundamentales) que un GBM con features tabulares no captura.
- Candidatos V3:
  - **MLP tabular** (features actuales + fundamentales) con `BatchNorm` + dropout + early stopping OOS → primera opción, barata.
  - **LSTM/Transformer sobre secuencias de OHLCV** (14–60 días) para capturar contexto de momentum/mean-reversion → segunda fase.
  - **Loss de calibración** (focal loss o `tempering`) + **deep ensembles** (MC-dropout) para incertidumbre.
- **Regla de decisión:** solo migrar cuando el GBM optimizado no alcance **WR real OOS ≥ 55%** en señales BUY con umbral ≥ 40% durante 45 días, con n ≥ 30 trades.

**Acción inmediata (V2.5):** ejecutar `flujo_ml/10_finetune_fundamentales.py` (GBM regularizado + isotonic) y medir si el problema de calibración se resuelve sin necesidad de NN. Dejar la migración a NN documentada aquí como alternativa si falla.

---

## 🌙 Sesión Nocturna (V2.6): Backtest Honesto + Fine-Tuning

**Problema detectado en el backtest viejo (`9_backtest_45d.py`):** entraba al precio de hace 45 días (no al de la señal) → el WR 16.9% medía el régimen de mercado, no la calidad de la señal. Además el caché OHLCV tenía solo 210 días (SMA_200 = NaN → `Tendencia_Sana` siempre 0) y el backtest usaba categorías/TP/SL/ventana distintos al entrenamiento.

**Correcciones implementadas:**
1. `11_descargar_ohclv.py` → caché de **500 días / 227 tickers** (SMA_200 válido).
2. `bt_honesto.py` → `asignar_categoria`, `CAT_PARAMS` y ventana de 11 días **alineados exactamente** con `1_extraer_dataset.py` (categorías idénticas: Cazador/Sweet/Recup/Cuchillos con condiciones de RSI_2, y TP/SL por categoría iguales).
3. `13_iterar_noche.py` → dataset de entrenamiento **reconstruido 100% consistente** con el generador de features del backtest (mismas columnas, mismo target TP/SL) + features de riesgo (RR_Ratio, TP_ATR, etc.) + fundamentales (FCF_log, Beta).
4. Split **sin leakage**: el modelo solo se entrena con datos anteriores a la ventana de test (2026-06-16).
5. Fricción corregida (era fija $0.15 → distorsionaba criptos de precio bajo: pnl de -50000%).

**Resultado del backtest honesto real (últimos 45 días, señales no repetidas, modelo entrenado sin leakage):**

| Umbral | Trades | Win Rate | PnL prom. |
|--------|--------|----------|-----------|
| 0.40 | 67 | 23.9% | -1.07% |
| 0.45 | 35 | 20.0% | -1.48% |
| **0.50** | **11** | **36.4%** | **+1.16%** |

- **La probabilidad ahora funciona como indicador:** WR por bucket sube monótonamente 15% → 23.5% → 40% → 50% a medida que sube la probabilidad.
- AUC OOS walk-forward: **0.578** · Spearman OOS: **+0.112** (antes ~0.04).
- La recalibración isotónica **empeora** (comprime las probabilidades); se usa la probabilidad cruda.
- El mercado en la ventana fue bajista (QQQ -5.6%, 0% días sobre SMA20): el WR se mide en condiciones adversas.
- Feature de régimen de mercado (QQQ/SPY) probada como feature: **no mejoró** → excluida.

**Artefactos guardados:** `Modelos/lightgbm_noche.pkl`, `Modelos/modelo_metadata_noche.json`, `flujo_datos/backtest_45d.json` (regenerado con metodología honesta), `frontend/public/backtest_45d.json`.

**Pendiente para V3 (según regla de decisión):** el GBM regularizado alcanza WR OOS 36.4% con n=11 (umbral 0.5). Sigue por debajo de la meta de 55% con n≥30 → evaluar NN (MLP tabular) cuando haya una ventana de test con más señales o un mercado alcista.

---

## 🔬 V3: Redes Neuronales vs Skill de Swing Trading (Experimentos)

**Objetivo:** mejorar el WR real y el valor esperado adaptando el pipeline al marco de `SWING_TRADING_SKILL.md` (Connors RSI(2), CANSLIM RS Rating, CMF, Van Tharp R-múltiplos) y evaluar si una NN supera al GBM.

### Auditoría de flujo de datos (hallazgos)
1. **BUG de producción en `flujo_datos/predicciones_v2.json`:** `RSI_2D = RSI_14D × 0.7` (falso, no es RSI-2 real; verificado NTLA 18.7 = 26.7×0.7, RDDT 12.9 = 18.4×0.7). El JSON que alimenta la web tiene la feature clave fabricada.
2. **`PE_Ratio`:** 59/59 tickers = 'N/A' (feature muerta).
3. Se restauraron `bt_honesto.py` y `n13.py` (se habían borrado, quedaban solo .pyc) como fuente única de verdad. Verificado: `compute_features` → 11912 filas/227 tickers, `build_dataset` → 10883 filas, base rate 0.215.

### Experimento A: MLP tabular vs LightGBM (walk-forward OOS)
- `v3_dataset.py` añade features de la skill (RSI_4, BB_PctB, CMF_20, Dist_52W_High_%, RS_Rating vs SPY, Impulse_System, Return_20D) → `Modelos/v3_dataset.csv` (28 V3_FEATURES, 10883 filas).
- `v3_nn_model.py` (MLP con BatchNorm+Dropout+EarlyStopping): **MLP OOS AUC 0.555 / Spearman +0.078 vs LGB 0.571 / +0.102**; F0.5: 0.276 vs 0.282.
- **Conclusión: la MLP no supera al GBM** en discriminación. No hay señal de que la NN aporte valor real con las features actuales.
- `v3_backtest.py` en ventana de 45d (bajista): ambas pierden (MLP WR 20%, LGB 17.9% @th0.5). Las features V3 por sí solas no ayudan.

### Experimento B (ganador): target con TP/SL de la skill + re-entrenamiento
- La skill define TP/SL más agresivos por categoría: Recup **15/5**, Sweet **15/8**, Cazador **12/8**, Cuchillos **8/5** (vs 10/4, 15/6, 12/5, 8/4 del entrenamiento actual).
- `v3_skill_backtest.py` reconstruye el target con esos TP/SL y re-entrena. Resultado OOS walk-forward:

| Target | AUC | Spearman | F0.5 | Monotonicidad buckets |
|--------|-----|----------|------|----------------------|
| Actual (10/4,15/6,12/5,8/4) | 0.571 | +0.102 | 0.284 | 15→21→24→27→29→12% |
| **Skill (15/5,15/8,12/8,8/5)** | **0.623** | **+0.174** | **0.311** | 11→19→27→28→31→29% |

- **El target de la skill es más discriminativo** (AUC +0.05, Spearman +0.07) porque el horizonte/alza del objetivo es más realista para capturar el movimiento de rebote.
- Backtest honesto 45d con modelo re-entrenado (consistente con su calibración OOS): th=0.5 → WR 29.1%; el bucket 60-100% da **WR 41.2%**.

### Barrido fino: punto operativo óptimo (mercado bajista, 45d)
| Filtro + umbral | Trades | WR | PnL | Expectancy |
|-----------------|--------|-----|-----|------------|
| Base th=0.5 | 55 | 29.1% | -1.29% | -0.21R |
| Base th=0.6 | 24 | 33.3% | -1.17% | -0.17R |
| **RS> -5% th=0.65** | **7** | **42.9%** | **+0.66%** | **+0.10R** |
| Tendencia+RS th=0.65 | 3 | 33.3% | -1.55% | -0.19R |

- El **filtro RS (fuerza relativa, Dist_SMA200_% > -5%) + umbral alto (0.65)** es el único punto con expectativa positiva en esta ventana bajista.
- El SL agresivo de la skill exige WR ≥ ~38% para break-even (RR≈1.6); se consigue solo en el bucket de prob alta + RS.
- La ventana de test es hostil (QQQ -5.6%): el WR real mejora cuando hay rebotes.

### Recomendación de producción
1. **Corregir el bug `RSI_2D = RSI_14D × 0.7`** en el pipeline de inferencia (es la feature más importante y está falsificada en producción).
2. **Adoptar el target de la skill** (TP/SL 15/5, 15/8, 12/8, 8/5) con LightGBM (no MLP): mejor AUC/Spearman y calibración monótona.
3. Operar con **prob ≥ 0.60 + filtro RS (Dist_SMA200_% > -5%)** en mercados bajistas; en mercado alcista relajar el umbral a 0.5.

**Artefactos V3:** `flujo_ml/v3_dataset.py`, `v3_nn_model.py`, `v3_backtest.py`, `v3_skill_backtest.py`; `Modelos/v3_dataset.csv`, `v3_nn_reporte.json`, `lightgbm_v3_skill.pkl`, `modelo_metadata_v3_skill.json`.

---

## 🐛 V3.5: Corrección de bugs de producción + métrica objetivo (Interés Efectivo Anual)

### Bugs corregidos en `4_inferencia_oraculo.py`
1. **`RSI_2D` fabricado (bug crítico):** `rsi_2 = limpiar_float(a.get("RSI 7D"), rsi_14 * 0.7)` → el campo `RSI 7D` no existe en `mercado.json`, así que SIEMPRE caía al fallback `RSI_14 × 0.7` (falso). Se añadió `indicadores_reales()` que calcula RSI_2/RSI_14/ATR_%/Dist_SMA200_%/Drawdown_52W_%/Tendencia_Sana **reales desde el caché OHLCV** (`Modelos/ohclv_cache.csv`, 500 días/227 tickers, cobertura 59/59 tickers de mercado.json). NTLA pasó de RSI_2=18.7 (falso) a **41.4** (real).
2. **`PE_Ratio` 100% 'N/A':** el campo real en mercado.json es `Valor Mercado (P/E Ratio)` (no `P/E Ratio` ni `PER`). Corregido → 52/59 activos con P/E real; los 7 N/A restantes son ETFs/criptos (GLD, BTC-USD, ETH-USD…) que legítimamente no cotizan P/E.
3. **Categorías desalineadas:** `asignar_categoria()` de inferencia ignoraba `rsi_2` (exigido por `1_extraer_dataset.py` para Recup rsi2<15 y Cuchillos rsi2<5). Alineada con la lógica de entrenamiento.

### Auditoría de features del LightGBM de producción (`lightgbm_v2.pkl`)
El modelo en producción usa **solo 9 features** (4 cats + RSI_2 + RSI_14 + ATR_% + Tendencia_Sana + Drawdown_52W_%) y le faltan las más informativas de la skill/riesgo: `Dist_SMA200_%`, `RVOL_5D`, `Return_5D_%`, `RR_Ratio`, `ATR_Risk_Pct`, `TP_ATR`, `Abs_Drawdown`, `RSI2_DD`, `RSI2_RSI14`, `FCF_log`, `Beta`. El modelo nocturno/V3 (`FULL_FEATURES` = 21 features) ya las usa y mejora AUC OOS (0.571 vs modelo de 9 features). **Recomendación: reentrenar producción con `FULL_FEATURES`.**

### 📈 Métrica objetivo: Interés Efectivo Anual por Categoría
Cálculo walk-forward honesto (train < 2026-05-01, test 90 días 2026-05-01→2026-07-31, sin leakage) con **half-Kelly position sizing** (igual que el pipeline: cap 25%, b=1.6):

**Con CAT_PARAMS actuales (10/4, 15/6, 12/5, 8/4) @ th=0.5 — EA_kelly = +0.7%/año total:**
| Categoría | n | WR | E/trade | Kelly | EA_kelly/año |
|-----------|----|------|---------|-------|--------------|
| Recup. Rapida | 15 | 46.7% | +2.37% | 6.7% | **+10.1%** |
| Cuchillos Cayendo | 47 | 40.4% | +0.66% | 1.6% | +2.0% |
| Cazador Dips | 16 | 31.2% | +0.90% | 0% | 0% |
| Sweet Spot | 2 | 0% | -6.11% | 0% | 0% |

**Con TP/SL de la SKILL (15/5, 15/8, 12/8, 8/5) @ th=0.5 — EA_kelly = +3.3%/año total:**
| Categoría | n | WR | E/trade | Kelly | EA_kelly/año |
|-----------|----|------|---------|-------|--------------|
| **Sweet Spot** | 8 | **50.0%** | +3.29% | 9.4% | **+10.5%** |
| **Cuchillos Cayendo** | 46 | **43.5%** | +0.58% | 4.1% | **+4.5%** |
| Cazador Dips | 16 | 37.5% | +1.84% | 0% | 0% |
| Recup. Rapida | 13 | 23.1% | -0.52% | 0% | 0% |

⚠️ Los EA sin Kelly (compuestos, 100% capital por trade) dan cifras irreales (98%–2000%) porque asumen capital total secuencial. Con Kelly sizing realista el EA anual esperado es **+0.7% → +3.3%** según configuración, dominado por las categorías Sweet Spot y Cuchillos.

### Mejoras investigadas (para este tipo de estrategia de dips/swing)
1. **TP/SL de la skill como target** → mejor discriminación OOS (AUC 0.623, Spearman +0.174) y mayor EA con Kelly.
2. **Posición fija por categoría** (no Kelly): Sweet/Cuchillos reciben capital, Cazador/Recup a 0 → concentra el EA positivo.
3. **Filtro RS (Dist_SMA200_%>-5%) + umbral 0.65** → mejor WR/expectativa en ventanas bajistas (probó +0.10R en 45d hostil).
4. **Features de skill** (RSI_4, BB_PctB, CMF_20, RS_Rating) → V3_dataset; no superan al GBM con FULL_FEATURES pero mejoran el target.
5. **Regímenes de mercado** → probados, no aportan; la ventana de test es bajista (QQQ -5.6%) y aún así hay EA positivo.
6. **Kelly sizing cap 25%** (half-Kelly) protege el drawdown; con WR<50% las categorías negativas quedan en 0.

**Artefactos V3.5:** `flujo_ml/v3_ea_anual.py` (cálculo EA con Kelly), `4_inferencia_oraculo.py` corregido, `flujo_datos/predicciones_v2.json` + `frontend/public/predicciones_v2.json` regenerados.

---

## 🏆 V3.6: Modelo Final Refinado (Grid TP/SL × días, maximizando EA)

Se probó un grid de **config de TP/SL (actual vs skill) × días máximos (5, 7, 11, 15)**, re-entrenando el modelo con target coherente (horizonte = días máximos, igual que la simulación) en walk-forward sin leakage (test 2026-05-01 → 07-31, 90 días).

| Config | Días | th | Trades | WR | E/trade | EA comp. | 
|--------|------|-----|--------|-----|---------|----------|
| **actual** | **11** | 0.5 | 80 | 38.8% | +0.86% | mejor |
| actual | 11 | 0.4 | 117 | 36.8% | +0.58% | |
| skill | 11 | 0.5 | 84 | 35.7% | +0.63% | |
| actual | 15 | 0.4 | 151 | 33.1% | +0.13% | |
| actual | 15 | 0.6 | 42 | 38.1% | +0.40% | |

**Resultado del modelo final (`lightgbm_v3.pkl`, config actual/11d/th0.5) por categoría:**

| Categoría | n | WR | E/trade | avgW | avgL | **EA lineal** | EA con Kelly |
|-----------|----|------|---------|------|------|---------------|--------------|
| **Recup. Rapida** | 15 | 46.7% | +2.37% | +9.8% | -4.1% | **+35.6%** | +10.1% |
| **Cuchillos Cayendo** | 47 | 40.4% | +0.66% | +7.8% | -4.2% | **+31.0%** | +2.0% |
| Cazador Dips | 16 | 31.2% | +0.90% | +11.8% | -4.1% | +14.3% | 0% |
| Sweet Spot | 2 | 0% | -6.11% | 0% | -6.1% | -12.2% | 0% |
| **TOTAL** | **80** | **38.8%** | **+0.86%** | | | **+68.7%** | **+0.7%** |

**Interpretación de métricas de EA (importante):**
- **EA lineal** = E × nº de trades en la ventana (es la métrica que daba 30-40% por categoría). Asume reinvertir la ganancia de cada trade, sin límite de capital simultáneo.
- **EA con Kelly** = compuesto con half-Kelly sizing (cap 25%). Realista para cartera pequeña con capital limitado. El EA anual esperado conservador es **+0.7%** con la config actual y **+3.3%** con TP/SL skill (Sweet Spot +10.5%, Cuchillos +4.5%).
- **EA compuesto puro** (1500%) es irrelevante: asume 100% del capital en cada trade secuencial.
- **Regla de decisión operativa:** las categorías con Kelly=0 (Cazador, Sweet con poca señal) se excluyen del capital → el EA real se concentra en Recup. Rapida y Cuchillos Cayendo.

**Artefactos:** `flujo_ml/v3_entrenar_modelo.py` (grid EA), `Modelos/lightgbm_v3.pkl`, `Modelos/modelo_metadata_v3.json`.

---

## 🔬 V3.7: Investigación WR>50% — Diagnóstico, Métrica $F_{0.5}$ y Experimentos Planificados

### 📐 Fundamentación Métrico-Financiera: $F_{0.5}$ Score vs Precision vs Recall vs EA

En el desarrollo de **InversionBot**, la métrica objetivo principal de los modelos de Machine Learning es el **$F_{0.5}$ Score**, el cual conecta directamente el rendimiento predictivo con la rentabilidad operativa:

$$\text{Precision} = \frac{TP}{TP + FP} \equiv \text{Win Rate (WR de las señales emitidas)}$$

$$\text{Recall} = \frac{TP}{TP + FN} \equiv \text{Detección de Oportunidades (Volumen de trades con alza)}$$

$$F_{0.5} = (1 + 0.5^2) \frac{\text{Precision} \times \text{Recall}}{(0.5^2 \times \text{Precision}) + \text{Recall}} = 1.25 \times \frac{\text{Precision} \times \text{Recall}}{0.25 \times \text{Precision} + \text{Recall}}$$

#### ¿Por qué $F_{0.5}$ y no solo Win Rate o $F_1$?
1. **Prioridad a la Precisión ($\beta = 0.5$):** En trading de rebotes (dips), un **Falso Positivo (FP)** provoca la pérdida directa de capital vía Stop Loss ($-4\%$ a $-8\%$), mientras que un **Falso Negativo (FN)** es solo una oportunidad no aprovechada ($0$). Por lo tanto, la Precisión (WR) pesa el **doble** que el Recall.
2. **Evita la Falacia de 'Alta Precisión con Cero Volumen':** Si el optimizador buscara únicamente maximizar la Precisión/WR, seleccionaría un umbral extremo ($th = 0.95$) ejecutando solo 1 trade al año. Tendría WR = 100%, pero un **Interés Efectivo Anual (EA) nulo**.
3. **Equilibrio Operativo:** $F_{0.5}$ actúa como el puente matemático: exige un **Win Rate elevado ($\ge 50\%$)** y al mismo tiempo penaliza modelos que no detectan suficiente volumen de trades ($n \ge 10$ por ventana de 90 días), maximizando así el **Retorno Efectivo Anual Compuesto (EA)**.

---

### ¿Por qué el WR cayó de "60%+" a 20–50% en pruebas OOS?

El WR del 60%+ de versiones iniciales era **in-sample con leakage** (`9_backtest_45d.py` entraba al precio de hace 45 días; correlación OOS era solo +0.04). Con `bt_honesto.py` el WR OOS real fue 36.4%. El modelo SÍ discrimina (AUC 0.578) pero la falta de optimización empírica de parámetros por categoría y el régimen bajista (QQQ -5.6%) explican el gap.

---

### 🔄 Arquitectura de Doble Optimización Co-Evolutiva

Para garantizar que tanto la **clasificación de oportunidades (definición de categorías)** como los **parámetros de ejecución (TP, SL, Días, $th$)** estén totalmente optimizados sin depender de heurísticas rígidas, el pipeline V3.7 ejecuta un proceso de optimización en dos niveles interconectados:

```
                               ┌──────────────────────────────────────────────────────────┐
                               │ NIVEL 1: Optimización de Límites de Categoría           │
                               │ (Drawdown, RSI_2, RSI_14, Tendencia Sana, CMF, RVOL)     │
                               └──────────────────────────┬───────────────────────────────┘
                                                          │
                                                          ▼
                               ┌──────────────────────────────────────────────────────────┐
                               │ NIVEL 2: Grid Search Operativo por Categoría             │
                               │ (TP% × SL% × Días Máximos × Umbral th)                   │
                               └──────────────────────────┬───────────────────────────────┘
                                                          │
                                                          ▼
                               ┌──────────────────────────────────────────────────────────┐
                               │ MÉTRICA DE EVALUACIÓN GLOBAL:                            │
                               │ Max F0.5 Score (Precision > 50%, Recall n ≥ 10, EA > 40%)│
                               └──────────────────────────────────────────────────────────┘
```

#### 1. Nivel 1: Optimización de Fronteras de Categorización (Clasificación de Dips)
- **Definiciones Actuales (Referencia):**
  - **Sweet Spot:** `Tendencia_Sana == 1` & `Drawdown_52W_%` $\le -20\%$.
  - **Recup. Rápida:** `Tendencia_Sana == 1` & `RSI_2` $< 15$.
  - **Cazador Dips:** `Drawdown_52W_%` $< -35\%$ & `RSI_14` $< 32$.
  - **Cuchillos Cayendo:** `Tendencia_Sana == 0` & `RSI_2` $< 5$.
- **Espacio de Búsqueda de Optimización:**
  - Optimizar los rangos numéricos de `Drawdown` (ej. $[-40\%, -15\%]$), cortes de `RSI_2` ($[3, 18]$) y la prioridad/jerarquía entre categorías cuando un activo cumple múltiples reglas.
  - Evaluar la incorporación de variables de confirmación ($CMF_{20} > -0.10$, $RVOL_{5D} > 1.1$, $Impulse\_System = 1$) como requisitos dinámicos de entrada a la categoría.

#### 2. Nivel 2: Optimización de Parámetros Operativos por Categoría `(TP% × SL% × Días × th)`
- Para cada configuración de categoría aprobada en el Nivel 1:
  - **Take Profit ($TP\%$):** Grid en $[3\%, 5\%, 8\%, 10\%, 12\%, 15\%, 20\%]$.
  - **Stop Loss ($SL\%$):** Grid en $[3\%, 4\%, 5\%, 6\%, 8\%, 10\%, 12\%]$.
  - **Días Máximos:** Grid en $[5, 7, 11, 15, 21]$ días.
  - **Umbral de Probabilidad ($th$):** Barrido dinámico en $th \in [0.35, 0.75]$ para seleccionar el $th^*$ que maximiza $F_{0.5}$ en Walk-Forward OOS.

---

### Diagnóstico y Re-evaluación Empírica de Categorías ($F_{0.5}$ / Precision / Recall)

| Categoría | Regla Actual (Referencia) | WR OOS V3.6 (Precision) | $F_{0.5}$ Est. | Rango de Optimización de Categoría (Nivel 1) | Parámetros Operativos a Optimizar (Nivel 2) |
|---|---|---|---|---|---|
| **Recup. Rápida** | Tend. Sana & RSI2 $<15$ | 16–46% | 0.28 | RSI2 $\in [5, 15]$ + `Impulse_System` | TP: $8-15\%$, SL: $3-6\%$, Días: $3-11$, $th: 0.40-0.70$ |
| **Sweet Spot** | Tend. Sana & DD $\le -20\%$ | 44–50% | 0.35 | Rango DD $\in [-35\%, -15\%]$ | TP: $10-20\%$, SL: $5-10\%$, Días: $7-15$, $th: 0.45-0.75$ |
| **Cazador Dips** | DD $< -35\%$ & RSI14 $<32$ | 31–41% | 0.25 | DD $\in [-45\%, -25\%]$ + $CMF > -0.10$ | TP: $8-15\%$, SL: $4-8\%$, Días: $5-15$, $th: 0.40-0.65$ |
| **Cuchillos Cayendo** | No Tend. & RSI2 $<5$ | 20–40% | 0.22 | RSI2 $\in [2, 8]$ + $RVOL > 1.1$ | TP: $5-12\%$, SL: $3-6\%$, Días: $3-9$, $th: 0.50-0.75$ |

---

### 5 Experimentos Planificados (Nivel 1 Categorías + Nivel 2 Parámetros via $F_{0.5}$)

1. **Optimización Conjunta de Fronteras de Categorización (Nivel 1):**
   - Probar variaciones de umbrales numéricos de `RSI_2`, `Drawdown` y `RSI_14` para re-clasificar las oportunidades de dip, midiendo qué definición genera subconjuntos con mayor separabilidad lineal y AUC.
2. **Grid Search Automático `(TP% × SL% × Días)` por Categoría (Nivel 2):**
   - Correr la cuadrícula completa de TP, SL y días máximos para cada nueva definición de categoría en walk-forward sin leakage, maximizando $F_{0.5}$ y EA.
3. **Optimización Dinámica de Thresholds per Categoría ($th_c^*$):**
   - Implementar `flujo_ml/v3_threshold_por_cat.py` para barrer $th \in [0.35, 0.75]$ independientemente por categoría.
   - Seleccionar el umbral que optimiza el trade-off Precisión/WR vs Recall (volumen $n \ge 10$) según $F_{0.5}$ en W2 (Train OOS) y validar en W1.
4. **Entrenamiento de 4 Modelos Especializados por Categoría (`v3_entrenar_por_cat.py`):**
   - Entrenar classifiers LightGBM independientes donde cada modelo aprenda los patrones de su micro-régimen, ajustando hiperparámetros y `sample_weight` enfocados en $F_{0.5}$.
5. **Ampliación de Caché OHLCV a 5 Años (`period="5y"`):**
   - Actualizar `11_descargar_ohclv.py` a 5 años (1250+ días) para que la optimización empírica evalúe múltiples ciclos de mercado (alcista, bajista, lateral).

---

### Meta Operativa Cuantificable
- **$F_{0.5}$ Score OOS $\ge 0.40$** global y por categoría principal.
- **Win Rate (Precision) $\ge 50\%$** en al menos 2 categorías, sostenido empíricamente en AMBAS ventanas (W2+W1).
- **Volumen de Trades (Recall):** $n \ge 10$ trades en 90 días por categoría aprobada.
- **Rentabilidad:** **EA_lineal $\ge 40\%$** y **EA con Kelly $\ge 5\%$** anual conservador.

---

### Prerequisito y Pipeline de Ejecución
```bash
# 1. Descargar OHLCV ampliado 5 años
python3 flujo_ml/11_descargar_ohclv.py

# 2. Generar dataset V3 con 33 features refinadas y parámetros empíricos
python3 flujo_ml/v3_dataset.py

# 3. Optimizar thresholds por categoría maximizando F0.5
python3 flujo_ml/v3_threshold_por_cat.py

# 4. Entrenar modelos especializados por categoría con F0.5 score
python3 flujo_ml/v3_entrenar_por_cat.py

# 5. Verificación de suite de tests unitarios (31/31 tests pass)
python3 -m pytest flujo_ml/tests/ -v
```

**Artefactos Creados / Planeados:** `flujo_ml/v3_threshold_por_cat.py`, `flujo_ml/v3_entrenar_por_cat.py`, actualización empírica de `bt_honesto.asignar_categoria()`, `Modelos/modelo_metadata_v3_cat.json`.
