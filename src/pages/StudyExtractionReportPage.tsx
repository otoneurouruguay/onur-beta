import { ChevronLeft, FileCheck2, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useStudyExtraction } from '../features/extraction/hooks'
import { buildStudyExtractionReport } from '../features/extraction/report'
import { useStudyReview } from '../features/studies/hooks'

export function StudyExtractionReportPage() {
  const { studyId = '' } = useParams()
  const { data: study, isPending: studyPending, error: studyError } = useStudyReview(studyId)
  const { data: extraction, isPending: extractionPending, error: extractionError } = useStudyExtraction(studyId)

  if (studyPending || extractionPending) return <p className="text-sm text-[#747474]">Cargando informe…</p>
  if (studyError || extractionError || !study) {
    const error = studyError ?? extractionError
    return <p role="alert" className="rounded-2xl bg-[#fceced] p-4 text-sm font-bold text-[#a94952]">{error instanceof Error ? error.message : 'Estudio no encontrado.'}</p>
  }

  const report = extraction ? buildStudyExtractionReport(extraction, study.studyType) : null
  const reviewPath = `/app/estudios/${studyId}/revisar`

  if (!report) return <div className="space-y-7">
    <Link to={reviewPath} className="inline-flex items-center gap-2 text-xs font-black text-[#E49A02]"><ChevronLeft size={16}/> Volver a la revisión</Link>
    <PageHeader eyebrow="Estudio clínico" title="Informe pendiente" description="El informe se habilita al confirmar los parámetros, la conclusión y la sugerencia de rehabilitación."/>
    <section className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-6 text-sm leading-6 text-[#8A5B00]">Todavía no hay un informe confirmado para este estudio. ONUr no muestra ni genera una conclusión automática a partir del OCR.</section>
  </div>

  return <div className="space-y-7 print:bg-white">
    <Link to={reviewPath} className="inline-flex items-center gap-2 text-xs font-black text-[#E49A02] print:hidden"><ChevronLeft size={16}/> Volver a la revisión</Link>
    <PageHeader eyebrow="Estudio clínico" title={`Informe de ${study.studyType === 'posturography' ? 'posturografía' : 'vHIT'}`} description={`${study.patientName} · ${study.performedAt.slice(0, 10)} · ${study.sourceFilename}`} actions={<button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl border border-[#E9E7E7] bg-white px-4 py-3 text-sm font-black text-[#2F2F2F] print:hidden"><Printer size={17}/> Imprimir / PDF</button>}/>

    <section className="overflow-hidden rounded-2xl border border-[#E9E7E7] bg-white">
      <div className="border-b border-[#E9E7E7] p-6 sm:p-8"><div className="flex items-start gap-3"><FileCheck2 className="mt-0.5 shrink-0 text-[#A36B00]" size={21}/><div><h2 className="text-lg font-black text-[#171717]">Datos confirmados por el profesional</h2><p className="mt-1 text-xs leading-5 text-[#747474]">Este informe reproduce los valores confirmados; no interpreta el estudio ni modifica los datos originales.</p></div></div></div>
      {report.parameters.length === 0 ? <p className="p-6 text-sm text-[#747474]">No hay parámetros confirmados para este estudio.</p> : <dl className="divide-y divide-[#E9E7E7]">{report.parameters.map((parameter) => <div key={parameter.code} className="grid gap-1 px-6 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-8"><dt className="text-sm font-bold text-[#2F2F2F]">{parameter.label}</dt><dd className="text-sm font-black text-[#171717]">{parameter.value}</dd></div>)}</dl>}
    </section>

    {report.qualityControls.length > 0 && <section className="overflow-hidden rounded-2xl border border-[#E9E7E7] bg-white"><div className="border-b border-[#E9E7E7] p-6 sm:p-8"><h2 className="text-lg font-black text-[#171717]">Controles de calidad</h2><p className="mt-1 text-xs leading-5 text-[#747474]">Valores impresos por el equipo, sin interpretación automática de puntos de corte.</p></div><dl className="divide-y divide-[#E9E7E7]">{report.qualityControls.map((parameter) => <div key={parameter.code} className="grid gap-1 px-6 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-8"><dt className="text-sm font-bold text-[#2F2F2F]">{parameter.label}</dt><dd className="text-sm font-black text-[#171717]">{parameter.value}</dd></div>)}</dl></section>}

    {report.limitations.length > 0 && <section className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-6 sm:p-8"><h2 className="text-lg font-black text-[#7A5100]">Limitaciones</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#8A5B00]">{report.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></section>}

    <section className="grid gap-5 lg:grid-cols-2">
      <article className="rounded-2xl border border-[#E9E7E7] bg-white p-6 sm:p-8"><h2 className="text-lg font-black text-[#171717]">Impresión profesional</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#2F2F2F]">{report.conclusion}</p></article>
      <article className="rounded-2xl border border-[#E9E7E7] bg-white p-6 sm:p-8"><h2 className="text-lg font-black text-[#171717]">Sugerencia de rehabilitación</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#2F2F2F]">{report.rehabilitationSuggestion}</p></article>
    </section>

    <aside className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-4 text-xs leading-5 text-[#8A5B00]">ONUr organiza la transcripción confirmada. La conclusión y la sugerencia de rehabilitación fueron redactadas por el profesional; la aplicación no diagnostica ni prescribe automáticamente.</aside>
  </div>
}
