import { describe, expect, it } from 'vitest'
import migration from '../../../supabase/migrations/202607280001_session_revocation_reason.sql?raw'

describe('contrato backend de anulación de sesiones', () => {
  it('conserva motivo, autor y fecha con una restricción consistente', () => {
    expect(migration).toContain('revoked_reason text')
    expect(migration).toContain('revoked_by uuid references auth.users')
    expect(migration).toContain('session_assignments_revocation_complete')
    expect(migration).toContain("status = 'revoked'")
    expect(migration).toContain('char_length(btrim(revoked_reason)) between 8 and 500')
  })

  it('anula sin borrar y registra auditoría y vínculos Quest activos', () => {
    expect(migration).toContain('create or replace function public.revoke_session_assignment')
    expect(migration).not.toMatch(/delete\s+from\s+public\.session_assignments/i)
    expect(migration).toContain("'session_assignment_revoked'")
    expect(migration).toContain("'previous_status', assignment_row.status")
    expect(migration).toContain("status in ('ready', 'claimed')")
  })
})
