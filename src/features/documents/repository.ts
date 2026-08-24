import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { createExtractionDraft } from '../extraction/repository'
import type { ClinicalDocumentRecord, CycleStudyPhase, DocumentAccessRequestRecord, DocumentPermissionLevel, DocumentRequestStatus, DocumentUploadInput, PatientDocumentCatalogRecord } from './types'

const STORAGE_KEY='onur-demo-documents-v1'
const REQUEST_STORAGE_KEY='onur-demo-document-requests-v1'
const demoDocuments:ClinicalDocumentRecord[]=[
  {id:'doc-ana-posturo',patientId:'ana-p',treatmentCycleId:'cycle-ana-2',documentType:'posturography',cyclePhase:'follow_up',originalFilename:'posturografia-ejemplo.pdf',storagePath:'demo/posturografia-ejemplo.pdf',mimeType:'application/pdf',fileSizeBytes:248000,documentDate:'2026-07-15',description:'Posturografía de control.',createdAt:'2026-07-15T14:00:00.000Z',sharedWithPatient:true,permissionId:'permission-demo-1',permissionLevel:'view',studyId:'study-demo-1',studyStatus:'draft',deviceName:'Equipo de demostración',protocolCode:'bap-a-d',protocolVersion:'1'},
  {id:'doc-ana-vhit',patientId:'ana-p',treatmentCycleId:'cycle-ana-2',documentType:'vhit',cyclePhase:'unspecified',originalFilename:'vhit-ejemplo.png',storagePath:'demo/vhit-ejemplo.png',mimeType:'image/png',fileSizeBytes:184000,documentDate:'2026-07-10',description:'Estudio vHIT.',createdAt:'2026-07-10T12:00:00.000Z',sharedWithPatient:false,permissionId:'',permissionLevel:'',studyId:'study-demo-2',studyStatus:'draft',deviceName:'Equipo de demostración',protocolCode:'vhit-bilateral',protocolVersion:'1'},
]
function readDemo(){const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return demoDocuments;try{return(JSON.parse(raw) as ClinicalDocumentRecord[]).map(item=>({...item,cyclePhase:item.cyclePhase??'unspecified'}))}catch{return demoDocuments}}
function writeDemo(items:ClinicalDocumentRecord[]){localStorage.setItem(STORAGE_KEY,JSON.stringify(items))}
function readDemoRequests(){const raw=localStorage.getItem(REQUEST_STORAGE_KEY);if(!raw)return[] as DocumentAccessRequestRecord[];try{return JSON.parse(raw) as DocumentAccessRequestRecord[]}catch{return[]}}
function writeDemoRequests(items:DocumentAccessRequestRecord[]){localStorage.setItem(REQUEST_STORAGE_KEY,JSON.stringify(items))}
function fromRow(row:Record<string,unknown>):ClinicalDocumentRecord{
  const permissions=(row.document_permissions??[]) as Record<string,unknown>[];const active=permissions.find(permission=>!permission.revoked_at)
  const studies=(row.clinical_studies??[]) as Record<string,unknown>[];const study=studies[0]
  const jobs=(row.document_extraction_jobs??[]) as Record<string,unknown>[]
  return{id:String(row.id),patientId:String(row.patient_id),treatmentCycleId:String(row.treatment_cycle_id??''),documentType:String(row.document_type) as ClinicalDocumentRecord['documentType'],cyclePhase:String(row.cycle_phase??'unspecified') as CycleStudyPhase,originalFilename:String(row.original_filename),storagePath:String(row.storage_path),mimeType:String(row.mime_type),fileSizeBytes:Number(row.file_size_bytes??0),documentDate:String(row.document_date??String(row.created_at).slice(0,10)),description:String(row.description??''),createdAt:String(row.created_at),sharedWithPatient:Boolean(active),permissionId:String(active?.id??''),permissionLevel:String(active?.level??'') as ClinicalDocumentRecord['permissionLevel'],studyId:String(study?.id??''),studyIds:studies.map(item=>String(item.id)),studyStatus:String(study?.status??''),deviceName:String(study?.device_name??''),protocolCode:String(study?.protocol_code??''),protocolVersion:String(study?.protocol_version??''),extractionJobId:String(jobs[0]?.id??'')}
}
const selectDocument='*, document_permissions(id, level, revoked_at), clinical_studies(id, study_type, status, performed_at, device_name, protocol_code, protocol_version), document_extraction_jobs(id, status)'

export async function listPatientDocuments(patientId:string):Promise<ClinicalDocumentRecord[]>{
  if(!isSupabaseConfigured||!supabase)return readDemo().filter(item=>item.patientId===patientId).sort((a,b)=>b.documentDate.localeCompare(a.documentDate))
  const{data,error}=await supabase.from('source_documents').select(selectDocument).eq('patient_id',patientId).order('document_date',{ascending:false});if(error)throw error;return(data??[]).map(fromRow)
}

