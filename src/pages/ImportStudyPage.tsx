import { AlertTriangle, ChevronLeft, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useUploadDocument } from '../features/documents/hooks'
import { cycleStudyPhaseLabels, type CycleStudyPhase } from '../features/documents/types'
import { ClinicalFileDropzone } from '../features/extraction/ClinicalFileDropzone'
import { extractFields } from '../features/extraction/extractor'
import { analyzeClinicalFile, releaseExtractionPreviews } from '../features/extraction/localOcr'
import { prepareClinicalUpload } from '../features/extraction/prepareClinicalUpload'
import { pageClassificationLabels, type IntakeKind, type LocalExtractionDraft, type PageClassification } from '../features/extraction/types'
import { usePatients } from '../features/patients/hooks'
import { useTreatmentCycles } from '../features/sessions/hooks'

const intakeOptions: Array<{ value: IntakeKind; title: string }> = [
  { value: 'posturography_bap', title: 'Posturografía' },
  { value: 'vestibular_and_reports', title: 'Vestibular, vHIT o informe clínico' },
]

const phaseOptions: CycleStudyPhase[] = ['initial', 'final', 'follow_up', 'unspecified']
const fieldClass = 'mt-2 h-12 w-full rounded-2xl border border-[#E9E7E7] bg-white px-4 text-sm text-[#171717]'

function phaseFromQuery(value: string | null): CycleStudyPhase {
  return phaseOptions.includes(value as CycleStudyPhase) ? value as CycleStudyPhase : 'unspecified'
}

