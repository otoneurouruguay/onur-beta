import { AlertTriangle, CheckCircle2, ClipboardCheck, FilePenLine, LoaderCircle, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { normalizeMetricRow } from '../studies/normalization'
import { EXTRACTOR_VERSION } from './extractor'
import { analyzeClinicalFile, releaseExtractionPreviews } from './localOcr'
import type { ExtractedField, PageClassification, PatientMatchStatus } from './types'
import { pageClassificationLabels } from './types'
import { useConfirmExtraction, useDiscardExtraction, useManualExtraction, useReplaceExtraction, useSaveExtraction, useStudyExtraction } from './hooks'
import type { ExtractionReviewRecord } from './repository'
import { PrivateDocumentViewer } from './PrivateDocumentViewer'
import { buildBapAutomaticReport } from './bapAutomaticReport'
import { isReportRelevantField, isReportRequiredField } from './reportFields'

const control = 'h-11 rounded-xl border border-[#E9E7E7] bg-white px-3 text-sm text-[#171717]'

function normalizedField(field: ExtractedField, value: string) {
  if (!field.metricCode) return value.trim()
  const normalized = normalizeMetricRow({ clientId: field.clientId, metricCode: field.metricCode, rawValue: value, unitCode: field.unitCode, conditionCode: field.conditionCode, side: field.side, axis: '', trialNumber: '', sourceLocation: `Página ${field.pageNumber}` })
  return normalized.normalizedNumericValue !== null ? String(normalized.normalizedNumericValue) : normalized.normalizedTextValue ?? value.trim()
}

export function ClinicalExtractionReview({ studyId }: { studyId: string }) {
  const navigate = useNavigate()
  const query = useStudyExtraction(studyId)
  const save = useSaveExtraction(studyId)
  const confirm = useConfirmExtraction(studyId)
  const manual = useManualExtraction(studyId)
  const discard = useDiscardExtraction(studyId)
  const replace = useReplaceExtraction(studyId)
  const replaceCandidates = replace.mutateAsync
  const reprocessed = useRef(new Set<string>())
  const autoFilled = useRef(new Set<string>())
  const [draft, setDraft] = useState<ExtractionReviewRecord | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [selectedField, setSelectedField] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [reprocessStatus, setReprocessStatus] = useState('')
  const [editedFieldIds, setEditedFieldIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (query.data) {
      setDraft(query.data)
      setPageNumber(query.data.sectionPageNumbers[0] ?? 1)
      setEditedFieldIds(new Set())
    }
  }, [query.data])

  useEffect(() => {
    const record = query.data
    if (!record || record.status !== 'review' || record.extractorVersion === EXTRACTOR_VERSION || !record.documentUrl || reprocessed.current.has(record.id)) return
    reprocessed.current.add(record.id)
    let cancelled = false
    setError('')
    setReprocessStatus('Mejorando la lectura de la imagen…')
    void fetch(record.documentUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error('No fue posible abrir el original privado para reanalizarlo.')
        const blob = await response.blob()
        const file = new File([blob], record.sourceFilename, { type: record.mimeType || blob.type })
        return analyzeClinicalFile(file, record.intakeKind, { fullName: '', birthDate: '', affiliateNumber: '' }, (progress) => {
          if (!cancelled) setReprocessStatus(progress.phase === 'done' ? 'Actualizando parámetros…' : `Reanalizando página ${progress.currentPage} de ${progress.totalPages}`)
        })
      })
      .then(async (result) => {
        if (cancelled) { releaseExtractionPreviews(result); return }
        try { await replaceCandidates({ jobId: record.id, draft: result }) }
        finally { releaseExtractionPreviews(result) }
        if (!cancelled) { setReprocessStatus(''); setNotice('La imagen fue reanalizada con el lector mejorado.') }
      })
      .catch((caught) => {
        if (!cancelled) { setReprocessStatus(''); setError(caught instanceof Error ? caught.message : 'No fue posible reanalizar el original privado.') }
      })
    return () => { cancelled = true }
  }, [query.data, replaceCandidates])

  const parameters = useMemo(() => draft?.fields.filter((field) => isReportRelevantField(field) && (field.professionalValue.trim() || isReportRequiredField(field))) ?? [], [draft])
  const missing = useMemo(() => parameters.filter((field) => isReportRequiredField(field) && !field.professionalValue.trim()), [parameters])
  const studyType = draft?.fields.find((field) => field.studyType === 'posturography') ? 'posturography' : 'vhit'
  const automaticReport = useMemo(() => draft ? buildBapAutomaticReport(draft.fields, draft.cyclePhase ?? 'unspecified') : null, [draft])
  const reviewCount = parameters.filter((field) => field.professionalValue.trim() && !field.confirmed && (field.status !== 'read' || field.confidence < .82)).length
  const activeField = draft?.fields.find((field) => field.clientId === selectedField)
  const blocking = missing.length > 0 || !draft?.professionalConclusion.trim() || !draft.rehabilitationSuggestion.trim() || draft.patientMatchStatus === 'mismatch' || draft.pages.some((item) => item.classification === 'unrecognized')

  const updateField = (clientId: string, updater: (field: ExtractedField) => ExtractedField) => setDraft((current) => current ? { ...current, fields: current.fields.map((field) => field.clientId === clientId ? updater(field) : field) } : current)
  const updateValue = (field: ExtractedField, value: string) => {
    updateField(field.clientId, (current) => ({ ...current, professionalValue: value, normalizedValue: normalizedField(current, value), status: value.trim() ? 'review' : 'unrecognized', confirmed: false }))
    setEditedFieldIds((current) => new Set(current).add(field.clientId))
    setNotice('')
  }
  const updateClassification = (targetPage: number, classification: PageClassification) => setDraft((current) => current ? { ...current, pages: current.pages.map((item) => item.pageNumber === targetPage ? { ...item, classification } : item) } : current)
  const updateMatch = (status: PatientMatchStatus) => setDraft((current) => current ? { ...current, patientMatchStatus: status } : current)

  useEffect(() => {
    if (!draft || draft.status !== 'review' || !automaticReport) return
    const key = `${draft.id}:${draft.extractorVersion}`
    if (autoFilled.current.has(key)) return
    autoFilled.current.add(key)
    setDraft((current) => {
      if (!current || current.id !== draft.id) return current
      const needsConclusion = !current.professionalConclusion.trim()
      const needsSuggestion = !current.rehabilitationSuggestion.trim()
      if (!needsConclusion && !needsSuggestion) return current
      return {
        ...current,
        professionalConclusion: needsConclusion ? automaticReport.conclusion : current.professionalConclusion,
        rehabilitationSuggestion: needsSuggestion ? automaticReport.rehabilitationSuggestion : current.rehabilitationSuggestion,
      }
    })
  }, [automaticReport, draft])

  const applyAutomaticReport = () => {
    if (!draft || !automaticReport) { setError('Completá los parámetros de la posturografía para generar el borrador automático.'); return }
    const replacesText = Boolean(draft.professionalConclusion.trim() || draft.rehabilitationSuggestion.trim())
    const alreadyCurrent = draft.professionalConclusion === automaticReport.conclusion && draft.rehabilitationSuggestion === automaticReport.rehabilitationSuggestion
    if (replacesText && !alreadyCurrent && !window.confirm('¿Reemplazar los textos actuales por un nuevo borrador basado en los parámetros mostrados?')) return
    setDraft({ ...draft, professionalConclusion: automaticReport.conclusion, rehabilitationSuggestion: automaticReport.rehabilitationSuggestion })
    setError('')
    setNotice('Borrador automático actualizado. Podés editar ambos textos antes de confirmar.')
  }

  const applyParameterCorrections = () => {
    if (!draft || editedFieldIds.size === 0) return
    const correctedCount = draft.fields.filter((field) => editedFieldIds.has(field.clientId) && field.professionalValue.trim()).length
    setDraft({
      ...draft,
      fields: draft.fields.map((field) => {
        if (!editedFieldIds.has(field.clientId)) return field
        const value = field.professionalValue.trim()
        return {
          ...field,
          professionalValue: value,
          normalizedValue: normalizedField(field, value),
          status: value ? 'read' : 'unrecognized',
          confirmed: Boolean(value),
        }
      }),
    })
    setEditedFieldIds(new Set())
    setError('')
    setNotice(correctedCount > 0
      ? `${correctedCount} ${correctedCount === 1 ? 'corrección aplicada' : 'correcciones aplicadas'}. Se actualizaron los estados y los datos faltantes sin volver a procesar el documento.`
      : 'Se actualizaron los datos faltantes sin volver a procesar el documento.')
  }

  const saveDraft = async () => {
    if (!draft) return
    setError(''); setNotice('')
    try { await save.mutateAsync(draft); setNotice('Borrador guardado.') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible guardar el borrador.') }
  }

  const confirmDraft = async () => {
    if (!draft) return
    if (blocking) { setError('Completá los datos marcados, la conclusión y la sugerencia profesional antes de generar el informe.'); return }
    const confirmedDraft: ExtractionReviewRecord = {
      ...draft,
      fields: draft.fields.map((field) => isReportRelevantField(field) && field.professionalValue.trim()
        ? { ...field, confirmed: true, status: 'read' }
        : { ...field, confirmed: false }),
    }
    setError(''); setNotice('')
    try {
      await save.mutateAsync(confirmedDraft)
      await confirm.mutateAsync(confirmedDraft.id)
      setDraft({ ...confirmedDraft, status: 'confirmed' })
      navigate(`/app/estudios/${studyId}/informe`, { replace: true })
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible generar el informe.') }
  }

  const chooseManual = async () => {
    if (!draft || !window.confirm('¿Continuar con carga completamente manual?')) return
    setError('')
    try { await manual.mutateAsync(draft.id); setDraft({ ...draft, status: 'manual' }) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible cambiar a carga manual.') }
  }

  const discardDraft = async () => {
    if (!draft || !window.confirm('¿Descartar el borrador automático? El original privado se conservará.')) return
    setError('')
    try { await discard.mutateAsync(draft.id); setDraft({ ...draft, status: 'discarded' }) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible descartar el borrador.') }
  }

  if (query.isPending) return <div className="rounded-2xl border border-[#E9E7E7] bg-white p-6 text-sm text-[#747474]">Cargando parámetros…</div>
  if (!draft) return null
  const locked = draft.status !== 'review'

  return <section className="space-y-5">
    <div className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] px-5 py-4 text-xs leading-5 text-[#8A5B00]"><strong>Revisión profesional obligatoria.</strong> ONUr transcribe parámetros y controla si el documento contiene los datos mínimos para una lectura interpretable; no diagnostica ni define tratamientos. La conclusión y la rehabilitación solo forman parte del informe después de ser revisadas y confirmadas por el profesional.</div>

    {reprocessStatus && <div role="status" className="flex items-center gap-3 rounded-2xl bg-[#FFF7E8] p-4 text-sm font-black text-[#A36B00]"><LoaderCircle className="animate-spin" size={18}/>{reprocessStatus}</div>}
    {draft.patientMatchStatus === 'mismatch' && <div className="rounded-2xl border border-[#efc3c7] bg-[#fceced] p-4"><div className="flex gap-3"><AlertTriangle className="shrink-0 text-[#a94952]"/><p className="text-sm font-black text-[#8d3c45]">La identidad del documento no coincide completamente con el paciente seleccionado.</p></div><label className="mt-3 flex items-start gap-3 text-xs font-bold text-[#8d3c45]"><input type="checkbox" onChange={(event) => updateMatch(event.target.checked ? 'confirmed_by_professional' : 'mismatch')}/> Confirmo que el documento corresponde a este paciente.</label></div>}
    {locked && <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-4"><CheckCircle2 className="text-[#A36B00]"/><p className="mr-auto text-sm font-black text-[#7A5100]">{draft.status === 'confirmed' ? 'Informe confirmado.' : draft.status === 'manual' ? 'Carga manual seleccionada.' : 'Borrador descartado.'}</p>{draft.status === 'confirmed' && <Link to={`/app/estudios/${studyId}/informe`} className="rounded-xl border border-[#E8CE99] bg-white px-3 py-2 text-xs font-black text-[#A36B00]">Ver informe</Link>}</div>}

    <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <section className="overflow-hidden rounded-2xl border border-[#E9E7E7] bg-white">
        <div className="border-b border-[#E9E7E7] p-5"><h2 className="font-black text-[#171717]">Estudio original</h2><p className="mt-1 text-xs text-[#747474]">Página {pageNumber} de {draft.pages.length} · {draft.sourceFilename}</p></div>
        <div className="relative min-h-[500px] bg-[#E9E7E7]"><PrivateDocumentViewer url={draft.documentUrl} mimeType={draft.mimeType} pageNumber={pageNumber} region={activeField?.pageNumber === pageNumber ? activeField.region : null}/></div>
        {draft.pages.length > 1 && <div className="flex gap-2 overflow-x-auto border-t border-[#E9E7E7] p-3">{draft.pages.map((item) => <button key={item.pageNumber} type="button" onClick={() => setPageNumber(item.pageNumber)} className={`min-w-20 rounded-xl border px-3 py-2 text-left text-xs ${item.pageNumber === pageNumber ? 'border-[#E49A02] bg-[#FFF7E8]' : 'border-[#E9E7E7]'}`}>Pág. {item.pageNumber}</button>)}</div>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E9E7E7] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#E9E7E7] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-[#171717]">Parámetros obtenidos</h2><p className="mt-1 text-xs text-[#747474]">{parameters.filter((field) => field.professionalValue.trim()).length} detectados · {reviewCount} para revisar · {missing.length} faltantes</p></div>{!locked && <button type="button" onClick={applyParameterCorrections} disabled={editedFieldIds.size === 0} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#E8CE99] bg-[#FFF7E8] px-3 py-2 text-xs font-black text-[#A36B00] disabled:cursor-not-allowed disabled:opacity-45"><RefreshCw size={14}/> Aplicar correcciones{editedFieldIds.size > 0 ? ` (${editedFieldIds.size})` : ''}</button>}</div>
        {missing.length > 0 && <p className="border-b border-[#efc3c7] bg-[#fff7f7] px-5 py-3 text-xs font-bold text-[#a94952]">Falta completar o consignar como “no informado”: {missing.map((field) => field.label).join(' · ')}</p>}
        <p className="border-b border-[#E9E7E7] bg-[#F7F6F4] px-5 py-3 text-xs leading-5 text-[#747474]">{studyType === 'posturography' ? 'Se muestran únicamente los datos que alimentan el informe funcional y la sugerencia: edad, seis condiciones, puntaje compuesto, índices sensoriales, preferencia visual y controles de calidad relevantes. El resto permanece disponible en el estudio original y no requiere transcripción.' : 'Se muestran únicamente los datos que alimentan el informe y orientan la sugerencia: protocolo HIMP, plano y canales, ganancias, simetría, sacadas e interpretabilidad. Los demás hallazgos del examen permanecen en el estudio original y no requieren transcripción.'}</p>
        <div className="max-h-[660px] divide-y divide-[#E9E7E7] overflow-y-auto">{parameters.map((field) => <label key={field.clientId} onClick={() => { setSelectedField(field.clientId); setPageNumber(field.pageNumber) }} className={`grid cursor-pointer gap-2 p-4 sm:grid-cols-[1fr_170px] sm:items-center ${selectedField === field.clientId ? 'bg-[#FFF7E8]' : ''}`}>
          <span><span className="flex flex-wrap items-center gap-2 text-sm font-black text-[#2F2F2F]">{field.label}{isReportRequiredField(field) ? ' *' : ''}<span className={`rounded-full px-2 py-0.5 text-[9px] uppercase ${field.confirmed ? 'bg-[#EEF5F0] text-[#496451]' : field.status === 'read' && field.confidence >= .82 ? 'bg-[#FFF7E8] text-[#A36B00]' : field.professionalValue ? 'bg-[#FFF7E8] text-[#8A5B00]' : 'bg-[#fceced] text-[#a94952]'}`}>{field.confirmed ? 'Corregido' : editedFieldIds.has(field.clientId) ? 'Editado' : field.status === 'read' && field.confidence >= .82 ? 'Leído' : field.professionalValue ? 'Revisar' : 'Falta'}</span></span>{field.rawValue && <small className="mt-1 block text-[10px] text-[#747474]">Detectado: {field.rawValue} · pág. {field.pageNumber}</small>}</span>
          <input disabled={locked} aria-label={field.label} value={field.professionalValue} onChange={(event) => updateValue(field, event.target.value)} className={`${control} w-full ${!field.professionalValue ? 'border-[#df9fa5]' : ''}`}/>
        </label>)}</div>
        {parameters.length === 0 && <p className="p-6 text-sm text-[#747474]">No se reconocieron parámetros. El original puede pasarse a carga manual.</p>}
      </section>
    </div>

    <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex items-center gap-2"><Sparkles size={18} className="text-[#E49A02]"/><h2 className="font-black text-[#171717]">Conclusión y rehabilitación</h2></div><p className="mt-1 max-w-3xl text-xs leading-5 text-[#747474]">{studyType === 'posturography' ? 'ONUr genera un borrador preliminar con los parámetros mostrados y las referencias BAP por edad. Podés corregirlo libremente; nunca reemplaza tu criterio profesional.' : 'En vHIT, ONUr transcribe el estudio y controla los datos críticos. La interpretación y la recomendación se completan profesionalmente porque dependen de síntomas, examen, calidad técnica, equipo y patrón de sacadas.'}</p></div>
        {!locked && studyType === 'posturography' && <button type="button" onClick={applyAutomaticReport} disabled={!automaticReport} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#E8CE99] bg-[#FFF7E8] px-3 py-2 text-xs font-black text-[#A36B00] disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={14}/> Regenerar desde parámetros</button>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-[#FFF7E8] px-2.5 py-1 text-[10px] font-black uppercase text-[#A36B00]">Borrador automático</span><span className="rounded-full bg-[#E9E7E7] px-2.5 py-1 text-[10px] font-black uppercase text-[#747474]">Editable</span><span className="rounded-full bg-[#FFF7E8] px-2.5 py-1 text-[10px] font-black uppercase text-[#8A5B00]">Confirmación obligatoria</span></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <label className="text-sm font-black text-[#2F2F2F]">Conclusión para confirmar *<textarea disabled={locked} aria-label="Conclusión para confirmar" value={draft.professionalConclusion} onChange={(event) => setDraft({ ...draft, professionalConclusion: event.target.value })} className="mt-2 min-h-44 w-full rounded-2xl border border-[#E9E7E7] p-4 text-sm font-normal leading-6" placeholder="El borrador aparecerá cuando haya parámetros suficientes."/><small className="mt-1 block font-normal text-[#747474]">Editá cualquier frase que no coincida con tu interpretación.</small></label>
        <label className="text-sm font-black text-[#2F2F2F]">Sugerencia de rehabilitación para confirmar *<textarea disabled={locked} aria-label="Sugerencia de rehabilitación para confirmar" value={draft.rehabilitationSuggestion} onChange={(event) => setDraft({ ...draft, rehabilitationSuggestion: event.target.value })} className="mt-2 min-h-44 w-full rounded-2xl border border-[#E9E7E7] p-4 text-sm font-normal leading-6" placeholder="El borrador aparecerá cuando haya parámetros suficientes."/><small className="mt-1 block font-normal text-[#747474]">Ajustá objetivos, dosis, progresión y precauciones según la valoración clínica.</small></label>
      </div>
      {automaticReport && <details className="mt-5 rounded-2xl border border-[#E9E7E7] bg-[#F7F6F4] p-4"><summary className="cursor-pointer text-xs font-black text-[#2F2F2F]">Cómo se generó este borrador</summary><div className="mt-3 grid gap-4 text-xs leading-5 text-[#747474] lg:grid-cols-2"><div><p className="font-black text-[#2F2F2F]">Comparaciones utilizadas</p>{automaticReport.evidence.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{automaticReport.evidence.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-2">No hubo desvíos comparables o faltan datos para seleccionar referencias.</p>}{automaticReport.warnings.length > 0 && <div className="mt-3 rounded-xl bg-[#FFF7E8] p-3 font-bold text-[#8A5B00]">{automaticReport.warnings.join(' ')}</div>}</div><div><p className="font-black text-[#2F2F2F]">Fuentes internas seguras</p><ul className="mt-2 list-disc space-y-1 pl-5">{automaticReport.sources.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-3">No se utilizaron informes ni imágenes de la carpeta de datos clínicos sensibles.</p></div></div></details>}
    </section>

    {(draft.pages.length > 1 || draft.pages.some((item) => item.classification === 'unrecognized')) && <details className="rounded-2xl border border-[#E9E7E7] bg-white p-4"><summary className="cursor-pointer text-xs font-black text-[#2F2F2F]">Revisar clasificación de páginas</summary><div className="mt-4 grid gap-3 sm:grid-cols-2">{draft.pages.map((item) => <label key={item.pageNumber} className="text-xs font-bold text-[#747474]">Página {item.pageNumber}<select disabled={locked} value={item.classification} onChange={(event) => updateClassification(item.pageNumber, event.target.value as PageClassification)} className={`${control} mt-1 w-full`}>{Object.entries(pageClassificationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}</div></details>}

    {error && <p role="alert" className="rounded-2xl bg-[#fceced] p-4 text-sm font-bold text-[#a94952]">{error}</p>}
    {notice && <p role="status" className="rounded-2xl bg-[#FFF7E8] p-4 text-sm font-bold text-[#A36B00]">{notice}</p>}

    {!locked && <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={saveDraft} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E49A02] px-4 py-3 text-xs font-black text-[#E49A02]"><Save size={15}/> Guardar para después</button><button type="button" onClick={confirmDraft} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#E49A02] px-5 py-3 text-sm font-black text-white"><ClipboardCheck size={17}/> Confirmar y ver informe</button></div>}
    {!locked && <details className="text-right"><summary className="cursor-pointer text-xs font-bold text-[#747474]">Opciones avanzadas</summary><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={chooseManual} className="inline-flex items-center gap-2 rounded-xl border border-[#E9E7E7] px-3 py-2 text-xs font-bold text-[#2F2F2F]"><FilePenLine size={14}/> Carga manual</button><button type="button" onClick={discardDraft} className="inline-flex items-center gap-2 rounded-xl border border-[#efc3c7] px-3 py-2 text-xs font-bold text-[#a94952]"><Trash2 size={14}/> Descartar</button></div></details>}
  </section>
}
