import { cognitiveInstruction, cognitiveTaskLabel } from './cognitive'
import type { ExerciseConfig } from './types'

export type ExerciseSetting = 'home' | 'in_person' | 'unspecified'
export type ExecutionFeasibility = 'ready' | 'review' | 'in_person_only' | 'not_executable'

export interface ExerciseExecutionPlan {
  feasibility: ExecutionFeasibility
  feasibilityLabel: string
  equipment: string[]
  setup: string
  response: string
  finish: string
  steps: string[]
  warnings: string[]
}

const headMovementPurposes = new Set<ExerciseConfig['purpose']>(['gaze_stabilization', 'gaze_stabilization_x2', 'gaze_substitution_remembered'])

export function buildExerciseExecutionPlan(config: ExerciseConfig, setting: ExerciseSetting = 'unspecified'): ExerciseExecutionPlan {
  const cognitive = config.cognitiveTaskMode !== 'none'
  const immersive = config.purpose === 'immersive_context'
  const warnings: string[] = []
  const equipment = config.displayMode === 'vr_box'
    ? ['Celular compatible en orientación horizontal', config.cardboardEnabled ? 'Visor compatible con Cardboard preparado y abierto' : 'VR Box preparado y abierto', 'Silla estable sobre superficie firme']
    : config.displayMode === 'quest_browser'
      ? [immersive ? 'Meta Quest con WebXR habilitado' : 'Meta Quest con navegador abierto', 'Silla estable sobre superficie firme', 'Profesional junto al paciente']
      : config.kind === 'guided_physical'
        ? ['Entorno despejado', config.surface === 'unstable' ? 'Superficie indicada por el profesional' : 'Superficie firme', config.supervision === 'independent_after_approval' ? 'Sin material adicional' : 'Ayudante o profesional indicado']
        : ['Pantalla 2D inmóvil', 'Silla estable', 'Sin material adicional']

  let feasibility: ExecutionFeasibility = 'ready'
  if (immersive) {
    feasibility = setting === 'home' ? 'not_executable' : 'in_person_only'
    warnings.push(setting === 'home'
      ? 'Los escenarios 360° de esta versión no se asignan al domicilio: requieren visor clínico, supervisión directa y comprobación del seguimiento.'
      : 'Es una exposición contextual clínica, no un ejercicio de RVO ni una simulación de marcha. El profesional controla postura, amplitud cefálica, techo de síntomas y detención.')
    if (config.displayMode === 'vr_box' && config.cardboardEnabled) warnings.push('Cardboard permite orientación 3DoF desde un punto fijo; no detecta traslación, no crea profundidad posicional y no debe usarse de pie ni caminando.')
    if (config.displayMode === 'quest_browser') warnings.push('El tiempo comienza después de que WebXR confirma la inmersión. El botón del visor y el menú del sistema permiten abandonar la experiencia.')
  }
  if (config.displayMode === 'vr_box') {
    if (config.cardboardEnabled) {
      warnings.push('Cardboard usa giroscopio y acelerómetro para un anclaje angular 3DoF relativo a una calibración frontal estable. El perfil local ajusta centros, campo visual y una corrección radial manual; no mide traslación 6DoF ni interpreta el código QR específico del visor.')
      warnings.push('Si se pierde la señal, el ejercicio se pausa y exige retirar el visor, mirar al frente y recalibrar.')
      if (config.purpose === 'gaze_stabilization') {
        feasibility = setting === 'home' ? 'not_executable' : 'in_person_only'
        warnings.unshift(setting === 'home'
          ? 'RVO x1 con Cardboard no se asigna al domicilio hasta validar latencia, deriva y recuperación del sensor en el teléfono utilizado.'
          : 'RVO x1 con Cardboard requiere supervisión profesional directa y comprobación del anclaje antes de iniciar la dosis.')
      }
    } else warnings.push('VR Box usa una presentación binocular 2D: no sigue la cabeza, no ancla el estímulo al ambiente y no corrige la óptica específica del visor.')
    warnings.push('Antes de comenzar, comprobar que los dos marcadores se fusionen en uno solo, nítido y cómodo. Si se ven dobles o borrosos, retirar el visor.')
  }
  if (config.displayMode !== 'standard' && cognitive) {
    feasibility = 'not_executable'
    warnings.push('La tarea cognitiva necesita leer la consigna y registrar o confirmar la respuesta fuera de un visor.')
  }
  if (config.purpose === 'visual_motion_fixation') {
    warnings.push('El blanco queda fijo respecto de los ojos y el fondo se mueve. La cabeza permanece quieta: no es RVO x1 ni estimulación optocinética pura.')
  }
  if (config.purpose === 'pursuit_visual_conflict') {
    warnings.push(`El blanco y el fondo forman una tarea combinada${config.targetBackgroundRelation === 'counter_phase' ? ' sincronizada en contrafase' : config.targetBackgroundRelation === 'in_phase' ? ' sincronizada en fase' : ''}. Seguir solamente el blanco con los ojos y mantener la cabeza quieta; no es seguimiento ocular aislado ni RVO.`)
  }
  if (config.purpose === 'optic_flow') {
    warnings.push('El flujo óptico radial se realiza sentado y con la cabeza quieta. No representa marcha, conducción, estimulación optocinética lineal ni una escena 360°.')
  }
  if (cognitive && config.kind === 'guided_physical') {
    feasibility = 'not_executable'
    warnings.push('Esta versión no combina figuras en pantalla con una tarea física: dividir la atención entre la pantalla y el entorno no es seguro.')
  }
  if (cognitive && config.cognitiveResponseMode === 'screen_tap' && headMovementPurposes.has(config.purpose)) {
    feasibility = 'not_executable'
    warnings.push('Tocar la pantalla interrumpe la posición y el movimiento cefálico; usar respuesta verbal o separar las tareas.')
  }
  const physicalConditionsRelevant = config.kind === 'guided_physical' || config.purpose === 'custom_free'
  if (physicalConditionsRelevant && (config.surface === 'unstable' || config.posture === 'walking')) {
    if (feasibility === 'ready') feasibility = 'review'
    warnings.push('La marcha o la superficie inestable requieren que el profesional defina la modalidad y la supervisión al armar la sesión.')
  }
  if (cognitive && config.purpose !== 'cognitive_visual' && feasibility === 'ready') {
    feasibility = 'review'
    warnings.push('Es una doble tarea. Confirmar primero que la tarea vestibular u oculomotora aislada sea comprendida y tolerada.')
  }
  if (config.cognitiveTaskMode === 'short_memory' && config.cognitiveMemorySpan > 1) {
    if (feasibility === 'ready') feasibility = 'review'
    warnings.push('Una memoria de dos o tres posiciones aumenta mucho la complejidad; comenzar por una posición salvo indicación profesional.')
  }

  const setup = config.displayMode === 'standard'
    ? `${config.posture === 'seated' ? 'Sentado' : config.posture === 'standing' ? 'De pie' : 'En marcha'}, en superficie ${config.surface === 'firm' ? 'firme' : 'inestable'}, con la pantalla inmóvil y el entorno despejado.`
    : immersive && config.displayMode === 'quest_browser'
      ? 'Sentado, con pies apoyados y profesional al lado. Abrir la estación Quest, confirmar la sesión y pulsar “Entrar en inmersión”; el tiempo no corre antes de WebXR.'
    : config.cardboardEnabled
      ? 'Sentado, sin desplazarse, permitir sensores y colocar Cardboard. Al terminar la cuenta regresiva, mirar el + de frente y mantener la cabeza quieta hasta la confirmación “3DoF activo”.'
      : 'Sentado, con el visor ajustado durante la transición guiada y sin desplazarse.'
  const response = cognitive
    ? cognitiveInstruction(config)
    : config.doseMode === 'repetitions'
      ? 'La persona cuenta sus repeticiones y confirma manualmente cuántas realizó.'
      : config.advanceMode === 'automatic'
        ? 'No requiere respuesta durante la fase; finaliza al agotarse el tiempo.'
        : 'Al terminar el tiempo, la persona confirma manualmente antes de continuar.'
  const finish = cognitive && config.cognitiveTaskMode === 'rare_target'
    ? 'Ingresar el total contado antes de pasar a la fase siguiente.'
    : cognitive && config.cognitiveResponseMode === 'screen_tap'
      ? 'La plataforma registra respuestas al objetivo y respuestas fuera del objetivo; no constituye una evaluación diagnóstica.'
      : immersive
        ? 'La fase termina automáticamente al agotarse la dosis. El paciente o profesional puede pausar o salir desde los controles del visor; no se repite el video automáticamente.'
      : config.displayMode === 'vr_box'
        ? config.cardboardEnabled
          ? 'La fase termina automáticamente. Para pausar, recentrar, omitir o salir, retirar primero el visor y usar los controles duplicados.'
          : 'La fase termina automáticamente; no se toca el celular mientras permanece dentro del visor.'
        : 'Confirmar la finalización antes de pasar a la fase siguiente.'

  return {
    feasibility,
    feasibilityLabel: feasibility === 'ready' ? 'Ejecución viable' : feasibility === 'review' ? 'Requiere revisión profesional' : feasibility === 'in_person_only' ? 'Solo presencial' : 'No ejecutable así',
    equipment,
    setup,
    response,
    finish,
    steps: [
      `Preparar: ${setup}`,
      `Tarea principal: ${config.patientInstruction || 'Falta definir la consigna principal.'}`,
      ...(cognitive ? [`Tarea cognitiva: ${cognitiveTaskLabel(config)}. ${cognitiveInstruction(config)}`] : []),
      `Finalización: ${finish}`,
    ],
    warnings,
  }
}
