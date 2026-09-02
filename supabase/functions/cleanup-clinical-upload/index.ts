import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/http.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405)
  const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!bearer) return jsonResponse({ error: 'No autorizado.' }, 401)
  try {
    const { patient_id, document_id, storage_path, action = 'failed_upload' } = await request.json()
    if (typeof patient_id !== 'string' || typeof storage_path !== 'string') return jsonResponse({ error: 'Solicitud inválida.' }, 400)
    if (!['failed_upload', 'delete_document'].includes(action)) return jsonResponse({ error: 'Solicitud inválida.' }, 400)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: actorData } = await admin.auth.getUser(bearer)
    const actorId = actorData.user?.id
    if (!actorId || !storage_path.startsWith(`${actorId}/${patient_id}/`)) return jsonResponse({ error: 'No autorizado.' }, 403)
    const [{ data: profile }, { data: patient }] = await Promise.all([
      admin.from('profiles').select('role').eq('id', actorId).maybeSingle(),
      admin.from('patients').select('professional_id').eq('id', patient_id).maybeSingle(),
    ])
    if (profile?.role !== 'professional' || patient?.professional_id !== actorId) return jsonResponse({ error: 'No autorizado.' }, 403)
    if (typeof document_id === 'string' && document_id) {
      const { data: document } = await admin.from('source_documents').select('id, storage_path').eq('id', document_id).eq('patient_id', patient_id).maybeSingle()
      if (!document || document.storage_path !== storage_path) return jsonResponse({ error: 'Documento no válido.' }, 400)
      await admin.from('clinical_studies').delete().eq('source_document_id', document_id)
      await admin.from('document_permissions').delete().eq('document_id', document_id)
      await admin.from('source_documents').delete().eq('id', document_id)
    }
    await admin.storage.from('clinical-documents').remove([storage_path])
    await admin.from('audit_events').insert({ actor_user_id: actorId, action: action === 'delete_document' ? 'document_deleted' : 'failed_upload_cleaned', entity_type: 'source_document', entity_id: document_id || null, metadata: { patient_id } })
    return jsonResponse({ success: true })
  } catch {
    return jsonResponse({ error: 'No fue posible completar la eliminación.' }, 400)
  }
})
