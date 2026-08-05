---
name: supabase-vercel-deploy
description: Guía integral y patrones de producción para desplegar aplicaciones monorepo con Supabase (Auth, RLS, PostgreSQL) y Vercel (Vite React SPA + Python Serverless Functions / Static SPA). Usa esta skill siempre que el usuario trabaje con Supabase, Vercel, configure RLS, resuelva errores de Vercel Build (como 500MB bundle size, vite command not found, proxy ECONNREFUSED, SPA routing /index.html, o bucles en npm install).
---

# 🚀 Skill: Supabase & Vercel Monorepo Mastery

Esta skill condensa las mejores prácticas, patrones de arquitectura y resolución de errores aprendidos para construir y desplegar aplicaciones full-stack con **Supabase** (Base de Datos + Auth + RLS) y **Vercel** (Frontend Vite/React + Entrypoint Flask ultraliviano de 2MB + Inferencia ML en GitHub Actions).

---

## 🏛️ 1. Arquitectura de Supabase (Auth & Row Level Security - RLS)

### 1.1 Configuración del Cliente JS (`frontend/src/lib/supabaseClient.js`)
- **⚠️ REGLA DE GIT CRÍTICA:** Asegúrate de que `frontend/src/lib/` NO esté ignorado por `.gitignore` (evitar reglas globales como `lib/` en Python `.gitignore` agregando `!frontend/src/lib/`).

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
```

### 1.2 Patrón de Tablas y Políticas RLS (`supabase/migrations/0001_init.sql`)
Asegura aislamiento estricto por usuario autenticado (`auth.uid()`) y soporte para Modo Demo / Invitados (`user_id IS NULL`).

```sql
-- Habilitar RLS
ALTER TABLE activos ENABLE ROW LEVEL SECURITY;

-- Política 1: Usuarios autenticados solo ven y modifican sus propias filas
CREATE POLICY "Acceso total para usuario propietario"
  ON activos FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Política 2: Permitir lecturas y escrituras anónimas para Modo Demo
CREATE POLICY "Acceso para usuarios anónimos en modo demo"
  ON activos FOR ALL
  TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);
```

### 1.3 Regla de Cuentas Nuevas vs Cuentas Semilla (Zustand Store)
- Las cuentas de **nuevos usuarios registrados** deben iniciar 100% vacías (`entries: []`).
- La autosiembra de portafolios de ejemplo solo debe aplicar para el usuario maestro o en Modo Demo.

---

## ⚡ 2. Arquitectura de Vercel (SPA Estática + Entrypoint Flask Ultraliviano)

### 2.1 Patrón de Entrypoint de 2MB (Ponytail Philosophy)
Para satisfacer la detección de Python en Vercel sin rebasar el límite de 500MB:
1. **Entrypoint `api/index.py` ultraliviano:** Contiene solo `Flask` y `flask-cors` (peso total: 2MB). Sin dependencias pesadas como `pandas` o `yfinance`.
2. **GitHub Actions MLOps:** Corre la inferencia pesada de ML diariamente y guarda resultados en **Supabase DB**.
3. **Frontend React SPA:** Despliegue estático ultra-liviano (build en 2 segundos).

### 2.2 Configuración de `vercel.json`
```json
{
  "buildCommand": "npm --prefix frontend i && npm --prefix frontend run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.py"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 2.3 Root `package.json` de Orquestación
```json
{
  "name": "inversion-bot",
  "private": true,
  "version": "1.0.0",
  "workspaces": [
    "frontend"
  ],
  "scripts": {
    "build": "npm --prefix frontend i && npm --prefix frontend run build"
  }
}
```

---

## 🛠️ 3. Matriz de Solución de Errores Frecuentes

| Síntoma / Error | Causa Raíz | Solución Definitiva |
| :--- | :--- | :--- |
| `No python entrypoint found` | Vercel detectó Python pero `api/` estaba ignorado en `.vercelignore`. | Exponer `api/index.py` con Flask ultraliviano (2MB sin pandas). |
| `Could not resolve "../lib/supabaseClient"` | `.gitignore` en Python ignoró la carpeta `lib/`. | Agregar `!frontend/src/lib/` en `.gitignore`. |
| `Total bundle size (509MB) exceeds max 500MB` | Dependencias pesadas de Python (`pandas`) en Vercel. | Usar `Flask` puro (2MB) + Supabase + MLOps en GitHub Actions. |
| `ENOENT: open .../frontend/package.json` | Se colocó `frontend/` completo en `.vercelignore`. | Ignorar `Modelos/`, pero MANTENER `frontend/` en `.vercelignore`. |
| `sh: line 1: vite: command not found` | Vercel no vinculó el PATH binario local en monorepo. | Usar `npx vite build` y `"workspaces": ["frontend"]`. |
| Bucle infinito de 10 min en Build | Script con `cd frontend && npm install` recursivo. | Usar `"build": "npm --prefix frontend i && npm --prefix frontend run build"`. |

---

## 📋 4. Lista de Chequeo de Despliegue (Checklist)

- [ ] ¿`api/index.py` existe y solo usa Flask (2MB)?
- [ ] ¿`frontend/src/lib/supabaseClient.js` está rastreado en Git (`git ls-files`)?
- [ ] ¿`.gitignore` contiene `!frontend/src/lib/`?
- [ ] ¿`vercel.json` sirve SPA estática con rewrites a `/index.html`?
- [ ] ¿El build local finalizó limpiamente en ~2 segundos?
