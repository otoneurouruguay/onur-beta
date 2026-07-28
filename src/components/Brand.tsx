interface BrandProps {
  compact?: boolean
  light?: boolean
}

export function Brand({ compact = false, light = false }: BrandProps) {
  const assetPath = `${import.meta.env.BASE_URL}${compact ? 'otoneuro-mark.png' : 'otoneuro-horizontal.png'}`
  return (
    <div className="flex items-center" aria-label="Otoneuro Uruguay">
      <span className={`shrink-0 overflow-hidden rounded-xl border border-[#E9E7E7] bg-white ${light ? 'p-1.5' : ''}`}>
        <img
          src={assetPath}
          alt="Otoneuro Uruguay"
          className={compact ? 'size-10 object-cover' : 'h-12 w-[165px] object-contain'}
        />
      </span>
    </div>
  )
}
