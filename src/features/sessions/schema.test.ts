import { describe, expect, it } from 'vitest'
import { applyExercisePurpose } from '../exercise/compatibility'
import { defaultExerciseConfig, type ExerciseConfig } from '../exercise/types'
import { validateSession } from './schema'

const session = (exercises: ExerciseConfig[], mode: 'home' | 'in_person' = 'home') => ({
  title: 'Sesión 1', instructions: '', mode, treatmentCycleId: 'cycle',
  availableFrom: '2026-07-16', availableUntil: '', exercises,
})

const config = (overrides: Partial<ExerciseConfig> = {}): ExerciseConfig => ({ ...defaultExerciseConfig, ...overrides })
const optokinetic = (overrides: Partial<ExerciseConfig> = {}): ExerciseConfig => ({ ...applyExercisePurpose(defaultExerciseConfig, 'optokinetic'), ...overrides })
const physical = (overrides: Partial<ExerciseConfig> = {}): ExerciseConfig => ({ ...applyExercisePurpose(defaultExerciseConfig, 'guided_functional'), ...overrides })
const free = (overrides: Partial<ExerciseConfig> = {}): ExerciseConfig => ({ ...applyExercisePurpose(defaultExerciseConfig, 'custom_free'), ...overrides })
const cognitive = (overrides: Partial<ExerciseConfig> = {}): ExerciseConfig => ({ ...applyExercisePurpose(defaultExerciseConfig, 'cognitive_visual'), ...overrides })
const immersive = (overrides: Partial<ExerciseConfig> = {}): ExerciseConfig => ({ ...applyExercisePurpose(defaultExerciseConfig, 'immersive_context'), ...overrides })

