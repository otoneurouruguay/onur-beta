import { describe, expect, it } from 'vitest'
import { calculateSaccadePosition, calculateTrackingPosition, clampObjectPosition, strobeOcclusionAlphaAt } from './engine'
import { cognitiveInstruction, cognitiveStepAt, cognitiveSymbolAtStep, isCognitiveTargetStep } from './cognitive'
import { applyExercisePurpose } from './compatibility'
import { defaultExerciseConfig } from './types'

describe('motor de posiciones del ejercicio', () => {
  it('mantiene el seguimiento vertical centrado en el eje horizontal', () => {
    const point = calculateTrackingPosition(0.25, 1000, 500, 'vertical', 1, 30)
    expect(point.x).toBe(500)
    expect(point.y).toBeCloseTo(400)
  })

  it.each([
    ['diagonal_down', 1],
    ['diagonal_up', -1],
  ] as const)('mueve el blanco sobre el eje %s sin aumentar artificialmente la amplitud', (direction, ySign) => {
    const point = calculateTrackingPosition(0.25, 1000, 500, direction, 1, 20)
    expect(point.x).toBeCloseTo(500 + 200 * Math.SQRT1_2)
    expect(point.y).toBeCloseTo(250 + 100 * Math.SQRT1_2 * ySign)
  })

  it('alterna sacadas horizontales según la frecuencia indicada', () => {
    const first = calculateSaccadePosition(0, 1000, 500, 1, 'horizontal', 25)
    const second = calculateSaccadePosition(1, 1000, 500, 1, 'horizontal', 25)
    expect(first).toEqual({ x: 250, y: 250 })
    expect(second).toEqual({ x: 750, y: 250 })
  })

  it('produce posiciones aleatorias deterministas para una misma etapa', () => {
    const first = calculateSaccadePosition(3.2, 1000, 500, 0.8, 'random', 30)
    const second = calculateSaccadePosition(3.2, 1000, 500, 0.8, 'random', 30)
    expect(first).toEqual(second)
  })

  it('mantiene el blanco completo dentro de cada mitad del visor', () => {
    expect(clampObjectPosition({ x: -20, y: 500 }, 320, 180, 90)).toEqual({ x: 47, y: 133 })
    expect(clampObjectPosition({ x: 160, y: 90 }, 320, 180, 90)).toEqual({ x: 160, y: 90 })
  })

  it('aplica la intermitencia solo durante la fase de oclusión configurada', () => {
    const config = { ...defaultExerciseConfig, strobeEnabled: true, strobeFrequencyHz: 1, strobeDutyCyclePercent: 70, strobeContrastPercent: 20 }
    expect(strobeOcclusionAlphaAt(config, 0.5)).toBe(0)
    expect(strobeOcclusionAlphaAt(config, 0.8)).toBe(0.2)
    expect(strobeOcclusionAlphaAt({ ...config, strobeEnabled: false }, 0.8)).toBe(0)
  })

  it.each([
    ['diagonal_down', 1],
    ['diagonal_up', -1],
  ] as const)('alterna sacadas sobre el eje %s', (pattern, ySign) => {
    const first = calculateSaccadePosition(0, 1000, 500, 1, pattern, 20)
    const second = calculateSaccadePosition(1, 1000, 500, 1, pattern, 20)
    expect(first.x).toBeLessThan(500)
    expect(second.x).toBeGreaterThan(500)
    expect(Math.sign(second.y - 250)).toBe(ySign)
  })

  it('presenta un objetivo raro determinista una vez cada cinco figuras', () => {
    const config = { ...applyExercisePurpose(defaultExerciseConfig, 'cognitive_visual'), cognitiveTaskMode: 'rare_target' as const, cognitiveTargetSymbol: 'diamond' as const }
    const targets = Array.from({ length: 15 }, (_, step) => isCognitiveTargetStep(config, step))
    expect(targets.filter(Boolean)).toHaveLength(3)
    expect(cognitiveSymbolAtStep(config, 3)).toBe('diamond')
    expect(cognitiveStepAt(5.1, 2.5)).toBe(2)
  })

  it('genera coincidencias controladas para memoria breve', () => {
    const config = { ...applyExercisePurpose(defaultExerciseConfig, 'cognitive_visual'), cognitiveTaskMode: 'short_memory' as const, cognitiveMemorySpan: 1 as const }
    expect(isCognitiveTargetStep(config, 3)).toBe(true)
    expect(cognitiveSymbolAtStep(config, 3)).toBe(cognitiveSymbolAtStep(config, 2))
  })

  it('usa el artículo correcto en la consigna de cada figura', () => {
    const config = { ...applyExercisePurpose(defaultExerciseConfig, 'cognitive_visual'), cognitiveTaskMode: 'go_no_go' as const, cognitiveTargetSymbol: 'star' as const, cognitiveResponseMode: 'verbal' as const }
    expect(cognitiveInstruction(config)).toContain('la estrella')
    expect(cognitiveInstruction({ ...config, cognitiveTargetSymbol: 'diamond' })).toContain('el rombo')
  })
})
