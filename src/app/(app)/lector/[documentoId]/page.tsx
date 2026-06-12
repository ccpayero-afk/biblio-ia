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
  // Buscar en Biblioteca Y en Sala de Lectura (por-leer)
  const [docsbibl, docsPorLeer] = await Promise.all([
    listPDFs(accessToken, estructura.pdfsId),
    estructura.porLeerFolderId ? listPDFs(accessToken, estructura.porLeerFolderId) : Promise.resolve([]),
  ])
  const documento = [...docsbibl, ...docsPorLeer].find((d) => d.id === documentoId)
  if (!documento) notFound()

  const pdfUrl = `/api/drive/pdf/${documentoId}`
  const initialPage = parseInt(pagina ?? '1') || 1

  return <LectorClient documento={documento} pdfUrl={pdfUrl} initialPage={initialPage} initialSearch={buscar} />
}
