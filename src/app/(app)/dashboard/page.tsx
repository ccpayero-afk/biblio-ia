import { auth } from '@/auth'
import { getAccessToken } from '@/lib/auth-helpers'
import { initUserDrive, listPDFs } from '@/lib/drive'
import Link from 'next/link'
import {
  Library, FileText, StickyNote, FolderOpen,
  Coffee, BookOpen, MessageSquare, ArrowRight, Sparkles,
} from 'lucide-react'
import NeuralCanvas from './NeuralCanvas'

const STAT_CARDS = [
  {
    label: 'Documentos', icon: Library, href: '/biblioteca',
    border: 'rgba(139,92,246,0.2)', glow: 'rgba(139,92,246,0.12)', iconColor: '#a78bfa',
    gradFrom: 'rgba(109,40,217,0.12)', gradTo: 'rgba(109,40,217,0.03)',
  },
  {
    label: 'Fichas', icon: FileText, href: '/fichas',
    border: 'rgba(6,182,212,0.2)', glow: 'rgba(6,182,212,0.10)', iconColor: '#22d3ee',
    gradFrom: 'rgba(8,145,178,0.12)', gradTo: 'rgba(8,145,178,0.03)',
  },
  {
    label: 'Notas', icon: StickyNote, href: '/notas',
    border: 'rgba(245,158,11,0.2)', glow: 'rgba(245,158,11,0.08)', iconColor: '#fbbf24',
    gradFrom: 'rgba(217,119,6,0.10)', gradTo: 'rgba(217,119,6,0.02)',
  },
  {
    label: 'Proyectos', icon: FolderOpen, href: '/proyectos',
    border: 'rgba(52,211,153,0.2)', glow: 'rgba(52,211,153,0.08)', iconColor: '#34d399',
    gradFrom: 'rgba(16,185,129,0.10)', gradTo: 'rgba(16,185,129,0.02)',
  },
]

