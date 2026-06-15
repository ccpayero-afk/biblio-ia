import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON } from '@/lib/drive'
import { Nota } from '@/types'
import { leerIndice, aLigera, escribirIndice, escribirContenido } from '@/lib/notas'
import { NextResponse } from 'next/server'

export const maxDuration = 60

// POST /api/notas/migrar
// One-time migration: reads old monolithic notas.json and splits each entry into:
//   - lean index entry (notas.json without contenido/versiones)
//   - content file nota_{id}.json
// Safe to run multiple times (skips notes that already have a content file).
export async function POST() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const estructura = await initUserDrive(accessToken)

    // Read the old monolithic file directly (bypasses the lean index)
    const oldFileId = await findFile(accessToken, 'notas.json', estructura.notasId)
    if (!oldFileId) return NextResponse.json({ ok: true, migradas: 0, saltadas: 0 })

    const viejas = await readJSON<Nota[]>(accessToken, oldFileId).catch(() => [] as Nota[])
    if (viejas.length === 0) return NextResponse.json({ ok: true, migradas: 0, saltadas: 0 })

    const { notasId, indice } = await leerIndice(accessToken)

    let migradas = 0
    let saltadas = 0

    // Determine which notes already have a content file (already migrated)
    const yaConArchivo = new Set<string>()
    await Promise.all(
      viejas.map(async (n) => {
        const exists = await findFile(accessToken, `nota_${n.id}.json`, notasId)
        if (exists) yaConArchivo.add(n.id)
      })
    )

    const nuevasContenidos: Nota[] = []
    for (const nota of viejas) {
      if (yaConArchivo.has(nota.id)) {
        saltadas++
        continue
      }
      nuevasContenidos.push(nota)
    }

    if (nuevasContenidos.length === 0) {
      return NextResponse.json({ ok: true, migradas: 0, saltadas })
    }

    // Write content files in batches of 10 to avoid overwhelming Drive
    const BATCH = 10
    for (let i = 0; i < nuevasContenidos.length; i += BATCH) {
      const lote = nuevasContenidos.slice(i, i + BATCH)
      await Promise.all(
        lote.map((n) =>
          escribirContenido(accessToken, notasId, n.id, {
            contenido: n.contenido ?? '',
            versiones: n.versiones ?? [],
          })
        )
      )
      migradas += lote.length
    }

    // Rewrite lean index from all viejas (strip contenido + versiones)
    // Merge with any entries already in the current index that aren't in viejas
    const viejasIds = new Set(viejas.map((n) => n.id))
    const extraEntries = indice.filter((n) => !viejasIds.has(n.id))
    const nuevoIndice = [...viejas.map(aLigera), ...extraEntries]
    await escribirIndice(accessToken, notasId, nuevoIndice)

    return NextResponse.json({ ok: true, migradas, saltadas, total: viejas.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
