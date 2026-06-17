#!/usr/bin/env tsx
/**
 * Migración: Google Drive emb_*.json → Cloudflare Vectorize
 *
 * Variables de entorno requeridas:
 *   MIGRATION_ACCESS_TOKEN  — Google OAuth access token del usuario
 *   VECTORIZE_WORKER_URL    — URL del Worker (ej: https://biblio-ia-vectorize.X.workers.dev)
 *   WORKER_SECRET           — secret de autenticación del Worker
 *
 * Flags:
 *   --dry-run   Solo cuenta archivos y fragmentos, no sube nada
 *
 * Uso:
 *   npx tsx scripts/migrate-to-vectorize.ts
 *   npx tsx scripts/migrate-to-vectorize.ts --dry-run
 */

const DRY_RUN = process.argv.includes('--dry-run')

const ACCESS_TOKEN = process.env.MIGRATION_ACCESS_TOKEN
const WORKER_URL = process.env.VECTORIZE_WORKER_URL?.replace(/\/$/, '')
const SECRET = process.env.WORKER_SECRET

if (!ACCESS_TOKEN) { console.error('Error: MIGRATION_ACCESS_TOKEN requerido'); process.exit(1) }
if (!WORKER_URL) { console.error('Error: VECTORIZE_WORKER_URL requerido'); process.exit(1) }
if (!DRY_RUN && !SECRET) { console.error('Error: WORKER_SECRET requerido (o usá --dry-run)'); process.exit(1) }

// ── Tipos ────────────────────────────────────────────────────────────────────

interface DriveFile { id: string; name: string }

interface Fragmento {
  id: string
  documentoId: string
  texto: string
  pagina: number
  embedding: number[]
}

interface DocMeta {
  nombre: string
  autor: string
  año: string
}

// ── Drive helpers (fetch directo — sin googleapis) ────────────────────────────

async function driveRequest<T>(path: string): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Drive API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

