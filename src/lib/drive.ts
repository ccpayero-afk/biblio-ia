import { google } from 'googleapis'
import { Readable } from 'stream'
import { DriveStructure, Documento, Carpeta } from '@/types'

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

// Per-process cache — eliminates redundant Drive API calls within a warm serverless invocation.
const estructuraCache = new Map<string, { value: DriveStructure; ts: number }>()
const ESTRUCTURA_TTL = 5 * 60 * 1000 // 5 minutes

export async function initUserDrive(accessToken: string): Promise<DriveStructure> {
  const cached = estructuraCache.get(accessToken)
  if (cached && Date.now() - cached.ts < ESTRUCTURA_TTL) return cached.value

  const drive = getDriveClient(accessToken)

  // Find or create root in My Drive
  const rootRes = await drive.files.list({
    q: `name='BibliografíaIA' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`,
    fields: 'files(id)',
  })
  const rootId = rootRes.data.files?.[0]?.id ?? await createFolder(drive, 'BibliografíaIA')

  const [pdfsId, highlightsId, citasId, notasId, conceptosId, proyectosId, indexId, carpetasId, porLeerFolderId] = await Promise.all([
    getOrCreateFolder(drive, 'pdfs', rootId),
    getOrCreateFolder(drive, 'highlights', rootId),
    getOrCreateFolder(drive, 'citas', rootId),
    getOrCreateFolder(drive, 'notas', rootId),
    getOrCreateFolder(drive, 'conceptos', rootId),
    getOrCreateFolder(drive, 'proyectos', rootId),
    getOrCreateFolder(drive, 'index', rootId),
    getOrCreateFolder(drive, 'carpetas', rootId),
    getOrCreateFolder(drive, 'por-leer', rootId),
  ])

  const value = { rootId, pdfsId, highlightsId, citasId, notasId, conceptosId, proyectosId, indexId, carpetasId, porLeerFolderId }
  estructuraCache.set(accessToken, { value, ts: Date.now() })
  return value
}

