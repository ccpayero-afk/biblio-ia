import { encryptApiKey, decryptApiKey } from './gemini'
import { initUserDrive, findFile, readJSON, writeJSON, listPDFs } from './drive'
import { ConfigUsuario, Documento } from '@/types'

const ZOTERO_API  = 'https://api.zotero.org'
const TAG         = 'BiblioIA'
const ID_PREFIX   = 'BiblioIA-ID:'

// ─── Config storage ───────────────────────────────────────────────────────────

export async function saveZoteroConfig(accessToken: string, userId: string, apiKey: string) {
  const estructura  = await initUserDrive(accessToken)
  const encriptada  = await encryptApiKey(apiKey)
  const configId    = await findFile(accessToken, 'config.json', estructura.rootId)
  const existente   = configId ? await readJSON<ConfigUsuario>(accessToken, configId) : ({ driveInitializado: true, estructura } as ConfigUsuario)
  await writeJSON(accessToken, estructura.rootId, 'config.json', {
    ...existente,
    zoteroUserId: userId,
    zoteroApiKeyEncriptada: encriptada,
  })
}

export async function getZoteroConfig(accessToken: string): Promise<{ userId: string; apiKey: string } | null> {
  try {
    const estructura = await initUserDrive(accessToken)
    const configId   = await findFile(accessToken, 'config.json', estructura.rootId)
    if (!configId) return null
    const config = await readJSON<ConfigUsuario>(accessToken, configId)
    if (!config.zoteroUserId || !config.zoteroApiKeyEncriptada) return null
    return { userId: config.zoteroUserId, apiKey: await decryptApiKey(config.zoteroApiKeyEncriptada) }
  } catch {
    return null
  }
}

// ─── Item mapping ─────────────────────────────────────────────────────────────

function parseCreators(autorStr: string) {
  if (!autorStr.trim()) return []
  return autorStr.split(';').map((a) => {
    const [last, rest] = a.trim().split(',').map((s) => s.trim())
    return { creatorType: 'author', lastName: last || a.trim(), firstName: rest || '' }
  })
}

function mapItem(doc: Documento): Record<string, unknown> {
  const base = {
    title:        doc.titulo ?? doc.nombre.replace(/\.pdf$/i, ''),
    creators:     parseCreators(doc.autor ?? ''),
    abstractNote: doc.abstract ?? '',
    date:         doc.año ?? '',
    url:          doc.url ?? '',
    tags:         [{ tag: TAG }],
    extra:        `${ID_PREFIX} ${doc.id}`,
  }

  switch (doc.tipo) {
    case 'libro':
      return { itemType: 'book',          ...base, publisher: doc.editorial ?? '',                  ISBN:   doc.isbn ?? '' }
    case 'capitulo':
      return { itemType: 'bookSection',   ...base, bookTitle: doc.revista  ?? '', publisher: doc.editorial ?? '', pages: doc.paginas ?? '' }
    case 'tesis':
      return { itemType: 'thesis',        ...base, university: doc.editorial ?? '' }
    default:
      return {
        itemType: 'journalArticle', ...base,
        publicationTitle: doc.revista  ?? '',
        publisher:        doc.editorial ?? '',
        volume:           doc.volumen  ?? '',
        issue:            doc.numero   ?? '',
        pages:            doc.paginas  ?? '',
        DOI:              doc.doi      ?? '',
      }
  }
}

// ─── Fetch existing BiblioIA items ───────────────────────────────────────────

