import { Suspense, type ReactNode } from 'react'
import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ApplicationErrorPage } from './components/ApplicationErrorPage'
import { ProfessionalShell } from './components/ProfessionalShell'
import { RequireRole } from './features/auth/RequireRole'
import { lazyWithRefresh } from './lib/lazyWithRefresh'

const DashboardPage = lazyWithRefresh('dashboard', () => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const ExerciseBuilderPage = lazyWithRefresh('exercise-builder', () => import('./pages/ExerciseBuilderPage').then((module) => ({ default: module.ExerciseBuilderPage })))
const ImmersiveLibraryPage = lazyWithRefresh('immersive-library', () => import('./pages/ImmersiveLibraryPage').then((module) => ({ default: module.ImmersiveLibraryPage })))
const ImportStudyPage = lazyWithRefresh('import-study', () => import('./pages/ImportStudyPage').then((module) => ({ default: module.ImportStudyPage })))
const LoginPage = lazyWithRefresh('login', () => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const ProfessionalPasswordRecoveryPage = lazyWithRefresh('password-recovery', () => import('./pages/ProfessionalPasswordRecoveryPage').then((module) => ({ default: module.ProfessionalPasswordRecoveryPage })))
const ProfessionalPasswordUpdatePage = lazyWithRefresh('password-update', () => import('./pages/ProfessionalPasswordUpdatePage').then((module) => ({ default: module.ProfessionalPasswordUpdatePage })))
const PatientCreatePinPage = lazyWithRefresh('patient-create-pin', () => import('./pages/PatientCreatePinPage').then((module) => ({ default: module.PatientCreatePinPage })))
const PatientProfilePage = lazyWithRefresh('patient-profile', () => import('./pages/PatientProfilePage').then((module) => ({ default: module.PatientProfilePage })))
const PatientFormPage = lazyWithRefresh('patient-form', () => import('./pages/PatientFormPage').then((module) => ({ default: module.PatientFormPage })))
const TreatmentCycleFormPage = lazyWithRefresh('treatment-cycle-form', () => import('./pages/TreatmentCycleFormPage').then((module) => ({ default: module.TreatmentCycleFormPage })))
const ClinicalEpisodePage = lazyWithRefresh('clinical-episode', () => import('./pages/ClinicalEpisodePage').then((module) => ({ default: module.ClinicalEpisodePage })))
const SessionBuilderPage = lazyWithRefresh('session-builder', () => import('./pages/SessionBuilderPage').then((module) => ({ default: module.SessionBuilderPage })))
const SessionHistoryPage = lazyWithRefresh('session-history', () => import('./pages/SessionHistoryPage').then((module) => ({ default: module.SessionHistoryPage })))
const InPersonSessionPage = lazyWithRefresh('in-person-session', () => import('./pages/InPersonSessionPage').then((module) => ({ default: module.InPersonSessionPage })))
const SessionsPage = lazyWithRefresh('sessions', () => import('./pages/SessionsPage').then((module) => ({ default: module.SessionsPage })))
const QuestStationPage = lazyWithRefresh('quest-station', () => import('./pages/QuestStationPage').then((module) => ({ default: module.QuestStationPage })))
const AssessmentFormPage = lazyWithRefresh('assessment-form', () => import('./pages/AssessmentFormPage').then((module) => ({ default: module.AssessmentFormPage })))
const EvaluationsPage = lazyWithRefresh('evaluations', () => import('./pages/EvaluationsPage').then((module) => ({ default: module.EvaluationsPage })))
const TreatmentReportPage = lazyWithRefresh('treatment-report', () => import('./pages/TreatmentReportPage').then((module) => ({ default: module.TreatmentReportPage })))
const ReportsPage = lazyWithRefresh('reports', () => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))
const PatientAccessPage = lazyWithRefresh('patient-access', () => import('./pages/PatientAccessPage').then((module) => ({ default: module.PatientAccessPage })))
const PatientsPage = lazyWithRefresh('patients', () => import('./pages/PatientsPage').then((module) => ({ default: module.PatientsPage })))
const PatientTodayPage = lazyWithRefresh('patient-today', () => import('./pages/PatientTodayPage').then((module) => ({ default: module.PatientTodayPage })))
const SuggestionsPage = lazyWithRefresh('suggestions', () => import('./pages/SuggestionsPage').then((module) => ({ default: module.SuggestionsPage })))
const StudyReviewPage = lazyWithRefresh('study-review', () => import('./pages/StudyReviewPage').then((module) => ({ default: module.StudyReviewPage })))
const StudyExtractionReportPage = lazyWithRefresh('study-extraction-report', () => import('./pages/StudyExtractionReportPage').then((module) => ({ default: module.StudyExtractionReportPage })))
const StatisticsPage = lazyWithRefresh('statistics', () => import('./pages/StatisticsPage').then((module) => ({ default: module.StatisticsPage })))
const StudiesPage = lazyWithRefresh('studies', () => import('./pages/StudiesPage').then((module) => ({ default: module.StudiesPage })))
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
  {
    errorElement: <ApplicationErrorPage />,
    children: [
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
          { path: 'pacientes/:patientId/episodio', element: load(<ClinicalEpisodePage />) },
          { path: 'pacientes/:patientId/sesiones/nueva', element: load(<SessionBuilderPage />) },
          { path: 'pacientes/:patientId/sesiones/:assignmentId/editar', element: load(<SessionBuilderPage />) },
          { path: 'pacientes/:patientId/sesiones/:assignmentId/presencial', element: load(<InPersonSessionPage />) },
          { path: 'pacientes/:patientId/sesiones/:assignmentId', element: load(<SessionHistoryPage />) },
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
    ],
  },
], { basename: import.meta.env.BASE_URL })

export default function App() {
  return <RouterProvider router={router} />
}
