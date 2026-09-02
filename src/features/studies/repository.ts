import { suggestions as demoSuggestionSeed } from '../../data/demo'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { CycleStudyPhase } from '../documents/types'
import type { SuggestionStatus } from '../../types/domain'
import type { ClinicalStudyReview, ClinicalStudySummary, MetricRowInput, NormalizedMetricRow, SaveStudyImportInput, SaveStudyImportResult, StatisticalSuggestionRecord, StudyType } from './types'

const IMPORT_STORAGE_KEY = 'onur-demo-study-imports-v1'
const SUGGESTION_STORAGE_KEY = 'onur-demo-statistical-suggestions-v2'
const DOCUMENT_STORAGE_KEY = 'onur-demo-documents-v1'
const PATIENT_STORAGE_KEY = 'onur-demo-patients-v1'

interface StoredImport {
  metrics: MetricRowInput[]
  status: ClinicalStudyReview['status']
  qualityNotes: string
  interpretable: boolean
}

const demoPatients: Record<string, string> = {
  'ana-p': 'Ana Pereira', 'luis-s': 'Luis Silva', 'marta-r': 'Marta Rodríguez', 'jorge-m': 'Jorge Martínez', 'elena-f': 'Elena Fernández',
}

const demoStudies: Record<string, ClinicalStudyReview> = {
  'study-demo-1': {
    id: 'study-demo-1', patientId: 'ana-p', patientName: 'Ana Pereira', treatmentCycleId: 'cycle-ana-2', sourceDocumentId: 'doc-ana-posturo', sourceFilename: 'posturografia-ejemplo.pdf', studyType: 'posturography', cyclePhase: 'follow_up', performedAt: '2026-07-15T12:00:00.000Z', deviceName: 'Equipo de demostración', softwareVersion: '', protocolCode: 'bap-a-d', protocolVersion: '1', calculationMethodVersion: 'onur-normalization-1.0', status: 'draft', qualityNotes: '', interpretable: false,
    metrics: [
      { clientId: 'demo-a', metricCode: 'condition_score', rawValue: '82,4', unitCode: 'percent', conditionCode: 'A', side: '', axis: '', trialNumber: '1', sourceLocation: 'Página 1 · condición A' },
      { clientId: 'demo-b', metricCode: 'condition_score', rawValue: '76,8', unitCode: 'percent', conditionCode: 'B', side: '', axis: '', trialNumber: '1', sourceLocation: 'Página 1 · condición B' },
      { clientId: 'demo-c', metricCode: 'condition_score', rawValue: '69,2', unitCode: 'percent', conditionCode: 'C', side: '', axis: '', trialNumber: '1', sourceLocation: 'Página 1 · condición C' },
      { clientId: 'demo-d', metricCode: 'condition_score', rawValue: '61,5', unitCode: 'percent', conditionCode: 'D', side: '', axis: '', trialNumber: '1', sourceLocation: 'Página 1 · condición D' },
    ],
  },
  'study-demo-2': {
    id: 'study-demo-2', patientId: 'ana-p', patientName: 'Ana Pereira', treatmentCycleId: 'cycle-ana-2', sourceDocumentId: 'doc-ana-vhit', sourceFilename: 'vhit-ejemplo.png', studyType: 'vhit', cyclePhase: 'unspecified', performedAt: '2026-07-10T12:00:00.000Z', deviceName: 'Equipo de demostración', softwareVersion: '', protocolCode: 'vhit-bilateral', protocolVersion: '1', calculationMethodVersion: 'onur-normalization-1.0', status: 'draft', qualityNotes: '', interpretable: false,
    metrics: [
      { clientId: 'demo-gain-left', metricCode: 'gain', rawValue: '0,82', unitCode: 'ratio', conditionCode: '', side: 'left', axis: '', trialNumber: '1', sourceLocation: 'Imagen · canal horizontal' },
      { clientId: 'demo-gain-right', metricCode: 'gain', rawValue: '0,88', unitCode: 'ratio', conditionCode: '', side: 'right', axis: '', trialNumber: '1', sourceLocation: 'Imagen · canal horizontal' },
    ],
  },
}

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

function readStoredImports() { return readJson<Record<string, StoredImport>>(IMPORT_STORAGE_KEY, {}) }
function writeStoredImports(value: Record<string, StoredImport>) { localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(value)) }
function demoPatientName(patientId: string) {
  const patients = readJson<Array<{ id: string; fullName: string }>>(PATIENT_STORAGE_KEY, [])
  return patients.find((patient) => patient.id === patientId)?.fullName ?? demoPatients[patientId] ?? 'Paciente'
}

