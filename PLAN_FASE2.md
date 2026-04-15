# 🚀 Plan de Trabajo — InversionBot Fase 2
**Versión:** 2.0 Final — 14 Abril 2026
**Rama de trabajo:** `developer`
**Rama de producción:** `master`

---

## 📌 Estado Fase 1 (Base — Ya Completada)

| Componente | Estado |
|---|---|
| Pipeline yfinance + Reddit + Polymarket | ✅ |
| Matriz Ponderada V2 (5 factores, Score 0-100) | ✅ |
| DCA escalonado $80/$100/$120 por nivel de dip | ✅ |
| Categorías visuales ⚡🎯🔥⚠️ con filtros | ✅ |
| Cambio 5D con indicador verde/rojo | ✅ |
| Banner "Pulso Social" (noticias Reddit estético) | ✅ |
| Fix fecha correcta en Vercel (via JSON interno) | ✅ |
| Fix Polymarket sin datos deportivos | ✅ |
| GitHub Actions a las 6am diario | ✅ |
| Bot Telegram conversacional (Gemini) | ✅ |
| Rama `developer` creada | ✅ |

---

## 🏛️ Arquitectura Definitiva

```
GitHub Actions (6am diario)
  └── Pipeline Python → mercado.json + PNGs → push a master

Repositorio GitHub (rama master)
  └── flujo_datos/mercado.json   ← fuente de verdad
  └── flujo_datos/top_N_XYZ.png ← gráficas actuales

Vercel (producción — apunta a master, no se toca aún)
  ├── /api/index.py              ← Flask actual (Telegram + imágenes)
  └── /api/historico?ticker=X   ← NUEVO endpoint (yfinance 1 ticker, ~3s)

Vercel (preview — rama developer)
  └── /frontend/                 ← Vite + React (TODO el trabajo nuevo)
```

**Decisión clave:** Vercel NO puede correr el pipeline Python de 200+ activos (timeout 10s). GitHub Actions es irremplazable para eso. El endpoint `/api/historico` sí puede correr en Vercel porque solo consulta 1 ticker (~3s).

---

## 🗺️ Etapas del Plan (Para Tu Revisión)

---

### ✅ ETAPA 0 — Setup Inicial
**Objetivo:** Dejar el entorno listo para desarrollar.
**Duración estimada:** 1-2 días

**Tareas:**
- [x] Crear rama `developer` en GitHub
- [ ] Inicializar Vite + React en `/frontend`
- [ ] Instalar dependencias clave (React Router, Zustand, React Query, TradingView Charts, Framer Motion)
- [ ] Configurar CSS variables con el tema oscuro actual
- [ ] Primer commit a `developer` con el scaffolding

**Criterio de aprobación:** `npm run dev` en `/frontend` carga una página en blanco con el tema oscuro correcto.

---

### 🔲 ETAPA 1 — Dashboard (Reproducir Vista Actual en React)
**Objetivo:** El dashboard principal debe verse igual al actual pero en React.
**Duración estimada:** 5-7 días

**Componentes a construir:**
- `Header.jsx` — Logo, fecha del último escáner, VIX/USD-COP/Fear&Greed
- `MacroBar.jsx` — Badges de macro (VIX, COP, F&G)
- `FilterBar.jsx` — Botones de categoría ⚡🎯🔥⚠️
- `StrategySelector.jsx` — Selector de estrategia (solo "Valiente" activo por ahora)
- `AssetCard.jsx` — Card clickeable → navega a `/activo/:ticker`
- `AssetGrid.jsx` — Grid de 25 cards con filtrado
- `useMarketData.js` — Hook que hace fetch de `mercado.json` desde GitHub Raw

**En el prototipo:**
- Las cards usan las **imágenes PNG actuales** (no gráficas interactivas aún)
- Los datos vienen del mismo `mercado.json` que ya existe

**Criterio de aprobación:** El dashboard se ve igual o mejor al actual. Las cards muestran los 25 activos con score, categoría, DIP, cambio 5D y noticias. Los filtros funcionan.

---

### 🔲 ETAPA 2 — Endpoint Histórico + Gráfica Interactiva
**Objetivo:** Al hacer click en una card, llevar al usuario a una página de detalle con gráfica interactiva a 5 años.
**Duración estimada:** 7-10 días

**Backend (Flask):**
- Nuevo endpoint `GET /api/historico?ticker=TSLA&period=1A`
- Retorna OHLCV en JSON para TradingView
- Periodos: `1S / 1M / 3M / 1A / 3A / 5A`

**Frontend (React):**
- `DetailPage.jsx` — Página en ruta `/activo/:ticker`
- `CandleChart.jsx` — Gráfica de velas con TradingView Lightweight Charts
- `TimeframeBar.jsx` — Botones de periodo (1S/1M/3M/1A/3A/5A)
- `IndicatorBar.jsx` — Toggles: ✅ SMA50 / ✅ SMA200 / ☐ Bollinger / ✅ Volumen
- `CompareBar.jsx` — Normalizado a %: ☐ S&P500 / ☐ Nasdaq / ☐ Oro / ☐ Bitcoin
- `MetricsBadges.jsx` — RSI, P/E, Score, Cambio 5D
- `NewsPanel.jsx` — Noticias Reddit (reutilizar lógica actual)
- `useHistorico.js` — Hook que llama `/api/historico` con caché

