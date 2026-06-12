import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { syncToZotero } from '@/lib/zotero'
import { NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST() {
  try {
    const session     = await auth()
    const accessToken = getAccessToken(session)
    const resultado   = await syncToZotero(accessToken)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
