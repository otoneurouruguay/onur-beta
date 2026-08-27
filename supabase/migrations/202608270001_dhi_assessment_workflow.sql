-- Reemplaza el cuestionario propio por un flujo DHI argentino versionado.
-- El usuario confirmó que no existen evaluaciones clínicas que deban conservarse.

delete from public.audit_events where entity_type = 'patient_assessment';
delete from public.patient_assessments;

drop index if exists public.patient_assessments_one_open_assignment_idx;

alter table public.patient_assessments
  drop constraint if exists patient_assessments_total_score_check,
  drop constraint if exists patient_assessments_answered_count_check,
  drop constraint if exists patient_assessments_applicable_count_check,
  drop constraint if exists patient_assessments_v2_version_check,
  drop constraint if exists patient_assessments_general_rating_check,
  drop constraint if exists patient_assessments_falls_count_check;

alter table public.patient_assessments
  drop column if exists source_document_id,
  drop column if exists applicable_count,
  drop column if exists general_rating,
  drop column if exists falls_count,
  drop column if exists walking_aid_used,
  add column if not exists delivery_mode text not null default 'portal',
  add column if not exists status text not null default 'assigned',
  add column if not exists due_date date,
  add column if not exists subscale_scores jsonb not null default '{}'::jsonb,
  add column if not exists assigned_at timestamptz not null default now(),
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid references auth.users (id) on delete set null;

alter table public.patient_assessments
  alter column instrument_code set default 'DHI_AR_25',
  alter column instrument_version set default 1,
  alter column assessment_date drop not null,
  alter column total_score drop not null,
  alter column answered_count set default 0;

alter table public.patient_assessments
  add constraint patient_assessments_instrument_check check (instrument_code = 'DHI_AR_25' and instrument_version = 1),
  add constraint patient_assessments_delivery_mode_check check (delivery_mode in ('portal', 'in_person')),
  add constraint patient_assessments_status_check check (status in ('assigned', 'in_progress', 'completed', 'cancelled')),
  add constraint patient_assessments_total_score_check check (total_score is null or total_score between 0 and 100),
  add constraint patient_assessments_answered_count_check check (answered_count between 0 and 25),
  add constraint patient_assessments_completion_check check (
    (status = 'completed' and total_score is not null and answered_count = 25 and completed_at is not null and assessment_date is not null)
    or (status <> 'completed' and total_score is null and completed_at is null)
  );

create unique index patient_assessments_one_open_assignment_idx
on public.patient_assessments (patient_id, treatment_cycle_id, instrument_code, phase)
where status in ('assigned', 'in_progress');

comment on table public.patient_assessments is 'Asignaciones y resultados versionados de cuestionarios clínicos autoinformados.';
comment on column public.patient_assessments.delivery_mode is 'portal: responde el paciente en su portal; in_person: inicia y registra el profesional.';
comment on column public.patient_assessments.subscale_scores is 'Puntajes calculados por el servidor. Para DHI: physical, emotional y functional.';

create or replace function public.valid_dhi_responses(responses_input jsonb, require_complete boolean default false)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_typeof(coalesce(responses_input, '{}'::jsonb)) = 'object'
    and not exists (
      select 1
      from jsonb_each(coalesce(responses_input, '{}'::jsonb)) entry
      where entry.key not in (
        'P1','P2','P3','P4','P5','P6','P7',
        'E1','E2','E3','E4','E5','E6','E7','E8','E9',
        'F1','F2','F3','F4','F5','F6','F7','F8','F9'
      )
      or jsonb_typeof(entry.value) <> 'number'
      or entry.value::text not in ('0','2','4')
    )
    and (not require_complete or jsonb_object_length(coalesce(responses_input, '{}'::jsonb)) = 25);
$$;

revoke all on function public.valid_dhi_responses(jsonb, boolean) from public;

create or replace function public.create_assessment_assignment(
  target_patient_id uuid,
  target_treatment_cycle_id uuid,
  phase_input public.assessment_phase,
  delivery_mode_input text,
  due_date_input date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_assessment public.patient_assessments;
begin
  if not (public.owns_patient(target_patient_id) and public.is_professional()) then
    raise exception 'Acceso profesional no autorizado.' using errcode = '42501';
  end if;
  if delivery_mode_input not in ('portal', 'in_person') then
    raise exception 'Modalidad de cuestionario no válida.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.treatment_cycles cycle
    where cycle.id = target_treatment_cycle_id and cycle.patient_id = target_patient_id
  ) then
    raise exception 'El ciclo seleccionado no corresponde al paciente.' using errcode = '22023';
  end if;

  insert into public.patient_assessments (
    patient_id, treatment_cycle_id, instrument_code, instrument_version,
    phase, delivery_mode, status, due_date, responses, answered_count, created_by
  ) values (
    target_patient_id, target_treatment_cycle_id, 'DHI_AR_25', 1,
    phase_input, delivery_mode_input, 'assigned', due_date_input, '{}'::jsonb, 0, auth.uid()
  ) returning * into created_assessment;

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'assessment_assigned',
    'patient_assessment',
    created_assessment.id,
    jsonb_build_object(
      'instrument_code', created_assessment.instrument_code,
      'instrument_version', created_assessment.instrument_version,
      'phase', created_assessment.phase,
      'delivery_mode', created_assessment.delivery_mode,
      'due_date', created_assessment.due_date
    )
  );

  return to_jsonb(created_assessment);
