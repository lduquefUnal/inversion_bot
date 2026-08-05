---
name: supabase-vercel-deploy
description: Guía integral y patrones de producción para desplegar aplicaciones monorepo con Supabase (Auth, RLS, PostgreSQL) y Vercel (Vite React SPA + Python Serverless Functions / Static SPA). Usa esta skill siempre que el usuario trabaje con Supabase, Vercel, configure RLS, resuelva errores de Vercel Build (como 500MB bundle size, vite command not found, proxy ECONNREFUSED, SPA routing /index.html, o bucles en npm install).
---

# 🚀 Skill: Supabase & Vercel Monorepo Mastery

Esta skill condensa las mejores prácticas, patrones de arquitectura y resolución de errores aprendidos para construir y desplegar aplicaciones full-stack con **Supabase** (Base de Datos + Auth + RLS) y **Vercel** (Frontend Vite/React + Inferencia ML en GitHub Actions).

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

## ⚡ 2. Arquitectura de Vercel (SPA Estática + Inferencia MLOps en GitHub Actions)

### 2.1 Patrón Arquitectónico de Cero Límite Serverless (Ponytail Philosophy)
Para evitar que librerías pesadas de Python (`pandas`, `scipy`, `yfinance`) excedan el límite de 500MB de las Serverless Functions de Vercel:
1. **GitHub Actions MLOps:** Corre la inferencia de ML diariamente y guarda los resultados en **Supabase DB** o `flujo_datos/`.
2. **Frontend React SPA en Vercel:** Consume Supabase directamente para Auth/DB y CoinGecko/Yahoo Proxy para precios.
3. **Vercel Deployment:** Despliegue estático ultra-liviano (0MB de funciones serverless, build en 3 segundos).

### 2.2 Configuración de `vercel.json` Estático
```json
{
  "buildCommand": "npm --prefix frontend i && npm --prefix frontend run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [
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

### 2.4 `frontend/package.json` con `npx`
> ⚠️ `vite` y `@vitejs/plugin-react` DEBEN estar en `dependencies` y usarse mediante `npx vite build`.

```json
{
  "scripts": {
    "build": "mkdir -p public && (cp ../flujo_datos/*.json public/ 2>/dev/null || true) && npx vite build"
  }
}
```

---

## 🛠️ 3. Matriz de Solución de Errores Frecuentes

| Síntoma / Error | Causa Raíz | Solución Definitiva |
| :--- | :--- | :--- |
| `Could not resolve "../lib/supabaseClient"` | `.gitignore` en Python ignoró la carpeta `lib/`. | Agregar `!frontend/src/lib/` en `.gitignore`. |
| `Total bundle size (509MB) exceeds max 500MB` | Dependencias pesadas de Python (`pandas`) en Vercel. | Migrar a SPA Estática Pura en Vercel + Supabase + MLOps en GitHub Actions. |
| `ENOENT: open .../frontend/package.json` | Se colocó `frontend/` completo en `.vercelignore`. | Ignoar `api/` y `Modelos/`, pero MANTENER `frontend/` en `.vercelignore`. |
| `sh: line 1: vite: command not found` | Vercel no vinculó el PATH binario local en monorepo. | Usar `npx vite build` y `"workspaces": ["frontend"]`. |
| Bucle infinito de 10 min en Build | Script con `cd frontend && npm install` recursivo. | Usar `"build": "npm --prefix frontend i && npm --prefix frontend run build"`. |
| Proxy `ECONNREFUSED` en terminal Vite | Proxy local apuntando a puerto 5000 sin Flask activo. | Limpiar proxy innecesario en `vite.config.js` y hacer fallback en cliente. |

---

## 📋 4. Lista de Chequeo de Despliegue (Checklist)

- [ ] ¿`frontend/src/lib/supabaseClient.js` está rastreado en Git (`git ls-files`)?
- [ ] ¿`.gitignore` contiene `!frontend/src/lib/`?
- [ ] ¿`vercel.json` sirve SPA estática con rewrites a `/index.html`?
- [ ] ¿El frontend consume Supabase para DB/Auth y CoinGecko/Yahoo para precios en vivo?
- [ ] ¿El build local finalizó limpiamente en ~2 segundos?
