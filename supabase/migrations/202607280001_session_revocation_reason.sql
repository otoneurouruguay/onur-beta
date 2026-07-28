-- Anulación trazable de sesiones. La asignación y sus ejecuciones se conservan.

alter table public.session_assignments
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users (id),
  add column if not exists revoked_reason text;

update public.session_assignments
set
  revoked_at = coalesce(revoked_at, created_at),
  revoked_by = coalesce(revoked_by, assigned_by),
  revoked_reason = case
    when char_length(btrim(coalesce(revoked_reason, ''))) between 8 and 500
      then btrim(revoked_reason)
    else 'Anulación anterior sin motivo registrado'
  end
where status = 'revoked';

alter table public.session_assignments
  drop constraint if exists session_assignments_revocation_complete;

alter table public.session_assignments
  add constraint session_assignments_revocation_complete check (
    (status <> 'revoked' and revoked_at is null and revoked_by is null and revoked_reason is null)
    or
    (status = 'revoked' and revoked_at is not null and revoked_by is not null and char_length(btrim(revoked_reason)) between 8 and 500)
  );

create or replace function public.revoke_session_assignment(
  target_assignment_id uuid,
  revocation_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_row public.session_assignments%rowtype;
  clean_reason text := btrim(coalesce(revocation_reason, ''));
begin
  if auth.uid() is null then
    raise exception 'Sesión profesional no disponible.';
  end if;

  if not public.is_professional() then
    raise exception 'Esta acción requiere un perfil profesional.';
  end if;

  if char_length(clean_reason) < 8 or char_length(clean_reason) > 500 then
    raise exception 'Ingresá un motivo de anulación entre 8 y 500 caracteres.';
  end if;

  select *
  into assignment_row
  from public.session_assignments
  where id = target_assignment_id
  for update;

  if assignment_row.id is null or not public.owns_patient(assignment_row.patient_id) then
    raise exception 'Sesión no encontrada.';
  end if;

  if assignment_row.status = 'revoked' then
    raise exception 'La sesión ya fue anulada.';
  end if;

  update public.session_assignments
  set status = 'revoked',
      revoked_at = now(),
      revoked_by = auth.uid(),
      revoked_reason = clean_reason
  where id = target_assignment_id;

  update public.quest_session_pairings
  set status = 'revoked', updated_at = now()
  where assignment_id = target_assignment_id
    and status in ('ready', 'claimed');

  insert into public.audit_events (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    auth.uid(),
    'session_assignment_revoked',
    'session_assignment',
    target_assignment_id,
    jsonb_build_object(
      'reason', clean_reason,
      'previous_status', assignment_row.status,
      'had_execution', exists (
        select 1 from public.session_executions execution
        where execution.assignment_id = target_assignment_id
      )
    )
  );
end;
$$;

revoke all on function public.revoke_session_assignment(uuid, text) from public;
grant execute on function public.revoke_session_assignment(uuid, text) to authenticated;

comment on function public.revoke_session_assignment(uuid, text)
is 'Anula una sesión sin eliminar su plan ni sus ejecuciones, conserva el motivo y registra auditoría.';
