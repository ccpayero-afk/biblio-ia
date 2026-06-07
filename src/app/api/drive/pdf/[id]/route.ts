import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { getPDFDownloadUrl } from '@/lib/drive'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const accessToken = getAccessToken(session)
  const { id } = await params

  const url = getPDFDownloadUrl(accessToken, id)
  return NextResponse.json({ url })
}
