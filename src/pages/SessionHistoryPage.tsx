import { Activity, CalendarDays, ChevronLeft, Clock3, ClipboardList, MessageSquareText, MonitorPlay, Stethoscope } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { exercisePurposeLabels } from '../features/exercise/compatibility'
import { usePatient } from '../features/patients/hooks'
import { buildExerciseHistory, exerciseDoseLabel, formatActiveTime, type ExerciseHistoryStatus } from '../features/sessions/history'
import { useSessionAssignments, useTreatmentCycles } from '../features/sessions/hooks'
import { sessionDurationLabel } from '../features/sessions/repository'

const displayModeLabels = {
  standard: 'Pantalla 2D',
  vr_box: 'VR Box',
  quest_browser: 'Meta Quest',
} as const

const postureLabels = {
  seated: 'Sentado',
  standing: 'De pie',
  walking: 'Marcha',
} as const

const surfaceLabels = {
  firm: 'superficie firme',
  unstable: 'superficie inestable',
} as const

const historyStatus: Record<ExerciseHistoryStatus, { label: string; tone: string }> = {
  completed: { label: 'Completado', tone: 'border-[#B9D9C5] bg-[#F0F8F3] text-[#28613D]' },
  partial: { label: 'Parcial', tone: 'border-[#E8CE99] bg-[#FFF7E8] text-[#8A5B00]' },
  skipped: { label: 'No realizado', tone: 'border-[#DEDCD9] bg-[#F1EFEC] text-[#5E5E5E]' },
  recorded: { label: 'Realizado · registro manual', tone: 'border-[#B9D9C5] bg-[#F0F8F3] text-[#28613D]' },
  unavailable: { label: 'Sin detalle individual', tone: 'border-[#DEDCD9] bg-white text-[#747474]' },
}

function formatSessionDate(value: string) {
  if (!value) return 'Fecha no registrada'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10)
  return new Intl.DateTimeFormat('es-UY', { dateStyle: 'long', timeStyle: value.includes('T') ? 'short' : undefined }).format(parsed)
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-2xl bg-[#F7F6F4] p-4"><p className="text-[10px] font-black uppercase tracking-[.12em] text-[#747474]">{label}</p><p className="mt-2 text-base font-black text-[#2F2F2F]">{value}</p>{detail && <p className="mt-1 text-[11px] leading-4 text-[#747474]">{detail}</p>}</div>
}

