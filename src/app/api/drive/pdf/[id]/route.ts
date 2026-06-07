import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params

    const driveUrl = `https://www.googleapis.com/drive/v3/files/${id}?alt=media`
    const res = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Drive error: ${res.status}` }, { status: res.status })
    }

    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
