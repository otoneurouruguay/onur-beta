import { ClipboardList, Play, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../../components/StatusBadge'
import { usePatientAssessments } from './hooks'
import { assessmentDeliveryLabels, assessmentDomainLabels, assessmentPhaseLabels, getAssessmentInstrument } from './questions'
import { assessmentComparison } from './repository'

export function PatientAssessmentsPanel({ patientId, cycleId }: { patientId: string; cycleId: string }) {
  const { data: items = [] } = usePatientAssessments(patientId)
  const comparison = assessmentComparison(items, cycleId)
  return <article className="rounded-2xl border border-[#E9E7E7] bg-white p-6 sm:col-span-2">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-lg font-black text-[#171717]">Cuestionarios clínicos</h2><p className="mt-1 text-xs text-[#747474]">DHI domiciliario o presencial, asociado al ciclo de tratamiento.</p></div>
      <div className="flex flex-wrap gap-2"><Link to={`/app/pacientes/${patientId}/evaluaciones/nueva?mode=portal`} className="inline-flex items-center gap-2 rounded-xl border border-[#E8CE99] bg-[#FFF7E8] px-3 py-2 text-xs font-black text-[#A36B00]"><Send size={15}/> Enviar al portal</Link><Link to={`/app/pacientes/${patientId}/evaluaciones/nueva?mode=in_person`} className="inline-flex items-center gap-2 rounded-xl bg-[#E49A02] px-3 py-2 text-xs font-black text-white"><Play size={15}/> Iniciar cuestionario</Link></div>
    </div>
    {comparison && <div className="mt-5 rounded-2xl border border-[#B9D9C5] bg-[#F0F8F3] p-5"><p className="text-sm font-black text-[#28613D]">DHI inicial {comparison.initialTotal}/100 → final {comparison.finalTotal}/100</p><p className="mt-1 text-xs leading-5 text-[#496451]">Cambio total: {comparison.difference > 0 ? '+' : ''}{comparison.difference} puntos. Un valor negativo indica menor discapacidad percibida.</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{(['physical','emotional','functional'] as const).map((domain) => <p key={domain} className="rounded-xl bg-white px-3 py-2 text-xs text-[#496451]"><strong>{assessmentDomainLabels[domain]}:</strong> {comparison.subscaleDifferences[domain] > 0 ? '+' : ''}{comparison.subscaleDifferences[domain]}</p>)}</div></div>}
    <div className="mt-5 divide-y divide-[#E9E7E7]">{items.length === 0 ? <p className="py-4 text-sm text-[#747474]">Todavía no hay cuestionarios asignados.</p> : items.slice(0, 8).map((item) => {
      const instrument = getAssessmentInstrument(item.instrumentCode, item.instrumentVersion)
      const status = item.status === 'assigned' ? 'pending' : item.status === 'in_progress' ? 'partial' : item.status
      return <Link to={`/app/pacientes/${patientId}/evaluaciones/${item.id}`} key={item.id} className="flex items-center justify-between gap-4 py-4 hover:bg-[#FCFBF9]">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-[#F7F6F4] text-[#E49A02]"><ClipboardList size={18}/></span><div><p className="text-sm font-black text-[#2F2F2F]">{instrument?.shortName ?? 'Cuestionario'} · {assessmentPhaseLabels[item.phase]}</p><p className="mt-1 text-xs text-[#747474]">{assessmentDeliveryLabels[item.deliveryMode]} · {item.status === 'completed' ? item.assessmentDate : `${item.answeredCount}/25 respuestas`}</p></div></div>
        <div className="text-right">{item.status === 'completed' && <p className="mb-1 text-lg font-black text-[#171717]">{item.totalScore}<span className="text-xs text-[#747474]">/100</span></p>}<StatusBadge status={status}/></div>
      </Link>
    })}</div>
  </article>
}
