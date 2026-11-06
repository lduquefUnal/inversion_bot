# Directrices de Trabajo y Gobernanza para Agentes (Inversion Bot)

Este documento es de **lectura obligatoria** para cualquier agente de IA o desarrollador que trabaje en este repositorio.

---

## 1. Estrategia de Ramas (Branching)

- **`main` (Producción)**:
  - Es la rama en producción activa. Está conectada a los GitHub Actions automáticos (re-entrenamiento, inferencia diaria, sync Supabase) y al despliegue en Vercel.
  - **REGLA DE ORO**: No desarrollar features experimentales directamente en `main`.
  - Solo se mergea a `main` cuando las pruebas locales y la auditoría MLOps pasen al 100%.

- **`developer` (Desarrollo & Experimentos)**:
  - Rama destinada a investigación, refactorizaciones, nuevos modelos, cálculo de Score-RSI y rediseño de UI.
  - Todo cambio nuevo inicia aquí:
    ```bash
    git checkout -b developer
    ```

---

## 2. Protocolo de Pruebas y Validación Pre-Merge

Antes de fusionar cualquier cambio a `main` o desplegar en CI, debes ejecutar:

1. **Prueba de Inferencia y Re-entrenamiento**:
   ```bash
   python3 flujo_ml/v4_entrenar_modelo.py
   python3 flujo_ml/4_inferencia_oraculo.py
   ```
2. **Auditoría de Integridad MLOps**:
   ```bash
   python3 flujo_ml/v4_auditor_agent.py
   ```
   *Debe arrojar `Stage 1: PASS` y `Stage 2: PASS`.*
3. **Verificación de Compilación del Frontend**:
   ```bash
   cd frontend
   npm run build
   cd ..
   ```
   *Debe compilar sin errores de sintaxis o empaquetado.*

---

## 3. Filosofía de Trading V5 (Trii Broker)

- **Órdenes Bracket**: Trii permite definir TP y SL al ingresar la posición.
- **Relación R:R mínima**: 1:2 (TP $\ge +8\%$, SL $\le -4\%$).
- **Filtro Anti-Cuchillos Cayendo**:
  - Jamás entrar a un activo únicamente por sobreventa de RSI o alto Drawdown.
  - Exigir confirmación de giro en precio ($\text{Close}_t > \text{High}_{t-1}$) y $\text{RVOL} \ge 1.20$.
- **Score Momentum**:
  - Evaluar la serie temporal del Score y Score-RSI(3/7) antes de emitir veredicto BUY.

---

## 4. Sub-agentes Recomendados

- `dev-code`: Escribe scripts en `flujo_ml/` o componentes en `frontend/src/`.
- `dev-test`: Ejecuta backtesting cuantitativo y valida que el Win Rate no sufra overfitting.
- `dev-review`: Inspecciona que no haya `KeyError`, NaN no controlados o secretos filtrados antes del commit.
