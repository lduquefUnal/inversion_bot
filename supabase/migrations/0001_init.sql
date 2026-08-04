-- ==============================================================================
-- Migración Inicial Supabase: Activos, Compras (Lotes) y RLS con Soporte Demo / Login
-- ==============================================================================

create extension if not exists "uuid-ossp";

-- 1. Tabla de Activos (Posiciones)
create table if not exists public.activos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  ticker text not null,
  nombre text not null,
  categoria text not null default '🎯 Sweet Spot',
  creado_en timestamptz default now()
);

alter table public.activos alter column user_id drop not null;

-- 2. Tabla de Compras (Lotes de cada activo)
create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  activo_id uuid not null references public.activos(id) on delete cascade,
  precio_compra numeric(18,6) not null,
  cantidad numeric(18,6) not null,
  fecha_compra date not null default current_date,
  nota text,
  creado_en timestamptz default now()
);

alter table public.compras alter column user_id drop not null;

-- Habilitar Row Level Security (RLS)
alter table public.activos enable row level security;
alter table public.compras enable row level security;

-- Limpiar políticas anteriores
drop policy if exists "Acceso exclusivo por user_id en activos" on public.activos;
drop policy if exists "Permitir acceso publico en activos" on public.activos;
drop policy if exists "Acceso por usuario en activos" on public.activos;

drop policy if exists "Acceso exclusivo por user_id en compras" on public.compras;
drop policy if exists "Permitir acceso publico en compras" on public.compras;
drop policy if exists "Acceso por usuario en compras" on public.compras;

-- Política de RLS para Activos:
-- Si el usuario inició sesión -> solo accede/modifica sus propios registros (user_id = auth.uid()).
-- Si no inició sesión (Modo Demo) -> solo accede/modifica registros donde user_id IS NULL.
create policy "Acceso por usuario en activos"
on public.activos for all
using (
  (auth.uid() is not null and user_id = auth.uid())
  or
  (auth.uid() is null and user_id is null)
)
with check (
  (auth.uid() is not null and user_id = auth.uid())
  or
  (auth.uid() is null and user_id is null)
);

-- Política de RLS para Compras:
create policy "Acceso por usuario en compras"
on public.compras for all
using (
  (auth.uid() is not null and user_id = auth.uid())
  or
  (auth.uid() is null and user_id is null)
)
with check (
  (auth.uid() is not null and user_id = auth.uid())
  or
  (auth.uid() is null and user_id is null)
);