async function findFolder(name: string, parentId?: string): Promise<string | null> {
  const parentClause = parentId ? `'${parentId}' in parents and ` : `'root' in parents and `
  const q = `${parentClause}name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const res = await driveRequest<{ files: DriveFile[] }>(
    `/files?q=${encodeURIComponent(q)}&fields=files(id)`
  )
  return res.files[0]?.id ?? null
}

async function listFilesInFolder(folderId: string, nameContains: string): Promise<DriveFile[]> {
  const all: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const q = `'${folderId}' in parents and name contains '${nameContains}' and trashed=false`
    const params = new URLSearchParams({
      q,
      fields: 'nextPageToken,files(id,name)',
      pageSize: '1000',
      ...(pageToken ? { pageToken } : {}),
    })
    const res = await driveRequest<{ files: DriveFile[]; nextPageToken?: string }>(
      `/files?${params}`
    )
    all.push(...res.files)
    pageToken = res.nextPageToken
  } while (pageToken)

  return all
}

async function readJSON<T>(fileId: string): Promise<T> {
  return driveRequest<T>(`/files/${fileId}?alt=media`)
}

async function getDriveFolders(): Promise<{ indexId: string; pdfsId: string }> {
  const rootId = await findFolder('BibliografíaIA')
  if (!rootId) throw new Error("No se encontró la carpeta 'BibliografíaIA' en My Drive")
  const [indexId, pdfsId] = await Promise.all([
    findFolder('index', rootId),
    findFolder('pdfs', rootId),
  ])
  if (!indexId) throw new Error("No se encontró la subcarpeta 'index' dentro de BibliografíaIA")
  if (!pdfsId) throw new Error("No se encontró la subcarpeta 'pdfs' dentro de BibliografíaIA")
  return { indexId, pdfsId }
}

async function listDocMetadata(pdfsId: string): Promise<Map<string, DocMeta>> {
  const all: Array<{ id: string; name: string; properties?: Record<string, string> }> = []
  let pageToken: string | undefined

  do {
    const q = `'${pdfsId}' in parents and mimeType='application/pdf' and trashed=false`
    const params = new URLSearchParams({
      q,
      fields: 'nextPageToken,files(id,name,properties)',
      pageSize: '1000',
      ...(pageToken ? { pageToken } : {}),
    })
    const res = await driveRequest<{
      files: Array<{ id: string; name: string; properties?: Record<string, string> }>
      nextPageToken?: string
    }>(`/files?${params}`)
    all.push(...res.files)
    pageToken = res.nextPageToken
  } while (pageToken)

  const map = new Map<string, DocMeta>()
  for (const f of all) {
    map.set(f.id, {
      nombre: f.name ?? '',
      autor: f.properties?.autor ?? '',
      año: f.properties?.anio ?? '',
    })
  }
  return map
}

// ── Vectorize helpers ─────────────────────────────────────────────────────────

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function upsertBatch(
  vectors: Array<{ id: string; values: number[]; metadata: { documentoId: string; texto: string; pagina: number; documentoNombre: string; autor: string; año: string } }>
): Promise<void> {
  const MAX_RETRIES = 3
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(`${WORKER_URL}/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SECRET}`,
      },
      body: JSON.stringify({ vectors }),
    })
    if (res.ok) return
    const text = await res.text()
    if ((res.status !== 503 && res.status !== 429) || attempt === MAX_RETRIES - 1) {
      throw new Error(`Worker upsert ${res.status}: ${text.slice(0, 200)}`)
    }
    await sleep(300 * Math.pow(2, attempt)) // 300ms, 600ms, 1200ms
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 BiblioIA → Vectorize${DRY_RUN ? ' (DRY RUN — no se subirá nada)' : ''}`)
  console.log('─'.repeat(55))

  console.log('📁 Obteniendo estructura de Drive...')
  const { indexId, pdfsId } = await getDriveFolders()
  console.log(`   indexId: ${indexId}`)

  console.log('📋 Cargando metadatos de documentos...')
  const docMetaMap = await listDocMetadata(pdfsId)
  console.log(`   Documentos encontrados: ${docMetaMap.size}`)

  console.log('📋 Listando archivos emb_*...')
  const archivos = await listFilesInFolder(indexId, 'emb_')
  console.log(`   Encontrados: ${archivos.length} archivos\n`)

  if (archivos.length === 0) {
    console.log('⚠️  No hay archivos emb_ para migrar.')
    return
  }

  let fragmentosTotal = 0
  let archivosOk = 0
  let archivosError = 0
  const FILE_BATCH = 1     // secuencial — evita saturar Vectorize
  const VEC_BATCH = 50     // vectores por request — más chico evita 503 en archivos grandes
  const VEC_PAUSE = 50     // ms entre batches del mismo archivo
  const VEC_DIMS  = 1536   // Vectorize máx 1536; truncamos desde 3072 (matryoshka)

  for (let i = 0; i < archivos.length; i += FILE_BATCH) {
    const lote = archivos.slice(i, i + FILE_BATCH)

    await Promise.all(lote.map(async (archivo) => {
      try {
        const fragmentos = await readJSON<Fragmento[]>(archivo.id)
        if (!Array.isArray(fragmentos) || fragmentos.length === 0) return

        fragmentosTotal += fragmentos.length

        if (!DRY_RUN) {
          const docId = fragmentos[0]?.documentoId ?? ''
          const meta = docMetaMap.get(docId) ?? { nombre: '', autor: '', año: '' }
          const vectors = fragmentos.map((f) => ({
            id: f.id,
            values: f.embedding.slice(0, VEC_DIMS),
            metadata: {
              documentoId: f.documentoId,
              texto: f.texto.slice(0, 500),
              pagina: f.pagina,
              documentoNombre: meta.nombre,
              autor: meta.autor,
              año: meta.año,
            },
          }))

          for (let j = 0; j < vectors.length; j += VEC_BATCH) {
            await upsertBatch(vectors.slice(j, j + VEC_BATCH))
            if (j + VEC_BATCH < vectors.length) await sleep(VEC_PAUSE)
          }
        }

        archivosOk++
        process.stdout.write(
          `\r   ${DRY_RUN ? '🔍' : '✓'} ${archivosOk + archivosError}/${archivos.length} archivos | ${fragmentosTotal} fragmentos`
        )
      } catch (e) {
        archivosError++
        console.error(`\n   ✗ Error en ${archivo.name}: ${e}`)
      }
    }))
  }

  console.log(`\n\n${DRY_RUN ? '📊 Conteo' : '✅ Migración completada'}:`)
  console.log(`   Archivos procesados: ${archivosOk}`)
  if (archivosError > 0) console.log(`   Archivos con error:  ${archivosError}`)
  console.log(`   Fragmentos totales:  ${fragmentosTotal}`)
  if (!DRY_RUN) console.log('\n   Podés verificar en: https://dash.cloudflare.com → Workers → Vectorize → biblio-ia-embeddings')
}

main().catch((e) => {
  console.error('\nFatal:', e)
  process.exit(1)
})
