-- ==============================================================================
-- Migración Supabase: Tabla de Predicciones del Modelo ML (MLOps Audit Trail)
-- ==============================================================================

create table if not exists public.predicciones (
  fecha timestamptz primary key default now(),
  payload jsonb not null
);

-- Habilitar Row Level Security (RLS)
alter table public.predicciones enable row level security;

-- Limpiar políticas anteriores si existen
drop policy if exists "Lectura publica en predicciones" on public.predicciones;
drop policy if exists "Lectura publica" on public.predicciones;

-- Política de RLS: Lectura pública (anon / authenticated), escritura por service_role
create policy "Lectura publica en predicciones"
on public.predicciones for select
using (true);
