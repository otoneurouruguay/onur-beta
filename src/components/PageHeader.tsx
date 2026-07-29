import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#A36B00]">{eyebrow}</p>
        )}
        <h1 className="text-[30px] tracking-[-0.035em] text-[#171717] sm:text-[34px]">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#747474]">{description}</p>
      </div>
      {actions && <div className="flex min-w-0 flex-wrap gap-2 lg:shrink-0">{actions}</div>}
    </header>
  )
}
