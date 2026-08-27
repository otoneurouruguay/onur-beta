import { CheckCircle2, ChevronLeft, LogOut, Save, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { AssessmentQuestionnaire } from '../features/assessments/AssessmentQuestionnaire'
import { useAssessment, useCompleteAssessment, useSaveAssessmentDraft } from '../features/assessments/hooks'
import { getAssessmentInstrument, scoreAssessment, type AssessmentResponseMap } from '../features/assessments/questions'
import { useAuth } from '../features/auth/AuthProvider'

export function PatientAssessmentPage() {
  const { assessmentId = '' } = useParams()
  const { data: assessment, isPending, error: loadError } = useAssessment(assessmentId)
  const [responses, setResponses] = useState<AssessmentResponseMap>({})
  const [error, setError] = useState('')
  const [finished, setFinished] = useState(false)
  const auth = useAuth()
  const patientId = assessment?.patientId ?? ''
  const saveDraft = useSaveAssessmentDraft(patientId)
  const complete = useCompleteAssessment(patientId)
  const instrument = assessment ? getAssessmentInstrument(assessment.instrumentCode, assessment.instrumentVersion) : null
  const score = instrument ? scoreAssessment(responses, instrument) : null

  useEffect(() => { if (assessment) setResponses(assessment.responses) }, [assessment])
  const logout = async () => { await auth.signOut(); window.location.assign(`${import.meta.env.BASE_URL}ingresar`) }

  const save = async () => {
    if (!assessment) return
    setError('')
    try { await saveDraft.mutateAsync({ id: assessment.id, responses }) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible guardar el avance.') }
  }

  const finish = async () => {
    if (!assessment || !instrument || !score?.complete) { setError(`Completá las ${instrument?.questions.length ?? 25} respuestas antes de enviar.`); return }
    setError('')
    try { await complete.mutateAsync({ id: assessment.id, responses }); setFinished(true) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible enviar el cuestionario.') }
  }

  if (isPending) return <main className="grid min-h-screen place-items-center bg-[#F7F6F4] text-sm font-bold text-[#747474]">Cargando cuestionario…</main>

  return <main className="min-h-screen bg-[#F7F6F4] px-5 py-6 sm:px-8"><div className="mx-auto max-w-3xl">
    <header className="flex items-center justify-between"><Brand/><button type="button" onClick={logout} className="grid size-10 place-items-center rounded-xl text-[#747474]" aria-label="Cerrar sesión"><LogOut size={18}/></button></header>
    <Link to="/paciente/hoy" className="mt-10 inline-flex items-center gap-2 text-xs font-black text-[#E49A02]"><ChevronLeft size={16}/> Volver a mi portal</Link>

    {loadError || !assessment || !instrument || assessment.deliveryMode !== 'portal' ? <section className="mt-8 rounded-2xl border border-[#E9E7E7] bg-white p-8"><h1 className="text-2xl font-black text-[#171717]">Cuestionario no disponible</h1><p className="mt-3 text-sm leading-6 text-[#747474]">La asignación no existe, fue retirada o no corresponde a este portal.</p></section>
      : finished || assessment.status === 'completed' ? <section className="mt-8 rounded-2xl border border-[#B9D9C5] bg-white p-8 text-center"><CheckCircle2 size={52} className="mx-auto text-[#28613D]"/><h1 className="mt-5 text-2xl font-black text-[#171717]">Cuestionario enviado</h1><p className="mt-3 text-sm leading-6 text-[#747474]">Tu profesional ya puede consultar el resultado. Tus respuestas quedaron guardadas dentro del ciclo de tratamiento.</p><Link to="/paciente/hoy" className="mt-6 inline-flex rounded-2xl bg-[#E49A02] px-5 py-3 text-sm font-black text-white">Volver al portal</Link></section>
        : assessment.status === 'cancelled' ? <section className="mt-8 rounded-2xl border border-[#E9E7E7] bg-white p-8"><h1 className="text-2xl font-black text-[#171717]">Cuestionario cancelado</h1><p className="mt-3 text-sm text-[#747474]">Esta evaluación ya no requiere respuesta.</p></section>
          : <>
            <section className="mt-8 rounded-2xl bg-[#171717] p-6 text-white sm:p-8"><p className="text-xs font-black uppercase tracking-[.16em] text-[#E49A02]">Cuestionario {assessment.phase === 'initial' ? 'inicial' : assessment.phase === 'final' ? 'final' : 'de seguimiento'}</p><h1 className="mt-3 text-3xl font-black">{instrument.name}</h1><p className="mt-4 text-sm leading-6 text-white/70">{instrument.instructions}</p>{assessment.dueDate && <p className="mt-4 text-xs font-bold text-[#E8CE99]">Fecha indicada: antes del {new Intl.DateTimeFormat('es-UY').format(new Date(`${assessment.dueDate}T12:00:00`))}</p>}</section>
            <div className="mt-6"><AssessmentQuestionnaire instrument={instrument} responses={responses} onChange={setResponses}/></div>
            {error && <p role="alert" className="mt-6 rounded-2xl bg-[#FCECED] p-4 text-sm font-bold text-[#A94952]">{error}</p>}
            <section className="sticky bottom-3 mt-7 flex flex-col gap-3 rounded-2xl border border-[#E9E7E7] bg-white/95 p-4 shadow-[0_12px_36px_rgba(23,23,23,.12)] backdrop-blur sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-bold text-[#747474]">{score?.answeredCount ?? 0}/{instrument.questions.length} respuestas</p><div className="flex gap-2"><button type="button" onClick={save} disabled={saveDraft.isPending || complete.isPending} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E9E7E7] px-4 py-3 text-xs font-black text-[#2F2F2F] disabled:opacity-60"><Save size={15}/> Guardar avance</button><button type="button" onClick={finish} disabled={saveDraft.isPending || complete.isPending || !score?.complete} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#E49A02] px-4 py-3 text-xs font-black text-white disabled:opacity-45"><Send size={15}/> Enviar</button></div></section>
          </>}
  </div></main>
}
