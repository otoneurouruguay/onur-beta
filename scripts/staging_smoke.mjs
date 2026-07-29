import { createClient } from '@supabase/supabase-js'

const required=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY']
for(const key of required)if(!process.env[key])throw new Error(`Falta ${key}`)

const url=process.env.SUPABASE_URL
const anonKey=process.env.SUPABASE_ANON_KEY
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY
const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
const token=`${Date.now()}-${crypto.randomUUID().slice(0,8)}`
const professionalEmail=`onur-staging-prof-${token}@example.invalid`
const professionalPassword=`Onur!${crypto.randomUUID()}aA1`
const username=`staging${token.replace(/\D/g,'').slice(-10)}${crypto.randomUUID().replace(/-/g,'').slice(0,6)}`.slice(0,38)
const temporaryCi='45678901'
const pin='2468'
const created={professionalUserId:'',foreignProfessionalUserId:'',patientUserId:'',patientId:'',otherPatientId:'',questAssignmentId:'',storagePath:''}

function assert(condition,message){if(!condition)throw new Error(message)}
function assertNoError(result,label){if(result.error)throw new Error(`${label}: ${result.error.message}`);return result.data}
function client(){return createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}})}
function log(message){process.stdout.write(`✓ ${message}\n`)}

async function patientLogin(secret){
  const response=await fetch(`${url}/functions/v1/patient-login`,{method:'POST',headers:{apikey:anonKey,'Content-Type':'application/json'},body:JSON.stringify({username,secret})})
  const body=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(`patient-login (${response.status}): ${body.error??'error desconocido'}`)
  return body
}

async function cleanup(){
  const failures=[]
  async function attempt(label,operation){
    try{
      const result=await operation()
      if(result?.error)failures.push(`${label}: ${result.error.message}`)
    }catch(error){failures.push(`${label}: ${error instanceof Error?error.message:String(error)}`)}
  }

  if(created.storagePath)await attempt('archivo de Storage',()=>admin.storage.from('clinical-documents').remove([created.storagePath]))
  if(created.patientId)await attempt('paciente principal',()=>admin.from('patients').delete().eq('id',created.patientId))
  if(created.otherPatientId)await attempt('paciente aislado',()=>admin.from('patients').delete().eq('id',created.otherPatientId))
  if(created.professionalUserId){
    await attempt('planes de sesión',()=>admin.from('session_plans').delete().eq('professional_id',created.professionalUserId))
    await attempt('plantillas de ejercicio',()=>admin.from('exercise_templates').delete().eq('professional_id',created.professionalUserId))
  }
  const actorIds=[created.patientUserId,created.professionalUserId,created.foreignProfessionalUserId].filter(Boolean)
  if(actorIds.length)await attempt('auditorías',()=>admin.from('audit_events').delete().in('actor_user_id',actorIds))
  if(created.questAssignmentId)await attempt('auditorías anónimas Quest',()=>admin.from('audit_events').delete().eq('entity_id',created.questAssignmentId))
  if(created.patientUserId)await attempt('identidad paciente',()=>admin.auth.admin.deleteUser(created.patientUserId))
  if(created.foreignProfessionalUserId)await attempt('identidad profesional aislada',()=>admin.auth.admin.deleteUser(created.foreignProfessionalUserId))
  if(created.professionalUserId)await attempt('identidad profesional',()=>admin.auth.admin.deleteUser(created.professionalUserId))
  if(failures.length)throw new Error(`La limpieza de staging falló:\n- ${failures.join('\n- ')}`)
}