export async function listCurrentPatientDocumentCatalog():Promise<PatientDocumentCatalogRecord[]>{
  if(!isSupabaseConfigured||!supabase){const requests=readDemoRequests();return readDemo().filter(item=>item.patientId==='ana-p').sort((a,b)=>b.documentDate.localeCompare(a.documentDate)).map(item=>{const request=requests.filter(candidate=>candidate.documentId===item.id).sort((a,b)=>b.requestedAt.localeCompare(a.requestedAt))[0];return{...item,requestId:request?.id??'',requestStatus:request?.status??'',requestedAt:request?.requestedAt??'',canView:item.sharedWithPatient,canDownload:item.permissionLevel==='view_download'}})}
  const{data,error}=await supabase.rpc('list_my_document_catalog');if(error)throw error;return((data??[]) as Record<string,unknown>[]).map(row=>({id:String(row.document_id),patientId:'',treatmentCycleId:'',documentType:String(row.document_type) as PatientDocumentCatalogRecord['documentType'],cyclePhase:String(row.cycle_phase??'unspecified') as CycleStudyPhase,originalFilename:String(row.original_filename),storagePath:'',mimeType:String(row.mime_type),fileSizeBytes:Number(row.file_size_bytes??0),documentDate:String(row.document_date),description:String(row.description??''),createdAt:'',sharedWithPatient:Boolean(row.permission_level),permissionId:'',permissionLevel:String(row.permission_level??'') as PatientDocumentCatalogRecord['permissionLevel'],studyId:'',studyStatus:'',deviceName:'',requestId:String(row.request_id??''),requestStatus:String(row.request_status??'') as PatientDocumentCatalogRecord['requestStatus'],requestedAt:String(row.requested_at??''),canView:Boolean(row.permission_level),canDownload:row.permission_level==='view_download'}))
}

export async function listCurrentPatientDocuments():Promise<ClinicalDocumentRecord[]>{return(await listCurrentPatientDocumentCatalog()).filter(item=>item.canView)}

function safeFilename(name:string){const dot=name.lastIndexOf('.');const extension=dot>=0?name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g,''):'';const base=(dot>=0?name.slice(0,dot):name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'documento';return`${base}${extension}`}
function resolvedMime(file:File){const extension=file.name.split('.').pop()?.toLowerCase()??'';const inferred:Record<string,string>={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};return file.type||inferred[extension]||''}
async function sha256(file:File){const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return Array.from(new Uint8Array(digest)).map(value=>value.toString(16).padStart(2,'0')).join('')}

