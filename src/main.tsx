import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './features/auth/AuthProvider.tsx'
import { startDeferredServiceWorkerRegistration } from './pwa/registerDeferredServiceWorker.ts'

// La actualización se descarga en segundo plano y queda en espera. Se activa
// cuando todas las pestañas de ONUr se cierran, nunca mientras alguien escribe
// credenciales o completa una sesión clínica.
startDeferredServiceWorkerRegistration()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider><App /></AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
