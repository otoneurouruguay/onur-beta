import { Accessibility, BookOpen, CircleCheck, ClipboardCheck, Eye, Play, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { clinicalSources } from '../clinicalGeneration/catalog'
import { cognitiveInstruction, cognitiveSymbolLabels, cognitiveTaskLabel } from '../exercise/cognitive'
import { ExerciseCanvas } from '../exercise/ExerciseCanvas'
import { activateCardboardTracking } from '../exercise/cardboardTracking'
import { cardboardEyeCenterPercent, useCardboardViewerProfiles } from '../exercise/cardboardViewerProfiles'
import { analyzeExerciseCompatibility, applyExercisePurpose, exercisePurposeLabels, isVrBoxPurposeSupported, vrBoxPurposeCompatibility } from '../exercise/compatibility'
import { buildExerciseExecutionPlan, type ExerciseSetting } from '../exercise/execution'
import { ExercisePlayer } from '../exercise/ExercisePlayer'
import { StereoscopicExerciseCanvas } from '../exercise/StereoscopicExerciseCanvas'
import type { BackgroundType, CognitiveResponseMode, CognitiveSymbol, CognitiveTaskMode, ExerciseConfig, ExercisePurpose, LinearMotionDirection, MotionDirection, ObjectDirection, PreparationSeconds } from '../exercise/types'
import { getImmersiveScenario, immersiveScenarios } from '../immersive/catalog'
import { ImmersivePanorama } from '../immersive/ImmersivePanorama'

interface SessionExerciseEditorProps {
  config: ExerciseConfig
  isFirst?: boolean
  setting?: ExerciseSetting
  onChange: (config: ExerciseConfig) => void
}

const input = 'mt-2 h-11 w-full rounded-2xl border border-[#E9E7E7] bg-white px-3 text-sm'
const linearDirections: LinearMotionDirection[] = ['left', 'right', 'up', 'down', 'up_left', 'up_right', 'down_left', 'down_right']
const directionLabels: Record<MotionDirection, string> = {
  left: 'Hacia la izquierda', right: 'Hacia la derecha', up: 'Hacia arriba', down: 'Hacia abajo',
  up_left: 'Diagonal ↖', up_right: 'Diagonal ↗', down_left: 'Diagonal ↙', down_right: 'Diagonal ↘',
  clockwise: 'Horario', counterclockwise: 'Antihorario',
}
const objectDirectionLabels: Record<ObjectDirection, string> = {
  horizontal: 'Horizontal', vertical: 'Vertical', diagonal_down: 'Diagonal ↖ ↘', diagonal_up: 'Diagonal ↙ ↗',
}

export function SessionExerciseEditor({ config, isFirst = false, setting = 'unspecified', onChange }: SessionExerciseEditorProps) {
  const [playing, setPlaying] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [activatingSensors, setActivatingSensors] = useState(false)
  const viewerProfiles = useCardboardViewerProfiles()
  const viewerProfile = viewerProfiles.activeProfile
  const set = <Key extends keyof ExerciseConfig>(key: Key, value: ExerciseConfig[Key]) => onChange({ ...config, [key]: value })
  const directions: MotionDirection[] = config.backgroundType === 'spiral' ? ['clockwise', 'counterclockwise'] : linearDirections
  const isPhysical = config.kind === 'guided_physical'
  const isFree = config.purpose === 'custom_free'
  const isImmersive = config.purpose === 'immersive_context'
  const immersiveScenario = getImmersiveScenario(config.immersiveScenarioId)
  const compatibility = analyzeExerciseCompatibility(config)
  const execution = buildExerciseExecutionPlan(config, setting)
  const cognitive = config.cognitiveTaskMode !== 'none'
  const evidenceSourceIds = new Set<string>(['SRC-001'])
  if (config.clinicalProtocol === 'pppd') { evidenceSourceIds.add('SRC-017'); evidenceSourceIds.add('SRC-018'); evidenceSourceIds.add('SRC-019') }
  if (config.purpose === 'optokinetic' || config.purpose === 'visual_habituation') evidenceSourceIds.add('SRC-022')
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
    backgroundDirection: backgroundType === 'spiral'
      ? (config.backgroundDirection === 'counterclockwise' ? 'counterclockwise' : 'clockwise')
      : config.backgroundDirection === 'clockwise' || config.backgroundDirection === 'counterclockwise' ? 'left' : config.backgroundDirection,
  })
  const setDisplayMode = (displayMode: ExerciseConfig['displayMode']) => onChange(displayMode === 'vr_box'
    ? { ...config, displayMode, cardboardEnabled: isImmersive ? true : config.cardboardEnabled, doseMode: 'time', advanceMode: 'automatic', posture: 'seated', surface: 'firm', supervision: isImmersive ? 'direct_clinician' : config.supervision, metronomeEnabled: false }
    : displayMode === 'quest_browser'
      ? { ...config, displayMode, cardboardEnabled: false, doseMode: 'time', advanceMode: 'automatic', posture: 'seated', surface: 'firm', supervision: 'direct_clinician', metronomeEnabled: false }
      : { ...config, displayMode, cardboardEnabled: false })
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
    <div className="grid gap-5 xl:grid-cols-[1fr_.9fr]">
      <div className="space-y-5">
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
              <option value="saccades">{exercisePurposeLabels.saccades}</option>
              <option value="optokinetic">{exercisePurposeLabels.optokinetic}</option>
              <option value="visual_habituation">{exercisePurposeLabels.visual_habituation}</option>
              <option value="immersive_context">{exercisePurposeLabels.immersive_context}</option>
              <option value="cognitive_visual">{exercisePurposeLabels.cognitive_visual}</option>
              <option value="custom_free">{exercisePurposeLabels.custom_free}</option>
            </>}</select></label>
          {isImmersive && <label className="mt-4 block text-xs font-black text-[#2F2F2F]">Escenario clínico 360°<select className={input} value={config.immersiveScenarioId ?? ''} onChange={(event) => setImmersiveScenario(event.target.value)}>{immersiveScenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>Nivel {scenario.intensity} · {scenario.title}</option>)}</select></label>}
          <label className="mt-4 block text-xs font-black text-[#2F2F2F]">Instrucción para el paciente<textarea rows={3} className="mt-2 w-full rounded-2xl border border-[#E9E7E7] bg-white p-3 text-sm font-normal" value={config.patientInstruction} onChange={(event) => set('patientInstruction', event.target.value)} /></label>
          {immersiveScenario && <div className="mt-4 rounded-2xl border border-[#B9D9C5] bg-[#F0F8F3] p-4 text-[#28613D]"><p className="text-xs font-black">Exposición contextual · intensidad técnica {immersiveScenario.intensity}/3</p><p className="mt-2 text-[11px] leading-5">{immersiveScenario.clinicalUse}</p><ul className="mt-2 space-y-1 text-[10px] leading-4">{immersiveScenario.cautions.map((caution) => <li key={caution}>• {caution}</li>)}</ul><p className="mt-3 border-t border-[#B9D9C5] pt-3 text-[10px] font-bold">No es RVO, prueba diagnóstica, marcha virtual ni progresión automática.</p></div>}
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
              <label className="text-xs font-black text-[#2F2F2F]">Fondo<select className={input} value={config.backgroundType} onChange={(event) => setBackgroundType(event.target.value as BackgroundType)}><option value="solid">Color sólido</option><option value="bars">Barras</option><option value="spiral">Espiral</option><option value="checkerboard">Damero</option><option value="dots">Puntos</option></select></label>
              <label className="text-xs font-black text-[#2F2F2F]">Dirección<select disabled={config.backgroundType === 'solid'} className={`${input} disabled:bg-[#F7F6F4] disabled:text-[#747474]`} value={config.backgroundDirection} onChange={(event) => set('backgroundDirection', event.target.value as MotionDirection)}>{config.backgroundType === 'solid' ? <option value={config.backgroundDirection}>No aplica</option> : directions.map((direction) => <option key={direction} value={direction}>{directionLabels[direction]}</option>)}</select></label>
            </div>
            <label className="mt-4 block text-xs font-black text-[#2F2F2F]">Velocidad de fondo: {config.backgroundSpeed}<input disabled={config.backgroundType === 'solid'} type="range" min="0" max="160" step="5" className="mt-3 w-full accent-[#E49A02] disabled:opacity-35" value={config.backgroundSpeed} onChange={(event) => set('backgroundSpeed', Number(event.target.value))} /></label>
            {isFree && <div className="mt-4 grid gap-4 rounded-xl bg-[#F7F6F4] p-4 sm:grid-cols-3">
              <label className="text-xs font-black text-[#2F2F2F]">Color de fondo<input aria-label="Color de fondo" type="color" className="mt-2 h-11 w-full rounded-xl border border-[#E9E7E7] bg-white p-1" value={config.backgroundColor} onChange={(event) => set('backgroundColor', event.target.value)} /></label>
              <label className="text-xs font-black text-[#2F2F2F]">Color del patrón<input aria-label="Color del patrón" disabled={config.backgroundType === 'solid'} type="color" className="mt-2 h-11 w-full rounded-xl border border-[#E9E7E7] bg-white p-1 disabled:opacity-35" value={config.foregroundColor} onChange={(event) => set('foregroundColor', event.target.value)} /></label>
              <label className="text-xs font-black text-[#2F2F2F]">Tamaño del patrón: {config.stripeWidth}px<input disabled={config.backgroundType === 'solid'} type="range" min="8" max="140" step="2" className="mt-3 w-full accent-[#E49A02] disabled:opacity-35" value={config.stripeWidth} onChange={(event) => set('stripeWidth', Number(event.target.value))} /></label>
            </div>}
            {config.backgroundType === 'bars' && linearDirections.includes(config.backgroundDirection as LinearMotionDirection) && config.backgroundDirection.includes('_') && <p className="mt-3 text-[11px] leading-5 text-[#747474]">Las barras se dibujan diagonales y avanzan en la dirección elegida.</p>}
            {config.backgroundType === 'spiral' && <p className="mt-3 text-[11px] leading-5 text-[#747474]">La espiral solo admite rotación horaria o antihoraria; una dirección diagonal no describe su geometría.</p>}
          </section>

          <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5">
            <div className="flex items-center justify-between"><h3 className="font-black text-[#171717]">Objeto</h3><label className="text-xs font-bold"><input type="checkbox" checked={config.objectEnabled} onChange={(event) => set('objectEnabled', event.target.checked)} /> Mostrar blanco</label></div>
            <div className={`mt-4 grid grid-cols-2 gap-4 ${config.objectEnabled ? '' : 'pointer-events-none opacity-40'}`}>
              <label className="text-xs font-black text-[#2F2F2F]">Comportamiento<select className={input} value={config.objectMode} onChange={(event) => set('objectMode', event.target.value as ExerciseConfig['objectMode'])}><option value="fixed">Fijo</option><option value="tracking">Seguimiento</option><option value="saccades">Sacadas</option></select></label>
              <label className="text-xs font-black text-[#2F2F2F]">Tamaño: {config.objectSize}px<input type="range" min="12" max="90" step="2" className="mt-4 w-full accent-[#E49A02]" value={config.objectSize} onChange={(event) => set('objectSize', Number(event.target.value))} /></label>
              {config.objectMode === 'tracking' && <><label className="text-xs font-black text-[#2F2F2F]">Dirección<select className={input} value={config.objectDirection} onChange={(event) => set('objectDirection', event.target.value as ObjectDirection)}>{(Object.keys(objectDirectionLabels) as ObjectDirection[]).map((direction) => <option key={direction} value={direction}>{objectDirectionLabels[direction]}</option>)}</select></label><label className="text-xs font-black text-[#2F2F2F]">Frecuencia: {config.objectSpeedHz} Hz<input type="range" min="0.1" max="1.5" step="0.1" className="mt-4 w-full accent-[#E49A02]" value={config.objectSpeedHz} onChange={(event) => set('objectSpeedHz', Number(event.target.value))} /></label></>}
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
                <label className="text-xs font-black text-[#2F2F2F]">Cambio de figura: cada {config.cognitiveStimulusSeconds.toFixed(1)} s<input type="range" min="1" max="5" step="0.5" className="mt-4 w-full accent-[#E49A02]" value={config.cognitiveStimulusSeconds} onChange={(event) => set('cognitiveStimulusSeconds', Number(event.target.value))} /></label>
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
          <label className="mt-4 block text-xs font-black text-[#2F2F2F]">Modo<select className={input} value={config.displayMode} onChange={(event) => setDisplayMode(event.target.value as ExerciseConfig['displayMode'])}><option value="standard" disabled={isImmersive}>Pantalla 2D</option><option value="vr_box" disabled={!isVrBoxPurposeSupported(config.purpose) || isPhysical || cognitive}>{isImmersive ? 'VR Box · esfera 360° con Cardboard 3DoF' : 'VR Box · presentación binocular 2D'}</option><option value="quest_browser" disabled={setting === 'home' || ['gaze_stabilization', 'gaze_stabilization_x2', 'gaze_substitution_remembered'].includes(config.purpose) || isPhysical || cognitive}>{isImmersive ? 'Meta Quest · WebXR inmersivo' : 'Meta Quest · clínica, navegador 2D'}</option></select></label>
          <p className="mt-3 text-[11px] leading-5 text-[#747474]">{isImmersive ? config.displayMode === 'vr_box' ? 'Cardboard usa la orientación 3DoF del celular para explorar la esfera desde un punto fijo. El perfil óptico aplica separación, campo visual y corrección radial manual. No mide desplazamiento corporal y no se usa de pie ni caminando.' : 'Quest abre WebXR inmersivo con seguimiento del visor. La dosis comienza recién después de confirmar la inmersión y siempre se ejecuta en clínica.' : config.displayMode === 'standard' ? 'La pantalla debe permanecer inmóvil. El paciente puede confirmar con controles visibles.' : config.displayMode === 'vr_box' ? config.cardboardEnabled ? 'Cardboard solicita los sensores del celular, espera a que termine la preparación y calibra una posición frontal estable. El perfil óptico manual ajusta centros, campo visual y corrección radial; no mide traslación 6DoF ni reemplaza una calibración específica por QR.' : 'VR Box muestra el mismo estímulo 2D a ambos ojos. No usa botones, mirada ni controles externos, y no implementa anclaje espacial ni seguimiento de cabeza.' : 'Quest queda limitado a la clínica, con supervisión profesional directa. El ejercicio 2D todavía no inicia WebXR: se muestra en una ventana del navegador; solo la biblioteca contextual 360° abre inmersión.'}</p>
          {setting === 'home' && <p className="mt-3 rounded-xl bg-[#F7F6F4] p-3 text-[11px] leading-5 text-[#747474]"><strong>Quest no se asigna al domicilio:</strong> cambiá la modalidad general a presencial para habilitarlo.</p>}
          {config.displayMode === 'vr_box' && <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-[#E8CE99] bg-[#FFFDF8] p-4 text-[#8A5B00]"><input type="checkbox" aria-label="Habilitar perfil Cardboard" disabled={isImmersive} className="mt-0.5 size-4 accent-[#E49A02] disabled:opacity-60" checked={config.cardboardEnabled} onChange={(event) => setCardboardEnabled(event.target.checked)}/><span><strong className="block text-xs">Usar Cardboard con seguimiento 3DoF{isImmersive ? ' · obligatorio para 360°' : ''}</strong><span className="mt-1 block text-[11px] leading-5">{isImmersive ? 'Solicita giroscopio y acelerómetro, calibra el frente y orienta la cámara dentro de una esfera equirectangular. Los controles duplicados permiten pausar, recentrar, omitir o salir.' : 'Solicita giroscopio y acelerómetro, calibra la dirección frontal y contrarresta el giro de la cabeza para crear un anclaje angular. También agrega controles para pausar, recentrar, omitir o salir. No equivale a posición 6DoF ni a calibración óptica por QR.'}</span></span></label>}
          {config.displayMode === 'vr_box' && config.cardboardEnabled && <div className="mt-3 rounded-2xl border border-[#B9D9C5] bg-[#F6FBF8] p-4 text-[#28613D]">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black">Perfil óptico de este teléfono y visor</p><p className="mt-1 text-[11px] leading-5 text-[#4D745B]">Se guarda solamente en este navegador. Creá un perfil distinto para cada combinación teléfono–VR Box.</p></div><button type="button" onClick={viewerProfiles.createProfile} className="rounded-xl bg-[#28613D] px-3 py-2 text-[10px] font-black text-white">Nuevo perfil</button></div>
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
          </div>}
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
          <div className="flex items-center gap-2"><ClipboardCheck size={18} className="text-[#E49A02]"/><h3 className="font-black text-[#171717]">Plan de ejecución</h3><span className={`ml-auto rounded-full px-3 py-1 text-[10px] font-black ${execution.feasibility === 'ready' ? 'bg-[#F0F8F3] text-[#28613D]' : execution.feasibility === 'not_executable' ? 'bg-[#fceced] text-[#9A3842]' : 'bg-[#FFF7E8] text-[#8A5B00]'}`}>{execution.feasibilityLabel}</span></div>
          <p className="mt-2 text-[11px] leading-5 text-[#747474]">Revisá primero cómo se hará realmente. Una buena idea clínica no alcanza si la persona no puede prepararla, comprenderla, responder o terminarla de forma segura.</p>
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div className="rounded-xl bg-[#F7F6F4] p-3"><dt className="font-black text-[#2F2F2F]">Material</dt><dd className="mt-1 leading-5 text-[#747474]">{execution.equipment.join(' · ')}</dd></div><div className="rounded-xl bg-[#F7F6F4] p-3"><dt className="font-black text-[#2F2F2F]">Preparación</dt><dd className="mt-1 leading-5 text-[#747474]">{execution.setup}</dd></div><div className="rounded-xl bg-[#F7F6F4] p-3"><dt className="font-black text-[#2F2F2F]">Respuesta</dt><dd className="mt-1 leading-5 text-[#747474]">{execution.response}</dd></div><div className="rounded-xl bg-[#F7F6F4] p-3"><dt className="font-black text-[#2F2F2F]">Cómo termina</dt><dd className="mt-1 leading-5 text-[#747474]">{execution.finish}</dd></div></dl>
          {execution.warnings.length > 0 && <ul className="mt-4 space-y-2 rounded-xl bg-[#FFF7E8] p-4 text-[11px] font-bold leading-5 text-[#8A5B00]">{execution.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>}
        </section>

        <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5">
          <div className="flex items-center gap-2"><BookOpen size={18} className="text-[#E49A02]"/><h3 className="font-black text-[#171717]">Fundamento y límites</h3></div>
          <p className="mt-3 text-[11px] leading-5 text-[#747474]">{isImmersive ? 'La evidencia disponible permite considerar realidad virtual y escenas de vida real como complemento de rehabilitación vestibular y exposición contextual. Es heterogénea y no valida una dosis universal, una progresión automática ni que un video particular trate un diagnóstico por sí solo.' : cognitive ? 'La evidencia apoya explorar doble tarea en adultos mayores y reconoce interferencia cognitivo-motora en trastornos vestibulares, pero no valida estas tres configuraciones como prueba diagnóstica ni como progresión automática. La transferencia a RVO digital es indirecta y requiere criterio profesional.' : 'Los rangos del constructor son controles técnicos, no una dosis universal. La finalidad, dosis, progresión y criterios de detención deben quedar indicados y revisados por el profesional.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">{evidenceSources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer" title={source.title} className="rounded-full border border-[#E8CE99] bg-[#FFF7E8] px-3 py-2 text-[10px] font-black text-[#8A5B00]">{source.id} · {source.year}</a>)}</div>
        </section>

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
          <div className="mt-4 grid grid-cols-3 gap-3">
            {config.doseMode === 'time' ? <label className="text-xs font-black text-[#2F2F2F]">Ejercicio<span className="relative block"><input type="number" min="10" max={immersiveScenario?.maximumSeconds ?? 300} className={input} value={config.durationSeconds} onChange={(event) => set('durationSeconds', Number(event.target.value))} /><span className="absolute bottom-3 right-3 text-[10px] text-[#747474]">s</span></span></label> : <label className="text-xs font-black text-[#2F2F2F]">Objetivo<span className="relative block"><input type="number" min="1" max="100" className={input} value={config.targetRepetitions} onChange={(event) => set('targetRepetitions', Number(event.target.value))} /><span className="absolute bottom-3 right-3 text-[10px] text-[#747474]">rep.</span></span></label>}
            <label className="text-xs font-black text-[#2F2F2F]">Descanso<span className="relative block"><input type="number" min="0" max="180" className={input} value={config.restSeconds} onChange={(event) => set('restSeconds', Number(event.target.value))} /><span className="absolute bottom-3 right-3 text-[10px] text-[#747474]">s</span></span></label>
            <label className="text-xs font-black text-[#2F2F2F]">Vueltas<input type="number" min="1" max={isImmersive ? 1 : 10} disabled={isImmersive} className={`${input} disabled:bg-[#F7F6F4]`} value={config.rounds} onChange={(event) => set('rounds', Number(event.target.value))} /></label>
          </div>
          <label className="mt-4 block text-xs font-black text-[#2F2F2F]">Avance<select disabled={config.displayMode === 'vr_box' || config.displayMode === 'quest_browser' || cognitive} className={`${input} disabled:bg-[#F7F6F4] disabled:text-[#747474]`} value={config.advanceMode} onChange={(event) => set('advanceMode', event.target.value as ExerciseConfig['advanceMode'])}><option value="manual">Confirmación manual</option><option value="automatic" disabled={config.doseMode === 'repetitions' || cognitive}>Automático al terminar el tiempo</option></select></label>
          {config.doseMode === 'repetitions' && <p className="mt-3 text-[11px] leading-5 text-[#747474]">La aplicación no contará movimientos: el paciente informará si completó el objetivo o cuántas repeticiones realizó.</p>}
          <div className="mt-5 flex items-center gap-4"><label className="inline-flex items-center gap-2 text-xs font-black text-[#2F2F2F]"><input type="checkbox" disabled={config.purpose === 'cognitive_visual' || config.displayMode === 'vr_box' || config.displayMode === 'quest_browser'} checked={config.metronomeEnabled} onChange={(event) => set('metronomeEnabled', event.target.checked)} className="size-4 accent-[#E49A02] disabled:opacity-35" /> Metrónomo</label>{config.metronomeEnabled && <label className="flex-1 text-xs font-black text-[#2F2F2F]">{config.metronomeHz.toFixed(1)} señales/s · {Math.round(config.metronomeHz * 60)} BPM<input type="range" min="0.2" max="3" step="0.1" value={config.metronomeHz} onChange={(event) => set('metronomeHz', Number(event.target.value))} className="mt-2 w-full accent-[#E49A02]" /></label>}</div>
          {config.displayMode === 'vr_box' && <p className="mt-3 text-[11px] leading-5 text-[#747474]">El metrónomo queda desactivado porque el navegador móvil puede bloquear el audio después de la preparación dentro del visor.</p>}
          {config.metronomeEnabled && <p className="mt-3 text-[11px] leading-5 text-[#747474]">Cada señal sonora indica el cambio acordado por el profesional. Señales/s y BPM describen el metrónomo; no miden velocidad cefálica ni equivalen automáticamente a ciclos completos.</p>}
        </section>
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="overflow-hidden rounded-2xl border border-[#E9E7E7] bg-white">
          <div className="flex items-center gap-2 p-4 text-sm font-black text-[#171717]"><Eye size={17} className="text-[#E49A02]" /> Vista previa</div>
          <div className="relative aspect-video bg-[#081113]">{isPhysical ? <div className="grid size-full place-items-center p-6 text-center text-white"><div><Accessibility className="mx-auto text-[#E49A02]" size={54}/><p className="mt-4 text-sm font-black">{config.patientInstruction || 'Instrucción física pendiente'}</p><p className="mt-3 text-xs text-white/55">{config.posture === 'seated' ? 'Sentado' : config.posture === 'standing' ? 'De pie' : 'Marcha'} · {config.surface === 'firm' ? 'Superficie firme' : 'Superficie inestable'}</p></div></div> : isImmersive && immersiveScenario ? <ImmersivePanorama scenario={immersiveScenario} className="absolute inset-0"/> : config.displayMode === 'vr_box' ? <StereoscopicExerciseCanvas config={config} viewerProfile={viewerProfile}/> : <ExerciseCanvas config={config} className="size-full" />}</div>
          <div className="p-5">
            <p className="text-sm font-black text-[#2F2F2F]">{config.name}</p>
            <p className="mt-2 text-xs text-[#747474]">{config.doseMode === 'time' ? `${config.durationSeconds} s` : `${config.targetRepetitions} repeticiones`} × {config.rounds} vueltas · avance {config.advanceMode === 'manual' ? 'manual' : 'automático'}</p>
            <button type="button" disabled={!compatibility.valid || activatingSensors} onClick={() => void startPreview()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E49A02] px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Play size={16} /> {activatingSensors ? 'Comprobando giroscopio… mové suavemente el celular' : compatibility.valid ? 'Probar ejercicio' : 'Corregí la compatibilidad para probar'}</button>
            {previewError && <p role="alert" className="mt-3 rounded-xl bg-[#fceced] p-3 text-[11px] font-bold leading-5 text-[#9A3842]">{previewError}</p>}
          </div>
        </div>
      </aside>
      {playing && compatibility.valid && <ExercisePlayer config={config} preparationSeconds={config.displayMode === 'vr_box' ? 20 : undefined} onExit={closePreview} onSkip={closePreview} onComplete={closePreview} />}
    </div>
  )
}
