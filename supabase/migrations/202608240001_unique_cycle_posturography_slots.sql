-- Un único estudio inicial y final de posturografía por ciclo, sin alterar
-- duplicados históricos. El bloqueo transaccional también cubre cargas simultáneas.

create or replace function public.protect_cycle_posturography_slot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  document_phase text;
  phase_label text;
begin
  if new.study_type <> 'posturography' then return new; end if;

  if new.source_document_id is not null and coalesce(new.cycle_phase, 'unspecified') = 'unspecified' then
    select source.cycle_phase into document_phase
    from public.source_documents source
    where source.id = new.source_document_id;

    if document_phase in ('initial', 'final') then new.cycle_phase := document_phase; end if;
  end if;

  if new.cycle_phase not in ('initial', 'final') then return new; end if;
  if new.treatment_cycle_id is null then
    raise exception 'La posturografía inicial o final debe asociarse a un ciclo.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    concat_ws(':', new.patient_id::text, new.treatment_cycle_id::text, new.cycle_phase),
    0
  ));

  if exists (
    select 1
    from public.clinical_studies study
    where study.patient_id = new.patient_id
      and study.treatment_cycle_id = new.treatment_cycle_id
      and study.study_type = 'posturography'
      and study.cycle_phase = new.cycle_phase
      and study.id is distinct from new.id
  ) then
    phase_label := case new.cycle_phase when 'initial' then 'inicial' else 'final' end;
    raise exception 'Ya existe una posturografía % para este ciclo. Abrí el estudio cargado.', phase_label
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists clinical_studies_unique_cycle_posturography_slot on public.clinical_studies;
create trigger clinical_studies_unique_cycle_posturography_slot
before insert or update of patient_id, treatment_cycle_id, study_type, cycle_phase, source_document_id
on public.clinical_studies
for each row execute function public.protect_cycle_posturography_slot();

revoke all on function public.protect_cycle_posturography_slot() from public;
