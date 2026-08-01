---
name: quant-risk-management
description: Guía cuantitativa para Position Sizing, Stop Loss ATR, Trailing Stop, Exit Strategies, Portfolio Management y Métricas de Rendimiento Financiero (Sharpe, Sortino, Calmar, Expectancy, Max DD).
---

# Skill: Gestión Cuantitativa de Riesgo & Métricas de Desempeño (Quant Risk Engine)

Esta skill define las reglas de dimensionamiento de posición, salidas tácticas y métricas financieras para el bot de inversión.

## 1. Position Sizing (Dimensionamiento de Posición)
- **Criterio de Kelly Modificado ($f^*$):**
  $$f^* = p - \frac{1 - p}{b}$$
  donde $p$ es la probabilidad predicha por LightGBM y $b$ es la relación beneficio/riesgo (TP / SL). Para evitar sobre-apalancamiento, se aplica Half-Kelly ($f^* / 2$).
- **Paridad por Volatilidad (ATR Sizing):**
  $$\text{Capital por Operación (\%)} = \min\left(20\%, \frac{\text{Riesgo Máximo (2\%)}}{\text{ATR}_{14}\%}\right)$$

## 2. Stop Loss & Take Profit Dinámicos
- **Stop Loss Basado en ATR:** $SL = \text{Precio Entrado} - (2.0 \times \text{ATR}_{14})$.
- **Trailing Stop Dinámico:** Si la ganancia supera el +5%, el Stop Loss sube a $\text{Máximo Alcanzado} - (1.5 \times \text{ATR}_{14})$.

## 3. Exit Strategies (Estrategias de Salida)
- **Por Tiempo:** Límite máximo de retención según categoría (7, 14 o 21 días).
- **Por Volatilidad:** Cierre si la volatilidad ATR aumenta más de un 50% en caída.
- **Por Cruce Técnico:** Salida prematura si `EMA_20` cruza a la baja la `SMA_50`.

## 4. Portfolio Management (Gestión Global de Portafolio)
- **Posiciones Simultáneas:** Máximo 5 posiciones abiertas activas al mismo tiempo (20% de capital por posición).
- **Enfriamiento DCA (Cooldown):** Mínimo 3 días entre compras acumulativas sobre la misma acción.

## 5. Métricas de Rendimiento Cuantitativo (Performance Metrics)
- **Sharpe Ratio:** $\frac{R_p - R_f}{\sigma_p}$ (Ratio de retorno ajustado por volatilidad total).
- **Sortino Ratio:** $\frac{R_p - R_f}{\sigma_{\text{downside}}}$ (Retorno ajustado solo por volatilidad bajista).
- **Profit Factor:** $\frac{\text{Ganancias Brutas}}{\text{Pérdidas Brutas}}$.
- **Expectancy (Esperanza Matemática por Trade):**
  $$E = (p \times \text{Ganancia Promedio}) - ((1 - p) \times \text{Pérdida Promedio})$$
- **Maximum Drawdown (Max DD \%):** Caída máxima desde el pico patrimonial histórico.
- **CAGR:** Tasa de Crecimiento Anual Compuesto.
- **Calmar Ratio:** $\frac{\text{CAGR}}{\text{Max Drawdown}}$.
