import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive } from '@/lib/drive'
import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentoId: string }> }
) {
  const session = await auth()
  const accessToken = getAccessToken(session)
  const { documentoId } = await params
  const body = await req.json().catch(() => ({}))
  const { carpetaId } = body  // optional: assign to a library folder

  const estructura = await initUserDrive(accessToken)

  const auth2 = new google.auth.OAuth2()
  auth2.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth: auth2 })

  // Move file: add pdfsId as parent, remove porLeerFolderId
  await drive.files.update({
    fileId: documentoId,
    addParents: estructura.pdfsId,
    removeParents: estructura.porLeerFolderId,
    requestBody: carpetaId ? { properties: { carpetaId } } : {},
    fields: 'id, parents',
  })

  return NextResponse.json({ ok: true })
}
