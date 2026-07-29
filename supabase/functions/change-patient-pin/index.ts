import { createClient } from 'npm:@supabase/supabase-js@2'
import { derivePatientAuthSecret } from '../_shared/auth-secret.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/http.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido.' }, 405)
  }

  const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!bearer) {
    return jsonResponse({ error: 'No autorizado.' }, 401)
  }

  try {
    const { pin } = await request.json()
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return jsonResponse({ error: 'El PIN debe tener exactamente 4 dígitos.' }, 400)
    }

    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const pepper = Deno.env.get('PATIENT_AUTH_PEPPER')!
    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: userData } = await admin.auth.getUser(bearer)
    const authUserId = userData.user?.id
    if (!authUserId) {
      return jsonResponse({ error: 'No autorizado.' }, 401)
    }

    const { data: account } = await admin
      .from('patient_portal_accounts')
      .select('patient_id, auth_user_id, auth_login_email, enabled')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (!account?.enabled) {
      return jsonResponse({ error: 'Cuenta no disponible.' }, 403)
    }

    const derivedSecret = await derivePatientAuthSecret(account.patient_id, pin, pepper)
    const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
      password: derivedSecret,
    })
    if (updateError) {
      return jsonResponse({ error: 'No se pudo actualizar el PIN.' }, 400)
    }

    await admin
      .from('patient_portal_accounts')
      .update({ must_change_pin: false, failed_attempts: 0, locked_until: null })
      .eq('auth_user_id', authUserId)

    await admin.from('audit_events').insert({
      actor_user_id: authUserId,
      action: 'patient_pin_changed',
      entity_type: 'patient',
      entity_id: account.patient_id,
    })

    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: renewed, error: renewError } = await authClient.auth.signInWithPassword({
      email: account.auth_login_email,
      password: derivedSecret,
    })
    if (renewError || !renewed.session) {
      return jsonResponse({ error: 'El PIN se actualizó, pero es necesario volver a iniciar sesión.' }, 409)
    }

    return jsonResponse({
      success: true,
      session: {
        access_token: renewed.session.access_token,
        refresh_token: renewed.session.refresh_token,
      },
    })
  } catch {
    return jsonResponse({ error: 'No se pudo actualizar el PIN.' }, 400)
  }
})
