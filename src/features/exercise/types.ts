import type { CardboardViewerProfile } from './cardboardViewerProfiles'

export type BackgroundType = 'solid' | 'bars' | 'spiral' | 'checkerboard' | 'dots' | 'radial_flow'
export type BackgroundMotionMode = 'continuous' | 'oscillating'
export type LinearMotionDirection = 'left' | 'right' | 'up' | 'down' | 'up_left' | 'up_right' | 'down_left' | 'down_right'
export type RadialMotionDirection = 'toward' | 'away'
export type MotionDirection = LinearMotionDirection | 'clockwise' | 'counterclockwise' | RadialMotionDirection
export type TargetBackgroundRelation = 'independent' | 'in_phase' | 'counter_phase'
export type ObjectMode = 'fixed' | 'tracking' | 'saccades'
export type ObjectDirection = 'horizontal' | 'vertical' | 'diagonal_down' | 'diagonal_up'
export type SaccadePattern = ObjectDirection | 'random'
export type ExerciseDisplayMode = 'standard' | 'vr_box' | 'quest_browser'
export type QuestPresentationMode = 'panel_2d' | 'immersive_webxr'
export type QuestImmersiveGeometry = 'curved_panel' | 'cylinder' | 'sphere' | 'front_disc' | 'particle_tunnel'
export type QuestImmersiveCoverage = 90 | 180 | 360
export type PreparationSeconds = 0 | 5 | 10 | 20
export type ExerciseKind = 'visual_stimulus' | 'guided_physical'
export type ExercisePurpose = 'gaze_stabilization' | 'gaze_stabilization_x2' | 'gaze_substitution_remembered' | 'smooth_pursuit' | 'visual_motion_fixation' | 'pursuit_visual_conflict' | 'saccades' | 'optokinetic' | 'optic_flow' | 'visual_habituation' | 'immersive_context' | 'cognitive_visual' | 'guided_functional' | 'custom_free'
export type ExerciseDoseMode = 'time' | 'repetitions'
export type ExerciseAdvanceMode = 'automatic' | 'manual'
export type ExercisePosture = 'seated' | 'standing' | 'walking'
export type ExerciseSurface = 'firm' | 'unstable'
export type ExerciseSupervision = 'independent_after_approval' | 'trained_helper' | 'direct_clinician'
export type CognitiveTaskMode = 'none' | 'rare_target' | 'go_no_go' | 'short_memory'
export type CognitiveResponseMode = 'count_at_end' | 'verbal' | 'screen_tap'
export type CognitiveSymbol = 'circle' | 'square' | 'triangle' | 'diamond' | 'star'
export type ImmersiveTargetShape = 'circle' | 'diamond' | 'cross'
export type ExerciseSelectionOrigin = 'suggested' | 'suggested_modified' | 'manual' | 'free'

export interface CognitivePerformanceReport {
  mode: Exclude<CognitiveTaskMode, 'none'>
  responseMode: CognitiveResponseMode
  targetEvents: number
  responseCount?: number
  correctResponses?: number
  falseAlarms?: number
  reportedCount?: number
}

export interface ExerciseCompletionReport {
  doseMode: ExerciseDoseMode
  completion: 'target_completed' | 'partial' | 'skipped'
  targetRepetitions?: number
  reportedRepetitions?: number
  cognitive?: CognitivePerformanceReport
  headTracking?: {
    mode: 'orientation_3dof'
    spatialAnchor: 'calibrated_direction'
    recenterCount: number
    trackingLossCount: number
    finalStatus: 'tracking' | 'lost' | 'unavailable'
    opticalProfile: {
      name: string
      imageSeparationPercent: number
      verticalOffsetPercent: number
      horizontalFovDegrees: number
      verticalFovDegrees: number
      lensDistortionPercent: number
    }
  }
  immersive?: {
    scenarioId: string
    rendering: 'webxr_6dof' | 'cardboard_3dof'
    ambientAudioEnabled: boolean
    ambientAudioVolume?: number
    spatialTargetEnabled: boolean
    spatialTargetAzimuthDegrees?: number
    spatialTargetElevationDegrees?: number
  }
}

