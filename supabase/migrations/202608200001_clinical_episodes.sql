-- Episodio clínico persistente por paciente y ciclo. Las recomendaciones siguen
-- siendo orientativas y requieren selección explícita del profesional.

create table if not exists public.clinical_episodes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  treatment_cycle_id uuid not null references public.treatment_cycles (id) on delete cascade,
  diagnosis_code text not null check (diagnosis_code in (
    'unilateral_hypofunction', 'bilateral_hypofunction', 'bppv', 'vestibular_migraine',
    'pppd', 'meniere', 'presbyvestibulopathy', 'mild_tbi', 'vestibular_schwannoma'
  )),
  diagnostic_certainty text not null default 'working' check (diagnostic_certainty in ('confirmed', 'probable', 'working')),
  diagnosis_source text,
  onset_date date,
  clinical_phase text not null default 'unknown' check (clinical_phase in ('acute', 'subacute', 'chronic', 'interictal', 'stable', 'fluctuating', 'unknown')),
  clinical_course text not null default 'unknown' check (clinical_course in ('less_than_month', 'one_to_three_months', 'more_than_three_months', 'recurrent', 'progressive', 'unknown')),
  etiology text,
  laterality text not null default 'unknown' check (laterality in ('left', 'right', 'bilateral', 'not_applicable', 'unknown')),
  common_anamnesis jsonb not null default '{}'::jsonb,
  pathology_findings jsonb not null default '{}'::jsonb,
  measured_impairments text,
  activity_limitations text,
  participation_goals text,
  precautions text,
  pending_data text,
  clinician_notes text,
  status text not null default 'draft' check (status in ('draft', 'reviewed')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id),
  updated_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, treatment_cycle_id),
  constraint clinical_episode_review_consistency check (
    status = 'draft' or (reviewed_at is not null and reviewed_by is not null)
  )
);

create index if not exists clinical_episodes_patient_cycle_idx
  on public.clinical_episodes (patient_id, treatment_cycle_id, updated_at desc);

drop trigger if exists clinical_episodes_set_updated_at on public.clinical_episodes;
create trigger clinical_episodes_set_updated_at before update on public.clinical_episodes
for each row execute function public.set_updated_at();

alter table public.clinical_episodes enable row level security;

drop policy if exists clinical_episodes_professional_all on public.clinical_episodes;
create policy clinical_episodes_professional_all on public.clinical_episodes
for all to authenticated
using (public.is_professional() and public.owns_patient(patient_id))
with check (
  public.is_professional()
  and public.owns_patient(patient_id)
  and exists (
    select 1 from public.treatment_cycles cycle
    where cycle.id = treatment_cycle_id and cycle.patient_id = patient_id
  )
);

grant select, insert, update, delete on public.clinical_episodes to authenticated;

comment on table public.clinical_episodes is
'Anamnesis, diagnóstico funcional, seguridad y metas vinculados al ciclo; no constituye prescripción automática.';
