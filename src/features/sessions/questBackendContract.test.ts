import { describe, expect, it } from 'vitest'
import migration from '../../../supabase/migrations/202607210001_quest_clinic_pairing.sql?raw'
import fourDigitMigration from '../../../supabase/migrations/202607270001_quest_four_digit_pairing.sql?raw'
import mixedSessionMigration from '../../../supabase/migrations/202609010001_mixed_pc_quest_sessions.sql?raw'

describe('contrato backend de la estación Quest', () => {
  it('usa códigos y credenciales efímeras almacenadas como hash', () => {
    expect(migration).toContain('create table if not exists public.quest_session_pairings')
    expect(migration).toContain("extensions.digest(raw_code, 'sha256')")
    expect(migration).toContain("extensions.digest(raw_device_token, 'sha256')")
    expect(migration).toContain("status in ('ready', 'claimed', 'captured', 'expired', 'revoked')")
  })

  it('expone un código numérico de cuatro dígitos, efímero y de un solo uso', () => {
    expect(fourDigitMigration).toContain("trim(pairing_code_input) !~ '^[0-9]{4}$'")
    expect(fourDigitMigration).toContain("where status = 'ready'")
    expect(fourDigitMigration).toContain("pairing.status = 'ready'")
    expect(fourDigitMigration).toContain("pairing.expires_at > now()")
    expect(fourDigitMigration).toContain("extensions.digest(raw_code, 'sha256')")
  })

  it('limita la preparación a profesional, presencial iniciada y plan Quest completo', () => {
    expect(migration).toContain('create or replace function public.create_quest_session_pairing')
    expect(migration).toContain('public.is_professional()')
    expect(migration).toContain('public.owns_patient(assignment_row.patient_id)')
    expect(migration).toContain("assignment_row.status = 'started'")
    expect(migration).toContain("coalesce(exercise ->> 'displayMode', 'standard') <> 'quest_browser'")
  })

  it('no entrega historia clínica y exige token de dispositivo para capturar', () => {
    expect(migration).toContain('create or replace function public.claim_quest_session_pairing')
    expect(migration).toContain("'patientLabel', target_patient_label")
    expect(migration).not.toContain("'fullName', target_patient_name")
    expect(migration).toContain('create or replace function public.submit_quest_session_capture')
    expect(migration).toContain("pairing.device_token_hash = encode(extensions.digest(device_token_input, 'sha256'), 'hex')")
  })

  it('deja el resultado capturado para revisión sin completar la asignación', () => {
    const submitSection = migration.split('create or replace function public.submit_quest_session_capture')[1].split('create or replace function public.revoke_quest_session_pairing')[0]
    expect(submitSection).toContain("set status = 'captured'")
    expect(submitSection).not.toContain('update public.session_assignments')
    expect(submitSection).toContain("'quest_session_capture_received'")
  })

  it('permite recuperar un resultado capturado después de recargar la pantalla profesional', () => {
    expect(migration).toContain('create or replace function public.find_quest_session_pairing_for_assignment')
    expect(migration).toContain("pairing.status in ('ready', 'claimed', 'captured')")
    expect(migration).toContain('public.owns_patient(assignment_row.patient_id)')
    expect(migration).toContain('grant execute on function public.find_quest_session_pairing_for_assignment(uuid) to authenticated')
  })

  it('acepta un único bloque Quest al final y no entrega al visor el bloque de PC', () => {
    expect(mixedSessionMigration).toContain('Los ejercicios Quest deben formar un único bloque al final de la sesión.')
    expect(mixedSessionMigration).toContain("coalesce(source.exercise ->> 'displayMode', 'standard') = 'quest_browser'")
    expect(mixedSessionMigration).toContain("'exercises', quest_exercises")
    expect(mixedSessionMigration).toContain("'quest_exercise_count'")
  })
})
