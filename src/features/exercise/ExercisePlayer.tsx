import { Accessibility, Check, Clock3, Expand, LogOut, Pause, Play, RotateCcw, ShieldAlert, SkipForward, Target } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cognitiveInstruction, cognitiveResponseModeFor, cognitiveStepAt, cognitiveSymbolPhrase, cognitiveTaskLabel, isCognitiveTargetStep } from './cognitive'
import { ExerciseCanvas } from './ExerciseCanvas'
import { analyzeExerciseCompatibility } from './compatibility'
import { StereoscopicExerciseCanvas } from './StereoscopicExerciseCanvas'
import { cardboardEyeCenterPercent, normalizeCardboardViewerProfile, useCardboardViewerProfiles, type CardboardViewerProfile } from './cardboardViewerProfiles'
import type { ExerciseCompletionReport, ExerciseConfig } from './types'
import { useCardboardHeadTracking, type CardboardTrackingFailureReason, type CardboardTrackingStatus } from './useCardboardHeadTracking'
import { getImmersiveScenario } from '../immersive/catalog'
import { ImmersivePanorama } from '../immersive/ImmersivePanorama'

interface ExercisePlayerProps {
  config: ExerciseConfig
  onExit: () => void
  onSkip?: (activeSeconds: number, report?: ExerciseCompletionReport) => void
  onComplete?: (activeSeconds: number, report?: ExerciseCompletionReport) => void
  preparationSeconds?: number
}

