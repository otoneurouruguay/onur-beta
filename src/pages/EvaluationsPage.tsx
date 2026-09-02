import { ClipboardList, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { useProfessionalAssessments } from '../features/assessments/hooks'
import { assessmentDeliveryLabels, assessmentPhaseLabels, getAssessmentInstrument } from '../features/assessments/questions'

export function EvaluationsPage() {
  const { data: items = [], isPending } = useProfessionalAssessments()
  return <div className="space-y-7">
    <PageHeader eyebrow="Seguimiento percibido" title="Cuestionarios" description="Asignaciones domiciliarias, cuestionarios presenciales y resultados calculados por ciclo." actions={<Link to="/app/pacientes" className="inline-flex items-center gap-2 rounded-2xl bg-[#E49A02] px-4 py-3 text-sm font-black text-white"><Plus size={17}/> Elegir paciente</Link>}/>
    <section className="overflow-hidden rounded-2xl border border-[#E9E7E7] bg-white">
      <div className="hidden grid-cols-[1.2fr_.7fr_.8fr_.8fr_.6fr] gap-4 bg-[#F7F6F4] px-6 py-3 text-[10px] font-black uppercase tracking-[.12em] text-[#747474] md:grid"><span>Paciente</span><span>Momento</span><span>Modalidad</span><span>Resultado</span><span>Estado</span></div>
      {isPending ? <p className="p-8 text-sm text-[#747474]">Cargando cuestionarios…</p> : items.length === 0 ? <p className="p-8 text-sm text-[#747474]">Todavía no hay cuestionarios asignados.</p> : <div className="divide-y divide-[#E9E7E7]">{items.map((item) => {
        const instrument = getAssessmentInstrument(item.instrumentCode, item.instrumentVersion)
        const status = item.status === 'assigned' ? 'pending' : item.status === 'in_progress' ? 'partial' : item.status
        return <Link to={`/app/pacientes/${item.patientId}/evaluaciones/${item.id}`} key={item.id} className="grid gap-3 px-6 py-5 hover:bg-[#F7F6F4] md:grid-cols-[1.2fr_.7fr_.8fr_.8fr_.6fr] md:items-center">
          <p className="flex items-center gap-2 text-sm font-black text-[#2F2F2F]"><ClipboardList size={16} className="text-[#E49A02]"/>{item.patientName || 'Paciente'}<span className="text-[10px] text-[#747474]">{instrument?.shortName}</span></p>
          <p className="text-xs text-[#747474]">{assessmentPhaseLabels[item.phase]}</p>
          <p className="text-xs text-[#747474]">{assessmentDeliveryLabels[item.deliveryMode]}</p>
          <p className="text-sm font-black text-[#2F2F2F]">{item.totalScore === null ? `${item.answeredCount}/25 respuestas` : `${item.totalScore}/100`}</p>
          <StatusBadge status={status}/>
        </Link>
      })}</div>}
    </section>
  </div>
}
