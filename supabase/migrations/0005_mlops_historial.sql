-- ==============================================================================
-- Migración Supabase: Tabla MLOps Historial (Audit Trail de Modelos y Versiones)
-- ==============================================================================

create table if not exists public.mlops_historial (
  version_id text primary key,
  fecha timestamptz not null default now(),
  payload jsonb not null
);

-- Habilitar Row Level Security (RLS)
alter table public.mlops_historial enable row level security;

-- Limpiar políticas anteriores si existen
drop policy if exists "Lectura publica en mlops_historial" on public.mlops_historial;

-- Política de RLS: Lectura pública (anon / authenticated), escritura por service_role
create policy "Lectura publica en mlops_historial"
on public.mlops_historial for select
using (true);
