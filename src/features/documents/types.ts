import type { LocalExtractionDraft } from '../extraction/types'

export type ClinicalDocumentType = 'posturography' | 'vhit' | 'questionnaire_initial' | 'questionnaire_final' | 'clinical_report' | 'other'
export type CycleStudyPhase = 'initial' | 'final' | 'follow_up' | 'unspecified'

export const cycleStudyPhaseLabels: Record<CycleStudyPhase, string> = {
  initial: 'Inicial',
  final: 'Final',
  follow_up: 'Control / seguimiento',
  unspecified: 'Sin especificar',
}

export const documentTypeLabels:Record<ClinicalDocumentType,string>={
  posturography:'Posturografía',vhit:'vHIT',questionnaire_initial:'Cuestionario inicial',questionnaire_final:'Cuestionario final',clinical_report:'Informe clínico',other:'Otro documento',
}

export type DocumentPermissionLevel = 'view' | 'view_download'
export type DocumentRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled'

export interface ClinicalDocumentRecord {
  id:string;patientId:string;treatmentCycleId:string;documentType:ClinicalDocumentType
  cyclePhase?:CycleStudyPhase
  originalFilename:string;storagePath:string;mimeType:string;fileSizeBytes:number
  documentDate:string;description:string;createdAt:string;sharedWithPatient:boolean
  permissionId:string;studyId:string;studyStatus:string;deviceName:string
  permissionLevel:DocumentPermissionLevel|''
  protocolCode?:string;protocolVersion?:string
  extractionJobId?:string
  studyIds?:string[]
}

export interface PatientDocumentCatalogRecord extends ClinicalDocumentRecord {
  requestId:string
  requestStatus:DocumentRequestStatus|''
  requestedAt:string
  canView:boolean
  canDownload:boolean
}

export interface DocumentAccessRequestRecord {
  id:string
  patientId:string
  documentId:string
  documentType:ClinicalDocumentType
  originalFilename:string
  documentDate:string
  status:DocumentRequestStatus
  requestedAt:string
  resolvedAt:string
  resolutionNote:string
}

export interface DocumentUploadInput {
  patientId:string;treatmentCycleId:string;documentType:ClinicalDocumentType
  cyclePhase?:CycleStudyPhase
  documentDate:string;description:string;shareWithPatient:boolean;file:File
  deviceName:string;protocolCode:string;protocolVersion:string
  extractionDraft?:LocalExtractionDraft
}
