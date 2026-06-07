'use client'

import { useEffect, useState } from 'react'
import { StickyNote, Trash2, Plus, Search } from 'lucide-react'
import { Nota } from '@/types'

const TIPOS_BADGE: Record<Nota['tipo'], string> = {
  manual: 'bg-neutral-800 text-neutral-400',
  ia: 'bg-blue-900/40 text-blue-400',
  consulta: 'bg-emerald-900/40 text-emerald-400',
  ficha: 'bg-amber-900/40 text-amber-400',
}

export default function NotasClient() {
  const [notas, setNotas] = useState<Nota[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [creando, setCreando] = useState(false)
  const [contenido, setContenido] = useState('')

  useEffect(() => {
    fetch('/api/notas')
      .then((r) => r.json())
      .then((data: Nota[]) => { setNotas(data); setCargando(false) })
      .catch(() => setCargando(false))
  }, [])

  async function crear() {
    if (!contenido.trim()) return
    const nueva: Nota = {
      id: `nota_${Date.now()}`,
      contenido,
      etiquetas: [],
      tipo: 'manual',
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
    }
    await fetch('/api/notas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nueva),
    })
    setNotas((prev) => [nueva, ...prev])
    setContenido('')
    setCreando(false)
  }

  async function eliminar(id: string) {
    // API doesn't have DELETE yet, filter locally
    setNotas((prev) => prev.filter((n) => n.id !== id))
  }

  const notasFiltradas = filtro
    ? notas.filter((n) => n.contenido.toLowerCase().includes(filtro.toLowerCase()))
    : notas

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Notas</h1>
          <p className="mt-1 text-sm text-neutral-500">{notas.length} notas guardadas</p>
        </div>
        <button
          onClick={() => setCreando(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" /> Nueva nota
        </button>
      </div>

      {creando && (
        <div className="mb-4 rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-3">
          <textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            placeholder="Escribí tu nota…"
            rows={4}
            autoFocus
            className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
          />
          <div className="flex gap-2">
            <button onClick={crear} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500">Guardar</button>
            <button onClick={() => setCreando(false)} className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300">Cancelar</button>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar en notas…"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 py-2 pl-9 pr-4 text-sm text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none"
        />
      </div>

      {cargando ? (
        <div className="py-10 text-center text-sm text-neutral-600">Cargando…</div>
      ) : notasFiltradas.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <StickyNote className="h-12 w-12 text-neutral-700" />
          <p className="mt-4 text-sm text-neutral-500">
            {filtro ? 'Sin resultados.' : 'No hay notas. Las notas se crean al guardar respuestas de consultas o manualmente.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notasFiltradas.map((nota) => (
            <div key={nota.id} className="group rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${TIPOS_BADGE[nota.tipo]}`}>{nota.tipo}</span>
                <span className="ml-auto text-xs text-neutral-600">{new Date(nota.creadaEn).toLocaleDateString('es')}</span>
                <button
                  onClick={() => eliminar(nota.id)}
                  className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{nota.contenido}</p>
              {nota.etiquetas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {nota.etiquetas.map((e) => (
                    <span key={e} className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-500">{e}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