try{
  const createdProfessional=assertNoError(await admin.auth.admin.createUser({email:professionalEmail,password:professionalPassword,email_confirm:true,app_metadata:{role:'professional'},user_metadata:{display_name:'ONUr Staging Test'}}),'crear profesional')
  created.professionalUserId=createdProfessional.user.id
  const professional=client();assertNoError(await professional.auth.signInWithPassword({email:professionalEmail,password:professionalPassword}),'login profesional')
  const bapDefinitions=assertNoError(await professional.from('metric_definitions').select('code,allowed_units').in('code',['sway_per_second_x','sway_per_second_y','sway_per_minute_x','sway_per_minute_y','aphysiological_pattern']),'leer diccionario BAP 2.3.2')
  assert(bapDefinitions.length===5&&bapDefinitions.some(item=>item.code==='sway_per_second_x'&&item.allowed_units?.includes('oscillations_per_second'))&&bapDefinitions.some(item=>item.code==='sway_per_minute_x'&&item.allowed_units?.includes('oscillations_per_minute')),'El diccionario BAP 2.3.2 no conserva las unidades de Sway.')
  const foreignProfessionalEmail=`onur-staging-foreign-${token}@example.invalid`
  const foreignProfessionalPassword=`Onur!${crypto.randomUUID()}bB2`
  const createdForeignProfessional=assertNoError(await admin.auth.admin.createUser({email:foreignProfessionalEmail,password:foreignProfessionalPassword,email_confirm:true,app_metadata:{role:'professional'},user_metadata:{display_name:'ONUr Staging Aislado'}}),'crear profesional aislado')
  created.foreignProfessionalUserId=createdForeignProfessional.user.id
  const foreignProfessional=client();assertNoError(await foreignProfessional.auth.signInWithPassword({email:foreignProfessionalEmail,password:foreignProfessionalPassword}),'login profesional aislado')
  log('autenticación profesional y trigger de perfil')

  const patient=assertNoError(await professional.from('patients').insert({professional_id:created.professionalUserId,full_name:'Paciente Ficticio Staging',birth_date:'1960-01-01',insurer:'Prueba ONUr',status:'active'}).select().single(),'crear paciente')
  created.patientId=patient.id
  const other=assertNoError(await foreignProfessional.from('patients').insert({professional_id:created.foreignProfessionalUserId,full_name:'Paciente Aislado Staging',status:'active'}).select().single(),'crear segundo paciente')
  created.otherPatientId=other.id

  const accountResult=await professional.functions.invoke('create-patient-account',{body:{patient_id:created.patientId,username,temporary_ci:temporaryCi}})
  assertNoError(accountResult,'crear cuenta paciente')
  const account=assertNoError(await admin.from('patient_portal_accounts').select('auth_user_id').eq('patient_id',created.patientId).single(),'leer cuenta paciente')
  created.patientUserId=account.auth_user_id

  const firstLogin=await patientLogin(temporaryCi);assert(firstLogin.must_change_pin===true,'El primer acceso no exige cambio de PIN.')
  const patientClient=client();assertNoError(await patientClient.auth.setSession({access_token:firstLogin.session.access_token,refresh_token:firstLogin.session.refresh_token}),'establecer sesión paciente')
  const temporaryRows=assertNoError(await patientClient.from('patients').select('id'),'RLS temporal pacientes')
  assert(temporaryRows.length===0,'La sesión temporal pudo leer datos clínicos antes de cambiar el PIN.')
  log('bloqueo clínico de la sesión temporal')

  const pinChange=assertNoError(await patientClient.functions.invoke('change-patient-pin',{body:{pin}}),'cambiar PIN')
  assertNoError(await patientClient.auth.setSession({access_token:pinChange.session.access_token,refresh_token:pinChange.session.refresh_token}),'renovar sesión después del PIN')
  const secondLogin=await patientLogin(pin);assert(secondLogin.must_change_pin===false,'El cambio de PIN no quedó confirmado.')
  const ownRows=assertNoError(await patientClient.from('patients').select('id'),'RLS pacientes')
  assert(ownRows.length===1&&ownRows[0].id===created.patientId,'El paciente pudo ver un perfil ajeno o no pudo ver su propio perfil.')
  log('aislamiento RLS entre pacientes')
  log('primer acceso con cédula temporal y PIN de cuatro dígitos')

  created.storagePath=`${created.professionalUserId}/${created.patientId}/${crypto.randomUUID()}-staging.pdf`
  const fileBytes=new TextEncoder().encode('%PDF-1.4\n% ONUr staging ficticio\n')
  assertNoError(await professional.storage.from('clinical-documents').upload(created.storagePath,fileBytes,{contentType:'application/pdf'}),'subir archivo privado')
  const document=assertNoError(await professional.from('source_documents').insert({patient_id:created.patientId,document_type:'posturography',original_filename:'posturografia-staging.pdf',storage_path:created.storagePath,mime_type:'application/pdf',sha256:'0'.repeat(64),uploaded_by:created.professionalUserId,document_date:'2026-07-16',description:'Dato ficticio de smoke test',file_size_bytes:fileBytes.byteLength}).select().single(),'crear documento')

  const lockedDirect=assertNoError(await patientClient.from('source_documents').select('id'),'documento privado')
  assert(lockedDirect.length===0,'El paciente leyó un documento sin permiso.')
  const catalog=assertNoError(await patientClient.rpc('list_my_document_catalog'),'catálogo seguro')
  assert(catalog.length===1&&!Object.hasOwn(catalog[0],'storage_path'),'El catálogo expuso storage_path o no enumeró el documento.')
  assertNoError(await patientClient.rpc('request_document_access',{target_document_id:document.id}),'solicitar acceso')
  const request=assertNoError(await professional.from('document_access_requests').select('id,status').eq('document_id',document.id).single(),'leer solicitud')
  assertNoError(await professional.rpc('resolve_document_access_request',{target_request_id:request.id,decision:'approved',granted_level:'view',professional_note:'Smoke test'}),'aprobar solo vista')
  const permitted=assertNoError(await patientClient.from('source_documents').select('id,storage_path'),'documento autorizado')
  assert(permitted.length===1,'El permiso de visualización no habilitó el documento.')
  const downloadAudit=await patientClient.rpc('record_document_access_event',{target_document_id:document.id,access_action:'download'})
  assert(downloadAudit.error,'El nivel view autorizó incorrectamente una descarga auditada.')
  assertNoError(await patientClient.rpc('record_document_access_event',{target_document_id:document.id,access_action:'view'}),'auditar vista')
  assertNoError(await professional.from('document_permissions').update({level:'view_download'}).eq('document_id',document.id),'ampliar permiso')
  assertNoError(await patientClient.rpc('record_document_access_event',{target_document_id:document.id,access_action:'download'}),'auditar descarga')
  assertNoError(await professional.from('document_permissions').update({revoked_at:new Date().toISOString()}).eq('document_id',document.id),'revocar permiso')
  const revoked=assertNoError(await patientClient.from('source_documents').select('id'),'validar revocación')
  assert(revoked.length===0,'La revocación no invalidó el acceso al documento.')
  log('Storage privado, solicitud, vista, descarga y revocación')

  const extractionPayload={intake_kind:'posturography_bap',extractor_version:'onur-local-ocr-smoke-1',patient_match_status:'mismatch',mismatch_fields:['name'],pages:[{page_number:1,proposed_classification:'posturography',classification:'posturography',classification_confidence:.99,rotation_degrees:0,width:1000,height:1400}],fields:[{client_id:'synthetic-condition-1',code:'condition_1',label:'Condición 1',group:'Condiciones',study_type:'posturography',required:true,metric_code:'condition_score',raw_value:'75,0',normalized_value:'75',unit_code:'percent',condition_code:'1',side:'',page_number:1,region:{x:.1,y:.2,width:.4,height:.04},confidence:.98,status:'read',extractor_method:'local_ocr',extractor_version:'onur-local-ocr-smoke-1',professional_value:'75,0',confirmed:false}]}
  const foreignDraft=await foreignProfessional.rpc('create_document_extraction_draft',{target_document_id:document.id,extraction_payload:extractionPayload,study_date:'2026-07-16',target_treatment_cycle_id:null})
  assert(foreignDraft.error,'Un profesional ajeno pudo crear una extracción.')
  const extraction=assertNoError(await professional.rpc('create_document_extraction_draft',{target_document_id:document.id,extraction_payload:extractionPayload,study_date:'2026-07-16',target_treatment_cycle_id:null}),'crear borrador de extracción')
  const extractionStudyId=extraction.study_ids[0]
  const patientJobs=assertNoError(await patientClient.from('document_extraction_jobs').select('id'),'ocultar borradores al paciente')
  const foreignFields=assertNoError(await foreignProfessional.from('document_extraction_fields').select('id').eq('job_id',extraction.job_id),'aislar campos de extracción')
  assert(patientJobs.length===0&&foreignFields.length===0,'RLS expuso el borrador o sus campos.')
  const foreignReprocess=await foreignProfessional.rpc('replace_document_extraction_candidates',{target_job_id:extraction.job_id,extraction_payload:extractionPayload})
  assert(foreignReprocess.error,'Un profesional ajeno pudo reanalizar la extracción.')
  extractionPayload.extractor_version='onur-local-ocr-smoke-1.1'
  extractionPayload.fields[0].extractor_version='onur-local-ocr-smoke-1.1'
  assertNoError(await professional.rpc('replace_document_extraction_candidates',{target_job_id:extraction.job_id,extraction_payload:extractionPayload}),'reanalizar candidatos de extracción')
  const prematureConfirmation=await professional.rpc('confirm_document_extraction',{target_job_id:extraction.job_id})
  assert(prematureConfirmation.error,'La extracción se confirmó sin revisar el campo obligatorio.')
  extractionPayload.fields[0].confirmed=true
  const unsafeMismatchResolution=await professional.rpc('save_document_extraction_review',{target_job_id:extraction.job_id,review_payload:{patient_match_status:'match',pages:extractionPayload.pages,fields:extractionPayload.fields}})
  assert(unsafeMismatchResolution.error,'La discrepancia se resolvió sin confirmación profesional explícita.')
  assertNoError(await professional.rpc('save_document_extraction_review',{target_job_id:extraction.job_id,review_payload:{patient_match_status:'confirmed_by_professional',pages:extractionPayload.pages,fields:extractionPayload.fields}}),'guardar revisión de extracción')
  const missingReport=await professional.rpc('confirm_document_extraction',{target_job_id:extraction.job_id})
  assert(missingReport.error,'La extracción se confirmó sin conclusión ni rehabilitación profesional.')
  const foreignReport=await foreignProfessional.rpc('save_document_extraction_report',{target_job_id:extraction.job_id,target_professional_conclusion:'Conclusión sintética ajena',target_rehabilitation_suggestion:'Plan sintético ajeno'})
  assert(foreignReport.error,'Un profesional ajeno pudo redactar el informe.')
  assertNoError(await professional.rpc('save_document_extraction_report',{target_job_id:extraction.job_id,target_professional_conclusion:'Conclusión profesional completamente sintética',target_rehabilitation_suggestion:'Sugerencia profesional completamente sintética'}),'guardar conclusión y rehabilitación profesional')
  assertNoError(await professional.rpc('confirm_document_extraction',{target_job_id:extraction.job_id}),'confirmar extracción profesional')
  const confirmedExtraction=assertNoError(await professional.from('document_extraction_jobs').select('status,professional_conclusion,rehabilitation_suggestion,report_confirmed_at').eq('id',extraction.job_id).single(),'leer informe confirmado')
  assert(confirmedExtraction.status==='confirmed'&&confirmedExtraction.professional_conclusion==='Conclusión profesional completamente sintética'&&confirmedExtraction.rehabilitation_suggestion==='Sugerencia profesional completamente sintética'&&confirmedExtraction.report_confirmed_at,'El informe confirmado no conserva los textos profesionales exactos.')
  const extractedStudy=assertNoError(await professional.from('clinical_studies').select('status,metric_values(raw_value,normalized_numeric_value,quality_status)').eq('id',extractionStudyId).single(),'leer estudio extraído')
  assert(extractedStudy.status==='reviewed'&&extractedStudy.metric_values?.[0]?.raw_value==='75,0'&&extractedStudy.metric_values?.[0]?.normalized_numeric_value===75,'La confirmación no preservó raw y normalizado por separado.')
  const extractionAudits=assertNoError(await admin.from('audit_events').select('action,metadata').eq('entity_id',extraction.job_id),'leer auditoría de extracción')
  assert(extractionAudits.some(row=>row.action==='clinical_extraction_confirmed'),'Falta auditoría de confirmación profesional.')
  assert(extractionAudits.some(row=>row.action==='clinical_extraction_reprocessed'),'Falta auditoría del reanálisis local.')
  assert(!JSON.stringify(extractionAudits).includes('75,0'),'La auditoría expuso un valor clínico extraído.')
  assert(!JSON.stringify(extractionAudits).includes('Conclusión profesional completamente sintética'),'La auditoría expuso el texto de la conclusión.')
  log('extracción local, RLS, revisión, confirmación y auditoría sin contenido clínico')

  const directCaptureInput={target_patient_id:created.patientId,target_treatment_cycle_id:null,performed_at_input:new Date().toISOString(),condition_count_input:6,duration_seconds_input:20}
  const foreignDirectCapture=await foreignProfessional.rpc('create_direct_bap_capture_draft',directCaptureInput)
  assert(foreignDirectCapture.error,'Un profesional ajeno pudo crear una captura BAP directa.')
  const patientDirectCapture=await patientClient.rpc('create_direct_bap_capture_draft',directCaptureInput)
  assert(patientDirectCapture.error,'El portal del paciente pudo crear una captura BAP directa.')
  const directStudyId=assertNoError(await professional.rpc('create_direct_bap_capture_draft',directCaptureInput),'crear borrador de captura BAP directa')
  const directMetricPayload=Array.from({length:6},(_,index)=>({metric_code:'condition_score',raw_value:String(80+index),normalized_numeric_value:80+index,normalized_text_value:null,unit_code:'percent',condition_code:String(index+1),side:null,axis:null,trial_number:1,source_method:'transcribed',source_location:`Captura BAP sintética · condición ${index+1}`,normalization_rule_version:'onur-normalization-1.0',quality_status:'ok',issues:[]}))
  assertNoError(await professional.rpc('replace_study_import',{target_study_id:directStudyId,metric_payload:directMetricPayload,import_quality_notes:'Captura directa completamente ficticia de staging',import_interpretable:false,parser_version:'onur-normalization-1.0'}),'guardar parámetros BAP directos')
  const directStudy=assertNoError(await professional.from('clinical_studies').select('status,calculation_method_version,metric_values(source_method)').eq('id',directStudyId).single(),'leer captura BAP directa')
  assert(directStudy.status==='reviewed'&&directStudy.calculation_method_version==='onur-bap-webserial-1.0-beta'&&directStudy.metric_values?.length===6&&directStudy.metric_values.every(metric=>metric.source_method==='direct_capture'),'La captura directa no preservó origen, versión o métricas.')
  const directJob=assertNoError(await professional.from('import_jobs').select('parser_type,parser_version').eq('study_id',directStudyId).single(),'leer importación BAP directa')
  assert(directJob.parser_type==='bap_web_serial'&&directJob.parser_version==='onur-bap-webserial-1.0-beta','La captura directa no quedó identificada por su transporte.')
  const directAudits=assertNoError(await admin.from('audit_events').select('action,metadata').eq('entity_id',directStudyId).eq('action','direct_bap_capture_created'),'leer auditoría BAP directa')
  assert(directAudits.length===1&&directAudits[0].metadata?.transport==='web_serial'&&directAudits[0].metadata?.raw_frames_stored===false,'La auditoría BAP directa no registra el transporte seguro.')
  assert(!JSON.stringify(directAudits).includes('80'),'La auditoría BAP directa expuso un parámetro de la captura.')
  log('captura BAP directa, permisos, trazabilidad y auditoría sin tramas crudas')

  const study=assertNoError(await professional.from('clinical_studies').insert({patient_id:created.patientId,source_document_id:document.id,study_type:'posturography',performed_at:'2026-07-16T12:00:00Z',device_name:'Equipo ficticio',protocol_code:'bap-a-d',protocol_version:'1',created_by:created.professionalUserId}).select().single(),'crear estudio')
  const metricPayload=[{metric_code:'condition_score',raw_value:'75,0',normalized_numeric_value:75,normalized_text_value:null,unit_code:'percent',condition_code:'A',side:null,axis:null,trial_number:1,source_method:'transcribed',source_location:'Smoke test',normalization_rule_version:'onur-normalization-1.0',quality_status:'ok',issues:[]}]
  assertNoError(await professional.rpc('replace_study_import',{target_study_id:study.id,metric_payload:metricPayload,import_quality_notes:'Revisión ficticia de staging',import_interpretable:true,parser_version:'onur-normalization-1.0'}),'confirmar importación')
  const hash=assertNoError(await professional.rpc('finalize_clinical_study',{target_study_id:study.id}),'finalizar estudio')
  assert(/^[0-9a-f]{64}$/.test(hash),'La huella final no es SHA-256 válida.')
  const metric=assertNoError(await professional.from('metric_values').select('id').eq('study_id',study.id).single(),'leer métrica final')
  const forbiddenMutation=await professional.from('metric_values').update({raw_value:'99'}).eq('id',metric.id)
  assert(forbiddenMutation.error,'Fue posible modificar una métrica finalizada.')
  log('finalización, SHA-256 e inmutabilidad de estudios')

  assertNoError(await patientClient.rpc('accept_patient_acknowledgement',{document_code_input:'PORTAL_USE',document_version_input:'1.0-beta'}),'confirmar uso del portal')
  const cycle=assertNoError(await professional.from('treatment_cycles').insert({patient_id:created.patientId,label:'Ciclo smoke',started_on:new Date().toISOString().slice(0,10),status:'active'}).select().single(),'crear ciclo de sesión')
  const plan=assertNoError(await professional.from('session_plans').insert({professional_id:created.professionalUserId,title:'Sesión smoke',instructions:'Datos ficticios',plan_definition:{mode:'home',exercises:[]}}).select().single(),'crear plan de sesión')
  const assignment=assertNoError(await professional.from('session_assignments').insert({patient_id:created.patientId,treatment_cycle_id:cycle.id,session_plan_id:plan.id,available_from:new Date(Date.now()-60000).toISOString(),status:'assigned',assigned_by:created.professionalUserId}).select().single(),'asignar sesión')
  const directExecution=await patientClient.from('session_executions').insert({assignment_id:assignment.id,patient_id:created.patientId,status:'completed',finished_at:new Date().toISOString(),active_seconds:1})
  assert(directExecution.error,'El paciente pudo insertar una ejecución sin la función validada.')
  const legacyCompletion=await patientClient.rpc('complete_session_assignment',{target_assignment_id:assignment.id,active_seconds_input:1,skipped_count_input:0,event_log_input:[]})
  assert(legacyCompletion.error,'La función de finalización anterior continúa autorizada.')
  assertNoError(await patientClient.rpc('start_session_assignment',{target_assignment_id:assignment.id}),'iniciar sesión')
  assertNoError(await patientClient.rpc('complete_session_assignment_v2',{target_assignment_id:assignment.id,active_seconds_input:42,skipped_count_input:0,initial_discomfort_input:2,final_discomfort_input:3,perceived_difficulty_input:2,patient_comment_input:'Dato ficticio',event_log_input:[{type:'finished'}]}),'finalizar sesión con auto-reporte')
  const execution=assertNoError(await professional.from('session_executions').select('active_seconds,initial_discomfort,final_discomfort,perceived_difficulty,patient_comment').eq('assignment_id',assignment.id).single(),'leer auto-reporte')
  assert(execution.active_seconds===42&&execution.initial_discomfort===2&&execution.final_discomfort===3&&execution.perceived_difficulty===2,'El auto-reporte no quedó guardado correctamente.')
  log('confirmación de uso, inicio y cierre transaccional de sesión')

  const inPersonPlan=assertNoError(await professional.from('session_plans').insert({professional_id:created.professionalUserId,title:'Sesión presencial ficticia',instructions:'Supervisión ficticia de staging',plan_definition:{mode:'in_person',exercises:[]}}).select().single(),'crear plan presencial')
  const inPersonAssignment=assertNoError(await professional.from('session_assignments').insert({patient_id:created.patientId,treatment_cycle_id:cycle.id,session_plan_id:inPersonPlan.id,available_from:new Date(Date.now()-60000).toISOString(),status:'assigned',assigned_by:created.professionalUserId}).select().single(),'asignar sesión presencial')
  const hiddenInPerson=assertNoError(await patientClient.from('session_assignments').select('id').eq('id',inPersonAssignment.id),'ocultar presencial al paciente')
  assert(hiddenInPerson.length===0,'El portal domiciliario pudo consultar una asignación presencial pendiente.')
  const patientHomeStartOnInPerson=await patientClient.rpc('start_session_assignment',{target_assignment_id:inPersonAssignment.id})
  assert(patientHomeStartOnInPerson.error,'La función domiciliaria permitió iniciar una asignación presencial.')
  const patientSupervisedStart=await patientClient.rpc('start_supervised_in_person_session',{target_assignment_id:inPersonAssignment.id,initial_discomfort_input:2})
  assert(patientSupervisedStart.error,'El paciente pudo invocar el inicio presencial supervisado.')
  const foreignStart=await foreignProfessional.rpc('start_supervised_in_person_session',{target_assignment_id:inPersonAssignment.id,initial_discomfort_input:2})
  assert(foreignStart.error,'Un profesional ajeno pudo iniciar la sesión presencial.')

  const firstSupervisedExecutionId=assertNoError(await professional.rpc('start_supervised_in_person_session',{target_assignment_id:inPersonAssignment.id,initial_discomfort_input:2}),'iniciar presencial supervisada')
  const restartedSupervisedExecutionId=assertNoError(await professional.rpc('start_supervised_in_person_session',{target_assignment_id:inPersonAssignment.id,initial_discomfort_input:4}),'reiniciar presencial desde el principio')
  assert(firstSupervisedExecutionId===restartedSupervisedExecutionId,'El reinicio creó una segunda ejecución abierta.')
  const openExecutions=assertNoError(await professional.from('session_executions').select('id,active_seconds,initial_discomfort,event_log,execution_mode,supervised,operated_by').eq('assignment_id',inPersonAssignment.id).is('finished_at',null),'leer ejecución presencial abierta')
  assert(openExecutions.length===1,'No existe exactamente una ejecución presencial abierta.')
  assert(openExecutions[0].active_seconds===0&&openExecutions[0].initial_discomfort===4,'El reinicio no volvió al principio o no actualizó el malestar inicial.')
  assert(openExecutions[0].event_log?.[0]?.type==='restarted_from_beginning','El reinicio no quedó identificado en el registro de eventos.')
  assert(openExecutions[0].execution_mode==='in_person'&&openExecutions[0].supervised===true&&openExecutions[0].operated_by===created.professionalUserId,'La ejecución no identifica modo, supervisión u operador.')

  const finishedSupervisedExecutionId=assertNoError(await professional.rpc('complete_supervised_in_person_session',{target_assignment_id:inPersonAssignment.id,active_seconds_input:37,skipped_count_input:1,final_discomfort_input:3,perceived_difficulty_input:2,patient_comment_input:'Comentario ficticio del paciente',professional_observation_input:'Observación profesional ficticia',event_log_input:[{type:'finished',skipped_exercises:1}]}),'finalizar presencial supervisada')
  assert(finishedSupervisedExecutionId===firstSupervisedExecutionId,'El cierre no actualizó la ejecución presencial abierta.')
  const supervisedExecution=assertNoError(await professional.from('session_executions').select('status,active_seconds,initial_discomfort,final_discomfort,perceived_difficulty,patient_comment,professional_observation,execution_mode,supervised,operated_by').eq('id',finishedSupervisedExecutionId).single(),'leer cierre presencial')
  assert(supervisedExecution.status==='partial'&&supervisedExecution.active_seconds===37,'La omisión no dejó el cierre presencial como parcial.')
  assert(supervisedExecution.initial_discomfort===4&&supervisedExecution.final_discomfort===3&&supervisedExecution.perceived_difficulty===2,'Las escalas presenciales no quedaron guardadas.')
  assert(supervisedExecution.patient_comment==='Comentario ficticio del paciente'&&supervisedExecution.professional_observation==='Observación profesional ficticia','Los comentarios del cierre presencial no quedaron guardados.')
  const supervisedAssignmentStatus=assertNoError(await professional.from('session_assignments').select('status').eq('id',inPersonAssignment.id).single(),'leer estado presencial')
  assert(supervisedAssignmentStatus.status==='partial','La asignación presencial no reflejó la omisión.')

  const duplicatedAssignmentId=assertNoError(await professional.rpc('duplicate_in_person_assignment_as_home',{target_assignment_id:inPersonAssignment.id}),'duplicar presencial como domiciliaria')
  assert(duplicatedAssignmentId!==inPersonAssignment.id,'La duplicación reutilizó la asignación presencial original.')
  const duplicatedAssignment=assertNoError(await professional.from('session_assignments').select('id,status,session_plan_id,session_plans(plan_definition)').eq('id',duplicatedAssignmentId).single(),'leer duplicación domiciliaria')
  assert(duplicatedAssignment.status==='assigned'&&duplicatedAssignment.session_plans?.plan_definition?.mode==='home','La duplicación no creó una asignación domiciliaria independiente.')
  const duplicatedVisibleAtHome=assertNoError(await patientClient.from('session_assignments').select('id').eq('id',duplicatedAssignmentId),'consultar duplicación domiciliaria')
  assert(duplicatedVisibleAtHome.length===1,'La asignación domiciliaria duplicada no quedó disponible para el paciente.')

  const supervisedAudits=assertNoError(await admin.from('audit_events').select('actor_user_id,action,metadata').eq('entity_id',inPersonAssignment.id).in('action',['supervised_in_person_session_started','supervised_in_person_session_restarted','supervised_in_person_session_finished']),'leer auditoría presencial')
  assert(supervisedAudits.length===3,'Faltan eventos de inicio, reinicio o cierre presencial.')
  for(const row of supervisedAudits)assert(row.actor_user_id===created.professionalUserId&&row.metadata?.mode==='in_person'&&row.metadata?.supervised===true&&row.metadata?.operated_by===created.professionalUserId,'La auditoría presencial no identifica supervisión y operador.')
  log('permisos, flujo presencial, reinicio, omisión, duplicación y auditoría')

  const questPlanDefinition={mode:'in_person',exercises:[{name:'Optocinético Quest ficticio',displayMode:'quest_browser',doseMode:'time',advanceMode:'automatic',durationSeconds:20,rounds:1,restSeconds:0,posture:'seated',surface:'firm',supervision:'direct_clinician'}]}
  const questPlan=assertNoError(await professional.from('session_plans').insert({professional_id:created.professionalUserId,title:'Sesión Quest ficticia',instructions:'Supervisión directa ficticia',plan_definition:questPlanDefinition}).select().single(),'crear plan Quest')
  const questAssignment=assertNoError(await professional.from('session_assignments').insert({patient_id:created.patientId,treatment_cycle_id:cycle.id,session_plan_id:questPlan.id,available_from:new Date(Date.now()-60000).toISOString(),status:'assigned',assigned_by:created.professionalUserId}).select().single(),'asignar sesión Quest')
  created.questAssignmentId=questAssignment.id
  assertNoError(await professional.rpc('start_supervised_in_person_session',{target_assignment_id:questAssignment.id,initial_discomfort_input:2}),'iniciar sesión Quest supervisada')
  const foreignPairing=await foreignProfessional.rpc('create_quest_session_pairing',{target_assignment_id:questAssignment.id})
  assert(foreignPairing.error,'Un profesional ajeno pudo preparar la estación Quest.')
  const pairing=assertNoError(await professional.rpc('create_quest_session_pairing',{target_assignment_id:questAssignment.id}),'crear vínculo Quest')
  assert(/^[0-9]{4}$/.test(pairing.code),'El vínculo Quest no devolvió un código numérico temporal de cuatro dígitos.')
  const questStation=client()
  const claim=assertNoError(await questStation.rpc('claim_quest_session_pairing',{pairing_code_input:pairing.code}),'reclamar vínculo Quest anónimo')
  assert(claim.pairingId===pairing.id&&claim.deviceToken&&claim.patientLabel==='Paciente F.','La estación Quest no recibió el vínculo mínimo esperado.')
  assert(!Object.hasOwn(claim,'fullName')&&!JSON.stringify(claim).includes(created.patientId),'La estación Quest expuso identidad completa o identificadores clínicos del paciente.')
  const duplicateClaim=await questStation.rpc('claim_quest_session_pairing',{pairing_code_input:pairing.code})
  assert(duplicateClaim.error,'El código Quest pudo reclamarse una segunda vez.')
  const wrongCapture=await questStation.rpc('submit_quest_session_capture',{target_pairing_id:pairing.id,device_token_input:'0'.repeat(64),captured_result_input:{activeSeconds:20,skippedExercises:0,eventLog:[]}})
  assert(wrongCapture.error,'La estación Quest aceptó un resultado con token incorrecto.')
  assertNoError(await questStation.rpc('submit_quest_session_capture',{target_pairing_id:pairing.id,device_token_input:claim.deviceToken,captured_result_input:{activeSeconds:20,skippedExercises:0,eventLog:[{type:'finished'}]}}),'capturar resultado Quest')
  const recoveredPairing=assertNoError(await professional.rpc('find_quest_session_pairing_for_assignment',{target_assignment_id:questAssignment.id}),'recuperar resultado Quest')
  assert(recoveredPairing.status==='captured'&&recoveredPairing.capturedResult?.activeSeconds===20,'El resultado Quest no quedó disponible para revisión profesional.')
  const questStatusBeforeReview=assertNoError(await professional.from('session_assignments').select('status').eq('id',questAssignment.id).single(),'leer sesión Quest antes del cierre')
  assert(questStatusBeforeReview.status==='started','Quest completó la asignación sin revisión profesional.')
  assertNoError(await professional.rpc('complete_supervised_in_person_session',{target_assignment_id:questAssignment.id,active_seconds_input:20,skipped_count_input:0,final_discomfort_input:2,perceived_difficulty_input:1,patient_comment_input:'Comentario Quest ficticio',professional_observation_input:'Observación Quest ficticia',event_log_input:[{type:'finished'}]}),'cerrar Quest después de revisión profesional')
  const questAudits=assertNoError(await admin.from('audit_events').select('action').eq('entity_id',questAssignment.id).in('action',['quest_session_pairing_created','quest_session_pairing_claimed','quest_session_capture_received','supervised_in_person_session_finished']),'leer auditoría Quest')
  assert(questAudits.length===4,'Faltan eventos de preparación, reclamo, captura o cierre Quest.')
  log('código Quest efímero, captura anónima mínima, recuperación y cierre profesional')

  const disable=await professional.functions.invoke('manage-patient-account',{body:{patient_id:created.patientId,action:'disable'}});assertNoError(disable,'desactivar cuenta')
  const afterDisable=assertNoError(await patientClient.from('patients').select('id'),'sesión revocada')
  assert(afterDisable.length===0,'Una sesión abierta conservó acceso tras desactivar la cuenta.')
  log('revocación inmediata sobre sesión paciente abierta')

  const auditRows=assertNoError(await admin.from('audit_events').select('action').in('actor_user_id',[created.professionalUserId,created.patientUserId]),'leer auditoría')
  const audited=auditRows.map(row=>row.action)
  for(const action of ['patient_account_created','patient_pin_changed','document_access_requested','document_access_approved','document_viewed','document_downloaded','clinical_extraction_started','clinical_pages_classified','clinical_extraction_review_saved','clinical_extraction_confirmed','clinical_study_finalized','patient_acknowledgement_accepted','session_started','session_finished','supervised_in_person_session_started','supervised_in_person_session_restarted','supervised_in_person_session_finished','session_assignment_duplicated_as_home','patient_account_disable'])assert(audited.includes(action),`Falta auditoría ${action}.`)
  log('eventos críticos de auditoría')
  process.stdout.write('\nSmoke test de staging completado correctamente.\n')
}finally{await cleanup()}

const patientResidue=assertNoError(await admin.from('patients').select('id').in('id',[created.patientId,created.otherPatientId].filter(Boolean)),'verificar limpieza de pacientes')
const documentResidue=created.patientId?assertNoError(await admin.from('source_documents').select('id').eq('patient_id',created.patientId),'verificar limpieza de documentos'):[]
const auditResidue=assertNoError(await admin.from('audit_events').select('id').in('actor_user_id',[created.patientUserId,created.professionalUserId,created.foreignProfessionalUserId].filter(Boolean)),'verificar limpieza de auditoría')
const storageResidue=created.professionalUserId&&created.patientId?assertNoError(await admin.storage.from('clinical-documents').list(`${created.professionalUserId}/${created.patientId}`),'verificar limpieza de Storage'):[]
assert(patientResidue.length===0&&documentResidue.length===0&&auditResidue.length===0&&storageResidue.length===0,'Quedaron residuos sintéticos del smoke test en staging.')
log('limpieza completa de datos sintéticos de staging')
