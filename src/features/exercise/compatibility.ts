import type { ExerciseConfig, ExercisePurpose } from './types'
import { getImmersiveScenario } from '../immersive/catalog'

export interface ExerciseCompatibilityIssue {
  code: string
  message: string
  correction: string
}

export interface ExerciseCompatibilityAnalysis {
  valid: boolean
  issues: ExerciseCompatibilityIssue[]
  explanation: string
  clinicalNote?: string
}

export const exercisePurposeLabels: Record<ExercisePurpose, string> = {
  gaze_stabilization: 'Estabilización de mirada · RVO x1',
  gaze_stabilization_x2: 'Estabilización de mirada · RVO x2',
  gaze_substitution_remembered: 'Objetivo recordado · sustitución (alias RVO x3)',
  smooth_pursuit: 'Seguimiento ocular suave',
  saccades: 'Sacadas',
  optokinetic: 'Estimulación optocinética',
  visual_habituation: 'Habituación a movimiento visual',
  immersive_context: 'Exposición contextual 360°',
  cognitive_visual: 'Tarea cognitivo-visual',
  guided_functional: 'Tarea física o funcional guiada',
  custom_free: 'Libre · configuración profesional no validada',
}

export const exercisePurposeDefaultNames: Record<ExercisePurpose, string> = {
  gaze_stabilization: 'RVO X1 · Punto fijo 2D',
  gaze_stabilization_x2: 'RVO X2 · Blanco y cabeza opuestos',
  gaze_substitution_remembered: 'Objetivo recordado · sustitución',
  smooth_pursuit: 'Seguimiento ocular suave',
  saccades: 'Sacadas visuales',
  optokinetic: 'Estimulación optocinética',
  visual_habituation: 'Habituación a movimiento visual',
  immersive_context: 'Exposición contextual 360°',
  cognitive_visual: 'Tarea cognitivo-visual',
  guided_functional: 'Tarea funcional guiada',
  custom_free: 'Libre · configuración profesional',
}

export const vrBoxPurposeCompatibility: Record<ExercisePurpose, { supported: boolean; reason: string }> = {
  gaze_stabilization: { supported: true, reason: 'Solo es ejecutable al activar Cardboard con seguimiento 3DoF, calibración frontal y supervisión presencial.' },
  gaze_stabilization_x2: { supported: false, reason: 'El movimiento del blanco no puede interpretarse respecto de una pantalla inmóvil.' },
  gaze_substitution_remembered: { supported: false, reason: 'Necesita una referencia estable, abrir/cerrar los ojos y confirmar cada repetición.' },
  smooth_pursuit: { supported: true, reason: 'El blanco se mueve respecto de los ojos mientras la cabeza permanece quieta.' },
  saccades: { supported: true, reason: 'El blanco cambia de posición respecto de los ojos mientras la cabeza permanece quieta.' },
  optokinetic: { supported: true, reason: 'El patrón se mueve respecto de los ojos y no necesita estar anclado al ambiente.' },
  visual_habituation: { supported: true, reason: 'El campo visual móvil puede presentarse como estímulo binocular 2D.' },
  immersive_context: { supported: true, reason: 'Requiere activar Cardboard con seguimiento 3DoF para explorar una esfera 360°.' },
  cognitive_visual: { supported: false, reason: 'La consigna y la respuesta necesitan una pantalla accesible fuera del visor.' },
  guided_functional: { supported: false, reason: 'El visor oculta el entorno necesario para realizar la tarea física.' },
  custom_free: { supported: true, reason: 'Admite estímulos visuales técnicamente ejecutables, sin equivalencia clínica automática.' },
}

export function isVrBoxPurposeSupported(purpose: ExercisePurpose) {
  return vrBoxPurposeCompatibility[purpose].supported
}

const purposeInstructions: Record<ExercisePurpose, string> = {
  gaze_stabilization: 'Mantené el blanco nítido mientras movés la cabeza según la indicación profesional.',
  gaze_stabilization_x2: 'Mantené nítido el blanco y mové la cabeza en la dirección opuesta a su recorrido.',
  gaze_substitution_remembered: 'Mirá el blanco, cerrá los ojos, girá la cabeza imaginando que seguís mirándolo y abrí los ojos para comprobar la precisión.',
  smooth_pursuit: 'Mantené la cabeza quieta y seguí el blanco únicamente con los ojos.',
  saccades: 'Mantené la cabeza quieta y llevá la mirada al blanco cada vez que cambie de posición.',
  optokinetic: 'Sentado y con la cabeza quieta, observá el patrón en movimiento sin perseguir un punto particular.',
  visual_habituation: 'Sentado y con la cabeza quieta, observá el movimiento visual durante el tiempo indicado.',
  immersive_context: 'Sentado y con supervisión directa, explorá el entorno 360° con movimientos lentos dentro de la amplitud indicada.',
  cognitive_visual: 'Mantené la cabeza quieta, observá cada figura y respondé según la consigna cognitiva.',
  guided_functional: 'Realizá la tarea indicada fuera de cualquier visor y con la supervisión prescripta.',
  custom_free: 'Realizá el ejercicio exactamente como fue indicado por el profesional.',
}

