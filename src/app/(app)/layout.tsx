import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getAccessToken } from '@/lib/auth-helpers'
import { hasApiKey } from '@/lib/gemini'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/')

  // Si el refresh del token falló, forzar re-login
  if (session.error === 'RefreshTokenError') redirect('/api/auth/signout')

  const accessToken = getAccessToken(session)
  const apiKeyConfigurada = await hasApiKey(accessToken)

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          user={{
            name: session.user.name,
            email: session.user.email,
            image: session.user.image,
          }}
          apiKeyConfigurada={apiKeyConfigurada}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
