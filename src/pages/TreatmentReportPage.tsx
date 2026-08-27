import { useQueries } from '@tanstack/react-query'
import { ChevronLeft, FileCheck2, Printer, Save, WandSparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { PageHeader } from '../components/PageHeader'
import { usePatientAssessments } from '../features/assessments/hooks'
import { buildEpisodeClinicalSummary, pathologyLabel } from '../features/clinicalEpisodes/catalog'
import { useClinicalEpisode } from '../features/clinicalEpisodes/hooks'
import { assessmentComparison } from '../features/assessments/repository'
import { usePatientDocuments } from '../features/documents/hooks'
import type { ClinicalDocumentRecord } from '../features/documents/types'
import { usePatient } from '../features/patients/hooks'
import {
  buildClinicalComparison,
  emptyClinicalReportNarratives,
  isClinicalReportTemplateSnapshot,
  objectiveComparisonSentence,
  type ClinicalReportNarratives,
  type ClinicalReportType,
} from '../features/reports/finalizationTemplate'
import { useCreateReport, usePatientReports } from '../features/reports/hooks'
import { ReportSourceFigure } from '../features/reports/ReportSourceFigure'
import { sessionReportSnapshotItem } from '../features/reports/sessionSnapshot'
import { useSessionAssignments, useTreatmentCycles } from '../features/sessions/hooks'
import { useClinicalStudies } from '../features/studies/hooks'
import { getStudyReview } from '../features/studies/repository'

const inputClass = 'mt-2 w-full rounded-2xl border border-[#E9E7E7] bg-white px-3 py-2.5 text-sm text-[#2F2F2F]'

function dateLabel(value: string) {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-UY').format(date)
}

function reportTitle(type: ClinicalReportType) {
  return type === 'finalization' ? 'Finalización del ciclo de rehabilitación' : 'Evolución en rehabilitación del equilibrio'
}

function NarrativeEditor({ label, value, onChange, rows = 4, help }: { label: string; value: string; onChange: (value: string) => void; rows?: number; help?: string }) {
  return <label className="block"><span className="text-xs font-black text-[#2F2F2F]">{label}</span>{help && <span className="mt-1 block text-[11px] leading-4 text-[#747474]">{help}</span>}<textarea rows={rows} className={`${inputClass} resize-y leading-6`} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Redactar y revisar profesionalmente…"/></label>
}

function ReportText({ value }: { value: string }) {
  return value.trim() ? <p className="whitespace-pre-line text-[13px] leading-[1.62] text-[#171717]">{value}</p> : <p className="onur-report-edit-only text-[13px] italic text-[#98A2B3]">Pendiente de completar por el profesional.</p>
}

function ReportFooter() {
  return <p className="onur-report-footer">Documento clínico confidencial</p>
}

function ReportHeader() {
  return <div className="mb-7 w-fit rounded-sm border border-[#AAB3BF] bg-white px-3 py-2"><Brand/></div>
}

function documentForSelection(documents: ClinicalDocumentRecord[], id: string) {
  return documents.find((document) => document.id === id)
}

export function TreatmentReportPage() {
  const { patientId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedReportId = searchParams.get('report') ?? ''
  const requestedCycleId = searchParams.get('cycle') ?? ''
  const { data: patient } = usePatient(patientId)
  const { data: cycles = [] } = useTreatmentCycles(patientId)
  const { data: sessions = [] } = useSessionAssignments(patientId)
  const { data: documents = [] } = usePatientDocuments(patientId)
  const { data: assessments = [] } = usePatientAssessments(patientId)
  const { data: studies = [] } = useClinicalStudies()
  const { data: reports = [] } = usePatientReports(patientId)
  const create = useCreateReport(patientId)

  const [cycleId, setCycleId] = useState(requestedCycleId)
  const [reportType, setReportType] = useState<ClinicalReportType>('finalization')
  const [emissionDate, setEmissionDate] = useState(new Date().toISOString().slice(0, 10))
  const [narratives, setNarratives] = useState<ClinicalReportNarratives>({ ...emptyClinicalReportNarratives })
  const [initialDocumentId, setInitialDocumentId] = useState('')
  const [finalDocumentId, setFinalDocumentId] = useState('')
  const [initialPageNumber, setInitialPageNumber] = useState(1)
  const [finalPageNumber, setFinalPageNumber] = useState(1)
  const [loadedReportId, setLoadedReportId] = useState('')
  const [error, setError] = useState('')

  const selectedCycle = cycles.find((cycle) => cycle.id === cycleId)
    ?? cycles.find((cycle) => cycle.id === requestedCycleId)
    ?? cycles.find((cycle) => cycle.status === 'active')
    ?? cycles[0]
  const selectedId = selectedCycle?.id ?? ''
  const { data: clinicalEpisode } = useClinicalEpisode(patientId, selectedId)
  const cycleSessions = useMemo(() => sessions.filter((item) => item.treatmentCycleId === selectedId).sort((a, b) => (a.completedAt || a.availableFrom).localeCompare(b.completedAt || b.availableFrom)), [selectedId, sessions])
  const cycleDocuments = useMemo(() => documents.filter((item) => item.treatmentCycleId === selectedId), [documents, selectedId])
  const posturographyDocuments = useMemo(() => cycleDocuments.filter((item) => item.documentType === 'posturography'), [cycleDocuments])
  const sessionPages = useMemo(() => {
    if (!cycleSessions.length) return [[]] as typeof cycleSessions[]
    const pages: typeof cycleSessions[] = []
    for (let index = 0; index < cycleSessions.length; index += 7) pages.push(cycleSessions.slice(index, index + 7))
    return pages
  }, [cycleSessions])
  const cycleAssessments = assessments.filter((item) => item.treatmentCycleId === selectedId)
  const perceptionComparison = assessmentComparison(assessments, selectedId)
  const relevantStudySummaries = studies.filter((study) => study.patientId === patientId && study.treatmentCycleId === selectedId && study.studyType === 'posturography')
  const studyQueries = useQueries({ queries: relevantStudySummaries.map((study) => ({ queryKey: ['study', study.id], queryFn: () => getStudyReview(study.id) })) })
  const studyReviews = studyQueries.map((query) => query.data).filter((study): study is NonNullable<typeof study> => Boolean(study))

  useEffect(() => {
    if (requestedReportId && requestedReportId !== loadedReportId) {
      const report = reports.find((item) => item.id === requestedReportId)
      if (!report) return
      setCycleId(report.treatmentCycleId)
      if (isClinicalReportTemplateSnapshot(report.snapshot)) {
        setReportType(report.snapshot.reportType)
        setEmissionDate(report.snapshot.emissionDate)
        setNarratives({ ...emptyClinicalReportNarratives, ...report.snapshot.narratives })
        setInitialDocumentId(report.snapshot.studyFigures.initial.documentId)
        setInitialPageNumber(report.snapshot.studyFigures.initial.pageNumber)
        setFinalDocumentId(report.snapshot.studyFigures.final.documentId)
        setFinalPageNumber(report.snapshot.studyFigures.final.pageNumber)
      } else {
        setNarratives({ ...emptyClinicalReportNarratives, conclusion: report.professionalSummary })
      }
      setLoadedReportId(report.id)
    }
  }, [loadedReportId, reports, requestedReportId])

  useEffect(() => {
    if (!posturographyDocuments.length) {
      setInitialDocumentId('')
      setFinalDocumentId('')
      return
    }
    const chronological = [...posturographyDocuments].sort((a, b) => a.documentDate.localeCompare(b.documentDate))
    const suggestedInitial = posturographyDocuments.find((item) => item.cyclePhase === 'initial') ?? chronological[0]
    const suggestedFinal = posturographyDocuments.find((item) => item.cyclePhase === 'final') ?? chronological.at(-1)
    setInitialDocumentId((current) => posturographyDocuments.some((item) => item.id === current) ? current : suggestedInitial?.id ?? '')
    setFinalDocumentId((current) => posturographyDocuments.some((item) => item.id === current) ? current : suggestedFinal?.id ?? '')
  }, [posturographyDocuments])

  const initialDocument = documentForSelection(documents, initialDocumentId)
  const finalDocument = documentForSelection(documents, finalDocumentId)
  const initialStudy = studyReviews.find((study) => study.sourceDocumentId === initialDocumentId)
  const finalStudy = studyReviews.find((study) => study.sourceDocumentId === finalDocumentId)
  const comparisonRows = buildClinicalComparison(initialStudy, finalStudy)
  const objectiveSentence = objectiveComparisonSentence(comparisonRows)
  const quantitativeRows = perceptionComparison ? [...comparisonRows, {
    key: 'perception',
    label: 'DHI',
    initial: `${perceptionComparison.initialTotal}/${perceptionComparison.maximumScore}`,
    final: `${perceptionComparison.finalTotal}/${perceptionComparison.maximumScore}`,
  }] : comparisonRows

  const setNarrative = (field: keyof ClinicalReportNarratives, value: string) => setNarratives((current) => ({ ...current, [field]: value }))
  const applyObjectiveSummary = () => {
    if (!objectiveSentence) return
    setNarratives((current) => ({ ...current, globalEvolution: current.globalEvolution || objectiveSentence, finalResult: current.finalResult || objectiveSentence }))
  }
  const applyClinicalEpisode = () => {
    if (!clinicalEpisode) return
    const summary = buildEpisodeClinicalSummary(clinicalEpisode)
    const synthesis = [
      pathologyLabel(clinicalEpisode.diagnosisCode),
      clinicalEpisode.onsetDate ? `inicio ${dateLabel(clinicalEpisode.onsetDate)}` : '',
      clinicalEpisode.phase !== 'unknown' ? `fase ${clinicalEpisode.phase}` : '',
      clinicalEpisode.measuredImpairments ? `Déficits medidos: ${clinicalEpisode.measuredImpairments}` : '',
      clinicalEpisode.activityLimitations ? `Limitaciones: ${clinicalEpisode.activityLimitations}` : '',
      clinicalEpisode.participationGoals ? `Metas: ${clinicalEpisode.participationGoals}` : '',
    ].filter(Boolean).join('. ')
    setNarratives((current) => ({
      ...current,
      clinicalSynthesis: current.clinicalSynthesis || `${synthesis}.`,
      startingPoint: current.startingPoint || `Planificación basada en déficit medido y meta funcional. ${summary.warnings.length ? `Precauciones: ${summary.warnings.join(' ')}` : ''}`.trim(),
    }))
  }

  const save = async (status: 'draft' | 'final') => {
    if (!selectedId) { setError('Seleccioná un ciclo de tratamiento.'); return }
    if (status === 'final' && (!narratives.clinicalSynthesis.trim() || !narratives.conclusion.trim())) {
      setError('Para versionar el informe final completá, como mínimo, la síntesis clínica y la conclusión profesional.')
      return
    }
    setError('')
    const snapshot = {
      schemaVersion: 'onur-clinical-report-v1' as const,
      reportType,
      emissionDate,
      narratives,
      studyFigures: {
        initial: { documentId: initialDocumentId, pageNumber: initialPageNumber },
        final: { documentId: finalDocumentId, pageNumber: finalPageNumber },
      },
      generatedAt: new Date().toISOString(),
      patient: { fullName: patient?.fullName ?? '', age: patient?.age ?? null, insurer: patient?.insurer ?? '', affiliateNumber: patient?.affiliateNumber ?? '' },
      cycle: { id: selectedId, label: selectedCycle?.label ?? '', startedOn: selectedCycle?.startedOn ?? '', endedOn: selectedCycle?.endedOn ?? '', status: selectedCycle?.status ?? '' },
      sessions: cycleSessions.map(sessionReportSnapshotItem),
      documents: cycleDocuments.map((item) => ({ id: item.id, type: item.documentType, phase: item.cyclePhase, date: item.documentDate, filename: item.originalFilename, description: item.description })),
      assessments: cycleAssessments.map((item) => ({ instrument: item.instrumentCode, version: item.instrumentVersion, phase: item.phase, date: item.assessmentDate, total: item.totalScore, answered: item.answeredCount, status: item.status, subscales: item.subscaleScores })),
      quantitativeComparison: quantitativeRows,
      clinicalEpisode,
    }
    try {
      await create.mutateAsync({ patientId, treatmentCycleId: selectedId, professionalSummary: narratives.conclusion, snapshot, status })
      navigate(`/app/pacientes/${patientId}`, { state: { notice: status === 'final' ? 'Informe final versionado y conservado en el perfil.' : 'Borrador de informe guardado.' } })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible guardar el informe.')
    }
  }

  const reportPeriodEnd = selectedCycle?.endedOn || emissionDate

  return <div className="space-y-7">
    <Link to={`/app/pacientes/${patientId}`} className="inline-flex items-center gap-2 text-xs font-black text-[#E49A02] print:hidden"><ChevronLeft size={16}/> Volver al perfil</Link>
    <PageHeader eyebrow="Informe clínico" title="Realizar informe" description="Plantilla de evolución o finalización basada en el formato clínico acordado. Los datos objetivos se completan desde el ciclo; la interpretación siempre la revisa el profesional." actions={<button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl border border-[#E9E7E7] bg-white px-4 py-3 text-sm font-black text-[#2F2F2F] print:hidden"><Printer size={17}/> Imprimir / guardar PDF</button>}/>

    <section className="onur-report-edit-only rounded-2xl border border-[#E9E7E7] bg-white p-6 sm:p-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-black text-[#2F2F2F]">Tipo de informe<select className={inputClass} value={reportType} onChange={(event) => setReportType(event.target.value as ClinicalReportType)}><option value="finalization">Finalización</option><option value="evolution">Evolución / seguimiento</option></select></label>
        <label className="text-xs font-black text-[#2F2F2F]">Ciclo<select className={inputClass} value={selectedId} onChange={(event) => setCycleId(event.target.value)}>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}</select></label>
        <label className="text-xs font-black text-[#2F2F2F]">Fecha de emisión<input type="date" className={inputClass} value={emissionDate} onChange={(event) => setEmissionDate(event.target.value)}/></label>
        <div className="rounded-2xl bg-[#FFF7E8] p-4 text-xs leading-5 text-[#7A5100]"><strong>Versión clínica:</strong> los informes finales no se sobrescriben; cada corrección crea una nueva versión trazable.</div>
      </div>

      <div className="mt-7 grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#E9E7E7] p-5"><h2 className="text-base font-black text-[#171717]">Estudio inicial incluido</h2><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]"><label className="text-xs font-black">Documento<select className={inputClass} value={initialDocumentId} onChange={(event) => setInitialDocumentId(event.target.value)}><option value="">Sin figura</option>{posturographyDocuments.map((item) => <option key={item.id} value={item.id}>{dateLabel(item.documentDate)} · {item.originalFilename}</option>)}</select></label><label className="text-xs font-black">Página<input type="number" min={1} className={inputClass} value={initialPageNumber} onChange={(event) => setInitialPageNumber(Math.max(1, Number(event.target.value) || 1))}/></label></div></div>
        <div className="rounded-2xl border border-[#E9E7E7] p-5"><h2 className="text-base font-black text-[#171717]">Estudio final incluido</h2><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]"><label className="text-xs font-black">Documento<select className={inputClass} value={finalDocumentId} onChange={(event) => setFinalDocumentId(event.target.value)}><option value="">Sin figura</option>{posturographyDocuments.map((item) => <option key={item.id} value={item.id}>{dateLabel(item.documentDate)} · {item.originalFilename}</option>)}</select></label><label className="text-xs font-black">Página<input type="number" min={1} className={inputClass} value={finalPageNumber} onChange={(event) => setFinalPageNumber(Math.max(1, Number(event.target.value) || 1))}/></label></div></div>
      </div>

      {objectiveSentence && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#B9D9C5] bg-[#F0F8F3] p-4"><p className="max-w-4xl text-xs leading-5 text-[#28613D]"><strong>Resumen objetivo disponible:</strong> {objectiveSentence} No agrega una interpretación clínica.</p><button type="button" onClick={applyObjectiveSummary} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-[#28613D]"><WandSparkles size={15}/> Usar como borrador</button></div>}
      {clinicalEpisode && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D9E7DF] bg-[#F8FCF9] p-4"><p className="max-w-4xl text-xs leading-5 text-[#28613D]"><strong>Episodio clínico disponible:</strong> {pathologyLabel(clinicalEpisode.diagnosisCode)} · {clinicalEpisode.status === 'reviewed' ? 'confirmado' : 'borrador'}. Puede completar la síntesis sin reemplazar tu revisión.</p><button type="button" onClick={applyClinicalEpisode} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-[#28613D]"><WandSparkles size={15}/> Incorporar al borrador</button></div>}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <NarrativeEditor label="Síntesis clínica *" value={narratives.clinicalSynthesis} onChange={(value) => setNarrative('clinicalSynthesis', value)} help="Motivo de consulta, tiempo de evolución, limitaciones funcionales, antecedentes relevantes y hallazgos de ingreso."/>
        <NarrativeEditor label="Evolución global" value={narratives.globalEvolution} onChange={(value) => setNarrative('globalEvolution', value)} help="Cambios clínicos y funcionales observados, sin atribuir causalidad automática."/>
        <NarrativeEditor label="Lectura general" value={narratives.generalReading} onChange={(value) => setNarrative('generalReading', value)} rows={3}/>
        <NarrativeEditor label="Cambio principal" value={narratives.mainChange} onChange={(value) => setNarrative('mainChange', value)} rows={3}/>
        <NarrativeEditor label="Integración de resultados" value={narratives.sensoryIntegration} onChange={(value) => setNarrative('sensoryIntegration', value)} rows={3}/>
        <NarrativeEditor label="Lectura del estudio inicial" value={narratives.initialInterpretation} onChange={(value) => setNarrative('initialInterpretation', value)} rows={3}/>
        <NarrativeEditor label="Punto de partida / plan inicial" value={narratives.startingPoint} onChange={(value) => setNarrative('startingPoint', value)} rows={3}/>
        <NarrativeEditor label="Resultado final" value={narratives.finalResult} onChange={(value) => setNarrative('finalResult', value)} rows={3}/>
        <NarrativeEditor label="Interpretación final" value={narratives.finalInterpretation} onChange={(value) => setNarrative('finalInterpretation', value)} rows={3}/>
        <NarrativeEditor label="Conclusión profesional *" value={narratives.conclusion} onChange={(value) => setNarrative('conclusion', value)}/>
        <NarrativeEditor label="Recomendaciones y continuidad" value={narratives.recommendations} onChange={(value) => setNarrative('recommendations', value)}/>
      </div>
      <p className="mt-6 text-xs leading-5 text-[#747474]">Los campos con * son obligatorios para cerrar una versión final. Si no existe una posturografía inicial o final, el informe puede emitirse sin figura y debe explicitar esa limitación en la interpretación.</p>
    </section>

    <section className="onur-report-document space-y-6" aria-label="Vista previa del informe clínico">
      <article className="onur-report-page">
        <ReportHeader/>
        <p className="text-[13px] font-black uppercase tracking-[.04em] text-[#2E75B6]">Informe clínico</p>
        <h1 className="mt-3 text-[30px] leading-tight text-[#132C4D]">{reportTitle(reportType)}</h1>
        <p className="mt-3 text-[18px] text-[#595959]">Comparación clínica y cronología de atención</p>
        <table className="mt-7 w-full border-collapse text-[12px]"><tbody>
          <tr><th>Paciente</th><td>{patient?.fullName ?? 'Paciente'}</td><th>Edad</th><td>{patient?.age ? `${patient.age} años` : '—'}</td></tr>
          <tr><th>Cobertura</th><td>{patient?.insurer || '—'}</td><th>Período</th><td>{dateLabel(selectedCycle?.startedOn ?? '')} al {dateLabel(reportPeriodEnd)}</td></tr>
          <tr><th>Documento</th><td>{reportType === 'finalization' ? 'Informe de finalización' : 'Informe de evolución'}</td><th>Emisión</th><td>{dateLabel(emissionDate)}</td></tr>
        </tbody></table>
        <h2 className="onur-report-heading mt-7">Síntesis clínica</h2><ReportText value={narratives.clinicalSynthesis}/>
        <h2 className="onur-report-heading mt-7">Evolución global</h2><ReportText value={narratives.globalEvolution}/>
        <div className="mt-4"><strong className="text-[12px] text-[#1F4E79]">Lectura general. </strong><span className="text-[12px] leading-6 text-[#171717]">{narratives.generalReading}</span></div>
        <ReportFooter/>
      </article>

      <article className="onur-report-page">
        <h2 className="onur-report-heading text-[24px]">Comparación cuantitativa</h2>
        {quantitativeRows.length ? <table className="mt-5 w-full border-collapse text-[12px]"><thead><tr><th>Indicador</th><th className="text-center">Inicial · {dateLabel(initialDocument?.documentDate ?? selectedCycle?.startedOn ?? '')}</th><th className="text-center">Final · {dateLabel(finalDocument?.documentDate ?? reportPeriodEnd)}</th></tr></thead><tbody>{quantitativeRows.map((row) => <tr key={row.key}><td>{row.label}</td><td className="text-center">{row.initial}</td><td className="text-center">{row.final}</td></tr>)}</tbody></table> : <p className="mt-6 rounded-xl border border-dashed border-[#BFC9D5] p-5 text-sm text-[#667085]">No hay métricas iniciales y finales estructuradas para comparar. El profesional puede emitir el informe y dejar constancia de esta limitación.</p>}
        <div className="mt-7"><strong className="text-[12px] text-[#1F4E79]">Cambio principal. </strong><span className="text-[12px] leading-6">{narratives.mainChange}</span></div>
        <div className="mt-5"><strong className="text-[12px] text-[#1F4E79]">Integración de resultados. </strong><span className="text-[12px] leading-6">{narratives.sensoryIntegration}</span></div>
        <ReportFooter/>
      </article>

      <article className="onur-report-page">
        <ReportHeader/>
        <h2 className="onur-report-heading text-[24px]">Registro posturográfico inicial</h2>
        <div className="onur-report-figure mt-5"><ReportSourceFigure document={initialDocument} pageNumber={initialPageNumber} label="Registro posturográfico inicial"/></div>
        <p className="mt-2 text-center text-[11px] italic text-[#595959]">Figura 1. Estudio inicial{initialDocument ? ` · ${dateLabel(initialDocument.documentDate)}` : ''}.</p>
        <div className="mt-5"><strong className="text-[12px] text-[#1F4E79]">Lectura inicial. </strong><span className="text-[12px] leading-6">{narratives.initialInterpretation}</span></div>
        <div className="mt-4"><strong className="text-[12px] text-[#1F4E79]">Punto de partida. </strong><span className="text-[12px] leading-6">{narratives.startingPoint}</span></div>
        <ReportFooter/>
      </article>

      <article className="onur-report-page">
        <ReportHeader/>
        <h2 className="onur-report-heading text-[24px]">Registro posturográfico final</h2>
        <div className="onur-report-figure mt-5"><ReportSourceFigure document={finalDocument} pageNumber={finalPageNumber} label="Registro posturográfico final"/></div>
        <p className="mt-2 text-center text-[11px] italic text-[#595959]">Figura 2. Estudio final{finalDocument ? ` · ${dateLabel(finalDocument.documentDate)}` : ''}.</p>
        <div className="mt-5"><strong className="text-[12px] text-[#1F4E79]">Resultado final. </strong><span className="text-[12px] leading-6">{narratives.finalResult}</span></div>
        <div className="mt-4"><strong className="text-[12px] text-[#1F4E79]">Interpretación. </strong><span className="text-[12px] leading-6">{narratives.finalInterpretation}</span></div>
        <ReportFooter/>
      </article>

      {sessionPages.map((pageSessions, pageIndex) => <article className="onur-report-page" key={`session-page-${pageIndex}`}>
        <ReportHeader/>
        <h2 className="onur-report-heading text-[24px]">Cronología de sesiones{pageIndex ? ' · continuación' : ''}</h2>
        <div className="mt-5 space-y-4">{pageSessions.length ? pageSessions.map((session, index) => {
          const retrospectiveEvent = session.eventLog?.find((event) => event.type === 'retrospective_session_recorded')
          return <div key={session.id} className={session.status === 'revoked' ? 'opacity-65 grayscale' : ''}>
            <h3 className="text-[14px] font-black text-[#1F4E79]">Sesión {pageIndex * 7 + index + 1} · {dateLabel((session.actualPerformedAt || session.completedAt || session.availableFrom).slice(0, 10))}</h3>
            {session.registeredRetrospectively && <p className="mt-1 text-[10px] font-black uppercase tracking-[.08em] text-[#28613D]">Registrada retrospectivamente{session.retrospectiveWithoutMetrics ? ' · sin métricas retrospectivas' : ''}{session.retrospectiveDevice ? ` · ${session.retrospectiveDevice}` : ''}</p>}
            <p className="mt-1 whitespace-pre-line text-[12px] leading-5">{session.professionalObservation || session.instructions || session.exercises.map((exercise) => exercise.name).join(', ') || session.title}</p>
            {retrospectiveEvent?.omitted_exercises?.length ? <p className="mt-1 text-[11px] leading-5 text-[#595959]"><strong>Ejercicios omitidos:</strong> {retrospectiveEvent.omitted_exercises.map((item) => `${item.exerciseName}: ${item.reason}`).join(' · ')}</p> : null}
            {session.status === 'omitted' && <p className="mt-1 text-[11px] font-bold text-[#8A5B00]">Sesión no realizada/cancelada. Motivo: {session.cancellationReason || 'no consignado'}.</p>}
            {session.status === 'revoked' && <p className="mt-1 text-[11px] font-bold text-[#595959]">Sesión anulada. Motivo: {session.revokedReason || 'no consignado'}.</p>}
          </div>
        }) : <p className="text-sm text-[#667085]">No hay sesiones registradas en este ciclo.</p>}</div>
        <ReportFooter/>
      </article>)}

      <article className="onur-report-page">
        <ReportHeader/>
        <h2 className="onur-report-heading text-[24px]">Conclusión</h2><ReportText value={narratives.conclusion}/>
        <h2 className="onur-report-heading mt-8 text-[20px]">Recomendaciones y continuidad</h2><ReportText value={narratives.recommendations}/>
        <ReportFooter/>
      </article>
    </section>

    {error && <p role="alert" className="rounded-2xl bg-[#FCECED] p-4 text-sm font-bold text-[#A94952] print:hidden">{error}</p>}
    <div className="flex flex-wrap justify-end gap-3 print:hidden"><button type="button" onClick={() => void save('draft')} disabled={create.isPending} className="inline-flex items-center gap-2 rounded-2xl border border-[#E9E7E7] bg-white px-5 py-3 text-sm font-black text-[#2F2F2F] disabled:opacity-60"><Save size={17}/> Guardar borrador</button><button type="button" onClick={() => void save('final')} disabled={create.isPending} className="inline-flex items-center gap-2 rounded-2xl bg-[#E49A02] px-5 py-3 text-sm font-black text-white disabled:opacity-60"><FileCheck2 size={17}/> Versionar informe final</button></div>
  </div>
}
