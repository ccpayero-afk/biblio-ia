import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs, findFile, readJSON } from '@/lib/drive'
import { google } from 'googleapis'
import DashboardView from './DashboardView'
import type { Nota, Proyecto, Cita } from '@/types'

export default async function DashboardPage() {
  const session = await auth()
  const accessToken = getAccessToken(session)
  const nombre = session?.user?.name?.split(' ')[0] ?? 'Investigador'

  let docCount = 0, indexados = 0, fichaCount = 0, notaCount = 0, proyectoCount = 0
  let docsNoIndexados = 0, docsSinFicha = 0, notasEfimeras = 0, proyectosSinBorrador = 0
  let notasEstaSemana = 0, citasEstaSemana = 0

  try {
    const estructura = await initUserDrive(accessToken)

    const authClient = new google.auth.OAuth2()
    authClient.setCredentials({ access_token: accessToken })
    const drive = google.drive({ version: 'v3', auth: authClient })

    // Fetch all counts in parallel (one Drive init → multiple parallel requests)
    const [documentos, fichasRes, notasFileId, proyectosFileId] = await Promise.all([
      listPDFs(accessToken, estructura.pdfsId),
      drive.files.list({
        q: `'${estructura.notasId}' in parents and name contains 'ficha_' and mimeType='application/json' and trashed=false`,
        fields: 'files(name)',
        pageSize: 1000,
      }),
      findFile(accessToken, 'notas.json', estructura.notasId),
      findFile(accessToken, 'proyectos.json', estructura.proyectosId),
    ])

    docCount = documentos.length
    indexados = documentos.filter((d) => d.estado === 'indexado').length
    fichaCount = (fichasRes.data.files ?? []).length

    const [notasData, proyectosData] = await Promise.all([
      notasFileId ? readJSON<unknown[]>(accessToken, notasFileId) : Promise.resolve([]),
      proyectosFileId ? readJSON<unknown[]>(accessToken, proyectosFileId) : Promise.resolve([]),
    ])
    notaCount = Array.isArray(notasData) ? notasData.length : 0
    proyectoCount = Array.isArray(proyectosData) ? proyectosData.length : 0

    docsNoIndexados = docCount - indexados
    docsSinFicha = Math.max(0, indexados - fichaCount)
    notasEfimeras = Array.isArray(notasData)
      ? (notasData as Nota[]).filter((n) => n.tipo === 'efimera').length
      : 0
    proyectosSinBorrador = Array.isArray(proyectosData)
      ? (proyectosData as Proyecto[]).filter(
          (p) => !p.secciones?.some((s) => s.borrador?.trim())
        ).length
      : 0

    const hace7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    notasEstaSemana = Array.isArray(notasData)
      ? (notasData as (Nota & { eliminadaEn?: string })[]).filter(
          (n) => !n.eliminadaEn && n.creadaEn >= hace7Dias
        ).length
      : 0

    const citasFileId = await findFile(accessToken, 'citas.json', estructura.citasId)
    if (citasFileId) {
      const citasData = await readJSON<unknown[]>(accessToken, citasFileId)
      citasEstaSemana = Array.isArray(citasData)
        ? (citasData as Cita[]).filter((c) => c.creadaEn && c.creadaEn >= hace7Dias).length
        : 0
    }

  } catch {
    // Drive API unavailable — show zeros gracefully
  }

  return (
    <DashboardView
      nombre={nombre}
      docCount={docCount}
      indexados={indexados}
      fichaCount={fichaCount}
      notaCount={notaCount}
      proyectoCount={proyectoCount}
      docsNoIndexados={docsNoIndexados}
      docsSinFicha={docsSinFicha}
      notasEfimeras={notasEfimeras}
      proyectosSinBorrador={proyectosSinBorrador}
      notasEstaSemana={notasEstaSemana}
      citasEstaSemana={citasEstaSemana}
    />
  )
}
