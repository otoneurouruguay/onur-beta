import {
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  ClipboardList,
  FileText,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorPlay,
  ShieldCheck,
  Upload,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Brand } from './Brand'
import { useAuth } from '../features/auth/AuthProvider'
import { GlobalSearch } from './GlobalSearch'

interface NavigationItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}

const navigation: NavigationItem[] = [
  { label: 'Inicio', to: '/app', icon: LayoutDashboard, end: true },
  { label: 'Pacientes', to: '/app/pacientes', icon: Users },
  { label: 'Sesiones', to: '/app/sesiones', icon: MonitorPlay },
  { label: 'Ejercicios', to: '/app/ejercicios', icon: BrainCircuit },
  { label: 'Escenarios 360°', to: '/app/escenarios-360', icon: Globe2 },
  { label: 'Estudios', to: '/app/estudios', icon: Upload },
  { label: 'Evaluaciones', to: '/app/evaluaciones', icon: ClipboardList },
  { label: 'Informes', to: '/app/informes', icon: FileText },
  { label: 'Sugerencias', to: '/app/sugerencias', icon: BookOpenCheck },
  { label: 'Estadísticas', to: '/app/estadisticas', icon: BarChart3 },
]

export function ProfessionalShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth()
  const initials = auth.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'ON'
  const currentSection = [...navigation].reverse().find((item) => location.pathname.startsWith(item.to))?.label ?? 'Inicio'

  const logout = async () => {
    await auth.signOut()
    navigate('/ingresar')
  }

  useEffect(() => {
    if (!accountOpen) return
    const closeAccountMenu = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape') setAccountOpen(false)
      if (event instanceof PointerEvent && !accountRef.current?.contains(event.target as Node)) setAccountOpen(false)
    }
    window.addEventListener('pointerdown', closeAccountMenu)
    window.addEventListener('keydown', closeAccountMenu)
    return () => {
      window.removeEventListener('pointerdown', closeAccountMenu)
      window.removeEventListener('keydown', closeAccountMenu)
    }
  }, [accountOpen])

  return (
    <div className="min-h-screen bg-[#F7F6F4] text-[#171717]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[#E9E7E7] bg-white px-4 py-5 transition-transform lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-12 items-center justify-between px-1">
          <Brand />
          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg text-[#747474] hover:bg-[#F7F6F4] hover:text-[#171717] lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={19} />
          </button>
        </div>

        <p className="mb-2 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#A1A1A1]">Consultorio</p>
        <nav className="space-y-1" aria-label="Navegación principal">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#FFF7E8] text-[#171717]'
                    : 'text-[#747474] hover:bg-[#F7F6F4] hover:text-[#171717]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 h-5 w-[3px] rounded-r-full bg-[#E49A02]" aria-hidden="true" />}
                  <item.icon aria-hidden="true" size={17} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'text-[#A36B00]' : ''} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">
          <div className="mb-3 flex items-start gap-2.5 rounded-xl bg-[#F7F6F4] p-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-[#A36B00]" size={16} />
            <div>
              <p className="text-[11px] font-bold text-[#2F2F2F]">Entorno clínico seguro</p>
              <p className="mt-1 text-[10px] leading-4 text-[#747474]">Acceso protegido y actividad trazable.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-[#E9E7E7] pt-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#171717] text-[11px] font-bold text-white">{initials}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[#171717]">{auth.displayName || 'Profesional'}</p>
              <p className="mt-0.5 text-[10px] text-[#747474]">Profesional</p>
            </div>
            <button type="button" onClick={logout} className="grid size-8 place-items-center rounded-lg text-[#747474] hover:bg-[#F7F6F4] hover:text-[#171717]" aria-label="Cerrar sesión">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[#171717]/35 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Cerrar menú"
        />
      )}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#E9E7E7] bg-white px-4 sm:px-7 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="grid size-10 place-items-center rounded-lg border border-[#E9E7E7] text-[#171717] lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu size={19} />
            </button>
            <div className="lg:hidden">
              <Brand compact />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A36B00]">ONUr Beta</p>
              <p className="mt-0.5 text-sm font-semibold text-[#171717]">{currentSection}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <div ref={accountRef} className="relative hidden sm:block">
              <button type="button" onClick={() => setAccountOpen((value) => !value)} aria-expanded={accountOpen} aria-haspopup="menu" className="flex h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-[#2F2F2F] hover:bg-[#F7F6F4]">
                <span className="grid size-6 place-items-center rounded-full bg-[#171717] text-[9px] font-bold text-white">{initials}</span>
                {auth.displayName?.split(' ')[0] || 'Profesional'}
              </button>
              {accountOpen && <div role="menu" className="absolute right-0 top-12 w-64 overflow-hidden rounded-xl border border-[#E9E7E7] bg-white p-2 shadow-[0_18px_50px_rgba(23,23,23,0.16)]">
                <div className="border-b border-[#E9E7E7] px-3 py-2.5"><p className="truncate text-xs font-black text-[#2F2F2F]">{auth.displayName || 'Profesional'}</p><p className="mt-1 text-[10px] text-[#747474]">Cuenta profesional</p></div>
                <button role="menuitem" type="button" onClick={() => void logout()} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold text-[#a94952] hover:bg-[#fceced]"><LogOut size={15} /> Cerrar sesión</button>
              </div>}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1540px] px-4 py-7 sm:px-7 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
