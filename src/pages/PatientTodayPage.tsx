import { ChevronRight, Clock3, Expand, LogOut, Pause, Play, Volume2 } from 'lucide-react'
import { useState } from 'react'
import { Brand } from '../components/Brand'
import { useAuth } from '../features/auth/AuthProvider'
import { PatientUseAcknowledgement } from '../features/auth/PatientUseAcknowledgement'
import { usePatientAcknowledgement } from '../features/auth/patientAcknowledgementHooks'
import { PatientPortalAssessments } from '../features/assessments/PatientPortalAssessments'
import { PatientPortalDocuments } from '../features/documents/PatientPortalDocuments'
import { useCompleteSession, useCurrentPatientAssignment, useInterruptSession, usePendingSessionSync, useStartSession } from '../features/sessions/hooks'
import { sessionDurationLabel, type SessionEventLogEntry } from '../features/sessions/repository'
import { SessionRunner } from '../features/sessions/SessionRunner'
import { ScaleQuestion } from '../features/sessions/ScaleQuestion'

type RunnerResult = { activeSeconds: number; skippedExercises: number; eventLog: SessionEventLogEntry[] }

export function PatientTodayPage() {
  const [stage, setStage] = useState<'review' | 'running' | 'feedback' | 'finished'>('review')
  const [initialDiscomfort, setInitialDiscomfort] = useState<number | null>(null)
  const [finalDiscomfort, setFinalDiscomfort] = useState<number | null>(null)
  const [perceivedDifficulty, setPerceivedDifficulty] = useState<number | null>(null)
  const [patientComment, setPatientComment] = useState('')
  const [runnerResult, setRunnerResult] = useState<RunnerResult | null>(null)
  const [completionError, setCompletionError] = useState('')
  const [queued, setQueued] = useState(false)
  const [outcome, setOutcome] = useState<'completed' | 'interrupted'>('completed')
  const { data: session, isPending } = useCurrentPatientAssignment()
  const { data: acknowledgement, isPending: acknowledgementPending } = usePatientAcknowledgement()
  const complete = useCompleteSession()
  const interrupt = useInterruptSession()
  const startSession = useStartSession()
  const auth = useAuth()
  usePendingSessionSync()

  const saveInterruption = async (activeSeconds: number, skippedExercises: number, eventLog: SessionEventLogEntry[]) => {
    if (!session || initialDiscomfort === null) return
    try {
      setCompletionError('')
      const result = await interrupt.mutateAsync({ assignment: session, activeSeconds, skippedExercises, initialDiscomfort, eventLog })
      setQueued(result.queued)
      setOutcome('interrupted')
      setStage('finished')
    } catch {
      setRunnerResult({ activeSeconds, skippedExercises, eventLog })
      setCompletionError('No fue posible guardar la salida parcial automáticamente. Completá las escalas para conservar el resultado.')
      setStage('feedback')
    }
  }

  if (stage === 'running' && session) return <SessionRunner session={session} onExit={(activeSeconds, skippedExercises, eventLog) => {
    void saveInterruption(activeSeconds, skippedExercises, eventLog)
  }} onFinish={(activeSeconds, skippedExercises, eventLog) => {
    setRunnerResult({ activeSeconds, skippedExercises, eventLog })
    setStage('feedback')
  }}/>

  const logout = async () => { await auth.signOut(); window.location.assign(`${import.meta.env.BASE_URL}ingresar`) }
  const start = async () => {
    if (initialDiscomfort === null) {
      setCompletionError('Elegí un valor de 0 a 10 antes de comenzar.')
      return
    }
    try { setCompletionError(''); if (session) await startSession.mutateAsync(session); setStage('running') }
    catch { setCompletionError('No fue posible iniciar la sesión. Revisá la conexión e intentá nuevamente.') }
  }
  const saveCompletion = async () => {
    if (!session || !runnerResult || initialDiscomfort === null || finalDiscomfort === null || perceivedDifficulty === null) {
      setCompletionError('Completá las dos escalas para guardar la sesión.')
      return
    }
    try {
      setCompletionError('')
      const result = await complete.mutateAsync({ assignment: session, ...runnerResult, initialDiscomfort, finalDiscomfort, perceivedDifficulty, patientComment })
      setQueued(result.queued)
      setOutcome('completed')
      setStage('finished')
    } catch {
      setCompletionError('La sesión terminó, pero el resultado todavía no se pudo guardar. Revisá la conexión e intentá nuevamente.')
    }
  }

  if (isPending || acknowledgementPending) return <main className="grid min-h-screen place-items-center bg-[#F7F6F4] text-sm font-bold text-[#747474]">Preparando tu portal…</main>

  return <main className="min-h-screen bg-[#F7F6F4] px-5 py-6 sm:px-8"><div className="mx-auto max-w-2xl">
    <header className="flex items-center justify-between"><Brand/><button type="button" onClick={logout} className="grid size-10 place-items-center rounded-xl text-[#747474]" aria-label="Cerrar sesión"><LogOut size={18}/></button></header>
    <section className="mt-12"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#E49A02]">Sesión asignada</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[#171717] sm:text-5xl">Tu entrenamiento</h1><p className="mt-3 text-sm leading-6 text-[#747474]">Revisá las indicaciones y comenzá cuando estés preparado.</p></section>
    {completionError && <p role="alert" className="mt-6 rounded-2xl bg-[#fceced] p-4 text-sm font-bold text-[#a94952]">{completionError}</p>}
    {!acknowledgement?.accepted ? <PatientUseAcknowledgement/> : (stage === 'finished' ? <article className="mt-8 rounded-2xl border border-[#E8CE99] bg-white p-8 text-center"><div className="mx-auto grid size-16 place-items-center rounded-full bg-[#FFF7E8] text-2xl">✓</div><h2 className="mt-5 text-2xl font-black text-[#171717]">{outcome === 'interrupted' ? 'Avance parcial guardado' : 'Sesión completada'}</h2><p className="mt-3 text-sm leading-6 text-[#747474]">{queued ? 'El resultado quedó guardado en este dispositivo y se enviará automáticamente cuando vuelva la conexión.' : outcome === 'interrupted' ? 'La sesión quedó registrada como parcial para que tu profesional pueda revisar el avance.' : 'El profesional podrá ver que terminaste la sesión y tus respuestas.'}</p></article>
      : stage === 'feedback' && session ? <article className="mt-8 space-y-5"><div className="rounded-2xl bg-[#171717] p-6 text-white"><p className="text-xs font-black uppercase tracking-[.16em] text-[#E49A02]">Último paso</p><h2 className="mt-3 text-2xl font-black">¿Cómo te resultó la sesión?</h2><p className="mt-2 text-sm leading-6 text-white/65">Estas respuestas describen tu experiencia. No generan decisiones ni recomendaciones automáticas.</p></div>
        <ScaleQuestion label="Malestar ahora" hint="0 significa ningún malestar y 10 el mayor malestar que puedas imaginar." min={0} max={10} value={finalDiscomfort} onChange={setFinalDiscomfort}/>
        <ScaleQuestion label="Dificultad de la sesión" hint="1 significa muy fácil y 5 muy difícil." min={1} max={5} value={perceivedDifficulty} onChange={setPerceivedDifficulty}/>
        <label className="block rounded-2xl border border-[#E9E7E7] bg-white p-5 text-sm font-black text-[#2F2F2F]">Comentario opcional<textarea maxLength={500} rows={3} value={patientComment} onChange={(event) => setPatientComment(event.target.value)} className="mt-3 w-full resize-none rounded-2xl border border-[#E9E7E7] p-4 text-base font-normal" placeholder="Si querés, contale algo a tu profesional."/><span className="mt-2 block text-right text-[11px] font-bold text-[#747474]">{patientComment.length}/500</span></label>
        <button type="button" disabled={complete.isPending} onClick={saveCompletion} className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#E49A02] text-sm font-black text-white disabled:opacity-60">{complete.isPending ? 'Guardando…' : 'Guardar y finalizar'}</button>
      </article>
      : !session ? <article className="mt-8 rounded-2xl border border-[#E9E7E7] bg-white p-8"><h2 className="text-xl font-black text-[#171717]">No hay una sesión disponible</h2><p className="mt-3 text-sm leading-6 text-[#747474]">Cuando tu profesional asigne una sesión vigente aparecerá en esta pantalla.</p></article>
      : <article className="mt-8 overflow-hidden rounded-2xl border border-[#E9E7E7] bg-white shadow-[0_20px_48px_rgba(18,50,56,0.08)]">
        <div className="bg-[#171717] p-6 text-white sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#E49A02]">{session.title}</p><h2 className="mt-3 text-2xl font-black">{session.mode === 'home' ? 'Sesión domiciliaria' : 'Sesión presencial'}</h2></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black">DISPONIBLE</span></div>
          <div className="mt-7 grid grid-cols-3 gap-3">{[[Clock3, sessionDurationLabel(session), 'Duración'], [Play, String(session.exercises.length), 'Ejercicios'], [Pause, `${session.exercises[0]?.restSeconds ?? 0} s`, 'Descanso']].map(([Icon, value, label]) => { const ItemIcon = Icon as typeof Clock3; return <div key={String(label)} className="rounded-2xl bg-white/[0.065] p-3"><ItemIcon size={16} className="text-[#E49A02]"/><p className="mt-3 text-sm font-black">{String(value)}</p><p className="mt-1 text-[10px] text-white/52">{String(label)}</p></div> })}</div>
        </div>
        <div className="p-6 sm:p-8"><h3 className="text-sm font-black text-[#2F2F2F]">Indicaciones</h3><p className="mt-3 rounded-2xl bg-[#F7F6F4] p-4 text-xs leading-5 text-[#747474]">{session.instructions || 'Seguí las indicaciones brindadas por tu profesional.'}</p>
          <div className="mt-4 space-y-3">{[[Expand, 'Usá pantalla completa y colocá el dispositivo como te indicaron.'], [Volume2, 'Activá el sonido si la sesión incluye metrónomo.'], [Pause, 'El cambio de fase puede requerir tu confirmación. En ejercicios por repeticiones, informá cuando termines; no necesitás tocar la pantalla durante cada movimiento.']].map(([Icon, text]) => { const ItemIcon = Icon as typeof Expand; return <div key={String(text)} className="flex gap-3 rounded-2xl bg-[#F7F6F4] p-4"><ItemIcon className="mt-0.5 shrink-0 text-[#E49A02]" size={18}/><p className="text-xs leading-5 text-[#747474]">{String(text)}</p></div> })}</div>
          <div className="mt-5"><ScaleQuestion label="Malestar antes de comenzar" hint="0 significa ningún malestar y 10 el mayor malestar que puedas imaginar." min={0} max={10} value={initialDiscomfort} onChange={setInitialDiscomfort}/></div>
          <p className="mt-3 text-[11px] leading-5 text-[#747474]">Este valor solo se registra para que el profesional conozca tu experiencia. La aplicación no toma decisiones automáticas.</p>
          <button type="button" disabled={startSession.isPending} onClick={start} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#E49A02] text-sm font-black text-white shadow-[0_12px_24px_rgba(11,122,117,0.2)] disabled:opacity-60">{startSession.isPending?'Iniciando…':'Comenzar sesión'} <ChevronRight size={18}/></button>
        </div>
      </article>)}
    {acknowledgement?.accepted && stage !== 'feedback' && <><PatientPortalAssessments/><PatientPortalDocuments/></>}
    <p className="mt-6 text-center text-[11px] leading-5 text-[#747474]">Realizá la sesión únicamente según las indicaciones de tu profesional.</p>
  </div></main>
}
