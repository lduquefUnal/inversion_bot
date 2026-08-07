# ⚡ Plan de Trabajo: Optimización MLOps & Sync Supabase en Tiempo Real

> **Filosofía Ponytail:** Múltiples ejecuciones diarias ligeras, cero commits automatizados al repo, cero costos de IA en pipeline, sincronización limpia vía Supabase REST API y almacenamiento de histórico para calibración MLOps.

---

## 🎯 Objetivo General
1. Reducir el tiempo de ejecución del workflow de GitHub Actions de **~12 min a ~2 min**.
2. Aumentar la frecuencia de inferencia a **4 veces al día** durante horario bursátil sin exceder límites de API ni generar spam de commits en Git.
3. Almacenar cada inferencia en **Supabase (`public.predicciones`)** como auditoría histórica (JSONB) para alimentar el análisis ETL / MLOps futuro.
4. Conectar el frontend Vite directamente a Supabase con fallback local resiliente.

---

## 🛠️ Arquitectura del Pipeline Optimizado

```mermaid
flowchart LR
    A[Cron GH Actions 4x/día] --> B[paso1_descargar.py --ligero]
    B --> C[4_inferencia_oraculo.py]
    C --> D[utils/publicar_supabase.py]
    D -->|PostgREST HTTP POST| E[(Supabase Table: predicciones)]
    E -->|select latest| F[Frontend Vite / useMarketData.js]
```

---

## 📋 Componentes y Cambios Mínimos Viables (MVC)

### 1. 🗄️ Supabase Migration
**Archivo:** `supabase/migrations/0002_predicciones.sql`
- **Tabla:** `public.predicciones`
- **Estructura:**
  - `fecha` (`timestamptz primary key default now()`)
  - `payload` (`jsonb not null`)
- **RLS:** Lectura pública habilitada (`for select using (true)`). La escritura es realizada por `service_role` desde GitHub Actions.

### 2. ⚡ Extracción Ligera de Datos
**Archivo:** `flujo/paso1_descargar.py`
- Agregar flag CLI `--ligero` mediante `argparse`.
- Envolver la generación de gráficos `mplfinance` y descarga de noticias Yahoo/Reddit (líneas 310-425) dentro de `if not args.ligero:`.
- Mantiene intacta la descarga de precios e indicadores técnicos esenciales para los modelos ML.

### 3. 📤 Publicación Directa REST a Supabase
**Archivo:** `utils/publicar_supabase.py` (~35 líneas, `urllib.request` nativo de Python)
- Lee `flujo_datos/predicciones_v2.json`.
- Sanitiza `NaN` / `Infinity` a `null` para compatibilidad estricta con PostgreSQL `jsonb`.
- Ejecuta HTTP `POST` a `{SUPABASE_URL}/rest/v1/predicciones` con cabeceras:
  - `apikey: SUPABASE_SERVICE_ROLE_KEY`
  - `Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY`
  - `Content-Type: application/json`
  - `Prefer: resolution=merge-duplicates`
- Payload: `{"fecha": timestamp_utc, "payload": datos_json}`.

### 4. 🤖 Workflow GitHub Actions Simplificado
**Archivo:** `.github/workflows/orquestador_acciones.yml`
- **Cron:** `0 13,16,19,21 * * 1-5` (4x/día de Lunes a Viernes, en rango de pre-market a cierre de NYSE/NASDAQ).
- **Pasos Eliminados:** Gemini (`paso2_analizar.py`), Telegram bot en cron y el `Auto-Commit / Push` a git.
- **Flujo Nuevo:**
  1. `python flujo/paso1_descargar.py --ligero`
  2. `python flujo_ml/4_inferencia_oraculo.py`
  3. `python utils/publicar_supabase.py`
- **Secrets requeridos:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### 5. 🌐 Conexión Frontend (Vite + React)
**Archivo:** `frontend/src/hooks/useMarketData.js`
- Modificar el hook para consultar la última fila de Supabase si `isSupabaseConfigured` es `true`:
  ```javascript
  const { data } = await supabase
    .from('predicciones')
    .select('payload, fecha')
    .order('fecha', { ascending: false })
    .limit(1)
    .single();
  ```
- Fallback automático a `fetch('/predicciones_v2.json')` si Supabase no está disponible.

---

## ⚡ Análisis Ponytail (Pros, Riesgos y Mejoras Clave)

| Criterio | Diagnóstico | Mejora Aplicada |
| :--- | :--- | :--- |
| **Tiempo de Ejecución** | Pasa de ~12 min a ~2 min. | Al no generar 50 gráficos PNG ni scrap de noticias. |
| **Integridad Git** | Desaparecen ~120 commits/mes de JSON blobs. | Repo más limpio y cero deploys redundantes en Vercel. |
| **MLOps / Historico** | Se crea una serie de tiempo en DB (`fecha` + `payload`). | Permite auditar la evolución de scores e inferencias pasadas. |
| **Consumo de yfinance** | 4 ejecuciones/día = ~800 peticiones diarias. | Dentro del margen seguro de Yahoo Finance (<2000/día). |
| **Sanitización de Datos** | PostgreSQL `jsonb` rechaza `NaN` o `Infinity`. | `publicar_supabase.py` convierte `NaN`/`Inf` a `null` antes del POST. |

---

## 📌 Pasos para la Implementación (Next Steps)
1. Crear la migración SQL `supabase/migrations/0002_predicciones.sql`.
2. Modificar `flujo/paso1_descargar.py` para soportar `--ligero`.
3. Crear el script `utils/publicar_supabase.py`.
4. Actualizar `.github/workflows/orquestador_acciones.yml`.
5. Actualizar `frontend/src/hooks/useMarketData.js`.
6. Configurar secrets en GitHub Repository Settings (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
