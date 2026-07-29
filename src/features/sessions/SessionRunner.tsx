import { Clock3, Glasses, LogOut, Play, SkipForward } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ExercisePlayer } from '../exercise/ExercisePlayer'
import { activateCardboardTracking } from '../exercise/cardboardTracking'
import type { ExerciseCompletionReport, ExerciseConfig, ExerciseDisplayMode } from '../exercise/types'
import type { SessionAssignmentRecord, SessionEventLogEntry } from './repository'
import { VR_BOX_TRANSITION_SECONDS } from './sequence'

type ExerciseUnit = { type: 'exercise'; config: ExerciseConfig; label: string; exerciseIndex: number; round: number }
type RestUnit = { type: 'rest'; seconds: number; label: string; nextLabel: string; displayMode: ExerciseDisplayMode; advanceMode: ExerciseConfig['advanceMode']; viewerProfile: ViewerProfile | null }
type ViewerProfile = 'vr_box' | 'cardboard'
type VrBoxTransitionUnit = { type: 'vr_box_transition'; direction: 'put_on' | 'take_off'; seconds: number; nextLabel: string; viewerProfile: ViewerProfile; nextStopCriteria?: string }
type Unit = ExerciseUnit | RestUnit | VrBoxTransitionUnit

function buildUnits(exercises: ExerciseConfig[]): Unit[] {
  const phases: ExerciseUnit[] = []
  exercises.forEach((exercise, exerciseIndex) => {
    for (let round = 1; round <= exercise.rounds; round += 1) {
      phases.push({ type: 'exercise', config: exercise, label: `Ejercicio ${exerciseIndex + 1} · Vuelta ${round}/${exercise.rounds}`, exerciseIndex, round })
    }
  })

  const units: Unit[] = []
  let activeViewer: ViewerProfile | null = null
  phases.forEach((phase, index) => {
    const desiredViewer: ViewerProfile | null = phase.config.displayMode === 'vr_box' ? (phase.config.cardboardEnabled ? 'cardboard' : 'vr_box') : null
    if (activeViewer !== desiredViewer) {
      if (activeViewer) units.push({
        type: 'vr_box_transition', direction: 'take_off', seconds: VR_BOX_TRANSITION_SECONDS,
        nextLabel: desiredViewer ? `Cambio a ${desiredViewer === 'cardboard' ? 'Cardboard' : 'VR Box'}` : phase.config.name,
        viewerProfile: activeViewer,
      })
      if (desiredViewer) units.push({
        type: 'vr_box_transition', direction: 'put_on', seconds: VR_BOX_TRANSITION_SECONDS,
        nextLabel: phase.config.name, viewerProfile: desiredViewer, nextStopCriteria: phase.config.stopCriteria,
      })
      activeViewer = desiredViewer
    }

    units.push(phase)
    const next = phases[index + 1]
    if (next && phase.config.restSeconds > 0) {
      units.push({
        type: 'rest', seconds: phase.config.restSeconds, label: 'Descanso antes de continuar',
        nextLabel: next.config.name, displayMode: phase.config.displayMode,
        advanceMode: phase.config.displayMode === 'vr_box' ? 'automatic' : phase.config.advanceMode,
        viewerProfile: phase.config.displayMode === 'vr_box' ? (phase.config.cardboardEnabled ? 'cardboard' : 'vr_box') : null,
      })
    }
  })

  if (activeViewer) units.push({ type: 'vr_box_transition', direction: 'take_off', seconds: VR_BOX_TRANSITION_SECONDS, nextLabel: 'Registro final de la sesión', viewerProfile: activeViewer })
  return units
}

async function exitFullscreenThen(callback: () => void) {
  if (document.fullscreenElement) {
    try { await document.exitFullscreen() } catch { /* La salida continúa aunque el navegador conserve pantalla completa. */ }
  }
  callback()
}

