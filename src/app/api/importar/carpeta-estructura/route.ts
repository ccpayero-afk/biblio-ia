import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { readCarpetas, saveCarpetas } from '@/lib/drive'
import { Carpeta } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

const COLORES: Carpeta['color'][] = ['blue', 'purple', 'teal', 'green', 'amber', 'coral', 'gray']

// POST /api/importar/carpeta-estructura
// Body: { rutas: string[], padreId?: string }
//   rutas = webkitRelativePath of each file (e.g. "Metodo/Cuali/paper.pdf")
// Returns: { mapa: Record<string, string> }  — folderPath → carpetaId
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { rutas, padreId } = await req.json() as { rutas: string[]; padreId?: string }

    // Extract unique folder paths (strip filename = last segment)
    const carpetaSet = new Set<string>()
    for (const ruta of rutas) {
      const partes = ruta.split('/')
      for (let depth = 1; depth < partes.length; depth++) {
        carpetaSet.add(partes.slice(0, depth).join('/'))
      }
    }

    // Sort by depth so parents are created before children
    const sorted = Array.from(carpetaSet).sort((a, b) => {
      const diff = a.split('/').length - b.split('/').length
      return diff !== 0 ? diff : a.localeCompare(b)
    })

    const carpetas = await readCarpetas(accessToken)
    const mapa: Record<string, string> = {}
    let counter = 0

    for (const path of sorted) {
      const partes = path.split('/')
      const nombre = partes[partes.length - 1]
      const parentPath = partes.length > 1 ? partes.slice(0, -1).join('/') : null
      const carpetaPadreId = parentPath ? mapa[parentPath] : padreId

      const id = `c${Date.now()}${(counter++).toString().padStart(3, '0')}${Math.random().toString(36).slice(2, 5)}`
      const depth = partes.length - 1
      const nueva: Carpeta = {
        id,
        nombre,
        color: COLORES[depth % COLORES.length],
        carpetaPadreId,
        documentosIds: [],
        subcarpetasIds: [],
        creadaEn: new Date().toISOString(),
        actualizadaEn: new Date().toISOString(),
        orden: carpetas.length + counter,
      }

      // Register in parent's subcarpetasIds
      if (carpetaPadreId) {
        const parentIdx = carpetas.findIndex((c) => c.id === carpetaPadreId)
        if (parentIdx !== -1) {
          carpetas[parentIdx] = {
            ...carpetas[parentIdx],
            subcarpetasIds: [...carpetas[parentIdx].subcarpetasIds, id],
          }
        }
      }

      carpetas.push(nueva)
      mapa[path] = id
    }

    await saveCarpetas(accessToken, carpetas)
    return NextResponse.json({ mapa })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
