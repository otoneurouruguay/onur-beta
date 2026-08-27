alter table public.session_assignments
  add column if not exists repeat_series_id uuid,
  add column if not exists repeat_series_position smallint,
  add column if not exists repeat_series_size smallint,
  add column if not exists repeat_source_assignment_id uuid references public.session_assignments (id) on delete set null;

alter table public.session_assignments
  drop constraint if exists session_assignments_repeat_series_complete;

alter table public.session_assignments
  add constraint session_assignments_repeat_series_complete check (
    (repeat_series_id is null and repeat_series_position is null and repeat_series_size is null and repeat_source_assignment_id is null)
    or
    (
      repeat_series_id is not null
      and repeat_series_position between 1 and 35
      and repeat_series_size between 1 and 35
      and repeat_series_position <= repeat_series_size
      and repeat_source_assignment_id is not null
    )
  );

create unique index if not exists assignments_repeat_series_position_uidx
on public.session_assignments (repeat_series_id, repeat_series_position)
where repeat_series_id is not null;

create index if not exists assignments_patient_repeat_series_idx
on public.session_assignments (patient_id, repeat_series_id, repeat_series_position)
where repeat_series_id is not null;

create or replace function public.repeat_session_assignment_as_home(
  target_assignment_id uuid,
  scheduled_dates_input date[],
  repetition_series_id_input uuid
)
returns uuid[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_patient_id uuid;
  source_treatment_cycle_id uuid;
  source_title text;
  source_instructions text;
  source_definition jsonb;
  source_kind text;
  scheduled_date date;
  position_value integer;
  series_size integer;
  new_plan_id uuid;
  new_assignment_id uuid;
  created_assignment_ids uuid[] := '{}'::uuid[];
  existing_assignment_ids uuid[];
  local_today date := (now() at time zone 'America/Montevideo')::date;
begin
  if repetition_series_id_input is null then
    raise exception 'La serie de repetición no es válida.' using errcode = '22023';
  end if;

  series_size := coalesce(cardinality(scheduled_dates_input), 0);
  if series_size < 1 or series_size > 35 then
    raise exception 'La serie debe contener entre 1 y 35 fechas.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(scheduled_dates_input) scheduled(value) where scheduled.value is null or scheduled.value < local_today) then
    raise exception 'Las nuevas sesiones deben programarse desde hoy en adelante.' using errcode = '22023';
  end if;
  if (select count(distinct scheduled.value) from unnest(scheduled_dates_input) scheduled(value)) <> series_size then
    raise exception 'No se puede programar dos veces la misma fecha dentro de una serie.' using errcode = '22023';
  end if;

  select array_agg(assignment_row.id order by assignment_row.repeat_series_position)
  into existing_assignment_ids
  from public.session_assignments assignment_row
  where assignment_row.repeat_series_id = repetition_series_id_input
    and assignment_row.repeat_source_assignment_id = target_assignment_id
    and assignment_row.assigned_by = auth.uid();

  if cardinality(existing_assignment_ids) > 0 then
    if cardinality(existing_assignment_ids) <> series_size then
      raise exception 'La serie ya existe con otra cantidad de fechas.' using errcode = '23505';
    end if;
    return existing_assignment_ids;
  end if;

  if exists (select 1 from public.session_assignments assignment_row where assignment_row.repeat_series_id = repetition_series_id_input) then
    raise exception 'El identificador de serie ya está en uso.' using errcode = '23505';
  end if;

  select assignment_row.patient_id,
         assignment_row.treatment_cycle_id,
         plan.title,
         plan.instructions,
         coalesce(plan.plan_definition, '{}'::jsonb),
         coalesce(plan.plan_definition ->> 'kind', 'exercise')
  into source_patient_id,
       source_treatment_cycle_id,
       source_title,
       source_instructions,
       source_definition,
       source_kind
  from public.session_assignments assignment_row
  join public.session_plans plan on plan.id = assignment_row.session_plan_id
  where assignment_row.id = target_assignment_id
    and public.is_professional()
    and public.owns_patient(assignment_row.patient_id)
    and assignment_row.status <> 'revoked'
  for update of assignment_row;

  if source_patient_id is null then
    raise exception 'La sesión original no está disponible para repetir.' using errcode = '42501';
  end if;
  if source_kind = 'free_note' then
    raise exception 'Una sesión libre no se puede programar como domiciliaria.' using errcode = '22023';
  end if;

  for scheduled_date, position_value in
    select scheduled.value, scheduled.position::integer
    from unnest(scheduled_dates_input) with ordinality scheduled(value, position)
    order by scheduled.position
  loop
    insert into public.session_plans (professional_id, title, instructions, plan_definition)
    values (
      auth.uid(),
      source_title,
      source_instructions,
      source_definition || jsonb_build_object('kind', 'exercise', 'mode', 'home')
    )
    returning id into new_plan_id;

    insert into public.session_assignments (
      patient_id,
      treatment_cycle_id,
      session_plan_id,
      available_from,
      available_until,
      max_completions,
      status,
      assigned_by,
      repeat_series_id,
      repeat_series_position,
      repeat_series_size,
      repeat_source_assignment_id
    ) values (
      source_patient_id,
      source_treatment_cycle_id,
      new_plan_id,
      scheduled_date::timestamp at time zone 'America/Montevideo',
      ((scheduled_date + 1)::timestamp at time zone 'America/Montevideo') - interval '1 second',
      1,
      'assigned',
      auth.uid(),
      repetition_series_id_input,
      position_value,
      series_size,
      target_assignment_id
    )
    returning id into new_assignment_id;

    created_assignment_ids := array_append(created_assignment_ids, new_assignment_id);

    insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'session_assignment_repeated_as_home',
      'session_assignment',
      new_assignment_id,
      jsonb_build_object(
        'source_assignment_id', target_assignment_id,
        'patient_id', source_patient_id,
        'target_mode', 'home',
        'repeat_series_id', repetition_series_id_input,
        'repeat_series_position', position_value,
        'repeat_series_size', series_size,
        'scheduled_date', scheduled_date
      )
    );
  end loop;

  return created_assignment_ids;
end;
$$;

revoke all on function public.repeat_session_assignment_as_home(uuid, date[], uuid) from public;
grant execute on function public.repeat_session_assignment_as_home(uuid, date[], uuid) to authenticated;

comment on function public.repeat_session_assignment_as_home(uuid, date[], uuid)
is 'Programa de una a 35 asignaciones domiciliarias independientes desde una sesión existente, sin copiar ejecuciones ni resultados y con idempotencia por serie.';
