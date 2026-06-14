import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params

    // Proxy the PDF bytes — PDF.js workers cannot follow cross-origin redirects.
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!driveRes.ok) {
      return NextResponse.json({ error: `Drive error: ${driveRes.status}` }, { status: driveRes.status })
    }

    return new NextResponse(driveRes.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
