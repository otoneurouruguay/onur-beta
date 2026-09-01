import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, Copy, Expand, FilePenLine, Glasses, Pause, Play, RefreshCw, Volume2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { statusLabel } from '../components/statusLabels'
import { usePatient } from '../features/patients/hooks'
import { useCompleteSupervisedInPersonSession, useCreateQuestSessionPairing, useQuestSessionPairing, useQuestSessionPairingForAssignment, useRecordFreeInPersonSession, useRevokeQuestSessionPairing, useSessionAssignments, useStartSupervisedInPersonSession } from '../features/sessions/hooks'
import { ScaleQuestion } from '../features/sessions/ScaleQuestion'
import { sessionDurationLabel, type SessionAssignmentRecord, type SessionEventLogEntry } from '../features/sessions/repository'
import { SessionRunner } from '../features/sessions/SessionRunner'
import { isQuestClinicAssignment } from '../features/sessions/questRepository'
import { isAnyQuestImmersive } from '../features/immersive/questProcedural'

type RunnerResult = { activeSeconds: number; skippedExercises: number; eventLog: SessionEventLogEntry[] }

function readableError(caught: unknown, fallback: string) {
  if (caught instanceof Error && caught.message.trim()) return caught.message
  if (caught && typeof caught === 'object' && 'message' in caught) {
    const message = (caught as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

function FreeInPersonSessionRecorder({ patientId, patientName, assignment }: { patientId: string; patientName: string; assignment: SessionAssignmentRecord }) {
  const record = useRecordFreeInPersonSession(patientId)
  const [outcome, setOutcome] = useState<'completed' | 'cancelled'>('completed')
  const [professionalNote, setProfessionalNote] = useState('')
  const [patientComment, setPatientComment] = useState('')
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState('')

  if (finished) return <div className="mx-auto max-w-3xl space-y-6"><article className="rounded-2xl border border-[#E8CE99] bg-white p-8 text-center"><CheckCircle2 className="mx-auto text-[#E49A02]" size={52}/><h1 className="mt-5 text-2xl font-black text-[#171717]">{outcome === 'cancelled' ? 'Cancelación registrada' : 'Sesión libre registrada'}</h1><p className="mt-3 text-sm leading-6 text-[#747474]">La nota quedó asociada al ciclo y disponible en el historial clínico del paciente.</p><Link to={`/app/pacientes/${patientId}`} className="mt-7 inline-flex rounded-2xl bg-[#E49A02] px-5 py-3 text-sm font-black text-white">Volver al perfil</Link></article></div>

  if (!['assigned', 'started'].includes(assignment.status)) return <section className="rounded-2xl border border-[#E9E7E7] bg-white p-7"><h1 className="text-xl font-black text-[#171717]">La sesión ya no está pendiente</h1><p className="mt-3 text-sm leading-6 text-[#747474]">Su estado actual es {statusLabel(assignment.status).toLocaleLowerCase('es')}. El detalle se conserva en el perfil del paciente.</p><Link to={`/app/pacientes/${patientId}`} className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#E49A02]"><ChevronLeft size={17}/> Volver al perfil</Link></section>

  const save = async () => {
    if (professionalNote.trim().length < 3) { setError(outcome === 'cancelled' ? 'Escribí el motivo o contexto de la cancelación.' : 'Describí lo realizado durante la sesión.'); return }
    try {
      setError('')
      await record.mutateAsync({ assignment, outcome, professionalNote, patientComment })
      setFinished(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible guardar el registro de la sesión.')
    }
  }

  return <div className="mx-auto max-w-3xl space-y-6">
    <Link to={`/app/pacientes/${patientId}`} className="inline-flex items-center gap-2 text-xs font-black text-[#E49A02]"><ChevronLeft size={16}/> Volver al perfil de {patientName}</Link>
    <article className="overflow-hidden rounded-2xl border border-[#E9E7E7] bg-white shadow-[0_20px_48px_rgba(18,50,56,0.08)]">
      <div className="bg-[#171717] p-6 text-white sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#E49A02]">{assignment.title}</p><h1 className="mt-3 text-2xl font-black">Registro presencial libre</h1><p className="mt-2 text-sm text-white/65">Paciente: {patientName}</p></div><FilePenLine className="shrink-0 text-[#E49A02]" size={30}/></div>{assignment.instructions && <p className="mt-5 rounded-2xl bg-white/[0.07] p-4 text-xs leading-5 text-white/70">{assignment.instructions}</p>}</div>
      <div className="space-y-5 p-6 sm:p-8">
        <fieldset><legend className="text-sm font-black text-[#2F2F2F]">Resultado de la consulta</legend><div className="mt-3 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setOutcome('completed')} className={`rounded-2xl border p-4 text-left ${outcome === 'completed' ? 'border-[#E49A02] bg-[#FFF7E8]' : 'border-[#E9E7E7]'}`}><strong className="text-sm text-[#171717]">Realizada</strong><span className="mt-1 block text-xs text-[#747474]">Registrar trabajo físico, maniobras, educación u otra intervención.</span></button><button type="button" onClick={() => setOutcome('cancelled')} className={`rounded-2xl border p-4 text-left ${outcome === 'cancelled' ? 'border-[#E49A02] bg-[#FFF7E8]' : 'border-[#E9E7E7]'}`}><strong className="text-sm text-[#171717]">Cancelada</strong><span className="mt-1 block text-xs text-[#747474]">Conservar que no se realizó y el motivo o contexto correspondiente.</span></button></div></fieldset>
        <label className="block text-sm font-black text-[#2F2F2F]">{outcome === 'cancelled' ? 'Motivo o registro de cancelación *' : 'Qué se hizo en la sesión *'}<textarea autoFocus maxLength={4000} rows={8} value={professionalNote} onChange={(event) => setProfessionalNote(event.target.value)} className="mt-3 w-full resize-y rounded-2xl border border-[#E9E7E7] p-4 text-base font-normal leading-6" placeholder={outcome === 'cancelled' ? 'Ej.: paciente avisó que no concurriría; se coordinó nueva fecha…' : 'Describí el trabajo realizado, respuesta observada, progresiones, precauciones y próximos pasos.'}/><span className="mt-2 block text-right text-[11px] font-bold text-[#747474]">{professionalNote.length}/4000</span></label>
        <label className="block text-sm font-black text-[#2F2F2F]">Comentario del paciente <span className="font-normal text-[#747474]">(opcional)</span><textarea maxLength={500} rows={3} value={patientComment} onChange={(event) => setPatientComment(event.target.value)} className="mt-3 w-full resize-none rounded-2xl border border-[#E9E7E7] p-4 text-base font-normal" placeholder="Transcribí lo declarado por el paciente si aporta al registro."/><span className="mt-2 block text-right text-[11px] font-bold text-[#747474]">{patientComment.length}/500</span></label>
        {error && <p role="alert" className="rounded-2xl bg-[#fceced] p-4 text-sm font-bold text-[#a94952]">{error}</p>}
        <button type="button" disabled={record.isPending} onClick={() => void save()} className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#E49A02] text-sm font-black text-white disabled:opacity-60">{record.isPending ? 'Guardando…' : outcome === 'cancelled' ? 'Registrar cancelación' : 'Guardar sesión en el historial'}</button>
      </div>
    </article>
  </div>
}

export function InPersonSessionPage() {
  const { patientId = '', assignmentId = '' } = useParams()
  const { data: patient, isPending: patientPending } = usePatient(patientId)
  const { data: assignments = [], isPending: assignmentsPending } = useSessionAssignments(patientId)
  const assignment = assignments.find((item) => item.id === assignmentId)
  const startSupervised = useStartSupervisedInPersonSession(patientId)
  const completeSupervised = useCompleteSupervisedInPersonSession(patientId)
  const createQuestPairing = useCreateQuestSessionPairing()
  const revokeQuestPairing = useRevokeQuestSessionPairing()
  const [stage, setStage] = useState<'review' | 'running' | 'quest_waiting' | 'feedback' | 'finished'>('review')
  const [initialDiscomfort, setInitialDiscomfort] = useState<number | null>(null)
  const [peakDiscomfort, setPeakDiscomfort] = useState<number | null>(null)
  const [finalDiscomfort, setFinalDiscomfort] = useState<number | null>(null)
  const [recoveryMinutes, setRecoveryMinutes] = useState<number | null>(null)
  const [delayedResponse, setDelayedResponse] = useState('')
  const [progressionDecision, setProgressionDecision] = useState('mantener')
  const [perceivedDifficulty, setPerceivedDifficulty] = useState<number | null>(null)
  const [patientComment, setPatientComment] = useState('')
  const [professionalObservation, setProfessionalObservation] = useState('')
  const [runnerResult, setRunnerResult] = useState<RunnerResult | null>(null)
  const [questPairingId, setQuestPairingId] = useState('')
  const [questPairingCode, setQuestPairingCode] = useState('')
  const [questPairingExpiresAt, setQuestPairingExpiresAt] = useState('')
  const [error, setError] = useState('')
  const questStationAddress = `${window.location.origin}${import.meta.env.BASE_URL}q`
  const questPairing = useQuestSessionPairing(questPairingId, stage === 'quest_waiting')
  const recoverableQuestPairing = useQuestSessionPairingForAssignment(assignmentId, stage === 'review' && assignment?.status === 'started' && Boolean(assignment && isQuestClinicAssignment(assignment)))
  const questImmersive = Boolean(assignment?.exercises.length && assignment.exercises.every(isAnyQuestImmersive))
  const stopCriteria = Array.from(new Set(assignment?.exercises.map((exercise) => exercise.stopCriteria?.trim()).filter(Boolean) ?? [])) as string[]

  useEffect(() => {
    const captured = questPairing.data?.capturedResult
    if (stage !== 'quest_waiting' || !captured) return
    setRunnerResult(captured)
    setStage('feedback')
  }, [questPairing.data?.capturedResult, stage])

  useEffect(() => {
    const recovered = recoverableQuestPairing.data
    if (stage !== 'review' || !recovered) return
    if (recovered.status === 'captured' && recovered.capturedResult) {
      setQuestPairingId(recovered.id)
      setRunnerResult(recovered.capturedResult)
      setStage('feedback')
      return
    }
    if (recovered.status === 'claimed') {
      setQuestPairingId(recovered.id)
      setQuestPairingExpiresAt(recovered.expiresAt)
      setStage('quest_waiting')
    }
  }, [recoverableQuestPairing.data, stage])

  if (stage === 'running' && assignment) {
    return <SessionRunner session={assignment} onExit={() => setStage('review')} onFinish={(activeSeconds, skippedExercises, eventLog) => {
      setRunnerResult({ activeSeconds, skippedExercises, eventLog })
      setStage('feedback')
    }}/>
  }

  if (patientPending || assignmentsPending) return <p className="text-sm font-bold text-[#747474]">Preparando sesión presencial…</p>

  if (!patient || !assignment || assignment.mode !== 'in_person') {
    return <section className="rounded-2xl border border-[#E9E7E7] bg-white p-7">
      <h1 className="text-xl font-black text-[#171717]">Sesión presencial no disponible</h1>
      <p className="mt-3 text-sm leading-6 text-[#747474]">La asignación no existe, no es presencial o no pertenece a este paciente.</p>
      <Link to={`/app/pacientes/${patientId}`} className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#E49A02]"><ChevronLeft size={17}/> Volver al perfil</Link>
    </section>
  }

  if (!['assigned', 'started'].includes(assignment.status) && stage !== 'finished') {
    return <section className="rounded-2xl border border-[#E9E7E7] bg-white p-7">
      <h1 className="text-xl font-black text-[#171717]">La sesión ya no está pendiente</h1>
      <p className="mt-3 text-sm leading-6 text-[#747474]">Su estado actual es {statusLabel(assignment.status).toLocaleLowerCase('es')}. Consultá el resultado desde el perfil del paciente.</p>
      <Link to={`/app/pacientes/${patientId}`} className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#E49A02]"><ChevronLeft size={17}/> Volver al perfil</Link>
    </section>
  }

  const start = async () => {
    if (initialDiscomfort === null) {
      setError('Registrá el malestar inicial declarado por el paciente antes de comenzar.')
      return
    }
    try {
      setError('')
      await startSupervised.mutateAsync({ assignment, initialDiscomfort })
      setRunnerResult(null)
      setStage('running')
    } catch {
      setError('No fue posible iniciar la sesión presencial. Verificá los permisos y volvé a intentar.')
    }
  }

  if (assignment.kind === 'free_note') return <FreeInPersonSessionRecorder patientId={patient.id} patientName={patient.fullName} assignment={assignment}/>

  const prepareQuest = async () => {
    if (!assignment || initialDiscomfort === null) {
      setError('Registrá el malestar inicial declarado por el paciente antes de preparar Quest.')
      return
    }
    try {
      setError('')
      await startSupervised.mutateAsync({ assignment, initialDiscomfort })
      const created = await createQuestPairing.mutateAsync({ ...assignment, status: 'started' })
      setRunnerResult(null)
      setQuestPairingId(created.id)
      setQuestPairingCode(created.code)
      setQuestPairingExpiresAt(created.expiresAt)
      setStage('quest_waiting')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible preparar la estación Quest.')
    }
  }

  const cancelQuestPairing = async () => {
    try {
      setError('')
      if (questPairingId && ['ready', 'claimed'].includes(questPairing.data?.status ?? 'ready')) await revokeQuestPairing.mutateAsync(questPairingId)
      setQuestPairingId('')
      setQuestPairingCode('')
      setStage('review')
    } catch {
      setError('No fue posible cancelar el vínculo Quest. Esperá a que venza antes de generar otro.')
    }
  }

  const finish = async () => {
    if (!runnerResult || peakDiscomfort === null || finalDiscomfort === null || perceivedDifficulty === null) {
      setError('Registrá el máximo durante, el malestar final y la dificultad percibida.')
      return
    }
    try {
      setError('')
      await completeSupervised.mutateAsync({
        assignment,
        ...runnerResult,
        peakDiscomfort,
        finalDiscomfort,
        recoveryMinutes,
        delayedResponse,
        progressionDecision,
        perceivedDifficulty,
        patientComment,
        professionalObservation,
      })
      setStage('finished')
    } catch (caught) {
      setError(readableError(caught, 'La ejecución terminó, pero no fue posible guardar el cierre supervisado. Volvé a intentar sin abandonar esta pantalla.'))
    }
  }

  return <div className="mx-auto max-w-3xl space-y-6">
    <Link to={`/app/pacientes/${patient.id}`} className="inline-flex items-center gap-2 text-xs font-black text-[#E49A02]"><ChevronLeft size={16}/> Volver al perfil de {patient.fullName}</Link>
    {error && <p role="alert" className="rounded-2xl bg-[#fceced] p-4 text-sm font-bold text-[#a94952]">{error}</p>}

    {stage === 'finished' ? <article className="rounded-2xl border border-[#E8CE99] bg-white p-8 text-center">
      <CheckCircle2 className="mx-auto text-[#E49A02]" size={52}/>
      <h1 className="mt-5 text-2xl font-black text-[#171717]">Sesión presencial registrada</h1>
      <p className="mt-3 text-sm leading-6 text-[#747474]">La ejecución quedó identificada como presencial, supervisada y operada por tu cuenta profesional.</p>
      <Link to={`/app/pacientes/${patient.id}`} className="mt-7 inline-flex rounded-2xl bg-[#E49A02] px-5 py-3 text-sm font-black text-white">Volver al perfil</Link>
    </article> : stage === 'quest_waiting' ? <article className="overflow-hidden rounded-2xl border border-[#E9E7E7] bg-white shadow-[0_20px_48px_rgba(18,50,56,0.08)]">
      <div className="bg-[#171717] p-7 text-white"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#EFB33A]">Estación Quest preparada</p><h1 className="mt-3 text-2xl font-black">{questPairingCode ? 'Ingresá este código en el visor' : 'La ejecución continúa en el visor'}</h1><p className="mt-2 break-all text-sm text-white/65">{questPairingCode ? <>Abrí {questStationAddress} en Meta Quest Browser. Guardala como favorito la primera vez; después solo necesitás ingresar el código temporal.</> : 'Se recuperó el vínculo después de recargar esta pantalla.'}</p></div><Glasses className="shrink-0 text-[#EFB33A]" size={32}/></div></div>
      <div className="space-y-5 p-6 sm:p-8">
        {questPairingCode && <><div className="rounded-2xl bg-[#FFF7E8] p-6 text-center"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#8A5B00]">Código temporal</p><p className="mt-3 font-mono text-4xl font-black tracking-[.2em] text-[#171717]" aria-label={`Código Quest ${questPairingCode}`}>{questPairingCode}</p><p className="mt-3 text-[11px] font-bold text-[#8A5B00]">Vence a las {questPairingExpiresAt ? new Date(questPairingExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p></div>
        <button type="button" onClick={() => void navigator.clipboard?.writeText(questStationAddress)} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#E9E7E7] px-4 py-3 text-xs font-black"><Copy size={16}/> Copiar dirección de la estación</button></>}
        <div className="rounded-2xl bg-[#F7F6F4] p-5"><div className="flex items-center gap-3"><RefreshCw className={`text-[#E49A02] ${questPairing.data?.status === 'claimed' ? '' : 'animate-spin'}`} size={19}/><div><p className="text-sm font-black">{questPairing.data?.status === 'claimed' ? 'El visor cargó la sesión' : 'Esperando al visor'}</p><p className="mt-1 text-xs leading-5 text-[#747474]">{questPairing.data?.status === 'claimed' ? 'La ejecución continúa en Quest. Al terminar aparecerá automáticamente el cierre profesional.' : 'El código no contiene credenciales ni permite abrir la historia clínica.'}</p></div></div></div>
        {questPairing.isError && <p role="alert" className="rounded-2xl bg-[#fceced] p-4 text-xs font-bold text-[#a94952]">No se pudo consultar la estación. Revisá la conexión antes de continuar.</p>}
        {['expired', 'revoked'].includes(questPairing.data?.status ?? '') && <p role="alert" className="rounded-2xl bg-[#fceced] p-4 text-xs font-bold text-[#a94952]">El vínculo ya no está activo. Volvé a la preparación para generar uno nuevo.</p>}
        <button type="button" disabled={revokeQuestPairing.isPending} onClick={() => void cancelQuestPairing()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#eccfd2] px-4 py-3 text-xs font-black text-[#a94952] disabled:opacity-50"><XCircle size={16}/> Cancelar y volver</button>
      </div>
    </article> : stage === 'feedback' ? <article className="space-y-5">
      <div className="rounded-2xl bg-[#171717] p-6 text-white">
        <p className="text-xs font-black uppercase tracking-[.16em] text-[#E49A02]">Cierre supervisado</p>
        <h1 className="mt-3 text-2xl font-black">Registrar la experiencia declarada</h1>
        <p className="mt-2 text-sm leading-6 text-white/65">Completá las respuestas del paciente y, si corresponde, tu observación profesional.</p>
      </div>
      <ScaleQuestion label="Malestar al finalizar" hint="Respuesta declarada por el paciente: 0 significa ningún malestar y 10 el mayor malestar imaginable." min={0} max={10} value={finalDiscomfort} onChange={setFinalDiscomfort}/>
      <ScaleQuestion label="Máximo malestar durante la sesión" hint="Registrá el valor máximo que el paciente recuerda haber sentido durante los ejercicios." min={0} max={10} value={peakDiscomfort} onChange={setPeakDiscomfort}/>
      <ScaleQuestion label="Dificultad percibida" hint="Respuesta declarada por el paciente: 1 significa muy fácil y 5 muy difícil." min={1} max={5} value={perceivedDifficulty} onChange={setPerceivedDifficulty}/>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block rounded-2xl border border-[#E9E7E7] bg-white p-5 text-sm font-black text-[#2F2F2F]">Recuperación hasta volver a basal <span className="font-normal text-[#747474]">(minutos, opcional)</span><input type="number" min="0" max="1440" value={recoveryMinutes ?? ''} onChange={(event) => setRecoveryMinutes(event.target.value === '' ? null : Number(event.target.value))} className="mt-3 h-12 w-full rounded-2xl border border-[#E9E7E7] px-4 text-base font-normal"/></label><label className="block rounded-2xl border border-[#E9E7E7] bg-white p-5 text-sm font-black text-[#2F2F2F]">Decisión para la próxima sesión<select value={progressionDecision} onChange={(event) => setProgressionDecision(event.target.value)} className="mt-3 h-12 w-full rounded-2xl border border-[#E9E7E7] px-4 text-base font-normal"><option value="mantener">Mantener parámetros</option><option value="progresar_una_variable">Progresar una variable</option><option value="regresar">Regresar carga</option><option value="reevaluar">Reevaluar antes de continuar</option></select></label></div>
      <label className="block rounded-2xl border border-[#E9E7E7] bg-white p-5 text-sm font-black text-[#2F2F2F]">Respuesta tardía conocida <span className="font-normal text-[#747474]">(opcional)</span><textarea maxLength={1000} rows={3} value={delayedResponse} onChange={(event) => setDelayedResponse(event.target.value)} className="mt-3 w-full resize-none rounded-2xl border border-[#E9E7E7] p-4 text-base font-normal" placeholder="Si todavía no puede conocerse, dejar vacío y completar en seguimiento."/></label>
      <label className="block rounded-2xl border border-[#E9E7E7] bg-white p-5 text-sm font-black text-[#2F2F2F]">Comentario del paciente <span className="font-normal text-[#747474]">(opcional)</span><textarea maxLength={500} rows={3} value={patientComment} onChange={(event) => setPatientComment(event.target.value)} className="mt-3 w-full resize-none rounded-2xl border border-[#E9E7E7] p-4 text-base font-normal" placeholder="Transcribí lo declarado por el paciente si corresponde."/><span className="mt-2 block text-right text-[11px] font-bold text-[#747474]">{patientComment.length}/500</span></label>
      <label className="block rounded-2xl border border-[#E9E7E7] bg-white p-5 text-sm font-black text-[#2F2F2F]">Observación profesional <span className="font-normal text-[#747474]">(opcional)</span><textarea maxLength={2000} rows={4} value={professionalObservation} onChange={(event) => setProfessionalObservation(event.target.value)} className="mt-3 w-full resize-none rounded-2xl border border-[#E9E7E7] p-4 text-base font-normal" placeholder="Añadí una observación clínica si corresponde."/><span className="mt-2 block text-right text-[11px] font-bold text-[#747474]">{professionalObservation.length}/2000</span></label>
      <button type="button" disabled={completeSupervised.isPending} onClick={finish} className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#E49A02] text-sm font-black text-white disabled:opacity-60">{completeSupervised.isPending ? 'Guardando…' : 'Guardar y finalizar'}</button>
    </article> : <article className="overflow-hidden rounded-2xl border border-[#E9E7E7] bg-white shadow-[0_20px_48px_rgba(18,50,56,0.08)]">
      <div className="bg-[#171717] p-6 text-white sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#E49A02]">{assignment.title}</p><h1 className="mt-3 text-2xl font-black">Sesión presencial supervisada</h1><p className="mt-2 text-sm text-white/65">Paciente: {patient.fullName}</p></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black">PROFESIONAL</span></div>
        <div className="mt-7 grid grid-cols-3 gap-3">{[[Clock3, sessionDurationLabel(assignment), 'Duración'], [Play, String(assignment.exercises.length), 'Ejercicios'], [Pause, `${assignment.exercises[0]?.restSeconds ?? 0} s`, 'Descanso']].map(([Icon, value, label]) => { const ItemIcon = Icon as typeof Clock3; return <div key={String(label)} className="rounded-2xl bg-white/[0.065] p-3"><ItemIcon size={16} className="text-[#E49A02]"/><p className="mt-3 text-sm font-black">{String(value)}</p><p className="mt-1 text-[10px] text-white/52">{String(label)}</p></div> })}</div>
      </div>
      <div className="p-6 sm:p-8">
        <h2 className="text-sm font-black text-[#2F2F2F]">Indicaciones</h2>
        <p className="mt-3 rounded-2xl bg-[#F7F6F4] p-4 text-xs leading-5 text-[#747474]">{assignment.instructions || 'Supervisá la ejecución según el plan indicado.'}</p>
        {stopCriteria.length > 0 && <div className="mt-3 rounded-2xl bg-[#fceced] p-4 text-[#a94952]"><p className="text-xs font-black">Criterios de detención o pausa</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs font-bold leading-5">{stopCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul></div>}
        <div className="mt-4 space-y-3">{[[Expand, 'El reproductor mantiene pantalla completa y controles auto-ocultables.'], [Volume2, 'El audio y el metrónomo conservan la configuración de la asignación.'], [Pause, 'Podés pausar, omitir o salir. Al volver, la sesión se reinicia desde el principio.']].map(([Icon, text]) => { const ItemIcon = Icon as typeof Expand; return <div key={String(text)} className="flex gap-3 rounded-2xl bg-[#F7F6F4] p-4"><ItemIcon className="mt-0.5 shrink-0 text-[#E49A02]" size={18}/><p className="text-xs leading-5 text-[#747474]">{String(text)}</p></div> })}</div>
        <div className="mt-5"><ScaleQuestion label="Malestar antes de comenzar" hint="Registrá lo declarado por el paciente: 0 significa ningún malestar y 10 el mayor malestar imaginable." min={0} max={10} value={initialDiscomfort} onChange={setInitialDiscomfort}/></div>
        <p className="mt-3 text-[11px] leading-5 text-[#747474]">La cuenta profesional permanece autenticada durante toda la ejecución; el paciente no inicia sesión.</p>
        {isQuestClinicAssignment(assignment) ? <div className="mt-6 space-y-3"><button type="button" disabled={startSupervised.isPending || createQuestPairing.isPending} onClick={() => void prepareQuest()} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#E49A02] text-sm font-black text-white shadow-[0_12px_24px_rgba(11,122,117,0.2)] disabled:opacity-60"><Glasses size={18}/>{createQuestPairing.isPending ? 'Preparando Quest…' : 'Preparar en Quest'}</button>{!questImmersive && <button type="button" disabled={startSupervised.isPending} onClick={start} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#E9E7E7] text-xs font-black text-[#2F2F2F] disabled:opacity-60">Ejecutar en esta pantalla <ChevronRight size={17}/></button>}<p className="text-center text-[11px] leading-5 text-[#747474]">{questImmersive ? 'Los ejercicios inmersivos requieren Meta Quest Browser y WebXR; la pantalla profesional se usa para supervisar y cerrar la sesión.' : 'Quest se vincula con un código temporal. El profesional continúa autenticado aquí y el paciente no ingresa credenciales.'}</p></div> : <button type="button" disabled={startSupervised.isPending} onClick={start} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#E49A02] text-sm font-black text-white shadow-[0_12px_24px_rgba(11,122,117,0.2)] disabled:opacity-60">{startSupervised.isPending ? 'Iniciando…' : assignment.status === 'started' ? 'Reanudar desde el principio' : 'Comenzar sesión presencial'} <ChevronRight size={18}/></button>}
      </div>
    </article>}
  </div>
}
