-- Los extractores nuevos pueden incorporar campos que no existían cuando se
-- creó un borrador. Al reanalizar, se actualizan los campos existentes y se
-- agregan los nuevos sin pisar correcciones profesionales previas.

create or replace function public.replace_document_extraction_candidates(
  target_job_id uuid,
  extraction_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job_record public.document_extraction_jobs%rowtype;
  page_item jsonb;
  field_item jsonb;
  target_study_id uuid;
  changed_fields integer := 0;
begin
  select * into job_record
  from public.document_extraction_jobs
  where id = target_job_id and public.owns_patient(patient_id) and public.is_professional()
  for update;
  if job_record.id is null then raise exception 'Extracción no encontrada o sin permiso.'; end if;
  if job_record.status <> 'review' then raise exception 'Solo se puede reanalizar un borrador en revisión.'; end if;

  for page_item in select value from jsonb_array_elements(coalesce(extraction_payload -> 'pages', '[]'::jsonb)) loop
    update public.document_extraction_pages set
      classification = case when classification = proposed_classification then page_item ->> 'classification' else classification end,
      proposed_classification = page_item ->> 'proposed_classification',
      classification_confidence = nullif(page_item ->> 'classification_confidence', '')::numeric,
      rotation_degrees = coalesce(nullif(page_item ->> 'rotation_degrees', '')::integer, 0),
      pixel_width = nullif(page_item ->> 'width', '')::integer,
      pixel_height = nullif(page_item ->> 'height', '')::integer
    where job_id = target_job_id and page_number = (page_item ->> 'page_number')::integer;
  end loop;

  for field_item in select value from jsonb_array_elements(coalesce(extraction_payload -> 'fields', '[]'::jsonb)) loop
    update public.document_extraction_fields set
      field_label = field_item ->> 'label',
      field_group = field_item ->> 'group',
      required = coalesce((field_item ->> 'required')::boolean, false),
      metric_code = nullif(field_item ->> 'metric_code', ''),
      unit_code = nullif(field_item ->> 'unit_code', ''),
      condition_code = nullif(field_item ->> 'condition_code', ''),
      side = nullif(field_item ->> 'side', ''),
      professional_value = case
        when coalesce(professional_value, '') = coalesce(raw_value, '') then nullif(field_item ->> 'professional_value', '')
        else professional_value
      end,
      normalized_value = case
        when coalesce(professional_value, '') = coalesce(raw_value, '') then nullif(field_item ->> 'normalized_value', '')
        else normalized_value
      end,
      extraction_status = case
        when coalesce(professional_value, '') = coalesce(raw_value, '') then field_item ->> 'status'
        else extraction_status
      end,
      raw_value = nullif(field_item ->> 'raw_value', ''),
      page_number = (field_item ->> 'page_number')::integer,
      source_region = nullif(field_item -> 'region', 'null'::jsonb),
      extraction_confidence = nullif(field_item ->> 'confidence', '')::numeric,
      extractor_method = field_item ->> 'extractor_method',
      extractor_version = field_item ->> 'extractor_version',
      is_confirmed = false,
      confirmed_by = null,
      confirmed_at = null
    where job_id = target_job_id
      and field_code = field_item ->> 'code'
      and study_type = field_item ->> 'study_type';

    if found then
      changed_fields := changed_fields + 1;
    else
      select section.study_id into target_study_id
      from public.study_extraction_sections section
      where section.job_id = target_job_id
        and section.study_type = field_item ->> 'study_type';

      if target_study_id is not null then
        insert into public.document_extraction_fields (
          job_id, patient_id, study_id, client_key, field_code, field_label, field_group, study_type,
          required, metric_code, raw_value, normalized_value, unit_code, condition_code, side,
          page_number, source_region, extraction_confidence, extraction_status, extractor_method,
          extractor_version, professional_value
        ) values (
          target_job_id, job_record.patient_id, target_study_id, field_item ->> 'client_id', field_item ->> 'code',
          field_item ->> 'label', field_item ->> 'group', field_item ->> 'study_type',
          coalesce((field_item ->> 'required')::boolean, false), nullif(field_item ->> 'metric_code', ''),
          nullif(field_item ->> 'raw_value', ''), nullif(field_item ->> 'normalized_value', ''),
          nullif(field_item ->> 'unit_code', ''), nullif(field_item ->> 'condition_code', ''),
          nullif(field_item ->> 'side', ''), (field_item ->> 'page_number')::integer,
          nullif(field_item -> 'region', 'null'::jsonb), nullif(field_item ->> 'confidence', '')::numeric,
          field_item ->> 'status', field_item ->> 'extractor_method', field_item ->> 'extractor_version',
          nullif(field_item ->> 'professional_value', '')
        );
        changed_fields := changed_fields + 1;
      end if;
    end if;
  end loop;

  update public.document_extraction_jobs
  set extractor_version = extraction_payload ->> 'extractor_version'
  where id = target_job_id;

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'clinical_extraction_reprocessed', 'document_extraction', target_job_id,
    jsonb_build_object(
      'field_count', changed_fields,
      'page_count', jsonb_array_length(coalesce(extraction_payload -> 'pages', '[]'::jsonb)),
      'version', extraction_payload ->> 'extractor_version'
    ));
end;
$$;

revoke all on function public.replace_document_extraction_candidates(uuid, jsonb) from public;
grant execute on function public.replace_document_extraction_candidates(uuid, jsonb) to authenticated;
