'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FileText, Quote, StickyNote, X, Loader2 } from 'lucide-react'
import { Documento, Cita, Nota } from '@/types'

interface ResultadoBusqueda {
  documentos: Documento[]
  citas: Cita[]
  notas: Nota[]
}

export default function BusquedaUniversal() {
  const [abierto, setAbierto] = useState(false)
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusqueda | null>(null)
  const [cargando, setCargando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Abrir con Cmd+K / Ctrl+K
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setAbierto((v) => !v)
      }
      if (e.key === 'Escape') setAbierto(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus al abrir
  useEffect(() => {
    if (abierto) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResultados(null)
    }
  }, [abierto])

  const buscar = useCallback(async (q: string) => {
    if (q.length < 2) { setResultados(null); return }
    setCargando(true)
    try {
      const res = await fetch(`/api/buscar?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResultados(data)
    } catch { /* noop */ }
    setCargando(false)
  }, [])

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscar(v), 300)
  }

  function navegar(href: string) {
    router.push(href)
    setAbierto(false)
  }

  const hayResultados = resultados && (
    resultados.documentos.length + resultados.citas.length + resultados.notas.length > 0
  )

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-500 hover:border-neutral-700 hover:text-neutral-300"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Buscar…</span>
        <kbd className="ml-1 rounded border border-neutral-700 px-1 py-0.5 text-xs text-neutral-600">⌘K</kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setAbierto(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
          {cargando
            ? <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-neutral-500" />
            : <Search className="h-4 w-4 flex-shrink-0 text-neutral-500" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={onInput}
            placeholder="Buscar documentos, citas, notas…"
            className="flex-1 bg-transparent text-sm text-white placeholder-neutral-600 outline-none"
          />
          <button onClick={() => setAbierto(false)} className="text-neutral-600 hover:text-neutral-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Resultados */}
        {hayResultados && (
          <div className="max-h-80 overflow-y-auto p-2">
            {resultados!.documentos.length > 0 && (
              <div className="mb-1">
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                  Documentos
                </p>
                {resultados!.documentos.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => navegar(`/lector/${d.id}`)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-neutral-800"
                  >
                    <FileText className="h-4 w-4 flex-shrink-0 text-neutral-500" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm text-white">{d.nombre.replace(/\.pdf$/i, '')}</p>
                      <p className="text-xs text-neutral-500">{d.autor} · {d.año}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {resultados!.citas.length > 0 && (
              <div className="mb-1">
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                  Citas
                </p>
                {resultados!.citas.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navegar(`/citas`)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-neutral-800"
                  >
                    <Quote className="h-4 w-4 flex-shrink-0 text-neutral-500" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm italic text-neutral-300">"{c.texto}"</p>
                      <p className="text-xs text-neutral-500">{c.formatoAPA}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {resultados!.notas.length > 0 && (
              <div className="mb-1">
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                  Notas
                </p>
                {resultados!.notas.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => navegar(`/notas`)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-neutral-800"
                  >
                    <StickyNote className="h-4 w-4 flex-shrink-0 text-neutral-500" />
                    <p className="flex-1 truncate text-sm text-neutral-300">{n.contenido}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {query.length >= 2 && !cargando && resultados && !hayResultados && (
          <div className="px-4 py-6 text-center text-sm text-neutral-600">
            Sin resultados para "{query}"
          </div>
        )}

        {!query && (
          <div className="px-4 py-4 text-center text-xs text-neutral-700">
            Escribí para buscar · <kbd className="rounded border border-neutral-800 px-1">Esc</kbd> para cerrar
          </div>
        )}
      </div>
    </div>
  )
}
