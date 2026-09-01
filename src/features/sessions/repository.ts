import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { defaultExerciseConfig, normalizeExerciseConfig, type ExerciseConfig } from '../exercise/types'
import { getPatient } from '../patients/repository'
import type { CycleFormValues, RetrospectiveSessionValues, SessionFormValues } from './schema'
import { analyzeSessionSequence, VR_BOX_TRANSITION_SECONDS } from './sequence'
import { validateRepetitionDates } from './repetition'

export type CycleStatus = 'active' | 'paused' | 'completed'
export type AssignmentStatus = 'assigned' | 'started' | 'completed' | 'partial' | 'interrupted' | 'omitted' | 'revoked'

export interface SessionEventLogEntry {
  type: 'exercise_completed' | 'exercise_partial' | 'exercise_skipped' | 'vr_box_put_on' | 'vr_box_take_off' | 'interrupted' | 'finished' | 'free_session_recorded' | 'free_session_cancelled' | 'retrospective_session_recorded' | 'session_cancelled'
  at: string
  exercise_index?: number
  round?: number
  exercise_name?: string
  exercise_kind?: string
  dose_mode?: string
  display_mode?: string
  viewer_profile?: 'vr_box' | 'cardboard' | 'quest_webxr'
  head_tracking_mode?: 'orientation_3dof'
  spatial_anchor?: 'calibrated_direction'
  tracking_recenter_count?: number
  tracking_loss_count?: number
  tracking_final_status?: 'tracking' | 'lost' | 'unavailable'
  cardboard_optical_profile?: string
  cardboard_image_separation_percent?: number
  cardboard_vertical_offset_percent?: number
  cardboard_horizontal_fov_degrees?: number
  cardboard_vertical_fov_degrees?: number
  cardboard_lens_distortion_percent?: number
  active_seconds?: number
  target_repetitions?: number
  reported_repetitions?: number
  completion?: string
  cognitive_mode?: string
  cognitive_response_mode?: string
  cognitive_target_events?: number
  cognitive_response_count?: number
  cognitive_correct_responses?: number
  cognitive_false_alarms?: number
  cognitive_reported_count?: number
  immersive_scenario_id?: string
  immersive_rendering?: 'webxr_6dof' | 'cardboard_3dof'
  immersive_kind?: 'procedural' | 'contextual'
  immersive_geometry?: 'curved_panel' | 'cylinder' | 'front_disc' | 'particle_tunnel'
  immersive_coverage_degrees?: 90 | 180 | 360
  immersive_angular_speed_degrees?: number
  immersive_pattern_angular_size_degrees?: number
  immersive_target_angular_size_degrees?: number
  head_deviation_warning_count?: number
  xr_session_loss_count?: number
  immersive_audio_enabled?: boolean
  immersive_audio_volume?: number
  immersive_target_enabled?: boolean
  immersive_target_azimuth_degrees?: number
  immersive_target_elevation_degrees?: number
  skipped_exercises?: number
  performed_exercise_indexes?: number[]
  omitted_exercises?: { exerciseIndex: number; exerciseName: string; reason: string }[]
}

export interface TreatmentCycleRecord {
  id: string; patientId: string; label: string; reason: string; objectives: string
  status: CycleStatus; startedOn: string; endedOn: string
}

export interface SessionAssignmentRecord {
  id: string; patientId: string; treatmentCycleId: string; sessionPlanId: string
  patientName: string
  title: string; instructions: string; kind?: 'exercise' | 'free_note'; mode: 'home' | 'in_person'; exercises: ExerciseConfig[]
  availableFrom: string; availableUntil: string; status: AssignmentStatus; createdAt: string
  activeSeconds: number; completedAt: string
  initialDiscomfort: number | null; finalDiscomfort: number | null
  peakDiscomfort?: number | null; recoveryMinutes?: number | null
  delayedResponse?: string; progressionDecision?: string
  perceivedDifficulty: number | null; patientComment: string
  professionalObservation?: string; supervised?: boolean; operatedBy?: string
  eventLog?: SessionEventLogEntry[]
  revokedAt?: string
  revokedBy?: string
  revokedReason?: string
  registeredRetrospectively?: boolean
  actualPerformedAt?: string
  retrospectiveRecordedAt?: string
  retrospectiveRecordedBy?: string
  retrospectiveWithoutMetrics?: boolean
  retrospectiveDevice?: RetrospectiveSessionValues['device']
  cancelledAt?: string
  cancelledBy?: string
  cancellationReason?: string
  repeatSeriesId?: string
  repeatSeriesPosition?: number
  repeatSeriesSize?: number
  repeatSourceAssignmentId?: string
}

export interface RepeatSessionAssignmentInput {
  assignment: SessionAssignmentRecord
  dates: string[]
  seriesId: string
}

export interface RetrospectiveCompletionInput {
  assignment: Pick<SessionAssignmentRecord, 'id' | 'patientId' | 'exercises' | 'kind'>
  details: RetrospectiveSessionValues
}

export interface SessionCompletionInput {
  assignment: Pick<SessionAssignmentRecord, 'id' | 'patientId'>
  activeSeconds: number
  skippedExercises: number
  initialDiscomfort: number
  peakDiscomfort?: number
  finalDiscomfort: number
  recoveryMinutes?: number | null
  perceivedDifficulty: number
  patientComment: string
  eventLog?: SessionEventLogEntry[]
}

export interface SessionInterruptionInput {
  assignment: Pick<SessionAssignmentRecord, 'id' | 'patientId'>
  activeSeconds: number
  skippedExercises: number
  initialDiscomfort: number
  eventLog?: SessionEventLogEntry[]
}

