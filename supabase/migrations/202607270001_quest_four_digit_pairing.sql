-- Simplifica el vínculo de la estación Quest a un código numérico efímero de
-- cuatro dígitos. El código sigue siendo de un solo uso y vence a los 15 minutos.

alter table public.quest_session_pairings
drop constraint if exists quest_session_pairings_code_hash_key;

create unique index if not exists quest_pairings_ready_code_hash_unique
on public.quest_session_pairings (code_hash)
where status = 'ready';

create or replace function public.create_quest_session_pairing(target_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  target_professional_id uuid;
  target_plan_definition jsonb;
  random_bytes bytea;
  raw_code text;
  pairing_id uuid;
  pairing_expires_at timestamptz := now() + interval '15 minutes';
begin
  select assignment_row.assigned_by, plan.plan_definition
  into target_professional_id, target_plan_definition
  from public.session_assignments assignment_row
  join public.session_plans plan on plan.id = assignment_row.session_plan_id
  where assignment_row.id = target_assignment_id
    and public.is_professional()
    and public.owns_patient(assignment_row.patient_id)
    and assignment_row.assigned_by = auth.uid()
    and coalesce(plan.plan_definition ->> 'mode', 'home') = 'in_person'
    and assignment_row.status = 'started'
  for update of assignment_row;

  if target_professional_id is null then
    raise exception 'La sesión presencial debe estar iniciada por el profesional antes de preparar Quest.' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(target_plan_definition -> 'exercises', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(target_plan_definition -> 'exercises', '[]'::jsonb)) = 0
     or exists (
       select 1
       from jsonb_array_elements(coalesce(target_plan_definition -> 'exercises', '[]'::jsonb)) exercise
       where coalesce(exercise ->> 'displayMode', 'standard') <> 'quest_browser'
     ) then
    raise exception 'La estación Quest solo recibe sesiones presenciales compuestas íntegramente por ejercicios Quest.' using errcode = '22023';
  end if;

  update public.quest_session_pairings
  set status = 'revoked', updated_at = now()
  where assignment_id = target_assignment_id
    and status in ('ready', 'claimed');

  loop
    random_bytes := extensions.gen_random_bytes(2);
    raw_code := lpad((((get_byte(random_bytes, 0) * 256) + get_byte(random_bytes, 1)) % 10000)::text, 4, '0');
    begin
      insert into public.quest_session_pairings (
        assignment_id,
        professional_id,
        code_hash,
        status,
        expires_at
      ) values (
        target_assignment_id,
        auth.uid(),
        encode(extensions.digest(raw_code, 'sha256'), 'hex'),
        'ready',
        pairing_expires_at
      ) returning id into pairing_id;
      exit;
    exception when unique_violation then
      -- Solo los códigos todavía listos deben ser únicos; se reintenta una colisión.
    end;
  end loop;

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'quest_session_pairing_created',
    'session_assignment',
    target_assignment_id,
    jsonb_build_object('pairing_id', pairing_id, 'expires_at', pairing_expires_at)
  );

  return jsonb_build_object(
    'id', pairing_id,
    'assignmentId', target_assignment_id,
    'code', raw_code,
    'status', 'ready',
    'expiresAt', pairing_expires_at
  );
end;
$$;

create or replace function public.claim_quest_session_pairing(pairing_code_input text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  pairing_row public.quest_session_pairings%rowtype;
  raw_device_token text := encode(extensions.gen_random_bytes(32), 'hex');
  target_title text;
  target_instructions text;
  target_definition jsonb;
  target_patient_name text;
  target_patient_label text;
begin
  if pairing_code_input is null or trim(pairing_code_input) !~ '^[0-9]{4}$' then
    raise exception 'Código Quest inválido o vencido.' using errcode = '22023';
  end if;

  update public.quest_session_pairings pairing
  set status = 'claimed',
      claimed_at = now(),
      device_token_hash = encode(extensions.digest(raw_device_token, 'sha256'), 'hex'),
      expires_at = now() + interval '2 hours',
      updated_at = now()
  where pairing.code_hash = encode(extensions.digest(trim(pairing_code_input), 'sha256'), 'hex')
    and pairing.status = 'ready'
    and pairing.expires_at > now()
  returning pairing.* into pairing_row;

  if pairing_row.id is null then
    raise exception 'Código Quest inválido o vencido.' using errcode = '22023';
  end if;

  select plan.title, plan.instructions, plan.plan_definition, patient.full_name
  into target_title, target_instructions, target_definition, target_patient_name
  from public.session_assignments assignment_row
  join public.session_plans plan on plan.id = assignment_row.session_plan_id
  join public.patients patient on patient.id = assignment_row.patient_id
  where assignment_row.id = pairing_row.assignment_id
    and assignment_row.status = 'started'
    and coalesce(plan.plan_definition ->> 'mode', 'home') = 'in_person';

  if target_title is null then
    update public.quest_session_pairings set status = 'revoked', updated_at = now() where id = pairing_row.id;
    raise exception 'La sesión Quest ya no está disponible.' using errcode = '42501';
  end if;

  target_patient_label := split_part(trim(target_patient_name), ' ', 1);
  if split_part(trim(target_patient_name), ' ', 2) <> '' then
    target_patient_label := target_patient_label || ' ' || left(split_part(trim(target_patient_name), ' ', 2), 1) || '.';
  end if;

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    null,
    'quest_session_pairing_claimed',
    'session_assignment',
    pairing_row.assignment_id,
    jsonb_build_object('pairing_id', pairing_row.id, 'professional_id', pairing_row.professional_id)
  );

  return jsonb_build_object(
    'pairingId', pairing_row.id,
    'deviceToken', raw_device_token,
    'expiresAt', pairing_row.expires_at,
    'patientLabel', target_patient_label,
    'session', jsonb_build_object(
      'id', pairing_row.assignment_id,
      'title', target_title,
      'instructions', coalesce(target_instructions, ''),
      'exercises', coalesce(target_definition -> 'exercises', '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.create_quest_session_pairing(uuid) from public;
revoke all on function public.claim_quest_session_pairing(text) from public;
grant execute on function public.create_quest_session_pairing(uuid) to authenticated;
grant execute on function public.claim_quest_session_pairing(text) to anon, authenticated;

