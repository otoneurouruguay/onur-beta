import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTreatmentReport, listPatientReports, listProfessionalReports } from './repository'
export const reportKeys={patient:(id:string)=>['reports',id] as const,all:['reports'] as const}
export function useProfessionalReports(){return useQuery({queryKey:reportKeys.all,queryFn:listProfessionalReports})}
export function usePatientReports(patientId:string){return useQuery({queryKey:reportKeys.patient(patientId),queryFn:()=>listPatientReports(patientId),enabled:Boolean(patientId)})}
export function useCreateReport(patientId:string){const client=useQueryClient();return useMutation({mutationFn:createTreatmentReport,onSuccess:()=>{client.invalidateQueries({queryKey:reportKeys.patient(patientId)});client.invalidateQueries({queryKey:reportKeys.all})}})}
