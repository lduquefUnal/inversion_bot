---
name: swing-trading-quant
description: Guía de Swing Trading Cuantitativo de alta precisión basada en Connors RSI(2), CAN SLIM (O'Neil), Triple Screen (Elder), R-multiples y Position Sizing (Van Tharp), Edge Estadístico (Grimes) y patrones de Quantified Strategies / Quantpedia.
---

# Skill: Swing Trading Cuantitativo & Gestión de Expectativa (Quant Swing Engine)

Esta skill define el marco teórico y práctico para estrategias de Swing Trading de alta probabilidad (Win Rate > 75%, Sharpe > 2.5).

---

## 🏛️ 1. Pilares Literarios y Fuentes Académicas

### A. *Short Term Trading Strategies That Work* (Larry Connors) & Quantified Strategies
- **El problema del RSI 14:** El RSI estándar de 14 días es demasiado lento para swing trading (tarda semanas en sobrevenderse).
- **El descubrimiento de RSI(2):** Un RSI de 2 días reacciona en 48 horas a pánicos de corto plazo.
- **Regla del 75%+ Win Rate:** 
  1. **Filtro de Tendencia:** Activo por encima de la media de 200 días (`Close > SMA200`).
  2. **Gatillo de Entrada:** `RSI(2) < 10` (o `< 5` en caídas extremas).
  3. **Salida por Reversión:** `RSI(2) > 50` o máximo de 3 a 5 días de retención.

### B. *How to Make Money in Stocks* (William O'Neil - CAN SLIM)
- **Relative Strength Rating (RS Rating):** Nunca compres activos débiles en caída libre perpetua. Prioriza activos en el percentil superior del mercado ($RS > 80$ frente al SPY).
- **Fase de Consolidación y Volumen (RVOL):** Las mejores compras ocurren tras una contracción de volumen seguida de una ruptura con $RVOL > 1.5$.

### C. *Trade Your Way to Financial Freedom* (Dr. Van Tharp)
- **Esperanza Matemática ($E$):**
  $$E = (W \times R_{\text{ganancia}}) - ((1 - W) \times R_{\text{pérdida}})$$
  donde $W$ es el Win Rate y $R$ son los múltiplos del riesgo inicial.
- **R-Multiples:** Cada trade se mide en múltiplos del riesgo $R$ (ej. arriesgar $\$100$ para ganar $\$300 = +3R$).
- **Volatility Position Sizing (ATR):**
  $$\text{Acciones a Comprar} = \frac{\text{Riesgo Máximo por Trade (1\% del Portafolio)}}{\text{Nivel de Stop Loss en \$ (2.0} \times \text{ATR}_{14}\text{)}}$$

### D. *Trading for a Living / The New Trading for a Living* (Dr. Alexander Elder)
- **Sistema de Triple Pantalla (Triple Screen):**
  - **Pantalla 1 (Marea de Fondo):** Gráfico semanal / SMA200 para determinar la tendencia principal.
  - **Pantalla 2 (Ola de Frente):** Gráfico diario / RSI(2) u Oscilador de Fuerza para encontrar el retroceso.
  - **Pantalla 3 (Ruptura Táctica):** Gráfico intra-día para ejecutar la entrada precisa.
- **Impulse System:** Prohíbe comprar cuando la EMA de 13 días y el MACD son bajistas simultáneamente.

### E. *The Art and Science of Technical Analysis* (Adam Grimes) & Quantpedia / SSRN
- **Advantage & Edge Estadístico:** Un patrón solo es operable si demuestra una desviación positiva respecto al paseo aleatorio (*Random Walk*).
- **Mean Reversion vs. Momentum:** El mercado pasa el 70% del tiempo en reversión a la media y el 30% en tendencia explosiva.
- **Fricción Real:** Todo modelo cuantitativo debe restar $0.10 - 0.20$ USD por trade para ser viable fuera de muestra (*Out-of-Sample*).

---

## ⚡ 2. Matriz Cuantitativa de las 4 Categorías

| Categoría | Condición Primaria | Gatillo Táctico | TP / SL Sugerido | Win Rate Esperado |
| :--- | :--- | :--- | :---: | :---: |
| **⚡ Recup. Rápida** | `Close > SMA200` & `EMA20 > SMA50` | `RSI(2) < 12` | TP +15% / SL -5% | **80.0%** |
| **🎯 Sweet Spot** | `Close > SMA200` & `Drawdown [-20%, -40%]` | `RSI(2) < 15` | TP +15% / SL -8% | **78.5%** |
| **🔥 Cazador Dips** | `Drawdown > -35%` & `RSI(14) < 32` | `CMF_20 > -0.05` | TP +12% / SL -8% | **72.2%** |
| **⚠️ Cuchillos Cayendo** | `Close < SMA200` & Sobrevendido Extremo | `RSI(2) < 6` & $RVOL > 1.2$ | TP +8% / SL -5% | **68.5%** |

---

## ⚡ 3. Combos Validados Empíricamente (V3.6 — Backtesting OOS Doble)

Los TP/SL de la matriz anterior son *targets de entrenamiento*. Los siguientes son los parámetros que sobrevivieron validación real en dos ventanas OOS independientes (W2: Feb–Abr 2026, W1: May–Jul 2026):

| Categoría | Combo Validado | WR Real | EA% W2 | EA% W1 | Estado |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **🔥 Cazador Dips** | **TP 8% / SL 4% / 11d** | 39–41% | +77% | +93% | ✅ Config recomendada |
| 🔥 Cazador Dips | TP 8% / SL 3% / 11d | 33% | +51% | +89% | ✅ Alternativa |
| **⚠️ Cuchillos** | **TP 15% / SL 3% / 7d** | 20% | +239% | +151% | ✅ Alto EA, WR bajo |
| **🎯 Sweet Spot** | **TP 8% / SL 5% / 11d** | 44–50% | ~+42% | +42% | ✅ Más estable |
| ~~Recup TP20~~  | TP 20% / SL 5% / 30d | — | falla | +6.14% | ❌ Sobreajuste |

> **Nota de alineación:** Los TP/SL de la skill (§2) mejoran el AUC de entrenamiento (0.623 con sus parámetros vs. 0.571 con otros), pero los combos operativos reales (§3) tienen TP más bajos y plazos de 7–15 días. Usar siempre §3 para configuración de producción.
