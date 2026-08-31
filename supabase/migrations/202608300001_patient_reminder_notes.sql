create table if not exists public.patient_reminder_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  body text not null,
  created_by uuid not null references auth.users (id),
  updated_by uuid not null references auth.users (id),
  archived_at timestamptz,
  archived_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_reminder_notes_body_length check (char_length(btrim(body)) between 1 and 1500),
  constraint patient_reminder_notes_archive_consistency check (
    (archived_at is null and archived_by is null)
    or (archived_at is not null and archived_by is not null)
  )
);

comment on table public.patient_reminder_notes is
  'Recordatorios opcionales y privados del profesional. No forman parte automática de evaluaciones, sesiones ni informes.';

create index if not exists patient_reminder_notes_active_patient_idx
on public.patient_reminder_notes (patient_id, updated_at desc)
where archived_at is null;

drop trigger if exists patient_reminder_notes_set_updated_at on public.patient_reminder_notes;
create trigger patient_reminder_notes_set_updated_at
before update on public.patient_reminder_notes
for each row execute function public.set_updated_at();

alter table public.patient_reminder_notes enable row level security;

drop policy if exists patient_reminder_notes_professional_select on public.patient_reminder_notes;
create policy patient_reminder_notes_professional_select
on public.patient_reminder_notes
for select to authenticated
using (public.is_professional() and public.owns_patient(patient_id));

drop policy if exists patient_reminder_notes_professional_insert on public.patient_reminder_notes;
create policy patient_reminder_notes_professional_insert
on public.patient_reminder_notes
for insert to authenticated
with check (
  public.is_professional()
  and public.owns_patient(patient_id)
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and archived_at is null
  and archived_by is null
);

drop policy if exists patient_reminder_notes_professional_update on public.patient_reminder_notes;
create policy patient_reminder_notes_professional_update
on public.patient_reminder_notes
for update to authenticated
using (public.is_professional() and public.owns_patient(patient_id))
with check (
  public.is_professional()
  and public.owns_patient(patient_id)
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and (archived_at is null or archived_by = auth.uid())
);

revoke all on public.patient_reminder_notes from anon;
revoke all on public.patient_reminder_notes from authenticated;
grant select, insert on public.patient_reminder_notes to authenticated;
grant update (body, updated_by, archived_at, archived_by) on public.patient_reminder_notes to authenticated;
