'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import {
  BookOpen, FileText, MessageSquare, StickyNote, Quote,
  GitFork, FolderOpen, Brain, Users, Upload, Settings, Library, Highlighter, Inbox, BarChart2,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/biblioteca',                  label: 'Biblioteca',       icon: Library },
  { href: '/biblioteca/procesar-highlights', label: 'Highlights PDF', icon: Highlighter },
  { href: '/lector',                      label: 'Lector',           icon: BookOpen },
  { href: '/consultar',                   label: 'Consultar',        icon: MessageSquare },
  { href: '/fichas',                      label: 'Fichas',           icon: FileText },
  { href: '/notas',                       label: 'Notas',            icon: StickyNote },
  { href: '/bandeja',                     label: 'Bandeja',          icon: Inbox },
  { href: '/citas',                       label: 'Citas',            icon: Quote },
  { href: '/datos',                       label: 'Datos',            icon: BarChart2 },
  { href: '/grafo',                       label: 'Grafo',            icon: GitFork },
  { href: '/proyectos',                   label: 'Proyectos',        icon: FolderOpen },
  { href: '/inteligencia',                label: 'Inteligencia',     icon: Brain },
  { href: '/interlocutor',                label: 'Interlocutor',     icon: Users },
  { href: '/importar',                    label: 'Importar',         icon: Upload },
  { href: '/configuracion',               label: 'Configuración',    icon: Settings },
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
      className="flex h-full flex-col border-r border-neutral-800 bg-neutral-950 transition-[width] duration-200"
      style={{ width: colapsada ? 56 : 224 }}
    >
      {/* Header */}
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-neutral-800 px-3">
        {!colapsada && (
          <Link
            href="/dashboard"
            className="truncate text-base font-semibold tracking-tight text-white"
            onClick={onClose}
          >
            BiblioIA
          </Link>
        )}
        <div className={`flex items-center gap-1 ${colapsada ? 'w-full justify-center' : 'flex-shrink-0'}`}>
          {/* Collapse toggle — desktop only */}
          {onToggleColapsar && (
            <button
              onClick={onToggleColapsar}
              className="hidden rounded p-1 text-neutral-500 hover:text-white md:block"
              title={colapsada ? 'Expandir menú' : 'Colapsar menú'}
            >
              {colapsada
                ? <PanelLeftOpen className="h-4 w-4" />
                : <PanelLeftClose className="h-4 w-4" />}
            </button>
          )}
          {/* Mobile close */}
          {onClose && !colapsada && (
            <button onClick={onClose} className="rounded p-1 text-neutral-500 hover:text-white md:hidden">
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
              className={`flex items-center text-sm transition-colors ${
                colapsada
                  ? 'justify-center px-0 py-3'
                  : 'gap-3 px-4 py-2.5'
              } ${
                active
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!colapsada && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
