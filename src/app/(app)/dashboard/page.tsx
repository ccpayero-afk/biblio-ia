import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs } from '@/lib/drive'
import Link from 'next/link'
import {
  Library, FileText, StickyNote, FolderOpen,
  Coffee, BookOpen, MessageSquare, ArrowRight, Sparkles,
} from 'lucide-react'

const STAT_CARDS = [
  {
    label: 'Documentos',
    icon: Library,
    href: '/biblioteca',
    gradient: 'from-violet-600/20 to-violet-900/10',
    border: 'rgba(139,92,246,0.2)',
    glow: 'rgba(139,92,246,0.15)',
    iconColor: '#a78bfa',
  },
  {
    label: 'Fichas',
    icon: FileText,
    href: '/fichas',
    gradient: 'from-cyan-600/20 to-cyan-900/10',
    border: 'rgba(6,182,212,0.2)',
    glow: 'rgba(6,182,212,0.12)',
    iconColor: '#22d3ee',
  },
  {
    label: 'Notas',
    icon: StickyNote,
    href: '/notas',
    gradient: 'from-amber-600/15 to-amber-900/5',
    border: 'rgba(245,158,11,0.2)',
    glow: 'rgba(245,158,11,0.10)',
    iconColor: '#fbbf24',
  },
  {
    label: 'Proyectos',
    icon: FolderOpen,
    href: '/proyectos',
    gradient: 'from-emerald-600/15 to-emerald-900/5',
    border: 'rgba(52,211,153,0.2)',
    glow: 'rgba(52,211,153,0.10)',
    iconColor: '#34d399',
  },
]

const QUICK_LINKS = [
  { label: 'Sala de Lectura', desc: 'Subir PDFs por leer', href: '/sala-lectura', icon: Coffee, color: '#a78bfa' },
  { label: 'Consultar',       desc: 'Chat con tu biblioteca', href: '/consultar',     icon: MessageSquare, color: '#22d3ee' },
  { label: 'Fichas',          desc: 'Fichas bibliográficas', href: '/fichas',        icon: FileText,      color: '#fbbf24' },
  { label: 'Lector',          desc: 'Leer y anotar PDFs',   href: '/lector',         icon: BookOpen,      color: '#34d399' },
]

export default async function DashboardPage() {
  const session = await auth()
  const accessToken = getAccessToken(session)
  const nombre = session?.user?.name?.split(' ')[0] ?? 'Investigador'

  let docCount = 0
  let indexados = 0
  try {
    const estructura = await initUserDrive(accessToken)
    const documentos = await listPDFs(accessToken, estructura.pdfsId)
    docCount = documentos.length
    indexados = documentos.filter((d) => d.estado === 'indexado').length
  } catch {
    // Drive API unavailable — show zeros gracefully
  }

  const stats = [
    { ...STAT_CARDS[0], valor: docCount, desc: `${indexados} indexado${indexados !== 1 ? 's' : ''}` },
    { ...STAT_CARDS[1], valor: '—', desc: 'Ver fichas' },
    { ...STAT_CARDS[2], valor: '—', desc: 'Ver notas' },
    { ...STAT_CARDS[3], valor: '—', desc: 'Ver proyectos' },
  ]

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Saludo */}
      <div className="relative">
        <div
          className="absolute -inset-4 rounded-2xl opacity-40"
          style={{ background: 'radial-gradient(ellipse at 0% 50%, rgba(109,40,217,0.15) 0%, transparent 70%)' }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4" style={{ color: '#a78bfa' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(139,92,246,0.7)' }}>Bienvenido de vuelta</span>
          </div>
          <h1
            className="text-3xl font-bold"
            style={{
              background: 'linear-gradient(90deg, #f1f5f9 30%, #a78bfa 70%, #22d3ee 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {nombre}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'rgba(148,163,184,0.7)' }}>
            Tu segundo cerebro académico está listo para trabajar.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, icon: Icon, href, gradient, border, glow, iconColor, valor, desc }) => (
          <Link
            key={label}
            href={href}
            className={`group relative overflow-hidden rounded-2xl p-5 transition-all duration-200 bg-gradient-to-br ${gradient}`}
            style={{
              border: `1px solid ${border}`,
              boxShadow: `0 0 20px ${glow}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 0 32px ${glow}, 0 4px 24px rgba(0,0,0,0.3)`
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `0 0 20px ${glow}`
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="rounded-lg p-2"
                style={{ background: `${iconColor}18` }}
              >
                <Icon className="h-4 w-4" style={{ color: iconColor }} />
              </div>
              <ArrowRight
                className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: iconColor }}
              />
            </div>
            <p
              className="text-3xl font-bold"
              style={{ color: valor === '—' ? 'rgba(148,163,184,0.4)' : '#f1f5f9' }}
            >
              {valor}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: 'rgba(148,163,184,0.6)' }}>{label}</p>
            <p className="mt-0.5 text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>{desc}</p>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(139,92,246,0.5)' }}>
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_LINKS.map(({ label, desc, href, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-2 rounded-xl p-4 transition-all duration-150"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.borderColor = `${color}30`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
              }}
            >
              <Icon className="h-5 w-5 transition-colors" style={{ color: `${color}99` }} />
              <div>
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.5)' }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Primeros pasos */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(13,13,25,0.8) 0%, rgba(10,10,20,0.6) 100%)',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: 'linear-gradient(135deg, #a78bfa, #22d3ee)' }}
          />
          Primeros pasos
        </h2>
        <ol className="space-y-3">
          {[
            { n: 1, texto: 'Configurá tu API key de Gemini en', link: '/configuracion', linkLabel: 'Configuración', done: false },
            { n: 2, texto: 'Subí tus PDFs en', link: '/biblioteca', linkLabel: 'Biblioteca', done: docCount > 0 },
            { n: 3, texto: 'Indexá los documentos para habilitar la búsqueda semántica', link: null, linkLabel: null, done: indexados > 0 },
            { n: 4, texto: 'Consultá tu biblioteca en', link: '/consultar', linkLabel: 'Consultar', done: false },
          ].map(({ n, texto, link, linkLabel, done }) => (
            <li key={n} className="flex items-start gap-3 text-sm">
              <span
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={done
                  ? { background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399' }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.5)' }
                }
              >
                {done ? '✓' : n}
              </span>
              <span style={{ color: 'rgba(148,163,184,0.7)' }}>
                {texto}{' '}
                {link && (
                  <Link
                    href={link}
                    className="font-medium underline-offset-2 hover:underline"
                    style={{ color: '#a78bfa' }}
                  >
                    {linkLabel}
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
