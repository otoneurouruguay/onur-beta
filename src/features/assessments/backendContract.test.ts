import { describe, expect, it } from 'vitest'
import migration from '../../../supabase/migrations/202608270001_dhi_assessment_workflow.sql?raw'
import repositorySource from './repository.ts?raw'

describe('contrato seguro del flujo DHI', () => {
  it('retira los registros del cuestionario anterior antes de cambiar el esquema', () => {
    expect(migration).toContain("delete from public.audit_events where entity_type = 'patient_assessment'")
    expect(migration).toContain('delete from public.patient_assessments')
    expect(migration.indexOf('delete from public.patient_assessments')).toBeLessThan(migration.indexOf("alter column instrument_code set default 'DHI_AR_25'"))
  })

  it('crea, completa y cancela mediante funciones auditadas del servidor', () => {
    for (const functionName of ['create_assessment_assignment', 'complete_assessment', 'cancel_assessment']) {
      expect(migration).toContain(`create or replace function public.${functionName}`)
      expect(migration).toMatch(new RegExp(`function public\\.${functionName}[\\s\\S]*?security definer`, 'i'))
      expect(repositorySource).toContain(`supabase.rpc('${functionName}'`)
    }
    expect(migration).toContain("'assessment_assigned'")
    expect(migration).toContain("'assessment_completed'")
    expect(migration).toContain("'assessment_cancelled'")
  })

  it('calcula el DHI en el servidor y separa el acceso profesional del domiciliario', () => {
    expect(migration).not.toContain('jsonb_object_length')
    expect(migration).toContain('select count(*) from jsonb_each')
    expect(migration).toContain('public.valid_dhi_responses(responses_input, true)')
    expect(migration).toContain("filter (where entry.key like 'P%')")
    expect(migration).toContain("filter (where entry.key like 'E%')")
    expect(migration).toContain("filter (where entry.key like 'F%')")
    expect(migration).toContain('public.is_patient_self(target.patient_id)')
    expect(migration).toContain('public.owns_patient(target.patient_id) and public.is_professional()')
  })
})
