import { ChevronLeft, ClipboardCheck, Send, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { AssessmentQuestionnaire } from '../features/assessments/AssessmentQuestionnaire'
import { useAssessment, useCompleteAssessment, useCreateAssessment } from '../features/assessments/hooks'
import {
  assessmentPhaseLabels,
  dhiArgentina,
  emptyAssessmentResponses,
  scoreAssessment,
  type AssessmentResponseMap,
} from '../features/assessments/questions'
import type { AssessmentDeliveryMode, AssessmentPhase } from '../features/assessments/repository'
import { usePatient } from '../features/patients/hooks'
import { useTreatmentCycles } from '../features/sessions/hooks'

function dateAfter(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function AssessmentFormPage() {
  const { patientId = '' } = useParams()
  const [params] = useSearchParams()
  const resumeAssessmentId = params.get('assessmentId') ?? ''
  const navigate = useNavigate()
  const { data: patient } = usePatient(patientId)
  const { data: cycles = [] } = useTreatmentCycles(patientId)
  const create = useCreateAssessment(patientId)
  const complete = useCompleteAssessment(patientId)
  const { data: resumeAssessment, isPending: resumePending } = useAssessment(resumeAssessmentId)
  const requestedMode = params.get('mode') === 'in_person' ? 'in_person' : 'portal'
  const requestedPhase = ['initial', 'final', 'follow_up'].includes(params.get('phase') ?? '') ? params.get('phase') as AssessmentPhase : 'initial'
  const [mode, setMode] = useState<AssessmentDeliveryMode>(requestedMode)
  const [phase, setPhase] = useState<AssessmentPhase>(requestedPhase)
  const [cycleId, setCycleId] = useState('')
  const [dueDate, setDueDate] = useState(dateAfter(7))
  const [responses, setResponses] = useState<AssessmentResponseMap>(() => emptyAssessmentResponses())
  const [createdAssessmentId, setCreatedAssessmentId] = useState('')
  const [error, setError] = useState('')
  const score = scoreAssessment(responses)

  useEffect(() => {
    if (resumeAssessment && resumeAssessment.patientId === patientId && resumeAssessment.deliveryMode === 'in_person' && ['assigned', 'in_progress'].includes(resumeAssessment.status)) {
      setMode('in_person')
      setPhase(resumeAssessment.phase)
      setCycleId(resumeAssessment.treatmentCycleId)
      setResponses(resumeAssessment.responses)
      setCreatedAssessmentId(resumeAssessment.id)
      return
    }
    setCycleId((current) => current || cycles.find((cycle) => cycle.status === 'active')?.id || cycles[0]?.id || '')
  }, [cycles, patientId, resumeAssessment])
  useEffect(() => {
    if (!resumeAssessmentId) {
      setCreatedAssessmentId('')
      setResponses(emptyAssessmentResponses())
      setError('')
    }
  }, [mode, phase, cycleId, resumeAssessmentId])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (resumeAssessmentId && !createdAssessmentId) { setError('No fue posible recuperar el cuestionario presencial pendiente.'); return }
    if (!cycleId) { setError('Seleccioná un ciclo de tratamiento.'); return }
    if (mode === 'portal' && patient?.portalAccess !== 'enabled') { setError('Habilitá primero el acceso domiciliario del paciente para enviarle el cuestionario.'); return }
    if (mode === 'in_person' && !score.complete) { setError(`Completá las ${dhiArgentina.questions.length} respuestas antes de finalizar.`); return }
    setError('')
    try {
      const assignment = createdAssessmentId
        ? { id: createdAssessmentId }
        : await create.mutateAsync({
          patientId,
          treatmentCycleId: cycleId,
          instrumentCode: dhiArgentina.code,
          instrumentVersion: dhiArgentina.version,
          phase,
          deliveryMode: mode,
          dueDate: mode === 'portal' ? dueDate : '',
        })
      setCreatedAssessmentId(assignment.id)
      if (mode === 'in_person') await complete.mutateAsync({ id: assignment.id, responses })
      navigate(`/app/pacientes/${patientId}`, { state: { notice: mode === 'portal' ? 'DHI habilitado en el portal del paciente.' : 'DHI presencial completado y calculado.' } })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible guardar el cuestionario.')
    }
  }

  return <div className="space-y-7">
    <Link to={`/app/pacientes/${patientId}`} className="inline-flex items-center gap-2 text-xs font-black text-[#E49A02]"><ChevronLeft size={16}/> Volver al perfil</Link>
    <PageHeader
      eyebrow="Evaluación clínica autoinformada"
      title={mode === 'portal' ? 'Enviar cuestionario' : 'Iniciar cuestionario presencial'}
      description={patient ? `${dhiArgentina.shortName} para ${patient.fullName}, asociado a su ciclo de tratamiento.` : dhiArgentina.name}
    />

    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="text-xs font-black text-[#2F2F2F]">Modalidad<select className="mt-2 h-11 w-full rounded-2xl border border-[#E9E7E7] px-3 text-sm" value={mode} onChange={(event) => setMode(event.target.value as AssessmentDeliveryMode)}><option value="portal">Enviar al portal</option><option value="in_person">Iniciar presencial</option></select></label>
          <label className="text-xs font-black text-[#2F2F2F]">Momento<select className="mt-2 h-11 w-full rounded-2xl border border-[#E9E7E7] px-3 text-sm" value={phase} onChange={(event) => setPhase(event.target.value as AssessmentPhase)}><option value="initial">Inicial</option><option value="follow_up">Seguimiento</option><option value="final">Final</option></select></label>
          <label className="text-xs font-black text-[#2F2F2F]">Ciclo<select className="mt-2 h-11 w-full rounded-2xl border border-[#E9E7E7] px-3 text-sm" value={cycleId} onChange={(event) => setCycleId(event.target.value)}><option value="">Seleccionar…</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}</select></label>
          {mode === 'portal' && <label className="text-xs font-black text-[#2F2F2F]">Completar antes de<input type="date" min={new Date().toISOString().slice(0, 10)} className="mt-2 h-11 w-full rounded-2xl border border-[#E9E7E7] px-3 text-sm" value={dueDate} onChange={(event) => setDueDate(event.target.value)}/></label>}
        </div>
        <div className="mt-5 rounded-2xl bg-[#F7F6F4] p-4">
          <p className="text-sm font-black text-[#171717]">{dhiArgentina.name}</p>
          <p className="mt-1 text-xs leading-5 text-[#747474]">25 preguntas · puntuación total 0–100 · áreas física, emocional y funcional. Una puntuación mayor indica mayor discapacidad percibida; no constituye diagnóstico.</p>
          <p className="mt-2 text-[11px] leading-5 text-[#747474]">{dhiArgentina.source}</p>
        </div>
      </section>

      {mode === 'portal' ? <section className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-6 sm:p-8">
        <Send size={24} className="text-[#A36B00]"/>
        <h2 className="mt-4 text-xl font-black text-[#171717]">Se mostrará en el portal del paciente</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6F5A2A]">El paciente podrá responderlo desde su casa, guardar el avance y enviarlo. Las respuestas anteriores no se muestran mientras completa una evaluación nueva.</p>
        {patient?.portalAccess !== 'enabled' && <p className="mt-4 rounded-xl bg-white p-4 text-xs font-bold text-[#A94952]">El acceso domiciliario está deshabilitado. Podés habilitarlo desde el perfil antes de enviar.</p>}
      </section> : <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <section><div className="mb-5 rounded-2xl bg-[#171717] p-6 text-white"><UserRound className="text-[#E49A02]"/><h2 className="mt-4 text-xl font-black">Responder con el paciente presente</h2><p className="mt-2 text-xs leading-5 text-white/65">Leé las instrucciones y registrá una sola respuesta por pregunta. El resultado se calcula al finalizar.</p></div><AssessmentQuestionnaire instrument={dhiArgentina} responses={responses} onChange={setResponses} showOptionScores/></section>
        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start"><section className="rounded-2xl border border-[#E9E7E7] bg-white p-6"><p className="text-xs font-black uppercase tracking-[.15em] text-[#E49A02]">Avance</p><p className="mt-3 text-4xl font-black text-[#171717]">{score.answeredCount}<span className="text-lg text-[#747474]">/25</span></p><p className="mt-2 text-xs text-[#747474]">El puntaje se confirma al completar todo el formulario.</p></section></aside>
      </div>}

      {error && <p role="alert" className="rounded-2xl bg-[#FCECED] p-4 text-sm font-bold text-[#A94952]">{error}</p>}
      <div className="flex justify-end"><button disabled={resumePending || create.isPending || complete.isPending} className="inline-flex items-center gap-2 rounded-2xl bg-[#E49A02] px-6 py-4 text-sm font-black text-white disabled:opacity-60">{mode === 'portal' ? <Send size={17}/> : <ClipboardCheck size={17}/>} {resumePending || create.isPending || complete.isPending ? 'Guardando…' : mode === 'portal' ? `Habilitar DHI ${assessmentPhaseLabels[phase].toLowerCase()}` : createdAssessmentId ? 'Continuar y calcular' : 'Finalizar y calcular'}</button></div>
    </form>
  </div>
}
