# Plan de Trabajo: Algoritmo V2 (100 Activos, 1 Año, Ventanas Deslizantes & Gráficas MLOps)

Este documento refleja la configuración optimizada del **Algoritmo V2**, ajustada a un universo expandido de 100 activos, horizonte de 1 año con ventanas deslizantes (*rolling windows*) e inclusión de la Categoría como feature explícita del modelo, junto a la generación automática de gráficos de rendimiento MLOps.

---

## 🎯 Nuevos Parámetros y Ajustes de Arquitectura

1. **Universo de 100 Activos Diversificados:**
   - Inclusión de 100 tickers globales abarcando: tecnología, semiconductores, energía limpia, aeroespacial, salud, cripto, oro/commodities y ETFs temáticos.
2. **Horizonte de 1 Año con Ventanas Deslizantes (Rolling Windows):**
   - Reducción de la ventana histórica a **1 año** para capturar con máxima frescura la dinámica del mercado actual.
   - Entrenamiento con **Walk-Forward Rolling Windows** (ventanas deslizantes de 90 días de entrenamiento desplazándose mes a mes) para simular la evolución real del bot.
3. **Inclusión de la Categoría como Feature ($X$):**
   - La `Categoria` (`Sweet Spot`, `Cazador Dips`, `Recup. Rapida`, `Cuchillos Cayendo`) se codifica como variable categórica explícita (One-Hot / LightGBM categorical) dentro de la matriz de entrenamiento $X$.
4. **Visualización y Gráficos MLOps:**
   - Generación automática de gráficos en PNG dentro de `Modelos/`:
     - `Modelos/feature_importance.png`: Importancia de características (incluyendo Categoría).
     - `Modelos/curva_roc_pr.png`: Curva ROC y Curva Precision-Recall.
     - `Modelos/rolling_window_performance.png`: Desempeño acumulado de Win Rate en las ventanas deslizantes.

---

## 📁 Estructura del Pipeline (`flujo_ml/` y `Modelos/`)

```
inversion_bot/
├── Modelos/                              <-- Artefactos, gráficos y modelos
│   ├── lightgbm_v2.pkl
│   ├── modelo_metadata.json
│   ├── reglas_extraidas.json
│   ├── feature_importance.png           <-- Gráfico de importancia de variables
│   ├── curva_roc_pr.png                 <-- Gráfico ROC / Precision-Recall
│   └── rolling_window_performance.png   <-- Gráfico de ventanas deslizantes
└── flujo_ml/
    ├── 1_extraer_dataset.py              <-- 100 activos, 1 año, Categoría como Feature
    ├── 2_entrenar_lightgbm.py            <-- LightGBM + Ventanas Deslizantes + Gráficos
    ├── 3_evaluar_y_reglas.py             <-- Extracción de reglas e indicadores
    └── 4_inferencia_oraculo.py           <-- Inferencia sobre mercado diario
```

---

## 📌 Ejecución por Etapas

### Etapa 1: Ingesta de 100 Activos (1 Año) (`flujo_ml/1_extraer_dataset.py`)
- Universo: 100 tickers.
- Período: 1 año.
- Features ($X$): Indicadores técnicos (RSI, SMA, EMA, ATR, RVOL) + `Categoria` (One-Hot Encoded) + `Consecutive_Oversold_Days`.

### Etapa 2: Entrenamiento con Ventanas Deslizantes & Gráficos (`flujo_ml/2_entrenar_lightgbm.py`)
- Walk-forward rolling windows a través de los 12 meses.
- Generación y guardado de `feature_importance.png` y `curva_roc_pr.png`.

### Etapa 3: Evaluación Financiera & Reglas (`flujo_ml/3_evaluar_y_reglas.py`)
- Evaluación del Win Rate y Sharpe Ratio sobre las ventanas de prueba.
- Generación del gráfico `rolling_window_performance.png`.

### Etapa 4: Inferencia Web & Serving (`flujo_ml/4_inferencia_oraculo.py`)
- Evaluación sobre el estado actual del mercado.
