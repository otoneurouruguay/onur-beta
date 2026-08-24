-- Guarda el cierre supervisado y sus métricas en una sola función security definer.
-- También permite reparar durante 24 horas un cierre que la versión anterior
-- alcanzó a finalizar antes de fallar al escribir las métricas adicionales.

create or replace function public.complete_supervised_in_person_session_v2(
  target_assignment_id uuid,
  active_seconds_input integer,
  skipped_count_input integer default 0,
  peak_discomfort_input integer default null,
  final_discomfort_input integer default null,
  recovery_minutes_input integer default null,
  delayed_response_input text default null,
  progression_decision_input text default null,
  perceived_difficulty_input integer default null,
  patient_comment_input text default null,
  professional_observation_input text default null,
  event_log_input jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_patient_id uuid;
  assignment_status public.session_status;
  execution_id uuid;
  initial_discomfort_value integer;
  final_status public.session_status;
  repairing_previous_close boolean := false;
begin
  if active_seconds_input is null or active_seconds_input not between 0 and 86400
    or skipped_count_input is null or skipped_count_input not between 0 and 100 then
    raise exception 'Datos de ejecución fuera de rango.' using errcode = '22023';
  end if;
  if peak_discomfort_input is null or peak_discomfort_input not between 0 and 10 then
    raise exception 'El máximo malestar debe estar entre 0 y 10.' using errcode = '22023';
  end if;
  if final_discomfort_input is null or final_discomfort_input not between 0 and 10 then
    raise exception 'El malestar final debe estar entre 0 y 10.' using errcode = '22023';
  end if;
  if recovery_minutes_input is not null and recovery_minutes_input not between 0 and 1440 then
    raise exception 'La recuperación debe estar entre 0 y 1440 minutos.' using errcode = '22023';
  end if;
  if perceived_difficulty_input is null or perceived_difficulty_input not between 1 and 5 then
    raise exception 'La dificultad percibida debe estar entre 1 y 5.' using errcode = '22023';
  end if;
  if length(coalesce(delayed_response_input, '')) > 1000 then
    raise exception 'La respuesta tardía supera el máximo de 1000 caracteres.' using errcode = '22023';
  end if;
  if coalesce(progression_decision_input, '') not in ('', 'mantener', 'progresar_una_variable', 'regresar', 'reevaluar') then
    raise exception 'La decisión de progresión no es válida.' using errcode = '22023';
  end if;
  if length(coalesce(patient_comment_input, '')) > 500 then
    raise exception 'El comentario del paciente supera el máximo de 500 caracteres.' using errcode = '22023';
  end if;
  if length(coalesce(professional_observation_input, '')) > 2000 then
    raise exception 'La observación profesional supera el máximo de 2000 caracteres.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(event_log_input, '[]'::jsonb)) <> 'array'
    or pg_column_size(coalesce(event_log_input, '[]'::jsonb)) > 32768 then
    raise exception 'Registro de eventos no válido.' using errcode = '22023';
  end if;

  select assignment_row.patient_id, assignment_row.status
  into target_patient_id, assignment_status
  from public.session_assignments assignment_row
  join public.session_plans plan on plan.id = assignment_row.session_plan_id
  where assignment_row.id = target_assignment_id
    and public.is_professional()
    and public.owns_patient(assignment_row.patient_id)
    and coalesce(plan.plan_definition ->> 'mode', 'home') = 'in_person'
    and assignment_row.status in ('started', 'completed', 'partial')
  for update of assignment_row;

  if target_patient_id is null then
    raise exception 'Asignación presencial no disponible para este profesional.' using errcode = '42501';
  end if;

  if assignment_status = 'started' then
    select execution.id, execution.initial_discomfort
    into execution_id, initial_discomfort_value
    from public.session_executions execution
    where execution.assignment_id = target_assignment_id
      and execution.patient_id = target_patient_id
      and execution.execution_mode = 'in_person'
      and execution.supervised
      and execution.operated_by = auth.uid()
      and execution.finished_at is null
    order by execution.created_at desc
    limit 1
    for update;
  else
    select execution.id, execution.initial_discomfort
    into execution_id, initial_discomfort_value
    from public.session_executions execution
    where execution.assignment_id = target_assignment_id
      and execution.patient_id = target_patient_id
      and execution.execution_mode = 'in_person'
      and execution.supervised
      and execution.operated_by = auth.uid()
      and execution.finished_at >= now() - interval '24 hours'
      and execution.peak_discomfort is null
    order by execution.finished_at desc
    limit 1
    for update;
    repairing_previous_close := execution_id is not null;
  end if;

  if execution_id is null or initial_discomfort_value is null then
    raise exception 'No existe un cierre presencial pendiente para esta sesión.' using errcode = '42501';
  end if;

  final_status := case when greatest(0, skipped_count_input) > 0
    then 'partial'::public.session_status
    else 'completed'::public.session_status
  end;

  update public.session_executions
  set status = final_status,
      finished_at = case when repairing_previous_close then finished_at else now() end,
      active_seconds = greatest(0, active_seconds_input),
      peak_discomfort = peak_discomfort_input,
      final_discomfort = final_discomfort_input,
      recovery_minutes = recovery_minutes_input,
      delayed_response = nullif(btrim(coalesce(delayed_response_input, '')), ''),
      progression_decision = nullif(btrim(coalesce(progression_decision_input, '')), ''),
      perceived_difficulty = perceived_difficulty_input,
      patient_comment = nullif(btrim(coalesce(patient_comment_input, '')), ''),
      professional_observation = nullif(btrim(coalesce(professional_observation_input, '')), ''),
      event_log = case when repairing_previous_close
        then event_log
        else event_log || coalesce(event_log_input, '[]'::jsonb)
      end
  where id = execution_id;

  update public.session_assignments set status = final_status where id = target_assignment_id;

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    case when repairing_previous_close
      then 'supervised_in_person_session_close_repaired'
      else 'supervised_in_person_session_finished_v2'
    end,
    'session_assignment',
    target_assignment_id,
    jsonb_build_object(
      'execution_id', execution_id,
      'patient_id', target_patient_id,
      'mode', 'in_person',
      'supervised', true,
      'status', final_status,
      'repairing_previous_close', repairing_previous_close,
      'skipped_exercises', greatest(0, skipped_count_input),
      'initial_discomfort', initial_discomfort_value,
      'peak_discomfort', peak_discomfort_input,
      'final_discomfort', final_discomfort_input,
      'perceived_difficulty', perceived_difficulty_input
    )
  );

  return execution_id;
