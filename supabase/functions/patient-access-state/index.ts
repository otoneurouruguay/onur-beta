import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/http.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405)

  const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!bearer) return jsonResponse({ error: 'No autorizado.' }, 401)

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data: userData } = await admin.auth.getUser(bearer)
    const authUserId = userData.user?.id
    if (!authUserId) return jsonResponse({ error: 'No autorizado.' }, 401)

    const { data: account } = await admin
      .from('patient_portal_accounts')
      .select('enabled, must_change_pin')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (!account) return jsonResponse({ error: 'Cuenta no disponible.' }, 403)
    return jsonResponse({
      enabled: Boolean(account.enabled),
      must_change_pin: Boolean(account.must_change_pin),
    })
  } catch {
    return jsonResponse({ error: 'No fue posible verificar el acceso.' }, 400)
  }
})
