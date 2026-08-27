import { CalendarDays, CalendarX2, ChevronLeft, ClipboardCheck, Copy, FileImage, FileText, Pencil, PlayCircle, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { RevokeSessionDialog } from '../components/RevokeSessionDialog'
import { CancelSessionDialog } from '../components/CancelSessionDialog'
import { RepeatSessionDialog } from '../components/RepeatSessionDialog'
import { RetrospectiveSessionDialog } from '../components/RetrospectiveSessionDialog'
import { StatusBadge } from '../components/StatusBadge'
import { usePatient } from '../features/patients/hooks'
import { PatientDetailsCard } from '../features/patients/PatientDetailsCard'
import { useCancelSessionAssignment, useRecordRetrospectiveSession, useRepeatSessionAssignment, useRevokeSessionAssignment, useSessionAssignments, useTreatmentCycles } from '../features/sessions/hooks'
import { canCancelSessionAssignment, canManageSessionAssignment, canRepeatSessionAssignment, canRevokeSessionAssignment, sessionDurationLabel, type SessionAssignmentRecord } from '../features/sessions/repository'
import { groupSessionAssignments } from '../features/sessions/repetition'
import { PatientDocumentsPanel } from '../features/documents/PatientDocumentsPanel'
import { usePatientDocuments } from '../features/documents/hooks'
import { cycleStudyPhaseLabels } from '../features/documents/types'
import { PatientAssessmentsPanel } from '../features/assessments/PatientAssessmentsPanel'
import { usePatientAssessments } from '../features/assessments/hooks'
import { assessmentPhaseLabels } from '../features/assessments/questions'
import { useClinicalEpisodes } from '../features/clinicalEpisodes/hooks'
import { pathologyLabel } from '../features/clinicalEpisodes/catalog'
import { useClinicalStudies } from '../features/studies/hooks'
import { buildPatientStudyOverview } from '../features/studies/patientOverview'
import type { ClinicalStudySummary } from '../features/studies/types'

function PosturographySlot({ phase, study, patientId, cycleId }: { phase: 'initial' | 'final'; study?: ClinicalStudySummary; patientId: string; cycleId: string }) {
  const title = `POSTUROGRAFÍA ${phase === 'initial' ? 'INICIAL' : 'FINAL'}`

  if (study) return <Link to={`/app/estudios/${study.id}/revisar`} className="rounded-2xl border-2 border-[#B9D9C5] bg-[#F0F8F3] p-6 transition hover:border-[#28613D]"><div className="flex items-start justify-between gap-3"><FileImage className="text-[#28613D]" size={25}/><StatusBadge status={study.status}/></div><strong className="mt-4 block text-sm font-black text-[#171717]">{title} CARGADA</strong><span className="mt-2 block truncate text-xs leading-5 text-[#496451]">{study.performedAt.slice(0, 10)} · {study.sourceFilename}</span><span className="mt-4 block text-xs font-black text-[#28613D]">Ver estudio cargado →</span></Link>

  if (!cycleId) return <article className="rounded-2xl border-2 border-[#DEDCD9] bg-[#F7F6F4] p-6"><FileImage className="text-[#747474]" size={25}/><strong className="mt-4 block text-sm font-black text-[#171717]">{title}</strong><span className="mt-2 block text-xs leading-5 text-[#747474]">Primero iniciá un ciclo de tratamiento para habilitar este espacio.</span></article>

  return <Link to={`/app/estudios/importar?patient=${patientId}&kind=bap&phase=${phase}&cycle=${cycleId}`} className="rounded-2xl border-2 border-[#E8CE99] bg-[#FFF7E8] p-6 transition hover:border-[#E49A02]"><FileImage className="text-[#E49A02]" size={25}/><strong className="mt-4 block text-sm font-black text-[#171717]">{title}</strong><span className="mt-2 block text-xs leading-5 text-[#747474]">{phase === 'initial' ? 'El espacio inicial está disponible para este ciclo.' : 'El espacio final está disponible para la reevaluación del ciclo.'}</span><span className="mt-4 block text-xs font-black text-[#E49A02]">Cargar estudio {phase === 'initial' ? 'inicial' : 'final'} →</span></Link>
}

export function VestibularStudySlot({ studies, patientId, cycleId }: { studies: ClinicalStudySummary[]; patientId: string; cycleId: string }) {
  const latestStudy = [...studies].sort((first, second) => second.performedAt.localeCompare(first.performedAt))[0]

  if (latestStudy) return <Link to={`/app/estudios/${latestStudy.id}/revisar`} className="rounded-2xl border-2 border-[#B9D9C5] bg-[#F0F8F3] p-6 transition hover:border-[#28613D]"><div className="flex items-start justify-between gap-3"><FileText className="text-[#28613D]" size={25}/><StatusBadge status={latestStudy.status}/></div><strong className="mt-4 block text-sm font-black text-[#171717]">{studies.length === 1 ? 'INFORME VESTIBULAR / vHIT CARGADO' : 'ESTUDIOS VESTIBULARES / vHIT CARGADOS'}</strong><span className="mt-2 block truncate text-xs leading-5 text-[#496451]">{latestStudy.performedAt.slice(0, 10)} · {latestStudy.sourceFilename}</span>{studies.length > 1 && <span className="mt-2 block text-xs leading-5 text-[#496451]">{studies.length} informes cargados · se muestra el más reciente.</span>}<span className="mt-4 block text-xs font-black text-[#28613D]">{studies.length === 1 ? 'Ver estudio cargado →' : 'Ver último estudio cargado →'}</span></Link>

  return <Link to={`/app/estudios/importar?patient=${patientId}&kind=vestibular${cycleId ? `&cycle=${cycleId}` : ''}`} className="rounded-2xl border-2 border-[#E9E7E7] bg-[#f8f8fc] p-6 transition hover:border-[#5E5E5E]"><FileText className="text-[#5E5E5E]" size={25}/><strong className="mt-4 block text-sm font-black text-[#171717]">ESTUDIOS VESTIBULARES, vHIT E INFORMES</strong><span className="mt-2 block text-xs leading-5 text-[#747474]">Informes, HIMP/SHIMP, oculomotores, órdenes, gráficos y estudios multipágina.</span><span className="mt-4 block text-xs font-black text-[#5E5E5E]">Cargar y extraer localmente →</span></Link>
}

export function PatientProfilePage() {
  const { patientId } = useParams()
  const location = useLocation()
  const { data: patient, isPending } = usePatient(patientId ?? '')
  const { data: cycles = [] } = useTreatmentCycles(patientId ?? '')
  const { data: assignments = [] } = useSessionAssignments(patientId ?? '')
  const { data: documents = [] } = usePatientDocuments(patientId ?? '')
  const { data: assessments = [] } = usePatientAssessments(patientId ?? '')
  const { data: clinicalEpisodes = [] } = useClinicalEpisodes(patientId ?? '')
  const { data: studies = [], isPending: studiesPending, error: studiesError } = useClinicalStudies()
  const repeatAssignment = useRepeatSessionAssignment(patientId ?? '')
  const revokeAssignment = useRevokeSessionAssignment(patientId ?? '')
  const retrospectiveCompletion = useRecordRetrospectiveSession(patientId ?? '')
  const cancelAssignment = useCancelSessionAssignment(patientId ?? '')
  const [actionNotice, setActionNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingRevocation, setPendingRevocation] = useState<SessionAssignmentRecord | null>(null)
  const [pendingRetrospective, setPendingRetrospective] = useState<SessionAssignmentRecord | null>(null)
  const [pendingCancellation, setPendingCancellation] = useState<SessionAssignmentRecord | null>(null)
  const [pendingRepeat, setPendingRepeat] = useState<SessionAssignmentRecord | null>(null)
  const activeCycle = cycles.find((cycle) => cycle.status === 'active')
  const activeEpisode = clinicalEpisodes.find((episode) => episode.treatmentCycleId === activeCycle?.id)
  const now = new Date().toISOString()
  const activeAssignment = assignments.find((assignment) => assignment.status === 'started' || (assignment.status === 'assigned' && assignment.availableFrom <= now && (!assignment.availableUntil || assignment.availableUntil >= now)))
  const assignmentGroups = groupSessionAssignments(assignments)
  const activePermissions = documents.filter((document) => document.sharedWithPatient).length
  const studyOverview = buildPatientStudyOverview(studies, patientId ?? '', activeCycle?.id ?? '')

  if (isPending) return <p className="text-sm text-[#747474]">Cargando paciente…</p>

  if (!patient) {
    return <p className="text-sm text-[#747474]">Paciente no encontrado.</p>
  }

  const repeatAsHome = async (assignment: SessionAssignmentRecord, input: { dates: string[]; seriesId: string }) => {
    try {
      setActionError('')
      const createdIds = await repeatAssignment.mutateAsync({ assignment, ...input })
      setPendingRepeat(null)
      setActionNotice(createdIds.length === 1 ? 'Se programó una nueva sesión domiciliaria desde cero.' : `Se programaron ${createdIds.length} sesiones domiciliarias independientes.`)
    } catch (error) {
      setActionNotice('')
      setActionError(error instanceof Error ? error.message : 'No fue posible programar la repetición domiciliaria.')
    }
  }

  const completeRetrospectively = async (assignment: SessionAssignmentRecord, details: Parameters<typeof retrospectiveCompletion.mutateAsync>[0]['details']) => {
    try {
      setActionError('')
      await retrospectiveCompletion.mutateAsync({ assignment, details })
      setPendingRetrospective(null)
      setActionNotice('La sesión quedó finalizada y etiquetada como registrada retrospectivamente.')
    } catch (error) {
      setActionNotice('')
      setActionError(error instanceof Error ? error.message : 'No fue posible finalizar la sesión retrospectivamente.')
    }
  }

  const cancelPlannedSession = async (assignment: SessionAssignmentRecord, reason: string) => {
    try {
      setActionError('')
      await cancelAssignment.mutateAsync({ assignment, reason })
      setPendingCancellation(null)
      setActionNotice('La sesión quedó registrada como no realizada/cancelada.')
    } catch (error) {
      setActionNotice('')
      setActionError(error instanceof Error ? error.message : 'No fue posible cancelar la sesión.')
    }
  }

  const timelineEvents = [
    ...assignmentGroups.map((group) => {
      const assignment = group.assignments[0]
      if (group.seriesId) return {
        id: group.id,
        date: [...group.assignments].sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0].createdAt,
        label: `Serie programada: ${assignment.title} · ${group.expectedCount} sesiones`,
      }
      return {
        id: `session-${assignment.id}`,
        date: assignment.completedAt || assignment.revokedAt || assignment.createdAt,
        label: assignment.status === 'completed'
          ? `Sesión completada: ${assignment.title}`
          : assignment.status === 'omitted'
            ? `Sesión cancelada: ${assignment.title}`
          : assignment.status === 'partial'
            ? `Sesión parcial: ${assignment.title}`
            : assignment.status === 'revoked'
              ? `Sesión anulada: ${assignment.title}`
              : `Sesión asignada: ${assignment.title}`,
      }
    }),
    ...documents.map((document) => ({
      id: `document-${document.id}`,
      date: document.createdAt || `${document.documentDate}T12:00:00`,
      label: `Documento cargado${document.documentType === 'posturography' && document.cyclePhase && document.cyclePhase !== 'unspecified' ? ` · posturografía ${cycleStudyPhaseLabels[document.cyclePhase].toLowerCase()}` : ''}: ${document.originalFilename}`,
    })),
    ...assessments.map((assessment) => ({
      id: `assessment-${assessment.id}`,
      date: `${assessment.assessmentDate}T12:00:00`,
      label: `Evaluación ${assessmentPhaseLabels[assessment.phase].toLowerCase()} registrada`,
    })),
  ].filter((event) => Boolean(event.date)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)

  const revoke = async (assignment: (typeof assignments)[number], reason: string) => {
    try {
      setActionError('')
      await revokeAssignment.mutateAsync({ assignment, reason })
      setPendingRevocation(null)
      setActionNotice('La sesión fue anulada y su registro quedó conservado.')
    } catch (error) {
      setActionNotice('')
      setActionError(error instanceof Error ? error.message : 'No fue posible anular la sesión.')
    }
  }

  return (
    <div className="space-y-7">
      {(location.state as {notice?:string}|null)?.notice && <p className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] px-4 py-3 text-sm font-bold text-[#A36B00]">{(location.state as {notice:string}).notice}</p>}
      {actionNotice && <p className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] px-4 py-3 text-sm font-bold text-[#A36B00]">{actionNotice}</p>}
      {actionError && <p role="alert" className="rounded-2xl bg-[#fceced] px-4 py-3 text-sm font-bold text-[#a94952]">{actionError}</p>}
      <Link to="/app/pacientes" className="inline-flex items-center gap-2 text-xs font-black text-[#E49A02]">
        <ChevronLeft size={16} /> Volver a pacientes
      </Link>
      <PageHeader
        eyebrow="Perfil clínico"
        title={patient.fullName}
        description={`${patient.age} años · ${patient.insurer} · Última actividad: ${patient.lastActivity}`}
        actions={
          <>
            <Link to={`/app/pacientes/${patient.id}/editar`} className="inline-flex items-center gap-2 rounded-2xl border border-[#E9E7E7] bg-white px-4 py-3 text-sm font-black text-[#2F2F2F]"><Pencil size={17}/> Editar</Link>
            <Link to={`/app/estudios/importar?patient=${patient.id}`} className="inline-flex items-center gap-2 rounded-2xl border border-[#E9E7E7] bg-white px-4 py-3 text-sm font-black text-[#2F2F2F]">
              <FileImage size={17} /> Cargar estudio
            </Link>
            <Link to={`/app/pacientes/${patient.id}/sesiones/nueva`} className="inline-flex items-center gap-2 rounded-2xl bg-[#E49A02] px-4 py-3 text-sm font-black text-white">
              <Plus size={17} /> Crear sesión
            </Link>
            <Link to={`/app/pacientes/${patient.id}/episodio${activeCycle ? `?cycle=${activeCycle.id}` : ''}`} className="inline-flex items-center gap-2 rounded-2xl border border-[#D9E7DF] bg-[#F0F8F3] px-4 py-3 text-sm font-black text-[#28613D]"><ClipboardCheck size={17}/> Episodio clínico</Link>
            <Link to={`/app/pacientes/${patient.id}/informe`} className="inline-flex items-center gap-2 rounded-2xl border border-[#E9E7E7] bg-white px-4 py-3 text-sm font-black text-[#2F2F2F]"><FileText size={17}/> Realizar informe</Link>
          </>
        }
      />

      <PatientDetailsCard patient={patient} activeCycle={activeCycle} activePermissions={activePermissions}/>

      <Link to={`/app/pacientes/${patient.id}/episodio${activeCycle ? `?cycle=${activeCycle.id}` : ''}`} className="flex flex-col gap-5 rounded-2xl border border-[#D9E7DF] bg-[#F0F8F3] p-6 transition hover:border-[#9FC9AE] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-[#28613D]"><ClipboardCheck size={23}/></span><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#496451]">Clínica actual</p><h2 className="mt-2 text-xl font-black text-[#171717]">{activeEpisode ? pathologyLabel(activeEpisode.diagnosisCode) : 'Clínica pendiente de registro'}</h2><p className="mt-2 text-xs leading-5 text-[#496451]">{activeEpisode ? `${activeCycle?.label ?? 'Ciclo actual'} · ${activeEpisode.diagnosisSource || activeEpisode.measuredImpairments || 'Abrí el episodio para consultar la evaluación completa.'}` : activeCycle ? 'Registrá el diagnóstico o condición clínica del ciclo para verla apenas abras al paciente.' : 'Iniciá un ciclo y registrá el episodio clínico del paciente.'}</p></div></div>
        <div className="flex shrink-0 items-center gap-3">{activeEpisode && <StatusBadge status={activeEpisode.status}/>}<span className="text-xs font-black text-[#28613D]">{activeEpisode ? 'Ver episodio →' : 'Registrar clínica →'}</span></div>
      </Link>

      <section className="grid gap-4 lg:grid-cols-3" aria-label="Carga privada de estudios">
        <PosturographySlot phase="initial" study={studyOverview.initialPosturography} patientId={patient.id} cycleId={activeCycle?.id ?? ''}/>
        <PosturographySlot phase="final" study={studyOverview.finalPosturography} patientId={patient.id} cycleId={activeCycle?.id ?? ''}/>
        <VestibularStudySlot studies={studyOverview.reports} patientId={patient.id} cycleId={activeCycle?.id ?? ''}/>
      </section>

      <section className="rounded-2xl border border-[#E9E7E7] bg-white p-6" aria-labelledby="loaded-studies-title">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="loaded-studies-title" className="text-lg font-black text-[#171717]">Estudios e informes cargados</h2><p className="mt-1 text-xs leading-5 text-[#747474]">Consultá lo ya registrado antes de iniciar una carga nueva.</p></div><Link to={`/app/estudios/importar?patient=${patient.id}`} className="text-xs font-black text-[#E49A02]">Cargar otro informe</Link></div>
        {studiesPending ? <p className="mt-5 text-sm text-[#747474]">Cargando estudios…</p> : studiesError ? <p role="alert" className="mt-5 text-sm font-bold text-[#a94952]">No fue posible cargar los estudios del paciente.</p> : studyOverview.patientStudies.length === 0 ? <p className="mt-5 rounded-2xl bg-[#F7F6F4] p-4 text-sm text-[#747474]">Todavía no hay estudios ni informes cargados.</p> : <div className="mt-5 divide-y divide-[#E9E7E7]">{studyOverview.patientStudies.map((study) => <Link key={study.id} to={`/app/estudios/${study.id}/revisar`} className="flex flex-col gap-3 py-4 transition hover:bg-[#F7F6F4] sm:flex-row sm:items-center sm:justify-between sm:px-3"><div className="min-w-0"><p className="text-sm font-black text-[#2F2F2F]">{study.studyType === 'posturography' ? `Posturografía${study.cyclePhase !== 'unspecified' ? ` · ${cycleStudyPhaseLabels[study.cyclePhase]}` : ''}` : 'Informe vestibular / vHIT'}</p><p className="mt-1 truncate text-xs text-[#747474]">{study.performedAt.slice(0, 10)} · {study.sourceFilename}{study.treatmentCycleId === activeCycle?.id ? ' · ciclo actual' : ''}</p></div><div className="flex items-center gap-3"><StatusBadge status={study.status}/><span className="text-xs font-black text-[#E49A02]">Ver →</span></div></Link>)}</div>}
      </section>

      <section>
        <div className="grid gap-5 sm:grid-cols-2">
          <article className="rounded-2xl border border-[#E9E7E7] bg-white p-6">
            <CalendarDays className="text-[#E49A02]" size={22} />
            <h2 className="mt-5 text-lg font-black text-[#171717]">Ciclo de tratamiento</h2>
            <p className="mt-2 text-sm leading-6 text-[#747474]">{activeCycle?.objectives || 'Ingreso, evaluación, sesiones e informe final se conservan dentro del mismo ciclo.'}</p>
            {activeCycle?<div className="mt-6 rounded-2xl bg-[#F7F6F4] p-4 text-xs text-[#747474]">{activeCycle.label} · Inicio: {activeCycle.startedOn} · {assignments.filter(item=>item.treatmentCycleId===activeCycle.id).length} sesiones</div>:<Link to={`/app/pacientes/${patient.id}/ciclos/nuevo`} className="mt-6 inline-flex rounded-2xl border border-[#E9E7E7] px-4 py-3 text-xs font-black text-[#E49A02]">Iniciar primer ciclo</Link>}
            {activeCycle && <Link to={`/app/pacientes/${patient.id}/episodio?cycle=${activeCycle.id}`} className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#D9E7DF] bg-[#F0F8F3] p-4 text-xs text-[#28613D]"><span><strong className="block">{activeEpisode ? pathologyLabel(activeEpisode.diagnosisCode) : 'Completar episodio clínico'}</strong><span className="mt-1 block">{activeEpisode ? activeEpisode.status === 'reviewed' ? 'Confirmado y disponible para planificar' : 'Borrador pendiente de revisión' : 'Anamnesis, déficits y metas del ciclo'}</span></span><ClipboardCheck className="shrink-0" size={18}/></Link>}
          </article>
          <article className="rounded-2xl border border-[#E9E7E7] bg-white p-6">
            <PlayCircle className="text-[#E49A02]" size={22} />
            <h2 className="mt-5 text-lg font-black text-[#171717]">Sesión asignada</h2>
            <p className="mt-2 text-sm leading-6 text-[#747474]">{activeAssignment ? activeAssignment.kind === 'free_note' ? `${activeAssignment.title} · registro presencial libre` : `${activeAssignment.title} · ${sessionDurationLabel(activeAssignment)} · ${activeAssignment.exercises.length} ejercicios` : 'No hay una sesión activa para hoy.'}</p>
            <div className="mt-6 rounded-2xl bg-[#FFF7E8] p-4 text-xs font-bold text-[#A36B00]">Confirmación manual fuera del visor · avance automático en VR Box</div>
          </article>
          <article className="rounded-2xl border border-[#E9E7E7] bg-white p-6 sm:col-span-2">
            <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-black text-[#171717]">Sesiones asignadas</h2><Link to={`/app/pacientes/${patient.id}/sesiones/nueva`} className="text-xs font-black text-[#E49A02]">Nueva sesión</Link></div>
            <div className="mt-5 divide-y divide-[#E9E7E7]">{assignments.length===0?<p className="py-4 text-sm text-[#747474]">Todavía no hay sesiones.</p>:assignmentGroups.map((group) => group.seriesId ? <div key={group.id} className="py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-[#2F2F2F]">{group.assignments[0].title}</p><span className="rounded-full bg-[#FFF1D5] px-2 py-1 text-[9px] font-black uppercase text-[#8A5B00]">Serie programada</span></div><p className="mt-1 text-xs text-[#747474]">{group.expectedCount} fechas · {group.realizedCount} de {group.expectedCount} realizadas · {(group.assignments[0].availableFrom).slice(0,10)} a {(group.assignments.at(-1)?.availableFrom ?? group.assignments[0].availableFrom).slice(0,10)}</p></div><button type="button" disabled={repeatAssignment.isPending} onClick={()=>{setActionError('');setPendingRepeat(group.assignments[0])}} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#E9E7E7] bg-white px-3 py-2 text-xs font-black text-[#2F2F2F] disabled:opacity-60"><Copy size={14}/> Repetir / programar</button></div>
              <details className="mt-4 rounded-2xl bg-[#F7F6F4] px-4"><summary className="cursor-pointer py-3 text-xs font-black text-[#8A5B00]">Ver las {group.assignments.length} fechas y sus resultados</summary><div className="divide-y divide-[#DEDCD9]">{group.assignments.map((assignment) => {
                const canFinishPast = ['assigned', 'started'].includes(assignment.status) && assignment.availableFrom.slice(0, 10) < new Date().toISOString().slice(0, 10)
                return <div key={assignment.id} className={`flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between ${assignment.status==='revoked'?'opacity-60 grayscale':''}`}>
                  <div className="min-w-0"><p className="text-xs font-black text-[#2F2F2F]">Fecha {assignment.repeatSeriesPosition ?? 1} de {assignment.repeatSeriesSize ?? group.expectedCount} · {assignment.availableFrom.slice(0,10)}</p>{assignment.patientComment&&<p className="mt-2 text-xs leading-5 text-[#747474]"><strong>Comentario del paciente:</strong> {assignment.patientComment}</p>}{assignment.status==='revoked'?<p className="mt-2 rounded-xl bg-[#F1EFEC] px-3 py-2 text-[11px] font-bold leading-5 text-[#5E5E5E]">Motivo de anulación: {assignment.revokedReason || 'Sin motivo disponible.'}</p>:assignment.status==='omitted'?<p className="mt-2 rounded-xl bg-[#FFF7E8] px-3 py-2 text-[11px] font-bold leading-5 text-[#8A5B00]">Motivo de cancelación: {assignment.cancellationReason || 'Sin motivo estructurado.'}</p>:!canManageSessionAssignment(assignment)&&<p className="mt-1 text-[11px] font-bold text-[#8A5B00]">Historial protegido: esta fecha ya registra actividad.</p>}</div>
                  <div className="flex flex-wrap items-center gap-2"><StatusBadge status={assignment.status}/>{canFinishPast&&<button type="button" onClick={()=>{setActionError('');setPendingRetrospective(assignment)}} className="inline-flex items-center gap-2 rounded-xl border border-[#B9D9C5] bg-[#F0F8F3] px-3 py-2 text-xs font-black text-[#28613D]"><ClipboardCheck size={14}/> Marcar como finalizada</button>}{canManageSessionAssignment(assignment)&&<Link to={`/app/pacientes/${patient.id}/sesiones/${assignment.id}/editar`} className="inline-flex items-center gap-2 rounded-xl border border-[#E9E7E7] bg-white px-3 py-2 text-xs font-black text-[#2F2F2F]"><Pencil size={14}/> Editar</Link>}{canCancelSessionAssignment(assignment)&&<button type="button" onClick={()=>{setActionError('');setPendingCancellation(assignment)}} className="inline-flex items-center gap-2 rounded-xl border border-[#E8CE99] bg-white px-3 py-2 text-xs font-black text-[#8A5B00]"><CalendarX2 size={14}/> No realizada</button>}{canRevokeSessionAssignment(assignment)&&<button type="button" onClick={()=>{setActionError('');setPendingRevocation(assignment)}} className="inline-flex items-center gap-2 rounded-xl border border-[#DEDCD9] bg-white px-3 py-2 text-xs font-black text-[#696969]"><Trash2 size={14}/> Anular</button>}</div>
                </div>
              })}</div></details>
            </div> : group.assignments.map((assignment) => {
              const canFinishPast = ['assigned', 'started'].includes(assignment.status) && assignment.availableFrom.slice(0, 10) < new Date().toISOString().slice(0, 10)
              return <div key={assignment.id} className={`flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between ${assignment.status==='revoked'?'opacity-60 grayscale':''}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-[#2F2F2F]">{assignment.title}</p>{assignment.registeredRetrospectively&&<span className="rounded-full bg-[#E7F3EB] px-2 py-1 text-[9px] font-black uppercase text-[#28613D]">Registrada retrospectivamente</span>}{assignment.retrospectiveWithoutMetrics&&<span className="rounded-full bg-[#F1EFEC] px-2 py-1 text-[9px] font-black uppercase text-[#5E5E5E]">Sin métricas retrospectivas</span>}</div>
                  <p className="mt-1 text-xs text-[#747474]">{assignment.mode==='home'?'Domiciliaria':assignment.kind==='free_note'?'Presencial libre':'Presencial'} · {assignment.kind==='free_note'?'sin ejercicios predefinidos':`${assignment.exercises.length} ejercicios`} · {(assignment.actualPerformedAt || assignment.availableFrom).slice(0,10)}{assignment.retrospectiveDevice?` · ${assignment.retrospectiveDevice}`:''}</p>
                  {assignment.professionalObservation&&<p className="mt-2 max-w-2xl whitespace-pre-wrap rounded-xl bg-[#F7F6F4] px-3 py-2 text-xs leading-5 text-[#5E5E5E]"><strong>Registro profesional:</strong> {assignment.professionalObservation}</p>}
                  {assignment.patientComment&&<p className="mt-2 text-xs leading-5 text-[#747474]"><strong>Comentario del paciente:</strong> {assignment.patientComment}</p>}
                  {assignment.status==='revoked'?<p className="mt-2 rounded-xl bg-[#F1EFEC] px-3 py-2 text-[11px] font-bold leading-5 text-[#5E5E5E]">Motivo de anulación: {assignment.revokedReason || 'Sin motivo disponible en el registro anterior.'}{assignment.revokedAt?` · ${new Date(assignment.revokedAt).toLocaleString('es-UY')}`:''}</p>:assignment.status==='omitted'?<p className="mt-2 rounded-xl bg-[#FFF7E8] px-3 py-2 text-[11px] font-bold leading-5 text-[#8A5B00]">Motivo de cancelación: {assignment.cancellationReason || 'Sin motivo estructurado en el registro anterior.'}</p>:!canManageSessionAssignment(assignment)&&<p className="mt-1 text-[11px] font-bold text-[#8A5B00]">Historial protegido: la sesión ya registra actividad.</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2"><StatusBadge status={assignment.status}/>{canFinishPast&&<button type="button" onClick={()=>{setActionError('');setPendingRetrospective(assignment)}} className="inline-flex items-center gap-2 rounded-xl border border-[#B9D9C5] bg-[#F0F8F3] px-3 py-2 text-xs font-black text-[#28613D]"><ClipboardCheck size={14}/> Marcar como finalizada</button>}{canManageSessionAssignment(assignment)&&<Link to={`/app/pacientes/${patient.id}/sesiones/${assignment.id}/editar`} className="inline-flex items-center gap-2 rounded-xl border border-[#E9E7E7] bg-white px-3 py-2 text-xs font-black text-[#2F2F2F]"><Pencil size={14}/> Editar</Link>}{canCancelSessionAssignment(assignment)&&<button type="button" onClick={()=>{setActionError('');setPendingCancellation(assignment)}} className="inline-flex items-center gap-2 rounded-xl border border-[#E8CE99] bg-white px-3 py-2 text-xs font-black text-[#8A5B00]"><CalendarX2 size={14}/> No realizada</button>}{canRevokeSessionAssignment(assignment)&&<button type="button" onClick={()=>{setActionError('');setPendingRevocation(assignment)}} className="inline-flex items-center gap-2 rounded-xl border border-[#DEDCD9] bg-white px-3 py-2 text-xs font-black text-[#696969]"><Trash2 size={14}/> Anular</button>}{assignment.mode==='in_person'&&['assigned','started'].includes(assignment.status)&&<Link to={`/app/pacientes/${patient.id}/sesiones/${assignment.id}/presencial`} className="inline-flex items-center gap-2 rounded-xl bg-[#E49A02] px-3 py-2 text-xs font-black text-white"><PlayCircle size={15}/>{assignment.kind==='free_note'?'Registrar sesión':assignment.status==='started'?'Reanudar desde el principio':'Comenzar sesión presencial'}</Link>}{canRepeatSessionAssignment(assignment)&&<button type="button" disabled={repeatAssignment.isPending} onClick={()=>{setActionError('');setPendingRepeat(assignment)}} className="inline-flex items-center gap-2 rounded-xl border border-[#E9E7E7] bg-white px-3 py-2 text-xs font-black text-[#2F2F2F] disabled:opacity-60"><Copy size={14}/> Repetir / programar</button>}</div>
              </div>
            }) )}</div>
          </article>
          <PatientDocumentsPanel patientId={patient.id}/>
          <PatientAssessmentsPanel patientId={patient.id} cycleId={activeCycle?.id??''}/>
          <article className="rounded-2xl border border-[#E9E7E7] bg-white p-6 sm:col-span-2">
            <h2 className="text-lg font-black text-[#171717]">Línea de tiempo</h2>
            {timelineEvents.length ? <div className="mt-5 space-y-4 border-l-2 border-[#E8CE99] pl-5">
              {timelineEvents.map((event) => (
                <div key={event.id} className="relative">
                  <span className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-white bg-[#E49A02]" />
                  <p className="text-sm font-black text-[#2F2F2F]">{event.label}</p>
                  <p className="mt-1 text-xs text-[#747474]">{new Intl.DateTimeFormat('es-UY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.date))}</p>
                </div>
              ))}
            </div> : <p className="mt-5 rounded-2xl bg-[#F7F6F4] p-4 text-sm text-[#747474]">Todavía no hay actividad clínica registrada para este paciente.</p>}
          </article>
        </div>
      </section>
      {pendingRevocation && <RevokeSessionDialog sessionTitle={pendingRevocation.title} isPending={revokeAssignment.isPending} error={actionError} onCancel={()=>{if(!revokeAssignment.isPending){setPendingRevocation(null);setActionError('')}}} onConfirm={(reason)=>void revoke(pendingRevocation,reason)}/>}
      {pendingRetrospective && <RetrospectiveSessionDialog assignment={pendingRetrospective} isPending={retrospectiveCompletion.isPending} error={actionError} onCancel={()=>{if(!retrospectiveCompletion.isPending){setPendingRetrospective(null);setActionError('')}}} onConfirm={(details)=>void completeRetrospectively(pendingRetrospective,details)}/>}
      {pendingCancellation && <CancelSessionDialog sessionTitle={pendingCancellation.title} isPending={cancelAssignment.isPending} error={actionError} onClose={()=>{if(!cancelAssignment.isPending){setPendingCancellation(null);setActionError('')}}} onConfirm={(reason)=>void cancelPlannedSession(pendingCancellation,reason)}/>}
      {pendingRepeat && <RepeatSessionDialog sessionTitle={pendingRepeat.title} isPending={repeatAssignment.isPending} error={actionError} onCancel={()=>{if(!repeatAssignment.isPending){setPendingRepeat(null);setActionError('')}}} onConfirm={(input)=>void repeatAsHome(pendingRepeat,input)}/>}
    </div>
  )
}
