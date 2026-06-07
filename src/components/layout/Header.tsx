'use client'

import { signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'

interface HeaderProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  apiKeyConfigurada: boolean
}

export default function Header({ user, apiKeyConfigurada }: HeaderProps) {
  return (
    <div className="flex flex-col">
      {!apiKeyConfigurada && (
        <div className="flex items-center justify-between border-b border-amber-900/50 bg-amber-950/30 px-4 py-2 text-xs text-amber-400">
          <span>Para usar las funciones de IA, configurá tu API key de Gemini.</span>
          <Link href="/configuracion" className="font-medium underline hover:text-amber-300">
            Configurar
          </Link>
        </div>
      )}
      <header className="flex h-14 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4">
        <div />
        <div className="flex items-center gap-3">
          <div className="text-right">
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