function demoStudyFromDocument(studyId: string): ClinicalStudyReview | null {
  const document = readJson<Array<Record<string, unknown>>>(DOCUMENT_STORAGE_KEY, []).find((item) => item.studyId === studyId)
  if (!document) return null
  const type = String(document.documentType) as StudyType
  if (!['posturography', 'vhit'].includes(type)) return null
  return {
    id: studyId,
    patientId: String(document.patientId),
    patientName: demoPatientName(String(document.patientId)),
    treatmentCycleId: String(document.treatmentCycleId ?? ''),
    sourceDocumentId: String(document.id),
    sourceFilename: String(document.originalFilename),
    studyType: type,
    cyclePhase: String(document.cyclePhase ?? 'unspecified') as CycleStudyPhase,
    performedAt: `${String(document.documentDate)}T12:00:00.000Z`,
    deviceName: String(document.deviceName ?? ''),
    softwareVersion: '',
    protocolCode: String(document.protocolCode ?? (type === 'posturography' ? 'manual-posturography' : 'manual-vhit')),
    protocolVersion: String(document.protocolVersion ?? '1'),
    calculationMethodVersion: 'onur-normalization-1.0',
    status: 'draft', qualityNotes: '', interpretable: false, metrics: [],
  }
}

function rowToMetric(row: Record<string, unknown>): MetricRowInput {
  return {
    clientId: String(row.id), metricCode: String(row.metric_code), rawValue: String(row.raw_value), unitCode: String(row.unit_code ?? ''), conditionCode: String(row.condition_code ?? ''), side: String(row.side ?? '') as MetricRowInput['side'], axis: String(row.axis ?? ''), trialNumber: row.trial_number ? String(row.trial_number) : '', sourceLocation: String(row.source_location ?? ''),
  }
}

export async function getStudyReview(studyId: string): Promise<ClinicalStudyReview | null> {
  if (!isSupabaseConfigured || !supabase) {
    const base = demoStudies[studyId] ?? demoStudyFromDocument(studyId)
    if (!base) return null
    const stored = readStoredImports()[studyId]
    return stored ? { ...base, ...stored } : base
  }
  const [{ data: study, error }, { data: metrics, error: metricError }] = await Promise.all([
    supabase.from('clinical_studies').select('*, patients(full_name), source_documents(original_filename)').eq('id', studyId).maybeSingle(),
    supabase.from('metric_values').select('*').eq('study_id', studyId).order('created_at'),
  ])
  if (error) throw error
  if (metricError) throw metricError
  if (!study) return null
  const patient = study.patients as unknown as { full_name?: string } | null
  const document = study.source_documents as unknown as { original_filename?: string } | null
  return {
    id: study.id, patientId: study.patient_id, patientName: patient?.full_name ?? 'Paciente', treatmentCycleId: study.treatment_cycle_id ?? '', sourceDocumentId: study.source_document_id ?? '', sourceFilename: document?.original_filename ?? (String(study.calculation_method_version ?? '').startsWith('onur-bap-webserial-') ? 'Captura directa BAP (legado)' : 'Documento original'), studyType: study.study_type as StudyType, cyclePhase: String(study.cycle_phase ?? 'unspecified') as CycleStudyPhase, performedAt: study.performed_at, deviceName: study.device_name ?? '', softwareVersion: study.software_version ?? '', protocolCode: study.protocol_code, protocolVersion: study.protocol_version, calculationMethodVersion: study.calculation_method_version ?? 'onur-normalization-1.0', status: study.status, qualityNotes: study.quality_notes ?? '', interpretable: study.interpretable ?? false, metrics: (metrics ?? []).map((row) => rowToMetric(row as Record<string, unknown>)),
  }
}

function summaryFromReview(study:ClinicalStudyReview):ClinicalStudySummary{return{id:study.id,patientId:study.patientId,patientName:study.patientName,treatmentCycleId:study.treatmentCycleId,sourceFilename:study.sourceFilename,studyType:study.studyType,cyclePhase:study.cyclePhase,performedAt:study.performedAt,deviceName:study.deviceName,protocolCode:study.protocolCode,protocolVersion:study.protocolVersion,status:study.status,interpretable:study.interpretable,metricCount:study.metrics.length,issueCount:0}}

