-- Guarda los campos revisados y el borrador de informe dentro de una sola
-- transacción, y permite recuperar una extracción descartada por error.

create or replace function public.save_document_extraction_draft(
  target_job_id uuid,
  review_payload jsonb,
  target_professional_conclusion text,
  target_rehabilitation_suggestion text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.save_document_extraction_review(target_job_id, review_payload);
  perform public.save_document_extraction_report(
    target_job_id,
    target_professional_conclusion,
    target_rehabilitation_suggestion
  );
end;
$$;

revoke all on function public.save_document_extraction_draft(uuid, jsonb, text, text) from public;
grant execute on function public.save_document_extraction_draft(uuid, jsonb, text, text) to authenticated;

create or replace function public.reopen_document_extraction(target_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job_record public.document_extraction_jobs%rowtype;
begin
  select * into job_record
  from public.document_extraction_jobs
  where id = target_job_id
    and public.owns_patient(patient_id)
    and public.is_professional()
  for update;

  if job_record.id is null then
    raise exception 'Extracción no encontrada o sin permiso.';
  end if;
  if job_record.status = 'review' then
    return;
  end if;
  if job_record.status <> 'discarded' then
    raise exception 'Solo se puede reabrir un borrador descartado.';
  end if;
  if exists (
    select 1
    from public.study_extraction_sections section
    join public.clinical_studies study on study.id = section.study_id
    where section.job_id = target_job_id
      and study.status <> 'draft'
  ) then
    raise exception 'El estudio ya avanzó y no admite reabrir esta extracción.';
  end if;

  update public.document_extraction_jobs
  set status = 'review',
      confirmed_by = null,
      confirmed_at = null,
      report_confirmed_by = null,
      report_confirmed_at = null
  where id = target_job_id;

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'clinical_extraction_reopened',
    'document_extraction',
    target_job_id,
    jsonb_build_object('previous_status', job_record.status)
  );
end;
$$;

revoke all on function public.reopen_document_extraction(uuid) from public;
grant execute on function public.reopen_document_extraction(uuid) to authenticated;
