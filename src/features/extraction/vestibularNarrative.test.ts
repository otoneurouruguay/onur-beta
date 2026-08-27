import { describe, expect, it } from 'vitest'
import { sanitizeVestibularNarrative } from './vestibularNarrative'

describe('narrativa vestibular', () => {
  it('conserva una frase completa sobre cancelación del VOR', () => {
    expect(sanitizeVestibularNarrative(
      'Hallazgo vestibular sintético. Cancelación del VOR normal.',
      'conclusion',
    )).toBe('Hallazgo vestibular sintético. Cancelación del VOR normal.')
  })

  it('elimina únicamente el fragmento aislado Cancelación', () => {
    expect(sanitizeVestibularNarrative(
      'Hallazgo vestibular sintético. Cancelación',
      'conclusion',
    )).toBe('Hallazgo vestibular sintético.')
  })
})