export async function listClinicalStudies():Promise<ClinicalStudySummary[]>{
  if(!isSupabaseConfigured||!supabase){
    const dynamicIds=readJson<Array<Record<string,unknown>>>(DOCUMENT_STORAGE_KEY,[]).map(item=>String(item.studyId??'')).filter(Boolean)
    const ids=[...new Set([...Object.keys(demoStudies),...dynamicIds])]
    const studies=(await Promise.all(ids.map(id=>getStudyReview(id)))).filter((study):study is ClinicalStudyReview=>Boolean(study))
    return studies.map(summaryFromReview).sort((a,b)=>b.performedAt.localeCompare(a.performedAt))
  }
  const{data,error}=await supabase.from('clinical_studies').select('*, patients(full_name), source_documents(original_filename), metric_values(id), data_quality_issues(id)').order('performed_at',{ascending:false});if(error)throw error
  return(data??[]).map(row=>{const patient=row.patients as unknown as{full_name?:string}|null;const document=row.source_documents as unknown as{original_filename?:string}|null;const direct=String(row.calculation_method_version??'').startsWith('onur-bap-webserial-');return{id:String(row.id),patientId:String(row.patient_id),patientName:patient?.full_name??'Paciente',treatmentCycleId:String(row.treatment_cycle_id??''),sourceFilename:document?.original_filename??(direct?'Captura directa BAP (legado)':'Documento original'),studyType:row.study_type as StudyType,cyclePhase:String(row.cycle_phase??'unspecified') as CycleStudyPhase,performedAt:String(row.performed_at),deviceName:String(row.device_name??''),protocolCode:String(row.protocol_code),protocolVersion:String(row.protocol_version),status:row.status as ClinicalStudyReview['status'],interpretable:Boolean(row.interpretable),metricCount:Array.isArray(row.metric_values)?row.metric_values.length:0,issueCount:Array.isArray(row.data_quality_issues)?row.data_quality_issues.length:0}})
}

function issueCount(metrics: NormalizedMetricRow[]) { return metrics.reduce((sum, metric) => sum + metric.issues.length, 0) }

function demoSuggestionSeedRecords(): StatisticalSuggestionRecord[] {
  return demoSuggestionSeed.map((item, index) => ({
    id: item.id, patientId: index === 0 ? 'ana-p' : 'luis-s', patientName: item.patientName, studyId: index === 0 ? 'study-demo-1' : 'study-demo-2', treatmentCycleId: index === 0 ? 'cycle-ana-2' : '', studyLabel: item.studyLabel, ruleCode: item.ruleCode, ruleTitle: index === 0 ? 'Cambio absoluto' : 'Curva frecuencia-ganancia', summary: item.summary, limitation: item.limitation, observedResult: {}, createdAt: index === 0 ? '2026-07-16T09:34:00.000Z' : '2026-07-15T18:51:00.000Z', status: item.status, professionalText: '',
  }))
}

function readDemoSuggestions() { return readJson<StatisticalSuggestionRecord[]>(SUGGESTION_STORAGE_KEY, demoSuggestionSeedRecords()) }
function writeDemoSuggestions(value: StatisticalSuggestionRecord[]) { localStorage.setItem(SUGGESTION_STORAGE_KEY, JSON.stringify(value)) }

export async function saveStudyImport(input: SaveStudyImportInput): Promise<SaveStudyImportResult> {
  if (!isSupabaseConfigured || !supabase) {
    const study = await getStudyReview(input.studyId)
    if (!study) throw new Error('Estudio no encontrado.')
    if (study.status === 'finalized') throw new Error('Un estudio finalizado no puede modificarse.')
    const imports = readStoredImports()
    imports[input.studyId] = { metrics: input.metrics.map(({ normalizedNumericValue: _numeric, normalizedTextValue: _text, normalizationRuleVersion: _version, qualityStatus: _status, issues: _issues, ...row }) => row), status: 'reviewed', qualityNotes: input.qualityNotes, interpretable: input.interpretable && !input.metrics.some((metric) => ['blocked', 'quarantine'].includes(metric.qualityStatus)) }
    writeStoredImports(imports)
    const suggestions = readDemoSuggestions().filter((suggestion) => suggestion.studyId !== input.studyId)
    let generated = 0
    const conditions = input.metrics.filter((metric) => metric.metricCode === 'condition_score' && metric.qualityStatus === 'ok' && metric.normalizedNumericValue !== null)
    if (study.studyType === 'posturography' && ['bap-a-d', 'bap-1-6'].includes(study.protocolCode) && conditions.length >= 2) {
      suggestions.unshift({ id: crypto.randomUUID(), patientId: study.patientId, patientName: study.patientName, studyId: study.id, treatmentCycleId: study.treatmentCycleId, studyLabel: `Posturografía · ${study.performedAt.slice(0, 10)}`, ruleCode: 'BAP-001 · v1', ruleTitle: 'Perfil de condiciones', summary: `Se registró un perfil descriptivo de ${conditions.length} condiciones del protocolo. Se sugiere revisar conjuntamente estas métricas en el contexto clínico.`, limitation: 'No se aplicó un umbral normativo ni se atribuye el patrón a una causa clínica.', observedResult: { protocolCode: study.protocolCode, protocolVersion: study.protocolVersion, conditions: conditions.map((metric) => ({ condition: metric.conditionCode, value: metric.normalizedNumericValue, unit: metric.unitCode })) }, createdAt: new Date().toISOString(), status: 'pending', professionalText: '' })
      generated = 1
    }
    writeDemoSuggestions(suggestions)
    return { metricCount: input.metrics.length, issueCount: issueCount(input.metrics), suggestionCount: generated }
  }
  const payload = input.metrics.map((metric) => ({
    metric_code: metric.metricCode,
    raw_value: metric.rawValue,
    normalized_numeric_value: metric.normalizedNumericValue,
    normalized_text_value: metric.normalizedTextValue,
    unit_code: metric.unitCode,
    condition_code: metric.conditionCode,
    side: metric.side,
    axis: metric.axis,
    trial_number: /^\d+$/.test(metric.trialNumber) ? Number(metric.trialNumber) : null,
    source_method: 'transcribed',
    source_location: metric.sourceLocation,
    normalization_rule_version: metric.normalizationRuleVersion,
    quality_status: metric.qualityStatus,
    issues: metric.issues.map((issue) => ({ rule_code: issue.ruleCode, severity: issue.severity, message: issue.message })),
  }))
  const { data, error } = await supabase.rpc('replace_study_import', { target_study_id: input.studyId, metric_payload: payload, import_quality_notes: input.qualityNotes, import_interpretable: input.interpretable, parser_version: 'onur-normalization-1.0' })
  if (error) throw error
  const result = data as Record<string, number>
  return { metricCount: Number(result.metric_count ?? input.metrics.length), issueCount: Number(result.issue_count ?? issueCount(input.metrics)), suggestionCount: Number(result.suggestion_count ?? 0) }
}

