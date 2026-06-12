'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import {
  BookOpen, FileText, MessageSquare, StickyNote, Quote,
  GitFork, FolderOpen, Brain, Users, Upload, Settings, Library, Highlighter, Inbox, BarChart2, Coffee,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/sala-lectura',                   label: 'Sala de Lectura',  icon: Coffee },
  { href: '/biblioteca',                     label: 'Biblioteca',       icon: Library },
  { href: '/biblioteca/procesar-highlights', label: 'Highlights PDF',   icon: Highlighter },
  { href: '/lector',                         label: 'Lector',           icon: BookOpen },
  { href: '/consultar',                      label: 'Consultar',        icon: MessageSquare },
  { href: '/fichas',                         label: 'Fichas',           icon: FileText },
  { href: '/notas',                          label: 'Notas',            icon: StickyNote },
  { href: '/bandeja',                        label: 'Bandeja',          icon: Inbox },
  { href: '/citas',                          label: 'Citas',            icon: Quote },
  { href: '/datos',                          label: 'Datos',            icon: BarChart2 },
  { href: '/grafo',                          label: 'Grafo',            icon: GitFork },
  { href: '/proyectos',                      label: 'Proyectos',        icon: FolderOpen },
  { href: '/inteligencia',                   label: 'Inteligencia',     icon: Brain },
  { href: '/interlocutor',                   label: 'Interlocutor',     icon: Users },
  { href: '/importar',                       label: 'Importar',         icon: Upload },
  { href: '/configuracion',                  label: 'Configuración',    icon: Settings },
]

interface Props {
  onClose?: () => void
  colapsada?: boolean
  onToggleColapsar?: () => void
}

export default function Sidebar({ onClose, colapsada, onToggleColapsar }: Props) {
  const pathname = usePathname()

  return (
    <aside
      className="flex h-full flex-col border-r border-violet-900/30 bg-neutral-950 transition-[width] duration-200"
      style={{ width: colapsada ? 56 : 224 }}
    >
      {/* Header */}
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-violet-900/30 px-3">
        {!colapsada && (
          <Link
            href="/dashboard"
            className="truncate text-base font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent"
            onClick={onClose}
          >
            BiblioIA
          </Link>
        )}
        <div className={`flex items-center gap-1 ${colapsada ? 'w-full justify-center' : 'flex-shrink-0'}`}>
          {onToggleColapsar && (
            <button
              onClick={onToggleColapsar}
              className="hidden rounded p-1 text-neutral-600 hover:text-violet-400 md:block transition-colors"
              title={colapsada ? 'Expandir menú' : 'Colapsar menú'}
            >
              {colapsada
                ? <PanelLeftOpen className="h-4 w-4" />
                : <PanelLeftClose className="h-4 w-4" />}
            </button>
          )}
          {onClose && !colapsada && (
            <button onClick={onClose} className="rounded p-1 text-neutral-600 hover:text-white md:hidden">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== '/lector' && pathname.startsWith(href + '/')) ||
            (href === '/lector' && pathname.startsWith('/lector/'))

          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              title={colapsada ? label : undefined}
              className={`relative flex items-center text-sm transition-all ${
                colapsada
                  ? 'justify-center px-0 py-3'
                  : 'gap-3 px-4 py-2.5'
              } ${
                active
                  ? 'bg-gradient-to-r from-violet-950/70 to-blue-950/50 text-white'
                  : 'text-neutral-500 hover:bg-blue-950/30 hover:text-blue-200'
              }`}
            >
              {/* Barra izquierda activa */}
              {active && (
                <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-gradient-to-b from-blue-400 to-violet-500" />
              )}
              <Icon className={`h-4 w-4 flex-shrink-0 transition-colors ${active ? 'text-violet-400' : ''}`} />
              {!colapsada && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer sutil */}
      {!colapsada && (
        <div className="flex-shrink-0 border-t border-violet-900/20 px-4 py-3">
          <p className="text-xs text-neutral-700">v2 · biblio-ia</p>
        </div>
      )}
    </aside>
  )
}