export interface ExerciseConfig {
  name: string
  selectionOrigin?: ExerciseSelectionOrigin
  clinicalEpisodeId?: string
  clinicalSuggestionId?: string
  clinicalRationale?: string
  targetImpairment?: string
  clinicalDoseNote?: string
  clinicalProgressionNote?: string
  clinicalRegressionNote?: string
  clinicalProtocol?: 'pppd' | 'stroboscopic_experimental'
  progressionLevel?: 1 | 2 | 3
  progressionCriteria?: string
  stopCriteria?: string
  kind: ExerciseKind
  purpose: ExercisePurpose
  patientInstruction: string
  displayMode: ExerciseDisplayMode
  questPresentationMode: QuestPresentationMode
  questImmersiveGeometry: QuestImmersiveGeometry
  questImmersiveCoverage: QuestImmersiveCoverage
  questBackgroundAngularSpeed: number
  questPatternAngularSize: number
  questTargetAngularSize: number
  questTargetAmplitudeDegrees: number
  questHeadStillGuard: boolean
  cardboardEnabled: boolean
  cardboardViewerProfile?: CardboardViewerProfile
  doseMode: ExerciseDoseMode
  targetRepetitions: number
  advanceMode: ExerciseAdvanceMode
  posture: ExercisePosture
  surface: ExerciseSurface
  supervision: ExerciseSupervision
  backgroundType: BackgroundType
  backgroundDirection: MotionDirection
  backgroundSpeed: number
  backgroundMotionMode: BackgroundMotionMode
  backgroundFrequencyHz: number
  backgroundAmplitudePercent: number
  backgroundRampSeconds: number
  backgroundCoveragePercent: number
  backgroundContrastPercent: number
  targetBackgroundRelation: TargetBackgroundRelation
  stripeWidth: number
  foregroundColor: string
  backgroundColor: string
  strobeEnabled: boolean
  strobeFrequencyHz: number
  strobeDutyCyclePercent: number
  strobeContrastPercent: number
  objectEnabled: boolean
  objectMode: ObjectMode
  objectColor: string
  objectSize: number
  objectDirection: ObjectDirection
  objectSpeedHz: number
  objectAmplitude: number
  saccadePattern: SaccadePattern
  saccadeFrequencyHz: number
  preparationSeconds: PreparationSeconds
  durationSeconds: number
  restSeconds: number
  rounds: number
  metronomeEnabled: boolean
  metronomeHz: number
  metronomeToneHz: number
  cognitiveTaskMode: CognitiveTaskMode
  cognitiveTargetSymbol: CognitiveSymbol
  cognitiveResponseMode: CognitiveResponseMode
  cognitiveStimulusSeconds: number
  cognitiveMemorySpan: 1 | 2 | 3
  immersiveScenarioId?: string
  immersiveAudioEnabled: boolean
  immersiveAudioVolume: number
  immersiveTargetAzimuthDegrees: number
  immersiveTargetElevationDegrees: number
  immersiveTargetShape: ImmersiveTargetShape
}

export const defaultExerciseConfig: ExerciseConfig = {
  name: 'RVO X1 · Punto fijo 2D',
  kind: 'visual_stimulus',
  purpose: 'gaze_stabilization',
  patientInstruction: 'Mantené el blanco nítido mientras movés la cabeza según la indicación profesional.',
  displayMode: 'standard',
  questPresentationMode: 'panel_2d',
  questImmersiveGeometry: 'cylinder',
  questImmersiveCoverage: 180,
  questBackgroundAngularSpeed: 12,
  questPatternAngularSize: 12,
  questTargetAngularSize: 3,
  questTargetAmplitudeDegrees: 25,
  questHeadStillGuard: true,
  cardboardEnabled: false,
  doseMode: 'time',
  targetRepetitions: 10,
  advanceMode: 'manual',
  posture: 'seated',
  surface: 'firm',
  supervision: 'independent_after_approval',
  backgroundType: 'solid',
  backgroundDirection: 'left',
  backgroundSpeed: 0,
  backgroundMotionMode: 'continuous',
  backgroundFrequencyHz: 0.25,
  backgroundAmplitudePercent: 25,
  backgroundRampSeconds: 0,
  backgroundCoveragePercent: 100,
  backgroundContrastPercent: 100,
  targetBackgroundRelation: 'independent',
  stripeWidth: 54,
  foregroundColor: '#0a1214',
  backgroundColor: '#F7F6F4',
  strobeEnabled: false,
  strobeFrequencyHz: 1,
  strobeDutyCyclePercent: 70,
  strobeContrastPercent: 20,
  objectEnabled: true,
  objectMode: 'fixed',
  objectColor: '#ef3e45',
  objectSize: 38,
  objectDirection: 'horizontal',
  objectSpeedHz: 0.5,
  objectAmplitude: 32,
  saccadePattern: 'horizontal',
  saccadeFrequencyHz: 0.8,
  preparationSeconds: 10,
  durationSeconds: 60,
  restSeconds: 30,
  rounds: 3,
  metronomeEnabled: false,
  metronomeHz: 1,
  metronomeToneHz: 660,
  cognitiveTaskMode: 'none',
  cognitiveTargetSymbol: 'diamond',
  cognitiveResponseMode: 'count_at_end',
  cognitiveStimulusSeconds: 2.5,
  cognitiveMemorySpan: 1,
  immersiveAudioEnabled: false,
  immersiveAudioVolume: 20,
  immersiveTargetAzimuthDegrees: 0,
  immersiveTargetElevationDegrees: 0,
  immersiveTargetShape: 'circle',
}

export function inferExercisePurpose(config: Partial<ExerciseConfig>): ExercisePurpose {
  if (config.purpose) return config.purpose
  if (config.kind === 'guided_physical') return 'guided_functional'
  if (config.objectMode === 'tracking') return 'smooth_pursuit'
  if (config.objectMode === 'saccades') return 'saccades'
  if (isBackgroundMotionActive(config)) return 'optokinetic'
  return 'gaze_stabilization'
}

