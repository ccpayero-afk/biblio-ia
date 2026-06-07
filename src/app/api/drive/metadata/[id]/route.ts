import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { updateDocumentMetadata } from '@/lib/drive'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const accessToken = getAccessToken(session)
  const { id } = await params

  const body = await req.json()
  await updateDocumentMetadata(accessToken, id, body)
  return NextResponse.json({ ok: true })
}
