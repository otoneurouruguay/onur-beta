import { describe, expect, it } from 'vitest'
import { applyExercisePurpose } from './compatibility'
import { buildExerciseExecutionPlan } from './execution'
import { defaultExerciseConfig } from './types'

describe('plan práctico de ejecución', () => {
  it('describe material, respuesta y finalización de un objetivo raro domiciliario', () => {
    const config = applyExercisePurpose(defaultExerciseConfig, 'cognitive_visual')
    const plan = buildExerciseExecutionPlan(config, 'home')
    expect(plan.feasibility).toBe('ready')
    expect(plan.equipment).toContain('Sin material adicional')
    expect(plan.response).toContain('Contá mentalmente')
    expect(plan.finish).toContain('Ingresar el total')
  })

  it('identifica como doble tarea una consigna cognitiva combinada con RVO', () => {
    const config = { ...defaultExerciseConfig, cognitiveTaskMode: 'go_no_go' as const, cognitiveResponseMode: 'verbal' as const, advanceMode: 'manual' as const }
    const plan = buildExerciseExecutionPlan(config, 'home')
    expect(plan.feasibility).toBe('review')
    expect(plan.warnings.join(' ')).toContain('tarea vestibular u oculomotora aislada')
  })

  it('rechaza una respuesta táctil mientras la cabeza está en movimiento', () => {
    const config = { ...defaultExerciseConfig, cognitiveTaskMode: 'go_no_go' as const, cognitiveResponseMode: 'screen_tap' as const, advanceMode: 'manual' as const }
    expect(buildExerciseExecutionPlan(config, 'home').feasibility).toBe('not_executable')
  })

  it('deja la modalidad y supervisión de las tareas dinámicas a criterio profesional', () => {
    const functional = { ...applyExercisePurpose(defaultExerciseConfig, 'guided_functional'), posture: 'walking' as const }
    const plan = buildExerciseExecutionPlan(functional, 'home')
    expect(plan.feasibility).toBe('review')
    expect(plan.warnings.join(' ')).toContain('defina la modalidad y la supervisión')
  })

  it('explica una ejecución VR Box sin controles ni falsa promesa de anclaje espacial', () => {
    const config = { ...applyExercisePurpose(defaultExerciseConfig, 'optokinetic'), displayMode: 'vr_box' as const, doseMode: 'time' as const, advanceMode: 'automatic' as const }
    const plan = buildExerciseExecutionPlan(config, 'home')
    expect(plan.feasibility).toBe('ready')
    expect(plan.finish).toContain('termina automáticamente')
    expect(plan.warnings.join(' ')).toContain('presentación binocular 2D')
    expect(plan.warnings.join(' ')).toContain('fusionen en uno solo')
  })

  it('identifica la corrección radial manual sin prometer calibración QR ni posición 6DoF', () => {
    const config = { ...applyExercisePurpose(defaultExerciseConfig, 'optokinetic'), displayMode: 'vr_box' as const, cardboardEnabled: true, doseMode: 'time' as const, advanceMode: 'automatic' as const }
    const plan = buildExerciseExecutionPlan(config, 'home')
    expect(plan.equipment).toContain('Visor compatible con Cardboard preparado y abierto')
    expect(plan.warnings.join(' ')).toContain('perfil local ajusta centros, campo visual y una corrección radial manual')
    expect(plan.warnings.join(' ')).toContain('interpreta el código QR específico')
    expect(plan.warnings.join(' ')).toContain('anclaje angular 3DoF')
    expect(plan.warnings.join(' ')).toContain('no mide traslación 6DoF')
  })

  it('explica la logística de fijación ante fondo móvil sin rotularla como RVO', () => {
    const config = applyExercisePurpose(defaultExerciseConfig, 'visual_motion_fixation')
    const plan = buildExerciseExecutionPlan(config, 'home')
    expect(plan.feasibility).toBe('ready')
    expect(plan.steps.join(' ')).toContain('Mantené la cabeza quieta')
    expect(plan.warnings.join(' ')).toContain('no es RVO x1')
  })

  it('explica que el seguimiento con fondo móvil es una tarea combinada', () => {
    const config = applyExercisePurpose(defaultExerciseConfig, 'pursuit_visual_conflict')
    const plan = buildExerciseExecutionPlan(config, 'in_person')
    expect(plan.feasibility).toBe('ready')
    expect(plan.steps.join(' ')).toContain('seguí el blanco')
    expect(plan.warnings.join(' ')).toContain('tarea combinada')
  })

  it('diferencia el flujo óptico radial de marcha, 360° y optocinético lineal', () => {
    const plan = buildExerciseExecutionPlan(applyExercisePurpose(defaultExerciseConfig, 'optic_flow'))
    expect(plan.warnings.join(' ')).toContain('No representa marcha')
    expect(plan.warnings.join(' ')).toContain('estimulación optocinética lineal')
  })
})
