import { describe, expect, it } from 'vitest'
import { defaultExerciseConfig } from '../exercise/types'
import { dhiArgentina } from '../assessments/questions'
import type { AssessmentRecord } from '../assessments/repository'
import type { PatientRecord } from '../patients/repository'
import type { SessionAssignmentRecord } from '../sessions/repository'
import { buildProfessionalStatistics } from './analytics'

const patient: PatientRecord = { id:'p1',fullName:'Paciente Uno',initials:'PU',age:60,insurer:'Particular',status:'active',cycleLabel:'Ciclo 1',todaySession:null,lastActivity:'',portalAccess:'enabled',documentNumber:'',birthDate:'',affiliateNumber:'',phone:'',privateNotes:'',username:'' }
const session = (overrides:Partial<SessionAssignmentRecord>={}):SessionAssignmentRecord => ({ id:crypto.randomUUID(),patientId:'p1',patientName:'Paciente Uno',treatmentCycleId:'c1',sessionPlanId:'plan',title:'Sesión',instructions:'',mode:'home',exercises:[{...defaultExerciseConfig,durationSeconds:60,rounds:1,restSeconds:0}],availableFrom:'2026-07-10T00:00:00.000Z',availableUntil:'',status:'completed',createdAt:'2026-07-10T00:00:00.000Z',activeSeconds:60,completedAt:'2026-07-10T00:01:00.000Z',initialDiscomfort:2,finalDiscomfort:2,perceivedDifficulty:2,patientComment:'',...overrides })
const assessment = (phase:'initial'|'final',date:string,value:0|2|4):AssessmentRecord => {
  const responses = Object.fromEntries(dhiArgentina.questions.map((question) => [question.id, value]))
  const totalScore = value * 25
  return { id:crypto.randomUUID(),patientId:'p1',patientName:'Paciente Uno',treatmentCycleId:'c1',instrumentCode:'DHI_AR_25',instrumentVersion:1,phase,deliveryMode:'portal',status:'completed',dueDate:'',responses,totalScore,subscaleScores:{physical:value*7,emotional:value*9,functional:value*9},answeredCount:25,assignedAt:`${date}T10:00:00.000Z`,startedAt:`${date}T11:00:00.000Z`,completedAt:`${date}T12:00:00.000Z`,assessmentDate:date,createdAt:`${date}T10:00:00.000Z` }
}

describe('estadísticas profesionales descriptivas',()=>{
  it('calcula realización, minutos y progreso sin incluir revocadas ni futuras',()=>{const result=buildProfessionalStatistics([session(),session({status:'partial',activeSeconds:30}),session({status:'revoked'}),session({availableFrom:'2026-08-01T00:00:00.000Z'})],[],[patient],{period:'all',patientId:'',now:new Date('2026-07-16T12:00:00.000Z')});expect(result.totals.sessions).toBe(2);expect(result.totals.realized).toBe(2);expect(result.totals.realizationRate).toBe(100);expect(result.totals.activeMinutes).toBe(2);expect(result.totals.averageActiveProgress).toBe(75)})
  it('respeta el período y el paciente seleccionado',()=>{const result=buildProfessionalStatistics([session(),session({id:'old',availableFrom:'2026-01-01T00:00:00.000Z'}),session({id:'other',patientId:'p2'})],[],[patient],{period:'30',patientId:'p1',now:new Date('2026-07-16T12:00:00.000Z')});expect(result.totals.sessions).toBe(1);expect(result.patientRows[0].patientId).toBe('p1')})
  it('compara únicamente pares DHI completos',()=>{const initial=assessment('initial','2026-07-01',4);const final=assessment('final','2026-07-15',2);const result=buildProfessionalStatistics([], [initial,final], [patient], {period:'all',patientId:'',now:new Date('2026-07-16T12:00:00.000Z')});expect(result.assessmentComparisons).toHaveLength(1);expect(result.assessmentComparisons[0].difference).toBe(-50);expect(result.patientRows[0].questionnaireDifference).toBe(-50)})
})
