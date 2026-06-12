'use client'

import { signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, LogOut } from 'lucide-react'
import BusquedaUniversal from '@/components/BusquedaUniversal'

interface HeaderProps {
  user: { name?: string | null; email?: string | null; image?: string | null }
  apiKeyConfigurada: boolean
  onMenuClick?: () => void
}

export default function Header({ user, apiKeyConfigurada, onMenuClick }: HeaderProps) {
  return (
    <div className="flex flex-col relative z-10">
      {/* Banner de API key */}
      {!apiKeyConfigurada && (
        <div
          className="flex items-center justify-between px-4 py-2 text-xs"
          style={{
            background: 'linear-gradient(90deg, rgba(120,53,15,0.4), rgba(146,64,14,0.25))',
            borderBottom: '1px solid rgba(217,119,6,0.2)',
            color: '#fbbf24',
          }}
        >
          <span>Configurá tu API key de Gemini para usar las funciones de IA.</span>
          <Link
            href="/configuracion"
            className="font-semibold underline hover:text-amber-300 transition-colors"
          >
            Configurar →
          </Link>
        </div>
      )}

      {/* Header principal */}
      <header
        className="flex h-14 items-center justify-between px-4 gap-4"
        style={{
          background: 'rgba(3,3,8,0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 1px 0 rgba(124,58,237,0.08)',
        }}
      >
        {/* Hamburger — mobile */}
        <button
          onClick={onMenuClick}
          className="rounded-lg p-1.5 text-neutral-400 hover:text-white transition-colors md:hidden"
          aria-label="Menú"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Búsqueda */}
        <div className="hidden md:flex md:flex-1 md:max-w-xl">
          <BusquedaUniversal />
        </div>

        {/* Usuario */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-white leading-tight">{user.name}</p>
            <p className="text-[11px] text-neutral-500">{user.email}</p>
          </div>

          {/* Avatar */}
          {user.image ? (
            <div
              className="rounded-full p-[1.5px]"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                boxShadow: '0 0 12px rgba(124,58,237,0.4)',
              }}
            >
              <Image
                src={user.image}
                alt={user.name ?? 'Avatar'}
                width={30}
                height={30}
                className="rounded-full"
              />
            </div>
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                boxShadow: '0 0 14px rgba(124,58,237,0.45)',
              }}
            >
              {user.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}

          {/* Salir */}
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="rounded-lg p-1.5 text-neutral-600 hover:text-neutral-300 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Línea gradiente decorativa bajo el header */}
      <div
        className="h-px w-full"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.3) 30%, rgba(6,182,212,0.2) 70%, transparent 100%)',
        }}
      />
    </div>
  )
}
