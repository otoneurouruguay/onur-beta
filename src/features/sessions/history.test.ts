import { describe, expect, it } from 'vitest'
import { defaultExerciseConfig } from '../exercise/types'
import { buildExerciseHistory, exerciseDoseLabel, formatActiveTime } from './history'

describe('historial visual de una sesión', () => {
  it('reconstruye el resultado por ejercicio desde los eventos guardados', () => {
    const exercises = [
      { ...defaultExerciseConfig, name: 'RVO x1' },
      { ...defaultExerciseConfig, name: 'Marcha' },
      { ...defaultExerciseConfig, name: 'Barras' },
    ]
    const items = buildExerciseHistory({
      exercises,
      eventLog: [
        { type: 'exercise_completed', at: '2026-08-20T10:00:00Z', exercise_index: 0, active_seconds: 60 },
        { type: 'exercise_partial', at: '2026-08-20T10:02:00Z', exercise_index: 1, active_seconds: 25 },
        { type: 'exercise_skipped', at: '2026-08-20T10:03:00Z', exercise_index: 2 },
      ],
    })

    expect(items.map((item) => item.status)).toEqual(['completed', 'partial', 'skipped'])
    expect(items[1].event?.active_seconds).toBe(25)
  })

  it('marca parcial si una de varias series no se completó', () => {
    const [item] = buildExerciseHistory({
      exercises: [{ ...defaultExerciseConfig, rounds: 2 }],
      eventLog: [
        { type: 'exercise_completed', at: '2026-08-20T10:00:00Z', exercise_index: 0, round: 1 },
        { type: 'exercise_skipped', at: '2026-08-20T10:01:00Z', exercise_index: 0, round: 2 },
      ],
    })
    expect(item.status).toBe('partial')
    expect(item.events).toHaveLength(2)
  })

  it('distingue una carga retrospectiva de un historial antiguo sin detalle', () => {
    const exercises = [{ ...defaultExerciseConfig, name: 'Uno' }, { ...defaultExerciseConfig, name: 'Dos' }, { ...defaultExerciseConfig, name: 'Tres' }]
    const retrospective = buildExerciseHistory({
      exercises,
      eventLog: [{
        type: 'retrospective_session_recorded', at: '2026-08-20T10:00:00Z',
        performed_exercise_indexes: [0, 2],
        omitted_exercises: [{ exerciseIndex: 1, exerciseName: 'Dos', reason: 'No se realizó por fatiga' }],
      }],
    })

    expect(retrospective.map((item) => item.status)).toEqual(['recorded', 'skipped', 'recorded'])
    expect(retrospective[1].omissionReason).toBe('No se realizó por fatiga')
    expect(buildExerciseHistory({ exercises, eventLog: [] }).every((item) => item.status === 'unavailable')).toBe(true)
  })

  it('formatea dosis y tiempo activo sin redondeos engañosos', () => {
    expect(exerciseDoseLabel({ ...defaultExerciseConfig, durationSeconds: 45, rounds: 2 })).toBe('45 s × 2 series')
    expect(exerciseDoseLabel({ ...defaultExerciseConfig, doseMode: 'repetitions', targetRepetitions: 8, rounds: 1 })).toBe('8 repeticiones × 1 serie')
    expect(formatActiveTime(125)).toBe('2 min 5 s')
  })
})