export function SessionHistoryPage() {
  const { patientId = '', assignmentId = '' } = useParams()
  const { data: patient, isPending: patientPending } = usePatient(patientId)
  const { data: assignments = [], isPending: assignmentsPending, error } = useSessionAssignments(patientId)
  const { data: cycles = [] } = useTreatmentCycles(patientId)
  const assignment = assignments.find((item) => item.id === assignmentId)

  if (patientPending || assignmentsPending) return <p className="text-sm text-[#747474]">Cargando historial de la sesión…</p>
  if (error) return <p role="alert" className="rounded-2xl bg-[#fceced] p-4 text-sm font-bold text-[#a94952]">No fue posible cargar el historial de la sesión.</p>
  if (!patient || !assignment) return <div className="space-y-4"><p className="text-sm text-[#747474]">La sesión no existe o no pertenece a este paciente.</p><Link to={`/app/pacientes/${patientId}`} className="text-sm font-black text-[#E49A02]">Volver al paciente</Link></div>

  const exercises = buildExerciseHistory(assignment)
  const cycle = cycles.find((item) => item.id === assignment.treatmentCycleId)
  const performedAt = assignment.actualPerformedAt || assignment.completedAt || assignment.availableFrom
  const hasRecordedResult = ['completed', 'partial', 'interrupted'].includes(assignment.status) || assignment.activeSeconds > 0 || assignment.initialDiscomfort !== null
  const completedExercises = exercises.filter((item) => item.status === 'completed' || item.status === 'recorded').length
  const partialExercises = exercises.filter((item) => item.status === 'partial').length
  const omittedExercises = exercises.filter((item) => item.status === 'skipped').length

  return <div className="space-y-7">
    <Link to={`/app/pacientes/${patient.id}`} className="inline-flex items-center gap-2 text-xs font-black text-[#E49A02]"><ChevronLeft size={16}/> Volver al perfil de {patient.fullName}</Link>
    <PageHeader
      eyebrow="Historial de sesión"
      title={assignment.title}
      description={`${patient.fullName} · ${assignment.mode === 'home' ? 'Domiciliaria' : assignment.kind === 'free_note' ? 'Presencial libre' : 'Presencial'} · ${formatSessionDate(performedAt)}`}
      actions={<StatusBadge status={assignment.status}/>} />

    <section aria-label="Carácter del historial" className="flex gap-4 rounded-2xl border border-[#D9E7DF] bg-[#F0F8F3] p-5">
      <ClipboardList className="mt-0.5 shrink-0 text-[#28613D]" size={22}/>
      <div><p className="text-sm font-black text-[#28613D]">Historial clínico de solo lectura</p><p className="mt-1 text-xs leading-5 text-[#496451]">Podés consultar qué estaba indicado, qué se registró como realizado y todos los comentarios. Abrir esta pantalla no reinicia ni modifica la sesión.</p></div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen de la sesión">
      <article className="rounded-2xl border border-[#E9E7E7] bg-white p-5"><CalendarDays className="text-[#E49A02]" size={20}/><p className="mt-4 text-[10px] font-black uppercase tracking-[.12em] text-[#747474]">Fecha realizada</p><p className="mt-2 text-sm font-black leading-5 text-[#2F2F2F]">{formatSessionDate(performedAt)}</p></article>
      <article className="rounded-2xl border border-[#E9E7E7] bg-white p-5"><MonitorPlay className="text-[#E49A02]" size={20}/><p className="mt-4 text-[10px] font-black uppercase tracking-[.12em] text-[#747474]">Modalidad</p><p className="mt-2 text-sm font-black text-[#2F2F2F]">{assignment.mode === 'home' ? 'Domiciliaria' : assignment.kind === 'free_note' ? 'Presencial libre' : 'Presencial supervisada'}</p>{assignment.retrospectiveDevice && <p className="mt-1 text-[11px] text-[#747474]">{assignment.retrospectiveDevice}</p>}</article>
      <article className="rounded-2xl border border-[#E9E7E7] bg-white p-5"><Clock3 className="text-[#E49A02]" size={20}/><p className="mt-4 text-[10px] font-black uppercase tracking-[.12em] text-[#747474]">Tiempo</p><p className="mt-2 text-sm font-black text-[#2F2F2F]">{assignment.activeSeconds > 0 ? `${formatActiveTime(assignment.activeSeconds)} activos` : 'Sin tiempo activo registrado'}</p><p className="mt-1 text-[11px] text-[#747474]">{sessionDurationLabel(assignment)} previstos</p></article>
      <article className="rounded-2xl border border-[#E9E7E7] bg-white p-5"><Activity className="text-[#E49A02]" size={20}/><p className="mt-4 text-[10px] font-black uppercase tracking-[.12em] text-[#747474]">Ciclo</p><p className="mt-2 text-sm font-black text-[#2F2F2F]">{cycle?.label ?? 'Ciclo no identificado'}</p>{assignment.repeatSeriesId && <p className="mt-1 text-[11px] text-[#747474]">Fecha {assignment.repeatSeriesPosition ?? '—'} de {assignment.repeatSeriesSize ?? '—'} de la serie</p>}</article>
    </section>

    {assignment.instructions && <section className="rounded-2xl border border-[#E9E7E7] bg-white p-6" aria-labelledby="session-instructions-title"><h2 id="session-instructions-title" className="text-lg font-black text-[#171717]">Indicaciones originales</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#5E5E5E]">{assignment.instructions}</p></section>}

    <section className="rounded-2xl border border-[#E9E7E7] bg-white p-6" aria-labelledby="session-exercises-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 id="session-exercises-title" className="text-lg font-black text-[#171717]">Ejercicios de la sesión</h2><p className="mt-1 text-xs leading-5 text-[#747474]">Se conserva la configuración exacta que tenía la sesión en ese momento.</p></div>{assignment.kind !== 'free_note' && <p className="text-xs font-bold text-[#747474]">{exercises.length} indicados · {completedExercises} realizados{partialExercises ? ` · ${partialExercises} parciales` : ''}{omittedExercises ? ` · ${omittedExercises} no realizados` : ''}</p>}</div>
      {assignment.kind === 'free_note' ? <div className="mt-5 rounded-2xl bg-[#F7F6F4] p-5 text-sm leading-6 text-[#5E5E5E]">Esta fue una sesión presencial de registro libre, sin ejercicios predefinidos. El trabajo realizado figura en el registro profesional.</div> : <ol className="mt-5 space-y-4">{exercises.map((item) => {
        const status = historyStatus[item.status]
        const completedRounds = item.events.filter((event) => event.type === 'exercise_completed').length
        const activeSeconds = item.events.reduce((total, event) => total + Number(event.active_seconds ?? 0), 0)
        const reportedRepetitions = item.events.reduce((total, event) => total + Number(event.reported_repetitions ?? 0), 0)
        return <li key={`${assignment.id}-${item.index}`} className="rounded-2xl border border-[#E9E7E7] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.12em] text-[#A36B00]">Ejercicio {item.index + 1}</p><h3 className="mt-1 text-base font-black text-[#2F2F2F]">{item.exercise.name}</h3><p className="mt-1 text-xs text-[#747474]">{exercisePurposeLabels[item.exercise.purpose]}</p></div><span className={`inline-flex w-fit rounded-full border px-3 py-1 text-[10px] font-black ${status.tone}`}>{status.label}</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="Dosis indicada" value={exerciseDoseLabel(item.exercise)} detail={item.exercise.restSeconds ? `${item.exercise.restSeconds} s de pausa` : 'Sin pausa indicada'}/><Metric label="Posición" value={postureLabels[item.exercise.posture]} detail={surfaceLabels[item.exercise.surface]}/><Metric label="Presentación" value={displayModeLabels[item.exercise.displayMode]} detail={item.exercise.advanceMode === 'automatic' ? 'Avance automático' : 'Confirmación manual'}/></div>
          {item.exercise.patientInstruction && <p className="mt-4 rounded-xl bg-[#F7F6F4] px-4 py-3 text-xs leading-5 text-[#5E5E5E]"><strong>Indicación:</strong> {item.exercise.patientInstruction}</p>}
          {item.events.length > 0 && item.status !== 'recorded' && <p className="mt-3 text-xs font-bold text-[#5E5E5E]">Registro: {completedRounds} de {item.exercise.rounds} {item.exercise.rounds === 1 ? 'serie completada' : 'series completadas'}{activeSeconds ? ` · ${formatActiveTime(activeSeconds)} activos` : ''}{reportedRepetitions ? ` · ${reportedRepetitions} repeticiones informadas` : ''}.</p>}
          {item.omissionReason && <p className="mt-3 rounded-xl bg-[#FFF7E8] px-4 py-3 text-xs font-bold leading-5 text-[#8A5B00]">Motivo: {item.omissionReason}</p>}
          {item.status === 'unavailable' && <p className="mt-3 text-xs leading-5 text-[#747474]">Este ejercicio integraba el plan, pero el registro histórico no contiene un resultado individual. El resultado general y los comentarios de la sesión se muestran debajo.</p>}
        </li>
      })}</ol>}
    </section>

    <section className="grid gap-5 lg:grid-cols-2" aria-label="Resultados y comentarios">
      <article className="rounded-2xl border border-[#E9E7E7] bg-white p-6"><div className="flex items-center gap-3"><Activity className="text-[#E49A02]" size={21}/><h2 className="text-lg font-black text-[#171717]">Resultado general</h2></div>{hasRecordedResult && !assignment.retrospectiveWithoutMetrics ? <div className="mt-5 grid gap-3 sm:grid-cols-2"><Metric label="Malestar inicial" value={assignment.initialDiscomfort === null ? 'No informado' : `${assignment.initialDiscomfort}/10`}/><Metric label="Máximo" value={assignment.peakDiscomfort == null ? 'No informado' : `${assignment.peakDiscomfort}/10`}/><Metric label="Malestar final" value={assignment.finalDiscomfort === null ? 'No informado' : `${assignment.finalDiscomfort}/10`}/><Metric label="Dificultad percibida" value={assignment.perceivedDifficulty === null ? 'No informada' : `${assignment.perceivedDifficulty}/5`}/>{assignment.recoveryMinutes != null && <Metric label="Recuperación" value={`${assignment.recoveryMinutes} min`}/>}</div> : <p className="mt-5 rounded-2xl bg-[#F7F6F4] p-4 text-sm leading-6 text-[#747474]">No se registraron métricas numéricas para esta sesión.</p>}{assignment.delayedResponse && <p className="mt-4 text-xs leading-5 text-[#5E5E5E]"><strong>Respuesta tardía:</strong> {assignment.delayedResponse}</p>}{assignment.progressionDecision && <p className="mt-2 text-xs leading-5 text-[#5E5E5E]"><strong>Decisión de progresión:</strong> {assignment.progressionDecision}</p>}</article>
      <article className="rounded-2xl border border-[#E9E7E7] bg-white p-6"><div className="flex items-center gap-3"><MessageSquareText className="text-[#E49A02]" size={21}/><h2 className="text-lg font-black text-[#171717]">Comentarios</h2></div><div className="mt-5 space-y-4"><div className="rounded-2xl bg-[#FFF7E8] p-4"><p className="text-[10px] font-black uppercase tracking-[.12em] text-[#8A5B00]">Comentario del paciente</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#5E5E5E]">{assignment.patientComment || 'No dejó comentarios en esta sesión.'}</p></div><div className="rounded-2xl bg-[#F7F6F4] p-4"><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.12em] text-[#5E5E5E]"><Stethoscope size={14}/> Registro profesional</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#5E5E5E]">{assignment.professionalObservation || 'No hay observaciones profesionales registradas.'}</p></div></div></article>
    </section>

    {assignment.status === 'omitted' && <p className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-5 text-sm font-bold text-[#8A5B00]">Sesión no realizada: {assignment.cancellationReason || 'sin motivo registrado.'}</p>}
    {assignment.status === 'revoked' && <p className="rounded-2xl border border-[#DEDCD9] bg-[#F1EFEC] p-5 text-sm font-bold text-[#5E5E5E]">Sesión anulada: {assignment.revokedReason || 'sin motivo registrado.'}</p>}
  </div>
}
