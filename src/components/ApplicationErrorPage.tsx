import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Brand } from './Brand'

export function ApplicationErrorPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F7F6F4] px-5 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-[#E2DED9] bg-white p-7 shadow-[0_18px_50px_rgba(23,23,23,0.055)] sm:p-10" role="alert">
        <Brand />
        <div className="mt-10 grid size-11 place-items-center rounded-xl bg-[#FFF4DD] text-[#A36B00]">
          <TriangleAlert size={21} />
        </div>
        <h1 className="mt-5 text-[28px] tracking-[-0.04em] text-[#171717]">No pudimos abrir esta pantalla</h1>
        <p className="mt-3 text-sm leading-6 text-[#747474]">
          La aplicación puede haberse actualizado o la conexión puede haberse interrumpido. Actualizá para continuar con tu sesión.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#E49A02] px-5 text-sm font-semibold text-[#171717] transition hover:bg-[#D99000]"
        >
          <RefreshCw size={16} />
          Actualizar y volver a intentar
        </button>
      </section>
    </main>
  )
}