function RestScreen({ seconds, label, nextLabel, displayMode, advanceMode, viewerProfile, onComplete, onExit }: RestUnit & { onComplete: () => void; onExit: () => void }) {
  const [remaining, setRemaining] = useState(seconds)
  const ready = remaining <= 0
  const vrBox = displayMode === 'vr_box'
  const cardboard = viewerProfile === 'cardboard'

  useEffect(() => {
    if (ready) { if (advanceMode === 'automatic') onComplete(); return }
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [advanceMode, onComplete, ready])

  useEffect(() => {
    if (vrBox) return
    const handler = (event: KeyboardEvent) => { if (ready && (event.key === 'Enter' || event.key === ' ')) onComplete() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onComplete, ready, vrBox])

  const content = (side: 'izquierdo' | 'derecho') => <div className="flex h-full flex-col items-center justify-center px-5 text-center" aria-hidden={side === 'derecho' && !cardboard ? true : undefined}>
    <Clock3 className="text-[#E49A02]" size={vrBox ? 28 : 38}/>
    <p className="mt-5 text-[10px] font-black uppercase tracking-[.18em] text-[#E49A02]">{ready ? 'Descanso finalizado' : label}</p>
    <p className={`${vrBox ? 'mt-3 text-5xl' : 'mt-5 text-7xl'} font-black tabular-nums`}>{Math.max(0, remaining)}</p>
    <p className="mt-4 text-xs text-white/60">Próxima fase: <strong className="text-white">{nextLabel}</strong></p>
    {!vrBox && (ready
      ? <button type="button" onClick={onComplete} className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-[#E49A02] px-5 text-xs font-black text-white"><Play size={16}/> Iniciar siguiente fase</button>
      : <button type="button" onClick={onComplete} className="mt-7 inline-flex items-center gap-2 rounded-full bg-white/12 px-5 py-3 text-xs font-black"><SkipForward size={16}/> Omitir descanso</button>)}
    {!vrBox && <button type="button" onClick={onExit} className="mt-4 text-xs font-bold text-white/55">Salir de la sesión</button>}
    {cardboard && <button type="button" onClick={() => void exitFullscreenThen(onExit)} aria-label={`Salir de la sesión · lado ${side}`} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#c74750] px-3 text-[9px] font-black text-white shadow-lg"><LogOut size={14}/> Salir</button>}
  </div>

  return <div className={`fixed inset-0 z-[100] bg-[#171717] text-white ${vrBox ? 'grid grid-cols-2 divide-x divide-white/10' : ''}`}>{content('izquierdo')}{vrBox && content('derecho')}</div>
}

function VrBoxTransitionScreen({ direction, seconds, nextLabel, viewerProfile, nextStopCriteria, onComplete, onExit }: VrBoxTransitionUnit & { onComplete: () => void; onExit: () => void }) {
  const [started, setStarted] = useState(direction === 'take_off')
  const [remaining, setRemaining] = useState(seconds)
  const containerRef = useRef<HTMLDivElement>(null)
  const completedRef = useRef(false)
  const viewerLabel = viewerProfile === 'cardboard' ? 'Cardboard' : 'VR Box'
  const [trackingPermissionError, setTrackingPermissionError] = useState('')
  const [activatingSensors, setActivatingSensors] = useState(false)

  useEffect(() => {
    if (!started || remaining <= 0) return
    const timer = window.setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [remaining, started])

  useEffect(() => {
    if (!started || remaining > 0 || completedRef.current) return
    completedRef.current = true
    const complete = async () => {
      if (direction === 'take_off' && document.fullscreenElement) {
        try { await document.exitFullscreen() } catch { /* La sesión continúa aunque el navegador conserve pantalla completa. */ }
      }
      onComplete()
    }
    void complete()
  }, [direction, onComplete, remaining, started])

  const startVrPreparation = async () => {
    setTrackingPermissionError('')
    setActivatingSensors(viewerProfile === 'cardboard')
    const activationRequest = viewerProfile === 'cardboard' ? activateCardboardTracking() : Promise.resolve({ permission: 'granted' as const })
    const fullscreenRequest = containerRef.current?.requestFullscreen?.()
    const activation = await activationRequest
    try {
      await fullscreenRequest
      const orientation = screen.orientation as ScreenOrientation & { lock?: (value: 'landscape') => Promise<void> }
      await orientation.lock?.('landscape')
    } catch { /* La cuenta continúa si fullscreen u orientación no están disponibles. */ }
    setActivatingSensors(false)
    if (activation.permission !== 'granted') {
      if (document.fullscreenElement) {
        try { await document.exitFullscreen() } catch { /* El mensaje de sensores sigue visible aunque fullscreen no responda. */ }
      }
      setTrackingPermissionError(
        activation.permission === 'denied'
          ? 'El acceso al movimiento está bloqueado. En Samsung/Chrome abrí Ajustes del sitio → Sensores de movimiento → Permitir y recargá ONUr.'
          : activation.permission === 'insecure'
            ? 'El seguimiento necesita abrir la plataforma desde su dirección HTTPS segura.'
            : activation.permission === 'no_signal'
              ? 'No llegó señal del giroscopio. Mové suavemente el celular al reintentar y comprobá el permiso Sensores de movimiento.'
              : 'Este navegador no ofrece los sensores de orientación necesarios para Cardboard. Probá Chrome actualizado.',
      )
      return
    }
    setStarted(true)
  }

  if (!started) return <div ref={containerRef} className="fixed inset-0 z-[120] grid place-items-center bg-[#171717] p-6 text-white">
    <div className="w-full max-w-lg rounded-3xl border border-white/12 bg-white/[0.06] p-7 text-center shadow-2xl">
      <Glasses className="mx-auto text-[#E49A02]" size={52}/>
      <p className="mt-5 text-xs font-black uppercase tracking-[.16em] text-[#E49A02]">Preparación de {viewerLabel}</p>
      <h2 className="mt-3 text-2xl font-black">El próximo ejercicio usa el visor</h2>
      <p className="mt-3 text-sm leading-6 text-white/65">Dejá el {viewerLabel} abierto y el celular listo. Al continuar tendrás {seconds} segundos para colocarlo en el visor. {viewerProfile === 'cardboard' ? 'Después se calibrará la posición frontal y el ejercicio comenzará cuando la cabeza esté estable.' : 'Después, el ejercicio comenzará solo.'}</p>
      {viewerProfile === 'cardboard' && <p className="mt-3 text-xs leading-5 text-white/55">Cardboard usa giroscopio y acelerómetro para seguimiento 3DoF. Al finalizar la cuenta, mirá el + de frente y mantené la cabeza quieta. El perfil óptico activo ajustará centros, campo visual y corrección radial; no mide desplazamiento físico 6DoF ni reemplaza el código QR específico del visor.</p>}
      <p className="mt-4 rounded-2xl bg-black/25 p-4 text-xs font-bold text-white/75">Próxima fase: {nextLabel}</p>
      {nextStopCriteria && <p className="mt-3 rounded-2xl bg-[#c74750]/18 p-4 text-xs font-bold leading-5 text-[#ffb8bd]"><strong>Detener o pausar:</strong> {nextStopCriteria}</p>}
      {trackingPermissionError && <p role="alert" className="mt-4 rounded-2xl bg-[#c74750]/18 p-4 text-xs font-bold leading-5 text-[#ff9da4]">{trackingPermissionError}</p>}
      <button type="button" disabled={activatingSensors} onClick={() => void startVrPreparation()} className="mt-6 h-14 w-full rounded-2xl bg-[#E49A02] px-4 text-sm font-black text-white disabled:opacity-50">{activatingSensors ? 'Comprobando giroscopio… mové suavemente el celular' : viewerProfile === 'cardboard' ? 'Activar sensores y preparar Cardboard' : `Comenzar preparación de ${seconds} segundos`}</button>
      <button type="button" onClick={onExit} className="mt-4 text-xs font-bold text-white/55">Salir de la sesión</button>
    </div>
  </div>

  const instruction = direction === 'put_on' ? 'Ajustá el visor hasta ver un único + nítido. Si ves doble o borroso, retiralo y no comiences.' : 'Retirá el visor y sacá el celular para continuar.'
  const content = (side: 'izquierdo' | 'derecho') => <div className="flex h-full flex-col items-center justify-center px-5 text-center" aria-hidden={side === 'derecho' && viewerProfile !== 'cardboard' ? true : undefined}>
    <Glasses className="text-[#E49A02]" size={30}/>
    <p className="mt-4 text-[9px] font-black uppercase tracking-[.16em] text-[#E49A02]">{direction === 'put_on' ? `Colocar ${viewerLabel}` : `Retirar ${viewerLabel}`}</p>
    <p className="mt-3 text-5xl font-black tabular-nums">{remaining}</p>
    {direction === 'put_on' && <div className="mt-3 grid size-8 place-items-center rounded-full border-2 border-white text-lg font-black text-white">+</div>}
    <p className="mt-4 max-w-xs text-[10px] font-bold leading-4 text-white/70">{instruction}</p>
    {viewerProfile === 'cardboard' && <button type="button" onClick={() => void exitFullscreenThen(onExit)} aria-label={`Salir de la sesión · lado ${side}`} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#c74750] px-3 text-[9px] font-black text-white shadow-lg"><LogOut size={14}/> Salir</button>}
  </div>

  return <div ref={containerRef} className="fixed inset-0 z-[120] grid grid-cols-2 divide-x divide-white/10 bg-[#171717] text-white" aria-live="polite">{content('izquierdo')}{content('derecho')}</div>
}

export function SessionRunner({ session, onFinish, onExit }: { session: SessionAssignmentRecord; onFinish: (activeSeconds: number, skippedExercises: number, eventLog: SessionEventLogEntry[]) => void; onExit: (activeSeconds: number, skippedExercises: number, eventLog: SessionEventLogEntry[]) => void }) {
  const units = useMemo(() => buildUnits(session.exercises), [session.exercises])
  const [index, setIndex] = useState(0)
  const skippedRef = useRef(0)
  const activeSecondsRef = useRef(0)
  const eventLogRef = useRef<SessionEventLogEntry[]>([])
  const finishingRef = useRef(false)
  const unit = units[index]

  const requestExit = (currentActiveSeconds = 0, report?: ExerciseCompletionReport) => {
    const confirmed = window.confirm('¿Salir de la sesión? El avance realizado se guardará como una sesión parcial y el profesional podrá revisarlo.')
    if (!confirmed) return false
    const roundedSeconds = Math.max(0, Math.round(currentActiveSeconds))
    if (unit?.type === 'exercise') {
      skippedRef.current += 1
      eventLogRef.current.push({
        type: 'exercise_partial',
        at: new Date().toISOString(),
        exercise_index: unit.exerciseIndex,
        round: unit.round,
        exercise_name: unit.config.name,
        exercise_kind: unit.config.kind,
        dose_mode: report?.doseMode ?? unit.config.doseMode,
        display_mode: unit.config.displayMode,
        active_seconds: roundedSeconds,
        target_repetitions: report?.targetRepetitions,
        reported_repetitions: report?.reportedRepetitions,
        completion: 'partial',
      })
    }
    activeSecondsRef.current += roundedSeconds
    eventLogRef.current.push({
      type: 'interrupted',
      at: new Date().toISOString(),
      active_seconds: activeSecondsRef.current,
      skipped_exercises: Math.max(1, skippedRef.current),
    })
    onExit(activeSecondsRef.current, Math.max(1, skippedRef.current), eventLogRef.current)
    return true
  }

  useEffect(() => {
    document.body.dataset.onurSessionRunning = 'true'
    return () => { delete document.body.dataset.onurSessionRunning }
  }, [])

  const finishSession = () => {
    if (finishingRef.current) return
    finishingRef.current = true
    onFinish(activeSecondsRef.current, skippedRef.current, eventLogRef.current)
  }

  const advance = (activeSeconds = 0, report?: ExerciseCompletionReport) => {
    activeSecondsRef.current += Math.max(0, activeSeconds)
    if (unit?.type === 'exercise') {
      const completion = report?.completion ?? 'target_completed'
      if (completion === 'skipped' || completion === 'partial') skippedRef.current += 1
      eventLogRef.current.push({
        type: completion === 'partial' ? 'exercise_partial' : completion === 'skipped' ? 'exercise_skipped' : 'exercise_completed',
        at: new Date().toISOString(), exercise_index: unit.exerciseIndex, round: unit.round,
        exercise_name: unit.config.name, exercise_kind: unit.config.kind,
        dose_mode: report?.doseMode ?? unit.config.doseMode, display_mode: unit.config.displayMode,
        viewer_profile: unit.config.purpose === 'immersive_context' && unit.config.displayMode === 'quest_browser' ? 'quest_webxr' : unit.config.displayMode === 'vr_box' ? (unit.config.cardboardEnabled ? 'cardboard' : 'vr_box') : undefined,
        head_tracking_mode: unit.config.cardboardEnabled ? 'orientation_3dof' : undefined,
        spatial_anchor: unit.config.cardboardEnabled ? 'calibrated_direction' : undefined,
        tracking_recenter_count: report?.headTracking?.recenterCount,
        tracking_loss_count: report?.headTracking?.trackingLossCount,
        tracking_final_status: report?.headTracking?.finalStatus,
        cardboard_optical_profile: report?.headTracking?.opticalProfile.name,
        cardboard_image_separation_percent: report?.headTracking?.opticalProfile.imageSeparationPercent,
        cardboard_vertical_offset_percent: report?.headTracking?.opticalProfile.verticalOffsetPercent,
        cardboard_horizontal_fov_degrees: report?.headTracking?.opticalProfile.horizontalFovDegrees,
        cardboard_vertical_fov_degrees: report?.headTracking?.opticalProfile.verticalFovDegrees,
        cardboard_lens_distortion_percent: report?.headTracking?.opticalProfile.lensDistortionPercent,
        active_seconds: Math.max(0, Math.round(activeSeconds)), target_repetitions: report?.targetRepetitions,
        reported_repetitions: report?.reportedRepetitions, completion,
        cognitive_mode: report?.cognitive?.mode,
        cognitive_response_mode: report?.cognitive?.responseMode,
        cognitive_target_events: report?.cognitive?.targetEvents,
        cognitive_response_count: report?.cognitive?.responseCount,
        cognitive_correct_responses: report?.cognitive?.correctResponses,
        cognitive_false_alarms: report?.cognitive?.falseAlarms,
        cognitive_reported_count: report?.cognitive?.reportedCount,
        immersive_scenario_id: report?.immersive?.scenarioId ?? unit.config.immersiveScenarioId,
        immersive_rendering: report?.immersive?.rendering,
        immersive_audio_enabled: report?.immersive?.ambientAudioEnabled,
        immersive_audio_volume: report?.immersive?.ambientAudioVolume,
        immersive_target_enabled: report?.immersive?.spatialTargetEnabled,
        immersive_target_azimuth_degrees: report?.immersive?.spatialTargetAzimuthDegrees,
        immersive_target_elevation_degrees: report?.immersive?.spatialTargetElevationDegrees,
      })
    } else if (unit?.type === 'vr_box_transition') {
      eventLogRef.current.push({ type: unit.direction === 'put_on' ? 'vr_box_put_on' : 'vr_box_take_off', at: new Date().toISOString(), active_seconds: unit.seconds, viewer_profile: unit.viewerProfile })
    }
    if (index >= units.length - 1) finishSession()
    else setIndex((value) => value + 1)
  }

  useEffect(() => {
    if (units.length > 0 || finishingRef.current) return
    finishingRef.current = true
    onFinish(0, 0, [])
  }, [onFinish, units.length])

  if (!unit) return null
  if (unit.type === 'rest') return <RestScreen {...unit} onComplete={() => advance()} onExit={() => { requestExit() }}/>
  if (unit.type === 'vr_box_transition') return <VrBoxTransitionScreen {...unit} onComplete={() => advance()} onExit={() => { requestExit() }}/>

  const progress = units.slice(0, index + 1).filter((item) => item.type === 'exercise').length
  const total = session.exercises.reduce((count, exercise) => count + exercise.rounds, 0)
  const preparationSeconds = unit.config.displayMode === 'vr_box'
    ? 0
    : Math.max(
      unit.config.stopCriteria ? 5 : 0,
      unit.config.purpose === 'immersive_context' && unit.config.displayMode === 'quest_browser' && progress > 1 ? 5 : 0,
      unit.config.preparationSeconds,
    )
  return <>
    {unit.config.displayMode !== 'vr_box' && !(unit.config.displayMode === 'quest_browser' && unit.config.purpose === 'immersive_context') && <div className="fixed left-4 top-20 z-[110] rounded-full bg-black/55 px-3 py-2 text-[10px] font-black text-white backdrop-blur">{unit.label} · {progress}/{total}</div>}
    <ExercisePlayer key={index} config={{ ...unit.config, rounds: 1 }} preparationSeconds={preparationSeconds} onComplete={(seconds, report) => advance(seconds, report)} onSkip={(seconds, report) => advance(seconds, report ?? { doseMode: unit.config.doseMode, completion: 'skipped' })} onExit={requestExit}/>
  </>
}
