import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { CycleStudyPhase } from '../documents/types'
import type { ExtractedField, ExtractedPage, LocalExtractionDraft, PageClassification, PatientMatchStatus, PersistedExtractionDraft } from './types'
import { persistedFieldStatus } from './fieldResults'

const DEMO_KEY = 'onur-demo-extractions-v1'

export interface ExtractionReviewRecord extends PersistedExtractionDraft {
  sourceFilename: string
  mimeType: string
  documentUrl: string
  sectionStudyId: string
  sectionPageNumbers: number[]
  professionalConclusion: string
  rehabilitationSuggestion: string
  cyclePhase?: CycleStudyPhase
}

function readDemo() {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY) ?? '[]') as ExtractionReviewRecord[] } catch { return [] }
}

function writeDemo(records: ExtractionReviewRecord[]) { localStorage.setItem(DEMO_KEY, JSON.stringify(records)) }

function pagePayload(page: ExtractedPage) {
  return { page_number: page.pageNumber, proposed_classification: page.proposedClassification, classification: page.classification, classification_confidence: page.classificationConfidence, rotation_degrees: page.rotationDegrees, width: page.width, height: page.height }
}

function fieldPayload(field: ExtractedField) {
  const region = field.region ? { ...field.region, field_contract: { status: field.status, value: field.value ?? null, display_value: field.displayValue ?? '', warnings: field.warnings ?? [], validation: field.validation ?? null, source: field.source ?? null, candidates: field.candidates ?? [], correction_history: field.correctionHistory ?? [] } } : null
  return { client_id: field.clientId, code: field.code, label: field.label, group: field.group, study_type: field.studyType, required: field.required, metric_code: field.metricCode, raw_value: field.rawValue, normalized_value: field.normalizedValue, unit_code: field.unitCode, condition_code: field.conditionCode, side: field.side, page_number: field.pageNumber, region, confidence: field.confidence, status: persistedFieldStatus(field.status), extractor_method: field.extractorMethod, extractor_version: field.extractorVersion, professional_value: field.professionalValue, confirmed: field.confirmed }
}

export function extractionPayload(draft: LocalExtractionDraft) {
  return { intake_kind: draft.intakeKind, extractor_version: draft.extractorVersion, patient_match_status: draft.patientMatchStatus, mismatch_fields: draft.mismatchFields, study_date: draft.studyDate ?? null, upload_date: draft.uploadDate ?? null, pages: draft.pages.map(pagePayload), fields: draft.fields.map(fieldPayload) }
}

export async function createExtractionDraft(documentId: string, patientId: string, draft: LocalExtractionDraft, documentDate: string, treatmentCycleId: string, sourceFilename: string, mimeType: string, cyclePhase: CycleStudyPhase = 'unspecified') {
  void patientId
  if (!isSupabaseConfigured || !supabase) {
    const jobId = crypto.randomUUID()
    const hasPosturography = draft.pages.some((page) => page.classification === 'posturography') || draft.intakeKind === 'posturography_bap'
    const hasVestibularReport = draft.pages.some((page) => page.classification !== 'posturography') || draft.intakeKind === 'vestibular_and_reports'
    const types: ExtractedField['studyType'][] = [
      ...(hasPosturography ? ['posturography' as const] : []),
      ...(hasVestibularReport ? ['vhit' as const] : []),
    ]
    const studyIds = types.map(() => crypto.randomUUID())
    const records = types.map((type, index): ExtractionReviewRecord => ({ ...draft, pages: draft.pages.map((page) => ({ ...page, text: '', lines: [] })), fields: draft.fields.filter((field) => field.studyType === type), id: jobId, documentId, studyIds, status: 'review', sourceFilename, mimeType, documentUrl: '', sectionStudyId: studyIds[index], sectionPageNumbers: draft.pages.filter((page) => type === 'posturography' ? page.classification === 'posturography' : page.classification !== 'posturography').map((page) => page.pageNumber), professionalConclusion: '', rehabilitationSuggestion: '', cyclePhase }))
    writeDemo([...readDemo(), ...records])
    return { jobId, studyIds }
  }
  const { data, error } = await supabase.rpc('create_document_extraction_draft', { target_document_id: documentId, extraction_payload: extractionPayload(draft), study_date: documentDate, target_treatment_cycle_id: treatmentCycleId || null })
  if (error) throw error
  const result = data as { job_id: string; study_ids: string[] }
  if (result.study_ids.length) {
    const { error: phaseError } = await supabase.from('clinical_studies').update({ cycle_phase: cyclePhase }).in('id', result.study_ids)
    if (phaseError) throw phaseError
  }
  return { jobId: result.job_id, studyIds: result.study_ids }
}