export function applyExercisePurpose(config: ExerciseConfig, purpose: ExercisePurpose): ExerciseConfig {
  const common = {
    ...config,
    purpose,
    name: exercisePurposeDefaultNames[purpose],
    patientInstruction: purposeInstructions[purpose],
    strobeEnabled: (purpose === 'visual_habituation' || purpose === 'custom_free') && config.strobeEnabled,
  }
  if (purpose === 'guided_functional') {
    return {
      ...common,
      kind: 'guided_physical',
      displayMode: 'standard',
      cardboardEnabled: false,
      doseMode: 'repetitions',
      advanceMode: 'manual',
    }
  }
  if (purpose === 'gaze_stabilization') {
    return {
      ...common,
      kind: 'visual_stimulus',
      displayMode: 'standard',
      cardboardEnabled: false,
      backgroundSpeed: 0,
      objectEnabled: true,
      objectMode: 'fixed',
    }
  }
  if (purpose === 'gaze_stabilization_x2') {
    return {
      ...common,
      kind: 'visual_stimulus',
      displayMode: 'standard',
      cardboardEnabled: false,
      backgroundSpeed: 0,
      objectEnabled: true,
      objectMode: 'tracking',
    }
  }
  if (purpose === 'gaze_substitution_remembered') {
    return {
      ...common,
      kind: 'visual_stimulus',
      displayMode: 'standard',
      cardboardEnabled: false,
      doseMode: 'repetitions',
      advanceMode: 'manual',
      backgroundSpeed: 0,
      objectEnabled: true,
      objectMode: 'fixed',
    }
  }
  if (purpose === 'custom_free') {
    return { ...common, kind: 'visual_stimulus' }
  }
  if (purpose === 'immersive_context') {
    const scenario = getImmersiveScenario(config.immersiveScenarioId) ?? getImmersiveScenario('street_quiet')!
    const preserveEnhancements = config.purpose === 'immersive_context'
    return {
      ...common,
      name: scenario.title,
      patientInstruction: scenario.patientInstruction,
      kind: 'visual_stimulus',
      displayMode: 'quest_browser',
      cardboardEnabled: false,
      doseMode: 'time',
      advanceMode: 'automatic',
      posture: 'seated',
      surface: 'firm',
      supervision: 'direct_clinician',
      backgroundType: 'solid',
      backgroundSpeed: 0,
      objectEnabled: preserveEnhancements && Boolean(scenario.spatialTargetAllowed) ? config.objectEnabled : false,
      objectMode: 'fixed',
      immersiveAudioEnabled: preserveEnhancements && Boolean(scenario.ambientAudio) && config.displayMode === 'quest_browser' ? config.immersiveAudioEnabled : false,
      metronomeEnabled: false,
      cognitiveTaskMode: 'none',
      durationSeconds: scenario.recommendedSeconds,
      restSeconds: 0,
      rounds: 1,
      immersiveScenarioId: scenario.id,
    }
  }
  if (purpose === 'cognitive_visual') {
    return {
      ...common,
      kind: 'visual_stimulus',
      displayMode: 'standard',
      cardboardEnabled: false,
      doseMode: 'time',
      advanceMode: 'manual',
      posture: 'seated',
      surface: 'firm',
      backgroundType: 'solid',
      backgroundSpeed: 0,
      objectEnabled: true,
      objectMode: 'fixed',
      metronomeEnabled: false,
      cognitiveTaskMode: config.cognitiveTaskMode === 'none' ? 'rare_target' : config.cognitiveTaskMode,
      cognitiveResponseMode: config.cognitiveTaskMode === 'go_no_go' || config.cognitiveTaskMode === 'short_memory' ? config.cognitiveResponseMode : 'count_at_end',
    }
  }
  if (purpose === 'smooth_pursuit') {
    return {
      ...common,
      kind: 'visual_stimulus',
      backgroundSpeed: 0,
      objectEnabled: true,
      objectMode: 'tracking',
    }
  }
  if (purpose === 'saccades') {
    return {
      ...common,
      kind: 'visual_stimulus',
      backgroundSpeed: 0,
      objectEnabled: true,
      objectMode: 'saccades',
    }
  }
  return {
    ...common,
    kind: 'visual_stimulus',
    backgroundType: config.backgroundType === 'solid' ? (purpose === 'optokinetic' ? 'bars' : 'checkerboard') : config.backgroundType,
    backgroundSpeed: Math.max(config.backgroundSpeed, purpose === 'optokinetic' ? 30 : 20),
    objectEnabled: false,
    objectMode: 'fixed',
  }
}

