import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const nombre = file.name.toLowerCase()

    if (nombre.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer })
      return NextResponse.json({ texto: result.value.trim() })
    }

    // .txt or plain text
    return NextResponse.json({ texto: buffer.toString('utf-8').trim() })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