function fromPage(row: Record<string, unknown>): ExtractedPage {
  return { pageNumber: Number(row.page_number), proposedClassification: String(row.proposed_classification) as PageClassification, classification: String(row.classification) as PageClassification, classificationConfidence: Number(row.classification_confidence ?? 0), rotationDegrees: Number(row.rotation_degrees ?? 0), width: Number(row.pixel_width ?? 0), height: Number(row.pixel_height ?? 0), previewUrl: '', text: '', lines: [] }
}

function fromField(row: Record<string, unknown>): ExtractedField {
  const storedRegion = row.source_region as (Record<string, unknown> & { field_contract?: Record<string, unknown> }) | null
  const contract = storedRegion?.field_contract
  const region = storedRegion && ['x', 'y', 'width', 'height'].every((key) => typeof storedRegion[key] === 'number') ? { x: Number(storedRegion.x), y: Number(storedRegion.y), width: Number(storedRegion.width), height: Number(storedRegion.height) } : null
  return { clientId: String(row.client_key), code: String(row.field_code), label: String(row.field_label), group: String(row.field_group), studyType: String(row.study_type) as ExtractedField['studyType'], required: Boolean(row.required), metricCode: String(row.metric_code ?? ''), rawValue: String(row.raw_value ?? ''), normalizedValue: String(row.normalized_value ?? ''), unitCode: String(row.unit_code ?? ''), conditionCode: String(row.condition_code ?? ''), side: String(row.side ?? '') as ExtractedField['side'], pageNumber: Number(row.page_number), region, confidence: Number(row.extraction_confidence ?? 0), status: String(contract?.status ?? row.extraction_status) as ExtractedField['status'], extractorMethod: String(row.extractor_method) as ExtractedField['extractorMethod'], extractorVersion: String(row.extractor_version), professionalValue: String(row.professional_value ?? ''), confirmed: Boolean(row.is_confirmed), value: contract?.value as ExtractedField['value'], displayValue: String(contract?.display_value ?? row.professional_value ?? ''), warnings: Array.isArray(contract?.warnings) ? contract.warnings.map(String) : [], validation: contract?.validation as ExtractedField['validation'], source: contract?.source as ExtractedField['source'], candidates: Array.isArray(contract?.candidates) ? contract.candidates as ExtractedField['candidates'] : [], correctionHistory: Array.isArray(contract?.correction_history) ? contract.correction_history as ExtractedField['correctionHistory'] : [] }
}

export async function getExtractionForStudy(studyId: string): Promise<ExtractionReviewRecord | null> {
  if (!isSupabaseConfigured || !supabase) return readDemo().find((record) => record.sectionStudyId === studyId) ?? null
  const { data: section, error: sectionError } = await supabase.from('study_extraction_sections').select('*').eq('study_id', studyId).maybeSingle()
  if (sectionError) throw sectionError
  if (!section) return null
  const [{ data: job, error: jobError }, { data: pages, error: pagesError }, { data: fields, error: fieldsError }, { data: sections, error: sectionsError }] = await Promise.all([
    supabase.from('document_extraction_jobs').select('*').eq('id', section.job_id).single(),
    supabase.from('document_extraction_pages').select('*').eq('job_id', section.job_id).order('page_number'),
    supabase.from('document_extraction_fields').select('*').eq('job_id', section.job_id).order('created_at'),
    supabase.from('study_extraction_sections').select('study_id').eq('job_id', section.job_id),
  ])
  if (jobError || pagesError || fieldsError || sectionsError) throw jobError ?? pagesError ?? fieldsError ?? sectionsError
  const { data: source, error: sourceError } = await supabase.from('source_documents').select('original_filename,mime_type,storage_path,cycle_phase').eq('id', job.source_document_id).single()
  if (sourceError) throw sourceError
  const { data: signed, error: signedError } = await supabase.storage.from('clinical-documents').createSignedUrl(source.storage_path, 900)
  if (signedError) throw signedError
  return { id: job.id, documentId: job.source_document_id, studyIds: (sections ?? []).map((item) => String(item.study_id)), status: job.status, intakeKind: job.intake_kind, extractorVersion: job.extractor_version, patientMatchStatus: job.patient_match_status as PatientMatchStatus, mismatchFields: job.mismatch_field_codes ?? [], pages: (pages ?? []).map((row) => fromPage(row as Record<string, unknown>)), fields: (fields ?? []).map((row) => fromField(row as Record<string, unknown>)), sourceFilename: source.original_filename, mimeType: source.mime_type, documentUrl: signed.signedUrl, sectionStudyId: studyId, sectionPageNumbers: section.page_numbers, professionalConclusion: String(job.professional_conclusion ?? ''), rehabilitationSuggestion: String(job.rehabilitation_suggestion ?? ''), cyclePhase: String(source.cycle_phase ?? 'unspecified') as CycleStudyPhase }
}