end;
$$;

revoke all on function public.complete_supervised_in_person_session_v2(uuid, integer, integer, integer, integer, integer, text, text, integer, text, text, jsonb) from public;
grant execute on function public.complete_supervised_in_person_session_v2(uuid, integer, integer, integer, integer, integer, text, text, integer, text, text, jsonb) to authenticated;

-- Compatibilidad inmediata con la beta que ya puede estar abierta en una pestaña:
-- el primer llamado cerró la ejecución y falló después; un reintento recupera su id.
create or replace function public.complete_supervised_in_person_session(
  target_assignment_id uuid,
  active_seconds_input integer,
  skipped_count_input integer default 0,
  final_discomfort_input integer default null,
  perceived_difficulty_input integer default null,
  patient_comment_input text default null,
  professional_observation_input text default null,
  event_log_input jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_patient_id uuid;
  assignment_status public.session_status;
  execution_id uuid;
  initial_discomfort_value integer;
  final_status public.session_status;
begin
  if active_seconds_input is null or active_seconds_input not between 0 and 86400
    or skipped_count_input is null or skipped_count_input not between 0 and 100 then
    raise exception 'Datos de ejecución fuera de rango.' using errcode = '22023';
  end if;
  if final_discomfort_input is null or final_discomfort_input not between 0 and 10 then
    raise exception 'El malestar final debe estar entre 0 y 10.' using errcode = '22023';
  end if;
  if perceived_difficulty_input is null or perceived_difficulty_input not between 1 and 5 then
    raise exception 'La dificultad percibida debe estar entre 1 y 5.' using errcode = '22023';
  end if;
  if length(coalesce(patient_comment_input, '')) > 500
    or length(coalesce(professional_observation_input, '')) > 2000 then
    raise exception 'El texto del cierre supera el máximo permitido.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(event_log_input, '[]'::jsonb)) <> 'array'
    or pg_column_size(coalesce(event_log_input, '[]'::jsonb)) > 32768 then
    raise exception 'Registro de eventos no válido.' using errcode = '22023';
  end if;

  select assignment_row.patient_id, assignment_row.status
  into target_patient_id, assignment_status
  from public.session_assignments assignment_row
  join public.session_plans plan on plan.id = assignment_row.session_plan_id
  where assignment_row.id = target_assignment_id
    and public.is_professional()
    and public.owns_patient(assignment_row.patient_id)
    and coalesce(plan.plan_definition ->> 'mode', 'home') = 'in_person'
    and assignment_row.status in ('started', 'completed', 'partial')
  for update of assignment_row;

  if target_patient_id is null then
    raise exception 'Asignación presencial no disponible para este profesional.' using errcode = '42501';
  end if;

  if assignment_status in ('completed', 'partial') then
    select execution.id into execution_id
    from public.session_executions execution
    where execution.assignment_id = target_assignment_id
      and execution.patient_id = target_patient_id
      and execution.execution_mode = 'in_person'
      and execution.supervised
      and execution.operated_by = auth.uid()
      and execution.finished_at >= now() - interval '24 hours'
      and execution.peak_discomfort is null
    order by execution.finished_at desc
    limit 1;
    if execution_id is not null then return execution_id; end if;
    raise exception 'El cierre de esta sesión ya fue registrado.' using errcode = '22023';
  end if;

  select execution.id, execution.initial_discomfort
  into execution_id, initial_discomfort_value
  from public.session_executions execution
  where execution.assignment_id = target_assignment_id
    and execution.patient_id = target_patient_id
    and execution.execution_mode = 'in_person'
    and execution.supervised
    and execution.operated_by = auth.uid()
    and execution.finished_at is null
  order by execution.created_at desc
  limit 1
  for update;

  if execution_id is null or initial_discomfort_value is null then
    raise exception 'No existe una ejecución presencial abierta por este profesional.' using errcode = '42501';
  end if;

  final_status := case when greatest(0, skipped_count_input) > 0
    then 'partial'::public.session_status
    else 'completed'::public.session_status
  end;

  update public.session_executions
  set status = final_status,
      finished_at = now(),
      active_seconds = greatest(0, active_seconds_input),
      final_discomfort = final_discomfort_input,
      perceived_difficulty = perceived_difficulty_input,
      patient_comment = nullif(btrim(coalesce(patient_comment_input, '')), ''),
      professional_observation = nullif(btrim(coalesce(professional_observation_input, '')), ''),
      event_log = event_log || coalesce(event_log_input, '[]'::jsonb)
  where id = execution_id;

  update public.session_assignments set status = final_status where id = target_assignment_id;

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'supervised_in_person_session_finished', 'session_assignment', target_assignment_id,
    jsonb_build_object('execution_id', execution_id, 'patient_id', target_patient_id, 'status', final_status));

  return execution_id;
end;
$$;

-- La beta anterior completa estas cuatro columnas después del RPC. Se habilita
-- sólo ese subconjunto y únicamente sobre ejecuciones supervisadas del operador.
drop policy if exists executions_professional_supervised_feedback_update on public.session_executions;
create policy executions_professional_supervised_feedback_update
on public.session_executions
for update to authenticated
using (
  public.is_professional()
  and public.owns_patient(patient_id)
  and supervised
  and operated_by = auth.uid()
)
with check (
  public.is_professional()
  and public.owns_patient(patient_id)
  and supervised
  and operated_by = auth.uid()
);

grant update (peak_discomfort, recovery_minutes, delayed_response, progression_decision)
on public.session_executions to authenticated;

