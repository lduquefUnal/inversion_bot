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
