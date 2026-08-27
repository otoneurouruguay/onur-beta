const labels: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  enabled: 'Habilitado',
  disabled: 'Deshabilitado',
  pending: 'Pendiente',
  assigned: 'Planificada',
  started: 'En curso',
  paused: 'Pausado',
  revoked: 'Anulada por error',
  completed: 'Finalizada',
  partial: 'Parcial',
  interrupted: 'Interrumpida',
  omitted: 'No realizada / cancelada',
  accepted: 'Aceptada',
  edited: 'Editada',
  discarded: 'Descartada',
  cancelled: 'Cancelado',
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
