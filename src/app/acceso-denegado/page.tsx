import Link from 'next/link'

export default function AccesoDenegadoPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-red-500">
            Acceso denegado
          </p>
          <h1 className="text-2xl font-semibold text-white">No tenés permiso</h1>
          <p className="text-sm text-neutral-400">
            Tu cuenta de Google no está en la lista de usuarios autorizados para usar BiblioIA.
          </p>
        </div>
        <Link
          href="/"
          className="inline-block rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-600 hover:text-white"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
