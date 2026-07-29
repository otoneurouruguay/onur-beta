import { ClipboardList } from 'lucide-react'
import { assessmentPhaseLabels } from './questions'
import { useCurrentPatientAssessments } from './hooks'

export function PatientPortalAssessments() {
  const { data: assessments = [], isPending, error } = useCurrentPatientAssessments()

  return (
    <section className="mt-8 rounded-2xl border border-[#E9E7E7] bg-white p-6 sm:p-7" aria-labelledby="patient-assessments-title">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#FFF7E8] text-[#A36B00]"><ClipboardList size={18}/></span>
        <div>
          <h2 id="patient-assessments-title" className="text-lg font-black text-[#171717]">Mis evaluaciones</h2>
          <p className="mt-1 text-xs leading-5 text-[#747474]">Resultados registrados por tu profesional. No constituyen una interpretación médica automática.</p>
        </div>
      </div>

      {isPending ? <p className="mt-5 text-sm text-[#747474]">Cargando evaluaciones…</p>
        : error ? <p role="alert" className="mt-5 rounded-xl bg-[#FCECED] p-3 text-sm font-bold text-[#A94952]">No fue posible cargar las evaluaciones.</p>
          : assessments.length === 0 ? <p className="mt-5 rounded-xl bg-[#F7F6F4] p-4 text-sm text-[#747474]">Todavía no hay evaluaciones compartidas en tu historia.</p>
            : <div className="mt-5 divide-y divide-[#E9E7E7]">
              {assessments.map((assessment) => {
                const expected = assessment.instrumentVersion >= 2 ? 18 : 12
                const maximum = assessment.instrumentVersion >= 2 ? assessment.applicableCount * 3 : 48
                return <article key={assessment.id} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="text-sm font-black text-[#2F2F2F]">Evaluación {assessmentPhaseLabels[assessment.phase].toLowerCase()}</p>
                    <p className="mt-1 text-xs text-[#747474]">{new Intl.DateTimeFormat('es-UY').format(new Date(`${assessment.assessmentDate}T12:00:00`))} · {assessment.answeredCount}/{expected} respuestas</p>
                  </div>
                  <p className="shrink-0 font-['Poppins'] text-xl font-semibold text-[#171717]">{assessment.totalScore}<span className="text-xs text-[#747474]">/{maximum}</span></p>
                </article>
              })}
            </div>}
    </section>
  )
}
