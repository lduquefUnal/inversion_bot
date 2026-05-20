# 🚀 Plan de Trabajo — InversionBot Fase 3: MVP Personal (El Oráculo)
**Versión:** 3.1 — Mayo 2026  
**Objetivo:** Construir una sección privada y oculta dentro de la plataforma web pública, donde puedas gestionar y monitorear tu portafolio personal con recomendaciones inteligentes de HOLD / WATCH / SELL. Sin base de datos por ahora.

---

## 🎯 Filosofía del MVP

La web pública muestra el Dashboard de mercado general para cualquier visitante.  
El MVP **es una capa invisible dentro de la misma web**, que se activa con un PIN.  
Una vez dentro, el sistema cruza tus posiciones personales con los datos de `mercado.json` y te da un semáforo operativo.

**El flujo completo:**
```
Tú (PIN) → Ingresas posiciones (ticker + precio de compra + cantidad)
         → El sistema las cruza con mercado.json (Precio actual + RSI + SMA + Score)  
         → Oráculo calcula veredicto: 🟢 HOLD / 🟡 WATCH / 🔴 SELL  
         → Muestra justificación y P&L en tiempo real
```

---

## 📦 Lo que ya existe hoy (Punto de partida)

**Backend disponible:**
- `flujo_datos/mercado.json` → ~50 activos con: `Precio Actual`, `RSI 14D`, `Drawdown 52W %`, `Score_Total`, `Tipo_Dip`, `Categoria`, `Tendencias`
- `flujo_datos/ultimo_reporte.md` → Tesis completa en Markdown generada por Gemini
- `/api/index.py` → Flask en Vercel, con endpoint GET que sirve el dashboard público

**Frontend disponible:**
- React + Vite en `/frontend/src`
- `react-router-dom` v7 (routing ya instalado)
- `zustand` (estado global ya instalado)
- `framer-motion` (animaciones disponibles)
- `lightweight-charts` (gráficas de velas disponibles)

**GitHub Actions:**
- `orquestador_acciones.yml` → Actualiza `mercado.json` diariamente a las ~6AM

---

## 🔒 Etapa 1 — Acceso Privado por PIN (Sin servidor adicional)

**Objetivo:** Aislar la sección personal del público.  
**Estrategia:** PIN validado 100% en el cliente (frontend). El portafolio se guarda en `localStorage` encrip­tado con el PIN como llave. Nadie sin el PIN puede leer el portafolio aunque inspeccione el navegador.

**Tareas:**
- [ ] Variable de entorno `VITE_APP_PIN_HASH` (hash SHA-256 del PIN) generada una vez y puesta en `.env.local` (nunca se sube a Git).
- [ ] Pantalla de login minimalista en ruta `/oracle` (oculta, sin enlace público).
- [ ] Store Zustand `useAuthStore` con estado `isAuthenticated`.
- [ ] Al ingresar PIN: hashear con `crypto.subtle` del browser y comparar con `VITE_APP_PIN_HASH`.
- [ ] Ruta protegida: si no está autenticado en `/oracle`, redirige a `/oracle/login`.

**Criterio:** Un visitante al ir a `/oracle` sin PIN solo ve la pantalla de login, sin pistas de qué hay adentro.

> **Nota de seguridad MVP:** El hash del PIN en `VITE_APP_PIN_HASH` estará en el bundle de Vercel (visible si alguien lo busca). Para uso personal es suficiente. Si se quiere mayor seguridad luego, se delega la validación a un endpoint `/api/oracle/auth` que compare contra `APP_PIN` en las variables de entorno de Vercel (el secreto nunca sale del servidor).

---

## 🗂️ Etapa 2 — Gestión de Posiciones (localStorage, sin DB)

**Objetivo:** Ingresar y persistir el portafolio personal entre sesiones sin servidor ni base de datos.

**Estructura del portafolio (`localStorage` → clave: `oracle_portfolio`):**
```json
[
  { "id": "uuid", "ticker": "EC", "precioCompra": 15.20, "cantidad": 10, "fechaCompra": "2025-11-03" },
  { "id": "uuid", "ticker": "PLTR", "precioCompra": 22.50, "cantidad": 5, "fechaCompra": "2025-09-15" }
]
```

**Tareas:**
- [ ] Store Zustand `usePortfolioStore` que lee/escribe en `localStorage`.
- [ ] Formulario para agregar posición: dropdown de tickers del `mercado.json` + precio de compra + cantidad + fecha.
- [ ] Botón para eliminar posición.
- [ ] Los datos persisten entre sesiones siempre que estés en el mismo navegador.

**Criterio:** Agrego `EC` a $15.20 × 10 acciones, cierro el navegador, vuelvo con PIN y sigue ahí.

---

## 📊 Etapa 3 — Vista de Portafolio con P&L en Tiempo Real

**Objetivo:** Visualizar el rendimiento cruzando tus posiciones con el `mercado.json` actual.