function PreparationOverlay({ remaining, vrBox, config }: { remaining: number; vrBox: boolean; config: ExerciseConfig }) {
  const content = (duplicate = false) => <div className="flex h-full flex-col items-center justify-center px-4 text-center" aria-hidden={duplicate || undefined}><Clock3 className="text-[#E49A02]" size={vrBox ? 26 : 38}/><p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-[#E49A02]">Preparación</p><p className={`${vrBox ? 'mt-2 text-6xl' : 'mt-4 text-8xl'} font-black tabular-nums`}>{remaining}</p>{vrBox && <div className="mt-3 grid size-8 place-items-center rounded-full border-2 border-white text-lg font-black text-white">+</div>}<p className={`mt-3 max-w-xs leading-5 text-white/65 ${vrBox ? 'text-[10px]' : 'text-sm'}`}>{vrBox ? 'Ajustá el visor hasta ver un único + nítido. Si ves doble o borroso, retiralo.' : config.patientInstruction}</p>{!vrBox && config.stopCriteria && <p className="mt-3 max-w-lg rounded-xl bg-[#c74750]/20 px-4 py-3 text-xs font-bold leading-5 text-[#ffb8bd]"><strong>Detener o pausar:</strong> {config.stopCriteria}</p>}</div>
  return <div className={`absolute inset-0 z-20 bg-[#171717] ${vrBox ? 'grid grid-cols-2 divide-x divide-white/12' : ''}`} aria-live="polite" aria-label={`Preparación: ${remaining} segundos`}>{content()}{vrBox && content(true)}</div>
}

function PhysicalStage({ config }: { config: ExerciseConfig }) {
  const vrBox = config.displayMode === 'vr_box'
  const content = (duplicate = false) => <div className="flex size-full flex-col items-center justify-center px-6 text-center text-white" aria-hidden={duplicate || undefined}><Accessibility className="text-[#E49A02]" size={vrBox ? 42 : 68}/><p className={`${vrBox ? 'mt-3 text-xs' : 'mt-6 text-2xl'} max-w-2xl font-black leading-tight`}>{config.patientInstruction}</p><div className={`mt-5 flex flex-wrap justify-center gap-2 ${vrBox ? 'text-[8px]' : 'text-[11px]'}`}><span className="rounded-full bg-white/10 px-3 py-1.5">{config.posture === 'seated' ? 'Sentado' : config.posture === 'standing' ? 'De pie' : 'Marcha'}</span><span className="rounded-full bg-white/10 px-3 py-1.5">{config.surface === 'firm' ? 'Superficie firme' : 'Superficie inestable'}</span><span className="rounded-full bg-white/10 px-3 py-1.5">{config.supervision === 'direct_clinician' ? 'Profesional directo' : config.supervision === 'trained_helper' ? 'Ayudante entrenado' : 'Independiente aprobado'}</span></div><p className={`${vrBox ? 'mt-5 text-lg' : 'mt-8 text-4xl'} font-black text-[#E49A02]`}>{config.doseMode === 'repetitions' ? `${config.targetRepetitions} repeticiones` : `${config.durationSeconds} segundos`}</p></div>
  return <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,#17343a_0%,#081113_64%)] ${vrBox ? 'grid grid-cols-2 divide-x divide-white/10' : ''}`}>{content()}{vrBox && content(true)}</div>
}

function CognitiveBriefing({ config, onStart }: { config: ExerciseConfig; onStart: () => void }) {
  return <div className="absolute inset-0 z-50 grid place-items-center overflow-y-auto bg-[#0b1214]/94 p-5">
    <div className="w-full max-w-xl rounded-3xl border border-white/12 bg-[#171717] p-6 text-white shadow-2xl sm:p-8">
      <Target className="text-[#E49A02]" size={42}/>
      <p className="mt-5 text-xs font-black uppercase tracking-[.16em] text-[#E49A02]">Consigna antes de comenzar</p>
      <h2 className="mt-3 text-2xl font-black">{cognitiveTaskLabel(config)}</h2>
      <div className="mt-5 space-y-4">
        <div className="rounded-2xl bg-white/[0.07] p-4"><p className="text-[10px] font-black uppercase tracking-[.12em] text-white/45">Tarea principal</p><p className="mt-2 text-sm font-bold leading-6">{config.patientInstruction}</p></div>
        <div className="rounded-2xl border border-[#E49A02]/35 bg-[#E49A02]/10 p-4"><p className="text-[10px] font-black uppercase tracking-[.12em] text-[#EFB33A]">Tarea cognitiva</p><p className="mt-2 text-base font-black leading-6">{cognitiveInstruction(config)}</p></div>
        <p className="text-xs leading-5 text-white/60">Realizalo sentado, con la pantalla inmóvil. No necesitás tarjetas, lápiz ni otro material. Si no comprendés la consigna, no comiences y consultá al profesional.</p>
      </div>
      <button type="button" onClick={onStart} className="mt-6 h-14 w-full rounded-2xl bg-[#E49A02] text-sm font-black text-white">Entendí la consigna · comenzar</button>
    </div>
  </div>
}

function CompletionPanel({ config, onTarget, onPartial, onSkip }: { config: ExerciseConfig; onTarget: (reportedCount?: number) => void; onPartial: (repetitions: number) => void; onSkip: () => void }) {
  const [partial, setPartial] = useState(false)
  const [reported, setReported] = useState(Math.max(1, config.targetRepetitions - 1))
  const [cognitiveCount, setCognitiveCount] = useState(0)
  const repetitions = config.doseMode === 'repetitions'
  const rareTarget = config.cognitiveTaskMode === 'rare_target'
  return <div className="w-full max-w-md rounded-3xl border border-white/12 bg-black/72 p-5 text-center shadow-2xl backdrop-blur-md sm:p-7"><Check className="mx-auto text-[#E49A02]" size={36}/><p className="mt-4 text-xs font-black uppercase tracking-[.16em] text-[#E49A02]">Confirmación manual</p><h2 className="mt-3 text-xl font-black sm:text-2xl">{rareTarget ? `¿Cuántas veces viste ${cognitiveSymbolPhrase(config.cognitiveTargetSymbol)}?` : repetitions ? `¿Terminaste las ${config.targetRepetitions} repeticiones?` : 'El tiempo terminó'}</h2><p className="mt-2 text-xs leading-5 text-white/60">La siguiente fase no comenzará hasta que la confirmes.</p>{rareTarget ? <div className="mt-5"><label className="text-xs font-black text-white/75">Total que contaste<input autoFocus type="number" min="0" max="999" value={cognitiveCount} onChange={(event) => setCognitiveCount(Math.min(999, Math.max(0, Number(event.target.value))))} className="mt-2 h-14 w-full rounded-xl border border-white/16 bg-white/10 px-4 text-center text-2xl font-black text-white"/></label><button type="button" onClick={() => onTarget(cognitiveCount)} className="mt-4 h-12 w-full rounded-xl bg-[#E49A02] text-sm font-black text-white">Guardar respuesta y continuar</button><button type="button" onClick={onSkip} className="mt-4 block w-full text-xs font-bold text-white/55">No pude completar</button></div> : partial && repetitions ? <div className="mt-5"><label className="text-xs font-black text-white/75">Repeticiones realizadas aproximadamente<input type="number" min="1" max={Math.max(1, config.targetRepetitions - 1)} value={reported} onChange={(event) => setReported(Math.min(Math.max(1, Number(event.target.value)), Math.max(1, config.targetRepetitions - 1)))} className="mt-2 h-12 w-full rounded-xl border border-white/16 bg-white/10 px-4 text-center text-lg font-black text-white"/></label><button type="button" onClick={() => onPartial(reported)} className="mt-4 h-12 w-full rounded-xl bg-[#E49A02] text-sm font-black text-white">Confirmar y continuar</button><button type="button" onClick={() => setPartial(false)} className="mt-3 text-xs font-bold text-white/55">Volver</button></div> : <div className="mt-6 space-y-3"><button type="button" onClick={() => onTarget()} className="h-13 w-full rounded-xl bg-[#E49A02] px-4 text-sm font-black text-white">{repetitions ? `Completé las ${config.targetRepetitions}` : 'Continuar'}</button>{repetitions && <button type="button" onClick={() => setPartial(true)} className="h-12 w-full rounded-xl bg-white/12 px-4 text-xs font-black">Hice menos</button>}<button type="button" onClick={onSkip} className="text-xs font-bold text-white/55">No pude completar</button></div>}</div>
}

function CompletionOverlay({ config, onTarget, onPartial, onSkip }: { config: ExerciseConfig; onTarget: (reportedCount?: number) => void; onPartial: (repetitions: number) => void; onSkip: () => void }) {
  const vrBox = config.displayMode === 'vr_box'
  if (!vrBox) return <div className="absolute inset-0 z-50 grid place-items-center bg-black/48 p-5"><CompletionPanel config={config} onTarget={onTarget} onPartial={onPartial} onSkip={onSkip}/></div>
  return <div className="absolute inset-0 z-50 grid grid-cols-2 divide-x divide-white/10 bg-[#171717]"><div className="grid place-items-center p-3"><CompletionPanel config={config} onTarget={onTarget} onPartial={onPartial} onSkip={onSkip}/></div><div className="grid place-items-center p-3" aria-hidden="true"><CompletionPanel config={config} onTarget={onTarget} onPartial={onPartial} onSkip={onSkip}/></div></div>
}

function CardboardControlBar({ paused, formattedTime, trackingStatus, onTogglePause, onRecenter, onSkip, onExit }: { paused: boolean; formattedTime: string; trackingStatus: CardboardTrackingStatus; onTogglePause: () => void; onRecenter: () => void; onSkip?: () => void; onExit: () => void }) {
  const controls = (side: 'izquierdo' | 'derecho') => <div className="flex min-w-0 items-center justify-center p-1.5 sm:p-2">
    <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-2xl border border-white/15 bg-black/78 p-1.5 shadow-2xl backdrop-blur-md">
      <span className="hidden rounded-xl bg-white/10 px-2 py-2 text-[8px] font-black uppercase tracking-[.1em] text-white/75 min-[580px]:inline"><span className={`block ${trackingStatus === 'tracking' ? 'text-[#71d897]' : 'text-[#EFB33A]'}`}>{trackingStatus === 'tracking' ? '3DoF activo' : 'Sin anclaje'}</span><span className="mt-0.5 block tabular-nums text-white">{formattedTime}</span></span>
      <button type="button" onClick={onTogglePause} aria-label={`${paused ? 'Continuar' : 'Pausar'} · lado ${side}`} className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#171717] shadow-lg">
        {paused ? <Play size={16}/> : <Pause size={16}/>}
      </button>
      <button type="button" onClick={onRecenter} aria-label={`Recentrar anclaje · lado ${side}`} className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/14 text-white shadow-lg" title="Mirar al frente y recentrar"><RotateCcw size={15}/></button>
      {onSkip && <button type="button" onClick={onSkip} aria-label={`Omitir ejercicio · lado ${side}`} className="inline-flex h-10 min-w-0 items-center gap-1 rounded-xl bg-[#E49A02] px-2 text-[9px] font-black text-white shadow-lg sm:px-3"><SkipForward className="shrink-0" size={14}/><span className="truncate">Omitir</span></button>}
      <button type="button" onClick={onExit} aria-label={`Salir de la sesión · lado ${side}`} className="inline-flex h-10 min-w-0 items-center gap-1 rounded-xl bg-[#c74750] px-2 text-[9px] font-black text-white shadow-lg sm:px-3"><LogOut className="shrink-0" size={14}/><span className="truncate">Salir</span></button>
    </div>
  </div>

  return <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 grid grid-cols-2 divide-x divide-white/10 bg-gradient-to-t from-black/55 to-transparent pb-[max(0.25rem,env(safe-area-inset-bottom))]" aria-label="Controles Cardboard">
    {controls('izquierdo')}
    {controls('derecho')}
  </div>
}

function CardboardTrackingOverlay({ status, failureReason, calibrationProgress, viewerProfile, onRetry, onExit }: { status: CardboardTrackingStatus; failureReason: CardboardTrackingFailureReason; calibrationProgress: number; viewerProfile: CardboardViewerProfile; onRetry: () => void; onExit: () => void }) {
  if (status === 'tracking' || status === 'idle') return null
  const failed = status === 'denied' || status === 'unavailable' || status === 'lost'
  const title = status === 'calibrating' ? 'Calibrando posición frontal' : status === 'waiting' ? 'Esperando recalibración' : status === 'denied' ? 'Permiso de movimiento rechazado' : status === 'lost' ? 'Se perdió el seguimiento' : 'Sensores no disponibles'
  const instruction = status === 'calibrating'
    ? 'Mirá el + de frente. La referencia se toma automáticamente y no necesitás quedar completamente inmóvil.'
    : status === 'waiting'
      ? 'Mantené la vista al frente. La plataforma volverá a calibrar antes de continuar.'
    : status === 'denied'
      ? 'Retirá el visor, permití el acceso al movimiento y volvé a calibrar.'
      : status === 'lost'
        ? 'Retirá el visor, mirá al frente y tocá Recalibrar antes de continuar.'
        : failureReason === 'insecure_context'
          ? 'Abrí ONUr desde su dirección HTTPS. Los sensores no funcionan desde una dirección insegura.'
          : failureReason === 'orientation_api_missing'
            ? 'Este navegador no ofrece orientación 3DoF. Probá Chrome actualizado en el celular.'
            : 'No llegó señal del giroscopio. En Samsung/Chrome: Ajustes del sitio → Sensores de movimiento → Permitir; recargá ONUr y mové suavemente el celular al reintentar.'
  const content = (side: 'izquierdo' | 'derecho') => {
    const center = cardboardEyeCenterPercent(viewerProfile, side === 'izquierdo' ? 'left' : 'right')
    return <div className={`relative flex h-full flex-col items-center px-4 pb-16 text-center ${failed ? 'justify-center' : 'justify-end'}`}>
    {failed && <ShieldAlert className="text-[#ef6b74]" size={28}/>}
    <p className={`mt-3 text-[9px] font-black uppercase tracking-[.14em] ${failed ? 'text-[#ef6b74]' : 'text-[#E49A02]'}`}>{title}</p>
    {!failed && <div className="absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-lg font-black" style={{ left: `${center.left}%`, top: `${center.top}%` }}>+</div>}
    <p className="mt-3 max-w-xs text-[9px] font-bold leading-4 text-white/75">{instruction}</p>
    {status === 'calibrating' && <div className="mt-3 h-1.5 w-24 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#E49A02] transition-[width] duration-100" style={{ width: `${Math.round(calibrationProgress * 100)}%` }}/></div>}
    {failed && <div className="mt-4 flex flex-wrap justify-center gap-2"><button type="button" onClick={onRetry} aria-label={`${status === 'lost' ? 'Recalibrar' : 'Reintentar sensores'} · lado ${side}`} className="h-10 rounded-xl bg-[#E49A02] px-3 text-[9px] font-black text-white">{status === 'lost' ? 'Recalibrar' : 'Reintentar'}</button><button type="button" onClick={onExit} aria-label={`Salir por fallo de seguimiento · lado ${side}`} className="h-10 rounded-xl bg-[#c74750] px-3 text-[9px] font-black text-white">Salir</button></div>}
  </div>}
  return <div className="absolute inset-0 z-30 grid grid-cols-2 divide-x divide-white/10 bg-[#171717]/96" role="status" aria-live="assertive" data-cardboard-tracking-status={status}>{content('izquierdo')}{content('derecho')}</div>
}

function CompatibleExercisePlayer({ config, onExit, onSkip, onComplete, preparationSeconds }: ExercisePlayerProps) {
  const vrBox = config.displayMode === 'vr_box'
  const cardboard = vrBox && config.cardboardEnabled
  const immersiveScenario = config.purpose === 'immersive_context' ? getImmersiveScenario(config.immersiveScenarioId) : undefined
  const questImmersive = Boolean(immersiveScenario && config.displayMode === 'quest_browser')
  const [paused, setPaused] = useState(false)
  const [questImmersionActive, setQuestImmersionActive] = useState(!questImmersive)
  const [controlsVisible, setControlsVisible] = useState(!vrBox)
  const [preparationRemaining, setPreparationRemaining] = useState(preparationSeconds ?? config.preparationSeconds ?? 0)
  const preparing = preparationRemaining > 0
  const tracking = useCardboardHeadTracking(cardboard, !preparing)
  const { activeProfile: localViewerProfile } = useCardboardViewerProfiles()
  const viewerProfile = useMemo(() => config.cardboardViewerProfile
    ? normalizeCardboardViewerProfile(config.cardboardViewerProfile, config.cardboardViewerProfile.id)
    : localViewerProfile, [config.cardboardViewerProfile, localViewerProfile])
  const [remainingSeconds, setRemainingSeconds] = useState(config.durationSeconds)
  const [activeSeconds, setActiveSeconds] = useState(0)
  const [completionOpen, setCompletionOpen] = useState(false)
  const [briefingOpen, setBriefingOpen] = useState(config.cognitiveTaskMode !== 'none')
  const [activityVersion, setActivityVersion] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const completedRef = useRef(false)
  const cognitiveTargetStepsRef = useRef(new Set<number>())
  const cognitiveResponseStepsRef = useRef(new Set<number>())
  const cognitiveCorrectRef = useRef(0)
  const cognitiveFalseAlarmsRef = useRef(0)
  const timedFinished = config.doseMode === 'time' && remainingSeconds <= 0
  const inactive = paused || preparing || briefingOpen || completionOpen || timedFinished || (cardboard && tracking.status !== 'tracking') || (questImmersive && !questImmersionActive)

  useEffect(() => { containerRef.current?.focus() }, [])
  useEffect(() => { if (paused || briefingOpen || !preparing) return; const timeout = window.setTimeout(() => setPreparationRemaining((remaining) => Math.max(0, remaining - 1)), 1000); return () => window.clearTimeout(timeout) }, [briefingOpen, paused, preparing, preparationRemaining])
  useEffect(() => { if (inactive) return; const interval = window.setInterval(() => { setActiveSeconds((seconds) => seconds + 0.25); if (config.doseMode === 'time') setRemainingSeconds((remaining) => Math.max(0, remaining - 0.25)) }, 250); return () => window.clearInterval(interval) }, [config.doseMode, inactive])
  useEffect(() => {
    if (inactive || config.cognitiveTaskMode === 'none') return
    const step = cognitiveStepAt(activeSeconds, config.cognitiveStimulusSeconds)
    if (isCognitiveTargetStep(config, step)) cognitiveTargetStepsRef.current.add(step)
  }, [activeSeconds, config, inactive])

  const cognitiveReport = (reportedCount?: number) => config.cognitiveTaskMode === 'none' ? undefined : {
    mode: config.cognitiveTaskMode,
    responseMode: cognitiveResponseModeFor(config),
    targetEvents: cognitiveTargetStepsRef.current.size,
    responseCount: config.cognitiveResponseMode === 'screen_tap' ? cognitiveResponseStepsRef.current.size : undefined,
    correctResponses: config.cognitiveResponseMode === 'screen_tap' ? cognitiveCorrectRef.current : undefined,
    falseAlarms: config.cognitiveResponseMode === 'screen_tap' ? cognitiveFalseAlarmsRef.current : undefined,
    reportedCount,
  }

  const registerCognitiveResponse = () => {
    if (inactive || config.cognitiveTaskMode === 'none' || config.cognitiveResponseMode !== 'screen_tap') return
    const step = cognitiveStepAt(activeSeconds, config.cognitiveStimulusSeconds)
    if (cognitiveResponseStepsRef.current.has(step)) return
    cognitiveResponseStepsRef.current.add(step)
    if (isCognitiveTargetStep(config, step)) {
      cognitiveTargetStepsRef.current.add(step)
      cognitiveCorrectRef.current += 1
    } else cognitiveFalseAlarmsRef.current += 1
  }

  const finish = (report: ExerciseCompletionReport) => {
    if (completedRef.current) return
    completedRef.current = true
    const seconds = Math.max(0, Math.round(activeSeconds))
    const immersiveReport: ExerciseCompletionReport = immersiveScenario ? {
      ...report,
      immersive: { scenarioId: immersiveScenario.id, rendering: config.displayMode === 'quest_browser' ? 'webxr_6dof' : 'cardboard_3dof' },
    } : report
    const finalReport: ExerciseCompletionReport = cardboard ? {
      ...immersiveReport,
      headTracking: {
        mode: 'orientation_3dof', spatialAnchor: 'calibrated_direction',
        recenterCount: tracking.recenterCount, trackingLossCount: tracking.trackingLossCount,
        finalStatus: tracking.status === 'tracking' ? 'tracking' : tracking.status === 'lost' ? 'lost' : 'unavailable',
        opticalProfile: {
          name: viewerProfile.name,
          imageSeparationPercent: viewerProfile.imageSeparationPercent,
          verticalOffsetPercent: viewerProfile.verticalOffsetPercent,
          horizontalFovDegrees: viewerProfile.horizontalFovDegrees,
          verticalFovDegrees: viewerProfile.verticalFovDegrees,
          lensDistortionPercent: viewerProfile.lensDistortionPercent,
        },
      },
    } : immersiveReport
    if (finalReport.completion === 'skipped') onSkip?.(seconds, finalReport)
    else if (onComplete) onComplete(seconds, finalReport)
    else onExit()
  }

  const exitPlayer = async () => {
    setPaused(true)
    if (document.fullscreenElement) {
      try { await document.exitFullscreen() } catch { /* La salida de la sesión continúa aunque el navegador conserve pantalla completa. */ }
    }
    onExit()
  }

  useEffect(() => {
    if (!timedFinished || completedRef.current) return
    if (config.displayMode === 'vr_box' || config.advanceMode === 'automatic') finish({ doseMode: 'time', completion: 'target_completed', cognitive: cognitiveReport() })
    else setCompletionOpen(true)
    // finish depende del tiempo activo actual; el efecto solo se dispara al alcanzar cero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedFinished, config.advanceMode, config.displayMode])

  useEffect(() => {
    if (!config.metronomeEnabled || inactive) return
    let context: AudioContext | null = null
    const tick = () => { try { context ??= new AudioContext(); void context.resume(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = 880; gain.gain.setValueAtTime(0.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.005); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.065); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.07) } catch { /* El ejercicio continúa si el navegador bloquea audio automático. */ } }
    tick(); const interval = window.setInterval(tick, 1000 / Math.max(0.2, config.metronomeHz)); return () => { window.clearInterval(interval); if (context) void context.close() }
  }, [config.metronomeEnabled, config.metronomeHz, inactive])

  useEffect(() => { if (paused || completionOpen) { setControlsVisible(true); return }; const timeout = window.setTimeout(() => setControlsVisible(false), 3000); return () => window.clearTimeout(timeout) }, [paused, completionOpen, activityVersion])
  const showControls = () => { setControlsVisible(true); setActivityVersion((version) => version + 1) }
  const requestFullscreen = async () => { try { await containerRef.current?.requestFullscreen(); if (config.displayMode === 'vr_box') { const orientation = screen.orientation as ScreenOrientation & { lock?: (value: 'landscape') => Promise<void> }; await orientation.lock?.('landscape') } } catch { /* Continúa sin fullscreen. */ } }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    showControls()
    if (config.displayMode === 'vr_box') return
    if ((event.key !== 'Enter' && event.key !== ' ') || preparing || paused) return
    event.preventDefault()
    if (briefingOpen) { setBriefingOpen(false); return }
    if (completionOpen) {
      if (config.cognitiveTaskMode === 'rare_target') return
      finish({ doseMode: config.doseMode, completion: 'target_completed', targetRepetitions: config.doseMode === 'repetitions' ? config.targetRepetitions : undefined, reportedRepetitions: config.doseMode === 'repetitions' ? config.targetRepetitions : undefined, cognitive: cognitiveReport() })
    } else if (config.cognitiveResponseMode === 'screen_tap' && config.cognitiveTaskMode !== 'none') {
      registerCognitiveResponse()
    } else if (config.doseMode === 'repetitions') {
      setCompletionOpen(true)
    }
  }
  const formattedTime = `${String(Math.floor(Math.max(0, remainingSeconds) / 60)).padStart(2, '0')}:${String(Math.ceil(Math.max(0, remainingSeconds) % 60)).padStart(2, '0')}`

  return <div ref={containerRef} className="fixed inset-0 z-[100] overflow-hidden bg-[#081113] text-white" onPointerMove={showControls} onPointerDown={showControls} onKeyDown={handleKeyDown} role="application" aria-label={`Reproductor: ${config.name}`} tabIndex={-1}>
    {config.kind === 'guided_physical' ? <PhysicalStage config={config}/> : immersiveScenario ? <ImmersivePanorama scenario={immersiveScenario} device={config.displayMode === 'vr_box' ? 'vr_box' : 'quest'} paused={inactive} headPose={cardboard ? tracking.pose : null} viewerProfile={viewerProfile} controlsVisible={controlsVisible} onImmersionChange={setQuestImmersionActive} onTogglePause={() => setPaused((value) => !value)} onExit={() => void exitPlayer()}/> : config.displayMode === 'vr_box' ? <StereoscopicExerciseCanvas config={config} paused={inactive} headPose={cardboard ? tracking.pose : null} viewerProfile={viewerProfile}/> : <ExerciseCanvas config={config} paused={inactive} className="absolute inset-0 size-full"/>}
    {briefingOpen && <CognitiveBriefing config={config} onStart={() => setBriefingOpen(false)}/>}
    {preparing && <PreparationOverlay remaining={preparationRemaining} vrBox={config.displayMode === 'vr_box'} config={config}/>}
    {!vrBox && <div className={`absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 bg-gradient-to-b from-black/72 to-transparent p-5 transition-opacity duration-300 sm:p-7 ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}><div className="max-w-[70vw] rounded-2xl bg-black/48 px-4 py-2 backdrop-blur"><p className="truncate text-xs font-black">{config.name}{config.displayMode === 'quest_browser' ? questImmersive ? ' · Quest WebXR' : ' · Quest navegador BETA' : ''}</p><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-white/70">{config.patientInstruction}</p></div><div className="flex shrink-0 items-center gap-2"><button type="button" onClick={requestFullscreen} className="grid size-10 place-items-center rounded-full bg-black/48 backdrop-blur" aria-label="Pantalla completa"><Expand size={17}/></button><span className="rounded-full bg-black/48 px-4 py-2 text-xs font-black tabular-nums backdrop-blur">{config.doseMode === 'time' ? formattedTime : `${config.targetRepetitions} rep.`}</span></div></div>}
    {config.cognitiveTaskMode !== 'none' && config.cognitiveResponseMode === 'screen_tap' && !inactive && <button type="button" onClick={registerCognitiveResponse} className="absolute right-5 top-1/2 z-40 h-20 -translate-y-1/2 rounded-2xl bg-[#E49A02] px-5 text-sm font-black text-white shadow-2xl sm:right-8">Responder</button>}
    {!vrBox && <div className={`absolute inset-x-0 bottom-0 z-30 flex flex-wrap items-center justify-center gap-3 bg-gradient-to-t from-black/78 to-transparent p-7 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}><button type="button" onClick={() => setPaused((value) => !value)} className="grid size-13 place-items-center rounded-full bg-white text-[#171717] shadow-lg" aria-label={paused ? 'Continuar' : 'Pausar'}>{paused ? <Play size={20}/> : <Pause size={20}/>}</button>{config.doseMode === 'repetitions' && !preparing && <button type="button" onClick={() => setCompletionOpen(true)} className="inline-flex h-12 items-center gap-2 rounded-full bg-[#E49A02] px-5 text-xs font-black shadow-lg"><Check size={17}/> Informar finalización</button>}{onSkip && <button type="button" onClick={() => finish({ doseMode: config.doseMode, completion: 'skipped', targetRepetitions: config.doseMode === 'repetitions' ? config.targetRepetitions : undefined, cognitive: cognitiveReport() })} className="inline-flex h-12 items-center gap-2 rounded-full bg-white/16 px-5 text-xs font-black backdrop-blur"><SkipForward size={17}/> Omitir</button>}<button type="button" onClick={onExit} className="inline-flex h-12 items-center gap-2 rounded-full bg-[#c74750] px-5 text-xs font-black shadow-lg"><LogOut size={17}/> Salir</button></div>}
    {cardboard && controlsVisible && <CardboardControlBar
      paused={paused}
      formattedTime={formattedTime}
      trackingStatus={tracking.status}
      onTogglePause={() => setPaused((value) => !value)}
      onRecenter={tracking.recenter}
      onSkip={onSkip ? () => finish({ doseMode: config.doseMode, completion: 'skipped', targetRepetitions: config.doseMode === 'repetitions' ? config.targetRepetitions : undefined, cognitive: cognitiveReport() }) : undefined}
      onExit={() => void exitPlayer()}
    />}
    {cardboard && !preparing && (
      <CardboardTrackingOverlay
        status={tracking.status}
        failureReason={tracking.failureReason}
        calibrationProgress={tracking.calibrationProgress}
        viewerProfile={viewerProfile}
        onRetry={() => void tracking.requestAndRecenter()}
        onExit={() => void exitPlayer()}
      />
    )}
    {!vrBox && paused && <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-black/38 p-5"><div className="max-w-xl rounded-2xl bg-black/72 px-5 py-4 text-center backdrop-blur"><p className="text-sm font-black">{preparing ? 'Preparación en pausa' : 'Ejercicio en pausa'}</p>{config.stopCriteria && <p className="mt-3 text-xs font-bold leading-5 text-[#ffb8bd]"><strong>Criterio de detención:</strong> {config.stopCriteria}</p>}</div></div>}
    {completionOpen && <CompletionOverlay
      config={config}
      onTarget={(reportedCount) => finish({ doseMode: config.doseMode, completion: 'target_completed', targetRepetitions: config.doseMode === 'repetitions' ? config.targetRepetitions : undefined, reportedRepetitions: config.doseMode === 'repetitions' ? config.targetRepetitions : undefined, cognitive: cognitiveReport(reportedCount) })}
      onPartial={(reportedRepetitions) => finish({ doseMode: 'repetitions', completion: 'partial', targetRepetitions: config.targetRepetitions, reportedRepetitions, cognitive: cognitiveReport() })}
      onSkip={() => finish({ doseMode: config.doseMode, completion: 'skipped', targetRepetitions: config.doseMode === 'repetitions' ? config.targetRepetitions : undefined, cognitive: cognitiveReport() })}
    />}
  </div>
}

export function ExercisePlayer(props: ExercisePlayerProps) {
  const compatibility = analyzeExerciseCompatibility(props.config)
  if (compatibility.valid) return <CompatibleExercisePlayer {...props}/>
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#171717] p-6 text-white" role="alert">
    <div className="w-full max-w-xl rounded-3xl border border-[#c74750]/50 bg-white/[0.06] p-7 text-center shadow-2xl">
      <ShieldAlert className="mx-auto text-[#ef6b74]" size={48}/>
      <p className="mt-5 text-xs font-black uppercase tracking-[.16em] text-[#ef6b74]">Ejercicio no ejecutable</p>
      <h2 className="mt-3 text-2xl font-black">La configuración no representa la tarea indicada</h2>
      <p className="mt-4 text-sm leading-6 text-white/70">{compatibility.issues[0].message}</p>
      <p className="mt-2 text-sm font-bold leading-6 text-white/85">{compatibility.issues[0].correction}</p>
      <button type="button" onClick={props.onExit} className="mt-7 h-13 w-full rounded-2xl bg-white px-5 text-sm font-black text-[#171717]">Salir y avisar al profesional</button>
    </div>
  </div>
}
