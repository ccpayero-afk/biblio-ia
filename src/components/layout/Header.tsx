'use client'

import { signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import BusquedaUniversal from '@/components/BusquedaUniversal'

interface HeaderProps {
  user: { name?: string | null; email?: string | null; image?: string | null }
  apiKeyConfigurada: boolean
  onMenuClick?: () => void
}

export default function Header({ user, apiKeyConfigurada, onMenuClick }: HeaderProps) {
  return (
    <div className="flex flex-col">
      {!apiKeyConfigurada && (
        <div className="flex items-center justify-between border-b border-amber-900/50 bg-amber-950/30 px-4 py-2 text-xs text-amber-400">
          <span>Configurá tu API key de Gemini para usar las funciones de IA.</span>
          <Link href="/configuracion" className="font-medium underline hover:text-amber-300">
            Configurar
          </Link>
        </div>
      )}
      <header className="flex h-14 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4">
        {/* Hamburger — only on mobile */}
        <button
          onClick={onMenuClick}
          className="rounded p-1.5 text-neutral-400 hover:text-white md:hidden"
          aria-label="Menú"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden md:flex md:flex-1 md:px-4">
          <BusquedaUniversal />
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-neutral-500">{user.email}</p>
          </div>
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name ?? 'Avatar'}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-700 text-xs font-medium text-white">
              {user.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            Salir
          </button>
        </div>
      </header>
    </div>
  )
}
