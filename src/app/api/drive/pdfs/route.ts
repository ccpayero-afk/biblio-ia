import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs, uploadPDF, updateDocumentMetadata, trashPDFs } from '@/lib/drive'
import { removeFromIndex } from '@/lib/indexer'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)
    const documentos = await listPDFs(accessToken, estructura.pdfsId)
    return NextResponse.json(documentos)
  } catch (e) {
    console.error('[GET /api/drive/pdfs]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files.length) {
      return NextResponse.json({ error: 'No se recibieron archivos' }, { status: 400 })
    }

    const estructura = await initUserDrive(accessToken)

    // Duplicate detection
    const existingDocs = await listPDFs(accessToken, estructura.pdfsId)
    const duplicados: { nombre: string; existingId: string }[] = []
    const filesToUpload: File[] = []

    for (const file of files) {
      const normalizedName = file.name.toLowerCase().trim()
      const existing = existingDocs.find((d) => d.nombre.toLowerCase().trim() === normalizedName)
      if (existing) {
        duplicados.push({ nombre: file.name, existingId: existing.id })
      } else {
        filesToUpload.push(file)
      }
    }

    // Only upload non-duplicates
    const ids: string[] = []
    for (let i = 0; i < filesToUpload.length; i++) {
      const fileId = await uploadPDF(accessToken, estructura.pdfsId, filesToUpload[i])
      // carpetaId_0, carpetaId_1 … per-file; or global carpetaId fallback
      const originalIndex = files.indexOf(filesToUpload[i])
      const carpetaId =
        (formData.get(`carpetaId_${originalIndex}`) as string | null) ??
        (formData.get('carpetaId') as string | null)
      if (carpetaId) await updateDocumentMetadata(accessToken, fileId, { carpetaId })
      ids.push(fileId)
    }
    return NextResponse.json({ ok: true, ids, duplicados })
  } catch (e) {
    console.error('[POST /api/drive/pdfs]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { ids } = (await req.json()) as { ids: string[] }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Se requiere un array de IDs' }, { status: 400 })
    }

    // Mandar a papelera en Drive (parallel, best-effort)
    const { ok, errors } = await trashPDFs(accessToken, ids)

    // Limpiar embeddings del índice (best-effort — no bloquea si falla)
    try {
      await removeFromIndex(accessToken, ok)
    } catch { /* embeddings orphaned but harmless */ }

    return NextResponse.json({ ok: ok.length, errors: errors.length })
  } catch (e) {
    console.error('[DELETE /api/drive/pdfs]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
