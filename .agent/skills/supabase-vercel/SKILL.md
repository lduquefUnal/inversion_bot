---
name: supabase-vercel-deploy
description: Guía integral y patrones de producción para desplegar aplicaciones monorepo con Supabase (Auth, RLS, PostgreSQL) y Vercel (Vite React SPA + Python Serverless Functions). Usa esta skill siempre que el usuario trabaje con Supabase, Vercel, configure RLS, resuelva errores de Vercel Build (como 500MB bundle size, vite command not found, proxy ECONNREFUSED, SPA routing /index.html, o bucles en npm install).
---

# 🚀 Skill: Supabase & Vercel Monorepo Mastery

Esta skill condensa las mejores prácticas, patrones de arquitectura y resolución de errores aprendidos para construir y desplegar aplicaciones full-stack con **Supabase** (Base de Datos + Auth + RLS) y **Vercel** (Frontend Vite/React + API Serverless Python).

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

## ⚡ 2. Arquitectura de Vercel Monorepo (Vite React + Python API)

### 2.1 Configuración Moderna de `vercel.json` (Sin `builds` Obsoletos)
> ⚠️ **NUNCA uses la propiedad deprecada `"builds": [...]`**. Genera advertencias y bucles de compilación.

```json
{
  "buildCommand": "npm --prefix frontend run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index.py"
    },
    {
      "source": "/imagen/(.*)",
      "destination": "/api/index.py"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 2.2 Root `package.json` de Orquestación
Evita bucles de instalación recursivos usando `npm --prefix`:

```json
{
  "name": "inversion-bot",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "build": "npm --prefix frontend run build"
  }
}
```

### 2.3 `package.json` del Frontend (`frontend/package.json`)
> ⚠️ **CRÍTICO PARA VERCEL:** `vite` y `@vitejs/plugin-react` DEBEN estar en `dependencies` (no en `devDependencies`), de lo contrario Vercel `npm install` omitirá Vite durante el build de producción (`command not found`).

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.109.0",
    "@tanstack/react-query": "^5.99.0",
    "@vitejs/plugin-react": "^4.7.0",
    "framer-motion": "^12.38.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.14.1",
    "vite": "^5.4.21",
    "zustand": "^5.0.12"
  }
}
```

---

## 📦 3. Optimización del Límite de 500MB en Serverless Functions (`.vercelignore`)

Vercel empaqueta todo el directorio raíz en el ZIP de la función Serverless de Python a menos que se excluya en `.vercelignore`. 

### `.vercelignore` de Producción:
```gitignore
# Excluir carpetas pesadas para mantener la función de Python por debajo de 5MB
Modelos/*.csv
Modelos/*.pkl
Modelos/*.joblib
flujo_ml/
flujo/
.agent/
.git/
.pytest_cache/
node_modules/
frontend/node_modules/
*.log
*.png
*.jpg
*.jpeg
*.svg
```
> ⚠️ **REGLA DE ORO:** NUNCA escribas `frontend/` en `.vercelignore` (solo `frontend/node_modules/`), de lo contrario Vercel eliminará el código fuente de tu React SPA antes del build.

---

## 🛠️ 4. Matriz de Solución de Errores Frecuentes

| Síntoma / Error | Causa Raíz | Solución Definitiva |
| :--- | :--- | :--- |
| `Could not resolve "../lib/supabaseClient"` | `.gitignore` en Python ignoró la carpeta `lib/`. | Agregar `!frontend/src/lib/` en `.gitignore`. |
| `Total bundle size (512MB) exceeds max 500MB` | Vercel metió `frontend/` y `Modelos/` al zip de Python. | Excluir `Modelos/*.joblib` y `frontend/node_modules/` en `.vercelignore`. |
| `ENOENT: open .../frontend/package.json` | Se colocó `frontend/` completo en `.vercelignore`. | Remover `frontend/` de `.vercelignore` (mantener solo `frontend/node_modules/`). |
| `vite: command not found` en Vercel | `vite` estaba en `devDependencies` y npm ignoró en prod. | Mover `vite` a `dependencies` en `frontend/package.json`. |
| Bucle infinito de 10 min en Build | Script con `cd frontend && npm install` recursivo. | Usar `"build": "npm --prefix frontend run build"`. |
| Proxy `ECONNREFUSED` en terminal Vite | Proxy local apuntando a puerto 5000 sin Flask activo. | Limpiar proxy innecesario en `vite.config.js` y hacer fallback en cliente. |
| SPA 404 en subrutas (`/portfolio`) | Falta rewrite de fallback a `index.html`. | Configurar `{"source": "/(.*)", "destination": "/index.html"}` en `vercel.json`. |

---

## 📋 5. Lista de Chequeo de Despliegue (Checklist)

- [ ] ¿`frontend/src/lib/supabaseClient.js` está incluido en Git (`git ls-files`)?
- [ ] ¿`.gitignore` contiene `!frontend/src/lib/`?
- [ ] ¿`vite` y `@vitejs/plugin-react` están en `dependencies` en `frontend/package.json`?
- [ ] ¿`vercel.json` usa `npm --prefix frontend run build` y rewrites a `/index.html`?
- [ ] ¿`.vercelignore` excluye `Modelos/*.joblib` pero MANTIENE el código fuente de `frontend/`?
- [ ] ¿El merge entre `developer` y `main` se probó localmente con `npm run build`?