function issue(code: string, message: string, correction: string): ExerciseCompatibilityIssue {
  return { code, message, correction }
}

export function analyzeExerciseCompatibility(config: ExerciseConfig): ExerciseCompatibilityAnalysis {
  const issues: ExerciseCompatibilityIssue[] = []
  const headset = config.displayMode === 'vr_box' || config.displayMode === 'quest_browser'
  const deviceName = config.displayMode === 'vr_box' ? config.cardboardEnabled ? 'Cardboard con seguimiento 3DoF' : 'VR Box' : 'Meta Quest en modo navegador'
  const free = config.purpose === 'custom_free'
  const cognitive = config.cognitiveTaskMode !== 'none'
  const headMovementPurpose = ['gaze_stabilization', 'gaze_stabilization_x2', 'gaze_substitution_remembered'].includes(config.purpose)
  const rotationalDirection = config.backgroundDirection === 'clockwise' || config.backgroundDirection === 'counterclockwise'

  if (config.cardboardEnabled && config.displayMode !== 'vr_box') {
    issues.push(issue('cardboard-display-mode', 'El perfil Cardboard pertenece a la presentación VR Box y no puede aplicarse a una pantalla 2D o a Meta Quest.', 'Elegí VR Box o desactivá Cardboard.'))
  }

  if (!free && config.backgroundType === 'spiral' && !rotationalDirection) {
    issues.push(issue('spiral-direction', 'La espiral representa una rotación y no admite una dirección lineal o diagonal.', 'Elegí sentido horario o antihorario.'))
  }
  if (!free && config.backgroundType !== 'solid' && config.backgroundType !== 'spiral' && rotationalDirection) {
    issues.push(issue('linear-pattern-direction', 'Barras, damero y puntos se desplazan linealmente y no admiten sentido horario o antihorario.', 'Elegí una dirección horizontal, vertical o diagonal.'))
  }
  if (config.objectEnabled && config.objectMode === 'tracking' && (config.objectSpeedHz < 0.05 || config.objectSpeedHz > 2)) issues.push(issue('tracking-speed', 'La velocidad de seguimiento está fuera del rango implementado.', 'Elegí una frecuencia entre 0,05 y 2 Hz.'))
  if (config.metronomeEnabled && (config.metronomeHz < 0.1 || config.metronomeHz > 4)) issues.push(issue('metronome-rate', 'El ritmo del metrónomo está fuera del rango implementado.', 'Elegí entre 0,1 y 4 señales por segundo.'))
  if (config.metronomeEnabled && (config.metronomeToneHz < 220 || config.metronomeToneHz > 1760)) issues.push(issue('metronome-tone', 'El tono del metrónomo está fuera del rango audible configurado.', 'Elegí un tono entre 220 y 1760 Hz.'))

  if (config.strobeEnabled) {
    if (!free && config.purpose !== 'visual_habituation') issues.push(issue('strobe-purpose', 'La intermitencia visual experimental solo está habilitada como habituación visual.', 'Elegí Habituación a movimiento visual o desactivá la intermitencia.'))
    if (config.displayMode !== 'standard') issues.push(issue('strobe-headset', 'La intermitencia visual no se habilita dentro de visores por el campo visual amplio y la dificultad para retirar el estímulo con rapidez.', 'Usá Pantalla 2D.'))
    if (config.posture !== 'seated' || config.surface !== 'firm') issues.push(issue('strobe-position', 'La intermitencia visual experimental se limita a posición sentada y superficie firme.', 'Elegí postura sentada y superficie firme.'))
    if (config.supervision !== 'direct_clinician') issues.push(issue('strobe-supervision', 'La intermitencia visual experimental requiere supervisión profesional directa.', 'Elegí supervisión profesional directa y modalidad presencial.'))
    if (config.doseMode !== 'time' || config.advanceMode !== 'manual') issues.push(issue('strobe-dose', 'La intermitencia visual debe realizarse por tiempo y finalizar con confirmación manual.', 'Elegí Por tiempo y Confirmación manual.'))
    if (config.strobeFrequencyHz < 0.5 || config.strobeFrequencyHz > 2.5) issues.push(issue('strobe-frequency', 'La frecuencia supera el rango conservador implementado.', 'Elegí entre 0,5 y 2,5 Hz; la aplicación no permite más de 3 destellos por segundo.'))
    if (config.strobeDutyCyclePercent < 50 || config.strobeDutyCyclePercent > 80) issues.push(issue('strobe-duty', 'El porcentaje de imagen visible está fuera del rango implementado.', 'Elegí entre 50% y 80% de imagen visible.'))
    if (config.strobeContrastPercent < 5 || config.strobeContrastPercent > 35) issues.push(issue('strobe-contrast', 'El contraste de la interrupción está fuera del rango conservador implementado.', 'Elegí entre 5% y 35%.'))
    if (config.durationSeconds > 30 || config.rounds !== 1) issues.push(issue('strobe-duration', 'La variante experimental inicial se limita a una exposición de hasta 30 segundos y una sola vuelta.', 'Usá hasta 30 segundos y una vuelta.'))
  }

  if (free) {
    if (config.kind !== 'visual_stimulus') issues.push(issue('free-kind', 'El modo Libre de este constructor reproduce un estímulo visual.', 'Elegí estímulo visual o usá la finalidad funcional para una tarea física.'))
  } else if (config.purpose === 'guided_functional') {
    if (config.kind !== 'guided_physical') issues.push(issue('functional-kind', 'La finalidad funcional requiere una tarea física guiada.', 'Cambiá el tipo a ejercicio físico guiado.'))
    if (headset) issues.push(issue('functional-headset', `La tarea física no es coherente dentro de ${deviceName}: el visor oculta el entorno y la aplicación solo mostraría una instrucción.`, 'Usá Pantalla 2D y realizá la tarea fuera del visor.'))
  } else if (config.kind !== 'visual_stimulus') {
    issues.push(issue('visual-kind', 'El objetivo seleccionado requiere un estímulo visual.', 'Cambiá el tipo a estímulo visual.'))
  }

  if (config.purpose === 'gaze_stabilization') {
    if (config.displayMode === 'vr_box' && !config.cardboardEnabled) issues.push(issue('gaze-headset', 'RVO x1 no funciona en VR Box sin seguimiento: el blanco está unido al celular y acompaña la cabeza.', 'Activá Cardboard con seguimiento 3DoF o usá una pantalla 2D inmóvil.'))
    if (config.displayMode === 'vr_box' && config.cardboardEnabled && config.supervision !== 'direct_clinician') issues.push(issue('cardboard-gaze-supervision', 'RVO x1 con anclaje angular Cardboard todavía requiere validación presencial del sensor, latencia y deriva.', 'Usá supervisión profesional directa en clínica.'))
    if (config.displayMode === 'quest_browser') issues.push(issue('gaze-headset', 'RVO x1 no está habilitado en Quest: el reproductor actual no inicia una sesión WebXR ni controla o verifica que el blanco permanezca anclado al ambiente.', 'Usá una pantalla 2D inmóvil. Quest podrá habilitarse cuando la aplicación implemente y valide el anclaje espacial.'))
    if (!config.objectEnabled || config.objectMode !== 'fixed') issues.push(issue('gaze-target', 'RVO x1 necesita un blanco visible y fijo en la pantalla.', 'Activá el blanco y elegí comportamiento Fijo.'))
    if (config.backgroundSpeed > 0) issues.push(issue('gaze-background', 'Un fondo móvil cambia la tarea y deja de ser un RVO x1 aislado.', 'Llevá la velocidad del fondo a 0.'))
  }

  if (config.purpose === 'gaze_stabilization_x2') {
    if (headset) issues.push(issue('gaze-x2-headset', `RVO x2 no es coherente dentro de ${deviceName}: la referencia visual queda unida al visor y su movimiento ya no puede interpretarse respecto de una pantalla inmóvil.`, 'Usá una pantalla 2D inmóvil.'))
    if (!config.objectEnabled || config.objectMode !== 'tracking') issues.push(issue('gaze-x2-target', 'RVO x2 necesita un blanco visible con movimiento continuo mientras la cabeza se mueve en sentido opuesto.', 'Activá el blanco y elegí Seguimiento.'))
    if (config.backgroundSpeed > 0) issues.push(issue('gaze-x2-background', 'Un fondo móvil añade otra señal visual y deja de aislar la tarea RVO x2.', 'Llevá la velocidad del fondo a 0.'))
  }

  if (config.purpose === 'gaze_substitution_remembered') {
    if (headset) issues.push(issue('remembered-headset', `El objetivo recordado no es ejecutable dentro de ${deviceName}: requiere cerrar y abrir los ojos, comparar con una referencia estable y confirmar cada intento.`, 'Usá Pantalla 2D, por repeticiones y con confirmación manual.'))
    if (!config.objectEnabled || config.objectMode !== 'fixed') issues.push(issue('remembered-target', 'El objetivo recordado necesita un blanco visible y fijo como referencia.', 'Activá el blanco y elegí comportamiento Fijo.'))
    if (config.backgroundSpeed > 0) issues.push(issue('remembered-background', 'El objetivo recordado necesita una referencia simple y estable.', 'Llevá la velocidad del fondo a 0.'))
    if (config.doseMode !== 'repetitions' || config.advanceMode !== 'manual') issues.push(issue('remembered-dose', 'La serie de objetivos recordados debe ser contada y confirmada por la persona.', 'Elegí repeticiones y confirmación manual.'))
  }

  if (config.purpose === 'smooth_pursuit') {
    if (!config.objectEnabled || config.objectMode !== 'tracking') issues.push(issue('pursuit-target', 'El seguimiento suave necesita un blanco visible con movimiento continuo.', 'Activá el blanco y elegí Seguimiento.'))
    if (config.backgroundSpeed > 0) issues.push(issue('pursuit-background', 'El fondo móvil agrega estimulación visual y no permite aislar el seguimiento ocular.', 'Llevá la velocidad del fondo a 0.'))
  }

  if (config.purpose === 'saccades') {
    if (!config.objectEnabled || config.objectMode !== 'saccades') issues.push(issue('saccade-target', 'El ejercicio de sacadas necesita un blanco que cambie de posición.', 'Activá el blanco y elegí Sacadas.'))
    if (config.backgroundSpeed > 0) issues.push(issue('saccade-background', 'El fondo móvil agrega una demanda diferente y no permite aislar las sacadas.', 'Llevá la velocidad del fondo a 0.'))
  }

  if (config.purpose === 'optokinetic' || config.purpose === 'visual_habituation') {
    if (config.backgroundType === 'solid' || config.backgroundSpeed <= 0) issues.push(issue('visual-motion', 'Este objetivo necesita un patrón que se mueva respecto de los ojos; una imagen estática no produce el estímulo previsto.', 'Elegí barras, damero, espiral o puntos y una velocidad mayor que 0.'))
    if (config.objectEnabled) issues.push(issue('visual-fixation', 'El blanco fijo puede suprimir o distraer del estímulo de campo visual.', 'Ocultá el blanco para que el patrón móvil sea el estímulo principal.'))
  }

  if (config.purpose === 'immersive_context') {
    const scenario = getImmersiveScenario(config.immersiveScenarioId)
    if (!scenario) issues.push(issue('immersive-scenario', 'La exposición 360° necesita un escenario aprobado del catálogo.', 'Elegí un escenario disponible en la Biblioteca 360°.'))
    if (!headset) issues.push(issue('immersive-headset', 'La exposición contextual 360° necesita un visor con seguimiento de cabeza; una pantalla 2D no representa la experiencia indicada.', 'Elegí Quest WebXR o VR Box con Cardboard 3DoF.'))
    if (config.displayMode === 'vr_box' && !config.cardboardEnabled) issues.push(issue('immersive-cardboard', 'VR Box sin seguimiento mantiene la imagen unida al celular y no permite explorar una esfera 360° de forma coherente.', 'Activá Cardboard con seguimiento 3DoF.'))
    if (config.doseMode !== 'time' || config.advanceMode !== 'automatic') issues.push(issue('immersive-dose', 'La exposición 360° se ejecuta por tiempo y finaliza automáticamente dentro del visor.', 'Elegí Por tiempo y avance automático.'))
    if (config.rounds !== 1) issues.push(issue('immersive-rounds', 'Esta primera versión no repite un escenario dentro de la misma sesión porque reiniciaría WebXR o reproduciría nuevamente el video.', 'Usá una sola vuelta y registrá otra sesión si el profesional decide repetirla.'))
    if (config.supervision !== 'direct_clinician') issues.push(issue('immersive-supervision', 'La biblioteca contextual 360° inicial es exclusivamente clínica y requiere supervisión profesional directa.', 'Elegí supervisión profesional directa y modalidad presencial.'))
    if (config.metronomeEnabled || cognitive) issues.push(issue('immersive-extra-task', 'La exposición contextual inicial no agrega metrónomo ni tarea cognitiva dentro del visor.', 'Desactivá la señal rítmica y la tarea cognitiva.'))
    if (config.objectEnabled) {
      if (!scenario?.spatialTargetAllowed || scenario.motion !== 'static') issues.push(issue('immersive-target-scene', 'La referencia espacial solo está habilitada en escenas de cámara fija revisadas para este uso.', 'Ocultá la referencia o elegí una escena estática compatible.'))
      if (config.objectMode !== 'fixed') issues.push(issue('immersive-target-mode', 'La referencia contextual debe permanecer fija en el espacio del escenario.', 'Elegí comportamiento Fijo.'))
      if (config.immersiveTargetAzimuthDegrees < -120 || config.immersiveTargetAzimuthDegrees > 120 || config.immersiveTargetElevationDegrees < -45 || config.immersiveTargetElevationDegrees > 45) issues.push(issue('immersive-target-position', 'La referencia está fuera del campo angular configurable.', 'Elegí azimut entre -120° y 120° y elevación entre -45° y 45°.'))
    }
    if (config.immersiveAudioEnabled) {
      if (!scenario?.ambientAudio) issues.push(issue('immersive-audio-missing', 'Este escenario no tiene un sonido ambiente con licencia y procedencia verificadas.', 'Desactivá el sonido o elegí una escena que lo incluya.'))
      if (config.displayMode !== 'quest_browser') issues.push(issue('immersive-audio-device', 'El sonido ambiente se habilita inicialmente solo en Quest, donde el botón de inmersión puede desbloquear la reproducción de forma confiable.', 'Usá Quest o desactivá el sonido para VR Box.'))
      if (config.immersiveAudioVolume < 0 || config.immersiveAudioVolume > 50) issues.push(issue('immersive-audio-volume', 'El volumen ambiente supera el límite técnico conservador.', 'Elegí un volumen entre 0% y 50%.'))
    }
    if (scenario && (config.durationSeconds < 10 || config.durationSeconds > scenario.maximumSeconds)) issues.push(issue('immersive-duration', `Este escenario admite entre 10 y ${scenario.maximumSeconds} segundos en la versión validada.`, `Elegí una duración de hasta ${scenario.maximumSeconds} segundos.`))
  }

  if (config.purpose === 'cognitive_visual') {
    if (!cognitive) issues.push(issue('cognitive-missing', 'La finalidad cognitivo-visual necesita una tarea cognitiva definida.', 'Elegí objetivo raro, Go/No-Go o memoria breve.'))
    if (config.displayMode !== 'standard') issues.push(issue('cognitive-purpose-headset', 'La tarea cognitivo-visual se implementa en Pantalla 2D para presentar la consigna y registrar la respuesta de forma clara.', 'Usá Pantalla 2D.'))
    if (!config.objectEnabled || config.objectMode !== 'fixed') issues.push(issue('cognitive-purpose-target', 'La tarea cognitivo-visual aislada necesita figuras visibles en una posición estable.', 'Activá el blanco y elegí comportamiento Fijo.'))
    if (config.backgroundType !== 'solid' || config.backgroundSpeed > 0) issues.push(issue('cognitive-purpose-background', 'La tarea cognitiva inicial necesita un fondo simple para no añadir una segunda demanda visual.', 'Usá fondo de color sólido y velocidad 0.'))
    if (config.posture !== 'seated' || config.surface !== 'firm') issues.push(issue('cognitive-purpose-position', 'La tarea cognitiva inicial está diseñada sentado y en superficie firme.', 'Elegí postura sentada y superficie firme.'))
    if (config.metronomeEnabled) issues.push(issue('cognitive-purpose-metronome', 'La tarea cognitiva aislada no necesita una señal rítmica adicional.', 'Desactivá el metrónomo.'))
  }

  if (cognitive) {
    if (config.kind !== 'visual_stimulus') issues.push(issue('cognitive-physical', 'Esta versión no presenta figuras cognitivas durante una tarea física porque obliga a dividir la mirada entre la pantalla y el entorno.', 'Usá una tarea cognitivo-visual sentada o planificá la doble tarea presencial fuera de la plataforma.'))
    if (config.displayMode !== 'standard') issues.push(issue('cognitive-headset', 'Las tareas cognitivas necesitan mostrar la consigna y registrar o confirmar la respuesta; el flujo actual no lo resuelve de forma fiable dentro del visor.', 'Usá Pantalla 2D.'))
    if (!config.objectEnabled) issues.push(issue('cognitive-object', 'La tarea cognitiva necesita figuras visibles.', 'Activá el blanco.'))
    if (config.doseMode !== 'time' || config.advanceMode !== 'manual') issues.push(issue('cognitive-completion', 'La tarea cognitiva necesita una fase temporizada y confirmación final para registrar la respuesta.', 'Elegí Por tiempo y Confirmación manual.'))
    if (config.cognitiveTaskMode === 'rare_target' && config.cognitiveResponseMode !== 'count_at_end') issues.push(issue('cognitive-count', 'La detección de objetivo raro se completa informando el total observado.', 'Elegí Contar e informar al terminar.'))
    if (config.cognitiveResponseMode === 'screen_tap' && headMovementPurpose) issues.push(issue('cognitive-touch-head', 'Tocar la pantalla mientras se mueve la cabeza interrumpe la posición de ejecución y agrega una tarea manual no controlada.', 'Elegí respuesta verbal o usá una tarea cognitivo-visual aislada.'))
    if (config.cognitiveStimulusSeconds < 0.75 || config.cognitiveStimulusSeconds > 6) issues.push(issue('cognitive-pace', 'El intervalo de las figuras está fuera del rango técnico implementado.', 'Elegí un intervalo entre 0,75 y 6 segundos.'))
  }

  if (headset && config.kind === 'visual_stimulus' && config.posture !== 'seated') {
    issues.push(issue('headset-posture', `Los estímulos visuales en ${deviceName} están limitados a posición sentada en esta versión.`, 'Elegí posición sentada o usá Pantalla 2D.'))
  }

  if (headset && config.kind === 'visual_stimulus' && config.surface !== 'firm') {
    issues.push(issue('headset-surface', `Los estímulos visuales en ${deviceName} requieren una superficie firme en esta versión.`, 'Elegí superficie firme o usá Pantalla 2D.'))
  }

  if (config.displayMode === 'vr_box' && config.doseMode !== 'time') issues.push(issue('vr-dose', 'VR Box solo admite ejercicios por tiempo porque el paciente no puede confirmar repeticiones con el celular dentro del visor.', 'Elegí Por tiempo o Pantalla 2D.'))
  if (config.displayMode === 'vr_box' && config.advanceMode !== 'automatic') issues.push(issue('vr-advance', `${config.cardboardEnabled ? 'Cardboard' : 'VR Box'} debe finalizar automáticamente; sus controles son solo para pausar, recentrar, omitir o salir.`, 'Elegí avance automático.'))
  if (config.displayMode === 'vr_box' && config.metronomeEnabled) issues.push(issue('vr-metronome', 'El audio del navegador puede quedar bloqueado después de colocar el celular en VR Box y no es necesario para estos estímulos visuales.', 'Desactivá el metrónomo en VR Box.'))

  let explanation = 'La configuración técnica coincide con el objetivo seleccionado.'
  if (config.purpose === 'gaze_stabilization' && config.displayMode === 'standard') explanation = 'El blanco queda fijo en una pantalla inmóvil mientras el paciente mueve la cabeza: la referencia espacial es coherente con RVO x1.'
  if (config.purpose === 'gaze_stabilization' && config.displayMode === 'vr_box' && config.cardboardEnabled) explanation = 'Cardboard contrarresta yaw, pitch y roll respecto de la calibración frontal para mantener el blanco en una dirección virtual estable. Es anclaje angular 3DoF y requiere comprobación presencial del dispositivo.'
  if (config.purpose === 'gaze_stabilization_x2' && config.displayMode === 'standard') explanation = 'El blanco se desplaza en una pantalla inmóvil y la persona mueve la cabeza en sentido opuesto: configuración digital coherente con RVO x2.'
  if (config.purpose === 'gaze_substitution_remembered' && config.displayMode === 'standard') explanation = 'El blanco estable permite mirar, cerrar los ojos, girar la cabeza y comprobar la precisión al reabrirlos.'
  if ((config.purpose === 'smooth_pursuit' || config.purpose === 'saccades') && headset) explanation = `El blanco se mueve respecto de los ojos dentro de ${deviceName}; el paciente debe mantener la cabeza quieta.`
  if ((config.purpose === 'optokinetic' || config.purpose === 'visual_habituation') && headset) explanation = `El patrón se mueve respecto de los ojos dentro de ${deviceName}; no necesita estar anclado al ambiente y se realiza sentado, con la cabeza quieta.`
  if (config.strobeEnabled && issues.length === 0) explanation = 'La intermitencia reduce parcialmente la información visual en una pantalla 2D, dentro de límites conservadores y con supervisión profesional directa.'
  if (config.purpose === 'cognitive_visual' && config.displayMode === 'standard') explanation = 'Las figuras se presentan en una pantalla inmóvil, sentado, con una consigna y una respuesta definidas antes de comenzar.'
  if (config.purpose === 'guided_functional' && config.displayMode === 'standard') explanation = 'La tarea se realiza fuera del visor, con el entorno visible y confirmación manual cuando corresponde.'
  if (config.purpose === 'immersive_context' && config.displayMode === 'quest_browser') explanation = `Quest inicia una sesión WebXR inmersiva: la esfera permanece en el espacio virtual y la vista cambia con el seguimiento 6DoF del visor.${config.objectEnabled ? ' La referencia opcional queda anclada a una dirección del escenario; no es un ejercicio de RVO.' : ''}`
  if (config.purpose === 'immersive_context' && config.displayMode === 'vr_box' && config.cardboardEnabled) explanation = `Cardboard usa la orientación 3DoF del celular para explorar la esfera 360° desde un punto fijo. No mide desplazamiento corporal ni convierte la escena en una tarea de marcha.${config.objectEnabled ? ' La referencia queda anclada angularmente al escenario, no a la pantalla.' : ''}`
  if (free) explanation = issues.length === 0
    ? 'Modo Libre: la configuración puede guardarse y ejecutarse, pero la plataforma no valida su equivalencia con un protocolo clínico.'
    : 'El modo Libre permite guardar cualquier combinación; esta combinación no puede ejecutarse con seguridad técnica en el dispositivo seleccionado.'

  const clinicalNote = config.strobeEnabled
    ? 'Modalidad experimental con evidencia vestibular no establecida. Excluir antecedentes de epilepsia fotosensible, respuesta adversa a destellos, aura o fotofobia activa; detener ante cefalea, náusea marcada, síntomas visuales o neurológicos nuevos. No usar durante una crisis de migraña vestibular.'
    : config.purpose === 'gaze_stabilization' && config.displayMode === 'vr_box' && config.cardboardEnabled
    ? 'Implementación experimental y presencial: el anclaje es angular 3DoF, no posición 6DoF. Antes de indicar dosis, el profesional debe seleccionar el perfil teléfono–visor y comprobar fusión, centro óptico, permiso de sensores, latencia, deriva, recentrado y pérdida de seguimiento.'
    : free
    ? 'Revisión profesional obligatoria. “Libre” no convierte la combinación en RVO x1, RVO x2, sustitución, habituación ni estimulación optocinética.'
    : config.purpose === 'gaze_substitution_remembered'
      ? '“RVO x3” es un alias docente no estandarizado. La tarea se registra como sustitución por objetivo recordado, no como una adaptación tres veces mayor ni como progresión automática de RVO x2.'
      : config.purpose === 'smooth_pursuit' || config.purpose === 'saccades'
    ? 'No debe presentarse como sustituto de la estabilización de mirada: el seguimiento y las sacadas con la cabeza quieta no equivalen a un ejercicio de adaptación del RVO.'
      : config.purpose === 'optokinetic' || config.purpose === 'visual_habituation'
      ? 'La intensidad y el tiempo deben respetar el techo de síntomas y las reglas de detención definidas por el profesional.'
      : config.purpose === 'immersive_context'
        ? 'La exposición contextual 360° es un complemento clínicamente gobernado para habituación e integración sensorial. No diagnostica, no reemplaza ejercicios específicos de estabilización de mirada y no autoriza progresión automática por intensidad.'
      : config.purpose === 'cognitive_visual' || cognitive
        ? 'La tarea cognitiva es un recurso de entrenamiento y doble tarea, no una prueba diagnóstica. Su combinación con una tarea vestibular requiere dominio previo de la tarea aislada.'
      : undefined

  if (issues.length > 0 && !free) explanation = 'La finalidad declarada, el estímulo y el dispositivo no representan la misma tarea.'
  return { valid: issues.length === 0, issues, explanation, clinicalNote }
}
