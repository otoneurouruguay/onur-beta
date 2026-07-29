/* oxlint-disable react/only-export-components -- el hook y el proveedor comparten el mismo contexto */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { getPatientAccessState } from '../../lib/auth'

export type AppRole = 'professional' | 'patient'

interface AuthState {
  ready: boolean
  role: AppRole | null
  user: User | null
  displayName: string
  mustChangePatientPin: boolean
  refreshPatientAccess: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [role, setRole] = useState<AppRole | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [mustChangePatientPin, setMustChangePatientPin] = useState(false)

  const refreshPatientAccess = useCallback(async () => {
    const state = await getPatientAccessState()
    if (!state.enabled) throw new Error('La cuenta domiciliaria está deshabilitada.')
    setMustChangePatientPin(state.mustChangePin)
  }, [])

  useEffect(() => {
    let active = true
    localStorage.removeItem('onur-demo-role')
    const client = supabase

    const denyAccess = () => {
      if (!active) return
      setUser(null)
      setRole(null)
      setDisplayName('')
      setMustChangePatientPin(false)
      setReady(true)
    }

    if (!client) {
      denyAccess()
      return
    }

    const apply = async (next: User | null) => {
      if (!next) {
        denyAccess()
        return
      }

      if (!active) return
      setReady(false)
      setUser(next)
      const { data, error } = await client.from('profiles').select('role, display_name').eq('id', next.id).maybeSingle()
      if (!active) return
      if (error || (data?.role !== 'professional' && data?.role !== 'patient')) {
        denyAccess()
        return
      }

      setRole(data.role)
      setDisplayName(String(data.display_name ?? (data.role === 'professional' ? 'Profesional' : 'Paciente')))
      if (data.role === 'patient') {
        try {
          await refreshPatientAccess()
        } catch {
          await client.auth.signOut()
          denyAccess()
          return
        }
      } else {
        setMustChangePatientPin(false)
      }
      setReady(true)
    }

    void client.auth.getSession().then(({ data }) => apply(data.session?.user ?? null))
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      void apply(session?.user ?? null)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [refreshPatientAccess])

  const value = useMemo<AuthState>(() => ({
    ready,
    role,
    user,
    displayName,
    mustChangePatientPin,
    refreshPatientAccess,
    signOut: async () => {
      localStorage.removeItem('onur-demo-role')
      if (supabase) await supabase.auth.signOut()
      setRole(null)
      setUser(null)
      setDisplayName('')
      setMustChangePatientPin(false)
    },
  }), [displayName, mustChangePatientPin, ready, refreshPatientAccess, role, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider no disponible.')
  return value
}
