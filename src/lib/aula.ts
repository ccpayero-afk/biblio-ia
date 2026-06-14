import { google } from 'googleapis'
import { initUserDrive, readJSON, findFile } from './drive'
import type { Curso, Fragmento } from '@/types'

function getDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return google.drive({ version: 'v3', auth })
}

export interface CursoResumen {
  id: string
  libroTitulo: string
  libroAutor: string
  moduloActual: number
  totalModulos: number
  creadoEn: string
}

export async function listarCursos(accessToken: string): Promise<CursoResumen[]> {
  const estructura = await initUserDrive(accessToken)
  if (!estructura.cursosId) return []

  const drive = getDriveClient(accessToken)
  const res = await drive.files.list({
    q: `'${estructura.cursosId}' in parents and trashed=false`,
    fields: 'files(id)',
    orderBy: 'modifiedTime desc',
    pageSize: 50,
  })

  const files = res.data.files ?? []
  const resultados = await Promise.allSettled(
    files.map(async (f) => {
      const curso = await readJSON<Curso>(accessToken, f.id!)
      return {
        id: f.id!,
        libroTitulo: curso.libroTitulo || curso.libroNombre,
        libroAutor: curso.libroAutor,
        moduloActual: curso.moduloActual,
        totalModulos: curso.plan.length,
        creadoEn: curso.creadoEn,
      } as CursoResumen
    })
  )

  return resultados
    .filter((r): r is PromiseFulfilledResult<CursoResumen> => r.status === 'fulfilled')
    .map((r) => r.value)
}

export async function cargarCurso(accessToken: string, fileId: string): Promise<Curso> {
  return readJSON<Curso>(accessToken, fileId)
}

export async function guardarCurso(accessToken: string, curso: Curso, fileId?: string): Promise<string> {
  const estructura = await initUserDrive(accessToken)
  if (!estructura.cursosId) throw new Error('No se pudo inicializar la carpeta de cursos')

  const drive = getDriveClient(accessToken)
  const data = { ...curso, actualizadoEn: new Date().toISOString() }
  const content = JSON.stringify(data)

  if (fileId) {
    await drive.files.update({
      fileId,
      media: { mimeType: 'application/json', body: content },
    })
    return fileId
  }

  const nombre = `curso_${curso.libroId}_${Date.now()}.json`
  const res = await drive.files.create({
    requestBody: { name: nombre, parents: [estructura.cursosId] },
    media: { mimeType: 'application/json', body: content },
    fields: 'id',
  })
  return res.data.id!
}

export async function eliminarCurso(accessToken: string, fileId: string): Promise<void> {
  const drive = getDriveClient(accessToken)
  await drive.files.delete({ fileId })
}

export async function getSampleChunks(
  accessToken: string,
  libroId: string,
  indexId: string
): Promise<string[]> {
  const fileId = await findFile(accessToken, `emb_${libroId}.json`, indexId)
  if (!fileId) return []
  try {
    const fragmentos = await readJSON<Fragmento[]>(accessToken, fileId)
    const step = Math.max(1, Math.floor(fragmentos.length / 20))
    return fragmentos
      .filter((_, i) => i % step === 0)
      .slice(0, 20)
      .map((f) => f.texto)
  } catch {
    return []
  }
}
