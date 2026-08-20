import { useEffect, useState } from 'react'
import { createDocumentUrl } from '../documents/repository'
import type { ClinicalDocumentRecord } from '../documents/types'
import { PrivateDocumentViewer } from '../extraction/PrivateDocumentViewer'

export function ReportSourceFigure({ document, pageNumber, label }: { document: ClinicalDocumentRecord | undefined; pageNumber: number; label: string }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setUrl('')
    setError('')
    if (!document) return () => { active = false }
    void createDocumentUrl(document).then((signedUrl) => {
      if (active) setUrl(signedUrl)
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : 'No fue posible cargar el estudio original.')
    })
    return () => { active = false }
  }, [document])

  if (!document) return <div className="onur-report-source-figure grid min-h-[390px] place-items-center border border-dashed border-[#BFC9D5] bg-[#F8FAFC] p-8 text-center text-sm text-[#667085]">No se seleccionó un documento para {label.toLowerCase()}.</div>
  if (error) return <div className="onur-report-source-figure grid min-h-[390px] place-items-center border border-[#E8CE99] bg-[#FFF7E8] p-8 text-center text-sm text-[#8A5B00]"><div><strong className="block">{document.originalFilename}</strong><span className="mt-2 block">{error}</span></div></div>
  return <div className="onur-report-source-figure overflow-hidden border border-[#D8DEE7] bg-white p-2"><PrivateDocumentViewer url={url} mimeType={document.mimeType} pageNumber={Math.max(1, pageNumber)} region={null}/></div>
}
