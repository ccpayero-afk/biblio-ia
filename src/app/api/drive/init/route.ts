import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive } from '@/lib/drive'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await auth()
  const accessToken = getAccessToken(session)

  const estructura = await initUserDrive(accessToken)
  return NextResponse.json({ ok: true, estructura })
}
