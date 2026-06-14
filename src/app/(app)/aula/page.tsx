import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs } from '@/lib/drive'
import AulaClient from './AulaClient'

export const metadata = { title: 'Aula IA — BiblioIA' }

export default async function AulaPage() {
  const session = await auth()
  const accessToken = getAccessToken(session)
  const estructura = await initUserDrive(accessToken)
  const documentos = await listPDFs(accessToken, estructura.pdfsId)

  return <AulaClient documentos={documentos} />
}
