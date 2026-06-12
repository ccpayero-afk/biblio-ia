import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs } from '@/lib/drive'
import { notFound } from 'next/navigation'
import LectorClient from './LectorClient'

export default async function LectorPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentoId: string }>
  searchParams: Promise<{ pagina?: string; buscar?: string }>
}) {
  const { documentoId } = await params
  const { pagina, buscar } = await searchParams
  const session = await auth()
  const accessToken = getAccessToken(session)

  const estructura = await initUserDrive(accessToken)
  const documentos = await listPDFs(accessToken, estructura.pdfsId)
  const documento = documentos.find((d) => d.id === documentoId)
  if (!documento) notFound()

  const pdfUrl = `/api/drive/pdf/${documentoId}`
  const initialPage = parseInt(pagina ?? '1') || 1

  return <LectorClient documento={documento} pdfUrl={pdfUrl} initialPage={initialPage} initialSearch={buscar} />
}
