import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  Plus,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../components/StatusBadge'
import { useProfessionalAssessments } from '../features/assessments/hooks'
import { assessmentPhaseLabels } from '../features/assessments/questions'
import { useAuth } from '../features/auth/AuthProvider'
import { usePatients } from '../features/patients/hooks'
import { useProfessionalAssignments } from '../features/sessions/hooks'
import { sessionDurationLabel } from '../features/sessions/repository'
import { useStatisticalSuggestions } from '../features/studies/hooks'

const CLINIC_TIME_ZONE = 'America/Montevideo'

function clinicDateKey(value: Date | string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function clinicTime(value: string) {
  const time = new Intl.DateTimeFormat('es-UY', {
    timeZone: CLINIC_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
  return time === '00:00' || time === '24:00' ? 'Sin hora' : time
}

function shortDateTime(value: string) {
  const date = new Intl.DateTimeFormat('es-UY', {
    timeZone: CLINIC_TIME_ZONE,
    day: '2-digit',
    month: 'short',
  }).format(new Date(value))
  const time = clinicTime(value)
  return time === 'Sin hora' ? date : `${date}, ${time}`
}

export function DashboardPage() {
  const auth = useAuth()
  const { data: patients = [] } = usePatients()
  const { data: assignments = [] } = useProfessionalAssignments()
  const { data: assessments = [] } = useProfessionalAssessments()
  const { data: suggestions = [] } = useStatisticalSuggestions()
  const now = new Date()
  const todayKey = clinicDateKey(now)
  const todaySessions = assignments
    .filter((session) => clinicDateKey(session.availableFrom) === todayKey)
    .sort((a, b) => a.availableFrom.localeCompare(b.availableFrom))
  const activeAssignments = assignments
    .filter((session) => session.status === 'assigned' || session.status === 'started')
    .sort((a, b) => a.availableFrom.localeCompare(b.availableFrom))
  const nextSession = activeAssignments.find((session) => new Date(session.availableFrom).getTime() >= now.getTime()) ?? activeAssignments[0]
  const nextPatient = patients.find((patient) => patient.id === nextSession?.patientId)
  const activePatients = patients.filter((patient) => patient.status === 'active').length
  const completedToday = todaySessions.filter((session) => session.status === 'completed').length
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weeklyDue = assignments.filter((session) => {
    const available = new Date(session.availableFrom)
    return session.mode === 'home' && available >= weekStart && available <= now && session.status !== 'revoked'
  })
  const weeklyCompleted = weeklyDue.filter((session) => session.status === 'completed').length
  const weeklyAdherence = weeklyDue.length ? Math.round((weeklyCompleted / weeklyDue.length) * 100) : null
  const pendingSuggestions = suggestions.filter((suggestion) => suggestion.status === 'pending')
  const latestAssessment = [...assessments].sort((a, b) => (b.completedAt || b.assignedAt).localeCompare(a.completedAt || a.assignedAt))[0]
  const latestAssessmentPatient = patients.find((patient) => patient.id === latestAssessment?.patientId)
  const recentActivity = assignments
    .filter((session) => Boolean(session.completedAt) || ['completed', 'partial', 'revoked'].includes(session.status))
    .sort((a, b) => (b.completedAt || b.createdAt).localeCompare(a.completedAt || a.createdAt))
    .slice(0, 5)
  const todayLabel = new Intl.DateTimeFormat('es-UY', {
    timeZone: CLINIC_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)
  const firstName = auth.displayName.trim().split(/\s+/)[0] || 'Profesional'

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold capitalize text-[#747474]">{todayLabel}</p>
          <h1 className="mt-1.5 text-[30px] leading-tight tracking-[-0.035em] text-[#171717] sm:text-[34px]">Buen día, {firstName}</h1>
          <p className="mt-2 text-sm text-[#747474]">Estado clínico y operativo construido con los registros actuales.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/estudios/importar" className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#D9D6D2] bg-white px-4 text-sm font-semibold text-[#2F2F2F] transition hover:border-[#BDB9B4]">
            <Upload size={16} /> Importar estudio
          </Link>
          <Link to="/app/pacientes/nuevo" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#E49A02] px-4 text-sm font-semibold text-[#171717] shadow-[0_6px_14px_rgba(228,154,2,0.16)] transition hover:bg-[#D99000]">
            <Plus size={17} /> Nuevo paciente
          </Link>
        </div>
      </header>

      {nextSession ? (
        <section className="overflow-hidden rounded-2xl border border-[#E2DED9] bg-white shadow-[0_8px_24px_rgba(23,23,23,0.04)]" aria-label="Próxima sesión">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#FFF3D7] font-['Poppins'] text-sm font-semibold text-[#8A5B00]">
                {nextSession.patientName.split(' ').map((part) => part[0]).slice(0, 2).join('')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A36B00]">Próxima sesión · {clinicDateKey(nextSession.availableFrom) === todayKey ? clinicTime(nextSession.availableFrom) : shortDateTime(nextSession.availableFrom)}</p>
                <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                  <Link to={`/app/pacientes/${nextSession.patientId}`} className="font-['Poppins'] text-xl font-semibold tracking-[-0.02em] text-[#171717] hover:text-[#8A5B00]">{nextSession.patientName}</Link>
                  {nextPatient && <p className="text-xs text-[#747474]">{nextPatient.age ? `${nextPatient.age} años · ` : ''}{nextPatient.insurer}</p>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#525252]">
                  <span className="flex items-center gap-1.5"><Activity size={14} className="text-[#A36B00]" /> {nextSession.title}</span>
                  <span className="flex items-center gap-1.5"><Clock3 size={14} /> {sessionDurationLabel(nextSession)}</span>
                  <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> {nextSession.mode === 'home' ? 'Domiciliaria' : 'Presencial supervisada'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-[#E9E7E7] bg-[#FCFBFA] p-4 lg:border-l lg:border-t-0 lg:px-5">
              <Link to={`/app/pacientes/${nextSession.patientId}`} className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-[#D9D6D2] bg-white px-4 text-xs font-semibold text-[#2F2F2F] lg:flex-none">Ver ficha</Link>
              {nextSession.mode === 'in_person'
                ? <Link to={`/app/pacientes/${nextSession.patientId}/sesiones/${nextSession.id}/presencial`} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#E49A02] px-4 text-xs font-semibold text-[#171717] lg:flex-none">Iniciar sesión <ArrowRight size={15}/></Link>
                : <Link to="/app/sesiones" className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#171717] px-4 text-xs font-semibold text-white lg:flex-none">Ver sesión <ArrowRight size={15}/></Link>}
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-[#E2DED9] bg-white p-6">
          <h2 className="text-base font-semibold text-[#171717]">Sin sesiones próximas</h2>
          <p className="mt-2 text-sm text-[#747474]">Las nuevas asignaciones aparecerán aquí con su paciente y horario reales.</p>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen clínico">
        <MetricCard icon={Users} label="Pacientes activos" value={String(activePatients)} detail={`${patients.length} pacientes registrados`} />
        <MetricCard icon={CalendarDays} label="Sesiones de hoy" value={String(todaySessions.length)} detail={`${completedToday} completadas`} />
        <MetricCard icon={CheckCircle2} label="Adherencia semanal" value={weeklyAdherence === null ? '—' : `${weeklyAdherence}%`} detail={weeklyDue.length ? `${weeklyCompleted} de ${weeklyDue.length} domiciliarias completadas` : 'Sin sesiones domiciliarias vencidas'} progress={weeklyAdherence ?? undefined} />
        <MetricCard icon={ClipboardCheck} label="Revisión pendiente" value={String(pendingSuggestions.length)} detail="Sugerencias estadísticas sin revisar" attention={pendingSuggestions.length > 0} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.8fr)]">
        <article className="overflow-hidden rounded-2xl border border-[#E2DED9] bg-white">
          <div className="flex items-center justify-between border-b border-[#E9E7E7] px-5 py-4 sm:px-6">
            <div><h2 className="text-base text-[#171717]">Agenda de hoy</h2><p className="mt-1 text-xs text-[#747474]">Asignaciones disponibles en la fecha clínica actual</p></div>
            <Link to="/app/sesiones" className="inline-flex items-center gap-1 text-xs font-semibold text-[#8A5B00]">Ver agenda <ChevronRight size={14}/></Link>
          </div>
          {todaySessions.length ? todaySessions.slice(0, 6).map((session) => (
            <div key={session.id} className="grid gap-3 border-b border-[#EFEEEC] px-5 py-4 last:border-b-0 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center sm:px-6">
              <p className="text-sm font-semibold tabular-nums text-[#2F2F2F]">{clinicTime(session.availableFrom)}</p>
              <div className="min-w-0"><Link to={`/app/pacientes/${session.patientId}`} className="truncate text-sm font-semibold text-[#171717]">{session.patientName}</Link><p className="mt-0.5 truncate text-xs text-[#747474]">{session.title} · {session.mode === 'home' ? 'Domiciliaria' : 'Presencial'}</p></div>
              <StatusBadge status={session.status}/>
            </div>
          )) : <p className="px-6 py-10 text-center text-sm text-[#747474]">No hay sesiones registradas para hoy.</p>}
        </article>

        <article className="rounded-2xl border border-[#E2DED9] bg-white p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A36B00]">Última evaluación</p>
          {latestAssessment ? <>
            <h2 className="mt-2 text-lg text-[#171717]">{latestAssessmentPatient?.fullName || latestAssessment.patientName}</h2>
            <p className="mt-1 text-xs text-[#747474]">{assessmentPhaseLabels[latestAssessment.phase]} · {new Intl.DateTimeFormat('es-UY').format(new Date(latestAssessment.completedAt || latestAssessment.assignedAt))}</p>
            <p className="mt-6 font-['Poppins'] text-[32px] font-semibold text-[#171717]">{latestAssessment.totalScore === null ? latestAssessment.status === 'in_progress' ? 'En curso' : 'Pendiente' : `${latestAssessment.totalScore}/100`}</p>
            <p className="mt-2 text-xs leading-5 text-[#747474]">DHI · {latestAssessment.answeredCount}/25 respuestas. Valor descriptivo sin interpretación automática.</p>
            <Link to={`/app/pacientes/${latestAssessment.patientId}/evaluaciones/${latestAssessment.id}`} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#D9D6D2] text-xs font-semibold text-[#2F2F2F]">Ver cuestionario <ChevronRight size={14}/></Link>
          </> : <p className="mt-5 rounded-xl bg-[#F7F6F4] p-4 text-sm text-[#747474]">Todavía no hay evaluaciones registradas.</p>}
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.8fr)]">
        <article className="overflow-hidden rounded-2xl border border-[#E2DED9] bg-white">
          <div className="border-b border-[#E9E7E7] px-5 py-4 sm:px-6"><h2 className="text-base text-[#171717]">Trazabilidad reciente</h2><p className="mt-1 text-xs text-[#747474]">Estados registrados en sesiones reales</p></div>
          {recentActivity.length ? <div className="divide-y divide-[#EFEEEC]">{recentActivity.map((session) => (
            <div key={session.id} className="flex items-center gap-3.5 px-5 py-3.5 sm:px-6">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#F7F6F4] text-[#747474]">{session.status === 'completed' ? <CheckCircle2 size={14}/> : <FileText size={14}/>}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#2F2F2F]">{session.title} · <StatusText status={session.status}/></p><p className="mt-0.5 text-[11px] text-[#747474]">{session.patientName}</p></div>
              <time className="text-[10px] text-[#99948F]">{shortDateTime(session.completedAt || session.createdAt)}</time>
            </div>
          ))}</div> : <p className="px-6 py-10 text-center text-sm text-[#747474]">Aún no hay actividad clínica registrada.</p>}
        </article>

        <article className="rounded-2xl border border-[#E2DED9] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#FFF3D7] text-[#8A5B00]"><ShieldCheck size={17}/></span><div><h2 className="text-sm text-[#171717]">Control profesional</h2><p className="mt-0.5 text-[11px] text-[#747474]">Datos trazables, sin contenido clínico simulado</p></div></div>
          <div className="mt-5 space-y-3 text-xs text-[#525252]">
            <p className="flex items-center gap-2"><CheckCircle2 size={15} className="text-[#55745F]"/> Pacientes y sesiones desde la base clínica</p>
            <p className="flex items-center gap-2"><CheckCircle2 size={15} className="text-[#55745F]"/> Métricas calculadas con registros disponibles</p>
            <p className="flex items-center gap-2"><CheckCircle2 size={15} className="text-[#55745F]"/> Vacíos identificados sin inventar resultados</p>
          </div>
        </article>
      </section>
    </div>
  )
}

function StatusText({ status }: { status: string }) {
  const labels: Record<string, string> = { completed: 'completada', partial: 'parcial', revoked: 'anulada' }
  return <>{labels[status] ?? status}</>
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  progress,
  attention,
}: {
  icon: typeof Users
  label: string
  value: string
  detail: string
  progress?: number
  attention?: boolean
}) {
  return (
    <article className="rounded-2xl border border-[#E2DED9] bg-white p-4 shadow-[0_6px_18px_rgba(23,23,23,0.025)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[11px] font-semibold text-[#747474]">{label}</p><p className="mt-2 font-['Poppins'] text-[27px] font-semibold tracking-[-0.04em] text-[#171717]">{value}</p></div>
        <span className={`grid size-9 place-items-center rounded-xl ${attention ? 'bg-[#FFF3D7] text-[#8A5B00]' : 'bg-[#F1EFEC] text-[#525252]'}`}><Icon size={17}/></span>
      </div>
      <p className={`mt-2.5 text-[10px] ${attention ? 'font-semibold text-[#8A5B00]' : 'text-[#8B8782]'}`}>{detail}</p>
      {progress !== undefined && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ECEAE7]"><div className="h-full rounded-full bg-[#E49A02]" style={{ width: `${progress}%` }}/></div>}
    </article>
  )
}
