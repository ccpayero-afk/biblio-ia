'use client'

import { useEffect, useState } from 'react'
import { Quote, Trash2, Download, Search, BookMarked } from 'lucide-react'
import Link from 'next/link'
import { Cita } from '@/types'

export default function CitasClient() {
  const [citas, setCitas] = useState<Cita[]>([])
  const [filtro, setFiltro] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch('/api/citas')
      .then((r) => r.json())
      .then((data: Cita[]) => { setCitas(data); setCargando(false) })
      .catch(() => setCargando(false))
  }, [])

  async function eliminar(id: string) {
    await fetch(`/api/citas/${id}`, { method: 'DELETE' })
    setCitas((prev) => prev.filter((c) => c.id !== id))
  }

  const citasFiltradas = filtro
    ? citas.filter(
        (c) =>
          c.texto.toLowerCase().includes(filtro.toLowerCase()) ||
          c.autor.toLowerCase().includes(filtro.toLowerCase()) ||
          c.documentoNombre.toLowerCase().includes(filtro.toLowerCase())
      )
    : citas

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Banco de citas</h1>
          <p className="mt-1 text-sm text-neutral-500">{citas.length} citas guardadas</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/citas/exportar?formato=markdown"
            download
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-600"
          >
            <Download className="h-3.5 w-3.5" /> Markdown
          </a>
          <a
            href="/api/citas/exportar?formato=docx"
            download
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-600"
          >
            <Download className="h-3.5 w-3.5" /> Word
          </a>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar por texto, autor o documento…"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 py-2 pl-9 pr-4 text-sm text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none"
        />
      </div>

      {cargando ? (
        <div className="py-10 text-center text-sm text-neutral-600">Cargando…</div>
      ) : citasFiltradas.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Quote className="h-12 w-12 text-neutral-700" />
          <p className="mt-4 text-sm text-neutral-500">
            {filtro ? 'Sin resultados para esa búsqueda.' : 'No hay citas guardadas. Seleccioná texto en el lector para crear citas.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {citasFiltradas.map((cita) => (
            <div key={cita.id} className="group rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <blockquote className="text-sm text-neutral-200 italic leading-relaxed">
                "{cita.texto}"
              </blockquote>
              <div className="mt-3 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-neutral-400">{cita.formatoAPA}</p>
                  <Link
                    href={`/lector/${cita.documentoId}`}
                    className="flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-400"
                  >
                    <BookMarked className="h-3 w-3" /> {cita.documentoNombre.replace(/\.pdf$/i, '')}
                  </Link>
                </div>
                <button
                  onClick={() => eliminar(cita.id)}
                  className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-opacity"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {cita.etiquetas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {cita.etiquetas.map((e) => (
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
