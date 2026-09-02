import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, type AppRole } from './AuthProvider'

export function RequireRole({role,children}:{role:AppRole;children:ReactNode}){
  const auth=useAuth();const location=useLocation()
  if(!auth.ready)return <div className="grid min-h-screen place-items-center text-sm font-bold text-[#747474]">Verificando acceso…</div>
  if(auth.role!==role)return <Navigate to="/ingresar" replace state={{from:location.pathname}}/>
  if(role==='patient'&&auth.mustChangePatientPin&&location.pathname!=='/paciente/crear-pin')return <Navigate to="/paciente/crear-pin" replace/>
  if(role==='patient'&&!auth.mustChangePatientPin&&location.pathname==='/paciente/crear-pin')return <Navigate to="/paciente/hoy" replace/>
  return children
}
