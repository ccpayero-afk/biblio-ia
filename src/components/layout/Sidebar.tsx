'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpen,
  FileText,
  MessageSquare,
  StickyNote,
  Quote,
  GitFork,
  FolderOpen,
  Brain,
  Users,
  Upload,
  Settings,
  Library,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/biblioteca', label: 'Biblioteca', icon: Library },
  { href: '/lector', label: 'Lector', icon: BookOpen },
  { href: '/consultar', label: 'Consultar', icon: MessageSquare },
  { href: '/fichas', label: 'Fichas', icon: FileText },
  { href: '/notas', label: 'Notas', icon: StickyNote },
  { href: '/citas', label: 'Citas', icon: Quote },
  { href: '/grafo', label: 'Grafo', icon: GitFork },
  { href: '/proyectos', label: 'Proyectos', icon: FolderOpen },
  { href: '/inteligencia', label: 'Inteligencia', icon: Brain },
  { href: '/interlocutor', label: 'Interlocutor', icon: Users },
  { href: '/importar', label: 'Importar', icon: Upload },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-56 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="flex h-14 items-center border-b border-neutral-800 px-4">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-white">
          BiblioIA
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                active
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
