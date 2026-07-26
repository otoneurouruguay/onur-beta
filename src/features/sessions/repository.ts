import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { defaultExerciseConfig, normalizeExerciseConfig, type ExerciseConfig } from '../exercise/types'
import { getPatient } from '../patients/repository'
import type { CycleFormValues, SessionFormValues } from './schema'
import { analyzeSessionSequence, VR_BOX_TRANSITION_SECONDS } from './sequence'

export type CycleStatus = 'active' | 'paused' | 'completed'
export type AssignmentStatus = 'assigned' | 'started' | 'completed' | 'partial' | 'interrupted' | 'omitted' | 'revoked'

export interface SessionEventLogEntry {
  type: 'exercise_completed' | 'exercise_partial' | 'exercise_skipped' | 'vr_box_put_on' | 'vr_box_take_off' | 'finished'
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
  skipped_exercises?: number
}

export interface TreatmentCycleRecord {
  id: string; patientId: string; label: string; reason: string; objectives: string
  status: CycleStatus; startedOn: string; endedOn: string
}

export interface SessionAssignmentRecord {
  id: string; patientId: string; treatmentCycleId: string; sessionPlanId: string
  patientName: string
  title: string; instructions: string; mode: 'home' | 'in_person'; exercises: ExerciseConfig[]
  availableFrom: string; availableUntil: string; status: AssignmentStatus; createdAt: string
  activeSeconds: number; completedAt: string
  initialDiscomfort: number | null; finalDiscomfort: number | null
  perceivedDifficulty: number | null; patientComment: string
  professionalObservation?: string; supervised?: boolean; operatedBy?: string
  eventLog?: SessionEventLogEntry[]
}

export interface SessionCompletionInput {
  assignment: Pick<SessionAssignmentRecord, 'id' | 'patientId'>
  activeSeconds: number
  skippedExercises: number
  initialDiscomfort: number
  finalDiscomfort: number
  perceivedDifficulty: number
  patientComment: string
  eventLog?: SessionEventLogEntry[]
}

