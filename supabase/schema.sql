-- ==============================================================================
-- RETAFIT · Esquema PostgreSQL y Políticas Row Level Security (RLS) para Supabase
-- Ejecuta este script completo en el SQL Editor de tu proyecto Supabase.
-- ==============================================================================

create extension if not exists "pgcrypto";

-- 1. Perfil personal y objetivos del usuario
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  sex text not null default 'male' check (sex in ('male', 'female')),
  age integer not null default 50 check (age between 14 and 120),
  height_cm numeric(5,1) not null default 172 check (height_cm between 100 and 250),
  reference_weight_kg numeric(5,2) not null default 90 check (reference_weight_kg > 20),
  target_loss_kg numeric(5,2) not null default 15 check (target_loss_kg >= 0),
  target_calories integer not null default 2000 check (target_calories > 0),
  target_protein_g integer not null default 175 check (target_protein_g >= 0),
  target_fat_g integer not null default 60 check (target_fat_g >= 0),
  target_carbs_g integer not null default 190 check (target_carbs_g >= 0),
  estimated_tdee integer not null default 2550 check (estimated_tdee > 0),
  habitual_activity_note text default 'Caminata diaria ~1 h, entrenamiento de fuerza ligero, monitorización con reloj deportivo.',
  last_backup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Registros diarios (valores ausentes se almacenan como NULL, nunca como 0)
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  weight_kg numeric(5,2),
  calories integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  active_calories integer,
  steps integer,
  exercise_type text,
  exercise_duration_min integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_logs_user_date_unique unique (user_id, log_date)
);

-- 3. Registro de medicación (volumen en ml; concentración en mg/ml opcional)
create table if not exists public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  med_date date not null,
  med_name text not null,
  volume_ml numeric(6,3) not null check (volume_ml >= 0),
  concentration_mg_ml numeric(6,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices para consultas rápidas por usuario y fecha
create index if not exists idx_daily_logs_user_date on public.daily_logs (user_id, log_date desc);
create index if not exists idx_medication_logs_user_date on public.medication_logs (user_id, med_date desc);

-- Función y triggers de actualización automática de updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_daily_logs_updated_at on public.daily_logs;
create trigger trg_daily_logs_updated_at
  before update on public.daily_logs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_medication_logs_updated_at on public.medication_logs;
create trigger trg_medication_logs_updated_at
  before update on public.medication_logs
  for each row execute function public.set_updated_at();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS): Aislamiento estricto por usuario
-- ==============================================================================

alter table public.user_profiles enable row level security;
alter table public.daily_logs enable row level security;
alter table public.medication_logs enable row level security;

-- Políticas para user_profiles
drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
  on public.user_profiles for select
  using (auth.uid() = id);

drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own"
  on public.user_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own"
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "user_profiles_delete_own" on public.user_profiles;
create policy "user_profiles_delete_own"
  on public.user_profiles for delete
  using (auth.uid() = id);

-- Políticas para daily_logs
drop policy if exists "daily_logs_select_own" on public.daily_logs;
create policy "daily_logs_select_own"
  on public.daily_logs for select
  using (auth.uid() = user_id);

drop policy if exists "daily_logs_insert_own" on public.daily_logs;
create policy "daily_logs_insert_own"
  on public.daily_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "daily_logs_update_own" on public.daily_logs;
create policy "daily_logs_update_own"
  on public.daily_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "daily_logs_delete_own" on public.daily_logs;
create policy "daily_logs_delete_own"
  on public.daily_logs for delete
  using (auth.uid() = user_id);

-- Políticas para medication_logs
drop policy if exists "medication_logs_select_own" on public.medication_logs;
create policy "medication_logs_select_own"
  on public.medication_logs for select
  using (auth.uid() = user_id);

drop policy if exists "medication_logs_insert_own" on public.medication_logs;
create policy "medication_logs_insert_own"
  on public.medication_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "medication_logs_update_own" on public.medication_logs;
create policy "medication_logs_update_own"
  on public.medication_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "medication_logs_delete_own" on public.medication_logs;
create policy "medication_logs_delete_own"
  on public.medication_logs for delete
  using (auth.uid() = user_id);
