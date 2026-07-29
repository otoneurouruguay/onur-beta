export const corsHeaders = {
  // Las funciones no usan cookies: cada operación sensible valida su Bearer/JWT.
  // El comodín permite validar la misma versión desde producción y desde el entorno local de QA.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
