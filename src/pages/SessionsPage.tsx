import { CalendarDays, Clock3, Eye, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { useProfessionalAssignments } from '../features/sessions/hooks'
import { sessionDurationLabel } from '../features/sessions/repository'

export function SessionsPage() {
  const [search, setSearch] = useState('')
  const { data: sessions = [], isPending } = useProfessionalAssignments()
  const visible = sessions.filter((session) => `${session.patientName} ${session.title}`.toLowerCase().includes(search.toLowerCase()))

  return <div className="space-y-7">
    <PageHeader eyebrow="Seguimiento" title="Sesiones" description="Asignaciones domiciliarias y presenciales. Abrí cualquier fila para consultar ejercicios, resultados y comentarios." actions={<Link to="/app/pacientes" className="inline-flex items-center gap-2 rounded-2xl bg-[#E49A02] px-4 py-3 text-sm font-black text-white"><Plus size={17}/> Asignar a un paciente</Link>}/>
    <section className="overflow-hidden rounded-2xl border border-[#E9E7E7] bg-white">
      <div className="border-b border-[#E9E7E7] p-5"><label className="relative block max-w-md"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#747474]" size={17}/><input className="h-11 w-full rounded-2xl border border-[#E9E7E7] bg-[#F7F6F4] pl-10 pr-4 text-sm" placeholder="Buscar paciente o sesión…" value={search} onChange={event=>setSearch(event.target.value)}/></label></div>
      <div className="hidden grid-cols-[1.1fr_1.2fr_.7fr_.7fr_.7fr] gap-4 bg-[#F7F6F4] px-6 py-3 text-[10px] font-black uppercase tracking-[.12em] text-[#747474] md:grid"><span>Paciente</span><span>Sesión</span><span>Modalidad</span><span>Disponible</span><span>Estado</span></div>
      {isPending ? <p className="p-8 text-sm text-[#747474]">Cargando sesiones…</p> : visible.length === 0 ? <p className="p-8 text-sm text-[#747474]">No hay sesiones que coincidan.</p> : <div className="divide-y divide-[#E9E7E7]">
        {visible.map((session) => <Link to={`/app/pacientes/${session.patientId}/sesiones/${session.id}`} key={session.id} className="grid gap-3 px-6 py-5 hover:bg-[#F7F6F4] md:grid-cols-[1.1fr_1.2fr_.7fr_.7fr_.7fr] md:items-center">
          <p className="text-sm font-black text-[#2F2F2F]">{session.patientName || 'Paciente'}</p>
          <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-[#2F2F2F]">{session.title}</p>{session.registeredRetrospectively&&<span className="rounded-full bg-[#E7F3EB] px-2 py-1 text-[8px] font-black uppercase text-[#28613D]">Retrospectiva</span>}</div><p className="mt-1 flex items-center gap-1 text-xs text-[#747474]"><Clock3 size={13}/>{session.kind==='free_note'?'Registro libre':(['completed','partial'].includes(session.status) && session.activeSeconds ? `${Math.ceil(session.activeSeconds / 60)} min activos` : `${sessionDurationLabel(session)} previstos`)}{session.kind!=='free_note'&&` · ${session.exercises.length} ejercicios`}</p>{session.professionalObservation&&<p className="mt-1 line-clamp-2 text-[11px] text-[#747474]">{session.professionalObservation}</p>}{session.initialDiscomfort !== null && <p className="mt-1 text-[11px] font-bold text-[#E49A02]">Malestar {session.initialDiscomfort} → máx. {session.peakDiscomfort ?? '—'} → {session.finalDiscomfort}{session.recoveryMinutes!=null?` · recuperación ${session.recoveryMinutes} min`:''}</p>}{session.retrospectiveWithoutMetrics&&<p className="mt-1 text-[10px] font-bold text-[#747474]">Sin métricas retrospectivas</p>}</div>
          <p className="text-xs text-[#747474]">{session.mode === 'home' ? 'Domiciliaria' : 'Presencial'}</p>
          <p className="flex items-center gap-1 text-xs text-[#747474]"><CalendarDays size={13}/>{(session.actualPerformedAt || session.availableFrom).slice(0, 10)}</p>
          <span className="flex items-center justify-between gap-2"><StatusBadge status={session.status}/><Eye className="shrink-0 text-[#E49A02]" size={16}/></span>
        </Link>)}
      </div>}
    </section>
  </div>
}
