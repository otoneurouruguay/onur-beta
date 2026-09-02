import { Accessibility, BookOpen, ChevronDown, CircleCheck, ClipboardCheck, Eye, Play, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { clinicalSources } from '../clinicalGeneration/catalog'
import { cognitiveInstruction, cognitiveSymbolLabels, cognitiveTaskLabel } from '../exercise/cognitive'
import { ExerciseCanvas } from '../exercise/ExerciseCanvas'
import { activateCardboardTracking } from '../exercise/cardboardTracking'
import { cardboardEyeCenterPercent, useCardboardViewerProfiles } from '../exercise/cardboardViewerProfiles'
import { analyzeExerciseCompatibility, applyExercisePurpose, exercisePurposeLabels, isVrBoxPurposeSupported, vrBoxPurposeCompatibility } from '../exercise/compatibility'
import { buildExerciseExecutionPlan, type ExerciseSetting } from '../exercise/execution'
import { ExercisePlayer } from '../exercise/ExercisePlayer'
import { StereoscopicExerciseCanvas } from '../exercise/StereoscopicExerciseCanvas'
import type { BackgroundMotionMode, BackgroundType, CognitiveResponseMode, CognitiveSymbol, CognitiveTaskMode, ExerciseConfig, ExercisePurpose, LinearMotionDirection, MotionDirection, ObjectDirection, PreparationSeconds, QuestImmersiveCoverage, QuestImmersiveGeometry, RadialMotionDirection, TargetBackgroundRelation } from '../exercise/types'
import { getImmersiveScenario, immersiveScenarios } from '../immersive/catalog'
import { ImmersivePanorama } from '../immersive/ImmersivePanorama'
import { QuestProceduralExerciseRunner } from '../immersive/QuestProceduralSessionRunner'
import { canUseQuestProceduralImmersion, isQuestProceduralImmersive, recommendedQuestGeometry } from '../immersive/questProcedural'

interface SessionExerciseEditorProps {
  config: ExerciseConfig
  isFirst?: boolean
  setting?: ExerciseSetting
  onChange: (config: ExerciseConfig) => void
}

const input = 'mt-2 h-11 min-w-0 w-full rounded-2xl border border-[#E9E7E7] bg-white px-3 text-sm'
const linearDirections: LinearMotionDirection[] = ['left', 'right', 'up', 'down', 'up_left', 'up_right', 'down_left', 'down_right']
const radialDirections: RadialMotionDirection[] = ['toward', 'away']
const directionLabels: Record<MotionDirection, string> = {
  left: 'Hacia la izquierda', right: 'Hacia la derecha', up: 'Hacia arriba', down: 'Hacia abajo',
  up_left: 'Diagonal ↖', up_right: 'Diagonal ↗', down_left: 'Diagonal ↙', down_right: 'Diagonal ↘',
  clockwise: 'Horario', counterclockwise: 'Antihorario',
  toward: 'Expansión · hacia la persona', away: 'Contracción · hacia el centro',
}
const objectDirectionLabels: Record<ObjectDirection, string> = {
  horizontal: 'Horizontal', vertical: 'Vertical', diagonal_down: 'Diagonal ↖ ↘', diagonal_up: 'Diagonal ↙ ↗',
}
const linkedBackgroundDirections: Record<ObjectDirection, LinearMotionDirection> = {
  horizontal: 'right', vertical: 'down', diagonal_down: 'down_right', diagonal_up: 'up_right',
}
const orderedImmersiveScenarios = [...immersiveScenarios].sort((a, b) => a.intensity - b.intensity)

export function SessionExerciseEditor({ config, isFirst = false, setting = 'unspecified', onChange }: SessionExerciseEditorProps) {
  const [playing, setPlaying] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [activatingSensors, setActivatingSensors] = useState(false)
  const viewerProfiles = useCardboardViewerProfiles()
  const viewerProfile = viewerProfiles.activeProfile
  const set = <Key extends keyof ExerciseConfig>(key: Key, value: ExerciseConfig[Key]) => onChange({ ...config, [key]: value })
  const directions: MotionDirection[] = config.backgroundType === 'spiral' ? ['clockwise', 'counterclockwise'] : config.backgroundType === 'radial_flow' ? radialDirections : linearDirections
  const isPhysical = config.kind === 'guided_physical'
  const isFree = config.purpose === 'custom_free'
  const isImmersive = config.purpose === 'immersive_context'
  const immersiveScenario = getImmersiveScenario(config.immersiveScenarioId)
  const compatibility = analyzeExerciseCompatibility(config)
  const execution = buildExerciseExecutionPlan(config, setting)
  const cognitive = config.cognitiveTaskMode !== 'none'
  const linkedVisualConflict = config.targetBackgroundRelation !== 'independent'
  const questProceduralAvailable = canUseQuestProceduralImmersion(config)
  const questProceduralImmersive = isQuestProceduralImmersive(config)

  useEffect(() => {
    if (!config.cardboardEnabled) return
    const current = config.cardboardViewerProfile
    const unchanged = current
      && current.id === viewerProfile.id
      && current.name === viewerProfile.name
      && current.imageSeparationPercent === viewerProfile.imageSeparationPercent
      && current.verticalOffsetPercent === viewerProfile.verticalOffsetPercent
      && current.horizontalFovDegrees === viewerProfile.horizontalFovDegrees
      && current.verticalFovDegrees === viewerProfile.verticalFovDegrees
      && current.lensDistortionPercent === viewerProfile.lensDistortionPercent
    if (!unchanged) onChange({ ...config, cardboardViewerProfile: { ...viewerProfile } })
  }, [config, onChange, viewerProfile])
  const evidenceSourceIds = new Set<string>(['SRC-001'])
  if (config.clinicalProtocol === 'pppd') { evidenceSourceIds.add('SRC-017'); evidenceSourceIds.add('SRC-018'); evidenceSourceIds.add('SRC-019') }
  if (['optokinetic', 'optic_flow', 'visual_habituation', 'visual_motion_fixation', 'pursuit_visual_conflict'].includes(config.purpose)) evidenceSourceIds.add('SRC-022')
  if (config.strobeEnabled) { evidenceSourceIds.add('SRC-037'); evidenceSourceIds.add('SRC-038') }
  if (config.displayMode !== 'standard') evidenceSourceIds.add('SRC-023')
  if (isImmersive) { evidenceSourceIds.add('SRC-034'); evidenceSourceIds.add('SRC-035'); evidenceSourceIds.add('SRC-036') }
  if (cognitive) { evidenceSourceIds.add('SRC-032'); evidenceSourceIds.add('SRC-033') }
  const evidenceSources = clinicalSources.filter((source) => evidenceSourceIds.has(source.id))
  const setKind = (kind: ExerciseConfig['kind']) => onChange(applyExercisePurpose(config, kind === 'guided_physical' ? 'guided_functional' : 'gaze_stabilization'))
  const setPurpose = (purpose: ExercisePurpose) => onChange(applyExercisePurpose(config, purpose))
  const setImmersiveScenario = (immersiveScenarioId: string) => onChange(applyExercisePurpose({ ...config, immersiveScenarioId }, 'immersive_context'))
  const setBackgroundType = (backgroundType: BackgroundType) => onChange({
    ...config,
    backgroundType,
    backgroundSpeed: backgroundType === 'solid' ? 0 : config.backgroundSpeed,
    targetBackgroundRelation: backgroundType === 'spiral' || backgroundType === 'radial_flow' ? 'independent' : config.targetBackgroundRelation,
    backgroundDirection: backgroundType === 'radial_flow'
      ? (config.backgroundDirection === 'away' ? 'away' : 'toward')
      : backgroundType === 'spiral'
      ? (config.backgroundDirection === 'counterclockwise' ? 'counterclockwise' : 'clockwise')
      : config.backgroundDirection === 'clockwise' || config.backgroundDirection === 'counterclockwise' || config.backgroundDirection === 'toward' || config.backgroundDirection === 'away' ? 'left' : config.backgroundDirection,
  })
  const setTargetBackgroundRelation = (targetBackgroundRelation: TargetBackgroundRelation) => onChange(targetBackgroundRelation === 'independent' ? { ...config, targetBackgroundRelation } : {
    ...config,
    targetBackgroundRelation,
    backgroundType: config.backgroundType === 'spiral' || config.backgroundType === 'radial_flow' || config.backgroundType === 'solid' ? 'bars' : config.backgroundType,
    backgroundDirection: linkedBackgroundDirections[config.objectDirection],
    backgroundMotionMode: 'oscillating',
    backgroundFrequencyHz: config.objectSpeedHz,
  })
  const setObjectDirection = (objectDirection: ObjectDirection) => onChange({
    ...config,
    objectDirection,
    backgroundDirection: linkedVisualConflict ? linkedBackgroundDirections[objectDirection] : config.backgroundDirection,
  })
  const setObjectSpeed = (objectSpeedHz: number) => onChange({
    ...config,
    objectSpeedHz,
    backgroundFrequencyHz: linkedVisualConflict ? objectSpeedHz : config.backgroundFrequencyHz,
  })
  const setStrobeEnabled = (strobeEnabled: boolean) => {
    if (!strobeEnabled) return onChange({ ...config, strobeEnabled: false, clinicalProtocol: config.clinicalProtocol === 'stroboscopic_experimental' ? undefined : config.clinicalProtocol })
    const habituation = applyExercisePurpose(config, 'visual_habituation')
    onChange({
      ...habituation,
      name: 'Estroboscópico experimental',
      clinicalProtocol: 'stroboscopic_experimental',
      patientInstruction: 'Sentado y con supervisión directa, observá el patrón sin perseguir un elemento. Avisá de inmediato ante cefalea, fotofobia, náusea marcada o síntomas visuales nuevos.',
      displayMode: 'standard', cardboardEnabled: false, doseMode: 'time', advanceMode: 'manual',
      posture: 'seated', surface: 'firm', supervision: 'direct_clinician',
      strobeEnabled: true, strobeFrequencyHz: 1, strobeDutyCyclePercent: 70, strobeContrastPercent: 20,
      durationSeconds: Math.min(config.durationSeconds, 30), rounds: 1, restSeconds: Math.max(config.restSeconds, 60),
    })
  }
  const setDisplayMode = (displayMode: ExerciseConfig['displayMode']) => onChange(displayMode === 'vr_box'
    ? { ...config, displayMode, cardboardEnabled: isImmersive ? true : config.cardboardEnabled, doseMode: 'time', advanceMode: 'automatic', posture: 'seated', surface: 'firm', supervision: isImmersive ? 'direct_clinician' : config.supervision, metronomeEnabled: false, immersiveAudioEnabled: false }
    : displayMode === 'quest_browser'
      ? { ...config, displayMode, cardboardEnabled: false, doseMode: 'time', advanceMode: 'automatic', posture: 'seated', surface: 'firm', supervision: 'direct_clinician', metronomeEnabled: false }
      : { ...config, displayMode, cardboardEnabled: false })
  const setQuestPresentationMode = (questPresentationMode: ExerciseConfig['questPresentationMode']) => onChange({
    ...config,
    questPresentationMode,
    questImmersiveGeometry: config.purpose === 'custom_free' ? config.questImmersiveGeometry : recommendedQuestGeometry(config),
    doseMode: 'time', advanceMode: 'automatic', posture: 'seated', surface: 'firm', supervision: 'direct_clinician',
    metronomeEnabled: false,
  })
  const setCardboardEnabled = (cardboardEnabled: boolean) => onChange({
    ...config,
    cardboardEnabled,
    supervision: cardboardEnabled && config.purpose === 'gaze_stabilization' ? 'direct_clinician' : config.supervision,
  })
  const setCognitiveTask = (cognitiveTaskMode: CognitiveTaskMode) => {
    if (cognitiveTaskMode === 'none') return onChange({ ...config, cognitiveTaskMode })
    onChange({
      ...config,
      cognitiveTaskMode,
      displayMode: 'standard',
      cardboardEnabled: false,
      doseMode: 'time',
      advanceMode: 'manual',
      posture: 'seated',
      surface: 'firm',
      objectEnabled: true,
      cognitiveResponseMode: cognitiveTaskMode === 'rare_target' ? 'count_at_end' : config.cognitiveResponseMode === 'count_at_end' ? 'verbal' : config.cognitiveResponseMode,
    })
  }
  const startPreview = async () => {
    setPreviewError('')
    if (config.displayMode === 'vr_box') {
      setActivatingSensors(config.cardboardEnabled)
      const activationRequest = config.cardboardEnabled ? activateCardboardTracking() : Promise.resolve({ permission: 'granted' as const })
      const fullscreenRequest = document.documentElement.requestFullscreen?.()
      const activation = await activationRequest
      try {
        await fullscreenRequest
        const orientation = screen.orientation as (ScreenOrientation & { lock?: (value: 'landscape') => Promise<void> }) | undefined
        await orientation?.lock?.('landscape')
      } catch { /* La prueba continúa aunque el navegador no permita fullscreen u orientación fija. */ }
      setActivatingSensors(false)
      if (activation.permission !== 'granted') {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
        setPreviewError(
          activation.permission === 'denied'
            ? 'El acceso a giroscopio o acelerómetro está bloqueado. En Samsung/Chrome abrí Ajustes del sitio → Sensores de movimiento → Permitir y recargá ONUr.'
            : activation.permission === 'insecure'
              ? 'El seguimiento de cabeza necesita abrir ONUr desde su dirección HTTPS.'
              : activation.permission === 'no_signal'
                ? 'No llegó señal del giroscopio. Mové suavemente el celular al reintentar y comprobá que Sensores de movimiento esté permitido.'
                : 'Este navegador no ofrece sensores de orientación compatibles. Probá Chrome actualizado en el celular.',
        )
        return
      }
    }
    setPlaying(true)
  }
  const closePreview = () => {
    setPlaying(false)
    if (config.displayMode === 'vr_box' && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,.9fr)]">
      <div className="min-w-0 space-y-5">
        <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5">
          <h3 className="font-black text-[#171717]">Identificación</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-black text-[#2F2F2F]">Nombre<input className={input} value={config.name} onChange={(event) => set('name', event.target.value)} /></label>
            <label className="text-xs font-black text-[#2F2F2F]">Tipo<select className={input} value={config.kind} onChange={(event) => setKind(event.target.value as ExerciseConfig['kind'])}><option value="visual_stimulus">Estímulo visual</option><option value="guided_physical">Ejercicio físico guiado</option></select></label>
          </div>
          <label className="mt-4 block text-xs font-black text-[#2F2F2F]">Objetivo del ejercicio<select className={input} value={config.purpose} onChange={(event) => setPurpose(event.target.value as ExercisePurpose)}>{isPhysical
            ? <option value="guided_functional">{exercisePurposeLabels.guided_functional}</option>
            : <>
              <option value="gaze_stabilization">{exercisePurposeLabels.gaze_stabilization}</option>
              <option value="gaze_stabilization_x2">{exercisePurposeLabels.gaze_stabilization_x2}</option>
              <option value="gaze_substitution_remembered">{exercisePurposeLabels.gaze_substitution_remembered}</option>
              <option value="smooth_pursuit">{exercisePurposeLabels.smooth_pursuit}</option>
              <option value="visual_motion_fixation">{exercisePurposeLabels.visual_motion_fixation}</option>
              <option value="pursuit_visual_conflict">{exercisePurposeLabels.pursuit_visual_conflict}</option>
              <option value="saccades">{exercisePurposeLabels.saccades}</option>
              <option value="optokinetic">{exercisePurposeLabels.optokinetic}</option>
              <option value="optic_flow">{exercisePurposeLabels.optic_flow}</option>
              <option value="visual_habituation">{exercisePurposeLabels.visual_habituation}</option>
              <option value="immersive_context">{exercisePurposeLabels.immersive_context}</option>
              <option value="cognitive_visual">{exercisePurposeLabels.cognitive_visual}</option>
              <option value="custom_free">{exercisePurposeLabels.custom_free}</option>
            </>}</select></label>
          {isImmersive && <label className="mt-4 block text-xs font-black text-[#2F2F2F]">Escenario clínico 360°<select className={input} value={config.immersiveScenarioId ?? ''} onChange={(event) => setImmersiveScenario(event.target.value)}>{orderedImmersiveScenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>Nivel {scenario.intensity} · {scenario.title}</option>)}</select></label>}
          <label className="mt-4 block text-xs font-black text-[#2F2F2F]">Instrucción para el paciente<textarea rows={3} className="mt-2 w-full rounded-2xl border border-[#E9E7E7] bg-white p-3 text-sm font-normal" value={config.patientInstruction} onChange={(event) => set('patientInstruction', event.target.value)} /></label>
          {immersiveScenario && <div className="mt-4 rounded-2xl border border-[#B9D9C5] bg-[#F0F8F3] p-4 text-[#28613D]"><p className="text-xs font-black">Exposición contextual · intensidad técnica {immersiveScenario.intensity}/3</p><p className="mt-2 text-[11px] leading-5">{immersiveScenario.clinicalUse}</p><ul className="mt-2 space-y-1 text-[10px] leading-4">{immersiveScenario.cautions.map((caution) => <li key={caution}>• {caution}</li>)}</ul><p className="mt-3 border-t border-[#B9D9C5] pt-3 text-[10px] font-bold">No es RVO, prueba diagnóstica, marcha virtual ni progresión automática.</p></div>}
          {immersiveScenario && <details className="group mt-4 rounded-2xl border border-[#E9E7E7] bg-white p-4">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden"><div><h3 className="text-sm font-black text-[#171717]">Capas opcionales del escenario</h3><p className="mt-1 text-[11px] leading-5 text-[#747474]">Referencia espacial y sonido ambiente.</p></div><ChevronDown aria-hidden="true" className="mt-1 shrink-0 text-[#747474] transition-transform group-open:rotate-180" size={17}/></summary>
            <p className="mt-4 text-[11px] leading-5 text-[#747474]">Agregalas de a una para poder atribuir la respuesta a la complejidad visual, al sonido o a la referencia.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#F7F6F4] p-4">
                <label className="flex items-center gap-2 text-xs font-black text-[#2F2F2F]"><input type="checkbox" disabled={!immersiveScenario.spatialTargetAllowed || immersiveScenario.motion !== 'static'} checked={config.objectEnabled} onChange={(event) => set('objectEnabled', event.target.checked)} /> Referencia espacial fija</label>
                <p className="mt-2 text-[10px] leading-4 text-[#747474]">Queda anclada al escenario. Sirve para orientación o búsqueda; no convierte la escena en RVO x1.</p>
                {config.objectEnabled && <div className="mt-3 space-y-3">
                  <label className="block text-[10px] font-black">Forma<select className={input} value={config.immersiveTargetShape} onChange={(event) => set('immersiveTargetShape', event.target.value as ExerciseConfig['immersiveTargetShape'])}><option value="circle">Círculo</option><option value="diamond">Rombo</option><option value="cross">Cruz</option></select></label>
                  <label className="block text-[10px] font-black">Color<input aria-label="Color de referencia espacial" type="color" className="mt-2 h-10 w-full rounded-xl border border-[#E9E7E7] bg-white p-1" value={config.objectColor} onChange={(event) => set('objectColor', event.target.value)} /></label>
                  <label className="block text-[10px] font-black">Tamaño: {config.objectSize}px<input type="range" min="12" max="90" step="2" className="mt-2 w-full accent-[#E49A02]" value={config.objectSize} onChange={(event) => set('objectSize', Number(event.target.value))} /></label>
                  <label className="block text-[10px] font-black">Posición horizontal: {config.immersiveTargetAzimuthDegrees}°<input type="range" min="-120" max="120" step="5" className="mt-2 w-full accent-[#E49A02]" value={config.immersiveTargetAzimuthDegrees} onChange={(event) => set('immersiveTargetAzimuthDegrees', Number(event.target.value))} /></label>
                  <label className="block text-[10px] font-black">Altura: {config.immersiveTargetElevationDegrees}°<input type="range" min="-45" max="45" step="5" className="mt-2 w-full accent-[#E49A02]" value={config.immersiveTargetElevationDegrees} onChange={(event) => set('immersiveTargetElevationDegrees', Number(event.target.value))} /></label>
                </div>}
              </div>
              <div className="rounded-2xl bg-[#F7F6F4] p-4">
                <label className="flex items-center gap-2 text-xs font-black text-[#2F2F2F]"><input type="checkbox" disabled={!immersiveScenario.ambientAudio || config.displayMode !== 'quest_browser'} checked={config.immersiveAudioEnabled} onChange={(event) => set('immersiveAudioEnabled', event.target.checked)} /> Sonido ambiente</label>
                <p className="mt-2 text-[10px] leading-4 text-[#747474]">{immersiveScenario.ambientAudio ? config.displayMode === 'quest_browser' ? 'Disponible en Quest; apagado por defecto y no sincronizado con la imagen fija.' : 'Disponible solo al elegir Quest. En VR Box se evita depender del desbloqueo de audio del navegador móvil.' : 'No hay una fuente sonora coherente y licenciada para esta escena.'}</p>
                {config.immersiveAudioEnabled && <label className="mt-3 block text-[10px] font-black">Volumen: {config.immersiveAudioVolume}%<input type="range" min="0" max="50" step="5" className="mt-2 w-full accent-[#E49A02]" value={config.immersiveAudioVolume} onChange={(event) => set('immersiveAudioVolume', Number(event.target.value))} /></label>}
              </div>
            </div>
          </details>}
          {config.clinicalProtocol === 'pppd' && <div className="mt-4 rounded-2xl border border-[#B9D9C5] bg-[#F0F8F3] p-4 text-[#28613D]">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#28613D] px-3 py-1 text-[10px] font-black text-white">PPPD</span><strong className="text-xs">Nivel {config.progressionLevel ?? 'sin definir'} de 3</strong></div>
            {config.progressionCriteria && <p className="mt-3 text-[11px] leading-5"><strong>Criterio de avance:</strong> {config.progressionCriteria}</p>}
            {config.stopCriteria && <p className="mt-2 text-[11px] leading-5"><strong>Pausa o retroceso:</strong> {config.stopCriteria}</p>}
            <p className="mt-2 text-[10px] leading-4">El nivel organiza complejidad técnica; no autoriza una progresión automática ni sustituye la decisión profesional.</p>
          </div>}
          {isFree && <p className="mt-4 flex gap-2 rounded-xl border border-[#E8CE99] bg-[#FFF7E8] p-3 text-[11px] font-bold leading-5 text-[#8A5B00]"><ShieldAlert className="mt-0.5 shrink-0" size={16}/> Podés guardar cualquier combinación como predeterminada. La plataforma no le asignará una equivalencia clínica automática y la sesión seguirá aplicando los límites técnicos del dispositivo y de seguridad domiciliaria.</p>}
        </section>

        {!isPhysical && !isImmersive && <>
          <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5">
            <h3 className="font-black text-[#171717]">Fondo visual</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <label className="text-xs font-black text-[#2F2F2F]">Fondo<select className={input} value={config.backgroundType} onChange={(event) => setBackgroundType(event.target.value as BackgroundType)}><option value="solid">Color sólido</option><option value="bars">Barras</option><option value="spiral">Espiral</option><option value="checkerboard">Damero</option><option value="dots">Puntos</option><option value="radial_flow">Flujo radial de puntos</option></select></label>
              <label className="text-xs font-black text-[#2F2F2F]">Dirección<select disabled={config.backgroundType === 'solid' || linkedVisualConflict} className={`${input} disabled:bg-[#F7F6F4] disabled:text-[#747474]`} value={config.backgroundDirection} onChange={(event) => set('backgroundDirection', event.target.value as MotionDirection)}>{config.backgroundType === 'solid' ? <option value={config.backgroundDirection}>No aplica</option> : directions.map((direction) => <option key={direction} value={direction}>{directionLabels[direction]}</option>)}</select></label>
            </div>
            {config.backgroundType !== 'solid' && <div className="mt-4 rounded-2xl bg-[#F7F6F4] p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-black text-[#2F2F2F]">Movimiento del fondo<select aria-label="Movimiento del fondo" disabled={linkedVisualConflict} className={`${input} disabled:bg-white/60`} value={config.backgroundMotionMode} onChange={(event) => set('backgroundMotionMode', event.target.value as BackgroundMotionMode)}><option value="continuous">Continuo</option><option value="oscillating">Oscilante</option></select></label>
                {config.backgroundMotionMode === 'continuous'
                  ? <label className="text-xs font-black text-[#2F2F2F]">Velocidad: {config.backgroundSpeed} px/s<input aria-label="Velocidad de fondo" type="range" min="0" max="160" step="5" className="mt-3 w-full accent-[#E49A02]" value={config.backgroundSpeed} onChange={(event) => set('backgroundSpeed', Number(event.target.value))} /></label>
                  : <>
                    <label className="text-xs font-black text-[#2F2F2F]">Frecuencia: {config.backgroundFrequencyHz.toFixed(2)} Hz<input aria-label="Frecuencia de oscilación del fondo" disabled={linkedVisualConflict} type="range" min="0.05" max="1.5" step="0.05" className="mt-3 w-full accent-[#E49A02] disabled:opacity-45" value={config.backgroundFrequencyHz} onChange={(event) => set('backgroundFrequencyHz', Number(event.target.value))} /></label>
                    <label className="text-xs font-black text-[#2F2F2F]">Amplitud: {config.backgroundAmplitudePercent}%<input aria-label="Amplitud de oscilación del fondo" type="range" min="5" max="50" step="1" className="mt-3 w-full accent-[#E49A02]" value={config.backgroundAmplitudePercent} onChange={(event) => set('backgroundAmplitudePercent', Number(event.target.value))} /></label>
                  </>}
              </div>
              <details className="group mt-4 rounded-xl border border-[#E4E0DA] bg-white p-4">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden"><span><strong className="block text-xs text-[#2F2F2F]">Ajustes avanzados del fondo</strong><span className="mt-1 block text-[10px] leading-4 text-[#747474]">Rampa, cobertura, contraste y geometría.</span></span><ChevronDown aria-hidden="true" className="mt-1 shrink-0 text-[#747474] transition-transform group-open:rotate-180" size={16}/></summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-black text-[#2F2F2F]">Entrada gradual: {config.backgroundRampSeconds.toFixed(1)} s<input aria-label="Entrada gradual del fondo" type="range" min="0" max="5" step="0.5" className="mt-3 w-full accent-[#E49A02]" value={config.backgroundRampSeconds} onChange={(event) => set('backgroundRampSeconds', Number(event.target.value))} /></label>
                  <label className="text-xs font-black text-[#2F2F2F]">Cobertura central: {config.backgroundCoveragePercent}%<input aria-label="Cobertura central del fondo" type="range" min="25" max="100" step="5" className="mt-3 w-full accent-[#E49A02]" value={config.backgroundCoveragePercent} onChange={(event) => set('backgroundCoveragePercent', Number(event.target.value))} /></label>
                  <label className="text-xs font-black text-[#2F2F2F]">Contraste relativo: {config.backgroundContrastPercent}%<input aria-label="Contraste relativo del patrón" type="range" min="5" max="100" step="5" className="mt-3 w-full accent-[#E49A02]" value={config.backgroundContrastPercent} onChange={(event) => set('backgroundContrastPercent', Number(event.target.value))} /></label>
                  <label className="text-xs font-black text-[#2F2F2F]">Tamaño del patrón: {config.stripeWidth}px<input aria-label="Tamaño del patrón" type="range" min="8" max="140" step="2" className="mt-3 w-full accent-[#E49A02]" value={config.stripeWidth} onChange={(event) => set('stripeWidth', Number(event.target.value))} /></label>
                  {isFree && <><label className="text-xs font-black text-[#2F2F2F]">Color de fondo<input aria-label="Color de fondo" type="color" className="mt-2 h-11 w-full rounded-xl border border-[#E9E7E7] bg-white p-1" value={config.backgroundColor} onChange={(event) => set('backgroundColor', event.target.value)} /></label><label className="text-xs font-black text-[#2F2F2F]">Color del patrón<input aria-label="Color del patrón" type="color" className="mt-2 h-11 w-full rounded-xl border border-[#E9E7E7] bg-white p-1" value={config.foregroundColor} onChange={(event) => set('foregroundColor', event.target.value)} /></label></>}
                </div>
                <p className="mt-3 text-[10px] leading-4 text-[#747474]">La cobertura limita el patrón a una zona central de la pantalla; no representa grados de campo visual. El contraste es relativo a los colores elegidos.</p>
              </details>
            </div>}
            {(config.purpose === 'pursuit_visual_conflict' || isFree) && config.objectMode === 'tracking' && config.backgroundType !== 'solid' && <div className="mt-4 rounded-2xl border border-[#D6C3EA] bg-[#F8F3FC] p-4">
              <label className="text-xs font-black text-[#563475]">Relación blanco–fondo<select aria-label="Relación blanco y fondo" className={input} value={config.targetBackgroundRelation} onChange={(event) => setTargetBackgroundRelation(event.target.value as TargetBackgroundRelation)}><option value="independent">Independientes</option><option value="in_phase">En fase · mismo sentido</option><option value="counter_phase">Contrafase · sentidos opuestos</option></select></label>
              <p className="mt-2 text-[10px] leading-4 text-[#72538D]">En fase y contrafase sincronizan frecuencia y eje. La contrafase invierte el desplazamiento del fondo respecto del blanco.</p>
            </div>}
            {config.backgroundType === 'bars' && linearDirections.includes(config.backgroundDirection as LinearMotionDirection) && config.backgroundDirection.includes('_') && <p className="mt-3 text-[11px] leading-5 text-[#747474]">Las barras se dibujan diagonales y avanzan en la dirección elegida.</p>}
            {config.backgroundType === 'spiral' && <p className="mt-3 text-[11px] leading-5 text-[#747474]">La espiral solo admite rotación horaria o antihoraria; una dirección diagonal no describe su geometría.</p>}
            <div className="mt-5 rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-4">
              <label className="flex items-start gap-3 text-xs font-black text-[#7A5100]"><input type="checkbox" checked={config.strobeEnabled} onChange={(event) => setStrobeEnabled(event.target.checked)} className="mt-0.5 size-4 accent-[#E49A02]" /> <span>Intermitencia visual estroboscópica <span className="block text-[10px] font-bold text-[#A36B00]">Experimental · solo presencial y con supervisión directa</span></span></label>
              {config.strobeEnabled && <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="text-[10px] font-black text-[#7A5100]">Frecuencia: {config.strobeFrequencyHz.toFixed(1)} Hz<input aria-label="Frecuencia estroboscópica" type="range" min="0.5" max="2.5" step="0.5" className="mt-3 w-full accent-[#E49A02]" value={config.strobeFrequencyHz} onChange={(event) => set('strobeFrequencyHz', Number(event.target.value))} /></label>
                <label className="text-[10px] font-black text-[#7A5100]">Imagen visible: {config.strobeDutyCyclePercent}%<input aria-label="Porcentaje de imagen visible" type="range" min="50" max="80" step="5" className="mt-3 w-full accent-[#E49A02]" value={config.strobeDutyCyclePercent} onChange={(event) => set('strobeDutyCyclePercent', Number(event.target.value))} /></label>
                <label className="text-[10px] font-black text-[#7A5100]">Contraste: {config.strobeContrastPercent}%<input aria-label="Contraste de intermitencia" type="range" min="5" max="35" step="5" className="mt-3 w-full accent-[#E49A02]" value={config.strobeContrastPercent} onChange={(event) => set('strobeContrastPercent', Number(event.target.value))} /></label>
              </div>}
              {config.strobeEnabled && <p className="mt-4 text-[10px] font-bold leading-5 text-[#8A5B00]">La vista previa queda inmóvil hasta pulsar “Probar ejercicio”. No usar con epilepsia fotosensible, respuesta adversa a destellos, aura, fotofobia activa o crisis de migraña vestibular.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5">
            <div className="flex items-center justify-between"><h3 className="font-black text-[#171717]">Objeto</h3><label className="text-xs font-bold"><input type="checkbox" checked={config.objectEnabled} onChange={(event) => set('objectEnabled', event.target.checked)} /> Mostrar blanco</label></div>
            <div className={`mt-4 grid grid-cols-2 gap-4 ${config.objectEnabled ? '' : 'pointer-events-none opacity-40'}`}>
              <label className="text-xs font-black text-[#2F2F2F]">Comportamiento<select className={input} value={config.objectMode} onChange={(event) => set('objectMode', event.target.value as ExerciseConfig['objectMode'])}><option value="fixed">Fijo</option><option value="tracking">Seguimiento</option><option value="saccades">Sacadas</option></select></label>
              <label className="text-xs font-black text-[#2F2F2F]">Tamaño: {config.objectSize}px<input type="range" min="12" max="90" step="2" className="mt-4 w-full accent-[#E49A02]" value={config.objectSize} onChange={(event) => set('objectSize', Number(event.target.value))} /></label>
              {config.objectMode === 'tracking' && <><label className="text-xs font-black text-[#2F2F2F]">Dirección<select className={input} value={config.objectDirection} onChange={(event) => setObjectDirection(event.target.value as ObjectDirection)}>{(Object.keys(objectDirectionLabels) as ObjectDirection[]).map((direction) => <option key={direction} value={direction}>{objectDirectionLabels[direction]}</option>)}</select></label><div><label className="text-xs font-black text-[#2F2F2F]">Velocidad de seguimiento: {config.objectSpeedHz.toFixed(2)} Hz<input aria-label="Velocidad de seguimiento ocular" type="range" min="0.05" max="2" step="0.05" className="mt-4 w-full accent-[#E49A02]" value={config.objectSpeedHz} onChange={(event) => setObjectSpeed(Number(event.target.value))} /></label><div className="mt-2 flex flex-wrap gap-1.5">{([{ label: 'Muy lento', value: 0.1 }, { label: 'Lento', value: 0.25 }, { label: 'Medio', value: 0.5 }, { label: 'Rápido', value: 1 }, { label: 'Muy rápido', value: 1.5 }] as const).map((preset) => <button key={preset.label} type="button" onClick={() => setObjectSpeed(preset.value)} className={`rounded-lg border px-2 py-1.5 text-[9px] font-black ${config.objectSpeedHz === preset.value ? 'border-[#E49A02] bg-[#FFF7E8] text-[#A36B00]' : 'border-[#DEDCD9] text-[#747474]'}`}>{preset.label}</button>)}</div></div></>}
              {config.objectMode === 'saccades' && <><label className="text-xs font-black text-[#2F2F2F]">Patrón<select className={input} value={config.saccadePattern} onChange={(event) => set('saccadePattern', event.target.value as ExerciseConfig['saccadePattern'])}><option value="horizontal">Lateral</option><option value="vertical">Arriba/abajo</option><option value="diagonal_down">Diagonal ↖ ↘</option><option value="diagonal_up">Diagonal ↙ ↗</option><option value="random">Aleatorio</option></select></label><label className="text-xs font-black text-[#2F2F2F]">Ritmo: {config.saccadeFrequencyHz} Hz<input type="range" min="0.2" max="2" step="0.1" className="mt-4 w-full accent-[#E49A02]" value={config.saccadeFrequencyHz} onChange={(event) => set('saccadeFrequencyHz', Number(event.target.value))} /></label></>}
              {(config.objectMode === 'tracking' || config.objectMode === 'saccades') && <label className="text-xs font-black text-[#2F2F2F]">Amplitud: {config.objectAmplitude}%<input type="range" min="5" max="42" step="1" className="mt-4 w-full accent-[#E49A02]" value={config.objectAmplitude} onChange={(event) => set('objectAmplitude', Number(event.target.value))} /></label>}
              {isFree && <label className="text-xs font-black text-[#2F2F2F]">Color del blanco<input aria-label="Color del blanco" type="color" className="mt-2 h-11 w-full rounded-xl border border-[#E9E7E7] bg-white p-1" value={config.objectColor} onChange={(event) => set('objectColor', event.target.value)} /></label>}
            </div>
          </section>

          <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-[#171717]">Tarea cognitiva opcional</h3><p className="mt-1 text-[11px] leading-5 text-[#747474]">Se agrega sobre el estímulo visual actual. No diagnostica atención, inhibición ni memoria.</p></div>{cognitive && <span className="rounded-full bg-[#FFF7E8] px-3 py-1 text-[10px] font-black text-[#A36B00]">{cognitiveTaskLabel(config)}</span>}</div>
            <label className="mt-4 block text-xs font-black text-[#2F2F2F]">Tipo de tarea cognitiva<select className={input} value={config.cognitiveTaskMode} onChange={(event) => setCognitiveTask(event.target.value as CognitiveTaskMode)}><option value="none">Sin tarea cognitiva</option><option value="rare_target">Detección de objetivo raro</option><option value="go_no_go">Go/No-Go</option><option value="short_memory">Memoria breve</option></select></label>
            {cognitive && <div className="mt-4 space-y-4 rounded-2xl border border-[#E8CE99] bg-[#FFFDF8] p-4">
              <div className="rounded-xl bg-[#171717] p-4 text-white"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#EFB33A]">Consigna que verá el paciente</p><p className="mt-2 text-sm font-black leading-6">{cognitiveInstruction(config)}</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                {config.cognitiveTaskMode !== 'short_memory' && <label className="text-xs font-black text-[#2F2F2F]">Figura objetivo<select className={input} value={config.cognitiveTargetSymbol} onChange={(event) => set('cognitiveTargetSymbol', event.target.value as CognitiveSymbol)}>{(Object.entries(cognitiveSymbolLabels) as [CognitiveSymbol, string][]).map(([symbol, label]) => <option key={symbol} value={symbol}>{label[0].toUpperCase() + label.slice(1)}</option>)}</select></label>}
                <div><label className="text-xs font-black text-[#2F2F2F]">Cambio de imagen: cada {config.cognitiveStimulusSeconds.toFixed(2)} s<input aria-label="Velocidad de imágenes" type="range" min="0.75" max="6" step="0.25" className="mt-4 w-full accent-[#E49A02]" value={config.cognitiveStimulusSeconds} onChange={(event) => set('cognitiveStimulusSeconds', Number(event.target.value))} /></label><div className="mt-2 flex flex-wrap gap-1.5">{([{ label: 'Suave', value: 2 }, { label: 'Media', value: 1.25 }, { label: 'Rápida', value: 0.75 }] as const).map((preset) => <button key={preset.label} type="button" onClick={() => set('cognitiveStimulusSeconds', preset.value)} className={`rounded-lg border px-2 py-1.5 text-[9px] font-black ${config.cognitiveStimulusSeconds === preset.value ? 'border-[#E49A02] bg-[#FFF7E8] text-[#A36B00]' : 'border-[#DEDCD9] text-[#747474]'}`}>Imágenes {preset.label.toLocaleLowerCase('es')}</button>)}</div></div>
                {config.cognitiveTaskMode === 'short_memory' && <label className="text-xs font-black text-[#2F2F2F]">Comparar con<select className={input} value={config.cognitiveMemorySpan} onChange={(event) => set('cognitiveMemorySpan', Number(event.target.value) as 1 | 2 | 3)}><option value="1">La figura anterior</option><option value="2">Dos posiciones atrás</option><option value="3">Tres posiciones atrás</option></select></label>}
                {config.cognitiveTaskMode !== 'rare_target' && <label className="text-xs font-black text-[#2F2F2F]">Forma de responder<select className={input} value={config.cognitiveResponseMode} onChange={(event) => set('cognitiveResponseMode', event.target.value as CognitiveResponseMode)}><option value="verbal">Respuesta verbal</option><option value="screen_tap" disabled={config.displayMode !== 'standard' || ['gaze_stabilization', 'gaze_stabilization_x2', 'gaze_substitution_remembered'].includes(config.purpose)}>Tocar botón en pantalla</option></select></label>}
              </div>
              <p className="text-[11px] leading-5 text-[#8A5B00]">Comenzá con la tarea cognitiva aislada, ritmo lento y memoria de una posición. Combinarla con RVO, seguimiento o sacadas es una doble tarea y requiere comprobar antes la ejecución aislada.</p>
            </div>}
          </section>
        </>}

        {isFree && <section className="rounded-2xl border border-[#E8CE99] bg-[#FFFDF8] p-5">
          <h3 className="font-black text-[#171717]">Condiciones de ejecución · Libre</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="text-xs font-black text-[#2F2F2F]">Postura<select className={input} value={config.posture} onChange={(event) => set('posture', event.target.value as ExerciseConfig['posture'])}><option value="seated">Sentado</option><option value="standing">De pie</option><option value="walking">Marcha</option></select></label>
            <label className="text-xs font-black text-[#2F2F2F]">Superficie<select className={input} value={config.surface} onChange={(event) => set('surface', event.target.value as ExerciseConfig['surface'])}><option value="firm">Firme</option><option value="unstable">Inestable</option></select></label>
            <label className="text-xs font-black text-[#2F2F2F]">Supervisión<select className={input} value={config.supervision} onChange={(event) => set('supervision', event.target.value as ExerciseConfig['supervision'])}><option value="independent_after_approval">Independiente aprobado</option><option value="trained_helper">Ayudante entrenado</option><option value="direct_clinician">Profesional directo</option></select></label>
          </div>
        </section>}

        {isPhysical && <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5">
          <h3 className="font-black text-[#171717]">Condiciones físicas</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="text-xs font-black text-[#2F2F2F]">Postura<select className={input} value={config.posture} onChange={(event) => set('posture', event.target.value as ExerciseConfig['posture'])}><option value="seated">Sentado</option><option value="standing">De pie</option><option value="walking">Marcha</option></select></label>
            <label className="text-xs font-black text-[#2F2F2F]">Superficie<select className={input} value={config.surface} onChange={(event) => set('surface', event.target.value as ExerciseConfig['surface'])}><option value="firm">Firme</option><option value="unstable">Inestable</option></select></label>
            <label className="text-xs font-black text-[#2F2F2F]">Supervisión<select className={input} value={config.supervision} onChange={(event) => set('supervision', event.target.value as ExerciseConfig['supervision'])}><option value="independent_after_approval">Independiente aprobado</option><option value="trained_helper">Ayudante entrenado</option><option value="direct_clinician">Profesional directo</option></select></label>
          </div>
          {(config.surface === 'unstable' || config.posture === 'walking') && <p className="mt-4 flex gap-2 rounded-xl bg-[#FFF7E8] p-3 text-[11px] leading-5 text-[#8A5B00]"><ShieldAlert className="mt-0.5 shrink-0" size={16}/> Esta condición debe conservar una indicación explícita de supervisión y entorno despejado.</p>}
        </section>}

        <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5">
          <h3 className="font-black text-[#171717]">Dispositivo y confirmación</h3>
          <label className="mt-4 block text-xs font-black text-[#2F2F2F]">Modo<select className={input} value={config.displayMode} onChange={(event) => setDisplayMode(event.target.value as ExerciseConfig['displayMode'])}><option value="standard" disabled={isImmersive}>Pantalla 2D</option><option value="vr_box" disabled={config.strobeEnabled || !isVrBoxPurposeSupported(config.purpose) || isPhysical || cognitive}>{isImmersive ? 'VR Box · esfera 360° con Cardboard 3DoF' : 'VR Box · presentación binocular 2D'}</option><option value="quest_browser" disabled={config.strobeEnabled || setting === 'home' || ['gaze_stabilization', 'gaze_stabilization_x2', 'gaze_substitution_remembered'].includes(config.purpose) || isPhysical || cognitive}>{isImmersive ? 'Meta Quest · WebXR inmersivo' : 'Meta Quest · clínica, navegador 2D'}</option></select></label>
          <p className="mt-3 text-[11px] leading-5 text-[#747474]">{isImmersive ? config.displayMode === 'vr_box' ? 'Cardboard usa la orientación 3DoF del celular para explorar la esfera desde un punto fijo. El perfil óptico aplica separación, campo visual y corrección radial manual. No mide desplazamiento corporal y no se usa de pie ni caminando.' : 'Quest abre WebXR inmersivo con seguimiento del visor. La dosis comienza recién después de confirmar la inmersión y siempre se ejecuta en clínica.' : config.displayMode === 'standard' ? 'La pantalla debe permanecer inmóvil. El paciente puede confirmar con controles visibles.' : config.displayMode === 'vr_box' ? config.cardboardEnabled ? 'Cardboard solicita los sensores del celular, espera a que termine la preparación y calibra una posición frontal estable. El perfil óptico manual ajusta centros, campo visual y corrección radial; no mide traslación 6DoF ni reemplaza una calibración específica por QR.' : 'VR Box muestra el mismo estímulo 2D a ambos ojos. No usa botones, mirada ni controles externos, y no implementa anclaje espacial ni seguimiento de cabeza.' : questProceduralImmersive ? 'Quest inicia WebXR 6DoF, ancla el patrón al espacio y conserva una sola inmersión durante toda la batería procedural.' : 'Quest todavía no inicia WebXR en esta opción: muestra el ejercicio en un panel 2D del navegador. Activá Inmersivo WebXR debajo si la finalidad es compatible.'}</p>
          {config.displayMode === 'quest_browser' && !isImmersive && <div className="mt-4 rounded-2xl border border-[#B9D9C5] bg-[#F6FBF8] p-4">
            <p className="text-xs font-black text-[#28613D]">Presentación en Quest</p>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-white p-1">
              <button type="button" onClick={() => setQuestPresentationMode('panel_2d')} aria-pressed={config.questPresentationMode === 'panel_2d'} className={`min-h-11 rounded-lg px-3 text-[11px] font-black ${config.questPresentationMode === 'panel_2d' ? 'bg-[#171717] text-white' : 'text-[#4D745B]'}`}>Panel 2D</button>
              <button type="button" disabled={!questProceduralAvailable} onClick={() => setQuestPresentationMode('immersive_webxr')} aria-pressed={config.questPresentationMode === 'immersive_webxr'} className={`min-h-11 rounded-lg px-3 text-[11px] font-black disabled:cursor-not-allowed disabled:opacity-35 ${config.questPresentationMode === 'immersive_webxr' ? 'bg-[#28613D] text-white' : 'text-[#4D745B]'}`}>Inmersivo WebXR</button>
            </div>
            {!questProceduralAvailable && <p className="mt-3 text-[10px] leading-4 text-[#4D745B]">Esta finalidad se mantiene en panel 2D porque necesita otro flujo, usa intermitencia/tarea cognitiva o no tiene una geometría inmersiva coherente.</p>}
            {questProceduralImmersive && <details className="group mt-4 rounded-xl border border-[#B9D9C5] bg-white p-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-black text-[#28613D] [&::-webkit-details-marker]:hidden">Parámetros WebXR avanzados <ChevronDown className="ml-auto transition-transform group-open:rotate-180" size={16}/></summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-[11px] font-black text-[#2F2F2F]">Geometría<select disabled={!isFree} className={`${input} disabled:bg-[#F7F6F4]`} value={isFree ? config.questImmersiveGeometry : recommendedQuestGeometry(config)} onChange={(event) => set('questImmersiveGeometry', event.target.value as QuestImmersiveGeometry)}><option value="curved_panel">Panel curvo frontal</option><option value="cylinder">Cilindro envolvente</option><option value="sphere">Esfera envolvente</option><option value="front_disc">Disco frontal</option><option value="particle_tunnel">Túnel de puntos 3D</option></select><span className="mt-1 block font-normal text-[#747474]">{isFree ? 'Libre permite elegirla; revisá que sea coherente con el estímulo.' : 'La plataforma la selecciona según el patrón y la finalidad.'}</span></label>
                <label className="text-[11px] font-black text-[#2F2F2F]">Cobertura angular<select className={input} value={config.questImmersiveCoverage} onChange={(event) => set('questImmersiveCoverage', Number(event.target.value) as QuestImmersiveCoverage)}><option value="90">90° · frontal</option><option value="180">180° · semicampo</option><option value="360">360° · envolvente</option></select></label>
                <label className="text-[11px] font-black text-[#2F2F2F]">Velocidad angular: {config.questBackgroundAngularSpeed}°/s<input aria-label="Velocidad angular Quest" type="range" min="1" max="60" step="1" value={config.questBackgroundAngularSpeed} onChange={(event) => set('questBackgroundAngularSpeed', Number(event.target.value))} className="mt-3 w-full accent-[#28613D]"/></label>
                <label className="text-[11px] font-black text-[#2F2F2F]">Tamaño angular del patrón: {config.questPatternAngularSize}°<input aria-label="Tamaño angular del patrón Quest" type="range" min="1" max="45" step="1" value={config.questPatternAngularSize} onChange={(event) => set('questPatternAngularSize', Number(event.target.value))} className="mt-3 w-full accent-[#28613D]"/></label>
                {config.objectEnabled && <><label className="text-[11px] font-black text-[#2F2F2F]">Tamaño angular del blanco: {config.questTargetAngularSize}°<input aria-label="Tamaño angular del blanco Quest" type="range" min="0.5" max="12" step="0.5" value={config.questTargetAngularSize} onChange={(event) => set('questTargetAngularSize', Number(event.target.value))} className="mt-3 w-full accent-[#28613D]"/></label><label className="text-[11px] font-black text-[#2F2F2F]">Amplitud del blanco: {config.questTargetAmplitudeDegrees}°<input aria-label="Amplitud angular del blanco Quest" type="range" min="2" max="75" step="1" value={config.questTargetAmplitudeDegrees} onChange={(event) => set('questTargetAmplitudeDegrees', Number(event.target.value))} className="mt-3 w-full accent-[#28613D]"/></label></>}
              </div>
              <label className="mt-4 flex items-start gap-3 rounded-xl bg-[#F7F6F4] p-3 text-[11px] font-black text-[#2F2F2F]"><input type="checkbox" checked={config.questHeadStillGuard} onChange={(event) => set('questHeadStillGuard', event.target.checked)} className="mt-0.5 size-4 accent-[#28613D]"/><span>Avisar si la cabeza se aleja más de 10° del centro durante aproximadamente 1 segundo<span className="mt-1 block font-normal leading-4 text-[#747474]">Es un recordatorio; no detiene ni invalida automáticamente el ejercicio.</span></span></label>
            </details>}
          </div>}
          {setting === 'home' && <p className="mt-3 rounded-xl bg-[#F7F6F4] p-3 text-[11px] leading-5 text-[#747474]"><strong>Quest no se asigna al domicilio:</strong> cambiá la modalidad general a presencial para habilitarlo.</p>}
          {config.displayMode === 'vr_box' && <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-[#E8CE99] bg-[#FFFDF8] p-4 text-[#8A5B00]"><input type="checkbox" aria-label="Habilitar perfil Cardboard" disabled={isImmersive} className="mt-0.5 size-4 accent-[#E49A02] disabled:opacity-60" checked={config.cardboardEnabled} onChange={(event) => setCardboardEnabled(event.target.checked)}/><span><strong className="block text-xs">Usar Cardboard con seguimiento 3DoF{isImmersive ? ' · obligatorio para 360°' : ''}</strong><span className="mt-1 block text-[11px] leading-5">{isImmersive ? 'Solicita giroscopio y acelerómetro, calibra el frente y orienta la cámara dentro de una esfera equirectangular. Los controles duplicados permiten pausar, recentrar, omitir o salir.' : 'Solicita giroscopio y acelerómetro, calibra la dirección frontal y contrarresta el giro de la cabeza para crear un anclaje angular. También agrega controles para pausar, recentrar, omitir o salir. No equivale a posición 6DoF ni a calibración óptica por QR.'}</span></span></label>}
          {config.displayMode === 'vr_box' && config.cardboardEnabled && <details className="group mt-3 rounded-2xl border border-[#B9D9C5] bg-[#F6FBF8] p-4 text-[#28613D]">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden"><div><p className="text-xs font-black">Ajuste óptico avanzado del teléfono y visor</p><p className="mt-1 text-[11px] leading-5 text-[#4D745B]">Abrilo solo para configurar una combinación nueva de celular y VR Box.</p></div><ChevronDown aria-hidden="true" className="mt-1 shrink-0 transition-transform group-open:rotate-180" size={17}/></summary>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-3"><p className="max-w-xl text-[11px] leading-5 text-[#4D745B]">Se guarda en este navegador y una copia viaja dentro de la sesión para que el celular ejecute exactamente estos valores. Creá un perfil distinto para cada combinación teléfono–VR Box.</p><button type="button" onClick={viewerProfiles.createProfile} className="rounded-xl bg-[#28613D] px-3 py-2 text-[10px] font-black text-white">Nuevo perfil</button></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="text-[11px] font-black">Perfil<select aria-label="Perfil óptico Cardboard" className="mt-2 h-10 w-full rounded-xl border border-[#B9D9C5] bg-white px-3 text-xs" value={viewerProfile.id} onChange={(event) => viewerProfiles.selectProfile(event.target.value)}>{viewerProfiles.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
              <label className="text-[11px] font-black">Nombre<input aria-label="Nombre del perfil óptico" className="mt-2 h-10 w-full rounded-xl border border-[#B9D9C5] bg-white px-3 text-xs" value={viewerProfile.name} onChange={(event) => viewerProfiles.updateActiveProfile({ name: event.target.value })}/></label>
              <button type="button" disabled={viewerProfiles.profiles.length <= 1} onClick={viewerProfiles.removeActiveProfile} className="self-end rounded-xl border border-[#B9D9C5] px-3 py-2.5 text-[10px] font-black disabled:opacity-35">Eliminar</button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-[11px] font-black">Separación / acercamiento: {viewerProfile.imageSeparationPercent > 0 ? '+' : ''}{viewerProfile.imageSeparationPercent}%<input aria-label="Separación binocular" type="range" min="-15" max="15" step="1" className="mt-2 w-full accent-[#28613D]" value={viewerProfile.imageSeparationPercent} onChange={(event) => viewerProfiles.updateActiveProfile({ imageSeparationPercent: Number(event.target.value) })}/><span className="mt-1 block text-[10px] font-normal text-[#4D745B]">Valores negativos acercan las dos imágenes; valores positivos las separan.</span></label>
              <label className="text-[11px] font-black">Centro vertical: {viewerProfile.verticalOffsetPercent > 0 ? '+' : ''}{viewerProfile.verticalOffsetPercent}%<input aria-label="Centro vertical" type="range" min="-15" max="15" step="1" className="mt-2 w-full accent-[#28613D]" value={viewerProfile.verticalOffsetPercent} onChange={(event) => viewerProfiles.updateActiveProfile({ verticalOffsetPercent: Number(event.target.value) })}/></label>
              <label className="text-[11px] font-black">Campo visual horizontal: {viewerProfile.horizontalFovDegrees}°<input aria-label="Campo visual horizontal" type="range" min="60" max="115" step="1" className="mt-2 w-full accent-[#28613D]" value={viewerProfile.horizontalFovDegrees} onChange={(event) => viewerProfiles.updateActiveProfile({ horizontalFovDegrees: Number(event.target.value) })}/></label>
              <label className="text-[11px] font-black">Campo visual vertical: {viewerProfile.verticalFovDegrees}°<input aria-label="Campo visual vertical" type="range" min="45" max="105" step="1" className="mt-2 w-full accent-[#28613D]" value={viewerProfile.verticalFovDegrees} onChange={(event) => viewerProfiles.updateActiveProfile({ verticalFovDegrees: Number(event.target.value) })}/></label>
              <label className="text-[11px] font-black">Corrección de lente: {viewerProfile.lensDistortionPercent}%<input aria-label="Corrección de lente" type="range" min="0" max="35" step="1" className="mt-2 w-full accent-[#28613D]" value={viewerProfile.lensDistortionPercent} onChange={(event) => viewerProfiles.updateActiveProfile({ lensDistortionPercent: Number(event.target.value) })}/><span className="mt-1 block text-[10px] font-normal text-[#4D745B]">Curva la imagen antes de las lentes, como el modo Cardboard de YouTube.</span></label>
            </div>
            <div className="mt-4 grid aspect-[4/1] grid-cols-2 divide-x divide-white/15 overflow-hidden rounded-xl bg-[#171717]">{(['left', 'right'] as const).map((eye) => { const center = cardboardEyeCenterPercent(viewerProfile, eye); return <div key={eye} className="relative"><div className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-xs font-black text-white" style={{ left: `${center.left}%`, top: `${center.top}%` }}>+</div></div> })}</div>
            <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => viewerProfiles.updateActiveProfile({ imageSeparationPercent: -5 })} className="rounded-xl bg-white px-3 py-2 text-[10px] font-black shadow-sm">Acercar imágenes (-5%)</button><button type="button" onClick={() => viewerProfiles.updateActiveProfile({ imageSeparationPercent: 0 })} className="rounded-xl bg-white px-3 py-2 text-[10px] font-black shadow-sm">Separación neutra (0%)</button></div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-[10px] leading-4 text-[#4D745B]">Ajustá primero acercamiento y altura hasta ver un único + centrado. El campo visual regula cuánto se desplaza la escena con cada giro de cabeza.</p><button type="button" onClick={viewerProfiles.resetActiveProfile} className="rounded-xl bg-white px-3 py-2 text-[10px] font-black shadow-sm">Restablecer valores</button></div>
          </details>}
          {config.displayMode === 'vr_box' && <div className="mt-3 rounded-xl bg-[#FFF7E8] p-3 text-[11px] font-bold leading-5 text-[#8A5B00]"><p>Solo se ejecuta sentado, en superficie firme, por tiempo y con avance automático. La sesión agrega 20 segundos para colocar o retirar el visor.</p><p className="mt-2">Antes de empezar, la persona debe ver un único marcador nítido. Si ve doble, borroso o no logra fusionarlo, debe retirar el visor y no comenzar.</p></div>}
          {config.displayMode !== 'vr_box' && !isVrBoxPurposeSupported(config.purpose) && <p className="mt-3 rounded-xl bg-[#F7F6F4] p-3 text-[11px] leading-5 text-[#747474]"><strong>No disponible en VR Box:</strong> {vrBoxPurposeCompatibility[config.purpose].reason}</p>}
          <div role={compatibility.valid ? 'status' : 'alert'} className={`mt-4 rounded-2xl border p-4 ${isFree ? 'border-[#E8CE99] bg-[#FFF7E8] text-[#8A5B00]' : compatibility.valid ? 'border-[#B9D9C5] bg-[#F0F8F3] text-[#28613D]' : 'border-[#eccfd2] bg-[#fceced] text-[#9A3842]'}`}>
            <p className="flex gap-2 text-xs font-black">{compatibility.valid && !isFree ? <CircleCheck className="shrink-0" size={17}/> : <ShieldAlert className="shrink-0" size={17}/>} {isFree ? 'Configuración Libre · sin validación clínica' : compatibility.valid ? 'Configuración coherente' : 'Configuración bloqueada'}</p>
            <p className="mt-2 text-[11px] font-bold leading-5">{compatibility.explanation}</p>
            {!compatibility.valid && <ul className="mt-3 space-y-2 text-[11px] leading-5">{compatibility.issues.map((item) => <li key={item.code}><strong>{item.message}</strong> {item.correction}</li>)}</ul>}
            {compatibility.clinicalNote && <p className="mt-3 border-t border-current/15 pt-3 text-[11px] leading-5">{compatibility.clinicalNote}</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden"><ClipboardCheck size={18} className="text-[#E49A02]"/><h3 className="font-black text-[#171717]">Plan de ejecución</h3><span className={`ml-auto rounded-full px-3 py-1 text-[10px] font-black ${execution.feasibility === 'ready' ? 'bg-[#F0F8F3] text-[#28613D]' : execution.feasibility === 'not_executable' ? 'bg-[#fceced] text-[#9A3842]' : 'bg-[#FFF7E8] text-[#8A5B00]'}`}>{execution.feasibilityLabel}</span><ChevronDown aria-hidden="true" className="shrink-0 text-[#747474] transition-transform group-open:rotate-180" size={17}/></summary>
            <p className="mt-3 text-[11px] leading-5 text-[#747474]">Revisá cómo se hará realmente: material, preparación, respuesta y finalización.</p>
            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div className="rounded-xl bg-[#F7F6F4] p-3"><dt className="font-black text-[#2F2F2F]">Material</dt><dd className="mt-1 leading-5 text-[#747474]">{execution.equipment.join(' · ')}</dd></div><div className="rounded-xl bg-[#F7F6F4] p-3"><dt className="font-black text-[#2F2F2F]">Preparación</dt><dd className="mt-1 leading-5 text-[#747474]">{execution.setup}</dd></div><div className="rounded-xl bg-[#F7F6F4] p-3"><dt className="font-black text-[#2F2F2F]">Respuesta</dt><dd className="mt-1 leading-5 text-[#747474]">{execution.response}</dd></div><div className="rounded-xl bg-[#F7F6F4] p-3"><dt className="font-black text-[#2F2F2F]">Cómo termina</dt><dd className="mt-1 leading-5 text-[#747474]">{execution.finish}</dd></div></dl>
          </details>
          {execution.warnings.length > 0 && <ul className="mt-4 space-y-2 rounded-xl bg-[#FFF7E8] p-4 text-[11px] font-bold leading-5 text-[#8A5B00]">{execution.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>}
        </section>

        <details className="group rounded-2xl border border-[#E9E7E7] bg-white p-5">
          <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden"><BookOpen size={18} className="text-[#E49A02]"/><h3 className="font-black text-[#171717]">Fundamento, límites y fuentes</h3><ChevronDown aria-hidden="true" className="ml-auto shrink-0 text-[#747474] transition-transform group-open:rotate-180" size={17}/></summary>
          <p className="mt-3 text-[11px] leading-5 text-[#747474]">{isImmersive ? 'La evidencia disponible permite considerar realidad virtual y escenas de vida real como complemento de rehabilitación vestibular y exposición contextual. Es heterogénea y no valida una dosis universal, una progresión automática ni que un video particular trate un diagnóstico por sí solo.' : cognitive ? 'La evidencia apoya explorar doble tarea en adultos mayores y reconoce interferencia cognitivo-motora en trastornos vestibulares, pero no valida estas tres configuraciones como prueba diagnóstica ni como progresión automática. La transferencia a RVO digital es indirecta y requiere criterio profesional.' : 'Los rangos del constructor son controles técnicos, no una dosis universal. La finalidad, dosis, progresión y criterios de detención deben quedar indicados y revisados por el profesional.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">{evidenceSources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer" title={source.title} className="rounded-full border border-[#E8CE99] bg-[#FFF7E8] px-3 py-2 text-[10px] font-black text-[#8A5B00]">{source.id} · {source.year}</a>)}</div>
        </details>

        <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5">
          <h3 className="font-black text-[#171717]">Dosis y avance</h3>
          {isFirst && <div className="mt-4 rounded-xl border border-[#E8CE99] bg-[#FFF7E8] p-4">
            <p className="text-xs font-black text-[#2F2F2F]">Preparación antes de comenzar</p>
            <div className="mt-3 grid grid-cols-3 gap-2">{([5, 10, 20] as PreparationSeconds[]).map((seconds) => <button key={seconds} type="button" onClick={() => set('preparationSeconds', seconds)} aria-pressed={config.preparationSeconds === seconds} className={`h-11 rounded-lg border text-sm font-black ${config.preparationSeconds === seconds ? 'border-[#E49A02] bg-[#E49A02] text-white' : 'border-[#E8CE99] bg-white text-[#8A5B00]'}`}>{seconds} s</button>)}</div>
            <p className="mt-3 text-[11px] leading-5 text-[#8A5B00]">La cuenta regresiva aparece una sola vez antes del primer ejercicio.</p>
          </div>}
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#F7F6F4] p-1">
            <button type="button" onClick={() => set('doseMode', 'time')} aria-pressed={config.doseMode === 'time'} className={`h-10 rounded-lg text-xs font-black ${config.doseMode === 'time' ? 'bg-white text-[#E49A02] shadow-sm' : 'text-[#747474]'}`}>Por tiempo</button>
            <button type="button" disabled={config.displayMode === 'vr_box' || config.displayMode === 'quest_browser' || cognitive} onClick={() => onChange({ ...config, doseMode: 'repetitions', advanceMode: 'manual' })} aria-pressed={config.doseMode === 'repetitions'} className={`h-10 rounded-lg text-xs font-black disabled:cursor-not-allowed disabled:opacity-35 ${config.doseMode === 'repetitions' ? 'bg-white text-[#E49A02] shadow-sm' : 'text-[#747474]'}`}>Por repeticiones</button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 min-[360px]:grid-cols-3">
            {config.doseMode === 'time' ? <label className="text-xs font-black text-[#2F2F2F]">Ejercicio<span className="relative block"><input type="number" min="10" max={immersiveScenario?.maximumSeconds ?? 300} className={input} value={config.durationSeconds} onChange={(event) => set('durationSeconds', Number(event.target.value))} /><span className="absolute bottom-3 right-3 text-[10px] text-[#747474]">s</span></span></label> : <label className="text-xs font-black text-[#2F2F2F]">Objetivo<span className="relative block"><input type="number" min="1" max="100" className={input} value={config.targetRepetitions} onChange={(event) => set('targetRepetitions', Number(event.target.value))} /><span className="absolute bottom-3 right-3 text-[10px] text-[#747474]">rep.</span></span></label>}
            <label className="text-xs font-black text-[#2F2F2F]">Descanso<span className="relative block"><input type="number" min="0" max="180" className={input} value={config.restSeconds} onChange={(event) => set('restSeconds', Number(event.target.value))} /><span className="absolute bottom-3 right-3 text-[10px] text-[#747474]">s</span></span></label>
            <label className="text-xs font-black text-[#2F2F2F]">Vueltas<input type="number" min="1" max={isImmersive ? 1 : 10} disabled={isImmersive} className={`${input} disabled:bg-[#F7F6F4]`} value={config.rounds} onChange={(event) => set('rounds', Number(event.target.value))} /></label>
          </div>
          <label className="mt-4 block text-xs font-black text-[#2F2F2F]">Avance<select disabled={config.displayMode === 'vr_box' || config.displayMode === 'quest_browser' || cognitive} className={`${input} disabled:bg-[#F7F6F4] disabled:text-[#747474]`} value={config.advanceMode} onChange={(event) => set('advanceMode', event.target.value as ExerciseConfig['advanceMode'])}><option value="manual">Confirmación manual</option><option value="automatic" disabled={config.doseMode === 'repetitions' || cognitive}>Automático al terminar el tiempo</option></select></label>
          {config.doseMode === 'repetitions' && <p className="mt-3 text-[11px] leading-5 text-[#747474]">La aplicación no contará movimientos: el paciente informará si completó el objetivo o cuántas repeticiones realizó.</p>}
          <div className="mt-5"><label className="inline-flex items-center gap-2 text-xs font-black text-[#2F2F2F]"><input type="checkbox" disabled={config.purpose === 'cognitive_visual' || config.displayMode === 'vr_box' || config.displayMode === 'quest_browser'} checked={config.metronomeEnabled} onChange={(event) => set('metronomeEnabled', event.target.checked)} className="size-4 accent-[#E49A02] disabled:opacity-35" /> Metrónomo con sonido</label>{config.metronomeEnabled && <div className="mt-3 grid gap-4 rounded-2xl bg-[#F7F6F4] p-4 sm:grid-cols-2"><div><label className="text-xs font-black text-[#2F2F2F]">Ritmo: {config.metronomeHz.toFixed(2)} señales/s · {Math.round(config.metronomeHz * 60)} BPM<input aria-label="Ritmo del metrónomo" type="range" min="0.1" max="4" step="0.1" value={config.metronomeHz} onChange={(event) => set('metronomeHz', Number(event.target.value))} className="mt-2 w-full accent-[#E49A02]" /></label><div className="mt-2 flex flex-wrap gap-1.5">{([{ label: 'Muy bajo', value: 0.25 }, { label: 'Bajo', value: 0.5 }, { label: 'Medio', value: 1 }, { label: 'Alto', value: 2 }, { label: 'Muy alto', value: 3 }] as const).map((preset) => <button key={preset.label} type="button" onClick={() => set('metronomeHz', preset.value)} className="rounded-lg border border-[#DEDCD9] bg-white px-2 py-1.5 text-[9px] font-black text-[#5E5E5E]">{preset.label}</button>)}</div></div><div><label className="text-xs font-black text-[#2F2F2F]">Tono: {config.metronomeToneHz} Hz<select aria-label="Tono del metrónomo" className={input} value={config.metronomeToneHz} onChange={(event) => set('metronomeToneHz', Number(event.target.value))}><option value="220">Grave · 220 Hz</option><option value="440">Medio-grave · 440 Hz</option><option value="660">Medio · 660 Hz</option><option value="880">Agudo · 880 Hz</option><option value="1320">Muy agudo · 1320 Hz</option></select></label></div></div>}</div>
          {config.displayMode === 'vr_box' && <p className="mt-3 text-[11px] leading-5 text-[#747474]">El metrónomo queda desactivado porque el navegador móvil puede bloquear el audio después de la preparación dentro del visor.</p>}
          {config.metronomeEnabled && <p className="mt-3 text-[11px] leading-5 text-[#747474]">Cada señal sonora indica el cambio acordado por el profesional. Señales/s y BPM describen el metrónomo; no miden velocidad cefálica ni equivalen automáticamente a ciclos completos.</p>}
        </section>
      </div>

      <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
        <div className="overflow-hidden rounded-2xl border border-[#E9E7E7] bg-white">
          <div className="flex items-center gap-2 p-4 text-sm font-black text-[#171717]"><Eye size={17} className="text-[#E49A02]" /> Vista previa</div>
          <div className="relative aspect-video bg-[#081113]">{isPhysical ? <div className="grid size-full place-items-center p-6 text-center text-white"><div><Accessibility className="mx-auto text-[#E49A02]" size={54}/><p className="mt-4 text-sm font-black">{config.patientInstruction || 'Instrucción física pendiente'}</p><p className="mt-3 text-xs text-white/55">{config.posture === 'seated' ? 'Sentado' : config.posture === 'standing' ? 'De pie' : 'Marcha'} · {config.surface === 'firm' ? 'Superficie firme' : 'Superficie inestable'}</p></div></div> : isImmersive && immersiveScenario ? <ImmersivePanorama scenario={immersiveScenario} spatialTarget={{ enabled: config.objectEnabled, color: config.objectColor, size: config.objectSize, shape: config.immersiveTargetShape, azimuthDegrees: config.immersiveTargetAzimuthDegrees, elevationDegrees: config.immersiveTargetElevationDegrees }} className="absolute inset-0"/> : config.displayMode === 'vr_box' ? <StereoscopicExerciseCanvas config={config} viewerProfile={viewerProfile}/> : <ExerciseCanvas config={config} paused={config.strobeEnabled} className="size-full" />}{config.strobeEnabled && <span className="absolute bottom-3 left-3 rounded-full bg-black/75 px-3 py-2 text-[10px] font-black text-white">Intermitencia pausada en la vista previa</span>}{questProceduralImmersive && <span className="absolute bottom-3 left-3 rounded-full bg-[#28613D] px-3 py-2 text-[10px] font-black text-white">Simulación plana · la ejecución real usa WebXR {config.questImmersiveCoverage}°</span>}</div>
          <div className="p-5">
            <p className="text-sm font-black text-[#2F2F2F]">{config.name}</p>
            <p className="mt-2 text-xs text-[#747474]">{config.doseMode === 'time' ? `${config.durationSeconds} s` : `${config.targetRepetitions} repeticiones`} × {config.rounds} vueltas · avance {config.advanceMode === 'manual' ? 'manual' : 'automático'}</p>
            <button type="button" disabled={!compatibility.valid || activatingSensors} onClick={() => void startPreview()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E49A02] px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Play size={16} /> {activatingSensors ? 'Comprobando giroscopio… mové suavemente el celular' : compatibility.valid ? questProceduralImmersive ? 'Abrir prueba WebXR en Quest' : 'Probar ejercicio' : 'Corregí la compatibilidad para probar'}</button>
            {previewError && <p role="alert" className="mt-3 rounded-xl bg-[#fceced] p-3 text-[11px] font-bold leading-5 text-[#9A3842]">{previewError}</p>}
          </div>
        </div>
      </aside>
      {playing && compatibility.valid && (questProceduralImmersive ? <QuestProceduralExerciseRunner config={config} onClose={closePreview}/> : <ExercisePlayer config={config} preparationSeconds={config.displayMode === 'vr_box' ? 20 : undefined} onExit={closePreview} onSkip={closePreview} onComplete={closePreview} />)}
    </div>
  )
}
