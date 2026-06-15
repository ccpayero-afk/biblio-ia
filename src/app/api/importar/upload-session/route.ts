import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'

function normalizarNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9áéíóúüñ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// POST { fileName, fileSize } → { uploadUrl } | { duplicado: { id, nombre } }
// Creates a Google Drive resumable upload session. The client then PUTs the file
// bytes directly to uploadUrl, bypassing Vercel's 4.5 MB request body limit.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { fileName, fileSize } = await req.json() as { fileName: string; fileSize: number }

    const estructura = await initUserDrive(accessToken)

    // Duplicate check before wasting the upload
    const existentes = await listPDFs(accessToken, estructura.pdfsId)
    const nombreNorm = normalizarNombre(fileName)
    const dup = existentes.find((d) => normalizarNombre(d.nombre) === nombreNorm)
    if (dup) {
      return NextResponse.json({ duplicado: { id: dup.id, nombre: dup.nombre } })
    }

    // Initiate resumable upload session with Drive
    const initRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'application/pdf',
          'X-Upload-Content-Length': String(fileSize),
        },
        body: JSON.stringify({ name: fileName, parents: [estructura.pdfsId] }),
      }
    )

    if (!initRes.ok) {
      const err = await initRes.text()
      throw new Error(`Drive upload session: ${initRes.status} ${err.slice(0, 200)}`)
    }

    const uploadUrl = initRes.headers.get('location')
    if (!uploadUrl) throw new Error('Drive no devolvió URL de carga')

    return NextResponse.json({ uploadUrl })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
