import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { getZoteroConfig, saveZoteroConfig, validateZoteroCredentials } from '@/lib/zotero'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const session    = await auth()
    const accessToken = getAccessToken(session)
    const config     = await getZoteroConfig(accessToken)
    return NextResponse.json({ configurado: !!config, userId: config?.userId ?? null })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session     = await auth()
    const accessToken = getAccessToken(session)
    const { userId, apiKey } = (await req.json()) as { userId?: string; apiKey?: string }

    if (!userId?.trim() || !apiKey?.trim()) {
      return NextResponse.json({ error: 'userId y apiKey son requeridos' }, { status: 400 })
    }

    const ok = await validateZoteroCredentials(userId.trim(), apiKey.trim())
    if (!ok) {
      return NextResponse.json({ error: 'Credenciales inválidas. Verificá tu User ID y API key en zotero.org.' }, { status: 400 })
    }

    await saveZoteroConfig(accessToken, userId.trim(), apiKey.trim())
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
