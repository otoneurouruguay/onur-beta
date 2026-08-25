import { describe, expect, it } from 'vitest'
import { applyExercisePurpose } from '../exercise/compatibility'
import { defaultExerciseConfig } from '../exercise/types'
import { appendExerciseTemplate, DEFAULT_SESSION_TITLE, sessionValuesFromExerciseSelection } from './builder'
import type { SessionFormValues } from './schema'

const baseValues = (): SessionFormValues => ({
  title: DEFAULT_SESSION_TITLE,
  instructions: '',
  mode: 'home',
  treatmentCycleId: 'cycle',
  availableFrom: '2026-07-27',
  availableUntil: '',
  exercises: [{ ...defaultExerciseConfig }],
})

const immersive = (name: string) => ({
  ...applyExercisePurpose(defaultExerciseConfig, 'immersive_context'),
  name,
})

describe('constructor de sesiones', () => {
  it('reemplaza solamente el ejercicio inicial de ejemplo al elegir el primer escenario 360°', () => {
    const result = appendExerciseTemplate(baseValues(), immersive('Supermercado fijo'))
    expect(result.values.exercises.map((exercise) => exercise.name)).toEqual(['Supermercado fijo'])
    expect(result.values.mode).toBe('in_person')
    expect(result.values.title).toBe('Exposición 360° · Supermercado fijo')
    expect(result.selectedIndex).toBe(0)
  })

  it('acumula un segundo escenario PPPD sin borrar el primero', () => {
    const first = appendExerciseTemplate(baseValues(), immersive('Supermercado fijo'))
    const second = appendExerciseTemplate(first.values, immersive('Calle tranquila'))
    expect(second.values.exercises.map((exercise) => exercise.name)).toEqual(['Supermercado fijo', 'Calle tranquila'])
    expect(second.selectedIndex).toBe(1)
  })

  it('no borra ejercicios intencionales si luego se agrega un escenario', () => {
    const values = baseValues()
    values.exercises[0] = { ...defaultExerciseConfig, name: 'RVO personalizado' }
    const result = appendExerciseTemplate(values, immersive('Farmacia'))
    expect(result.values.exercises.map((exercise) => exercise.name)).toEqual(['RVO personalizado', 'Farmacia'])
  })

  it('conserva una secuencia mixta al agregar varias plantillas consecutivas', () => {
    const values = baseValues()
    values.exercises[0] = { ...defaultExerciseConfig, name: 'RVO x1 horizontal' }
    const second = appendExerciseTemplate(values, { ...defaultExerciseConfig, name: 'RVO x2 vertical' })
    const third = appendExerciseTemplate(second.values, immersive('Supermercado caminando'))

    expect(third.values.exercises.map((exercise) => exercise.name)).toEqual([
      'RVO x1 horizontal',
      'RVO x2 vertical',
      'Supermercado caminando',
    ])
    expect(third.selectedIndex).toBe(2)
  })

  it('transfiere toda la selección por patología a una sesión y conserva el orden', () => {
    const values = sessionValuesFromExerciseSelection([
      { ...defaultExerciseConfig, name: 'RVO x1' },
      { ...defaultExerciseConfig, name: 'Equilibrio funcional', kind: 'guided_physical' },
    ], '2026-08-25')

    expect(values.exercises.map((exercise) => exercise.name)).toEqual(['RVO x1', 'Equilibrio funcional'])
    expect(values.exercises.every((exercise) => exercise.selectionOrigin === 'manual')).toBe(true)
    expect(values.mode).toBe('home')
  })

  it('fuerza modalidad presencial si la selección incluye una exposición reservada para clínica', () => {
    const values = sessionValuesFromExerciseSelection([immersive('Mercado')], '2026-08-25')
    expect(values.mode).toBe('in_person')
  })
})
