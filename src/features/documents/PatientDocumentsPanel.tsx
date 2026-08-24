import { Check, Download, ExternalLink, FileText, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DeleteDocumentDialog } from '../../components/DeleteDocumentDialog'
import { createDocumentUrl } from './repository'
import { useDeleteDocument, usePatientDocumentAccessRequests, usePatientDocuments, useResolveDocumentAccessRequest, useSetDocumentPermission } from './hooks'
import { cycleStudyPhaseLabels, documentTypeLabels, type ClinicalDocumentRecord, type DocumentPermissionLevel } from './types'

export function PatientDocumentsPanel({patientId}:{patientId:string}) {
  const {data:documents=[],isPending}=usePatientDocuments(patientId)
  const {data:requests=[]}=usePatientDocumentAccessRequests(patientId)
  const permission=useSetDocumentPermission(patientId)
  const resolve=useResolveDocumentAccessRequest(patientId)
  const deletion=useDeleteDocument(patientId)
  const [documentToDelete,setDocumentToDelete]=useState<ClinicalDocumentRecord|null>(null)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const pendingRequests=requests.filter(request=>request.status==='pending')

  const open=async(document:typeof documents[number],download=false)=>{setError('');try{const url=await createDocumentUrl(document,download);window.open(url,'_blank','noopener,noreferrer')}catch(caught){setError(caught instanceof Error?caught.message:'No fue posible abrir el archivo.')}}
  const setLevel=(document:typeof documents[number],value:string)=>permission.mutate({document,level:(value||null) as DocumentPermissionLevel|null})
  const requestDeletion=(document:ClinicalDocumentRecord)=>{deletion.reset();setNotice('');setDocumentToDelete(document)}
  const cancelDeletion=()=>{if(deletion.isPending)return;deletion.reset();setDocumentToDelete(null)}
  const confirmDeletion=async()=>{
    if(!documentToDelete)return
    const label=documentTypeLabels[documentToDelete.documentType]
    try{await deletion.mutateAsync(documentToDelete);setDocumentToDelete(null);setNotice(`${label} eliminado correctamente.`)}catch{/* El error se muestra dentro del diálogo. */}
  }
  const deletionError=deletion.error?(deletion.error instanceof Error?deletion.error.message:'No fue posible eliminar el documento.'):undefined

  return <article className="rounded-2xl border border-[#E9E7E7] bg-white p-6 sm:col-span-2">
    <div><h2 className="text-lg font-black text-[#171717]">Documentos y estudios</h2><p className="mt-1 text-xs leading-5 text-[#747474]">Los permisos permanecen activos hasta revocación manual. “Solo visualizar” no muestra un botón de descarga, aunque ningún visor web puede impedir por completo que se guarde una copia.</p></div>
    {error&&<p role="alert" className="mt-4 rounded-2xl bg-[#FFF7E8] p-3 text-xs font-bold text-[#8A5B00]">{error}</p>}
    {notice&&<p role="status" className="mt-4 rounded-2xl border border-[#CFE2D6] bg-[#EEF7F1] p-3 text-xs font-bold text-[#27734C]">{notice}</p>}

    {pendingRequests.length>0&&<section className="mt-5 rounded-2xl border border-[#E8CE99] bg-[#FFF7E8] p-5"><h3 className="text-sm font-black text-[#8A5B00]">Solicitudes pendientes ({pendingRequests.length})</h3><div className="mt-3 space-y-3">{pendingRequests.map(request=><div key={request.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-[#2F2F2F]">{documentTypeLabels[request.documentType]}</p><p className="mt-1 text-xs text-[#747474]">{request.documentDate} · solicitado {new Date(request.requestedAt).toLocaleDateString('es-UY')}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={resolve.isPending} onClick={()=>resolve.mutate({requestId:request.id,decision:'denied',level:'view'})} className="inline-flex items-center gap-1.5 rounded-xl border border-[#E9E7E7] px-3 py-2 text-xs font-black text-[#696969]"><X size={14}/> No autorizar</button><button type="button" disabled={resolve.isPending} onClick={()=>resolve.mutate({requestId:request.id,decision:'approved',level:'view'})} className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8CE99] px-3 py-2 text-xs font-black text-[#E49A02]"><Check size={14}/> Solo ver</button><button type="button" disabled={resolve.isPending} onClick={()=>resolve.mutate({requestId:request.id,decision:'approved',level:'view_download'})} className="inline-flex items-center gap-1.5 rounded-xl bg-[#E49A02] px-3 py-2 text-xs font-black text-white"><Download size={14}/> Ver y descargar</button></div></div>)}</div></section>}

    {isPending?<p className="mt-5 text-sm text-[#747474]">Cargando documentos…</p>:documents.length===0?<p className="mt-5 text-sm text-[#747474]">Todavía no hay documentos cargados.</p>:<div className="mt-5 divide-y divide-[#E9E7E7]">{documents.map(document=><div key={document.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#F7F6F4] text-[#E49A02]"><FileText size={18}/></span><div><p className="text-sm font-black text-[#2F2F2F]">{documentTypeLabels[document.documentType]}{document.documentType==='posturography'&&document.cyclePhase&&document.cyclePhase!=='unspecified'?` · ${cycleStudyPhaseLabels[document.cyclePhase]}`:''}</p><p className="mt-1 text-xs text-[#747474]">{document.documentDate} · {document.originalFilename}</p>{document.description&&<p className="mt-1 whitespace-pre-wrap text-xs text-[#747474]">{document.description}</p>}</div></div><div className="flex flex-wrap items-center gap-2">{document.studyId&&<Link to={`/app/estudios/${document.studyId}/revisar`} className="rounded-xl border border-[#E8CE99] px-3 py-2 text-xs font-black text-[#E49A02]">Revisar valores</Link>}<button type="button" onClick={()=>open(document)} className="grid size-10 place-items-center rounded-xl border border-[#E9E7E7] text-[#747474]" aria-label={`Abrir ${document.originalFilename}`} title="Abrir archivo"><ExternalLink size={16}/></button><button type="button" onClick={()=>open(document,true)} className="grid size-10 place-items-center rounded-xl border border-[#E9E7E7] text-[#747474]" aria-label={`Descargar ${document.originalFilename}`} title="Descargar archivo"><Download size={16}/></button><button type="button" disabled={deletion.isPending} onClick={()=>requestDeletion(document)} className="grid size-10 place-items-center rounded-xl border border-[#E5C7CA] text-[#A94952] transition hover:border-[#A94952] hover:bg-[#FCECED] disabled:opacity-50" aria-label={`Eliminar ${document.originalFilename}`} title="Eliminar documento"><Trash2 size={16}/></button><label className="relative"><span className="sr-only">Permiso del paciente</span><select aria-label={`Permiso para ${document.originalFilename}`} disabled={permission.isPending} value={document.permissionLevel} onChange={event=>setLevel(document,event.target.value)} className={`h-10 rounded-xl border-0 px-3 text-xs font-black ${document.permissionLevel?'bg-[#e6f5ee] text-[#27734c]':'bg-[#F1EFEC] text-[#696969]'}`}><option value="">Privado</option><option value="view">Solo visualizar</option><option value="view_download">Ver y descargar</option></select></label></div></div>)}</div>}

    {documentToDelete&&<DeleteDocumentDialog documentLabel={documentTypeLabels[documentToDelete.documentType]} filename={documentToDelete.originalFilename} removesStudyData={Boolean(documentToDelete.studyId||(documentToDelete.studyIds?.length??0)>0)} isPending={deletion.isPending} error={deletionError} onCancel={cancelDeletion} onConfirm={()=>void confirmDeletion()}/>} 
  </article>
}
