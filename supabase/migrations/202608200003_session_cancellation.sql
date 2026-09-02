-- Diferencia una sesión no realizada de una anulación por error.

alter table public.session_assignments
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users (id),
  add column if not exists cancellation_reason text;

update public.session_assignments set
  cancelled_at = coalesce(cancelled_at, created_at),
  cancelled_by = coalesce(cancelled_by, assigned_by),
  cancellation_reason = case when char_length(btrim(coalesce(cancellation_reason, ''))) between 3 and 500
    then btrim(cancellation_reason) else 'Cancelación anterior sin motivo estructurado' end
where status = 'omitted';

create or replace function public.fill_session_cancellation_audit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'omitted' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.cancelled_by := coalesce(new.cancelled_by, auth.uid(), new.assigned_by);
    new.cancellation_reason := coalesce(nullif(btrim(new.cancellation_reason), ''), 'Cancelación registrada durante la ejecución');
  elsif tg_op = 'UPDATE' and old.status = 'omitted' and new.status <> 'omitted' then
    new.cancelled_at := null;
    new.cancelled_by := null;
    new.cancellation_reason := null;
  end if;
  return new;
end;
$$;

drop trigger if exists session_assignments_fill_cancellation on public.session_assignments;
create trigger session_assignments_fill_cancellation
before insert or update of status, cancellation_reason on public.session_assignments
for each row execute function public.fill_session_cancellation_audit();

alter table public.session_assignments
  drop constraint if exists session_assignment_cancellation_consistency;
alter table public.session_assignments
  add constraint session_assignment_cancellation_consistency check (
    (status <> 'omitted' and cancelled_at is null and cancelled_by is null and cancellation_reason is null)
    or
    (status = 'omitted' and cancelled_at is not null and cancelled_by is not null and char_length(btrim(cancellation_reason)) between 3 and 500)
  );

create or replace function public.cancel_session_assignment(
  target_assignment_id uuid,
  cancellation_reason_input text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assignment_row public.session_assignments%rowtype;
  clean_reason text := btrim(coalesce(cancellation_reason_input, ''));
begin
  if auth.uid() is null or not public.is_professional() then
    raise exception 'Esta acción requiere una sesión profesional.' using errcode = '42501';
  end if;
  if char_length(clean_reason) < 3 or char_length(clean_reason) > 500 then
    raise exception 'Ingresá un motivo de cancelación entre 3 y 500 caracteres.' using errcode = '22023';
  end if;

  select assignment.* into assignment_row
  from public.session_assignments assignment
  where assignment.id = target_assignment_id
    and public.owns_patient(assignment.patient_id)
    and assignment.status in ('assigned', 'started')
  for update;

  if assignment_row.id is null then
    raise exception 'La sesión ya no está pendiente.' using errcode = '42501';
  end if;

  update public.session_executions set
    status = 'omitted',
    finished_at = coalesce(finished_at, now()),
    professional_observation = concat_ws(E'\n', nullif(professional_observation, ''), 'Sesión no realizada: ' || clean_reason),
    event_log = event_log || jsonb_build_array(jsonb_build_object('type', 'session_cancelled', 'at', now()))
  where assignment_id = target_assignment_id and finished_at is null;

  update public.session_assignments set
    status = 'omitted',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = clean_reason
  where id = target_assignment_id;

  update public.quest_session_pairings set status = 'revoked', updated_at = now()
  where assignment_id = target_assignment_id and status in ('ready', 'claimed');

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'session_assignment_cancelled', 'session_assignment', target_assignment_id,
    jsonb_build_object('patient_id', assignment_row.patient_id, 'reason', clean_reason, 'previous_status', assignment_row.status));
end;
$$;

revoke all on function public.cancel_session_assignment(uuid, text) from public;
grant execute on function public.cancel_session_assignment(uuid, text) to authenticated;

comment on function public.cancel_session_assignment(uuid, text)
is 'Registra una sesión como no realizada/cancelada; no la confunde con anulación por error.';
