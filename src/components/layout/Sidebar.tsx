'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import {
  BookOpen, FileText, MessageSquare, StickyNote, Quote,
  GitFork, GraduationCap, Brain, Users, Upload, Settings,
  Library, Highlighter, Inbox, BarChart2, Coffee, BookMarked, Map,
  GitCompare, Briefcase,
} from 'lucide-react'

const NAV_GROUPS = [
  {
    label: 'Lectura',
    items: [
      { href: '/sala-lectura',                   label: 'Sala de Lectura',  icon: Coffee },
      { href: '/biblioteca',                     label: 'Biblioteca',       icon: Library },
      { href: '/biblioteca/procesar-highlights', label: 'Highlights PDF',   icon: Highlighter },
      { href: '/lector',                         label: 'Lector',           icon: BookOpen },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { href: '/consultar',   label: 'Consultar',   icon: MessageSquare },
      { href: '/fichas',      label: 'Fichas',       icon: FileText },
      { href: '/notas',       label: 'Notas',        icon: StickyNote },
      { href: '/diario',      label: 'Diario',       icon: BookMarked },
      { href: '/bandeja',     label: 'Bandeja',      icon: Inbox },
      { href: '/citas',       label: 'Citas',        icon: Quote },
      { href: '/datos',       label: 'Datos',        icon: BarChart2 },
    ],
  },
  {
    label: 'Investigación',
    items: [
      { href: '/grafo',         label: 'Grafo',           icon: GitFork },
      { href: '/mapa-debates',  label: 'Mapa de Debates', icon: Map },
      { href: '/comparador',    label: 'Comparador',      icon: GitCompare },
      { href: '/marco-teorico', label: 'Marco teórico',   icon: BookOpen },
      { href: '/maletin',       label: 'Maletín',         icon: Briefcase },
      { href: '/aula',          label: 'Aula IA',         icon: GraduationCap },
      { href: '/proyectos',     label: 'Tutor',           icon: Brain },
      { href: '/inteligencia',  label: 'Repaso',          icon: Brain },
      { href: '/interlocutor',  label: 'Interlocutor',    icon: Users },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/importar',      label: 'Importar',      icon: Upload },
      { href: '/configuracion', label: 'Configuración', icon: Settings },
    ],
  },
]

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true
  if (href === '/lector') return pathname.startsWith('/lector/')
  if (href === '/biblioteca' && pathname.startsWith('/biblioteca/')) return false
  return pathname.startsWith(href + '/')
}

interface Props {
  onClose?: () => void
  colapsada?: boolean
  onToggleColapsar?: () => void
}

export default function Sidebar({ onClose, colapsada, onToggleColapsar }: Props) {
  const pathname = usePathname()

  return (
    <aside
      className="flex h-full flex-col transition-[width] duration-200"
      style={{
        width: colapsada ? 56 : 224,
        background: 'linear-gradient(180deg, #0c0c1a 0%, #080812 50%, #06060f 100%)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Header / Logo */}
      <div
        className="flex h-14 flex-shrink-0 items-center justify-between px-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        {!colapsada && (
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center gap-2 truncate"
          >
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                boxShadow: '0 0 12px rgba(124,58,237,0.5), 0 0 24px rgba(6,182,212,0.2)',
              }}
            >
              <BookMarked className="h-4 w-4 text-white" />
            </div>
            <span
              className="text-sm font-bold tracking-tight"
              style={{
                background: 'linear-gradient(90deg, #a78bfa, #67e8f9)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              BiblioIA
            </span>
          </Link>
        )}

        {colapsada && (
          <Link href="/dashboard" onClick={onClose} className="mx-auto flex items-center justify-center">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                boxShadow: '0 0 10px rgba(124,58,237,0.45)',
              }}
            >
              <BookMarked className="h-4 w-4 text-white" />
            </div>
          </Link>
        )}

        <div className={`flex items-center gap-1 ${colapsada ? 'hidden' : 'flex-shrink-0'}`}>
          {onToggleColapsar && (
            <button
              onClick={onToggleColapsar}
              className="hidden rounded-md p-1.5 text-neutral-600 transition-colors hover:text-neutral-300 md:block"
              style={{ background: 'transparent' }}
              title={colapsada ? 'Expandir menú' : 'Colapsar menú'}
            >
              {colapsada
                ? <PanelLeftOpen className="h-3.5 w-3.5" />
                : <PanelLeftClose className="h-3.5 w-3.5" />}
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="rounded-md p-1.5 text-neutral-600 hover:text-white md:hidden">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-1">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'pt-2' : ''}>
            {/* Group label */}
            {!colapsada && (
              <p
                className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'rgba(139,92,246,0.5)' }}
              >
                {group.label}
              </p>
            )}
            {colapsada && gi > 0 && (
              <div
                className="mx-3 mb-2 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.25), transparent)' }}
              />
            )}

            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href)

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  title={colapsada ? label : undefined}
                  className={`relative flex items-center text-[13px] transition-all duration-150 ${
                    colapsada
                      ? 'mx-1 justify-center rounded-lg px-0 py-2.5'
                      : 'mx-2 gap-3 rounded-lg px-3 py-2'
                  }`}
                  style={
                    active
                      ? {
                          background: 'linear-gradient(90deg, rgba(109,40,217,0.25) 0%, rgba(30,58,138,0.15) 100%)',
                          boxShadow: 'inset 0 0 0 1px rgba(139,92,246,0.15)',
                          color: '#fff',
                        }
                      : { color: 'rgba(148,163,184,0.7)' }
                  }
                  onMouseEnter={(e) => {
                    if (!active) {
                      const el = e.currentTarget
                      el.style.background = 'rgba(255,255,255,0.04)'
                      el.style.color = 'rgba(203,213,225,0.9)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      const el = e.currentTarget
                      el.style.background = ''
                      el.style.color = 'rgba(148,163,184,0.7)'
                    }
                  }}
                >
                  {/* Left glow bar */}
                  {active && (
                    <span
                      className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
                      style={{
                        background: 'linear-gradient(180deg, #a78bfa, #22d3ee)',
                        boxShadow: '0 0 8px rgba(167,139,250,0.8), 0 0 16px rgba(167,139,250,0.4)',
                      }}
                    />
                  )}

                  <Icon
                    className="h-4 w-4 flex-shrink-0 transition-colors"
                    style={
                      active
                        ? { color: '#a78bfa', filter: 'drop-shadow(0 0 4px rgba(167,139,250,0.6))' }
                        : {}
                    }
                  />
                  {!colapsada && (
                    <span className="truncate font-medium">{label}</span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="flex-shrink-0 px-2 py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        {colapsada ? (
          onToggleColapsar && (
            <button
              onClick={onToggleColapsar}
              className="flex w-full items-center justify-center rounded-lg p-1.5 text-neutral-600 transition-colors hover:text-neutral-300"
              title="Expandir menú"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )
        ) : (
          <p
            className="px-2 text-[10px] font-medium"
            style={{
              background: 'linear-gradient(90deg, rgba(139,92,246,0.5), rgba(6,182,212,0.4))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            v2 · BiblioIA
          </p>
        )}
      </div>
    </aside>
  )
}
