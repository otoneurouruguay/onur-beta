import { describe, expect, it } from 'vitest'
import { defaultExerciseConfig } from '../exercise/types'
import type { SessionAssignmentRecord } from './repository'
import { addDaysToDateKey, consecutiveDateKeys, groupSessionAssignments, repetitionScheduleDates, validateRepetitionDates } from './repetition'

const assignment = (overrides: Partial<SessionAssignmentRecord> = {}): SessionAssignmentRecord => ({
  id: crypto.randomUUID(), patientId: 'patient-1', patientName: 'Paciente', treatmentCycleId: 'cycle-1', sessionPlanId: crypto.randomUUID(),
  title: 'Sesión', instructions: 'Indicaciones', kind: 'exercise', mode: 'home', exercises: [defaultExerciseConfig],
  availableFrom: '2026-08-27T03:00:00.000Z', availableUntil: '2026-08-28T02:59:59.000Z', status: 'assigned', createdAt: '2026-08-26T12:00:00.000Z',
  activeSeconds: 0, completedAt: '', initialDiscomfort: null, finalDiscomfort: null, perceivedDifficulty: null, patientComment: '',
  ...overrides,
})

describe('programación de repeticiones', () => {
  it('genera días consecutivos sin depender de la zona horaria del navegador', () => {
    expect(consecutiveDateKeys('2026-12-30', 4)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
    expect(addDaysToDateKey('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('ordena y elimina duplicados de la selección manual', () => {
    expect(repetitionScheduleDates({ mode: 'custom', startDate: '', count: 7, customDates: ['2026-08-29', '2026-08-27', '2026-08-29'] })).toEqual(['2026-08-27', '2026-08-29'])
  })

  it('rechaza fechas pasadas, repetidas y series mayores a 35', () => {
    expect(validateRepetitionDates(['2026-08-25'], '2026-08-26')).toMatch(/desde hoy/i)
    expect(validateRepetitionDates(['2026-08-27', '2026-08-27'], '2026-08-26')).toMatch(/misma fecha/i)
    expect(validateRepetitionDates(Array.from({ length: 36 }, (_, index) => `2026-09-${String(index + 1).padStart(2, '0')}`), '2026-08-26')).toMatch(/35/)
  })

  it('agrupa una serie y cuenta realizadas sin mezclar sesiones independientes', () => {
    const seriesId = crypto.randomUUID()
    const groups = groupSessionAssignments([
      assignment({ id: 'standalone' }),
      assignment({ id: 'series-2', repeatSeriesId: seriesId, repeatSeriesPosition: 2, repeatSeriesSize: 3, status: 'completed' }),
      assignment({ id: 'series-1', repeatSeriesId: seriesId, repeatSeriesPosition: 1, repeatSeriesSize: 3, status: 'partial' }),
      assignment({ id: 'series-3', repeatSeriesId: seriesId, repeatSeriesPosition: 3, repeatSeriesSize: 3 }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[1]).toMatchObject({ seriesId, expectedCount: 3, realizedCount: 2 })
    expect(groups[1].assignments.map((item) => item.id)).toEqual(['series-1', 'series-2', 'series-3'])
  })
})
