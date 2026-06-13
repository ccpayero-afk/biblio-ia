import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { importFromZotero, ZoteroItem } from '@/lib/zotero'
import { initUserDrive, findFile, readJSON } from '@/lib/drive'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const result = await importFromZotero(accessToken)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const estructura = await initUserDrive(accessToken)
    const fileId = await findFile(accessToken, 'zotero_importados.json', estructura.notasId)
    if (!fileId) return NextResponse.json([])
    try {
      const lista = await readJSON<ZoteroItem[]>(accessToken, fileId)
      return NextResponse.json(lista)
    } catch {
      return NextResponse.json([])
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