export interface SupervisedSessionCompletionInput {
  assignment: Pick<SessionAssignmentRecord, 'id' | 'patientId'>
  activeSeconds: number
  skippedExercises: number
  peakDiscomfort?: number
  finalDiscomfort: number
  recoveryMinutes?: number | null
  delayedResponse?: string
  progressionDecision?: string
  perceivedDifficulty: number
  patientComment: string
  professionalObservation: string
  eventLog?: SessionEventLogEntry[]
}

export interface FreeInPersonSessionInput {
  assignment: Pick<SessionAssignmentRecord, 'id' | 'patientId'>
  outcome: 'completed' | 'cancelled'
  professionalNote: string
  patientComment: string
}

const CYCLES_KEY = 'onur-demo-cycles-v1'
const ASSIGNMENTS_KEY = 'onur-demo-assignments-v1'
const demoSmoothConfig: ExerciseConfig = {...defaultExerciseConfig,name:'Seguimiento ocular suave',purpose:'smooth_pursuit',patientInstruction:'Mantené la cabeza quieta y seguí el blanco únicamente con los ojos.',objectMode:'tracking'}
const demoOptokineticConfig: ExerciseConfig = {...defaultExerciseConfig,name:'Optocinético · Barras',purpose:'optokinetic',patientInstruction:'Sentado y con la cabeza quieta, observá el patrón en movimiento.',backgroundType:'bars',backgroundSpeed:30,objectEnabled:false}

const demoCycles: TreatmentCycleRecord[] = [
  { id:'cycle-ana-2',patientId:'ana-p',label:'Ciclo 2',reason:'Entrenamiento vestíbulo-visual',objectives:'Mejorar tolerancia y estabilidad visual.',status:'active',startedOn:'2026-07-02',endedOn:'' },
]
const demoAssignments: SessionAssignmentRecord[] = [
  { id:'assignment-ana-in-person',patientId:'ana-p',patientName:'Ana Pereira',treatmentCycleId:'cycle-ana-2',sessionPlanId:'plan-demo-in-person',title:'Estabilidad visual supervisada',instructions:'Datos ficticios de demostración. Realizar junto al profesional.',mode:'in_person',exercises:[defaultExerciseConfig],availableFrom:'2026-07-17T00:00:00.000Z',availableUntil:'',status:'assigned',createdAt:'2026-07-17T00:00:00.000Z',activeSeconds:0,completedAt:'',initialDiscomfort:null,finalDiscomfort:null,perceivedDifficulty:null,patientComment:'' },
  { id:'assignment-ana-today',patientId:'ana-p',patientName:'Ana Pereira',treatmentCycleId:'cycle-ana-2',sessionPlanId:'plan-demo-1',title:'Estabilidad visual',instructions:'Realizar sentado, en un ambiente despejado y según las indicaciones recibidas.',mode:'home',exercises:[defaultExerciseConfig],availableFrom:'2026-07-16T00:00:00.000Z',availableUntil:'',status:'assigned',createdAt:'2026-07-16T00:00:00.000Z',activeSeconds:0,completedAt:'',initialDiscomfort:null,finalDiscomfort:null,perceivedDifficulty:null,patientComment:'' },
  { id:'assignment-ana-4',patientId:'ana-p',patientName:'Ana Pereira',treatmentCycleId:'cycle-ana-2',sessionPlanId:'plan-demo-4',title:'Estabilidad visual',instructions:'Datos ficticios de demostración.',mode:'home',exercises:[defaultExerciseConfig],availableFrom:'2026-07-14T00:00:00.000Z',availableUntil:'',status:'partial',createdAt:'2026-07-13T18:00:00.000Z',activeSeconds:132,completedAt:'2026-07-14T10:12:00.000Z',initialDiscomfort:3,finalDiscomfort:4,perceivedDifficulty:3,patientComment:'' },
  { id:'assignment-jorge-1',patientId:'jorge-m',patientName:'Jorge Martínez',treatmentCycleId:'cycle-jorge-3',sessionPlanId:'plan-demo-5',title:'RVO x1',instructions:'Datos ficticios de demostración.',mode:'in_person',exercises:[defaultExerciseConfig],availableFrom:'2026-07-12T00:00:00.000Z',availableUntil:'',status:'completed',createdAt:'2026-07-11T16:00:00.000Z',activeSeconds:238,completedAt:'2026-07-12T08:35:00.000Z',initialDiscomfort:2,finalDiscomfort:2,perceivedDifficulty:2,patientComment:'' },
  { id:'assignment-ana-3',patientId:'ana-p',patientName:'Ana Pereira',treatmentCycleId:'cycle-ana-2',sessionPlanId:'plan-demo-3',title:'Seguimiento suave',instructions:'Datos ficticios de demostración.',mode:'home',exercises:[demoSmoothConfig],availableFrom:'2026-07-10T00:00:00.000Z',availableUntil:'',status:'completed',createdAt:'2026-07-09T18:00:00.000Z',activeSeconds:226,completedAt:'2026-07-10T09:18:00.000Z',initialDiscomfort:4,finalDiscomfort:3,perceivedDifficulty:2,patientComment:'' },
  { id:'assignment-luis-2',patientId:'luis-s',patientName:'Luis Silva',treatmentCycleId:'cycle-luis-1',sessionPlanId:'plan-demo-6',title:'Optocinético',instructions:'Datos ficticios de demostración.',mode:'home',exercises:[demoOptokineticConfig],availableFrom:'2026-07-08T00:00:00.000Z',availableUntil:'',status:'omitted',createdAt:'2026-07-07T18:00:00.000Z',activeSeconds:0,completedAt:'2026-07-08T19:22:00.000Z',initialDiscomfort:null,finalDiscomfort:null,perceivedDifficulty:null,patientComment:'' },
  { id:'assignment-luis-1',patientId:'luis-s',patientName:'Luis Silva',treatmentCycleId:'cycle-luis-1',sessionPlanId:'plan-demo-2',title:'Optocinético',instructions:'Datos ficticios de demostración.',mode:'in_person',exercises:[demoOptokineticConfig],availableFrom:'2026-07-05T00:00:00.000Z',availableUntil:'',status:'completed',createdAt:'2026-07-04T18:00:00.000Z',activeSeconds:240,completedAt:'2026-07-05T15:40:00.000Z',initialDiscomfort:3,finalDiscomfort:3,perceivedDifficulty:3,patientComment:'' },
  { id:'assignment-ana-2',patientId:'ana-p',patientName:'Ana Pereira',treatmentCycleId:'cycle-ana-2',sessionPlanId:'plan-demo-7',title:'RVO x1',instructions:'Datos ficticios de demostración.',mode:'home',exercises:[defaultExerciseConfig],availableFrom:'2026-07-03T00:00:00.000Z',availableUntil:'',status:'completed',createdAt:'2026-07-02T18:00:00.000Z',activeSeconds:235,completedAt:'2026-07-03T09:11:00.000Z',initialDiscomfort:5,finalDiscomfort:4,perceivedDifficulty:3,patientComment:'' },
]

