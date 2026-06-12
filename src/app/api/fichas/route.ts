import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive } from '@/lib/drive'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)

    const authClient = new google.auth.OAuth2()
    authClient.setCredentials({ access_token: accessToken })
    const drive = google.drive({ version: 'v3', auth: authClient })

    const res = await drive.files.list({
      q: `'${estructura.notasId}' in parents and name contains 'ficha_' and mimeType='application/json' and trashed=false`,
      fields: 'files(name)',
      pageSize: 1000,
    })

    const documentIds = (res.data.files ?? [])
      .map((f) => f.name?.match(/^ficha_(.+)\.json$/)?.[1])
      .filter((id): id is string => Boolean(id))

    return NextResponse.json(documentIds)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
