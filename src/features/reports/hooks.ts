import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTreatmentReport, listProfessionalReports } from './repository'
export const reportKeys={patient:(id:string)=>['reports',id] as const,all:['reports'] as const}
export function useProfessionalReports(){return useQuery({queryKey:reportKeys.all,queryFn:listProfessionalReports})}
export function useCreateReport(patientId:string){const client=useQueryClient();return useMutation({mutationFn:createTreatmentReport,onSuccess:()=>{client.invalidateQueries({queryKey:reportKeys.patient(patientId)});client.invalidateQueries({queryKey:reportKeys.all})}})}
