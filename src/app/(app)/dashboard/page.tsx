import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs } from '@/lib/drive'
import DashboardView from './DashboardView'

export default async function DashboardPage() {
  const session = await auth()
  const accessToken = getAccessToken(session)
  const nombre = session?.user?.name?.split(' ')[0] ?? 'Investigador'

  let docCount = 0
  let indexados = 0
  try {
    const estructura = await initUserDrive(accessToken)
    const documentos = await listPDFs(accessToken, estructura.pdfsId)
    docCount = documentos.length
    indexados = documentos.filter((d) => d.estado === 'indexado').length
  } catch {
    // Drive API unavailable — show zeros gracefully
  }

  return <DashboardView nombre={nombre} docCount={docCount} indexados={indexados} />
}
