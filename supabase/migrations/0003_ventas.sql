-- ==============================================================================
-- Migración Supabase: Tabla de Ventas (Trades Cerrados / P&L Realizado)
-- ==============================================================================

-- La posición se mantiene en activos mientras tenga lotes vigentes.
-- Cada venta queda registrada en ventas; el estado de la posición
-- (abierta/cerrada) se deriva de compras vs ventas.
create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  activo_id uuid references public.activos(id) on delete set null,
  ticker text not null,
  nombre text,
  categoria text,
  precio_venta numeric(18,6) not null,
  cantidad numeric(18,6) not null,
  fecha_venta date not null default current_date,
  tipo_salida text not null default 'MANUAL',
  nota text,
  creado_en timestamptz default now()
);

alter table public.ventas alter column user_id drop not null;

alter table public.ventas enable row level security;

drop policy if exists "Acceso por usuario en ventas" on public.ventas;

create policy "Acceso por usuario en ventas"
on public.ventas for all
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

create index if not exists idx_ventas_activo on public.ventas(activo_id);
create index if not exists idx_ventas_user on public.ventas(user_id);