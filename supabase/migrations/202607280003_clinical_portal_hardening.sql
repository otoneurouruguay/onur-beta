-- El primer acceso temporal solo permite cambiar el PIN.
-- Toda lectura o escritura clínica exige una cuenta habilitada y con PIN definitivo.

create or replace function public.is_patient_self(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.patients patient
    join public.patient_portal_accounts account
      on account.patient_id = patient.id
     and account.auth_user_id = patient.auth_user_id
    where patient.id = target_patient_id
      and patient.auth_user_id = auth.uid()
      and account.auth_user_id = auth.uid()
      and account.enabled = true
      and account.must_change_pin = false
      and (account.locked_until is null or account.locked_until <= now())
  );
$$;

revoke all on function public.is_patient_self(uuid) from public;
grant execute on function public.is_patient_self(uuid) to authenticated;

drop policy if exists patients_self_select on public.patients;
create policy patients_self_select on public.patients
for select to authenticated using (public.is_patient_self(id));

drop policy if exists patient_assessments_patient_select on public.patient_assessments;
create policy patient_assessments_patient_select on public.patient_assessments
for select to authenticated using (public.is_patient_self(patient_id));

-- La versión anterior no aplica el control del PIN y ya no es usada por el cliente.
revoke execute on function public.complete_session_assignment(uuid, integer, integer, jsonb) from authenticated;

-- Permite eliminar la cuenta Auth del paciente sin borrar el historial de auditoría.
alter table public.audit_events
  drop constraint if exists audit_events_actor_user_id_fkey;
alter table public.audit_events
  add constraint audit_events_actor_user_id_fkey
  foreign key (actor_user_id) references auth.users (id) on delete set null;

create or replace function public.interrupt_session_assignment(
  target_assignment_id uuid,
  active_seconds_input integer,
  skipped_count_input integer,
  initial_discomfort_input integer,
  event_log_input jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_patient_id uuid;
  execution_id uuid;
begin
  if active_seconds_input is null or active_seconds_input not between 0 and 86400
    or skipped_count_input is null or skipped_count_input not between 1 and 100 then
    raise exception 'Datos de ejecución fuera de rango.' using errcode = '22023';
  end if;
  if initial_discomfort_input is null or initial_discomfort_input not between 0 and 10 then
    raise exception 'El malestar inicial debe estar entre 0 y 10.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(event_log_input, '[]'::jsonb)) <> 'array'
    or pg_column_size(coalesce(event_log_input, '[]'::jsonb)) > 32768 then
    raise exception 'Registro de eventos no válido.' using errcode = '22023';
  end if;

  select assignment.patient_id
  into target_patient_id
  from public.session_assignments assignment
  where assignment.id = target_assignment_id
    and public.is_patient_self(assignment.patient_id)
    and assignment.status in ('assigned', 'started')
    and assignment.available_from <= now()
    and (assignment.status = 'started' or assignment.available_until is null or assignment.available_until >= now())
  for update;

  if target_patient_id is null then
    raise exception 'Asignación no disponible.' using errcode = '42501';
  end if;

  insert into public.session_executions (
    assignment_id, patient_id, status, finished_at, active_seconds,
    initial_discomfort, event_log
  ) values (
    target_assignment_id, target_patient_id, 'partial', now(),
    greatest(0, active_seconds_input), initial_discomfort_input,
    coalesce(event_log_input, '[]'::jsonb)
  ) returning id into execution_id;

  update public.session_assignments
  set status = 'partial'
  where id = target_assignment_id;

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'session_interrupted', 'session_assignment', target_assignment_id,
    jsonb_build_object(
      'status', 'partial',
      'active_seconds', greatest(0, active_seconds_input),
      'skipped_exercises', greatest(1, skipped_count_input)
    )
  );

  return execution_id;
end;
$$;

revoke all on function public.interrupt_session_assignment(uuid, integer, integer, integer, jsonb) from public;
grant execute on function public.interrupt_session_assignment(uuid, integer, integer, integer, jsonb) to authenticated;
