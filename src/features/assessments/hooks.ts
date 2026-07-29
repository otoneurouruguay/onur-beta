import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAssessment, listCurrentPatientAssessments, listPatientAssessments, listProfessionalAssessments } from './repository'
export const assessmentKeys={patient:(id:string)=>['assessments',id] as const,all:['assessments'] as const,current:['patient-assessments-current'] as const}
export function usePatientAssessments(patientId:string){return useQuery({queryKey:assessmentKeys.patient(patientId),queryFn:()=>listPatientAssessments(patientId),enabled:Boolean(patientId)})}
export function useProfessionalAssessments(){return useQuery({queryKey:assessmentKeys.all,queryFn:listProfessionalAssessments})}
export function useCurrentPatientAssessments(){return useQuery({queryKey:assessmentKeys.current,queryFn:listCurrentPatientAssessments})}
export function useCreateAssessment(patientId:string){const client=useQueryClient();return useMutation({mutationFn:createAssessment,onSuccess:()=>{client.invalidateQueries({queryKey:assessmentKeys.patient(patientId)});client.invalidateQueries({queryKey:assessmentKeys.all})}})}
