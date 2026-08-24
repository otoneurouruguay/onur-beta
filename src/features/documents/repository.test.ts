import { beforeEach, describe, expect, it } from 'vitest'
import { listCurrentPatientDocumentCatalog, listCurrentPatientDocuments, listPatientDocumentAccessRequests, listPatientDocuments, requestDocumentAccess, resolveDocumentAccessRequest, setDocumentPermission, uploadClinicalDocument } from './repository'

describe('repositorio demo de documentos', () => {
  beforeEach(() => localStorage.clear())

  it('carga metadatos y controla nivel de permiso hasta revocación', async () => {
    const file = new File(['contenido'], 'control.pdf', {type:'application/pdf'})
    const created = await uploadClinicalDocument({patientId:'ana-p',treatmentCycleId:'cycle-ana-2',documentType:'posturography',documentDate:'2026-07-16',description:'Control',shareWithPatient:false,file,deviceName:'Equipo',protocolCode:'POST',protocolVersion:'1'})
    expect((await listPatientDocuments('ana-p')).some(item=>item.id===created.id)).toBe(true)
    expect(created.sharedWithPatient).toBe(false)
    await setDocumentPermission(created,'view_download')
    expect((await listCurrentPatientDocuments()).find(item=>item.id===created.id)?.permissionLevel).toBe('view_download')
    await setDocumentPermission(created,null)
    expect((await listCurrentPatientDocuments()).some(item=>item.id===created.id)).toBe(false)
  })

  it('permite solicitar acceso y aprobar solo visualización', async () => {
    const locked=(await listCurrentPatientDocumentCatalog()).find(item=>!item.canView)
    expect(locked).toBeDefined()
    const requestId=await requestDocumentAccess(locked!.id)
    expect((await listCurrentPatientDocumentCatalog()).find(item=>item.id===locked!.id)?.requestStatus).toBe('pending')
    expect((await listPatientDocumentAccessRequests('ana-p')).find(item=>item.id===requestId)?.status).toBe('pending')
    await resolveDocumentAccessRequest(requestId,'approved','view')
    const approved=(await listCurrentPatientDocumentCatalog()).find(item=>item.id===locked!.id)
    expect(approved).toMatchObject({canView:true,canDownload:false,permissionLevel:'view'})
  })

  it('conserva una denegación y permite solicitar nuevamente', async () => {
    const locked=(await listCurrentPatientDocumentCatalog()).find(item=>!item.canView)!
    const first=await requestDocumentAccess(locked.id)
    await resolveDocumentAccessRequest(first,'denied','view')
    const second=await requestDocumentAccess(locked.id)
    expect(second).not.toBe(first)
    expect((await listPatientDocumentAccessRequests('ana-p')).filter(item=>item.documentId===locked.id)).toHaveLength(2)
  })

  it('impide cargar dos posturografías iniciales dentro del mismo ciclo', async () => {
    const input = {
      patientId: 'ana-p', treatmentCycleId: 'cycle-ana-2', documentType: 'posturography' as const,
      cyclePhase: 'initial' as const, documentDate: '2026-08-01', description: '', shareWithPatient: false,
      file: new File(['posturografía'], 'inicial.pdf', { type: 'application/pdf' }),
      deviceName: '', protocolCode: 'bap-auto-review', protocolVersion: '1',
    }

    await uploadClinicalDocument(input)
    await expect(uploadClinicalDocument({ ...input, file: new File(['otra'], 'otra-inicial.pdf', { type: 'application/pdf' }) }))
      .rejects.toThrow('Ya existe una posturografía inicial')
  })
})