function updateDemo(jobId: string, updater: (record: ExtractionReviewRecord) => ExtractionReviewRecord) {
  writeDemo(readDemo().map((record) => record.id === jobId ? updater(record) : record))
}

export async function saveExtractionReview(draft: ExtractionReviewRecord) {
  if (!isSupabaseConfigured || !supabase) { updateDemo(draft.id, (record) => ({ ...record, pages: draft.pages, fields: draft.fields, patientMatchStatus: draft.patientMatchStatus, professionalConclusion: draft.professionalConclusion, rehabilitationSuggestion: draft.rehabilitationSuggestion })); return }
  const { error } = await supabase.rpc('save_document_extraction_draft', {
    target_job_id: draft.id,
    review_payload: { patient_match_status: draft.patientMatchStatus, pages: draft.pages.map(pagePayload), fields: draft.fields.map(fieldPayload) },
    target_professional_conclusion: draft.professionalConclusion,
    target_rehabilitation_suggestion: draft.rehabilitationSuggestion,
  })
  if (error) throw error
}

export async function replaceExtractionCandidates(jobId: string, draft: LocalExtractionDraft) {
  if (!isSupabaseConfigured || !supabase) {
    updateDemo(jobId, (record) => ({
      ...record,
      extractorVersion: draft.extractorVersion,
      pages: draft.pages.map((page) => ({ ...page, text: '', lines: [] })),
      fields: draft.fields.filter((field) => field.studyType === record.fields[0]?.studyType),
    }))
    return
  }
  const { error } = await supabase.rpc('replace_document_extraction_candidates', { target_job_id: jobId, extraction_payload: extractionPayload(draft) })
  if (error) throw error
}

export async function confirmExtraction(jobId: string) {
  if (!isSupabaseConfigured || !supabase) {
    const records = readDemo().filter((record) => record.id === jobId)
    if (records.some((record) => !record.professionalConclusion.trim() || !record.rehabilitationSuggestion.trim())) throw new Error('Completá la conclusión y la sugerencia profesional de rehabilitación.')
    updateDemo(jobId, (record) => ({ ...record, status: 'confirmed' })); return
  }
  const { error } = await supabase.rpc('confirm_document_extraction', { target_job_id: jobId })
  if (error) throw error
}

export async function markExtractionManual(jobId: string) {
  if (!isSupabaseConfigured || !supabase) { updateDemo(jobId, (record) => ({ ...record, status: 'manual' })); return }
  const { error } = await supabase.rpc('mark_document_extraction_manual', { target_job_id: jobId })
  if (error) throw error
}

export async function discardExtraction(jobId: string) {
  if (!isSupabaseConfigured || !supabase) { updateDemo(jobId, (record) => ({ ...record, status: 'discarded' })); return }
  const { error } = await supabase.rpc('discard_document_extraction', { target_job_id: jobId })
  if (error) throw error
}

export async function reopenExtraction(jobId: string) {
  if (!isSupabaseConfigured || !supabase) { updateDemo(jobId, (record) => ({ ...record, status: 'review' })); return }
  const { error } = await supabase.rpc('reopen_document_extraction', { target_job_id: jobId })
  if (error) throw error
}
