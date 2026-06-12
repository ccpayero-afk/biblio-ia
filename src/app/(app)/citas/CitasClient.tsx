'use client'

import { useEffect, useRef, useState } from 'react'
import { Quote, Trash2, Download, Search, BookMarked, Copy, Check, ChevronDown, X } from 'lucide-react'
import Link from 'next/link'
import { Cita } from '@/types'

// Colores de acento que se rotan por documento
const ACCENTS = [
  'border-blue-500',
  'border-violet-500',
  'border-teal-500',
  'border-amber-500',
  'border-rose-500',
  'border-emerald-500',
  'border-orange-500',
  'border-sky-500',
]

function CitaCard({ cita, accentColor, onEliminar }: { cita: Cita; accentColor: string; onEliminar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const [copiadoChicago, setCopiadoChicago] = useState(false)

  function copiar(texto: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(texto).then(() => {
      setter(true)
      setTimeout(() => setter(false), 1800)
    })
  }

  return (
    <div className={`group relative rounded-xl border border-neutral-800 bg-neutral-900 pl-4 pr-4 py-4 transition-colors hover:border-neutral-700 hover:bg-neutral-850`}>
      {/* Barra de color izquierda */}
      <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${accentColor}`} />

      {/* Texto de la cita */}
      <blockquote className="mb-3 text-sm leading-relaxed text-neutral-200 italic">
        &ldquo;{cita.texto}&rdquo;
      </blockquote>

      {/* Footer */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-neutral-400">{cita.formatoAPA}</p>
          <Link
            href={`/lector/${cita.documentoId}?pagina=${cita.pagina}&buscar=${encodeURIComponent(cita.texto.slice(0, 80))}`}
            className="flex items-center gap-1 text-xs text-neutral-600 hover:text-blue-400 transition-colors"
          >
            <BookMarked className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{cita.documentoNombre.replace(/\.pdf$/i, '')} · p.&nbsp;{cita.pagina}</span>
          </Link>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => copiar(`"${cita.texto}" ${cita.formatoAPA}`, setCopiado)}
            title="Copiar cita APA"
            className="flex items-center gap-1 rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-600 hover:text-white"
          >
            {copiado ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            APA
          </button>
          <button
            onClick={() => copiar(`"${cita.texto}" ${cita.formatoChicago}`, setCopiadoChicago)}
            title="Copiar cita Chicago"
            className="flex items-center gap-1 rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-600 hover:text-white"
          >
            {copiadoChicago ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            Chicago
          </button>
          <button
            onClick={onEliminar}
            className="rounded-lg p-1.5 text-neutral-700 hover:text-red-400 transition-colors"
            title="Eliminar cita"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {cita.etiquetas.filter((e) => e !== 'auto-ficha').length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {cita.etiquetas.filter((e) => e !== 'auto-ficha').map((e) => (
            <span key={e} className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-500">{e}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CitasClient() {
  const [citas, setCitas] = useState<Cita[]>([])
  const [filtro, setFiltro] = useState('')
  const [cargando, setCargando] = useState(true)
  const [menuExport, setMenuExport] = useState(false)
  const [filtroDoc, setFiltroDoc] = useState<string | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/citas')
      .then((r) => r.json())
      .then((data: Cita[]) => { setCitas(data); setCargando(false) })
      .catch(() => setCargando(false))
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setMenuExport(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function eliminar(id: string) {
    await fetch(`/api/citas/${id}`, { method: 'DELETE' })
    setCitas((prev) => prev.filter((c) => c.id !== id))
  }

  const citasFiltradas = citas.filter((c) => {
    if (filtroDoc && c.documentoId !== filtroDoc) return false
    if (!filtro) return true
    const q = filtro.toLowerCase()
    return (
      c.texto.toLowerCase().includes(q) ||
      c.autor.toLowerCase().includes(q) ||
      c.documentoNombre.toLowerCase().includes(q)
    )
  })

  // Agrupar por documento, manteniendo el orden de aparición
  const docOrder: string[] = []
  const citasPorDoc: Record<string, Cita[]> = {}
  for (const c of citasFiltradas) {
    if (!citasPorDoc[c.documentoId]) {
      docOrder.push(c.documentoId)
      citasPorDoc[c.documentoId] = []
    }
    citasPorDoc[c.documentoId].push(c)
  }

  // Mapa de colores por documentoId (estable)
  const docColorMap: Record<string, string> = {}
  const uniqueDocs = [...new Set(citas.map((c) => c.documentoId))]
  uniqueDocs.forEach((id, i) => { docColorMap[id] = ACCENTS[i % ACCENTS.length] })

  return (
    <div className="flex h-full flex-col overflow-hidden -m-4 md:-m-6">

      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-white">Banco de citas</h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            {citas.length} citas · {uniqueDocs.length} documentos
          </p>
        </div>
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setMenuExport((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white"
          >
            <Download className="h-4 w-4" />
            Exportar
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {menuExport && (
            <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-neutral-700 bg-neutral-900 py-1.5 shadow-2xl">
              <a
                href="/api/citas/exportar?formato=markdown"
                download
                className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
                onClick={() => setMenuExport(false)}
              >
                <Download className="h-3.5 w-3.5" /> Markdown
              </a>
              <a
                href="/api/citas/exportar?formato=docx"
                download
                className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
                onClick={() => setMenuExport(false)}
              >
                <Download className="h-3.5 w-3.5" /> Word (.docx)
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Barra de búsqueda + filtro activo */}
      <div className="flex-shrink-0 border-b border-neutral-800 bg-neutral-950 px-6 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por texto, autor o documento…"
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-2.5 pl-9 pr-4 text-sm text-white placeholder-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
          {filtro && (
            <button onClick={() => setFiltro('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-300">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {filtroDoc && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-neutral-500">Filtrando por documento:</span>
            <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
              {citas.find((c) => c.documentoId === filtroDoc)?.documentoNombre.replace(/\.pdf$/i, '') ?? filtroDoc}
            </span>
            <button onClick={() => setFiltroDoc(null)} className="text-xs text-neutral-600 hover:text-neutral-300">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar de documentos (si hay suficientes) */}
        {uniqueDocs.length > 1 && (
          <div className="hidden w-56 flex-shrink-0 overflow-y-auto border-r border-neutral-800 bg-neutral-950/50 p-3 lg:block">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-neutral-600">Documentos</p>
            <button
              onClick={() => setFiltroDoc(null)}
              className={`mb-0.5 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors ${!filtroDoc ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              <span>Todos</span>
              <span className="text-neutral-600">{citas.length}</span>
            </button>
            {uniqueDocs.map((docId) => {
              const primera = citas.find((c) => c.documentoId === docId)
              const count = citas.filter((c) => c.documentoId === docId).length
              const nombre = (primera?.documentoNombre ?? docId).replace(/\.pdf$/i, '')
              return (
                <button
                  key={docId}
                  onClick={() => setFiltroDoc(filtroDoc === docId ? null : docId)}
                  className={`mb-0.5 flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${filtroDoc === docId ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
                >
                  <div className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${docColorMap[docId]?.replace('border-', 'bg-')}`} />
                  <span className="min-w-0 flex-1 truncate text-left">{nombre}</span>
                  <span className="flex-shrink-0 text-neutral-600">{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Lista de citas */}
        <div className="flex-1 overflow-y-auto">
          {cargando ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-blue-500" />
            </div>
          ) : citasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Quote className="h-12 w-12 text-neutral-800" />
              <p className="mt-4 text-sm font-medium text-neutral-500">
                {filtro || filtroDoc ? 'Sin resultados para esa búsqueda.' : 'No hay citas guardadas.'}
              </p>
              {!filtro && !filtroDoc && (
                <p className="mt-1 text-xs text-neutral-700">Seleccioná texto en el lector para crear citas.</p>
              )}
            </div>
          ) : (
            <div className="p-6 space-y-8 max-w-3xl">
              {docOrder.map((docId) => {
                const docCitas = citasPorDoc[docId]
                if (!docCitas?.length) return null
                const primera = docCitas[0]
                const accentCls = docColorMap[docId] ?? ACCENTS[0]
                const nombre = primera.documentoNombre.replace(/\.pdf$/i, '')

                return (
                  <div key={docId}>
                    {/* Cabecera del grupo */}
                    <button
                      onClick={() => setFiltroDoc(filtroDoc === docId ? null : docId)}
                      className="mb-3 flex w-full items-center gap-3 text-left group"
                    >
                      <div className={`h-4 w-1 flex-shrink-0 rounded-full ${accentCls.replace('border-', 'bg-')}`} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">{nombre}</p>
                        {primera.autor && (
                          <p className="text-xs text-neutral-500">
                            {primera.autor}{primera.año ? ` (${primera.año})` : ''}
                            <span className="ml-2 text-neutral-700">· {docCitas.length} {docCitas.length === 1 ? 'cita' : 'citas'}</span>
                          </p>
                        )}
                      </div>
                    </button>

                    {/* Citas del grupo */}
                    <div className="space-y-2 pl-4">
                      {docCitas.map((cita) => (
                        <CitaCard
                          key={cita.id}
                          cita={cita}
                          accentColor={accentCls}
                          onEliminar={() => eliminar(cita.id)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
