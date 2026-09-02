-- Registro retrospectivo explícito: conserva fecha real, fecha de carga, autor,
-- omisiones y la decisión consciente de no inventar métricas ausentes.

alter table public.session_assignments
  add column if not exists registered_retrospectively boolean not null default false,
  add column if not exists actual_performed_at timestamptz,
  add column if not exists retrospective_recorded_at timestamptz,
  add column if not exists retrospective_recorded_by uuid references auth.users (id),
  add column if not exists retrospective_without_metrics boolean not null default false,
  add column if not exists retrospective_device text
    check (retrospective_device is null or retrospective_device in ('standard', 'vr_box', 'cardboard', 'quest', 'external', 'mixed'));

alter table public.session_executions
  add column if not exists peak_discomfort smallint check (peak_discomfort between 0 and 10),
  add column if not exists recovery_minutes integer check (recovery_minutes between 0 and 1440),
  add column if not exists delayed_response text,
  add column if not exists progression_decision text;

alter table public.session_assignments
  drop constraint if exists retrospective_assignment_consistency;
alter table public.session_assignments
  add constraint retrospective_assignment_consistency check (
    not registered_retrospectively or (
      actual_performed_at is not null
      and retrospective_recorded_at is not null
      and retrospective_recorded_by is not null
    )
  );

create or replace function public.record_retrospective_session(
  target_assignment_id uuid,
  actual_performed_at_input timestamptz,
  performed_indexes_input jsonb,
  omitted_exercises_input jsonb,
  approximate_duration_minutes_input integer,
  device_input text,
  without_metrics_input boolean,
  initial_discomfort_input smallint,
  peak_discomfort_input smallint,
  final_discomfort_input smallint,
  recovery_minutes_input integer,
  delayed_response_input text,
  progression_decision_input text,
  professional_observation_input text,
  patient_comment_input text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assignment_row public.session_assignments%rowtype;
  execution_id uuid;
  plan_mode text;
  clean_observation text := btrim(coalesce(professional_observation_input, ''));
  event_payload jsonb;
begin
  if auth.uid() is null or not public.is_professional() then
    raise exception 'Esta acción requiere una sesión profesional.' using errcode = '42501';
  end if;
  if actual_performed_at_input is null or actual_performed_at_input > now() + interval '5 minutes' then
    raise exception 'La fecha real de ejecución no puede quedar en el futuro.' using errcode = '22023';
  end if;
  if char_length(clean_observation) < 3 or char_length(clean_observation) > 4000 then
    raise exception 'La observación profesional debe tener entre 3 y 4000 caracteres.' using errcode = '22023';
  end if;
  if device_input not in ('standard', 'vr_box', 'cardboard', 'quest', 'external', 'mixed') then
    raise exception 'Dispositivo retrospectivo no válido.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(performed_indexes_input, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(omitted_exercises_input, '[]'::jsonb)) <> 'array' then
    raise exception 'El detalle de ejercicios debe ser una lista.' using errcode = '22023';
  end if;
  if not without_metrics_input and (approximate_duration_minutes_input is null or approximate_duration_minutes_input not between 1 and 600) then
    raise exception 'La duración aproximada debe estar entre 1 y 600 minutos.' using errcode = '22023';
  end if;

  select assignment.* into assignment_row
  from public.session_assignments assignment
  where assignment.id = target_assignment_id
    and public.owns_patient(assignment.patient_id)
    and assignment.status in ('assigned', 'started')
  for update;

  if assignment_row.id is null then
    raise exception 'La sesión ya no está disponible para finalizar retrospectivamente.' using errcode = '42501';
  end if;

  select coalesce(plan.plan_definition ->> 'mode', 'home') into plan_mode
  from public.session_plans plan where plan.id = assignment_row.session_plan_id;

  event_payload := jsonb_build_array(jsonb_build_object(
    'type', 'retrospective_session_recorded',
    'at', actual_performed_at_input,
    'performed_exercise_indexes', coalesce(performed_indexes_input, '[]'::jsonb),
    'omitted_exercises', coalesce(omitted_exercises_input, '[]'::jsonb),
    'skipped_exercises', jsonb_array_length(coalesce(omitted_exercises_input, '[]'::jsonb))
  ));

  insert into public.session_executions (
    assignment_id, patient_id, status, started_at, finished_at, active_seconds,
    initial_discomfort, peak_discomfort, final_discomfort, recovery_minutes,
    delayed_response, progression_decision, patient_comment, professional_observation,
    event_log, execution_mode, supervised, operated_by
  ) values (
    target_assignment_id, assignment_row.patient_id, 'completed', actual_performed_at_input, actual_performed_at_input,
    case when without_metrics_input then 0 else approximate_duration_minutes_input * 60 end,
    case when without_metrics_input then null else initial_discomfort_input end,
    case when without_metrics_input then null else peak_discomfort_input end,
    case when without_metrics_input then null else final_discomfort_input end,
    case when without_metrics_input then null else recovery_minutes_input end,
    case when without_metrics_input then null else nullif(btrim(coalesce(delayed_response_input, '')), '') end,
    case when without_metrics_input then null else nullif(btrim(coalesce(progression_decision_input, '')), '') end,
    nullif(btrim(coalesce(patient_comment_input, '')), ''), clean_observation,
    event_payload, case when plan_mode = 'home' then 'home' else 'in_person' end,
    case when plan_mode = 'in_person' then true else false end, auth.uid()
  ) returning id into execution_id;

  update public.session_assignments set
    status = 'completed',
    registered_retrospectively = true,
    actual_performed_at = actual_performed_at_input,
    retrospective_recorded_at = now(),
    retrospective_recorded_by = auth.uid(),
    retrospective_without_metrics = without_metrics_input,
    retrospective_device = device_input
  where id = target_assignment_id;

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'retrospective_session_recorded', 'session_assignment', target_assignment_id,
    jsonb_build_object(
      'patient_id', assignment_row.patient_id,
      'execution_id', execution_id,
      'actual_performed_at', actual_performed_at_input,
      'without_metrics', without_metrics_input,
      'device', device_input,
      'omitted_count', jsonb_array_length(coalesce(omitted_exercises_input, '[]'::jsonb))
    ));

  return execution_id;
end;
$$;

revoke all on function public.record_retrospective_session(uuid, timestamptz, jsonb, jsonb, integer, text, boolean, smallint, smallint, smallint, integer, text, text, text, text) from public;
grant execute on function public.record_retrospective_session(uuid, timestamptz, jsonb, jsonb, integer, text, boolean, smallint, smallint, smallint, integer, text, text, text, text) to authenticated;

comment on function public.record_retrospective_session(uuid, timestamptz, jsonb, jsonb, integer, text, boolean, smallint, smallint, smallint, integer, text, text, text, text)
is 'Finaliza una sesión pasada con fecha real, trazabilidad profesional y opción explícita de no registrar métricas ausentes.';
