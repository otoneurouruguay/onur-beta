-- Estudios inicial/final por ciclo y sesiones presenciales libres trazables.

alter table public.source_documents
  add column if not exists cycle_phase text not null default 'unspecified'
    check (cycle_phase in ('initial', 'final', 'follow_up', 'unspecified'));

alter table public.clinical_studies
  add column if not exists cycle_phase text not null default 'unspecified'
    check (cycle_phase in ('initial', 'final', 'follow_up', 'unspecified'));

alter table public.source_documents
  drop constraint if exists source_documents_phase_requires_cycle;
alter table public.source_documents
  add constraint source_documents_phase_requires_cycle check (
    cycle_phase not in ('initial', 'final') or treatment_cycle_id is not null
  );

alter table public.clinical_studies
  drop constraint if exists clinical_studies_phase_requires_cycle;
alter table public.clinical_studies
  add constraint clinical_studies_phase_requires_cycle check (
    cycle_phase not in ('initial', 'final') or treatment_cycle_id is not null
  );

create index if not exists clinical_studies_cycle_phase_idx
  on public.clinical_studies (patient_id, treatment_cycle_id, cycle_phase, performed_at desc);

drop function if exists public.create_direct_bap_capture_draft(uuid, uuid, timestamptz, integer, integer);

create or replace function public.record_free_in_person_session(
  target_assignment_id uuid,
  outcome_input text,
  professional_note_input text,
  patient_comment_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assignment_row public.session_assignments%rowtype;
  execution_id uuid;
  final_status public.session_status;
  clean_note text := btrim(coalesce(professional_note_input, ''));
  clean_patient_comment text := nullif(btrim(coalesce(patient_comment_input, '')), '');
begin
  if auth.uid() is null or not public.is_professional() then
    raise exception 'Esta acción requiere una sesión profesional.' using errcode = '42501';
  end if;
  if outcome_input not in ('completed', 'cancelled') then
    raise exception 'El resultado debe ser realizada o cancelada.' using errcode = '22023';
  end if;
  if char_length(clean_note) < 3 or char_length(clean_note) > 4000 then
    raise exception 'El registro profesional debe tener entre 3 y 4000 caracteres.' using errcode = '22023';
  end if;
  if char_length(coalesce(clean_patient_comment, '')) > 500 then
    raise exception 'El comentario del paciente no puede superar 500 caracteres.' using errcode = '22023';
  end if;

  select assignment.*
  into assignment_row
  from public.session_assignments assignment
  join public.session_plans plan on plan.id = assignment.session_plan_id
  where assignment.id = target_assignment_id
    and public.owns_patient(assignment.patient_id)
    and coalesce(plan.plan_definition ->> 'mode', 'home') = 'in_person'
    and coalesce(plan.plan_definition ->> 'kind', 'exercise') = 'free_note'
    and assignment.status in ('assigned', 'started')
  for update of assignment;

  if assignment_row.id is null then
    raise exception 'Sesión presencial libre no disponible.' using errcode = '42501';
  end if;

  final_status := case when outcome_input = 'cancelled'
    then 'omitted'::public.session_status
    else 'completed'::public.session_status
  end;

  select execution.id into execution_id
  from public.session_executions execution
  where execution.assignment_id = target_assignment_id and execution.finished_at is null
  order by execution.created_at desc limit 1 for update;

  if execution_id is null then
    insert into public.session_executions (
      assignment_id, patient_id, status, started_at, finished_at, active_seconds,
      patient_comment, professional_observation, event_log, execution_mode,
      supervised, operated_by
    ) values (
      target_assignment_id, assignment_row.patient_id, final_status, now(), now(), 0,
      clean_patient_comment, clean_note,
      jsonb_build_array(jsonb_build_object(
        'type', case when outcome_input = 'cancelled' then 'free_session_cancelled' else 'free_session_recorded' end,
        'at', now()
      )),
      'in_person', true, auth.uid()
    ) returning id into execution_id;
  else
    update public.session_executions set
      status = final_status,
      finished_at = now(),
      active_seconds = 0,
      patient_comment = clean_patient_comment,
      professional_observation = clean_note,
      event_log = event_log || jsonb_build_array(jsonb_build_object(
        'type', case when outcome_input = 'cancelled' then 'free_session_cancelled' else 'free_session_recorded' end,
        'at', now()
      )),
      execution_mode = 'in_person', supervised = true, operated_by = auth.uid()
    where id = execution_id;
  end if;

  update public.session_assignments set status = final_status where id = target_assignment_id;
  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'free_in_person_session_recorded', 'session_assignment', target_assignment_id,
    jsonb_build_object('execution_id', execution_id, 'outcome', outcome_input, 'patient_id', assignment_row.patient_id));
  return execution_id;
end;
$$;

revoke all on function public.record_free_in_person_session(uuid, text, text, text) from public;
grant execute on function public.record_free_in_person_session(uuid, text, text, text) to authenticated;

comment on function public.record_free_in_person_session(uuid, text, text, text)
is 'Registra una sesión presencial libre como realizada o cancelada, con nota profesional y auditoría.';
