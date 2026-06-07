import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import LoginButton from '@/components/LoginButton'

export default async function HomePage() {
  const session = await auth()
  if (session?.user) redirect('/dashboard')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="font-[family-name:var(--font-geist)] text-4xl font-semibold tracking-tight text-white">
            BiblioIA
          </h1>
          <p className="text-sm text-neutral-400">
            Segundo cerebro académico — tu biblioteca en lenguaje natural
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl">
          <div className="space-y-6">
            <div className="space-y-1 text-left">
              <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
                Acceso restringido
              </p>
              <p className="text-sm text-neutral-300">
                Ingresá con tu cuenta de Google autorizada para acceder a tu biblioteca.
              </p>
            </div>
            <LoginButton />
          </div>
        </div>

        <p className="text-xs text-neutral-600">
          Solo usuarios autorizados pueden acceder a esta plataforma.
        </p>
      </div>
    </main>
  )
}
