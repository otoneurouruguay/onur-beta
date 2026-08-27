import { CheckCircle2, ChevronRight, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { assessmentPhaseLabels, assessmentStatusLabels, getAssessmentInstrument } from './questions'
import { useCurrentPatientAssessments } from './hooks'

export function PatientPortalAssessments() {
  const { data: assessments = [], isPending, error } = useCurrentPatientAssessments()
  const pending = assessments.filter((item) => item.deliveryMode === 'portal' && ['assigned', 'in_progress'].includes(item.status))
  const completed = assessments.filter((item) => item.deliveryMode === 'portal' && item.status === 'completed')

  return <section className="mt-8 rounded-2xl border border-[#E9E7E7] bg-white p-6 sm:p-7" aria-labelledby="patient-assessments-title">
    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#FFF7E8] text-[#A36B00]"><ClipboardList size={18}/></span><div><h2 id="patient-assessments-title" className="text-lg font-black text-[#171717]">Cuestionarios</h2><p className="mt-1 text-xs leading-5 text-[#747474]">Completá únicamente los que tu profesional dejó habilitados.</p></div></div>
    {isPending ? <p className="mt-5 text-sm text-[#747474]">Cargando cuestionarios…</p>
      : error ? <p role="alert" className="mt-5 rounded-xl bg-[#FCECED] p-3 text-sm font-bold text-[#A94952]">No fue posible cargar los cuestionarios.</p>
        : <><div className="mt-5 space-y-3">{pending.length === 0 ? <p className="rounded-xl bg-[#F7F6F4] p-4 text-sm text-[#747474]">No tenés cuestionarios pendientes.</p> : pending.map((assessment) => { const instrument = getAssessmentInstrument(assessment.instrumentCode, assessment.instrumentVersion); return <Link key={assessment.id} to={`/paciente/cuestionarios/${assessment.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-4 transition hover:border-[#E49A02]"><div><p className="text-sm font-black text-[#171717]">{instrument?.shortName ?? 'Cuestionario'} {assessmentPhaseLabels[assessment.phase].toLowerCase()}</p><p className="mt-1 text-xs text-[#6F5A2A]">{assessmentStatusLabels[assessment.status]} · {assessment.answeredCount}/25 respuestas{assessment.dueDate ? ` · antes del ${new Intl.DateTimeFormat('es-UY').format(new Date(`${assessment.dueDate}T12:00:00`))}` : ''}</p></div><span className="inline-flex items-center gap-1 text-xs font-black text-[#A36B00]">{assessment.status === 'in_progress' ? 'Continuar' : 'Responder'} <ChevronRight size={16}/></span></Link> })}</div>
          {completed.length > 0 && <div className="mt-6 border-t border-[#E9E7E7] pt-5"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#747474]">Enviados</p><div className="mt-2 divide-y divide-[#E9E7E7]">{completed.slice(0, 4).map((assessment) => <div key={assessment.id} className="flex items-center gap-3 py-3"><CheckCircle2 size={17} className="text-[#28613D]"/><div><p className="text-xs font-black text-[#2F2F2F]">DHI {assessmentPhaseLabels[assessment.phase].toLowerCase()}</p><p className="mt-0.5 text-[11px] text-[#747474]">Enviado {assessment.completedAt ? new Intl.DateTimeFormat('es-UY').format(new Date(assessment.completedAt)) : ''}</p></div></div>)}</div></div>}
        </>}
  </section>
}