export async function finalizeClinicalStudy(studyId: string): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    const study = await getStudyReview(studyId)
    if (!study) throw new Error('Estudio no encontrado.')
    if (study.status !== 'reviewed') throw new Error('Solo puede finalizarse un estudio revisado.')
    const imports = readStoredImports()
    imports[studyId] = { ...imports[studyId], status: 'finalized' }
    writeStoredImports(imports)
    return `demo-${studyId}`
  }
  const { data, error } = await supabase.rpc('finalize_clinical_study', { target_study_id: studyId })
  if (error) throw error
  return String(data)
}

function suggestionFromRow(row: Record<string, unknown>): StatisticalSuggestionRecord {
  const patient = row.patients as Record<string, unknown> | null
  const study = row.clinical_studies as Record<string, unknown> | null
  const rule = row.statistical_rules as Record<string, unknown> | null
  const reviews = (row.professional_reviews ?? []) as Record<string, unknown>[]
  const review = reviews[0]
  const studyType = study?.study_type === 'posturography' ? 'Posturografía' : String(study?.study_type ?? 'Estudio')
  return {
    id: String(row.id), patientId: String(row.patient_id), patientName: String(patient?.full_name ?? 'Paciente'), studyId: String(row.study_id), treatmentCycleId: String(study?.treatment_cycle_id ?? ''), studyLabel: `${studyType} · ${String(study?.performed_at ?? '').slice(0, 10)}`, ruleCode: `${String(rule?.code ?? '')} · v${String(rule?.version ?? '')}`, ruleTitle: String(rule?.title ?? ''), summary: String(row.statistical_message), limitation: String(row.limitations), observedResult: (row.observed_result ?? {}) as Record<string, unknown>, createdAt: String(row.created_at), status: row.status as SuggestionStatus, professionalText: String(review?.professional_text ?? ''),
  }
}

export async function listStatisticalSuggestions(): Promise<StatisticalSuggestionRecord[]> {
  if (!isSupabaseConfigured || !supabase) return readDemoSuggestions()
  const { data, error } = await supabase.from('statistical_suggestions').select('*, patients(full_name), clinical_studies(study_type, performed_at, protocol_code, protocol_version, treatment_cycle_id), statistical_rules(code, version, title), professional_reviews(professional_text, decision, reviewed_at)').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => suggestionFromRow(row as unknown as Record<string, unknown>))
}

export async function reviewStatisticalSuggestion(id: string, status: Exclude<SuggestionStatus, 'pending'>, professionalText = ''): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    writeDemoSuggestions(readDemoSuggestions().map((suggestion) => suggestion.id === id ? { ...suggestion, status, professionalText } : suggestion))
    return
  }
  const { error } = await supabase.rpc('review_statistical_suggestion', { target_suggestion_id: id, review_decision: status, review_text: professionalText || null })
  if (error) throw error
}