const QUICK_LINKS = [
  { label: 'Sala de Lectura', desc: 'Subir PDFs por leer',    href: '/sala-lectura', icon: Coffee,       color: '#a78bfa' },
  { label: 'Consultar',       desc: 'Chat con tu biblioteca', href: '/consultar',    icon: MessageSquare, color: '#22d3ee' },
  { label: 'Fichas',          desc: 'Fichas bibliográficas',  href: '/fichas',       icon: FileText,      color: '#fbbf24' },
  { label: 'Lector',          desc: 'Leer y anotar PDFs',    href: '/lector',       icon: BookOpen,      color: '#34d399' },
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
    { ...STAT_CARDS[0], valor: docCount,  desc: `${indexados} indexado${indexados !== 1 ? 's' : ''}` },
    { ...STAT_CARDS[1], valor: '—', desc: 'Ver fichas' },
    { ...STAT_CARDS[2], valor: '—', desc: 'Ver notas' },
    { ...STAT_CARDS[3], valor: '—', desc: 'Ver proyectos' },
  ]

  return (
    <div style={{ maxWidth: '960px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── HERO ── */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '20px',
        border: '1px solid rgba(139,92,246,0.18)',
        background: 'linear-gradient(135deg, rgba(7,5,18,0.97) 0%, rgba(12,6,28,0.93) 100%)',
        boxShadow: '0 0 60px rgba(109,40,217,0.1), inset 0 1px 0 rgba(255,255,255,0.04)',
        minHeight: '260px',
        display: 'flex',
      }}>
        {/* Left content */}
        <div style={{
          flex: '0 0 55%', padding: '40px 44px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          position: 'relative', zIndex: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
            <Sparkles style={{ height: '13px', width: '13px', color: '#a78bfa' }} />
            <span style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'rgba(139,92,246,0.65)',
            }}>
              Bienvenido de vuelta
            </span>
          </div>

          <h1 style={{
            fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.05, margin: '0 0 12px',
            background: 'linear-gradient(105deg, #f1f5f9 15%, #c4b5fd 55%, #22d3ee 95%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {nombre}
          </h1>

          <p style={{ fontSize: '13.5px', color: 'rgba(148,163,184,0.6)', lineHeight: 1.55, margin: '0 0 22px' }}>
            Tu segundo cerebro académico está listo<br />para trabajar contigo.
          </p>

          {docCount > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(139,92,246,0.22)',
              borderRadius: '100px', padding: '5px 14px', marginBottom: '20px', width: 'fit-content',
            }}>
              <Library style={{ height: '12px', width: '12px', color: '#a78bfa' }} />
              <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 500 }}>
                {docCount} documento{docCount !== 1 ? 's' : ''} &middot; {indexados} indexado{indexados !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          <Link
            href="/biblioteca"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              background: 'linear-gradient(135deg, #7c3aed, #0891b2)',
              borderRadius: '10px', padding: '9px 20px', width: 'fit-content',
              fontSize: '13px', fontWeight: 600, color: '#fff', textDecoration: 'none',
              boxShadow: '0 0 24px rgba(124,58,237,0.4)',
            }}
          >
            <Library style={{ height: '14px', width: '14px' }} />
            Ir a Biblioteca
            <ArrowRight style={{ height: '13px', width: '13px' }} />
          </Link>
        </div>

        {/* Right: neural canvas */}
        <div style={{ flex: '0 0 45%', position: 'relative' }}>
          {/* Left-edge blend */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100px', height: '100%', zIndex: 2,
            background: 'linear-gradient(90deg, rgba(7,5,18,0.97) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />
          <NeuralCanvas style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>

        {/* Bottom accent line */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.35) 35%, rgba(6,182,212,0.25) 65%, transparent 100%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {stats.map(({ label, icon: Icon, href, border, glow, iconColor, gradFrom, gradTo, valor, desc }) => (
          <Link
            key={label}
            href={href}
            style={{
              position: 'relative', overflow: 'hidden', borderRadius: '16px', padding: '20px',
              background: `linear-gradient(135deg, ${gradFrom} 0%, ${gradTo} 100%)`,
              border: `1px solid ${border}`,
              boxShadow: `0 0 20px ${glow}`,
              textDecoration: 'none', display: 'block',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 0 36px ${glow}, 0 6px 28px rgba(0,0,0,0.25)`
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `0 0 20px ${glow}`
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ background: `${iconColor}18`, borderRadius: '8px', padding: '7px' }}>
                <Icon style={{ height: '15px', width: '15px', color: iconColor }} />
              </div>
              <ArrowRight style={{ height: '13px', width: '13px', color: iconColor, opacity: 0.5 }} />
            </div>
            <p style={{
              fontSize: '1.9rem', fontWeight: 700, margin: '0 0 3px',
              color: valor === '—' ? 'rgba(148,163,184,0.3)' : '#f1f5f9',
            }}>
              {valor}
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(148,163,184,0.55)', margin: 0 }}>{label}</p>
            <p style={{ fontSize: '11px', color: 'rgba(148,163,184,0.35)', margin: '2px 0 0' }}>{desc}</p>
          </Link>
        ))}
      </div>

      {/* ── QUICK LINKS ── */}
      <div>
        <h2 style={{
          margin: '0 0 10px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(139,92,246,0.45)',
        }}>
          Accesos rápidos
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {QUICK_LINKS.map(({ label, desc, href, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex', flexDirection: 'column', gap: '10px',
                borderRadius: '14px', padding: '18px',
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.055)',
                textDecoration: 'none',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.borderColor = `${color}28`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.025)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.055)'
              }}
            >
              <Icon style={{ height: '18px', width: '18px', color: `${color}90` }} />
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: 500, color: '#f1f5f9' }}>{label}</p>
                <p style={{ margin: 0, fontSize: '11.5px', color: 'rgba(148,163,184,0.45)' }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── PRIMEROS PASOS ── */}
      <div style={{
        borderRadius: '18px', padding: '24px 28px',
        background: 'linear-gradient(135deg, rgba(10,8,22,0.85) 0%, rgba(8,8,18,0.7) 100%)',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        <h2 style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          margin: '0 0 18px', fontSize: '13px', fontWeight: 600, color: '#f1f5f9',
        }}>
          <span style={{
            display: 'inline-block', height: '7px', width: '7px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #a78bfa, #22d3ee)',
          }} />
          Primeros pasos
        </h2>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { n: 1, texto: 'Configurá tu API key de Gemini en', link: '/configuracion', linkLabel: 'Configuración', done: false },
            { n: 2, texto: 'Subí tus PDFs en', link: '/biblioteca', linkLabel: 'Biblioteca', done: docCount > 0 },
            { n: 3, texto: 'Indexá los documentos para habilitar la búsqueda semántica', link: null, linkLabel: null, done: indexados > 0 },
            { n: 4, texto: 'Consultá tu biblioteca en', link: '/consultar', linkLabel: 'Consultar', done: false },
          ].map(({ n, texto, link, linkLabel, done }) => (
            <li key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '13.5px' }}>
              <span style={{
                flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '24px', width: '24px', borderRadius: '50%',
                fontSize: '11px', fontWeight: 600,
                ...(done
                  ? { background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399' }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(148,163,184,0.4)' }
                ),
              }}>
                {done ? '✓' : n}
              </span>
              <span style={{ color: 'rgba(148,163,184,0.65)', lineHeight: 1.55 }}>
                {texto}{' '}
                {link && (
                  <Link href={link} style={{ color: '#a78bfa', fontWeight: 500, textDecoration: 'none' }}>
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
