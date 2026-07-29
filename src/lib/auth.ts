import { z } from 'zod'
import { supabase } from './supabase'

const patientLoginResponseSchema = z.object({
  session: z.object({
    access_token: z.string(),
    refresh_token: z.string(),
  }),
  must_change_pin: z.boolean(),
})

const patientAccessStateSchema = z.object({
  enabled: z.boolean(),
  must_change_pin: z.boolean(),
})

const patientPinChangeResponseSchema = z.object({
  success: z.literal(true),
  session: z.object({
    access_token: z.string(),
    refresh_token: z.string(),
  }),
})

export function validateProfessionalCredentials(email: string, password: string): string | null {
  const normalizedEmail = email.trim()
  if (!normalizedEmail || !password) return 'Ingresá el correo profesional y la contraseña.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return 'Ingresá un correo profesional válido.'
  return null
}

export function validatePatientCredentials(username: string, secret: string): string | null {
  const normalizedUsername = username.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!normalizedUsername || !secret) return 'Ingresá el usuario y el PIN o la cédula temporal.'
  if (!/^[a-z0-9]{4,40}$/.test(normalizedUsername)) return 'El usuario no es válido.'
  if (!/^(?:\d{4}|\d{6,12})$/.test(secret)) return 'Ingresá un PIN de 4 dígitos o la cédula temporal.'
  return null
}

export async function signInProfessional(email: string, password: string): Promise<void> {
  const validationError = validateProfessionalCredentials(email, password)
  if (validationError) throw new Error(validationError)
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) throw new Error('No fue posible iniciar sesión con esos datos.')
}

export async function signInPatient(username: string, secret: string): Promise<{ mustChangePin: boolean }> {
  const validationError = validatePatientCredentials(username, secret)
  if (validationError) throw new Error(validationError)
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.functions.invoke('patient-login', {
    body: { username, secret },
  })
  if (error) throw new Error('No fue posible iniciar sesión con esos datos.')

  const parsed = patientLoginResponseSchema.safeParse(data)
  if (!parsed.success) throw new Error('La respuesta del servicio de acceso no es válida.')

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: parsed.data.session.access_token,
    refresh_token: parsed.data.session.refresh_token,
  })
  if (sessionError) throw new Error('No fue posible establecer la sesión.')
  return { mustChangePin: parsed.data.must_change_pin }
}

export async function changePatientPin(pin: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.functions.invoke('change-patient-pin', { body: { pin } })
  if (error) throw new Error('No se pudo actualizar el PIN.')
  const parsed = patientPinChangeResponseSchema.safeParse(data)
  if (!parsed.success) throw new Error('El PIN se actualizó, pero la nueva sesión no es válida.')
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: parsed.data.session.access_token,
    refresh_token: parsed.data.session.refresh_token,
  })
  if (sessionError) throw new Error('El PIN se actualizó, pero no se pudo renovar la sesión.')
}

export async function getPatientAccessState(): Promise<{ enabled: boolean; mustChangePin: boolean }> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.functions.invoke('patient-access-state')
  if (error) throw new Error('No fue posible verificar el acceso del paciente.')
  const parsed = patientAccessStateSchema.safeParse(data)
  if (!parsed.success) throw new Error('La respuesta del servicio de acceso no es válida.')
  return { enabled: parsed.data.enabled, mustChangePin: parsed.data.must_change_pin }
}

export async function requestProfessionalPasswordReset(email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}restablecer-clave`
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo })
  if (error) throw new Error('No fue posible procesar la solicitud. Intentá nuevamente.')
}

export async function updateProfessionalPassword(password: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('El enlace no es válido o venció. Solicitá uno nuevo.')
  const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle()
  if (profileError || profile?.role !== 'professional') throw new Error('Este cambio de contraseña no está disponible para la cuenta.')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error('No fue posible actualizar la contraseña.')
}