async function fetchExisting(userId: string, apiKey: string): Promise<Map<string, { key: string; version: number }>> {
  const headers = { 'Zotero-API-Key': apiKey, 'Zotero-API-Version': '3' }
  const map = new Map<string, { key: string; version: number }>()
  let start = 0

  while (true) {
    const res = await fetch(
      `${ZOTERO_API}/users/${userId}/items?tag=${encodeURIComponent(TAG)}&limit=100&start=${start}&format=json`,
      { headers }
    )
    if (!res.ok) break
    const items = (await res.json()) as Array<{ key: string; version: number; data: { extra?: string } }>
    if (!Array.isArray(items) || items.length === 0) break

    for (const item of items) {
      const m = item.data?.extra?.match(new RegExp(`${ID_PREFIX}\\s*(\\S+)`))
      if (m) map.set(m[1], { key: item.key, version: item.version })
    }

    if (items.length < 100) break
    start += 100
  }

  return map
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export interface SyncResult {
  creados: number
  actualizados: number
  errores: number
  total: number
}

export async function syncToZotero(accessToken: string): Promise<SyncResult> {
  const config = await getZoteroConfig(accessToken)
  if (!config) throw new Error('Zotero no configurado')

  const { userId, apiKey } = config
  const headers = { 'Zotero-API-Key': apiKey, 'Zotero-API-Version': '3', 'Content-Type': 'application/json' }

  const estructura = await initUserDrive(accessToken)
  const docs = (await listPDFs(accessToken, estructura.pdfsId)).filter((d) => d.titulo || d.autor)

  const existing = await fetchExisting(userId, apiKey)

  const toCreate: Documento[]                                        = []
  const toUpdate: Array<{ doc: Documento; key: string; ver: number }> = []

  for (const doc of docs) {
    const found = existing.get(doc.id)
    if (found) toUpdate.push({ doc, key: found.key, ver: found.version })
    else toCreate.push(doc)
  }

  let creados = 0, actualizados = 0, errores = 0

  // Batch create (max 50 per request)
  for (let i = 0; i < toCreate.length; i += 50) {
    const batch = toCreate.slice(i, i + 50).map(mapItem)
    const res = await fetch(`${ZOTERO_API}/users/${userId}/items`, {
      method: 'POST', headers, body: JSON.stringify(batch),
    })
    if (res.ok) {
      const data = await res.json() as { success?: Record<string, string>; failed?: Record<string, unknown> }
      creados  += Object.keys(data.success ?? {}).length
      errores  += Object.keys(data.failed  ?? {}).length
    } else {
      errores += batch.length
    }
  }

  // Update existing (one by one — Zotero requires version header)
  for (const { doc, key, ver } of toUpdate) {
    const res = await fetch(`${ZOTERO_API}/users/${userId}/items/${key}`, {
      method: 'PATCH',
      headers: { ...headers, 'If-Unmodified-Since-Version': String(ver) },
      body: JSON.stringify(mapItem(doc)),
    })
    if (res.ok || res.status === 204) actualizados++
    else errores++
  }

  return { creados, actualizados, errores, total: docs.length }
}

// ─── Validate credentials ─────────────────────────────────────────────────────

export async function validateZoteroCredentials(userId: string, apiKey: string): Promise<boolean> {
  const res = await fetch(`${ZOTERO_API}/users/${userId}/items?limit=1`, {
    headers: { 'Zotero-API-Key': apiKey, 'Zotero-API-Version': '3' },
  })
  return res.ok
}

// ─── Import from Zotero ───────────────────────────────────────────────────────

export interface ZoteroItem {
  id: string
  titulo: string
  autor: string
  año: string
  tipo: string
  abstract: string
  doi: string
  url: string
  importadoEn: string
}

export interface ZoteroImportResult {
  importados: number
  omitidos: number
  total: number
  items: ZoteroItem[]
}

export async function importFromZotero(accessToken: string): Promise<ZoteroImportResult> {
  const config = await getZoteroConfig(accessToken)
  if (!config) throw new Error('Zotero no configurado')

  const { userId, apiKey } = config
  const headers = { 'Zotero-API-Key': apiKey, 'Zotero-API-Version': '3' }

  // Paginar todos los items
  const todos: Array<{ key: string; data: Record<string, unknown> }> = []
  let start = 0
  while (true) {
    const res = await fetch(`${ZOTERO_API}/users/${userId}/items?format=json&limit=100&start=${start}`, { headers })
    if (!res.ok) break
    const items = await res.json() as Array<{ key: string; data: Record<string, unknown> }>
    if (!Array.isArray(items) || items.length === 0) break
    todos.push(...items)
    if (items.length < 100) break
    start += 100
  }

  // Filtrar attachments y notes
  const filtrados = todos.filter((item) => {
    const tipo = item.data?.itemType as string
    return tipo !== 'attachment' && tipo !== 'note'
  })

  // Mapear a ZoteroItem
  const importadoEn = new Date().toISOString()
  const mapeados: ZoteroItem[] = filtrados.map((item) => {
    const d = item.data
    const creators = (Array.isArray(d.creators) ? d.creators as Array<{ lastName?: string }> : []).slice(0, 3)
    return {
      id: item.key,
      titulo: (d.title as string) ?? '',
      autor: creators.map((c) => c.lastName ?? '').filter(Boolean).join('; '),
      año: ((d.date as string) ?? '').slice(0, 4),
      tipo: (d.itemType as string) ?? '',
      abstract: (d.abstractNote as string) ?? '',
      doi: (d.DOI as string) ?? '',
      url: (d.url as string) ?? '',
      importadoEn,
    }
  })

  // Leer lista existente
  const estructura = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, 'zotero_importados.json', estructura.notasId)
  let existentes: ZoteroItem[] = []
  if (fileId) {
    try { existentes = await readJSON<ZoteroItem[]>(accessToken, fileId) } catch { existentes = [] }
  }

  const existentesIds = new Set(existentes.map((e) => e.id))
  const nuevos = mapeados.filter((m) => !existentesIds.has(m.id))
  const omitidos = mapeados.length - nuevos.length

  if (nuevos.length > 0) {
    await writeJSON(accessToken, estructura.notasId, 'zotero_importados.json', [...existentes, ...nuevos])
  }

  return { importados: nuevos.length, omitidos, total: mapeados.length, items: nuevos }
}