export function isBackgroundMotionActive(config: Partial<ExerciseConfig>) {
  if (!config.backgroundType || config.backgroundType === 'solid') return false
  if (config.backgroundMotionMode === 'oscillating') {
    return Number(config.backgroundFrequencyHz ?? defaultExerciseConfig.backgroundFrequencyHz) > 0
      && Number(config.backgroundAmplitudePercent ?? defaultExerciseConfig.backgroundAmplitudePercent) > 0
  }
  return Number(config.backgroundSpeed) > 0
}

export function normalizeExerciseConfig(config: Partial<ExerciseConfig>, legacyPreparationSeconds: PreparationSeconds = 0): ExerciseConfig {
  const preparationSeconds = [0, 5, 10, 20].includes(Number(config.preparationSeconds))
    ? Number(config.preparationSeconds) as PreparationSeconds
    : legacyPreparationSeconds
  return {
    ...defaultExerciseConfig,
    ...config,
    purpose: inferExercisePurpose(config),
    questPresentationMode: config.purpose === 'immersive_context'
      ? 'immersive_webxr'
      : config.questPresentationMode === 'immersive_webxr' ? 'immersive_webxr' : 'panel_2d',
    questImmersiveGeometry: ['curved_panel', 'cylinder', 'sphere', 'front_disc', 'particle_tunnel'].includes(String(config.questImmersiveGeometry))
      ? config.questImmersiveGeometry as QuestImmersiveGeometry
      : 'cylinder',
    questImmersiveCoverage: [90, 180, 360].includes(Number(config.questImmersiveCoverage))
      ? Number(config.questImmersiveCoverage) as QuestImmersiveCoverage
      : 180,
    questBackgroundAngularSpeed: Math.max(1, Math.min(60, Number(config.questBackgroundAngularSpeed ?? 12))),
    questPatternAngularSize: Math.max(1, Math.min(45, Number(config.questPatternAngularSize ?? 12))),
    questTargetAngularSize: Math.max(0.5, Math.min(12, Number(config.questTargetAngularSize ?? 3))),
    questTargetAmplitudeDegrees: Math.max(2, Math.min(75, Number(config.questTargetAmplitudeDegrees ?? 25))),
    questHeadStillGuard: config.questHeadStillGuard !== false,
    cardboardEnabled: config.cardboardEnabled === true,
    strobeEnabled: config.strobeEnabled === true,
    strobeFrequencyHz: Math.max(0.5, Math.min(2.5, Number(config.strobeFrequencyHz ?? 1))),
    strobeDutyCyclePercent: Math.max(50, Math.min(80, Number(config.strobeDutyCyclePercent ?? 70))),
    strobeContrastPercent: Math.max(5, Math.min(35, Number(config.strobeContrastPercent ?? 20))),
    backgroundMotionMode: config.backgroundMotionMode === 'oscillating' ? 'oscillating' : 'continuous',
    backgroundFrequencyHz: Math.max(0.05, Math.min(1.5, Number(config.backgroundFrequencyHz ?? 0.25))),
    backgroundAmplitudePercent: Math.max(5, Math.min(50, Number(config.backgroundAmplitudePercent ?? 25))),
    backgroundRampSeconds: Math.max(0, Math.min(5, Number(config.backgroundRampSeconds ?? 0))),
    backgroundCoveragePercent: Math.max(25, Math.min(100, Number(config.backgroundCoveragePercent ?? 100))),
    backgroundContrastPercent: Math.max(5, Math.min(100, Number(config.backgroundContrastPercent ?? 100))),
    targetBackgroundRelation: config.targetBackgroundRelation === 'in_phase' || config.targetBackgroundRelation === 'counter_phase' ? config.targetBackgroundRelation : 'independent',
    objectSpeedHz: Math.max(0.05, Math.min(2, Number(config.objectSpeedHz ?? 0.5))),
    saccadeFrequencyHz: Math.max(0.2, Math.min(2, Number(config.saccadeFrequencyHz ?? 0.8))),
    metronomeHz: Math.max(0.1, Math.min(4, Number(config.metronomeHz ?? 1))),
    metronomeToneHz: Math.max(220, Math.min(1760, Number(config.metronomeToneHz ?? 660))),
    cognitiveStimulusSeconds: Math.max(0.75, Math.min(6, Number(config.cognitiveStimulusSeconds ?? 2.5))),
    immersiveAudioEnabled: config.immersiveAudioEnabled === true,
    immersiveAudioVolume: Math.max(0, Math.min(50, Number(config.immersiveAudioVolume ?? 20))),
    immersiveTargetAzimuthDegrees: Math.max(-120, Math.min(120, Number(config.immersiveTargetAzimuthDegrees ?? 0))),
    immersiveTargetElevationDegrees: Math.max(-45, Math.min(45, Number(config.immersiveTargetElevationDegrees ?? 0))),
    preparationSeconds,
    // Las asignaciones antiguas continúan automáticamente; las nuevas usan el valor manual del predeterminado.
    advanceMode: config.advanceMode ?? 'automatic',
  }
}
