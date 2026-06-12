import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, findFile, readJSON, writeJSON, updateDocumentMetadata } from '@/lib/drive'
import { FichaLectura, Nota, Cita, Dato } from '@/types'
import { generarIdZettel } from '@/lib/zettel-id'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(req: NextRequest, { params }: { params: Promise<{ documentoId: string }> }) {
  try {
    const { documentoId } = await params
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { documentoNombre, autor, año } = await req.json()

    const estructura = await initUserDrive(accessToken)

    // Leer ficha existente
    const fichaFileId = await findFile(accessToken, `ficha_${documentoId}.json`, estructura.notasId)
    if (!fichaFileId) return NextResponse.json({ error: 'Ficha no encontrada. Generala primero.' }, { status: 404 })
    const ficha = await readJSON<FichaLectura>(accessToken, fichaFileId)

    // Leer notas existentes
    const notasFileId = await findFile(accessToken, 'notas.json', estructura.notasId)
    let notas: Nota[] = []
    if (notasFileId) {
      try { notas = await readJSON<Nota[]>(accessToken, notasFileId) } catch { notas = [] }
    }

    // Leer citas existentes
    const citasFileId = await findFile(accessToken, 'citas.json', estructura.citasId)
    let citas: Cita[] = []
    if (citasFileId) {
      try { citas = await readJSON<Cita[]>(accessToken, citasFileId) } catch { citas = [] }
    }

    // Leer datos estadísticos existentes
    const datosFileId = await findFile(accessToken, 'datos.json', estructura.citasId)
    let datos: Dato[] = []
    if (datosFileId) {
      try { datos = await readJSON<Dato[]>(accessToken, datosFileId) } catch { datos = [] }
    }

    // Verificar si ya se procesó (evitar duplicados)
    const yaProcessado = notas.some(
      (n) => n.documentoOrigenId === documentoId && n.etiquetas.includes('auto-ficha')
    )
    if (yaProcessado) {
      return NextResponse.json({ ok: true, notasCreadas: 0, citasCreadas: 0, saltado: true })
    }

    const ahora = new Date().toISOString()
    const titulo = (documentoNombre ?? '').replace(/\.pdf$/i, '')
    const autorCorto = autor ? autor.split(';')[0].split(',')[0].trim() : 'Desconocido'

    const notasNuevas: Nota[] = []
    const citasNuevas: Cita[] = []
    const datosNuevos: Dato[] = []

    // ── Nota principal: tesis + argumento + posición ──────────────────────────
    const contenidoPrincipal = [
      `**Tesis central:** ${ficha.tesisCentral}`,
      `\n**Argumento principal:** ${ficha.argumentoPrincipal}`,
      ficha.posicionDebate ? `\n**Posición en el debate:** ${ficha.posicionDebate}` : '',
      ficha.limitaciones ? `\n**Limitaciones:** ${ficha.limitaciones}` : '',
      ficha.relevancia ? `\n**Relevancia:** ${ficha.relevancia}` : '',
    ].filter(Boolean).join('\n')

    notasNuevas.push({
      id: generarIdZettel(),
      titulo: `[${autorCorto}${año ? ` ${año}` : ''}] ${ficha.tesisCentral.slice(0, 80)}`,
      contenido: contenidoPrincipal,
      tipo: 'referencia',
      vinculos: [],
      etiquetas: ['auto-ficha'],
      documentoOrigenId: documentoId,
      creadaEn: ahora,
      actualizadaEn: ahora,
    })

    // ── Notas por concepto clave ──────────────────────────────────────────────
    for (const { concepto, definicion } of ficha.conceptosClave ?? []) {
      if (!concepto?.trim()) continue
      notasNuevas.push({
        id: generarIdZettel(),
        titulo: concepto.trim(),
        contenido: `**${concepto.trim()}** (según ${autorCorto}${año ? ` ${año}` : ''})\n\n${definicion}`,
        tipo: 'referencia',
        vinculos: [],
        etiquetas: ['auto-ficha', 'concepto-clave'],
        documentoOrigenId: documentoId,
        creadaEn: ahora,
        actualizadaEn: ahora,
      })
    }

    // ── Citas desde citasDestacadas ───────────────────────────────────────────
    for (const { texto, pagina } of ficha.citasDestacadas ?? []) {
      if (!texto?.trim()) continue

      const formatoAPA = `${autorCorto}${año ? ` (${año})` : ''}, p. ${pagina}.`
      const formatoChicago = `${autor || autorCorto}${año ? `, ${año}` : ''}, ${pagina}.`

      citasNuevas.push({
        id: `cita_${documentoId}_${pagina}_${Math.random().toString(36).slice(2, 6)}`,
        texto: texto.trim(),
        pagina,
        documentoId,
        documentoNombre: titulo,
        autor: autor ?? '',
        año: año ?? '',
        etiquetas: ['auto-ficha'],
        formatoAPA,
        formatoChicago,
        creadaEn: ahora,
      })
    }

    // ── Datos estadísticos de la ficha ────────────────────────────────────────
    for (const { valor, contexto, tematica, pagina } of ficha.datosEstadisticos ?? []) {
      if (!valor?.trim()) continue
      datosNuevos.push({
        id: `dato_${documentoId}_${Math.random().toString(36).slice(2, 8)}`,
        valor: valor.trim(),
        contexto: contexto?.trim() ?? '',
        tematica: tematica?.trim() || 'otro',
        documentoId,
        documentoNombre: titulo,
        autor: autor ?? '',
        año: año ?? '',
        pagina,
        etiquetas: ['auto-ficha'],
        creadoEn: ahora,
      })
    }

    // ── Guardar atomicamente ──────────────────────────────────────────────────
    await writeJSON(accessToken, estructura.notasId, 'notas.json', [...notas, ...notasNuevas])
    await writeJSON(accessToken, estructura.citasId, 'citas.json', [...citas, ...citasNuevas])
    if (datosNuevos.length > 0) {
      await writeJSON(accessToken, estructura.citasId, 'datos.json', [...datos, ...datosNuevos])
    }

    await updateDocumentMetadata(accessToken, documentoId, { fichaGenerada: true })

    return NextResponse.json({
      ok: true,
      notasCreadas: notasNuevas.length,
      citasCreadas: citasNuevas.length,
      datosCreados: datosNuevos.length,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
