import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs, getPDFDownloadUrl } from '@/lib/drive'
import { notFound } from 'next/navigation'
import LectorClient from './LectorClient'

export default async function LectorPage({ params }: { params: Promise<{ documentoId: string }> }) {
  const { documentoId } = await params
  const session = await auth()
  const accessToken = getAccessToken(session)

  const estructura = await initUserDrive(accessToken)
  const documentos = await listPDFs(accessToken, estructura.pdfsId)
  const documento = documentos.find((d) => d.id === documentoId)
  if (!documento) notFound()

  const pdfUrl = await getPDFDownloadUrl(accessToken, documentoId)

  return <LectorClient documento={documento} pdfUrl={pdfUrl} />
}
