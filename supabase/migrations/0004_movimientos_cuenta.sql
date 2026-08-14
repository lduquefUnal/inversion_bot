-- ==============================================================================
-- Migración Supabase: Movimientos de Capital (Depósitos / Retiros)
-- ------------------------------------------------------------------------------
-- Modela los ingresos/egresos de dinero hacia la cuenta de inversión.
-- Con esto se calcula el capital neto aportado, efectivo en cuenta,
-- patrimonio total y la rentabilidad real (XIRR / retorno sobre capital).
-- ==============================================================================

create table if not exists public.movimientos_cuenta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  tipo text not null check (tipo in ('deposito', 'retiro')),
  monto numeric(18,6) not null check (monto > 0),
  fecha date not null default current_date,
  nota text,
  creado_en timestamptz default now()
);

alter table public.movimientos_cuenta alter column user_id drop not null;

alter table public.movimientos_cuenta enable row level security;

drop policy if exists "Acceso por usuario en movimientos_cuenta" on public.movimientos_cuenta;

create policy "Acceso por usuario en movimientos_cuenta"
on public.movimientos_cuenta for all
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

create index if not exists idx_movimientos_user on public.movimientos_cuenta(user_id);
create index if not exists idx_movimientos_fecha on public.movimientos_cuenta(fecha);