export function ImportStudyPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data: patients = [] } = usePatients()
  const [patientId, setPatientId] = useState(params.get('patient') ?? '')
  const selectedPatient = patients.find((patient) => patient.id === patientId)
  const { data: cycles = [] } = useTreatmentCycles(patientId)
  const upload = useUploadDocument(patientId)
  const [intakeKind, setIntakeKind] = useState<IntakeKind>(params.get('kind') === 'vestibular' ? 'vestibular_and_reports' : 'posturography_bap')
  const [cyclePhase, setCyclePhase] = useState<CycleStudyPhase>(phaseFromQuery(params.get('phase')))
  const [cycleId, setCycleId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [preparedFile, setPreparedFile] = useState<File | null>(null)
  const [draft, setDraft] = useState<LocalExtractionDraft | null>(null)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const draftRef = useRef<LocalExtractionDraft | null>(null)

  useEffect(() => { setCycleId(cycles.find((cycle) => cycle.status === 'active')?.id ?? cycles[0]?.id ?? '') }, [cycles])
  useEffect(() => { draftRef.current = draft }, [draft])
  useEffect(() => () => releaseExtractionPreviews(draftRef.current), [])

  useEffect(() => {
    if (!files.length || !selectedPatient) { setPreparedFile(null); setDraft(null); setProgress(''); return }
    let cancelled = false
    releaseExtractionPreviews(draftRef.current)
    setError('')
    setDraft(null)
    setPreparedFile(null)
    setProgress(files.length > 1 ? `Reuniendo ${files.length} archivos en un único estudio…` : 'Preparando lectura local…')
    void prepareClinicalUpload(files)
      .then((prepared) => {
        if (cancelled) return null
        setPreparedFile(prepared.file)
        return analyzeClinicalFile(prepared.file, intakeKind, selectedPatient, (value) => {
          if (!cancelled) setProgress(value.phase === 'done' ? 'Lectura terminada.' : `Analizando página ${value.currentPage} de ${value.totalPages}`)
        })
      })
      .then((result) => { if (!result) return; if (!cancelled) setDraft(result); else releaseExtractionPreviews(result) })
      .catch((caught) => { if (!cancelled) { setError(caught instanceof Error ? caught.message : 'No fue posible analizar los archivos localmente.'); setProgress('') } })
    return () => { cancelled = true }
  }, [files, intakeKind, selectedPatient])

  const changeFiles = (next: File[]) => { releaseExtractionPreviews(draft); setDraft(null); setPreparedFile(null); setFiles(next); setError('') }
  const changeClassification = (pageNumber: number, classification: PageClassification) => setDraft((current) => {
    if (!current) return current
    const pages = current.pages.map((page) => page.pageNumber === pageNumber ? { ...page, classification } : page)
    return { ...current, pages, fields: extractFields(pages, current.intakeKind) }
  })
  const counts = useMemo(() => ({
    read: draft?.fields.filter((field) => field.professionalValue.trim()).length ?? 0,
    review: draft?.fields.filter((field) => field.professionalValue.trim() && field.status !== 'read').length ?? 0,
    missing: draft?.fields.filter((field) => field.required && !field.professionalValue.trim()).length ?? 0,
  }), [draft])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!patientId || !selectedPatient) { setError('Seleccioná primero al paciente.'); return }
    if (!preparedFile || !draft) { setError('Esperá a que termine la lectura de todos los archivos.'); return }
    if (!date) { setError('Indicá la fecha del documento.'); return }
    if (intakeKind === 'posturography_bap' && ['initial', 'final'].includes(cyclePhase) && !cycleId) { setError('Seleccioná el ciclo de la posturografía inicial o final.'); return }
    setError('')
    try {
      const sourceList = files.length > 1 ? `Archivos originales reunidos: ${files.map((file) => file.name).join(' · ')}` : ''
      const combinedDescription = [description.trim(), sourceList].filter(Boolean).join('\n')
      const result = await upload.mutateAsync({ patientId, treatmentCycleId: cycleId, documentType: intakeKind === 'posturography_bap' ? 'posturography' : 'clinical_report', cyclePhase: intakeKind === 'posturography_bap' ? cyclePhase : 'unspecified', documentDate: date, description: combinedDescription, shareWithPatient: false, file: preparedFile, deviceName: '', protocolCode: intakeKind === 'posturography_bap' ? 'bap-auto-review' : 'vestibular-auto-review', protocolVersion: '1', extractionDraft: draft })
      if (!result.studyId) throw new Error('El archivo se guardó, pero no se encontró el informe para revisar.')
      navigate(`/app/estudios/${result.studyId}/revisar`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No fue posible guardar el documento.') }
  }

  return <div className="space-y-7">
    <Link to={patientId ? `/app/pacientes/${patientId}` : '/app'} className="inline-flex items-center gap-2 text-xs font-black text-[#E49A02]"><ChevronLeft size={16}/> Volver</Link>
    <PageHeader eyebrow="Carga privada" title="Cargar estudio" description="Podés subir una o varias páginas; ONUr las reúne, las lee localmente y deja todos los valores para revisión profesional."/>

    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-5">
      <section className="rounded-2xl border border-[#E9E7E7] bg-white p-5 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-black text-[#2F2F2F]">Paciente *<select className={fieldClass} value={patientId} onChange={(event) => { setPatientId(event.target.value); changeFiles([]) }}><option value="">Seleccionar…</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}</select></label>
          <label className="text-sm font-black text-[#2F2F2F]">Tipo de estudio *<select className={fieldClass} value={intakeKind} onChange={(event) => { const next = event.target.value as IntakeKind; setIntakeKind(next); if (next !== 'posturography_bap') setCyclePhase('unspecified') }}>{intakeOptions.map((option) => <option key={option.value} value={option.value}>{option.title}</option>)}</select></label>
          <label className="text-sm font-black text-[#2F2F2F]">Fecha *<input type="date" className={fieldClass} value={date} onChange={(event) => setDate(event.target.value)}/></label>
          <label className="text-sm font-black text-[#2F2F2F]">Ciclo {intakeKind === 'posturography_bap' && ['initial', 'final'].includes(cyclePhase) ? '*' : ''}<select className={fieldClass} value={cycleId} onChange={(event) => setCycleId(event.target.value)}><option value="">Sin asociar</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}</select></label>
          {intakeKind === 'posturography_bap' && <label className="text-sm font-black text-[#2F2F2F] sm:col-span-2">Momento dentro del ciclo *<select className={fieldClass} value={cyclePhase} onChange={(event) => setCyclePhase(event.target.value as CycleStudyPhase)}>{phaseOptions.map((phase) => <option key={phase} value={phase}>{cycleStudyPhaseLabels[phase]}</option>)}</select><small className="mt-2 block font-normal leading-5 text-[#747474]">“Inicial” y “final” permiten comparar el mismo ciclo sin asumir una cantidad fija de sesiones.</small></label>}
        </div>

        <div className="mt-6"><ClinicalFileDropzone files={files} previewUrl={draft?.pages[0]?.previewUrl ?? ''} pageCount={draft?.pages.length ?? 0} disabled={upload.isPending} onFiles={changeFiles} onError={setError}/></div>

        {progress && <div role="status" className="mt-4 rounded-2xl bg-[#FFF7E8] p-4 text-sm font-black text-[#A36B00]">{progress}</div>}
        {draft && <div className="mt-4 rounded-2xl border border-[#E9E7E7] bg-[#F7F6F4] p-4"><p className="text-sm font-black text-[#2F2F2F]">{counts.read} parámetros obtenidos</p><p className="mt-1 text-xs text-[#747474]">{counts.review} dudosos · {counts.missing} obligatorios faltantes · {draft.pages.length} página(s)</p></div>}
        {draft?.patientMatchStatus === 'mismatch' && <div className="mt-4 flex gap-3 rounded-2xl border border-[#efc3c7] bg-[#fceced] p-4"><AlertTriangle className="shrink-0 text-[#a94952]" size={20}/><p className="text-xs leading-5 text-[#8d3c45]"><strong>Posible discrepancia de identidad.</strong> Se confirmará en el informe sin cambiar el paciente automáticamente.</p></div>}

        {draft && (draft.pages.length > 1 || draft.pages.some((page) => page.classification === 'unrecognized')) && <details className="mt-4 rounded-2xl border border-[#E9E7E7] p-4"><summary className="cursor-pointer text-xs font-black text-[#2F2F2F]">Revisar páginas</summary><div className="mt-4 grid gap-3 sm:grid-cols-2">{draft.pages.map((page) => <label key={page.pageNumber} className="text-xs font-bold text-[#747474]">Página {page.pageNumber}<select value={page.classification} onChange={(event) => changeClassification(page.pageNumber, event.target.value as PageClassification)} className="mt-1 h-10 w-full rounded-xl border border-[#E9E7E7] px-3 text-xs">{Object.entries(pageClassificationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}</div></details>}

        <details className="mt-4"><summary className="cursor-pointer text-xs font-bold text-[#747474]">Agregar una descripción</summary><textarea className="mt-3 min-h-20 w-full rounded-2xl border border-[#E9E7E7] p-4 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contexto opcional, sin interpretar el estudio."/></details>
        <div className="mt-5 flex gap-3 rounded-2xl bg-[#F7F6F4] p-4"><ShieldCheck className="shrink-0 text-[#E49A02]" size={20}/><p className="text-xs leading-5 text-[#747474]">El original combinado permanece privado. La preparación y el OCR ocurren en este navegador; cada resultado requiere confirmación profesional.</p></div>

        {error && <p role="alert" className="mt-4 rounded-2xl bg-[#fceced] p-4 text-sm font-bold text-[#a94952]">{error}</p>}
        <button disabled={!draft || upload.isPending} className="mt-6 w-full rounded-2xl bg-[#E49A02] px-5 py-4 text-sm font-black text-white disabled:opacity-50">{upload.isPending ? 'Guardando…' : 'Continuar al informe'}</button>
      </section>
    </form>
  </div>
}
