import { useId } from 'react'

export function ScaleQuestion({ label, hint, min, max, value, onChange }: { label: string; hint: string; min: number; max: number; value: number | null; onChange: (value: number) => void }) {
  const labelId = useId()

  return <fieldset aria-labelledby={labelId} className="min-w-0 rounded-2xl border border-[#E9E7E7] bg-white p-5">
    <p id={labelId} className="text-base font-black leading-6 text-[#171717]">{label}</p>
    <p className="mt-1 text-xs leading-5 text-[#747474]">{hint}</p>
    <div className={`mt-4 grid gap-2 ${max === 10 ? 'grid-cols-6 sm:grid-cols-11' : 'grid-cols-5'}`}>
      {Array.from({ length: max - min + 1 }, (_, index) => index + min).map((option) => <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)} className={`min-h-12 rounded-xl border text-base font-black transition ${value === option ? 'border-[#E49A02] bg-[#E49A02] text-white' : 'border-[#E9E7E7] bg-[#F7F6F4] text-[#2F2F2F] hover:border-[#E8CE99]'}`}>{option}</button>)}
    </div>
  </fieldset>
}