function read<T>(key:string, seed:T[]):T[]{const raw=localStorage.getItem(key);if(!raw)return seed;try{return JSON.parse(raw) as T[]}catch{return seed}}
function write<T>(key:string,values:T[]){localStorage.setItem(key,JSON.stringify(values))}
function readAssignments(){return read(ASSIGNMENTS_KEY,demoAssignments).map(assignment=>({...assignment,kind:assignment.kind??'exercise',exercises:(assignment.exercises??[]).map(exercise=>normalizeExerciseConfig(exercise,0))}))}

function cycleFromRow(row:Record<string,unknown>):TreatmentCycleRecord{return{id:String(row.id),patientId:String(row.patient_id),label:String(row.label),reason:String(row.reason??''),objectives:String(row.objectives??''),status:row.status as CycleStatus,startedOn:String(row.started_on),endedOn:String(row.ended_on??'')}}

function assignmentFromRow(row:Record<string,unknown>):SessionAssignmentRecord {
  const plan=(row.session_plans??{}) as Record<string,unknown>
  const patient=(row.patients??{}) as Record<string,unknown>
  const executions=(row.session_executions??[]) as Record<string,unknown>[]
  const execution=[...executions].sort((a,b)=>String(b.created_at??b.started_at??'').localeCompare(String(a.created_at??a.started_at??'')))[0]
  const definition=(plan.plan_definition??{}) as {kind?:'exercise'|'free_note';mode?:'home'|'in_person';exercises?:ExerciseConfig[]}
  return {id:String(row.id),patientId:String(row.patient_id),patientName:String(patient.full_name??''),treatmentCycleId:String(row.treatment_cycle_id??''),sessionPlanId:String(row.session_plan_id),title:String(plan.title??'Sesión'),instructions:String(plan.instructions??''),kind:definition.kind??'exercise',mode:definition.mode??'home',exercises:(definition.exercises??[]).map(exercise=>normalizeExerciseConfig(exercise,0)),availableFrom:String(row.available_from),availableUntil:String(row.available_until??''),status:row.status as AssignmentStatus,createdAt:String(row.created_at),activeSeconds:Number(execution?.active_seconds??0),completedAt:String(execution?.finished_at??''),initialDiscomfort:execution?.initial_discomfort==null?null:Number(execution.initial_discomfort),peakDiscomfort:execution?.peak_discomfort==null?null:Number(execution.peak_discomfort),finalDiscomfort:execution?.final_discomfort==null?null:Number(execution.final_discomfort),recoveryMinutes:execution?.recovery_minutes==null?null:Number(execution.recovery_minutes),delayedResponse:String(execution?.delayed_response??''),progressionDecision:String(execution?.progression_decision??''),perceivedDifficulty:execution?.perceived_difficulty==null?null:Number(execution.perceived_difficulty),patientComment:String(execution?.patient_comment??''),professionalObservation:String(execution?.professional_observation??''),supervised:Boolean(execution?.supervised),operatedBy:String(execution?.operated_by??''),eventLog:Array.isArray(execution?.event_log)?execution.event_log as SessionEventLogEntry[]:[],revokedAt:String(row.revoked_at??''),revokedBy:String(row.revoked_by??''),revokedReason:String(row.revoked_reason??''),registeredRetrospectively:Boolean(row.registered_retrospectively),actualPerformedAt:String(row.actual_performed_at??''),retrospectiveRecordedAt:String(row.retrospective_recorded_at??''),retrospectiveRecordedBy:String(row.retrospective_recorded_by??''),retrospectiveWithoutMetrics:Boolean(row.retrospective_without_metrics),retrospectiveDevice:(row.retrospective_device??undefined) as RetrospectiveSessionValues['device']|undefined,cancelledAt:String(row.cancelled_at??''),cancelledBy:String(row.cancelled_by??''),cancellationReason:String(row.cancellation_reason??''),repeatSeriesId:String(row.repeat_series_id??''),repeatSeriesPosition:row.repeat_series_position==null?undefined:Number(row.repeat_series_position),repeatSeriesSize:row.repeat_series_size==null?undefined:Number(row.repeat_series_size),repeatSourceAssignmentId:String(row.repeat_source_assignment_id??'')}
}

export async function listTreatmentCycles(patientId:string):Promise<TreatmentCycleRecord[]> {
  if(!isSupabaseConfigured||!supabase)return read(CYCLES_KEY,demoCycles).filter(c=>c.patientId===patientId)
  const {data,error}=await supabase.from('treatment_cycles').select('*').eq('patient_id',patientId).order('started_on',{ascending:false});if(error)throw error;return(data??[]).map(cycleFromRow)
}

