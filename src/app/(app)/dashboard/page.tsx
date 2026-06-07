import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs } from '@/lib/drive'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await auth()
  const accessToken = getAccessToken(session)

  // Inicializa Drive en cada visita al dashboard (idempotente — solo crea si no existe)
  const estructura = await initUserDrive(accessToken)
  const documentos = await listPDFs(accessToken, estructura.pdfsId)
  const indexados = documentos.filter((d) => d.estado === 'indexado').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">
          Bienvenido, {session?.user?.name?.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Tu segundo cerebro académico está listo para trabajar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Documentos', valor: documentos.length, desc: `${indexados} indexado${indexados !== 1 ? 's' : ''}` },
          { label: 'Citas guardadas', valor: '—', desc: 'Próximamente' },
          { label: 'Notas', valor: '—', desc: 'Próximamente' },
          { label: 'Proyectos', valor: '—', desc: 'Próximamente' },
        ].map(({ label, valor, desc }) => (
          <div key={label} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs text-neutral-500">{label}</p>
            <p className="mt-1 text-3xl font-semibold text-white">{valor}</p>
            <p className="mt-1 text-xs text-neutral-600">{desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-sm font-medium text-neutral-300">Primeros pasos</h2>
        <ol className="mt-4 space-y-3 text-sm text-neutral-400">
          {[
            { n: 1, texto: 'Configurá tu API key de Gemini en', link: '/configuracion', linkLabel: 'Configuración', done: false },
            { n: 2, texto: 'Subí tus PDFs en', link: '/biblioteca', linkLabel: 'Biblioteca', done: documentos.length > 0 },
            { n: 3, texto: 'Indexá los documentos para habilitar la búsqueda semántica', link: null, linkLabel: null, done: indexados > 0 },
            { n: 4, texto: 'Consultá tu biblioteca en', link: '/consultar', linkLabel: 'Consultar', done: false },
          ].map(({ n, texto, link, linkLabel, done }) => (
            <li key={n} className="flex gap-3">
              <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs ${done ? 'border-green-700 text-green-500' : 'border-neutral-700 text-neutral-500'}`}>
                {done ? '✓' : n}
              </span>
              <span>
                {texto}{' '}
                {link && <Link href={link} className="text-blue-400 hover:underline">{linkLabel}</Link>}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
