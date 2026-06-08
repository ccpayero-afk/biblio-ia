import { google } from 'googleapis'
import { Readable } from 'stream'
import { DriveStructure, Documento } from '@/types'

function getDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return google.drive({ version: 'v3', auth })
}

async function findFolder(drive: ReturnType<typeof google.drive>, name: string, parentId: string): Promise<string | null> {
  const res = await drive.files.list({
    q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id)',
  })
  return res.data.files?.[0]?.id ?? null
}

async function createFolder(drive: ReturnType<typeof google.drive>, name: string, parentId?: string): Promise<string> {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
  })
  return res.data.id!
}

async function getOrCreateFolder(drive: ReturnType<typeof google.drive>, name: string, parentId: string): Promise<string> {
  const existing = await findFolder(drive, name, parentId)
  if (existing) return existing
  return createFolder(drive, name, parentId)
}

export async function initUserDrive(accessToken: string): Promise<DriveStructure> {
  const drive = getDriveClient(accessToken)

  // Find or create root in My Drive
  const rootRes = await drive.files.list({
    q: `name='BibliografíaIA' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`,
    fields: 'files(id)',
  })
  const rootId = rootRes.data.files?.[0]?.id ?? await createFolder(drive, 'BibliografíaIA')

  const [pdfsId, highlightsId, citasId, notasId, conceptosId, proyectosId, indexId] = await Promise.all([
    getOrCreateFolder(drive, 'pdfs', rootId),
    getOrCreateFolder(drive, 'highlights', rootId),
    getOrCreateFolder(drive, 'citas', rootId),
    getOrCreateFolder(drive, 'notas', rootId),
    getOrCreateFolder(drive, 'conceptos', rootId),
    getOrCreateFolder(drive, 'proyectos', rootId),
    getOrCreateFolder(drive, 'index', rootId),
  ])

  return { rootId, pdfsId, highlightsId, citasId, notasId, conceptosId, proyectosId, indexId }
}

export async function listPDFs(accessToken: string, pdfsId: string): Promise<Documento[]> {
  const drive = getDriveClient(accessToken)
  const res = await drive.files.list({
    q: `'${pdfsId}' in parents and mimeType='application/pdf' and trashed=false`,
    fields: 'files(id, name, createdTime, size, description, properties)',
    orderBy: 'createdTime desc',
  })

  return (res.data.files ?? []).map((f) => {
    const props = f.properties ?? {}
    return {
      id: f.id!,
      nombre: f.name ?? 'Sin nombre',
      autor: props.autor ?? '',
      año: props.anio ?? '',
      editorial: props.editorial,
      abstract: props.abstract,
      etiquetas: props.etiquetas ? JSON.parse(props.etiquetas) : [],
      estado: (props.estado as Documento['estado']) ?? 'sin_indexar',
      fragmentos: props.fragmentos ? parseInt(props.fragmentos) : 0,
      indexadoEn: props.indexadoEn,
      creadoEn: f.createdTime ?? new Date().toISOString(),
      fichaGenerada: props.fichaGenerada === 'true',
    }
  })
}

export async function uploadPDF(accessToken: string, pdfsId: string, file: File): Promise<string> {
  const drive = getDriveClient(accessToken)
  const buffer = Buffer.from(await file.arrayBuffer())

  const res = await drive.files.create({
    requestBody: {
      name: file.name,
      parents: [pdfsId],
      properties: {
        autor: '',
        anio: '',
        estado: 'sin_indexar',
        fragmentos: '0',
        fichaGenerada: 'false',
      },
    },
    media: {
      mimeType: 'application/pdf',
      body: Readable.from(buffer),
    },
    fields: 'id',
  })

  return res.data.id!
}

export async function getPDFDownloadUrl(accessToken: string, fileId: string): Promise<string> {
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${accessToken}`
}

export async function updateDocumentMetadata(
  accessToken: string,
  fileId: string,
  metadata: Partial<Pick<Documento, 'autor' | 'año' | 'editorial' | 'abstract' | 'etiquetas' | 'estado' | 'fragmentos' | 'indexadoEn' | 'fichaGenerada'>>
): Promise<void> {
  const drive = getDriveClient(accessToken)
  const properties: Record<string, string> = {}
  if (metadata.autor !== undefined) properties.autor = metadata.autor
  if (metadata.año !== undefined) properties.anio = metadata.año
  if (metadata.editorial !== undefined) properties.editorial = metadata.editorial
  if (metadata.abstract !== undefined) properties.abstract = metadata.abstract
  if (metadata.etiquetas !== undefined) properties.etiquetas = JSON.stringify(metadata.etiquetas)
  if (metadata.estado !== undefined) properties.estado = metadata.estado
  if (metadata.fragmentos !== undefined) properties.fragmentos = String(metadata.fragmentos)
  if (metadata.indexadoEn !== undefined) properties.indexadoEn = metadata.indexadoEn
  if (metadata.fichaGenerada !== undefined) properties.fichaGenerada = String(metadata.fichaGenerada)

  await drive.files.update({ fileId, requestBody: { properties } })
}

export async function readJSON<T>(accessToken: string, fileId: string): Promise<T> {
  const drive = getDriveClient(accessToken)
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'json' })
  return res.data as T
}

export async function writeJSON(accessToken: string, parentId: string, fileName: string, data: unknown): Promise<string> {
  const drive = getDriveClient(accessToken)
  const content = JSON.stringify(data)

  // Check if file already exists
  const existing = await drive.files.list({
    q: `name='${fileName}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id)',
  })
  const existingId = existing.data.files?.[0]?.id

  if (existingId) {
    await drive.files.update({
      fileId: existingId,
      media: { mimeType: 'application/json', body: content },
    })
    return existingId
  }

  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [parentId] },
    media: { mimeType: 'application/json', body: content },
    fields: 'id',
  })
  return res.data.id!
}

export async function findFile(accessToken: string, name: string, parentId: string): Promise<string | null> {
  const drive = getDriveClient(accessToken)
  const res = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id)',
  })
  return res.data.files?.[0]?.id ?? null
}

export async function getOrInitStructure(accessToken: string): Promise<DriveStructure> {
  return initUserDrive(accessToken)
}