export async function listPDFs(accessToken: string, pdfsId: string): Promise<Documento[]> {
  const drive = getDriveClient(accessToken)

  // Google Drive returns max 1000 per page — paginate to get all files
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allFiles: any[] = []
  let pageToken: string | undefined = undefined

  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await drive.files.list({
      q: `'${pdfsId}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: 'nextPageToken, files(id, name, createdTime, size, description, properties)',
      orderBy: 'createdTime desc',
      pageSize: 1000,
      pageToken,
    })
    allFiles.push(...(res.data.files ?? []))
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return allFiles.map((f) => {
    const props = f.properties ?? {}
    return {
      id: f.id!,
      nombre: f.name ?? 'Sin nombre',
      titulo: props.titulo || undefined,
      autor: props.autor ?? '',
      año: props.anio ?? '',
      tipo: (props.tipo as Documento['tipo']) || undefined,
      revista: props.revista || undefined,
      editorial: props.editorial || undefined,
      volumen: props.volumen || undefined,
      numero: props.numero || undefined,
      paginas: props.paginas || undefined,
      url: props.url || undefined,
      doi: props.doi || undefined,
      isbn: props.isbn || undefined,
      abstract: props.abstract || undefined,
      etiquetas: props.etiquetas ? JSON.parse(props.etiquetas) : [],
      estado: (props.estado === 'indexando' ? 'sin_indexar' : props.estado ?? 'sin_indexar') as Documento['estado'],
      fragmentos: props.fragmentos ? parseInt(props.fragmentos) : 0,
      indexadoEn: props.indexadoEn,
      creadoEn: f.createdTime ?? new Date().toISOString(),
      fichaGenerada: props.fichaGenerada === 'true',
      carpetaId: props.carpetaId || undefined,
    }
  })
}

export async function uploadPDF(accessToken: string, pdfsId: string, file: File): Promise<string> {
  const drive = getDriveClient(accessToken)
  const buffer = Buffer.from(await file.arrayBuffer())

  const res = await drive.files.create({
    requestBody: {
      name: file.name.split('/').pop() ?? file.name,
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
  metadata: Partial<Pick<Documento,
    'nombre' | 'titulo' | 'autor' | 'año' | 'tipo' | 'revista' | 'editorial' |
    'volumen' | 'numero' | 'paginas' | 'url' | 'doi' | 'isbn' | 'abstract' |
    'etiquetas' | 'estado' | 'fragmentos' | 'indexadoEn' | 'fichaGenerada' | 'carpetaId'
  >>
): Promise<void> {
  const drive = getDriveClient(accessToken)
  const properties: Record<string, string> = {}
  if (metadata.titulo !== undefined) properties.titulo = metadata.titulo
  if (metadata.autor !== undefined) properties.autor = metadata.autor
  if (metadata.año !== undefined) properties.anio = metadata.año
  if (metadata.tipo !== undefined) properties.tipo = metadata.tipo
  if (metadata.revista !== undefined) properties.revista = metadata.revista
  if (metadata.editorial !== undefined) properties.editorial = metadata.editorial
  if (metadata.volumen !== undefined) properties.volumen = metadata.volumen
  if (metadata.numero !== undefined) properties.numero = metadata.numero
  if (metadata.paginas !== undefined) properties.paginas = metadata.paginas
  if (metadata.url !== undefined) properties.url = metadata.url
  if (metadata.doi !== undefined) properties.doi = metadata.doi
  if (metadata.isbn !== undefined) properties.isbn = metadata.isbn
  if (metadata.abstract !== undefined) properties.abstract = metadata.abstract
  if (metadata.etiquetas !== undefined) properties.etiquetas = JSON.stringify(metadata.etiquetas)
  if (metadata.estado !== undefined) properties.estado = metadata.estado
  if (metadata.fragmentos !== undefined) properties.fragmentos = String(metadata.fragmentos)
  if (metadata.indexadoEn !== undefined) properties.indexadoEn = metadata.indexadoEn
  if (metadata.fichaGenerada !== undefined) properties.fichaGenerada = String(metadata.fichaGenerada)
  if (metadata.carpetaId !== undefined) properties.carpetaId = metadata.carpetaId ?? ''

  const requestBody: Record<string, unknown> = { properties }
  if (metadata.nombre !== undefined) {
    // Preservar extensión .pdf al renombrar
    const nuevoNombre = metadata.nombre.trim()
    requestBody.name = nuevoNombre.toLowerCase().endsWith('.pdf') ? nuevoNombre : `${nuevoNombre}.pdf`
  }

  await drive.files.update({ fileId, requestBody })
}

// ─── Carpetas ─────────────────────────────────────────────────────────────────

const CARPETAS_FILE = 'carpetas.json'

export async function readCarpetas(accessToken: string): Promise<Carpeta[]> {
  const estructura = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, CARPETAS_FILE, estructura.carpetasId!)
  if (!fileId) return []
  try {
    return await readJSON<Carpeta[]>(accessToken, fileId)
  } catch {
    return []
  }
}

export async function saveCarpetas(accessToken: string, carpetas: Carpeta[]): Promise<void> {
  const estructura = await initUserDrive(accessToken)
  await writeJSON(accessToken, estructura.carpetasId!, CARPETAS_FILE, carpetas)
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

export async function listFilesInFolder(
  accessToken: string,
  parentId: string,
  nameContains: string
): Promise<{ id: string; name: string }[]> {
  const drive = getDriveClient(accessToken)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allFiles: { id: string; name: string }[] = []
  let pageToken: string | undefined = undefined
  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await drive.files.list({
      q: `name contains '${nameContains}' and '${parentId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 1000,
      pageToken,
    })
    for (const f of res.data.files ?? []) {
      allFiles.push({ id: f.id!, name: f.name! })
    }
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)
  return allFiles
}

export async function trashPDF(accessToken: string, fileId: string): Promise<void> {
  const drive = getDriveClient(accessToken)
  await drive.files.update({ fileId, requestBody: { trashed: true } })
}

export async function trashPDFs(
  accessToken: string,
  fileIds: string[]
): Promise<{ ok: string[]; errors: string[] }> {
  const results = await Promise.allSettled(fileIds.map((id) => trashPDF(accessToken, id)))
  const ok: string[] = []
  const errors: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') ok.push(fileIds[i])
    else errors.push(fileIds[i])
  })
  return { ok, errors }
}
