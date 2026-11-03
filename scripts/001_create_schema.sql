-- Consultorio Dental · Dra. Laura
-- Esquema para el Dashboard de Recordatorios y Confirmaciones por WhatsApp

create extension if not exists btree_gist;

-- ─── Tipos ────────────────────────────────────────────────────────────────
-- appointment_status refleja 1:1 el tipo ReminderStatus del frontend
create type public.appointment_status as enum (
  'pending',    -- Pendiente de envío
  'sending',    -- Enviando ahora
  'sent',       -- Enviado (sin respuesta)
  'confirmed',  -- Confirmado
  'cancelled',  -- Cancelado / Reagendar
  'completed'   -- Finalizada
);

create type public.staff_role as enum ('doctor', 'assistant');
create type public.message_direction as enum ('outbound', 'inbound');
create type public.message_kind as enum ('reminder', 'resend', 'reply', 'reschedule_notice');
create type public.message_delivery as enum ('queued', 'sent', 'delivered', 'read', 'failed', 'received');

-- ─── Utilidades ───────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Personal del consultorio ─────────────────────────────────────────────
create table public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.staff_role not null default 'assistant',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.id = auth.uid() and s.is_active
  );
$$;

-- ─── Pacientes ────────────────────────────────────────────────────────────
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'), -- formato E.164 para WhatsApp
  email text,
  notes text,
  whatsapp_opt_in boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patients_full_name_idx on public.patients (lower(full_name));

create trigger patients_set_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

-- ─── Catálogo de tratamientos ─────────────────────────────────────────────
create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  duration_minutes integer not null default 60 check (duration_minutes between 10 and 480),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── Citas ────────────────────────────────────────────────────────────────
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'pending',
  google_event_id text unique,                 -- id del evento en Google Calendar
  last_message_at timestamptz,
  reminder_attempts integer not null default 0 check (reminder_attempts >= 0),
  rescheduled_from uuid references public.appointments(id) on delete set null,
  cancel_reason text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_time_range_chk check (ends_at > starts_at),
  -- Evita empalmar dos citas activas en el mismo horario
  constraint appointments_no_overlap exclude using gist (
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status not in ('cancelled', 'completed'))
);

create index appointments_starts_at_idx on public.appointments (starts_at);
create index appointments_patient_idx on public.appointments (patient_id);
create index appointments_status_idx on public.appointments (status);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- Sella automáticamente las fechas de confirmación / cancelación / finalización
create or replace function public.stamp_appointment_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'confirmed' then new.confirmed_at = coalesce(new.confirmed_at, now()); end if;
    if new.status = 'cancelled' then new.cancelled_at = coalesce(new.cancelled_at, now()); end if;
    if new.status = 'completed' then new.completed_at = coalesce(new.completed_at, now()); end if;
  end if;
  return new;
end;
$$;

create trigger appointments_stamp_status
  before update on public.appointments
  for each row execute function public.stamp_appointment_status();

-- ─── Historial de mensajes de WhatsApp ────────────────────────────────────
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  direction public.message_direction not null,
  kind public.message_kind not null,
  body text not null,
  provider_message_id text unique,             -- id devuelto por la API de WhatsApp
  delivery_status public.message_delivery not null default 'queued',
  error text,
  sent_by uuid references public.staff(id) on delete set null, -- null = envío automático
  created_at timestamptz not null default now()
);

create index whatsapp_messages_appointment_idx
  on public.whatsapp_messages (appointment_id, created_at desc);

-- ─── Vista que consume el dashboard ───────────────────────────────────────
create view public.dashboard_appointments
with (security_invoker = true) as
select
  a.id,
  p.full_name as patient_name,
  p.phone,
  t.name as treatment,
  a.starts_at,
  a.ends_at,
  a.status,
  a.last_message_at,
  a.reminder_attempts
from public.appointments a
join public.patients p on p.id = a.patient_id
join public.treatments t on t.id = a.treatment_id;

-- ─── Row Level Security: solo personal activo del consultorio ─────────────
alter table public.staff enable row level security;
alter table public.patients enable row level security;
alter table public.treatments enable row level security;
alter table public.appointments enable row level security;
alter table public.whatsapp_messages enable row level security;

create policy staff_select on public.staff for select to authenticated using (public.is_staff());
create policy staff_update_self on public.staff for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy patients_all on public.patients for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy treatments_select on public.treatments for select to authenticated using (public.is_staff());
create policy treatments_write on public.treatments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy appointments_all on public.appointments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy whatsapp_messages_select on public.whatsapp_messages for select to authenticated
  using (public.is_staff());
create policy whatsapp_messages_insert on public.whatsapp_messages for insert to authenticated
  with check (
    public.is_staff()
    and exists (select 1 from public.appointments a where a.id = appointment_id)
  );

-- ─── Catálogo inicial ─────────────────────────────────────────────────────
insert into public.treatments (name, duration_minutes) values
  ('Limpieza dental', 45),
  ('Revisión general', 30),
  ('Resina', 60),
  ('Endodoncia', 90),
  ('Extracción', 60),
  ('Blanqueamiento', 60),
  ('Ajuste de ortodoncia', 30),
  ('Corona dental', 90)
on conflict (name) do nothing;
