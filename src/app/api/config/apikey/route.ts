import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { validateGeminiKey, saveApiKey, hasApiKey } from '@/lib/gemini'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const configurada = await hasApiKey(accessToken)
    return NextResponse.json({ configurada })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const body = await req.json()
    const apiKey = body?.apiKey
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return NextResponse.json({ error: 'API key inválida' }, { status: 400 })
    }

    const resultado = await validateGeminiKey(apiKey.trim())
    if (!resultado.valid) {
      return NextResponse.json(
        { error: `API key rechazada: ${resultado.error ?? 'error desconocido'}` },
        { status: 400 }
      )
    }

    await saveApiKey(accessToken, apiKey.trim())
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[POST /api/config/apikey]', msg)
    return NextResponse.json({ error: `Error del servidor: ${msg}` }, { status: 500 })
  }
}
