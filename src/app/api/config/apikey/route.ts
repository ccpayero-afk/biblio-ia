import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { validateGeminiKey, addApiKey, removeApiKey, getKeyInfo } from '@/lib/gemini'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const info = await getKeyInfo(accessToken)
    return NextResponse.json({ configurada: info.count > 0, ...info })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)

    const body = await req.json()
    const rawKey = body?.apiKey
    if (!rawKey || typeof rawKey !== 'string') {
      return NextResponse.json({ error: 'API key inválida' }, { status: 400 })
    }
    const apiKey = rawKey.replace(/[\s​-‍﻿ ]/g, '')
    if (apiKey.length < 10) {
      return NextResponse.json({ error: 'API key demasiado corta' }, { status: 400 })
    }

    const resultado = await validateGeminiKey(apiKey)
    if (!resultado.valid) {
      return NextResponse.json({ error: `API key rechazada: ${resultado.error ?? 'error desconocido'}` }, { status: 400 })
    }

    await addApiKey(accessToken, apiKey)
    const info = await getKeyInfo(accessToken)
    return NextResponse.json({ ok: true, ...info })
  } catch (e) {
    console.error('[POST /api/config/apikey]', String(e))
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { index } = await req.json() as { index: number }
    if (typeof index !== 'number') return NextResponse.json({ error: 'Falta index' }, { status: 400 })

    await removeApiKey(accessToken, index)
    const info = await getKeyInfo(accessToken)
    return NextResponse.json({ ok: true, ...info })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
