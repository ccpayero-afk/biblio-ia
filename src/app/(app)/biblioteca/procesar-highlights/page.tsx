import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs } from '@/lib/drive'
import ProcesarHighlightsClient from './ProcesarHighlightsClient'

export default async function ProcesarHighlightsPage() {
  const session = await auth()
  const accessToken = getAccessToken(session)
  const estructura = await initUserDrive(accessToken)
  const documentos = await listPDFs(accessToken, estructura.pdfsId)
  const indexados = documentos.filter((d) => d.estado === 'indexado')

  return <ProcesarHighlightsClient documentos={indexados} />
}