**Cálculos por posición:**
| Campo | Fórmula |
|---|---|
| Precio Actual | `mercado.json → Ticker → Precio Actual` |
| Ganancia/Pérdida $ | `(Precio Actual - Precio Compra) × Cantidad` |
| Ganancia/Pérdida % | `((Precio Actual / Precio Compra) - 1) × 100` |
| Cambio 5D % | `mercado.json → Ticker → Cambio 5D %` |
| RSI | `mercado.json → Ticker → RSI 14D` |
| Score Bot | `mercado.json → Ticker → Score_Total` |

**Tareas:**
- [ ] Tabla/Cards de posiciones con colores verde/rojo dinámicos.
- [ ] Widget de resumen: valor total invertido, valor actual, P&L total en $ y %.
- [ ] Indicador de cuándo fue el último escáner (fecha de `mercado.json`).

**Criterio:** Puedo ver de un vistazo si voy ganando o perdiendo en cada posición.

---

## 🧠 Etapa 4 — El Oráculo (Algoritmo HOLD / WATCH / SELL)

**Objetivo:** Recibir veredictos automáticos por activo basados en la lógica Valiente.

**Lógica del Oráculo (sin IA externa, puramente algorítmica):**

| Señal | Umbrales | Peso |
|---|---|---|
| RSI extendido | RSI > 70 → venta técnica cercana | Alta |
| Score bajo | Score_Total < 50 → deterioro de fundamentos | Alta |
| Drawdown revertido | Precio Actual > Precio Compra × 1.40 (+40%) | Media |
| Tendencia | `Tendencias == "Bajista (Cuchillo)"` | Media |
| Cambio 5D | Cambio_5D% < -8 → posible aceleración bajista | Baja |

**Veredictos:**
- 🟢 **HOLD:** Todo dentro de parámetros normales. Estrategia DCA en curso.
- 🟡 **WATCH:** 1-2 señales se activan. Monitorear. Considerar toma parcial de ganancias.
- 🔴 **SELL:** 3+ señales activas O RSI > 75 O ganancia > 50%. Salida estratégica recomendada.

**Justificación dinámica:** El Oráculo genera un texto explicativo por activo en base a las señales activas.  
Ejemplo: *"RSI en 78 (extensión técnica). Tu ganancia acumulada es +42%. Considera tomar ganancias parciales."*

**Tareas:**
- [ ] Función `calcularOraculo(posicion, datosJson)` → retorna `{ veredicto, señalesActivas, justificacion }`.
- [ ] Badge de color (`HOLD/WATCH/SELL`) visible en cada card del portafolio.
- [ ] Panel dedicado `/oracle/veredictos` con solo los activos en estado WATCH o SELL.

**Criterio:** Si PLTR tiene RSI 78 y subi un 45%, aparece en rojo con justificación clara.

---

## 🔭 Etapa 5 (Futura) — Conección a Broker API

Una vez el MVP funciona bien, el Oráculo podrá enviar órdenes reales. El diseño del MVP ya anticipa esto:

- El `usePortfolioStore` tendrá un campo `modo: "manual" | "automatico"`.
- En modo `automatico`, cuando el Oráculo detecte `SELL`, llamará a `/api/oracle/execute` con la orden.
- El endpoint de Vercel delegará la operación a la API del Broker (Alpaca, Interactive Brokers, etc.).
- El usuario configura límites: `maxPorOperacion`, `stopLoss`, `takeProfitTarget` desde el panel de configuración.

---

## 🛠️ Stack Técnico del MVP

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | React 19 + Vite (ya instalado) | Ya existe, no reemplazar |
| Estado Global | Zustand (ya instalado) | Portfolio + Auth |
| Persistencia | `localStorage` | Sin DB, suficiente para MVP personal |
| Datos de Mercado | `mercado.json` (commit diario de GitHub Actions) | Ya funciona |
| Privacidad | PIN hasheado en cliente (SHA-256 WebCrypto) | Sin servidor extra |
| Routing | react-router-dom v7 (ya instalado) | Rutas protegidas `/oracle/*` |
| Animaciones | framer-motion (ya instalado) | UX premium |

---

## 📋 Orden de Implementación (Secuencia recomendada)

```
1. Etapa 1 → Login PIN + rutas protegidas /oracle/*
2. Etapa 2 → Formulario de posiciones + localStorage
3. Etapa 3 → Cruce con mercado.json + P&L visual
4. Etapa 4 → Algoritmo Oráculo + badges semáforo
5. Etapa 5 → (Futuro) Broker API + modo automático
```

---

## ❓ Para arrancar con código ahora necesito saber:

1. [ ] ¿El frontend de `/frontend/src` ya tiene componentes o está en blanco? (revisar `pages/` y `components/`)
2. [ ] ¿Tienes posiciones reales que quieras cargar? (tickers + precio de compra aproximado)
3. [ ] ¿Confirmas que `mercado.json` se actualiza regularmente o está desfasado?
