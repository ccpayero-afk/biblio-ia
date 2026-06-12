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
  const [navColapsada, setNavColapsada] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const saved = localStorage.getItem('nav-colapsada')
    if (saved === 'true') setNavColapsada(true)
  }, [])

  function toggleNav() {
    setNavColapsada((v) => {
      localStorage.setItem('nav-colapsada', String(!v))
      return !v
    })
  }

  useEffect(() => { setSidebarAbierto(false) }, [pathname])

  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setSidebarAbierto(false) }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Ambient gradient blobs — fondo decorativo */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute -top-32 left-1/4 h-[500px] w-[600px] rounded-full animate-glow"
          style={{ background: 'radial-gradient(ellipse, rgba(109,40,217,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }}
        />
        <div
          className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full animate-glow"
          style={{ background: 'radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 70%)', filter: 'blur(40px)', animationDelay: '1.5s' }}
        />
        <div
          className="absolute top-1/2 -left-20 h-[300px] w-[300px] rounded-full animate-glow"
          style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)', filter: 'blur(40px)', animationDelay: '3s' }}
        />
      </div>

      {/* Overlay mobile */}
      {sidebarAbierto && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarAbierto(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 transition-transform duration-200 md:static md:translate-x-0
        ${sidebarAbierto ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar
          onClose={() => setSidebarAbierto(false)}
          colapsada={navColapsada}
          onToggleColapsar={toggleNav}
        />
      </div>

      {/* Área principal */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
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
