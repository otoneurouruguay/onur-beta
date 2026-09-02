-- Conserva junto con cada corrección el estado canónico que muestra la UI.
-- Sin esto el valor se guardaba, pero al recargar podía reaparecer el estado OCR
-- anterior desde source_region.field_contract.

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
declare
  field_item jsonb;
begin
  perform public.save_document_extraction_review(target_job_id, review_payload);

  for field_item in
    select value from jsonb_array_elements(coalesce(review_payload -> 'fields', '[]'::jsonb))
  loop
    update public.document_extraction_fields
    set source_region = case
      when jsonb_typeof(field_item -> 'region') = 'object' then field_item -> 'region'
      when jsonb_typeof(source_region) = 'object' then source_region - 'field_contract'
      else source_region
    end
    where job_id = target_job_id
      and client_key = field_item ->> 'client_id';
  end loop;

  perform public.save_document_extraction_report(
    target_job_id,
    target_professional_conclusion,
    target_rehabilitation_suggestion
  );
end;
$$;

revoke all on function public.save_document_extraction_draft(uuid, jsonb, text, text) from public;
grant execute on function public.save_document_extraction_draft(uuid, jsonb, text, text) to authenticated;
