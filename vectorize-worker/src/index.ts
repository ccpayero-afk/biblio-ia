interface Env {
  VECTORIZE: VectorizeIndex
  WORKER_SECRET: string
}

interface VectorMetadata {
  documentoId: string
  texto: string
  pagina: number
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
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const authError = checkAuth(request, env)
    if (authError) return authError

    const { pathname } = new URL(request.url)

    try {
      // POST /upsert
      if (request.method === 'POST' && pathname === '/upsert') {
        const { vectors } = (await request.json()) as {
          vectors: Array<{ id: string; values: number[]; metadata: VectorMetadata }>
        }
        await env.VECTORIZE.upsert(vectors)
        return json({ inserted: vectors.length })
      }

      // POST /query
      if (request.method === 'POST' && pathname === '/query') {
        const { vector, topK = 8, filter } = (await request.json()) as {
          vector: number[]
          topK?: number
          filter?: Record<string, string>
        }
        const matches = await env.VECTORIZE.query(vector, {
          topK,
          returnMetadata: 'all',
          ...(filter ? { filter } : {}),
        })
        return json(matches)
      }

      // DELETE /delete — elimina por IDs
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
