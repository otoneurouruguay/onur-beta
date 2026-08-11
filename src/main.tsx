import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './features/auth/AuthProvider.tsx'
import { startDeferredServiceWorkerRegistration } from './pwa/registerDeferredServiceWorker.ts'

// La actualización se busca al cargar y se activa de inmediato para evitar que
// una pestaña quede vinculada a archivos antiguos. El cambio de controlador no
// recarga la pantalla; los constructores además conservan sus borradores.
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