**Criterio de aprobación:**
- Click en una card → lleva a `/activo/TSLA`
- Gráfica de velas interactiva carga en <5s
- Los 6 periodos de tiempo cambian la gráfica
- SMA50 y SMA200 se ven como líneas sobre las velas
- Al activar "Oro", aparece una línea normalizada a % sobre la gráfica

---

### 🔲 ETAPA 3 — Monetización y Pulido Visual
**Objetivo:** Añadir donaciones y afiliados. Pulir la experiencia visual.
**Duración estimada:** 3-5 días

**Tareas:**
- `DonationBanner.jsx` — Solo visible al llegar al final del scroll
  - Botón PayPal (`paypal.me/...`)
  - Panel QR expandible (Nequi/Bancolombia) — espacio reservado para agregar imagen QR
  - Texto "Invítame a un café ☕"
- `AfiliadoPanel.jsx` — Placeholder en la página de detalle (botones de broker, sin links reales aún)
- Animaciones con Framer Motion en cards y transiciones de página
- Responsive mobile (breakpoints para pantallas pequeñas)
- SEO básico: meta tags, title, Open Graph por activo

**Criterio de aprobación:**
- El banner de donación aparece solo al hacer scroll hasta el final
- El QR se expande/colapsa con un click
- Las animaciones de las cards no causan lag
- Funciona bien en móvil

---

### 🔲 ETAPA 4 — Estrategias Adicionales
**Objetivo:** Agregar 2 estrategias adicionales al `StrategySelector`.
**Duración estimada:** Pendiente (se define la lógica cuando se decida)

**Estrategias planificadas:**

| Estrategia | Descripción | Estado |
|---|---|---|
| 🔥 **Valiente** | Dips >40%, alto riesgo/recompensa | ✅ Activa |
| 🎯 **Smart DCA Moderado** | Dips 20-40%, SMA200 alcista obligatorio | 🔲 Por definir |
| 🛡️ **Conservador** | Solo ETFs y Blue Chips, dip leve <20% | 🔲 Por definir |

**Diseño extensible preparado:**
```javascript
// Agregar estrategia = agregar un objeto aquí, sin tocar más código
export const STRATEGIES = {
  valiente: { available: true, filter: (a) => ... },
  moderado:  { available: false, filter: (a) => ... },  // se activa al definir filtro
  conservador: { available: false, filter: (a) => ... }
}
```

**Criterio de aprobación:** Al seleccionar "Moderado" en el selector, el grid filtra solo los activos que cumplen sus criterios.

---

### 🔲 ETAPA 5 — Deploy y Puesta en Producción
**Objetivo:** Hacer merge a `master` y configurar Vercel para el nuevo frontend.
**Duración estimada:** 1-2 días

**Tareas:**
- Configurar Vercel: Framework = Vite, Root Directory = `frontend`
- Actualizar `vercel.json` para que el Flask y el React convivan
- PR `developer` → `master` con revisión
- Validar que GitHub Actions sigue corriendo en `master` sin cambios
- Deploy final y pruebas en producción

**Criterio de aprobación:**
- La URL de producción de Vercel muestra el nuevo dashboard React
- El bot de Telegram sigue funcionando
- GitHub Actions sigue corriendo a las 6am

---

## 🧩 Todos los Componentes (Lista completa)

```
frontend/src/components/
├── layout/
│   ├── Header.jsx              ← Logo, fecha, indicadores macro
│   └── Footer.jsx              ← Créditos + DonationBanner
├── dashboard/
│   ├── MacroBar.jsx            ← VIX, USD/COP, Fear & Greed
│   ├── FilterBar.jsx           ← Filtros por categoría
│   ├── StrategySelector.jsx    ← Valiente / Moderado / Conservador
│   ├── AssetGrid.jsx           ← Contenedor del grid
│   └── AssetCard.jsx           ← Card individual (clickeable)
├── detail/
│   ├── DetailPage.jsx          ← Página /activo/:ticker
│   ├── CandleChart.jsx         ← TradingView Lightweight Charts
│   ├── TimeframeBar.jsx        ← 1S/1M/3M/1A/3A/5A
│   ├── IndicatorBar.jsx        ← SMA50/SMA200/Bollinger toggles
│   ├── CompareBar.jsx          ← vs índices normalizados a %
│   ├── MetricsBadges.jsx       ← RSI, P/E, Score, Cambio 5D
│   └── NewsPanel.jsx           ← Noticias Reddit con links
└── monetization/
    ├── AfiliadoPanel.jsx       ← Botones de broker (placeholder)
    └── DonationBanner.jsx      ← PayPal + QR expandible
```

---

## 📅 Cronograma Resumido

| Etapa | Duración | Entregable |
|---|---|---|
| 0 — Setup | 1-2 días | Vite + React corriendo localmente |
| 1 — Dashboard | 5-7 días | Dashboard igual al actual en React |
| 2 — Detalle + Gráfica | 7-10 días | Página detalle con gráfica interactiva 5 años |
| 3 — Monetización + Pulido | 3-5 días | Donaciones, animaciones, mobile |
| 4 — Estrategias | TBD | 2 estrategias adicionales activas |
| 5 — Deploy | 1-2 días | En producción en Vercel |
| **Total** | **~4-5 semanas** | |

---

## ❓ Pendiente de tu parte

- [ ] Confirmar tu link de PayPal (`paypal.me/???`)
- [ ] Imagen QR de Nequi/Bancolombia cuando estés listo
- [ ] Definir la lógica de las 2 estrategias adicionales (Etapa 4)
- [ ] Dar visto bueno a cada Etapa antes de pasar a la siguiente
