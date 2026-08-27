import { CalendarDays, IdCard, KeyRound, NotebookPen, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { TreatmentCycleRecord } from '../sessions/repository'
import type { PatientRecord } from './repository'

function shown(value: string, fallback = 'Sin registrar') {
  return value.trim() || fallback
}

function formatPatientBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return shown(value)
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('es-UY').format(new Date(Date.UTC(year, month - 1, day, 12)))
}

export function PatientDetailsCard({ patient, activeCycle, activePermissions }: { patient: PatientRecord; activeCycle?: TreatmentCycleRecord; activePermissions: number }) {
  const details = [
    { label: 'Cédula de identidad', value: shown(patient.documentNumber), icon: IdCard },
    { label: 'Fecha de nacimiento', value: formatPatientBirthDate(patient.birthDate), icon: CalendarDays },
    { label: 'Edad', value: patient.age ? `${patient.age} años` : 'Sin registrar', icon: UserRound },
    { label: 'Mutualista', value: shown(patient.insurer, 'Sin mutualista'), icon: ShieldCheck },
    { label: 'N.º de afiliado', value: shown(patient.affiliateNumber), icon: IdCard },
    { label: 'Teléfono', value: shown(patient.phone), icon: Phone },
  ]

  return <section aria-labelledby="patient-details-title" className="rounded-2xl border border-[#E9E7E7] bg-white p-6 shadow-[0_12px_30px_rgba(21,54,60,0.04)] sm:p-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><h2 id="patient-details-title" className="text-lg font-black text-[#171717]">Datos del paciente</h2><p className="mt-1 text-xs leading-5 text-[#747474]">Información clínica y administrativa visible al abrir el perfil.</p></div>
      <Link to={`/app/pacientes/${patient.id}/editar`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E9E7E7] bg-white px-4 py-2.5 text-xs font-black text-[#2F2F2F]"><NotebookPen size={15}/> Editar datos</Link>
    </div>
    <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
      {details.map(({ label, value, icon: Icon }) => <div key={label} className="border-b border-[#E9E7E7] pb-4"><dt className="inline-flex items-center gap-2 text-xs font-bold text-[#747474]"><Icon size={14}/>{label}</dt><dd className="mt-2 break-words text-sm font-black text-[#2F2F2F]">{value}</dd></div>)}
      <div className="border-b border-[#E9E7E7] pb-4"><dt className="text-xs font-bold text-[#747474]">Estado</dt><dd className="mt-2 text-sm font-black text-[#2F2F2F]">{patient.status === 'active' ? 'Activo' : 'Inactivo'}</dd></div>
      <div className="border-b border-[#E9E7E7] pb-4"><dt className="text-xs font-bold text-[#747474]">Ciclo actual</dt><dd className="mt-2 text-sm font-black text-[#2F2F2F]">{activeCycle?.label ?? 'Sin ciclo activo'}</dd></div>
      <div className="border-b border-[#E9E7E7] pb-4"><dt className="text-xs font-bold text-[#747474]">Acceso domiciliario</dt><dd className="mt-2 text-sm font-black text-[#2F2F2F]">{patient.portalAccess === 'enabled' ? 'Habilitado' : 'Deshabilitado'}</dd></div>
      <div className="border-b border-[#E9E7E7] pb-4"><dt className="text-xs font-bold text-[#747474]">Documentos compartidos</dt><dd className="mt-2 text-sm font-black text-[#2F2F2F]">{activePermissions}</dd></div>
    </dl>
    <div className="mt-5 rounded-2xl bg-[#F7F6F4] p-4"><p className="inline-flex items-center gap-2 text-xs font-black text-[#5E5E5E]"><NotebookPen size={15}/> Notas privadas</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#2F2F2F]">{shown(patient.privateNotes)}</p><p className="mt-2 text-[10px] text-[#747474]">Estas notas nunca se muestran en el portal del paciente.</p></div>
    <Link to={`/app/pacientes/${patient.id}/acceso`} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-[#E9E7E7] px-4 py-3 text-xs font-black text-[#2F2F2F]"><KeyRound size={16}/>{patient.portalAccess === 'enabled' ? 'Gestionar acceso domiciliario' : 'Habilitar acceso domiciliario'}</Link>
  </section>
}
