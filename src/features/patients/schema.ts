import { z } from 'zod'

export const patientFormSchema = z.object({
  fullName: z.string().trim().min(3, 'Ingresá nombre y apellido.'),
  documentNumber: z.string().trim().optional(),
  birthDate: z.string().optional(),
  insurer: z.string().trim().max(120).optional(),
  affiliateNumber: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  status: z.enum(['active', 'inactive']),
  privateNotes: z.string().trim().max(5000).optional(),
  createPortalAccount: z.boolean(),
  username: z.string().trim().max(80).optional(),
  temporaryCi: z.string().trim().optional(),
}).superRefine((value, context) => {
  if (value.birthDate && value.birthDate > new Date().toISOString().slice(0, 10)) {
    context.addIssue({ code: 'custom', path: ['birthDate'], message: 'La fecha no puede ser futura.' })
  }
  if (value.documentNumber && !/^\d{6,12}$/.test(value.documentNumber)) {
    context.addIssue({ code: 'custom', path: ['documentNumber'], message: 'Ingresá la cédula, solo números.' })
  }
  if (value.createPortalAccount && !/^[A-Za-zÀ-ÿ0-9._-]{4,80}$/.test(value.username ?? '')) {
    context.addIssue({ code: 'custom', path: ['username'], message: 'Usá entre 4 y 80 caracteres, sin espacios.' })
  }
  if (value.createPortalAccount && !/^\d{6,12}$/.test(value.temporaryCi ?? '')) {
    context.addIssue({ code: 'custom', path: ['temporaryCi'], message: 'Ingresá la cédula, solo números.' })
  }
})

export type PatientFormValues = z.infer<typeof patientFormSchema>

export function suggestUsername(fullName: string) {
  return fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '')
}