export async function uploadClinicalDocument(input:DocumentUploadInput):Promise<ClinicalDocumentRecord>{
  const cyclePhase=input.cyclePhase??'unspecified'
  if(input.file.size>25*1024*1024)throw new Error('El archivo supera el máximo de 25 MB.')
  if(['initial','final'].includes(cyclePhase)&&!input.treatmentCycleId)throw new Error('La posturografía inicial o final debe asociarse a un ciclo.')
  if(input.documentType==='posturography'&&['initial','final'].includes(cyclePhase)){
    const phaseLabel=cyclePhase==='initial'?'inicial':'final'
    if(!isSupabaseConfigured||!supabase){
      const duplicate=readDemo().some(item=>item.patientId===input.patientId&&item.treatmentCycleId===input.treatmentCycleId&&item.documentType==='posturography'&&item.cyclePhase===cyclePhase)
      if(duplicate)throw new Error(`Ya existe una posturografía ${phaseLabel} para este ciclo. Abrí el estudio cargado.`)
    }else{
      const{data:duplicate,error:duplicateError}=await supabase.from('clinical_studies').select('id').eq('patient_id',input.patientId).eq('treatment_cycle_id',input.treatmentCycleId).eq('study_type','posturography').eq('cycle_phase',cyclePhase).limit(1).maybeSingle()
      if(duplicateError)throw duplicateError
      if(duplicate)throw new Error(`Ya existe una posturografía ${phaseLabel} para este ciclo. Abrí el estudio cargado.`)
    }
  }
  const mimeType=resolvedMime(input.file);if(!mimeType)throw new Error('El tipo de archivo no está permitido.')
  if ((!isSupabaseConfigured || !supabase) && input.extractionDraft) {
    const record:ClinicalDocumentRecord={id:crypto.randomUUID(),patientId:input.patientId,treatmentCycleId:input.treatmentCycleId,documentType:input.documentType,cyclePhase,originalFilename:input.file.name,storagePath:`demo/${crypto.randomUUID()}-${safeFilename(input.file.name)}`,mimeType,fileSizeBytes:input.file.size,documentDate:input.documentDate,description:input.description,createdAt:new Date().toISOString(),sharedWithPatient:false,permissionId:'',permissionLevel:'',studyId:'',studyStatus:'draft',deviceName:input.deviceName,protocolCode:input.protocolCode,protocolVersion:input.protocolVersion}
    const extraction=await createExtractionDraft(record.id,input.patientId,input.extractionDraft,input.documentDate,input.treatmentCycleId,input.file.name,mimeType,cyclePhase)
    record.studyId=extraction.studyIds[0]??'';record.studyIds=extraction.studyIds;record.extractionJobId=extraction.jobId
    writeDemo([...readDemo(),record]);return record
  }
  if(!isSupabaseConfigured||!supabase){const record:ClinicalDocumentRecord={id:crypto.randomUUID(),patientId:input.patientId,treatmentCycleId:input.treatmentCycleId,documentType:input.documentType,cyclePhase,originalFilename:input.file.name,storagePath:`demo/${crypto.randomUUID()}-${safeFilename(input.file.name)}`,mimeType,fileSizeBytes:input.file.size,documentDate:input.documentDate,description:input.description,createdAt:new Date().toISOString(),sharedWithPatient:input.shareWithPatient,permissionId:input.shareWithPatient?crypto.randomUUID():'',permissionLevel:input.shareWithPatient?'view':'',studyId:['posturography','vhit'].includes(input.documentType)?crypto.randomUUID():'',studyStatus:['posturography','vhit'].includes(input.documentType)?'draft':'',deviceName:input.deviceName,protocolCode:input.protocolCode,protocolVersion:input.protocolVersion};writeDemo([...readDemo(),record]);return record}
  const client=supabase
  const{data:auth,error:authError}=await client.auth.getUser();if(authError||!auth.user)throw authError??new Error('Sesión profesional no disponible.')
  const storagePath=`${auth.user.id}/${input.patientId}/${crypto.randomUUID()}-${safeFilename(input.file.name)}`
  const digest=await sha256(input.file)
  const cleanup=async(documentId='')=>{await client.functions.invoke('cleanup-clinical-upload',{body:{patient_id:input.patientId,document_id:documentId||null,storage_path:storagePath}})}
  const{error:storageError}=await client.storage.from('clinical-documents').upload(storagePath,input.file,{contentType:mimeType,upsert:false});if(storageError)throw storageError
  const{data:document,error}=await client.from('source_documents').insert({patient_id:input.patientId,treatment_cycle_id:input.treatmentCycleId||null,document_type:input.documentType,cycle_phase:cyclePhase,original_filename:input.file.name,storage_path:storagePath,mime_type:mimeType,sha256:digest,uploaded_by:auth.user.id,document_date:input.documentDate,description:input.description||null,file_size_bytes:input.file.size}).select().single()
  if(error){await cleanup();throw error}
  if(input.extractionDraft){
    try{await createExtractionDraft(document.id,input.patientId,input.extractionDraft,input.documentDate,input.treatmentCycleId,input.file.name,mimeType,cyclePhase)}catch(extractionError){await cleanup(document.id);throw extractionError}
  }else if(['posturography','vhit'].includes(input.documentType)){
    const{error:studyError}=await client.from('clinical_studies').insert({patient_id:input.patientId,treatment_cycle_id:input.treatmentCycleId||null,source_document_id:document.id,study_type:input.documentType,cycle_phase:cyclePhase,performed_at:`${input.documentDate}T12:00:00`,device_name:input.deviceName||null,protocol_code:input.protocolCode||'manual-upload',protocol_version:input.protocolVersion||'1',status:'draft',created_by:auth.user.id})
    if(studyError){await cleanup(document.id);throw studyError}
  }
  if(input.shareWithPatient&&!input.extractionDraft)await client.from('document_permissions').insert({patient_id:input.patientId,document_id:document.id,level:'view',granted_by:auth.user.id})
  const items=await listPatientDocuments(input.patientId);const created=items.find(item=>item.id===document.id);if(!created)throw new Error('El documento se guardó, pero no pudo recuperarse.');return created
}

