import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON } from '@/lib/drive'
import { Proyecto } from '@/types'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/proyectos/vincular
// Body: { proyectoId, tipo: 'nota'|'cita'|'documento', itemId, seccionId? }
// Adds itemId to the corresponding project array (no duplicates).
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { proyectoId, tipo, itemId, seccionId } = await req.json() as {
      proyectoId: string
      tipo: 'nota' | 'cita' | 'documento'
      itemId: string
      seccionId?: string
    }

    if (!proyectoId || !tipo || !itemId) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, 'proyectos.json', estructura.proyectosId)
    if (!fileId) return NextResponse.json({ error: 'No hay proyectos' }, { status: 404 })

    const lista = await readJSON<Proyecto[]>(accessToken, fileId)
    const idx = lista.findIndex((p) => p.id === proyectoId)
    if (idx === -1) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

    const proyecto = { ...lista[idx] }

    if (tipo === 'nota') {
      if (!proyecto.notasVinculadas.includes(itemId)) {
        proyecto.notasVinculadas = [...proyecto.notasVinculadas, itemId]
      }
      // Also assign to section if provided
      if (seccionId) {
        proyecto.secciones = proyecto.secciones.map((s) =>
          s.id === seccionId
            ? { ...s, notasAsignadas: [...(s.notasAsignadas ?? []).filter((id) => id !== itemId), itemId] }
            : s
        )
      }
    } else if (tipo === 'cita') {
      if (!proyecto.citasVinculadas.includes(itemId)) {
        proyecto.citasVinculadas = [...proyecto.citasVinculadas, itemId]
      }
      if (seccionId) {
        proyecto.secciones = proyecto.secciones.map((s) =>
          s.id === seccionId
            ? { ...s, citasAsignadas: [...s.citasAsignadas.filter((id) => id !== itemId), itemId] }
            : s
        )
      }
    } else if (tipo === 'documento') {
      if (!proyecto.documentosVinculados.includes(itemId)) {
        proyecto.documentosVinculados = [...proyecto.documentosVinculados, itemId]
      }
    }

    proyecto.actualizadoEn = new Date().toISOString()
    lista[idx] = proyecto
    await writeJSON(accessToken, estructura.proyectosId, 'proyectos.json', lista)

    return NextResponse.json({ ok: true, proyecto })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
