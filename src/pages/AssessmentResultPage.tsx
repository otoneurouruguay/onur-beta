import { ChevronLeft, ClipboardList, Play, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { AssessmentQuestionnaire } from '../features/assessments/AssessmentQuestionnaire'
import { useAssessment, useCancelAssessment } from '../features/assessments/hooks'
import { assessmentDeliveryLabels, assessmentDomainLabels, assessmentPhaseLabels, getAssessmentInstrument } from '../features/assessments/questions'

export function AssessmentResultPage() {
  const { patientId = '', assessmentId = '' } = useParams()
  const { data: assessment, isPending, error } = useAssessment(assessmentId)
  const cancel = useCancelAssessment(patientId)
  const [actionError, setActionError] = useState('')
  const instrument = assessment ? getAssessmentInstrument(assessment.instrumentCode, assessment.instrumentVersion) : null

  if (isPending) return <p className="p-8 text-sm font-bold text-[#747474]">Cargando cuestionario…</p>
  if (error || !assessment || !instrument) return <div className="space-y-6"><Link to={`/app/pacientes/${patientId}`} className="inline-flex items-center gap-2 text-xs font-black text-[#E49A02]"><ChevronLeft size={16}/> Volver al perfil</Link><p className="rounded-2xl bg-[#FCECED] p-5 text-sm font-bold text-[#A94952]">No fue posible abrir el cuestionario.</p></div>

  const open = ['assigned', 'in_progress'].includes(assessment.status)
  const status = assessment.status === 'assigned' ? 'pending' : assessment.status === 'in_progress' ? 'partial' : assessment.status
  const cancelAssignment = async () => {
    if (!window.confirm('¿Cancelar esta asignación? Dejará de aparecer en el portal y no se borrará un resultado ya finalizado.')) return
    setActionError('')
    try { await cancel.mutateAsync(assessment.id) }
    catch (caught) { setActionError(caught instanceof Error ? caught.message : 'No fue posible cancelar el cuestionario.') }
  }

  return <div className="space-y-7">
    <Link to={`/app/pacientes/${patientId}`} className="inline-flex items-center gap-2 text-xs font-black text-[#E49A02]"><ChevronLeft size={16}/> Volver al perfil</Link>
    <PageHeader eyebrow="Evaluación clínica" title={instrument.name} description={`${assessmentPhaseLabels[assessment.phase]} · ${assessmentDeliveryLabels[assessment.deliveryMode]}`}/>
    <section className="rounded-2xl border border-[#E9E7E7] bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#FFF7E8] text-[#A36B00]"><ClipboardList size={20}/></span><div><p className="text-sm font-black text-[#171717]">Estado del cuestionario</p><p className="mt-1 text-xs text-[#747474]">Asignado {new Intl.DateTimeFormat('es-UY').format(new Date(assessment.assignedAt))}</p></div></div>
        <StatusBadge status={status}/>
      </div>
      {assessment.status === 'completed' ? <>
        <div className="mt-7 grid gap-4 sm:grid-cols-4"><article className="rounded-2xl bg-[#171717] p-5 text-white"><p className="text-xs font-bold text-white/60">DHI total</p><p className="mt-2 text-3xl font-black">{assessment.totalScore}<span className="text-sm text-white/55">/100</span></p></article>{(['physical','emotional','functional'] as const).map((domain) => <article key={domain} className="rounded-2xl bg-[#F7F6F4] p-5"><p className="text-xs font-bold text-[#747474]">{assessmentDomainLabels[domain]}</p><p className="mt-2 text-2xl font-black text-[#171717]">{assessment.subscaleScores[domain]}<span className="text-xs text-[#747474]">/{domain === 'physical' ? 28 : 36}</span></p></article>)}</div>
        <p className="mt-5 rounded-xl bg-[#FFF7E8] p-4 text-xs leading-5 text-[#6F5A2A]">Una puntuación mayor indica mayor discapacidad percibida. El resultado describe la percepción del paciente y requiere interpretación profesional junto con la evaluación clínica.</p>
      </> : assessment.status === 'cancelled' ? <p className="mt-6 rounded-xl bg-[#F7F6F4] p-4 text-sm text-[#747474]">La asignación fue cancelada y ya no requiere respuesta.</p> : <p className="mt-6 rounded-xl bg-[#F7F6F4] p-4 text-sm text-[#747474]">Todavía no hay un resultado calculado. Se respondieron {assessment.answeredCount}/25 preguntas.</p>}
      {open && <div className="mt-6 flex flex-wrap gap-3">
        {assessment.deliveryMode === 'in_person' && <Link to={`/app/pacientes/${patientId}/evaluaciones/nueva?mode=in_person&assessmentId=${assessment.id}`} className="inline-flex items-center gap-2 rounded-xl bg-[#E49A02] px-4 py-3 text-xs font-black text-white"><Play size={15}/> Continuar presencial</Link>}
        <button type="button" disabled={cancel.isPending} onClick={cancelAssignment} className="inline-flex items-center gap-2 rounded-xl border border-[#E9E7E7] px-4 py-3 text-xs font-black text-[#696969] disabled:opacity-60"><XCircle size={15}/> Cancelar asignación</button>
      </div>}
      {actionError && <p role="alert" className="mt-4 rounded-xl bg-[#FCECED] p-4 text-sm font-bold text-[#A94952]">{actionError}</p>}
    </section>
    {assessment.status === 'completed' && <AssessmentQuestionnaire instrument={instrument} responses={assessment.responses} readOnly/>}
  </div>
}
