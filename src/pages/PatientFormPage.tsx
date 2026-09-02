import { ChevronLeft, KeyRound, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { usePortalAccount } from '../features/access/hooks'
import { useCreatePatient, usePatient, useUpdatePatient } from '../features/patients/hooks'
import { patientFormSchema, suggestUsername, type PatientFormValues } from '../features/patients/schema'

const empty: PatientFormValues = {
  fullName: '',
  documentNumber: '',
  birthDate: '',
  insurer: '',
  affiliateNumber: '',
  phone: '',
  status: 'active',
  privateNotes: '',
  createPortalAccount: false,
  username: '',
  temporaryCi: '',
}

export function PatientFormPage() {
  const { patientId } = useParams()
  const editing = Boolean(patientId)
  const navigate = useNavigate()
  const { data: patient } = usePatient(patientId ?? '')
  const { data: portalAccount, isPending: portalPending } = usePortalAccount(editing ? patientId ?? '' : '')
  const create = useCreatePatient()
  const update = useUpdatePatient(patientId ?? '')
  const [values, setValues] = useState(empty)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [usernameTouched, setUsernameTouched] = useState(false)

  useEffect(() => {
    if (!patient) return
    setValues({
      fullName: patient.fullName,
      documentNumber: patient.documentNumber,
      birthDate: patient.birthDate,
      insurer: patient.insurer === 'Sin mutualista' ? '' : patient.insurer,
      affiliateNumber: patient.affiliateNumber,
      phone: patient.phone,
      status: patient.status,
      privateNotes: patient.privateNotes,
      createPortalAccount: false,
      username: patient.username,
      temporaryCi: '',
    })
  }, [patient])

  const set = (key: keyof PatientFormValues, value: string | boolean) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const setDocumentNumber = (rawValue: string) => {
    const documentNumber = rawValue.replace(/\D/g, '').slice(0, 12)
    setValues((current) => ({
      ...current,
      documentNumber,
      temporaryCi:
        current.createPortalAccount && (!current.temporaryCi || current.temporaryCi === current.documentNumber)
          ? documentNumber
          : current.temporaryCi,
    }))
  }

  const togglePortalAccount = (checked: boolean) => {
    setValues((current) => ({
      ...current,
      createPortalAccount: checked,
      username: checked && !current.username ? suggestUsername(current.fullName).toLowerCase() : current.username,
      temporaryCi: checked && !current.temporaryCi ? current.documentNumber : current.temporaryCi,
    }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const parsed = patientFormSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      return
    }
    setErrors({})
    try {
      const result = editing ? await update.mutateAsync(parsed.data) : await create.mutateAsync(parsed.data)
      navigate(`/app/pacientes/${result.patient.id}`, {
        state: {
          notice: result.warning ?? (editing ? 'Paciente actualizado.' : 'Paciente creado correctamente.'),
        },
      })
    } catch (caught) {
      setErrors({ form: caught instanceof Error ? caught.message : 'No fue posible guardar.' })
    }
  }

  const pending = create.isPending || update.isPending
  const input = 'mt-2 h-12 w-full rounded-2xl border border-[#E9E7E7] bg-white px-4 text-sm text-[#171717]'
  const canOfferPortalCreation = !editing || (!portalPending && !portalAccount)

  return (
    <div className="space-y-7">
      <Link
        to={editing ? `/app/pacientes/${patientId}` : '/app/pacientes'}
        className="inline-flex items-center gap-2 text-xs font-black text-[#E49A02]"
      >
        <ChevronLeft size={16} /> Volver
      </Link>
      <PageHeader
        eyebrow="Gestión clínica"
        title={editing ? 'Editar paciente' : 'Crear paciente'}
        description="Los datos privados quedan separados del acceso domiciliario del paciente."
      />

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <section className="space-y-5 rounded-2xl border border-[#E9E7E7] bg-white p-6">
          <h2 className="text-lg font-black text-[#171717]">Datos del paciente</h2>
          <label className="block text-sm font-black text-[#2F2F2F]">
            Nombre completo *
            <input
              className={input}
              value={values.fullName}
              onChange={(event) => {
                set('fullName', event.target.value)
                if (!usernameTouched) set('username', suggestUsername(event.target.value).toLowerCase())
              }}
            />
            {errors.fullName && <small className="mt-1 block text-[#a94952]">{errors.fullName}</small>}
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-black text-[#2F2F2F]">
              Cédula de identidad
              <input
                className={input}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Solo números"
                value={values.documentNumber}
                onChange={(event) => setDocumentNumber(event.target.value)}
              />
              {errors.documentNumber && <small className="mt-1 block text-[#a94952]">{errors.documentNumber}</small>}
            </label>
            <label className="block text-sm font-black text-[#2F2F2F]">
              Fecha de nacimiento
              <input
                type="date"
                className={input}
                value={values.birthDate}
                onChange={(event) => set('birthDate', event.target.value)}
              />
              {errors.birthDate && <small className="mt-1 block text-[#a94952]">{errors.birthDate}</small>}
            </label>
            <label className="block text-sm font-black text-[#2F2F2F]">
              Mutualista
              <input className={input} value={values.insurer} onChange={(event) => set('insurer', event.target.value)} />
            </label>
            <label className="block text-sm font-black text-[#2F2F2F]">
              N.º de afiliado
              <input
                className={input}
                value={values.affiliateNumber}
                onChange={(event) => set('affiliateNumber', event.target.value)}
              />
            </label>
            <label className="block text-sm font-black text-[#2F2F2F]">
              Teléfono
              <input className={input} value={values.phone} onChange={(event) => set('phone', event.target.value)} />
            </label>
          </div>
          <label className="block text-sm font-black text-[#2F2F2F]">
            Notas privadas
            <textarea
              className="mt-2 min-h-28 w-full rounded-2xl border border-[#E9E7E7] p-4 text-sm"
              value={values.privateNotes}
              onChange={(event) => set('privateNotes', event.target.value)}
            />
            <small className="mt-1 block font-normal text-[#747474]">Nunca se muestran en el portal del paciente.</small>
          </label>
          {editing && (
            <label className="block text-sm font-black text-[#2F2F2F]">
              Estado
              <select className={input} value={values.status} onChange={(event) => set('status', event.target.value)}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </label>
          )}
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-[#E9E7E7] bg-white p-6">
            <div className="flex gap-3">
              <ShieldCheck className="text-[#E49A02]" />
              <div>
                <h2 className="font-black text-[#171717]">Acceso domiciliario</h2>
                <p className="mt-1 text-xs leading-5 text-[#747474]">
                  La cédula queda en la ficha clínica privada. Para crear el acceso se usa como clave temporal y se
                  exige cambiarla por un PIN.
                </p>
              </div>
            </div>

            {editing && portalPending && <p className="mt-5 text-xs text-[#747474]">Consultando el acceso actual…</p>}

            {editing && portalAccount && (
              <div className="mt-5 rounded-2xl bg-[#F7F6F4] p-4">
                <p className="text-xs font-black uppercase tracking-[.12em] text-[#747474]">
                  {portalAccount.enabled ? 'Acceso habilitado' : 'Acceso deshabilitado'}
                </p>
                <p className="mt-2 text-sm font-black text-[#171717]">Usuario: {portalAccount.username}</p>
                <Link
                  to={`/app/pacientes/${patientId}/acceso`}
                  className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg border border-[#D8D5D2] bg-white px-4 text-xs font-black text-[#2F2F2F]"
                >
                  <KeyRound size={16} /> {portalAccount.enabled ? 'Gestionar acceso' : 'Reactivar acceso'}
                </Link>
              </div>
            )}

            {canOfferPortalCreation && (
              <>
                <label className="mt-5 flex items-center gap-3 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={values.createPortalAccount}
                    onChange={(event) => togglePortalAccount(event.target.checked)}
                  />
                  Habilitar acceso domiciliario
                </label>
                {values.createPortalAccount && (
                  <div className="mt-5 space-y-4">
                    <label className="block text-sm font-black text-[#2F2F2F]">
                      Usuario
                      <input
                        className={input}
                        value={values.username}
                        onChange={(event) => {
                          setUsernameTouched(true)
                          set('username', event.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))
                        }}
                      />
                      {errors.username && <small className="mt-1 block text-[#a94952]">{errors.username}</small>}
                    </label>
                    <label className="block text-sm font-black text-[#2F2F2F]">
                      Cédula como clave temporal
                      <input
                        className={input}
                        type="password"
                        inputMode="numeric"
                        value={values.temporaryCi}
                        onChange={(event) => set('temporaryCi', event.target.value.replace(/\D/g, '').slice(0, 12))}
                      />
                      {errors.temporaryCi && <small className="mt-1 block text-[#a94952]">{errors.temporaryCi}</small>}
                    </label>
                    <p className="rounded-2xl bg-[#FFF7E8] p-3 text-xs leading-5 text-[#8A5B00]">
                      En el primer acceso deberá reemplazarla por un PIN de 4 dígitos.
                    </p>
                  </div>
                )}
              </>
            )}
          </section>

          {errors.form && (
            <p role="alert" className="rounded-2xl bg-[#fceced] p-4 text-sm font-bold text-[#a94952]">
              {errors.form}
            </p>
          )}
          <button
            disabled={pending}
            className="h-11 w-full rounded-lg bg-[#E49A02] px-5 text-sm font-black text-white disabled:opacity-60"
          >
            {pending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear paciente'}
          </button>
        </aside>
      </form>
    </div>
  )
}
