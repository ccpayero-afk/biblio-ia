import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const accessToken = getAccessToken(session)
    const { id } = await params

    // Redirect directly to Google Drive — PDF bytes never pass through Vercel servers.
    // react-pdf (PDF.js worker) follows the 302 and fetches from Google's CDN.
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&access_token=${encodeURIComponent(accessToken)}`
    return NextResponse.redirect(driveUrl, { status: 302 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