export interface SupervisedSessionCompletionInput {
  assignment: Pick<SessionAssignmentRecord, 'id' | 'patientId'>
  activeSeconds: number
  skippedExercises: number
  finalDiscomfort: number
  perceivedDifficulty: number
  patientComment: string
  professionalObservation: string
  eventLog?: SessionEventLogEntry[]
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
function readAssignments(){return read(ASSIGNMENTS_KEY,demoAssignments).map(assignment=>({...assignment,exercises:assignment.exercises.map(exercise=>normalizeExerciseConfig(exercise,0))}))}

function cycleFromRow(row:Record<string,unknown>):TreatmentCycleRecord{return{id:String(row.id),patientId:String(row.patient_id),label:String(row.label),reason:String(row.reason??''),objectives:String(row.objectives??''),status:row.status as CycleStatus,startedOn:String(row.started_on),endedOn:String(row.ended_on??'')}}

function assignmentFromRow(row:Record<string,unknown>):SessionAssignmentRecord {
  const plan=(row.session_plans??{}) as Record<string,unknown>
  const patient=(row.patients??{}) as Record<string,unknown>
  const executions=(row.session_executions??[]) as Record<string,unknown>[]
  const execution=[...executions].sort((a,b)=>String(b.created_at??b.started_at??'').localeCompare(String(a.created_at??a.started_at??'')))[0]
  const definition=(plan.plan_definition??{}) as {mode?:'home'|'in_person';exercises?:ExerciseConfig[]}
  return {id:String(row.id),patientId:String(row.patient_id),patientName:String(patient.full_name??''),treatmentCycleId:String(row.treatment_cycle_id??''),sessionPlanId:String(row.session_plan_id),title:String(plan.title??'Sesión'),instructions:String(plan.instructions??''),mode:definition.mode??'home',exercises:(definition.exercises??[]).map(exercise=>normalizeExerciseConfig(exercise,0)),availableFrom:String(row.available_from),availableUntil:String(row.available_until??''),status:row.status as AssignmentStatus,createdAt:String(row.created_at),activeSeconds:Number(execution?.active_seconds??0),completedAt:String(execution?.finished_at??''),initialDiscomfort:execution?.initial_discomfort==null?null:Number(execution.initial_discomfort),finalDiscomfort:execution?.final_discomfort==null?null:Number(execution.final_discomfort),perceivedDifficulty:execution?.perceived_difficulty==null?null:Number(execution.perceived_difficulty),patientComment:String(execution?.patient_comment??''),professionalObservation:String(execution?.professional_observation??''),supervised:Boolean(execution?.supervised),operatedBy:String(execution?.operated_by??''),eventLog:Array.isArray(execution?.event_log)?execution.event_log as SessionEventLogEntry[]:[]}
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
  const {data,error}=await supabase.from('session_assignments').select('*, session_plans(title, instructions, plan_definition), session_executions(status, started_at, finished_at, created_at, active_seconds, initial_discomfort, final_discomfort, perceived_difficulty, patient_comment, professional_observation, supervised, operated_by, event_log)').eq('patient_id',patientId).order('created_at',{ascending:false});if(error)throw error;return(data??[]).map(assignmentFromRow)
}

export async function createSessionAssignment(patientId:string,values:SessionFormValues):Promise<SessionAssignmentRecord>{
  if(!isSupabaseConfigured||!supabase){const patient=await getPatient(patientId);const record:SessionAssignmentRecord={id:crypto.randomUUID(),patientId,patientName:patient?.fullName??'Paciente',treatmentCycleId:values.treatmentCycleId,sessionPlanId:crypto.randomUUID(),title:values.title.trim(),instructions:values.instructions.trim(),mode:values.mode,exercises:values.exercises,availableFrom:new Date(`${values.availableFrom}T00:00:00`).toISOString(),availableUntil:values.availableUntil?new Date(`${values.availableUntil}T23:59:59`).toISOString():'',status:'assigned',createdAt:new Date().toISOString(),activeSeconds:0,completedAt:'',initialDiscomfort:null,finalDiscomfort:null,perceivedDifficulty:null,patientComment:''};write(ASSIGNMENTS_KEY,[...readAssignments(),record]);return record}
  const {data:auth,error:authError}=await supabase.auth.getUser();if(authError||!auth.user)throw authError??new Error('Sesión profesional no disponible.')
  const {data:plan,error:planError}=await supabase.from('session_plans').insert({professional_id:auth.user.id,title:values.title.trim(),instructions:values.instructions.trim()||null,plan_definition:{mode:values.mode,exercises:values.exercises}}).select().single();if(planError)throw planError
  const {data,error}=await supabase.from('session_assignments').insert({patient_id:patientId,treatment_cycle_id:values.treatmentCycleId,session_plan_id:plan.id,available_from:new Date(`${values.availableFrom}T00:00:00`).toISOString(),available_until:values.availableUntil?new Date(`${values.availableUntil}T23:59:59`).toISOString():null,max_completions:1,status:'assigned',assigned_by:auth.user.id}).select('*, session_plans(title, instructions, plan_definition)').single()
  if(error){await supabase.from('session_plans').delete().eq('id',plan.id);throw error}return assignmentFromRow(data)
}

export async function getCurrentPatientAssignment():Promise<SessionAssignmentRecord|null>{
  if(!isSupabaseConfigured||!supabase)return readAssignments().find(a=>a.patientId==='ana-p'&&a.mode==='home'&&['assigned','started'].includes(a.status))??null
  const {data:auth}=await supabase.auth.getUser();if(!auth.user)return null
  const {data:patient,error:patientError}=await supabase.from('patients').select('id').eq('auth_user_id',auth.user.id).maybeSingle();if(patientError)throw patientError;if(!patient)return null
  const now=new Date().toISOString();const {data,error}=await supabase.from('session_assignments').select('*, session_plans(title, instructions, plan_definition)').eq('patient_id',patient.id).in('status',['assigned','started']).lte('available_from',now).order('created_at',{ascending:false}).limit(20);if(error)throw error;const current=(data??[]).map(assignmentFromRow).find(assignment=>assignment.mode==='home'&&(assignment.status==='started'||!assignment.availableUntil||assignment.availableUntil>=now));return current??null
}

export async function listProfessionalAssignments():Promise<SessionAssignmentRecord[]>{
  if(!isSupabaseConfigured||!supabase)return readAssignments().sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
  const {data,error}=await supabase.from('session_assignments').select('*, session_plans(title, instructions, plan_definition), patients(full_name), session_executions(status, started_at, finished_at, created_at, active_seconds, initial_discomfort, final_discomfort, perceived_difficulty, patient_comment, professional_observation, supervised, operated_by, event_log)').order('created_at',{ascending:false});if(error)throw error;return(data??[]).map(assignmentFromRow)
}

export async function startSessionAssignment(assignment:SessionAssignmentRecord){
  if(assignment.mode!=='home')throw new Error('Las sesiones presenciales se ejecutan desde la cuenta profesional.')
  if(!isSupabaseConfigured||!supabase){const all=readAssignments();write(ASSIGNMENTS_KEY,all.map(item=>item.id===assignment.id&&item.status==='assigned'?{...item,status:'started' as const}:item));return}
  if(!navigator.onLine)return
  const {error}=await supabase.rpc('start_session_assignment',{target_assignment_id:assignment.id});if(error)throw error
}

export async function completeSessionAssignment(input:SessionCompletionInput){
  const {assignment,activeSeconds,skippedExercises,initialDiscomfort,finalDiscomfort,perceivedDifficulty,patientComment,eventLog=[]}=input
  const finalStatus=skippedExercises>0?'partial' as const:'completed' as const
  if(!isSupabaseConfigured||!supabase){const finished={type:'finished' as const,skipped_exercises:skippedExercises,at:new Date().toISOString()};const all=readAssignments();write(ASSIGNMENTS_KEY,all.map(a=>a.id===assignment.id?{...a,status:finalStatus,activeSeconds:Math.round(activeSeconds),completedAt:finished.at,initialDiscomfort,finalDiscomfort,perceivedDifficulty,patientComment:patientComment.trim(),eventLog:[...eventLog,finished]}:a));return}
  const {error}=await supabase.rpc('complete_session_assignment_v2',{target_assignment_id:assignment.id,active_seconds_input:Math.max(0,Math.round(activeSeconds)),skipped_count_input:Math.max(0,skippedExercises),initial_discomfort_input:initialDiscomfort,final_discomfort_input:finalDiscomfort,perceived_difficulty_input:perceivedDifficulty,patient_comment_input:patientComment.trim()||null,event_log_input:[...eventLog,{type:'finished',skipped_exercises:skippedExercises,at:new Date().toISOString()}]});if(error)throw error
}

export async function startSupervisedInPersonSession(assignment:SessionAssignmentRecord,initialDiscomfort:number){
  if(assignment.mode!=='in_person'||!['assigned','started'].includes(assignment.status))throw new Error('Asignación presencial no disponible.')
  if(!isSupabaseConfigured||!supabase){const all=readAssignments();write(ASSIGNMENTS_KEY,all.map(item=>item.id===assignment.id?{...item,status:'started' as const,activeSeconds:0,completedAt:'',initialDiscomfort,finalDiscomfort:null,perceivedDifficulty:null,patientComment:'',professionalObservation:'',supervised:true,operatedBy:'demo-professional'}:item));return assignment.id}
  const {data,error}=await supabase.rpc('start_supervised_in_person_session',{target_assignment_id:assignment.id,initial_discomfort_input:initialDiscomfort});if(error)throw error;return String(data)
}

export async function completeSupervisedInPersonSession(input:SupervisedSessionCompletionInput){
  const {assignment,activeSeconds,skippedExercises,finalDiscomfort,perceivedDifficulty,patientComment,professionalObservation,eventLog=[]}=input
  const finalStatus=skippedExercises>0?'partial' as const:'completed' as const
  if(!isSupabaseConfigured||!supabase){const finished={type:'finished' as const,skipped_exercises:skippedExercises,at:new Date().toISOString()};const all=readAssignments();write(ASSIGNMENTS_KEY,all.map(item=>item.id===assignment.id?{...item,status:finalStatus,activeSeconds:Math.max(0,Math.round(activeSeconds)),completedAt:finished.at,finalDiscomfort,perceivedDifficulty,patientComment:patientComment.trim(),professionalObservation:professionalObservation.trim(),supervised:true,operatedBy:'demo-professional',eventLog:[...eventLog,finished]}:item));return assignment.id}
  const {data,error}=await supabase.rpc('complete_supervised_in_person_session',{target_assignment_id:assignment.id,active_seconds_input:Math.max(0,Math.round(activeSeconds)),skipped_count_input:Math.max(0,skippedExercises),final_discomfort_input:finalDiscomfort,perceived_difficulty_input:perceivedDifficulty,patient_comment_input:patientComment.trim()||null,professional_observation_input:professionalObservation.trim()||null,event_log_input:[...eventLog,{type:'finished',skipped_exercises:skippedExercises,at:new Date().toISOString()}]});if(error)throw error;return String(data)
}

export async function duplicateInPersonAssignmentAsHome(assignment:SessionAssignmentRecord){
  if(assignment.mode!=='in_person')throw new Error('Solo se pueden duplicar asignaciones presenciales.')
  if(!isSupabaseConfigured||!supabase){const duplicated:SessionAssignmentRecord={...assignment,id:crypto.randomUUID(),sessionPlanId:crypto.randomUUID(),title:`${assignment.title} (domiciliaria)`,mode:'home',availableFrom:new Date().toISOString(),availableUntil:'',status:'assigned',createdAt:new Date().toISOString(),activeSeconds:0,completedAt:'',initialDiscomfort:null,finalDiscomfort:null,perceivedDifficulty:null,patientComment:'',professionalObservation:'',supervised:false,operatedBy:''};write(ASSIGNMENTS_KEY,[duplicated,...readAssignments()]);return duplicated.id}
  const {data,error}=await supabase.rpc('duplicate_in_person_assignment_as_home',{target_assignment_id:assignment.id});if(error)throw error;return String(data)
}

export function sessionDurationSeconds(session:SessionAssignmentRecord){const phases=session.exercises.flatMap(exercise=>Array.from({length:exercise.rounds},()=>exercise));const exerciseAndRest=phases.reduce((total,exercise,index)=>total+(exercise.doseMode==='time'?exercise.durationSeconds:0)+(index<phases.length-1?exercise.restSeconds:0),0);return exerciseAndRest+analyzeSessionSequence(session.exercises).visorChanges*VR_BOX_TRANSITION_SECONDS}
export function sessionDurationLabel(session:SessionAssignmentRecord){const timedSeconds=sessionDurationSeconds(session);const hasRepetitions=session.exercises.some(exercise=>exercise.doseMode==='repetitions');if(!hasRepetitions)return`${Math.ceil(timedSeconds/60)} min`;if(timedSeconds===0)return'Tiempo variable';return`~${Math.ceil(timedSeconds/60)} min + rep.`}
