'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Header from './Header'

interface Props {
  children: React.ReactNode
  user: { name?: string | null; email?: string | null; image?: string | null }
  apiKeyConfigurada: boolean
}

export default function AppShell({ children, user, apiKeyConfigurada }: Props) {
  const [sidebarAbierto, setSidebarAbierto] = useState(false)
  const pathname = usePathname()

  // Cerrar sidebar al navegar (mobile)
  useEffect(() => { setSidebarAbierto(false) }, [pathname])

  // Cerrar sidebar al hacer resize a desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setSidebarAbierto(false) }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950">
      {/* Overlay mobile */}
      {sidebarAbierto && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setSidebarAbierto(false)}
        />
      )}

      {/* Sidebar — fixed drawer on mobile, static on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-30 transition-transform duration-200 md:static md:translate-x-0
        ${sidebarAbierto ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setSidebarAbierto(false)} />
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header
          user={user}
          apiKeyConfigurada={apiKeyConfigurada}
          onMenuClick={() => setSidebarAbierto((v) => !v)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