end;
$$;

revoke all on function public.create_assessment_assignment(uuid, uuid, public.assessment_phase, text, date) from public;
grant execute on function public.create_assessment_assignment(uuid, uuid, public.assessment_phase, text, date) to authenticated;

create or replace function public.cancel_assessment(target_assessment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_assessment public.patient_assessments;
begin
  update public.patient_assessments assessment
  set status = 'cancelled'
  where assessment.id = target_assessment_id
    and assessment.status in ('assigned', 'in_progress')
    and public.owns_patient(assessment.patient_id)
    and public.is_professional()
  returning assessment.* into updated_assessment;

  if updated_assessment.id is null then
    raise exception 'El cuestionario no se puede cancelar.' using errcode = '42501';
  end if;

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'assessment_cancelled',
    'patient_assessment',
    updated_assessment.id,
    jsonb_build_object(
      'instrument_code', updated_assessment.instrument_code,
      'phase', updated_assessment.phase,
      'delivery_mode', updated_assessment.delivery_mode,
      'answered_count', updated_assessment.answered_count
    )
  );

  return to_jsonb(updated_assessment);
end;
$$;

revoke all on function public.cancel_assessment(uuid) from public;
grant execute on function public.cancel_assessment(uuid) to authenticated;

create or replace function public.save_patient_assessment_draft(
  target_assessment_id uuid,
  responses_input jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_assessment public.patient_assessments;
begin
  if not public.valid_dhi_responses(responses_input, false) then
    raise exception 'Las respuestas del DHI no son válidas.' using errcode = '22023';
  end if;

  update public.patient_assessments assessment
  set responses = responses_input,
      answered_count = jsonb_object_length(responses_input),
      status = 'in_progress',
      started_at = coalesce(assessment.started_at, now())
  where assessment.id = target_assessment_id
    and assessment.delivery_mode = 'portal'
    and assessment.status in ('assigned', 'in_progress')
    and public.is_patient_self(assessment.patient_id)
  returning assessment.* into updated_assessment;

  if updated_assessment.id is null then
    raise exception 'Cuestionario no disponible.' using errcode = '42501';
  end if;

  return to_jsonb(updated_assessment);
end;
$$;

revoke all on function public.save_patient_assessment_draft(uuid, jsonb) from public;
grant execute on function public.save_patient_assessment_draft(uuid, jsonb) to authenticated;

create or replace function public.complete_assessment(
  target_assessment_id uuid,
  responses_input jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.patient_assessments;
  updated_assessment public.patient_assessments;
  physical_score integer;
  emotional_score integer;
  functional_score integer;
begin
  if not public.valid_dhi_responses(responses_input, true) then
    raise exception 'Completá las 25 respuestas válidas del DHI.' using errcode = '22023';
  end if;

  select assessment.* into target
  from public.patient_assessments assessment
  where assessment.id = target_assessment_id
    and assessment.status in ('assigned', 'in_progress')
  for update;

  if target.id is null then
    raise exception 'Cuestionario no disponible.' using errcode = '42501';
  end if;

  if target.delivery_mode = 'portal' then
    if not public.is_patient_self(target.patient_id) then
      raise exception 'El cuestionario debe ser respondido por el paciente desde su portal.' using errcode = '42501';
    end if;
  elsif not (public.owns_patient(target.patient_id) and public.is_professional()) then
    raise exception 'Acceso profesional no autorizado.' using errcode = '42501';
  end if;

  select
    coalesce(sum((entry.value::text)::integer) filter (where entry.key like 'P%'), 0),
    coalesce(sum((entry.value::text)::integer) filter (where entry.key like 'E%'), 0),
    coalesce(sum((entry.value::text)::integer) filter (where entry.key like 'F%'), 0)
  into physical_score, emotional_score, functional_score
  from jsonb_each(responses_input) entry;

  update public.patient_assessments assessment
  set responses = responses_input,
      answered_count = 25,
      total_score = physical_score + emotional_score + functional_score,
      subscale_scores = jsonb_build_object(
        'physical', physical_score,
        'emotional', emotional_score,
        'functional', functional_score
      ),
      status = 'completed',
      started_at = coalesce(assessment.started_at, now()),
      completed_at = now(),
      assessment_date = (now() at time zone 'America/Montevideo')::date,
      completed_by = auth.uid()
  where assessment.id = target_assessment_id
  returning assessment.* into updated_assessment;

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'assessment_completed',
    'patient_assessment',
    updated_assessment.id,
    jsonb_build_object(
      'instrument_code', updated_assessment.instrument_code,
      'instrument_version', updated_assessment.instrument_version,
      'phase', updated_assessment.phase,
      'delivery_mode', updated_assessment.delivery_mode,
      'total_score', updated_assessment.total_score
    )
  );

  return to_jsonb(updated_assessment);
end;
$$;

revoke all on function public.complete_assessment(uuid, jsonb) from public;
grant execute on function public.complete_assessment(uuid, jsonb) to authenticated;
