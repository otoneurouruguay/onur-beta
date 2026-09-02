-- Alinea la confirmación del backend con los campos clínicos mostrados en la revisión.
-- Los metadatos auxiliares sin metric_code (por ejemplo, study_status) se conservan,
-- pero no deben bloquear la generación del informe si no requieren confirmación.

create or replace function public.confirm_document_extraction(target_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job_record public.document_extraction_jobs%rowtype;
  section_record record;
  metric_payload jsonb;
  results jsonb := '[]'::jsonb;
begin
  select * into job_record from public.document_extraction_jobs
  where id = target_job_id and public.owns_patient(patient_id) and public.is_professional() for update;
  if job_record.id is null then raise exception 'Extracción no encontrada o sin permiso.'; end if;
  if job_record.status <> 'review' then raise exception 'El borrador ya fue confirmado, descartado o marcado manual.'; end if;
  if job_record.patient_match_status = 'mismatch' then raise exception 'La discrepancia de paciente debe resolverse antes de confirmar.'; end if;
  if exists (select 1 from public.document_extraction_pages where job_id = target_job_id and classification = 'unrecognized') then raise exception 'Todas las páginas deben tener una clasificación confirmada.'; end if;
  if exists (
    select 1
    from public.document_extraction_fields field
    where field.job_id = target_job_id
      and field.required
      and (coalesce(btrim(field.professional_value), '') = '' or not field.is_confirmed)
  ) then raise exception 'Hay campos obligatorios faltantes o sin confirmar.'; end if;
  if exists (
    select 1
    from public.document_extraction_fields field
    where field.job_id = target_job_id
      and field.metric_code is not null
      and coalesce(btrim(field.professional_value), '') <> ''
      and not field.is_confirmed
  ) then raise exception 'Todos los valores clínicos presentes deben estar confirmados.'; end if;

  update public.document_extraction_jobs
  set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now()
  where id = target_job_id;

  for section_record in select * from public.study_extraction_sections where job_id = target_job_id loop
    select jsonb_agg(jsonb_build_object(
      'metric_code', field.metric_code,
      'raw_value', coalesce(field.professional_value, field.raw_value),
      'normalized_numeric_value', case when definition.value_kind = 'numeric' and field.normalized_value ~ '^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$' then field.normalized_value else null end,
      'normalized_text_value', case when definition.value_kind <> 'numeric' or field.normalized_value !~ '^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$' then field.normalized_value else null end,
      'unit_code', field.unit_code,
      'condition_code', field.condition_code,
      'side', field.side,
      'axis', null,
      'trial_number', null,
      'source_method', 'ocr',
      'source_location', 'Página ' || field.page_number,
      'normalization_rule_version', 'onur-normalization-1.0',
      'quality_status', case when field.normalized_value in ('infinite', 'not_recorded') then 'review' else 'ok' end,
      'issues', '[]'::jsonb
    ) order by field.created_at) into metric_payload
    from public.document_extraction_fields field
    left join lateral (
      select value_kind
      from public.metric_definitions
      where code = field.metric_code
      order by version desc
      limit 1
    ) definition on true
    where field.job_id = target_job_id
      and field.study_id = section_record.study_id
      and field.metric_code is not null
      and coalesce(btrim(field.professional_value), '') <> ''
      and field.is_confirmed;

    if metric_payload is null or jsonb_array_length(metric_payload) = 0 then
      raise exception 'Cada sección necesita al menos un valor estructurado confirmado.';
    end if;

    results := results || jsonb_build_array(public.replace_study_import(
      section_record.study_id,
      metric_payload,
      'Transcripción confirmada desde extracción local.',
      false,
      job_record.extractor_version
    ));
  end loop;

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'clinical_extraction_confirmed',
    'document_extraction',
    target_job_id,
    jsonb_build_object(
      'field_count', (select count(*) from public.document_extraction_fields where job_id = target_job_id and is_confirmed),
      'section_count', (select count(*) from public.study_extraction_sections where job_id = target_job_id)
    )
  );

  return jsonb_build_object('sections', results);
end;
$$;

revoke all on function public.confirm_document_extraction(uuid) from public;
grant execute on function public.confirm_document_extraction(uuid) to authenticated;
