import { ChevronLeft, KeyRound, LockKeyhole, ShieldCheck, UnlockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useCreatePortalAccount, useManagePortalAccount, usePortalAccount } from '../features/access/hooks'
import { usePatient } from '../features/patients/hooks'
import { suggestUsername } from '../features/patients/schema'

export function PatientAccessPage() {
  const { patientId = '' } = useParams()
  const { data: patient } = usePatient(patientId)
  const { data: account, isPending } = usePortalAccount(patientId)
  const create = useCreatePortalAccount(patientId)
  const manage = useManagePortalAccount(patientId)
  const [username, setUsername] = useState('')
  const [temporaryCi, setTemporaryCi] = useState('')
  const [error, setError] = useState('')
  const pending = create.isPending || manage.isPending

  useEffect(() => {
    if (patient?.documentNumber) setTemporaryCi(patient.documentNumber)
  }, [patient?.documentNumber])

  const act = async (action: 'enable' | 'disable' | 'unlock' | 'reset_temporary_secret') => {
    if (action === 'reset_temporary_secret' && !/^\d{6,12}$/.test(temporaryCi)) {
      setError('Ingresá la cédula temporal, solo números.')
      return
    }
    setError('')
    try {
      await manage.mutateAsync({ action, temporaryCi })
      setTemporaryCi('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible actualizar la cuenta.')
    }
  }

  const createAccount = async () => {
    const proposed = username || suggestUsername(patient?.fullName ?? '').toLowerCase()
    if (!/^[a-z0-9]{4,40}$/.test(proposed) || !/^\d{6,12}$/.test(temporaryCi)) {
      setError('Revisá el usuario y la cédula temporal.')
      return
    }
    setError('')
    try {
      await create.mutateAsync({ username: proposed, temporaryCi })
      setTemporaryCi('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible crear la cuenta.')
    }
  }

  const input = 'mt-2 h-12 w-full rounded-2xl border border-[#E9E7E7] bg-white px-4 text-sm'

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <Link
        to={`/app/pacientes/${patientId}`}
        className="inline-flex items-center gap-2 text-xs font-black text-[#E49A02]"
      >
        <ChevronLeft size={16} /> Volver al perfil
      </Link>
      <PageHeader
        eyebrow="Portal del paciente"
        title="Acceso domiciliario"
        description={`Administrá el ingreso de ${patient?.fullName ?? 'paciente'} a sus sesiones indicadas para domicilio.`}
      />

      {isPending ? (
        <p className="text-sm text-[#747474]">Cargando cuenta…</p>
      ) : !account ? (
        <section className="rounded-2xl border border-[#E9E7E7] bg-white p-6 sm:p-8">
          <h2 className="text-lg font-black text-[#171717]">Habilitar acceso domiciliario</h2>
          <p className="mt-2 text-sm leading-6 text-[#747474]">
            Creá el usuario del paciente. La cédula registrada se propone como clave temporal y deberá reemplazarse por
            un PIN de 4 dígitos en el primer ingreso.
          </p>
          {!patient?.documentNumber && (
            <p className="mt-4 rounded-2xl bg-[#FFF7E8] p-4 text-xs font-bold leading-5 text-[#8A5B00]">
              Este paciente no tiene cédula registrada. Podés ingresarla aquí como clave temporal o volver a Editar
              paciente para guardarla en su ficha clínica.
            </p>
          )}
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-black text-[#2F2F2F]">
              Usuario
              <input
                className={input}
                value={username}
                placeholder={suggestUsername(patient?.fullName ?? '').toLowerCase()}
                onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
              />
            </label>
            <label className="text-sm font-black text-[#2F2F2F]">
              Cédula como clave temporal
              <input
                type="password"
                inputMode="numeric"
                className={input}
                value={temporaryCi}
                onChange={(event) => setTemporaryCi(event.target.value.replace(/\D/g, '').slice(0, 12))}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={createAccount}
            disabled={pending}
            className="mt-6 h-11 rounded-lg bg-[#E49A02] px-5 text-sm font-black text-white disabled:opacity-60"
          >
            {create.isPending ? 'Habilitando…' : 'Habilitar acceso'}
          </button>
        </section>
      ) : (
        <>
          <section className="grid gap-5 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#E9E7E7] bg-white p-6">
              <p className="text-xs font-black uppercase text-[#747474]">Estado</p>
              <p className={`mt-3 text-lg font-black ${account.enabled ? 'text-[#27734c]' : 'text-[#a94952]'}`}>
                {account.enabled ? 'Habilitado' : 'Deshabilitado'}
              </p>
            </div>
            <div className="rounded-2xl border border-[#E9E7E7] bg-white p-6">
              <p className="text-xs font-black uppercase text-[#747474]">Usuario</p>
              <p className="mt-3 text-lg font-black text-[#171717]">{account.username}</p>
            </div>
            <div className="rounded-2xl border border-[#E9E7E7] bg-white p-6">
              <p className="text-xs font-black uppercase text-[#747474]">PIN</p>
              <p className="mt-3 text-lg font-black text-[#171717]">
                {account.mustChangePin ? 'Cambio pendiente' : 'Configurado'}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E9E7E7] bg-white p-6">
            <h2 className="text-lg font-black text-[#171717]">Acciones de seguridad</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => act(account.enabled ? 'disable' : 'enable')}
                disabled={pending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#E9E7E7] px-4 text-sm font-black text-[#2F2F2F]"
              >
                {account.enabled ? <LockKeyhole size={17} /> : <ShieldCheck size={17} />}
                {account.enabled ? 'Deshabilitar acceso' : 'Reactivar acceso'}
              </button>
              <button
                type="button"
                onClick={() => act('unlock')}
                disabled={pending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#E9E7E7] px-4 text-sm font-black text-[#2F2F2F]"
              >
                <UnlockKeyhole size={17} /> Desbloquear intentos
              </button>
              <div className="rounded-2xl bg-[#F7F6F4] p-3 text-xs text-[#747474]">
                Intentos fallidos: <strong>{account.failedAttempts}</strong>
                <br />
                Último acceso: {account.lastLoginAt ? account.lastLoginAt.slice(0, 16).replace('T', ' ') : 'Sin registro'}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-6">
            <KeyRound className="text-[#8A5B00]" />
            <h2 className="mt-4 font-black text-[#8A5B00]">Restablecer acceso temporal</h2>
            <p className="mt-2 text-xs leading-5 text-[#8A5B00]">
              Reemplaza el PIN actual por la cédula temporal y exige crear un nuevo PIN de 4 dígitos en el próximo
              ingreso.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="password"
                inputMode="numeric"
                className="h-12 flex-1 rounded-2xl border border-[#E8CE99] bg-white px-4 text-sm"
                placeholder="Cédula temporal"
                value={temporaryCi}
                onChange={(event) => setTemporaryCi(event.target.value.replace(/\D/g, '').slice(0, 12))}
              />
              <button
                type="button"
                onClick={() => act('reset_temporary_secret')}
                disabled={pending}
                className="h-11 rounded-lg bg-[#8A5B00] px-5 text-sm font-black text-white disabled:opacity-60"
              >
                Restablecer
              </button>
            </div>
          </section>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-2xl bg-[#fceced] p-4 text-sm font-bold text-[#a94952]">
          {error}
        </p>
      )}
    </div>
  )
}