export async function createTreatmentCycle(patientId:string,values:CycleFormValues):Promise<TreatmentCycleRecord>{
  if(!isSupabaseConfigured||!supabase){const cycle:TreatmentCycleRecord={id:crypto.randomUUID(),patientId,...values,reason:values.reason??'',objectives:values.objectives??'',status:'active',endedOn:''};const all=read(CYCLES_KEY,demoCycles).map(c=>c.patientId===patientId&&c.status==='active'?{...c,status:'paused' as const}:c);write(CYCLES_KEY,[...all,cycle]);return cycle}
  await supabase.from('treatment_cycles').update({status:'paused'}).eq('patient_id',patientId).eq('status','active')
  const {data,error}=await supabase.from('treatment_cycles').insert({patient_id:patientId,label:values.label,reason:values.reason||null,objectives:values.objectives||null,started_on:values.startedOn,status:'active'}).select().single();if(error)throw error;return cycleFromRow(data)
}

export async function listSessionAssignments(patientId:string):Promise<SessionAssignmentRecord[]>{
  if(!isSupabaseConfigured||!supabase)return readAssignments().filter(a=>a.patientId===patientId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
  const {data,error}=await supabase.from('session_assignments').select('*, session_plans(title, instructions, plan_definition), session_executions(status, started_at, finished_at, created_at, active_seconds, initial_discomfort, peak_discomfort, final_discomfort, recovery_minutes, delayed_response, progression_decision, perceived_difficulty, patient_comment, professional_observation, supervised, operated_by, event_log)').eq('patient_id',patientId).order('created_at',{ascending:false});if(error)throw error;return(data??[]).map(assignmentFromRow)
}

export async function createSessionAssignment(patientId:string,values:SessionFormValues):Promise<SessionAssignmentRecord>{
  if(!isSupabaseConfigured||!supabase){const patient=await getPatient(patientId);const record:SessionAssignmentRecord={id:crypto.randomUUID(),patientId,patientName:patient?.fullName??'Paciente',treatmentCycleId:values.treatmentCycleId,sessionPlanId:crypto.randomUUID(),title:values.title.trim(),instructions:values.instructions.trim(),kind:values.kind??'exercise',mode:values.mode,exercises:values.exercises,availableFrom:new Date(`${values.availableFrom}T00:00:00`).toISOString(),availableUntil:values.availableUntil?new Date(`${values.availableUntil}T23:59:59`).toISOString():'',status:'assigned',createdAt:new Date().toISOString(),activeSeconds:0,completedAt:'',initialDiscomfort:null,finalDiscomfort:null,perceivedDifficulty:null,patientComment:''};write(ASSIGNMENTS_KEY,[...readAssignments(),record]);if(values.registerAsCompleted&&values.retrospective){await recordRetrospectiveSession({assignment:record,details:values.retrospective});return readAssignments().find(item=>item.id===record.id)??record}return record}
  const {data:auth,error:authError}=await supabase.auth.getUser();if(authError||!auth.user)throw authError??new Error('Sesión profesional no disponible.')
  const {data:plan,error:planError}=await supabase.from('session_plans').insert({professional_id:auth.user.id,title:values.title.trim(),instructions:values.instructions.trim()||null,plan_definition:{kind:values.kind??'exercise',mode:values.mode,exercises:values.exercises}}).select().single();if(planError)throw planError
  const {data,error}=await supabase.from('session_assignments').insert({patient_id:patientId,treatment_cycle_id:values.treatmentCycleId,session_plan_id:plan.id,available_from:new Date(`${values.availableFrom}T00:00:00`).toISOString(),available_until:values.availableUntil?new Date(`${values.availableUntil}T23:59:59`).toISOString():null,max_completions:1,status:'assigned',assigned_by:auth.user.id}).select('*, session_plans(title, instructions, plan_definition)').single()
  if(error){await supabase.from('session_plans').delete().eq('id',plan.id);throw error}const record=assignmentFromRow(data);if(values.registerAsCompleted&&values.retrospective){await recordRetrospectiveSession({assignment:record,details:values.retrospective});return(await listSessionAssignments(patientId)).find(item=>item.id===record.id)??record}return record
}

export function canManageSessionAssignment(assignment: Pick<SessionAssignmentRecord, 'status'>) {
  return assignment.status === 'assigned'
}

export function canRevokeSessionAssignment(assignment: Pick<SessionAssignmentRecord, 'status'>) {
  return assignment.status !== 'revoked'
}

export function canCancelSessionAssignment(assignment: Pick<SessionAssignmentRecord, 'status'>) {
  return assignment.status === 'assigned' || assignment.status === 'started'
}

export function canRepeatSessionAssignment(assignment: Pick<SessionAssignmentRecord, 'kind' | 'status' | 'exercises'>) {
  return assignment.kind !== 'free_note' && assignment.status !== 'revoked' && assignment.exercises.length > 0
}

export async function cancelSessionAssignment(assignment: SessionAssignmentRecord, reason: string): Promise<void> {
  const cleanReason = reason.trim()
  if (cleanReason.length < 3 || cleanReason.length > 500) throw new Error('Ingresá un motivo de cancelación entre 3 y 500 caracteres.')
  if (!canCancelSessionAssignment(assignment)) throw new Error('La sesión ya no está pendiente.')
  const at = new Date().toISOString()
  if (!isSupabaseConfigured || !supabase) {
    const all = readAssignments()
    const current = all.find((item) => item.id === assignment.id && item.patientId === assignment.patientId)
    if (!current || !canCancelSessionAssignment(current)) throw new Error('La sesión ya no está pendiente.')
    write(ASSIGNMENTS_KEY, all.map((item) => item.id === assignment.id ? { ...item, status: 'omitted' as const, completedAt: at, cancelledAt: at, cancelledBy: 'demo-professional', cancellationReason: cleanReason, eventLog: [...(item.eventLog ?? []), { type: 'session_cancelled' as const, at }] } : item))
    return
  }
  const { error } = await supabase.rpc('cancel_session_assignment', { target_assignment_id: assignment.id, cancellation_reason_input: cleanReason })
  if (error) throw error
}

export async function updateSessionAssignment(assignment:SessionAssignmentRecord,values:SessionFormValues):Promise<SessionAssignmentRecord>{
  if(!canManageSessionAssignment(assignment))throw new Error('La sesión ya tiene actividad registrada y su historial no puede modificarse.')
  if(!isSupabaseConfigured||!supabase){
    const all=readAssignments()
    const current=all.find(item=>item.id===assignment.id&&item.patientId===assignment.patientId)
    if(!current)throw new Error('Sesión no encontrada.')
    if(!canManageSessionAssignment(current))throw new Error('La sesión ya tiene actividad registrada y su historial no puede modificarse.')
    const updated:SessionAssignmentRecord={...current,treatmentCycleId:values.treatmentCycleId,title:values.title.trim(),instructions:values.instructions.trim(),kind:values.kind??'exercise',mode:values.mode,exercises:values.exercises,availableFrom:new Date(`${values.availableFrom}T00:00:00`).toISOString(),availableUntil:values.availableUntil?new Date(`${values.availableUntil}T23:59:59`).toISOString():''}
    write(ASSIGNMENTS_KEY,all.map(item=>item.id===updated.id?updated:item))
    return updated
  }
  const {data:current,error:currentError}=await supabase.from('session_assignments').select('id, patient_id, session_plan_id, treatment_cycle_id, available_from, available_until, status').eq('id',assignment.id).eq('patient_id',assignment.patientId).single()
  if(currentError)throw currentError
  if(current.status!=='assigned')throw new Error('La sesión ya tiene actividad registrada y su historial no puede modificarse.')
  const {data:updatedAssignment,error:assignmentError}=await supabase.from('session_assignments').update({treatment_cycle_id:values.treatmentCycleId,available_from:new Date(`${values.availableFrom}T00:00:00`).toISOString(),available_until:values.availableUntil?new Date(`${values.availableUntil}T23:59:59`).toISOString():null}).eq('id',assignment.id).eq('status','assigned').select('id').maybeSingle()
  if(assignmentError)throw assignmentError
  if(!updatedAssignment)throw new Error('La sesión comenzó mientras se estaba editando y no fue modificada.')
  const {data,error}=await supabase.from('session_plans').update({title:values.title.trim(),instructions:values.instructions.trim()||null,plan_definition:{kind:values.kind??'exercise',mode:values.mode,exercises:values.exercises}}).eq('id',current.session_plan_id).select().single()
  if(error){
    await supabase.from('session_assignments').update({treatment_cycle_id:current.treatment_cycle_id,available_from:current.available_from,available_until:current.available_until}).eq('id',assignment.id).eq('status','assigned')
    throw error
  }
  return {...assignment,treatmentCycleId:values.treatmentCycleId,title:String(data.title),instructions:String(data.instructions??''),kind:values.kind??'exercise',mode:values.mode,exercises:values.exercises,availableFrom:new Date(`${values.availableFrom}T00:00:00`).toISOString(),availableUntil:values.availableUntil?new Date(`${values.availableUntil}T23:59:59`).toISOString():''}
}

export async function revokeSessionAssignment(assignment:SessionAssignmentRecord,reason:string):Promise<void>{
  const cleanReason=reason.trim()
  if(cleanReason.length<8||cleanReason.length>500)throw new Error('Ingresá un motivo de anulación entre 8 y 500 caracteres.')
  if(!canRevokeSessionAssignment(assignment))throw new Error('La sesión ya fue anulada.')
  if(!isSupabaseConfigured||!supabase){
    const all=readAssignments()
    const current=all.find(item=>item.id===assignment.id&&item.patientId===assignment.patientId)
    if(!current)throw new Error('Sesión no encontrada.')
    if(!canRevokeSessionAssignment(current))throw new Error('La sesión ya fue anulada.')
    write(ASSIGNMENTS_KEY,all.map(item=>item.id===assignment.id?{...item,status:'revoked' as const,revokedAt:new Date().toISOString(),revokedBy:'demo-professional',revokedReason:cleanReason}:item))
    return
  }
  const {error}=await supabase.rpc('revoke_session_assignment',{target_assignment_id:assignment.id,revocation_reason:cleanReason})
  if(error)throw error
}

export async function getCurrentPatientAssignment():Promise<SessionAssignmentRecord|null>{
  if(!isSupabaseConfigured||!supabase)return readAssignments().find(a=>a.patientId==='ana-p'&&a.mode==='home'&&['assigned','started'].includes(a.status))??null
  const {data:auth}=await supabase.auth.getUser();if(!auth.user)return null
  const {data:patient,error:patientError}=await supabase.from('patients').select('id').eq('auth_user_id',auth.user.id).maybeSingle();if(patientError)throw patientError;if(!patient)return null
  const now=new Date().toISOString();const {data,error}=await supabase.from('session_assignments').select('*, session_plans(title, instructions, plan_definition)').eq('patient_id',patient.id).in('status',['assigned','started']).lte('available_from',now).order('created_at',{ascending:false}).limit(20);if(error)throw error;const current=(data??[]).map(assignmentFromRow).find(assignment=>assignment.mode==='home'&&(assignment.status==='started'||!assignment.availableUntil||assignment.availableUntil>=now));return current??null
}

export async function listProfessionalAssignments():Promise<SessionAssignmentRecord[]>{
  if(!isSupabaseConfigured||!supabase)return readAssignments().sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
  const {data,error}=await supabase.from('session_assignments').select('*, session_plans(title, instructions, plan_definition), patients(full_name), session_executions(status, started_at, finished_at, created_at, active_seconds, initial_discomfort, peak_discomfort, final_discomfort, recovery_minutes, delayed_response, progression_decision, perceived_difficulty, patient_comment, professional_observation, supervised, operated_by, event_log)').order('created_at',{ascending:false});if(error)throw error;return(data??[]).map(assignmentFromRow)
}

export async function startSessionAssignment(assignment:SessionAssignmentRecord){
  if(assignment.mode!=='home')throw new Error('Las sesiones presenciales se ejecutan desde la cuenta profesional.')
  if(!isSupabaseConfigured||!supabase){const all=readAssignments();write(ASSIGNMENTS_KEY,all.map(item=>item.id===assignment.id&&item.status==='assigned'?{...item,status:'started' as const}:item));return}
  if(!navigator.onLine)return
  const {error}=await supabase.rpc('start_session_assignment',{target_assignment_id:assignment.id});if(error)throw error
}

export async function completeSessionAssignment(input:SessionCompletionInput){
  const {assignment,activeSeconds,skippedExercises,initialDiscomfort,peakDiscomfort,finalDiscomfort,recoveryMinutes,perceivedDifficulty,patientComment,eventLog=[]}=input
  const effectivePeakDiscomfort=peakDiscomfort??Math.max(initialDiscomfort,finalDiscomfort)
  const finalStatus=skippedExercises>0?'partial' as const:'completed' as const
  if(!isSupabaseConfigured||!supabase){const finished={type:'finished' as const,skipped_exercises:skippedExercises,at:new Date().toISOString()};const all=readAssignments();write(ASSIGNMENTS_KEY,all.map(a=>a.id===assignment.id?{...a,status:finalStatus,activeSeconds:Math.round(activeSeconds),completedAt:finished.at,initialDiscomfort,peakDiscomfort:effectivePeakDiscomfort,finalDiscomfort,recoveryMinutes:recoveryMinutes??null,perceivedDifficulty,patientComment:patientComment.trim(),eventLog:[...eventLog,finished]}:a));return}
  const {error}=await supabase.rpc('complete_session_assignment_v2',{target_assignment_id:assignment.id,active_seconds_input:Math.max(0,Math.round(activeSeconds)),skipped_count_input:Math.max(0,skippedExercises),initial_discomfort_input:initialDiscomfort,final_discomfort_input:finalDiscomfort,perceived_difficulty_input:perceivedDifficulty,patient_comment_input:patientComment.trim()||null,event_log_input:[...eventLog,{type:'finished',skipped_exercises:skippedExercises,at:new Date().toISOString()}]});if(error)throw error
  const {data:execution,error:executionError}=await supabase.from('session_executions').select('id').eq('assignment_id',assignment.id).order('created_at',{ascending:false}).limit(1).maybeSingle();if(executionError)throw executionError;if(execution){const{error:updateError}=await supabase.from('session_executions').update({peak_discomfort:effectivePeakDiscomfort,recovery_minutes:recoveryMinutes??null}).eq('id',execution.id);if(updateError)throw updateError}
}

export async function interruptSessionAssignment(input:SessionInterruptionInput){
  const {assignment,activeSeconds,skippedExercises,initialDiscomfort,eventLog=[]}=input
  const interrupted={type:'interrupted' as const,skipped_exercises:Math.max(1,skippedExercises),at:new Date().toISOString()}
  const finalEventLog=eventLog.some((event)=>event.type==='interrupted')?eventLog:[...eventLog,interrupted]
  if(!isSupabaseConfigured||!supabase){
    const all=readAssignments()
    write(ASSIGNMENTS_KEY,all.map(item=>item.id===assignment.id?{...item,status:'partial' as const,activeSeconds:Math.max(0,Math.round(activeSeconds)),completedAt:interrupted.at,initialDiscomfort,eventLog:finalEventLog}:item))
    return
  }
  const {error}=await supabase.rpc('interrupt_session_assignment',{
    target_assignment_id:assignment.id,
    active_seconds_input:Math.max(0,Math.round(activeSeconds)),
    skipped_count_input:Math.max(1,skippedExercises),
    initial_discomfort_input:initialDiscomfort,
    event_log_input:finalEventLog,
  })
  if(error)throw error
}

export async function startSupervisedInPersonSession(assignment:SessionAssignmentRecord,initialDiscomfort:number){
  if(assignment.mode!=='in_person'||!['assigned','started'].includes(assignment.status))throw new Error('Asignación presencial no disponible.')
  if(!isSupabaseConfigured||!supabase){const all=readAssignments();write(ASSIGNMENTS_KEY,all.map(item=>item.id===assignment.id?{...item,status:'started' as const,activeSeconds:0,completedAt:'',initialDiscomfort,finalDiscomfort:null,perceivedDifficulty:null,patientComment:'',professionalObservation:'',supervised:true,operatedBy:'demo-professional'}:item));return assignment.id}
  const {data,error}=await supabase.rpc('start_supervised_in_person_session',{target_assignment_id:assignment.id,initial_discomfort_input:initialDiscomfort});if(error)throw error;return String(data)
}

export async function completeSupervisedInPersonSession(input:SupervisedSessionCompletionInput){
  const {assignment,activeSeconds,skippedExercises,peakDiscomfort,finalDiscomfort,recoveryMinutes,delayedResponse,progressionDecision,perceivedDifficulty,patientComment,professionalObservation,eventLog=[]}=input
  const effectivePeakDiscomfort=peakDiscomfort??finalDiscomfort
  const finalStatus=skippedExercises>0?'partial' as const:'completed' as const
  if(!isSupabaseConfigured||!supabase){const finished={type:'finished' as const,skipped_exercises:skippedExercises,at:new Date().toISOString()};const all=readAssignments();write(ASSIGNMENTS_KEY,all.map(item=>item.id===assignment.id?{...item,status:finalStatus,activeSeconds:Math.max(0,Math.round(activeSeconds)),completedAt:finished.at,peakDiscomfort:effectivePeakDiscomfort,finalDiscomfort,recoveryMinutes:recoveryMinutes??null,delayedResponse:delayedResponse?.trim()??'',progressionDecision:progressionDecision?.trim()??'',perceivedDifficulty,patientComment:patientComment.trim(),professionalObservation:professionalObservation.trim(),supervised:true,operatedBy:'demo-professional',eventLog:[...eventLog,finished]}:item));return assignment.id}
  const {data,error}=await supabase.rpc('complete_supervised_in_person_session_v2',{target_assignment_id:assignment.id,active_seconds_input:Math.max(0,Math.round(activeSeconds)),skipped_count_input:Math.max(0,skippedExercises),peak_discomfort_input:effectivePeakDiscomfort,final_discomfort_input:finalDiscomfort,recovery_minutes_input:recoveryMinutes??null,delayed_response_input:delayedResponse?.trim()||null,progression_decision_input:progressionDecision?.trim()||null,perceived_difficulty_input:perceivedDifficulty,patient_comment_input:patientComment.trim()||null,professional_observation_input:professionalObservation.trim()||null,event_log_input:[...eventLog,{type:'finished',skipped_exercises:skippedExercises,at:new Date().toISOString()}]});if(error)throw new Error(error.message||'No fue posible guardar el cierre supervisado.');return String(data)
}

export async function recordFreeInPersonSession(input:FreeInPersonSessionInput){
  const professionalNote=input.professionalNote.trim()
  if(professionalNote.length<3||professionalNote.length>4000)throw new Error('El registro profesional debe tener entre 3 y 4000 caracteres.')
  if(input.patientComment.trim().length>500)throw new Error('El comentario del paciente no puede superar 500 caracteres.')
  const finalStatus=input.outcome==='cancelled'?'omitted' as const:'completed' as const
  const at=new Date().toISOString()
  const event={type:input.outcome==='cancelled'?'free_session_cancelled' as const:'free_session_recorded' as const,at}
  if(!isSupabaseConfigured||!supabase){const all=readAssignments();write(ASSIGNMENTS_KEY,all.map(item=>item.id===input.assignment.id?{...item,status:finalStatus,completedAt:at,activeSeconds:0,patientComment:input.patientComment.trim(),professionalObservation:professionalNote,supervised:true,operatedBy:'demo-professional',eventLog:[...(item.eventLog??[]),event],...(input.outcome==='cancelled'?{cancelledAt:at,cancelledBy:'demo-professional',cancellationReason:professionalNote}:{})}:item));return input.assignment.id}
  const{data,error}=await supabase.rpc('record_free_in_person_session',{target_assignment_id:input.assignment.id,outcome_input:input.outcome,professional_note_input:professionalNote,patient_comment_input:input.patientComment.trim()||null});if(error)throw error;return String(data)
}

export async function recordRetrospectiveSession(input: RetrospectiveCompletionInput) {
  const { assignment, details } = input
  const performedIndexes = [...new Set(details.performedExerciseIndexes)].filter((index) => Number.isInteger(index) && index >= 0 && index < assignment.exercises.length).sort((a, b) => a - b)
  const omittedExercises = assignment.exercises.map((exercise, index) => ({ exerciseIndex: index, exerciseName: exercise.name, reason: details.omittedExerciseReasons[String(index)]?.trim() ?? '' })).filter((item) => !performedIndexes.includes(item.exerciseIndex))
  if (!details.performedAt || new Date(details.performedAt).getTime() > Date.now()) throw new Error('La fecha real de ejecución no puede quedar en el futuro.')
  if (details.professionalObservation.trim().length < 3) throw new Error('Agregá una observación profesional sobre lo realizado.')
  if (omittedExercises.some((item) => item.reason.length < 3)) throw new Error('Cada ejercicio omitido necesita un motivo.')
  const at = new Date(details.performedAt).toISOString()
  const recordedAt = new Date().toISOString()
  const event: SessionEventLogEntry = { type: 'retrospective_session_recorded', at, performed_exercise_indexes: performedIndexes, omitted_exercises: omittedExercises, skipped_exercises: omittedExercises.length }
  if (!isSupabaseConfigured || !supabase) {
    const all = readAssignments()
    const current = all.find((item) => item.id === assignment.id && item.patientId === assignment.patientId)
    if (!current || !['assigned', 'started'].includes(current.status)) throw new Error('La sesión ya no está disponible para finalizar retrospectivamente.')
    const withoutMetrics = details.withoutMetrics
    write(ASSIGNMENTS_KEY, all.map((item) => item.id === assignment.id ? {
      ...item,
      status: 'completed' as const,
      activeSeconds: withoutMetrics ? 0 : Math.round(details.durationMinutes * 60),
      completedAt: at,
      initialDiscomfort: withoutMetrics ? null : details.initialDiscomfort,
      peakDiscomfort: withoutMetrics ? null : details.peakDiscomfort,
      finalDiscomfort: withoutMetrics ? null : details.finalDiscomfort,
      recoveryMinutes: withoutMetrics ? null : details.recoveryMinutes,
      delayedResponse: withoutMetrics ? '' : details.delayedResponse.trim(),
      progressionDecision: withoutMetrics ? '' : details.progressionDecision.trim(),
      patientComment: details.patientComment.trim(),
      professionalObservation: details.professionalObservation.trim(),
      supervised: item.mode === 'in_person',
      operatedBy: 'demo-professional',
      eventLog: [...(item.eventLog ?? []), event],
      registeredRetrospectively: true,
      actualPerformedAt: at,
      retrospectiveRecordedAt: recordedAt,
      retrospectiveRecordedBy: 'demo-professional',
      retrospectiveWithoutMetrics: withoutMetrics,
      retrospectiveDevice: details.device,
    } : item))
    return assignment.id
  }
  const { data, error } = await supabase.rpc('record_retrospective_session', {
    target_assignment_id: assignment.id,
    actual_performed_at_input: at,
    performed_indexes_input: performedIndexes,
    omitted_exercises_input: omittedExercises,
    approximate_duration_minutes_input: details.withoutMetrics ? null : details.durationMinutes,
    device_input: details.device,
    without_metrics_input: details.withoutMetrics,
    initial_discomfort_input: details.withoutMetrics ? null : details.initialDiscomfort,
    peak_discomfort_input: details.withoutMetrics ? null : details.peakDiscomfort,
    final_discomfort_input: details.withoutMetrics ? null : details.finalDiscomfort,
    recovery_minutes_input: details.withoutMetrics ? null : details.recoveryMinutes,
    delayed_response_input: details.withoutMetrics ? null : details.delayedResponse.trim() || null,
    progression_decision_input: details.withoutMetrics ? null : details.progressionDecision.trim() || null,
    professional_observation_input: details.professionalObservation.trim(),
    patient_comment_input: details.patientComment.trim() || null,
  })
  if (error) throw error
  return String(data)
}

export async function duplicateInPersonAssignmentAsHome(assignment:SessionAssignmentRecord){
  if(assignment.mode!=='in_person')throw new Error('Solo se pueden duplicar asignaciones presenciales.')
  if(assignment.kind==='free_note')throw new Error('Una sesión libre presencial no se duplica como domiciliaria.')
  if(!isSupabaseConfigured||!supabase){const duplicated:SessionAssignmentRecord={...assignment,id:crypto.randomUUID(),sessionPlanId:crypto.randomUUID(),title:`${assignment.title} (domiciliaria)`,mode:'home',availableFrom:new Date().toISOString(),availableUntil:'',status:'assigned',createdAt:new Date().toISOString(),activeSeconds:0,completedAt:'',initialDiscomfort:null,finalDiscomfort:null,perceivedDifficulty:null,patientComment:'',professionalObservation:'',supervised:false,operatedBy:''};write(ASSIGNMENTS_KEY,[duplicated,...readAssignments()]);return duplicated.id}
  const {data,error}=await supabase.rpc('duplicate_in_person_assignment_as_home',{target_assignment_id:assignment.id});if(error)throw error;return String(data)
}

export async function repeatSessionAssignmentAsHome(input: RepeatSessionAssignmentInput) {
  const { assignment, dates, seriesId } = input
  if (!canRepeatSessionAssignment(assignment)) throw new Error('Esta sesión no se puede repetir como domiciliaria.')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(seriesId)) throw new Error('La solicitud de repetición no es válida.')
  const dateError = validateRepetitionDates(dates)
  if (dateError) throw new Error(dateError)

  if (!isSupabaseConfigured || !supabase) {
    const all = readAssignments()
    const existing = all.filter((item) => item.repeatSeriesId === seriesId)
    if (existing.length > 0) return existing.sort((first, second) => (first.repeatSeriesPosition ?? 0) - (second.repeatSeriesPosition ?? 0)).map((item) => item.id)

    const current = all.find((item) => item.id === assignment.id && item.patientId === assignment.patientId)
    if (!current || !canRepeatSessionAssignment(current)) throw new Error('La sesión original ya no está disponible para repetir.')
    const createdAt = new Date().toISOString()
    const repeated = dates.map((date, index): SessionAssignmentRecord => ({
      id: crypto.randomUUID(),
      patientId: current.patientId,
      patientName: current.patientName,
      treatmentCycleId: current.treatmentCycleId,
      sessionPlanId: crypto.randomUUID(),
      title: current.title,
      instructions: current.instructions,
      kind: 'exercise',
      mode: 'home',
      exercises: structuredClone(current.exercises),
      availableFrom: new Date(`${date}T00:00:00`).toISOString(),
      availableUntil: new Date(`${date}T23:59:59.999`).toISOString(),
      status: 'assigned',
      createdAt,
      activeSeconds: 0,
      completedAt: '',
      initialDiscomfort: null,
      peakDiscomfort: null,
      finalDiscomfort: null,
      recoveryMinutes: null,
      delayedResponse: '',
      progressionDecision: '',
      perceivedDifficulty: null,
      patientComment: '',
      professionalObservation: '',
      supervised: false,
      operatedBy: '',
      eventLog: [],
      repeatSeriesId: seriesId,
      repeatSeriesPosition: index + 1,
      repeatSeriesSize: dates.length,
      repeatSourceAssignmentId: current.id,
    }))
    write(ASSIGNMENTS_KEY, [...repeated, ...all])
    return repeated.map((item) => item.id)
  }

  const { data, error } = await supabase.rpc('repeat_session_assignment_as_home', {
    target_assignment_id: assignment.id,
    scheduled_dates_input: dates,
    repetition_series_id_input: seriesId,
  })
  if (error) throw error
  if (!Array.isArray(data) || data.length !== dates.length) throw new Error('La serie no devolvió todas las sesiones esperadas.')
  return data.map(String)
}

export function sessionDurationSeconds(session:SessionAssignmentRecord){if(session.kind==='free_note')return 0;const phases=session.exercises.flatMap(exercise=>Array.from({length:exercise.rounds},()=>exercise));const exerciseAndRest=phases.reduce((total,exercise,index)=>total+(exercise.doseMode==='time'?exercise.durationSeconds:0)+(index<phases.length-1?exercise.restSeconds:0),0);return exerciseAndRest+analyzeSessionSequence(session.exercises).visorChanges*VR_BOX_TRANSITION_SECONDS}
export function sessionDurationLabel(session:SessionAssignmentRecord){if(session.kind==='free_note')return'Registro libre';const timedSeconds=sessionDurationSeconds(session);const hasRepetitions=session.exercises.some(exercise=>exercise.doseMode==='repetitions');if(!hasRepetitions)return`${Math.ceil(timedSeconds/60)} min`;if(timedSeconds===0)return'Tiempo variable';return`~${Math.ceil(timedSeconds/60)} min + rep.`}
