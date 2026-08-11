import { describe, expect, it } from 'vitest'
import { defaultExerciseConfig, normalizeExerciseConfig } from './types'

describe('configuración base del ejercicio',()=>{
  it('inicia en 2D, con 10 segundos de preparación y el metrónomo desactivado',()=>{expect(defaultExerciseConfig.displayMode).toBe('standard');expect(defaultExerciseConfig.preparationSeconds).toBe(10);expect(defaultExerciseConfig.metronomeEnabled).toBe(false)})
  it('mantiene Cardboard apagado en configuraciones antiguas y conserva una selección explícita',()=>{expect(defaultExerciseConfig.cardboardEnabled).toBe(false);expect(normalizeExerciseConfig({displayMode:'vr_box'}).cardboardEnabled).toBe(false);expect(normalizeExerciseConfig({displayMode:'vr_box',cardboardEnabled:true}).cardboardEnabled).toBe(true)})
  it('normaliza frecuencias antiguas dentro de los rangos seguros del constructor',()=>{expect(normalizeExerciseConfig({objectSpeedHz:0,metronomeHz:9,metronomeToneHz:4000,strobeFrequencyHz:6})).toMatchObject({objectSpeedHz:0.05,metronomeHz:4,metronomeToneHz:1760,strobeFrequencyHz:2.5})})
})
