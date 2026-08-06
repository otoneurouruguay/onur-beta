import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ProfessionalShell } from './components/ProfessionalShell'
import { RequireRole } from './features/auth/RequireRole'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const ExerciseBuilderPage = lazy(() => import('./pages/ExerciseBuilderPage').then((module) => ({ default: module.ExerciseBuilderPage })))
const ImmersiveLibraryPage = lazy(() => import('./pages/ImmersiveLibraryPage').then((module) => ({ default: module.ImmersiveLibraryPage })))
const ImportStudyPage = lazy(() => import('./pages/ImportStudyPage').then((module) => ({ default: module.ImportStudyPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const ProfessionalPasswordRecoveryPage = lazy(() => import('./pages/ProfessionalPasswordRecoveryPage').then((module) => ({ default: module.ProfessionalPasswordRecoveryPage })))
const ProfessionalPasswordUpdatePage = lazy(() => import('./pages/ProfessionalPasswordUpdatePage').then((module) => ({ default: module.ProfessionalPasswordUpdatePage })))
const PatientCreatePinPage = lazy(() => import('./pages/PatientCreatePinPage').then((module) => ({ default: module.PatientCreatePinPage })))
const PatientProfilePage = lazy(() => import('./pages/PatientProfilePage').then((module) => ({ default: module.PatientProfilePage })))
const PatientFormPage = lazy(() => import('./pages/PatientFormPage').then((module) => ({ default: module.PatientFormPage })))
const TreatmentCycleFormPage = lazy(() => import('./pages/TreatmentCycleFormPage').then((module) => ({ default: module.TreatmentCycleFormPage })))
const SessionBuilderPage = lazy(() => import('./pages/SessionBuilderPage').then((module) => ({ default: module.SessionBuilderPage })))
const InPersonSessionPage = lazy(() => import('./pages/InPersonSessionPage').then((module) => ({ default: module.InPersonSessionPage })))
const SessionsPage = lazy(() => import('./pages/SessionsPage').then((module) => ({ default: module.SessionsPage })))
const QuestStationPage = lazy(() => import('./pages/QuestStationPage').then((module) => ({ default: module.QuestStationPage })))
const AssessmentFormPage = lazy(() => import('./pages/AssessmentFormPage').then((module) => ({ default: module.AssessmentFormPage })))
const EvaluationsPage = lazy(() => import('./pages/EvaluationsPage').then((module) => ({ default: module.EvaluationsPage })))
const TreatmentReportPage = lazy(() => import('./pages/TreatmentReportPage').then((module) => ({ default: module.TreatmentReportPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))
const PatientAccessPage = lazy(() => import('./pages/PatientAccessPage').then((module) => ({ default: module.PatientAccessPage })))
const PatientsPage = lazy(() => import('./pages/PatientsPage').then((module) => ({ default: module.PatientsPage })))
const PatientTodayPage = lazy(() => import('./pages/PatientTodayPage').then((module) => ({ default: module.PatientTodayPage })))
const SuggestionsPage = lazy(() => import('./pages/SuggestionsPage').then((module) => ({ default: module.SuggestionsPage })))
const StudyReviewPage = lazy(() => import('./pages/StudyReviewPage').then((module) => ({ default: module.StudyReviewPage })))
const StudyExtractionReportPage = lazy(() => import('./pages/StudyExtractionReportPage').then((module) => ({ default: module.StudyExtractionReportPage })))
const StatisticsPage = lazy(() => import('./pages/StatisticsPage').then((module) => ({ default: module.StatisticsPage })))
const StudiesPage = lazy(() => import('./pages/StudiesPage').then((module) => ({ default: module.StudiesPage })))
function load(page: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-64 place-items-center text-sm font-bold text-[#747474]" role="status">
          Cargando ONUr…
        </div>
      }
    >
      {page}
    </Suspense>
  )
}

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/ingresar" replace /> },
  { path: '/ingresar', element: load(<LoginPage />) },
  { path: '/recuperar-clave', element: load(<ProfessionalPasswordRecoveryPage />) },
  { path: '/restablecer-clave', element: load(<ProfessionalPasswordUpdatePage />) },
  { path: '/q', element: load(<QuestStationPage />) },
  { path: '/quest', element: <Navigate to="/q" replace /> },
  {
    path: '/app',
    element: <RequireRole role="professional"><ProfessionalShell /></RequireRole>,
    children: [
      { index: true, element: load(<DashboardPage />) },
      { path: 'pacientes', element: load(<PatientsPage />) },
      { path: 'pacientes/nuevo', element: load(<PatientFormPage />) },
      { path: 'pacientes/:patientId/editar', element: load(<PatientFormPage />) },
      { path: 'pacientes/:patientId/ciclos/nuevo', element: load(<TreatmentCycleFormPage />) },
      { path: 'pacientes/:patientId/sesiones/nueva', element: load(<SessionBuilderPage />) },
      { path: 'pacientes/:patientId/sesiones/:assignmentId/editar', element: load(<SessionBuilderPage />) },
      { path: 'pacientes/:patientId/sesiones/:assignmentId/presencial', element: load(<InPersonSessionPage />) },
      { path: 'pacientes/:patientId/evaluaciones/nueva', element: load(<AssessmentFormPage />) },
      { path: 'pacientes/:patientId/informe', element: load(<TreatmentReportPage />) },
      { path: 'pacientes/:patientId/acceso', element: load(<PatientAccessPage />) },
      { path: 'pacientes/:patientId', element: load(<PatientProfilePage />) },
      { path: 'ejercicios', element: load(<ExerciseBuilderPage />) },
      { path: 'escenarios-360', element: load(<ImmersiveLibraryPage />) },
      { path: 'sesiones', element: load(<SessionsPage />) },
      { path: 'evaluaciones', element: load(<EvaluationsPage />) },
      { path: 'informes', element: load(<ReportsPage />) },
      { path: 'estudios', element: load(<StudiesPage />) },
      { path: 'estudios/importar', element: load(<ImportStudyPage />) },
      { path: 'estudios/:studyId/revisar', element: load(<StudyReviewPage />) },
      { path: 'estudios/:studyId/informe', element: load(<StudyExtractionReportPage />) },
      { path: 'sugerencias', element: load(<SuggestionsPage />) },
      { path: 'estadisticas', element: load(<StatisticsPage />) },
      { path: '*', element: <Navigate to="/app" replace /> },
    ],
  },
  { path: '/paciente/hoy', element: <RequireRole role="patient">{load(<PatientTodayPage />)}</RequireRole> },
  { path: '/paciente/crear-pin', element: <RequireRole role="patient">{load(<PatientCreatePinPage />)}</RequireRole> },
  { path: '*', element: <Navigate to="/ingresar" replace /> },
], { basename: import.meta.env.BASE_URL })

export default function App() {
  return <RouterProvider router={router} />
}
