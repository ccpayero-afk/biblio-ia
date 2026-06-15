'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface Scope {
  ids: string[]      // carpetaIds seleccionadas; vacío = toda la biblioteca
  nombres: string[]  // nombres para mostrar en UI
}

const defaultScope: Scope = { ids: [], nombres: [] }

interface ScopeCtx {
  scope: Scope
  setScope: (s: Scope) => void
}

const ScopeContext = createContext<ScopeCtx>({ scope: defaultScope, setScope: () => {} })

const STORAGE_KEY = 'biblioIA_scope'

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScopeState] = useState<Scope>(defaultScope)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setScopeState(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  function setScope(s: Scope) {
    setScopeState(s)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
  }

  return <ScopeContext.Provider value={{ scope, setScope }}>{children}</ScopeContext.Provider>
}

export function useScope() {
  return useContext(ScopeContext)
}

/** Devuelve carpetasIds para pasar a APIs, o undefined si es "toda la biblioteca" */
export function scopeParam(scope: Scope): { carpetasIds?: string[] } {
  return scope.ids.length ? { carpetasIds: scope.ids } : {}
}
