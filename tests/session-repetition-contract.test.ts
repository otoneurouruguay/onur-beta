import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/202608260001_session_repetition_series.sql'), 'utf8')

describe('contrato de repetición de sesiones en backend', () => {
  it('crea ocurrencias independientes y limita la serie a 35 fechas', () => {
    expect(migration).toContain('repeat_session_assignment_as_home')
    expect(migration).toContain('series_size > 35')
    expect(migration).toContain("'assigned'")
    expect(migration).toContain('max_completions')
  })

  it('no copia ejecuciones y conserva trazabilidad hacia la sesión original', () => {
    expect(migration).not.toMatch(/insert\s+into\s+public\.session_executions/i)
    expect(migration).toContain('repeat_source_assignment_id')
    expect(migration).toContain("'session_assignment_repeated_as_home'")
  })

  it('es idempotente y valida permisos, fechas y sesiones libres', () => {
    expect(migration).toContain('existing_assignment_ids')
    expect(migration).toContain('public.owns_patient')
    expect(migration).toContain("source_kind = 'free_note'")
    expect(migration).toContain('scheduled.value < local_today')
  })
})
