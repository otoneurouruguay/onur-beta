const labels: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  enabled: 'Habilitado',
  disabled: 'Deshabilitado',
  pending: 'Pendiente',
  assigned: 'Asignada',
  started: 'Iniciada',
  paused: 'Pausado',
  revoked: 'Anulada',
  completed: 'Completada',
  partial: 'Parcial',
  interrupted: 'Interrumpida',
  omitted: 'Cancelada',
  accepted: 'Aceptada',
  edited: 'Editada',
  discarded: 'Descartada',
  ok: 'Correcto',
  review: 'Revisar',
  quarantine: 'Cuarentena',
  blocked: 'Bloqueado',
  not_applicable: 'No aplica',
  draft: 'Borrador',
  reviewed: 'Revisado',
  finalized: 'Finalizado',
}

export function statusLabel(status: string) {
  return labels[status] ?? status
}
