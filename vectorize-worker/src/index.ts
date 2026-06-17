interface Env {
  VECTORIZE: VectorizeIndex
  BIBLIO_KV: KVNamespace
  WORKER_SECRET: string
}

interface VectorMetadata {
  documentoId: string
  texto: string
  pagina: number
  documentoNombre: string
  autor: string
  año: string
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function checkAuth(request: Request, env: Env): Response | null {
  const auth = request.headers.get('Authorization')
  if (!auth || auth !== `Bearer ${env.WORKER_SECRET}`) {
    return json({ error: 'Unauthorized' }, 401)
  }
  return null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const authError = checkAuth(request, env)
    if (authError) return authError

    const { pathname } = new URL(request.url)

    try {
      // POST /upsert — inserta vectores y registra IDs en KV por documento
      if (request.method === 'POST' && pathname === '/upsert') {
        const { vectors } = (await request.json()) as {
          vectors: Array<{ id: string; values: number[]; metadata: VectorMetadata }>
        }
        await env.VECTORIZE.upsert(vectors)

        // Agrupar IDs por documentoId y actualizar KV
        const byDoc = new Map<string, string[]>()
        for (const v of vectors) {
          const docId = v.metadata.documentoId
          if (!byDoc.has(docId)) byDoc.set(docId, [])
          byDoc.get(docId)!.push(v.id)
        }
        await Promise.all(
          Array.from(byDoc.entries()).map(async ([docId, newIds]) => {
            const key = `doc:${docId}`
            const existing = await env.BIBLIO_KV.get(key)
            const prev: string[] = existing ? JSON.parse(existing) : []
            const merged = Array.from(new Set([...prev, ...newIds]))
            await env.BIBLIO_KV.put(key, JSON.stringify(merged))
          })
        )

        return json({ inserted: vectors.length })
      }

      // POST /query
      if (request.method === 'POST' && pathname === '/query') {
        const { vector, topK = 8 } = (await request.json()) as {
          vector: number[]
          topK?: number
        }
        const matches = await env.VECTORIZE.query(vector, {
          topK,
          returnMetadata: 'all',
        })
        return json(matches)
      }

      // DELETE /delete-by-doc — elimina todos los fragmentos de un documento via KV
      if (request.method === 'DELETE' && pathname === '/delete-by-doc') {
        const { documentoId } = (await request.json()) as { documentoId: string }
        const key = `doc:${documentoId}`
        const stored = await env.BIBLIO_KV.get(key)
        if (!stored) return json({ deleted: 0 })

        const ids: string[] = JSON.parse(stored)
        if (ids.length > 0) {
          // Vectorize tiene límite por llamada — procesar en lotes de 1000
          const BATCH = 1000
          for (let i = 0; i < ids.length; i += BATCH) {
            await env.VECTORIZE.deleteByIds(ids.slice(i, i + BATCH))
          }
        }
        await env.BIBLIO_KV.delete(key)
        return json({ deleted: ids.length })
      }

      // DELETE /delete — elimina por IDs explícitos (uso interno/migración)
      if (request.method === 'DELETE' && pathname === '/delete') {
        const { ids } = (await request.json()) as { ids: string[] }
        await env.VECTORIZE.deleteByIds(ids)
        return json({ deleted: ids.length })
      }

      return json({ error: 'Not found' }, 404)
    } catch (e) {
      return json({ error: String(e) }, 500)
    }
  },
}
