import { NextRequest, NextResponse } from 'next/server'

// POST — receives a binary chunk and forwards it to an open Drive resumable session.
// Headers from the client:
//   x-drive-url       : the Drive resumable upload session URL
//   x-content-range   : e.g. "bytes 0-3145727/6500000"
// Body: raw binary (application/octet-stream), must stay < 4.5 MB (Vercel Hobby limit)
export async function POST(req: NextRequest) {
  try {
    const driveUrl = req.headers.get('x-drive-url')
    const contentRange = req.headers.get('x-content-range')

    if (!driveUrl) return NextResponse.json({ error: 'Falta x-drive-url' }, { status: 400 })
    if (!contentRange) return NextResponse.json({ error: 'Falta x-content-range' }, { status: 400 })

    const chunk = await req.arrayBuffer()

    const res = await fetch(driveUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Range': contentRange,
        'Content-Length': String(chunk.byteLength),
      },
      body: chunk,
    })

    // 308 Resume Incomplete — chunk received, session still open
    if (res.status === 308) {
      const range = res.headers.get('Range') ?? ''
      return NextResponse.json({ done: false, range })
    }

    // 200 / 201 — upload complete, Drive returns the file metadata
    if (res.ok) {
      const data = await res.json() as { id?: string }
      return NextResponse.json({ done: true, id: data.id })
    }

    const err = await res.text()
    return NextResponse.json(
      { error: `Drive devolvió ${res.status}: ${err.slice(0, 300)}` },
      { status: 500 }
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
