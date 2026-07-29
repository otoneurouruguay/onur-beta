interface StatusBadgeProps {
  status: string
}

import { statusLabel } from './statusLabels'

const tones: Record<string, string> = {
  active: 'border border-[#D6E6DA] bg-[#EEF5F0] text-[#496451]',
  enabled: 'border border-[#D6E6DA] bg-[#EEF5F0] text-[#496451]',
  completed: 'border border-[#D6E6DA] bg-[#EEF5F0] text-[#496451]',
  accepted: 'border border-[#D6E6DA] bg-[#EEF5F0] text-[#496451]',
  ok: 'border border-[#D6E6DA] bg-[#EEF5F0] text-[#496451]',
  pending: 'border border-[#E8CE99] bg-[#FFF7E8] text-[#8A5B00]',
  assigned: 'border border-[#E8CE99] bg-[#FFF7E8] text-[#8A5B00]',
  started: 'border border-[#DEDCD9] bg-[#F1EFEC] text-[#5E5E5E]',
  paused: 'border border-[#DEDCD9] bg-[#F1EFEC] text-[#5E5E5E]',
  revoked: 'border border-[#DEDCD9] bg-[#F1EFEC] text-[#696969]',
  review: 'border border-[#E8CE99] bg-[#FFF7E8] text-[#8A5B00]',
  partial: 'border border-[#DEDCD9] bg-[#F1EFEC] text-[#5E5E5E]',
  edited: 'border border-[#DEDCD9] bg-[#F1EFEC] text-[#5E5E5E]',
  inactive: 'border border-[#DEDCD9] bg-[#F1EFEC] text-[#696969]',
  disabled: 'border border-[#DEDCD9] bg-[#F1EFEC] text-[#696969]',
  interrupted: 'bg-[#fceced] text-[#a94952]',
  discarded: 'border border-[#DEDCD9] bg-[#F1EFEC] text-[#696969]',
  quarantine: 'bg-[#fceced] text-[#a94952]',
  blocked: 'bg-[#fceced] text-[#a94952]',
  not_applicable: 'border border-[#DEDCD9] bg-[#F1EFEC] text-[#696969]',
  draft: 'border border-[#DEDCD9] bg-[#F1EFEC] text-[#696969]',
  reviewed: 'border border-[#DEDCD9] bg-[#F1EFEC] text-[#5E5E5E]',
  finalized: 'border border-[#D6E6DA] bg-[#EEF5F0] text-[#496451]',
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${tones[status] ?? tones.inactive}`}>
      {statusLabel(status)}
    </span>
  )
}