export async function setDocumentPermission(document:ClinicalDocumentRecord,level:DocumentPermissionLevel|null):Promise<void>{
  if(!isSupabaseConfigured||!supabase){writeDemo(readDemo().map(item=>item.id===document.id?{...item,sharedWithPatient:Boolean(level),permissionId:level?(item.permissionId||crypto.randomUUID()):item.permissionId,permissionLevel:level??''}:item));return}
  const{data:auth}=await supabase.auth.getUser();if(!auth.user)throw new Error('Sesión profesional no disponible.')
  if(level){const{error}=await supabase.from('document_permissions').upsert({patient_id:document.patientId,document_id:document.id,level,granted_by:auth.user.id,granted_at:new Date().toISOString(),revoked_at:null},{onConflict:'patient_id,document_id'});if(error)throw error}
  else{const{error}=await supabase.from('document_permissions').update({revoked_at:new Date().toISOString()}).eq('patient_id',document.patientId).eq('document_id',document.id).is('revoked_at',null);if(error)throw error}
}

export async function createDocumentUrl(document:ClinicalDocumentRecord,download=false):Promise<string>{
  if(!isSupabaseConfigured||!supabase)throw new Error('La demostración conserva metadatos, pero no sube el archivo original.')
  if(download&&!document.storagePath&&document.permissionLevel!=='view_download')throw new Error('Este permiso no habilita la descarga.')
  let storagePath=document.storagePath
  if(!storagePath){const{data:source,error:sourceError}=await supabase.from('source_documents').select('storage_path').eq('id',document.id).maybeSingle();if(sourceError)throw sourceError;if(!source)throw new Error('El documento no está autorizado.');storagePath=source.storage_path}
  const{data,error}=await supabase.storage.from('clinical-documents').createSignedUrl(storagePath,300,{download:download?document.originalFilename:false});if(error)throw error
  const{error:auditError}=await supabase.rpc('record_document_access_event',{target_document_id:document.id,access_action:download?'download':'view'});if(auditError)throw auditError
  return data.signedUrl
}

function requestFromRow(row:Record<string,unknown>):DocumentAccessRequestRecord{const document=(row.source_documents??{}) as Record<string,unknown>;return{id:String(row.id),patientId:String(row.patient_id),documentId:String(row.document_id),documentType:String(document.document_type) as DocumentAccessRequestRecord['documentType'],originalFilename:String(document.original_filename??''),documentDate:String(document.document_date??''),status:String(row.status) as DocumentRequestStatus,requestedAt:String(row.requested_at),resolvedAt:String(row.resolved_at??''),resolutionNote:String(row.resolution_note??'')}}

export async function listPatientDocumentAccessRequests(patientId:string):Promise<DocumentAccessRequestRecord[]>{
  if(!isSupabaseConfigured||!supabase)return readDemoRequests().filter(item=>item.patientId===patientId).sort((a,b)=>b.requestedAt.localeCompare(a.requestedAt))
  const{data,error}=await supabase.from('document_access_requests').select('*, source_documents(document_type, original_filename, document_date)').eq('patient_id',patientId).order('requested_at',{ascending:false});if(error)throw error;return(data??[]).map(row=>requestFromRow(row as unknown as Record<string,unknown>))
}

export async function requestDocumentAccess(documentId:string):Promise<string>{
  if(!isSupabaseConfigured||!supabase){const document=readDemo().find(item=>item.id===documentId&&item.patientId==='ana-p');if(!document)throw new Error('Documento no encontrado.');if(document.sharedWithPatient)throw new Error('El documento ya está autorizado.');const requests=readDemoRequests();const existing=requests.find(item=>item.documentId===documentId&&item.status==='pending');if(existing)return existing.id;const record:DocumentAccessRequestRecord={id:crypto.randomUUID(),patientId:document.patientId,documentId:document.id,documentType:document.documentType,originalFilename:document.originalFilename,documentDate:document.documentDate,status:'pending',requestedAt:new Date().toISOString(),resolvedAt:'',resolutionNote:''};writeDemoRequests([...requests,record]);return record.id}
  const{data,error}=await supabase.rpc('request_document_access',{target_document_id:documentId});if(error)throw error;return String(data)
}

export async function resolveDocumentAccessRequest(requestId:string,decision:'approved'|'denied',level:DocumentPermissionLevel='view',professionalNote=''):Promise<void>{
  if(!isSupabaseConfigured||!supabase){const requests=readDemoRequests();const request=requests.find(item=>item.id===requestId&&item.status==='pending');if(!request)throw new Error('Solicitud no encontrada o ya resuelta.');writeDemoRequests(requests.map(item=>item.id===requestId?{...item,status:decision,resolvedAt:new Date().toISOString(),resolutionNote:professionalNote}:item));if(decision==='approved'){const document=readDemo().find(item=>item.id===request.documentId);if(document)await setDocumentPermission(document,level)}return}
  const{error}=await supabase.rpc('resolve_document_access_request',{target_request_id:requestId,decision,granted_level:level,professional_note:professionalNote||null});if(error)throw error
}
