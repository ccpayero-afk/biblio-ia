import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getAccessToken } from '@/lib/auth-helpers'
import { hasApiKey } from '@/lib/gemini'
import AppShell from '@/components/layout/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/')
  if (session.error === 'RefreshTokenError') redirect('/api/auth/signout')

  const accessToken = getAccessToken(session)
  const apiKeyConfigurada = await hasApiKey(accessToken)

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      apiKeyConfigurada={apiKeyConfigurada}
    >
      {children}
    </AppShell>
  )
}