describe('validación de sesión',()=>{
  it.each([
    ['pantalla 2D por tiempo', config()],
    ['pantalla 2D por repeticiones', config({ doseMode: 'repetitions', advanceMode: 'manual' })],
    ['VR Box visual por tiempo', optokinetic({ displayMode: 'vr_box', doseMode: 'time', advanceMode: 'automatic' })],
    ['Cardboard visual por tiempo', optokinetic({ displayMode: 'vr_box', cardboardEnabled: true, doseMode: 'time', advanceMode: 'automatic' })],
    ['físico sentado independiente', physical({ doseMode: 'repetitions', posture: 'seated' })],
    ['físico de pie con ayudante', physical({ posture: 'standing', supervision: 'trained_helper' })],
    ['marcha domiciliaria con ayudante', physical({ posture: 'walking', supervision: 'trained_helper' })],
    ['objetivo raro cognitivo sentado', cognitive()],
  ])('acepta %s', (_label, exercise) => expect(validateSession(session([exercise]))).toEqual({}))

  it('acepta Quest por tiempo dentro de una sesión presencial supervisada', () => {
    const exercise = optokinetic({ displayMode: 'quest_browser', doseMode: 'time', advanceMode: 'automatic', posture: 'seated', surface: 'firm', supervision: 'direct_clinician' })
    expect(validateSession(session([exercise], 'in_person'))).toEqual({})
  })

  it('acepta una o varias exposiciones 360° presenciales en Quest o Cardboard', () => {
    expect(validateSession(session([immersive()], 'in_person'))).toEqual({})
    expect(validateSession(session([immersive({ name: 'Escenario 1' }), immersive({ name: 'Escenario 2' })], 'in_person'))).toEqual({})
    expect(validateSession(session([immersive({ displayMode: 'vr_box', cardboardEnabled: true })], 'in_person'))).toEqual({})
    expect(validateSession(session([
      immersive({ name: 'Escenario 1', displayMode: 'vr_box', cardboardEnabled: true }),
      immersive({ name: 'Escenario 2', displayMode: 'vr_box', cardboardEnabled: true }),
    ], 'in_person'))).toEqual({})
  })

  it('simula sesiones separadas y ejecutables para Galaxy S21+ y PC de consultorio', () => {
    const galaxy360 = immersive({
      name: 'Calle tranquila · Galaxy S21+',
      immersiveScenarioId: 'street_quiet',
      displayMode: 'vr_box',
      cardboardEnabled: true,
      durationSeconds: 30,
      doseMode: 'time',
      advanceMode: 'automatic',
      posture: 'seated',
      surface: 'firm',
      supervision: 'direct_clinician',
    })
    const galaxyVrBox = optokinetic({
      name: 'Barras horizontales · VR Box',
      displayMode: 'vr_box',
      cardboardEnabled: false,
      durationSeconds: 30,
      doseMode: 'time',
      advanceMode: 'automatic',
      posture: 'seated',
      surface: 'firm',
    })
    const desktop = config({
      name: 'RVO x1 · PC inmóvil',
      displayMode: 'standard',
      cardboardEnabled: false,
      durationSeconds: 30,
      doseMode: 'time',
      advanceMode: 'manual',
      posture: 'seated',
      surface: 'firm',
    })

    expect(validateSession(session([galaxy360], 'in_person'))).toEqual({})
    expect(validateSession(session([galaxyVrBox], 'in_person'))).toEqual({})
    expect(validateSession(session([desktop], 'in_person'))).toEqual({})
  })

  it('bloquea exposición 360° domiciliaria, mezclada o sin seguimiento Cardboard', () => {
    expect(validateSession(session([immersive()], 'home')).exercises).toContain('únicamente en clínica')
    expect(validateSession(session([immersive(), optokinetic({ displayMode: 'quest_browser', supervision: 'direct_clinician', advanceMode: 'automatic' })], 'in_person')).exercises).toContain('no se mezcla')
    expect(validateSession(session([immersive({ displayMode: 'vr_box', cardboardEnabled: false })], 'in_person')).exercises).toContain('Cardboard 3DoF')
  })

  it('acepta RVO x1 Cardboard solo en sesión presencial supervisada', () => {
    const exercise = config({ displayMode: 'vr_box', cardboardEnabled: true, doseMode: 'time', advanceMode: 'automatic', posture: 'seated', surface: 'firm', supervision: 'direct_clinician' })
    expect(validateSession(session([exercise], 'in_person'))).toEqual({})
    expect(validateSession(session([exercise], 'home')).exercises).toContain('no se asigna al domicilio')
  })

  it('rechaza una fecha final anterior',()=>expect(validateSession({...session([defaultExerciseConfig]),availableUntil:'2026-07-15'}).availableUntil).toBeTruthy())

  it.each([
    ['repeticiones dentro de VR Box', optokinetic({ displayMode: 'vr_box', doseMode: 'repetitions', advanceMode: 'manual' }), 'VR Box'],
    ['avance manual dentro de VR Box', optokinetic({ displayMode: 'vr_box', doseMode: 'time', advanceMode: 'manual' }), 'automáticamente'],
    ['Quest domiciliario', optokinetic({ displayMode: 'quest_browser', doseMode: 'time', advanceMode: 'automatic', posture: 'seated', surface: 'firm', supervision: 'direct_clinician' }), 'solo para sesiones presenciales'],
    ['superficie inestable sin ayuda', physical({ surface: 'unstable', supervision: 'independent_after_approval' }), 'inestables'],
    ['marcha domiciliaria independiente', physical({ posture: 'walking', supervision: 'independent_after_approval' }), 'marcha domiciliaria'],
    ['modo Libre inestable sin ayuda', free({ surface: 'unstable', supervision: 'independent_after_approval' }), 'inestables'],
    ['modo Libre en marcha domiciliaria independiente', free({ posture: 'walking', supervision: 'independent_after_approval' }), 'marcha domiciliaria'],
    ['RVO x1 dentro de VR Box', config({ displayMode: 'vr_box', advanceMode: 'automatic' }), 'acompaña la cabeza'],
    ['tarea física dentro de VR Box', physical({ displayMode: 'vr_box', doseMode: 'time', advanceMode: 'automatic' }), 'oculta el entorno'],
    ['tarea cognitiva dentro de VR Box', cognitive({ displayMode: 'vr_box', advanceMode: 'automatic' }), 'cognitivo-visual'],
    ['Go/No-Go táctil durante RVO x1', config({ cognitiveTaskMode: 'go_no_go', cognitiveResponseMode: 'screen_tap', advanceMode: 'manual' }), 'Tocar la pantalla'],
  ])('rechaza %s', (_label, exercise, message) => expect(validateSession(session([exercise])).exercises).toContain(message))

  it('rechaza Quest por repeticiones aun con supervisión presencial', () => {
    const exercise = optokinetic({ displayMode: 'quest_browser', doseMode: 'repetitions', advanceMode: 'manual', posture: 'seated', surface: 'firm', supervision: 'direct_clinician' })
    expect(validateSession(session([exercise], 'in_person')).exercises).toContain('por tiempo')
  })

  it('bloquea RVO x1 en Quest porque el navegador 2D no inicia WebXR', () => {
    const exercise = config({
      displayMode: 'quest_browser',
      doseMode: 'time',
      advanceMode: 'automatic',
      posture: 'seated',
      surface: 'firm',
      supervision: 'direct_clinician',
    })
    expect(validateSession(session([exercise], 'in_person')).exercises).toContain('no inicia una sesión WebXR')
  })

  it('bloquea tareas físicas en visor incluso con supervisión presencial', () => {
    const exercise = physical({ displayMode: 'vr_box', posture: 'standing', supervision: 'direct_clinician', doseMode: 'time', advanceMode: 'automatic' })
    expect(validateSession(session([exercise], 'in_person')).exercises).toContain('oculta el entorno')
  })

  it('no mezcla VR Box y Cardboard dentro de una misma sesión', () => {
    const vrBox = optokinetic({ displayMode: 'vr_box', doseMode: 'time', advanceMode: 'automatic' })
    const cardboard = optokinetic({ displayMode: 'vr_box', cardboardEnabled: true, doseMode: 'time', advanceMode: 'automatic' })
    expect(validateSession(session([vrBox, cardboard])).exercises).toContain('único perfil de visor')
  })

  it('no mezcla Quest con ejercicios para otro dispositivo', () => {
    const questExercise = optokinetic({
      displayMode: 'quest_browser',
      doseMode: 'time',
      advanceMode: 'automatic',
      posture: 'seated',
      surface: 'firm',
      supervision: 'direct_clinician',
    })
    expect(validateSession(session([questExercise, defaultExerciseConfig], 'in_person')).exercises).toContain('exclusivamente ejercicios Quest')
  })

  it('ignora condiciones físicas residuales al volver a un estímulo visual', () => {
    const exercise = config({ kind: 'visual_stimulus', surface: 'unstable', posture: 'walking', supervision: 'independent_after_approval' })
    expect(validateSession(session([exercise]))).toEqual({})
  })
})
