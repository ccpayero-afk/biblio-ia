import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { hasApiKey } from '@/lib/gemini'
import ConfiguracionClient from './ConfiguracionClient'

export default async function ConfiguracionPage() {
  const session = await auth()
  const accessToken = getAccessToken(session)
  const apiKeyConfigurada = await hasApiKey(accessToken)

  const emailsAutorizados = (process.env.ALLOWED_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean)

  return (
    <ConfiguracionClient
      apiKeyConfigurada={apiKeyConfigurada}
      emailsAutorizados={emailsAutorizados}
      userEmail={session?.user?.email ?? ''}
    />
  )
}
