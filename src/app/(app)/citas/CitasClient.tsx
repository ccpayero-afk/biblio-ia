'use client'

import { useEffect, useRef, useState } from 'react'
import { Quote, Trash2, Download, Search, BookMarked, Copy, Check, ChevronDown, X } from 'lucide-react'
import Link from 'next/link'
import { Cita } from '@/types'

function norm(str: string): string {
  return (str ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function limpiarNombre(nombre: string): string {
  const ultima = (nombre ?? '').split('/').pop() ?? nombre ?? ''
  return ultima.replace(/\.pdf$/i, '').trim()
}

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
    <div
      className="group relative rounded-xl pl-5 pr-4 py-4 transition-all"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
    >
      {/* Barra de color izquierda */}
      <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${accentColor}`} />

      {/* Texto de la cita */}
      <blockquote
        className="mb-3 text-sm leading-relaxed italic"
        style={{
          color: 'rgba(241,245,249,0.85)',
          borderLeft: 'none',
        }}
      >
        &ldquo;{cita.texto}&rdquo;
      </blockquote>

      {/* Footer */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.6)' }}>{cita.formatoAPA}</p>
          <Link
            href={`/lector/${cita.documentoId}?pagina=${cita.pagina}&buscar=${encodeURIComponent(cita.texto.slice(0, 80))}`}
            className="flex items-center gap-1 text-xs transition-colors"
            style={{ color: 'rgba(148,163,184,0.4)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#22d3ee' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}
          >
            <BookMarked className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{limpiarNombre(cita.documentoNombre)} · p.&nbsp;{cita.pagina}</span>
          </Link>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => copiar(`"${cita.texto}" ${cita.formatoAPA}`, setCopiado)}
            title="Copiar cita APA"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.6)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.color = '#a78bfa' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(148,163,184,0.6)' }}
          >
            {copiado ? <Check className="h-3 w-3" style={{ color: '#34d399' }} /> : <Copy className="h-3 w-3" />}
            APA
          </button>
          <button
            onClick={() => copiar(`"${cita.texto}" ${cita.formatoChicago}`, setCopiadoChicago)}
            title="Copiar cita Chicago"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.6)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.color = '#a78bfa' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(148,163,184,0.6)' }}
          >
            {copiadoChicago ? <Check className="h-3 w-3" style={{ color: '#34d399' }} /> : <Copy className="h-3 w-3" />}
            Chicago
          </button>
          <button
            onClick={onEliminar}
            className="rounded-lg p-1.5 transition-colors"
            title="Eliminar cita"
            style={{ color: 'rgba(148,163,184,0.3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.3)' }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {cita.etiquetas.filter((e) => e !== 'auto-ficha').length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {cita.etiquetas.filter((e) => e !== 'auto-ficha').map((e) => (
            <span
              key={e}
              className="rounded-full px-2 py-0.5 text-xs"
              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', color: 'rgba(167,139,250,0.6)' }}
            >{e}</span>
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
    const q = norm(filtro)
    return (
      norm(c.texto).includes(q) ||
      norm(c.autor).includes(q) ||
      norm(c.documentoNombre).includes(q) ||
      norm(c.notaPropia ?? '').includes(q)
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
      <div
        className="flex flex-shrink-0 items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(3,3,8,0.8)' }}
      >
        <div>
          <h1 className="text-lg font-semibold text-white">Banco de citas</h1>
          <p className="mt-0.5 text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
            {citas.length} citas · {uniqueDocs.length} documentos
          </p>
        </div>
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setMenuExport((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(203,213,225,0.7)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(203,213,225,0.7)' }}
          >
            <Download className="h-4 w-4" />
            Exportar
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {menuExport && (
            <div
              className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl py-1.5 shadow-2xl"
              style={{ background: 'rgba(10,10,22,0.97)', border: '1px solid rgba(139,92,246,0.2)', boxShadow: '0 16px 40px rgba(0,0,0,0.6)' }}
            >
              <a
                href="/api/citas/exportar?formato=markdown"
                download
                className="flex items-center gap-2 px-3 py-2 text-sm transition-colors"
                style={{ color: 'rgba(203,213,225,0.7)' }}
                onClick={() => setMenuExport(false)}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(203,213,225,0.7)' }}
              >
                <Download className="h-3.5 w-3.5" /> Markdown
              </a>
              <a
                href="/api/citas/exportar?formato=docx"
                download
                className="flex items-center gap-2 px-3 py-2 text-sm transition-colors"
                style={{ color: 'rgba(203,213,225,0.7)' }}
                onClick={() => setMenuExport(false)}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(203,213,225,0.7)' }}
              >
                <Download className="h-3.5 w-3.5" /> Word (.docx)
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Barra de búsqueda + filtro activo */}
      <div
        className="flex-shrink-0 px-6 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(3,3,8,0.5)' }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.3)' }} />
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por texto, autor o documento…"
            className="w-full rounded-xl py-2.5 pl-9 pr-4 text-sm text-white placeholder-neutral-600 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
          />
          {filtro && (
            <button
              onClick={() => setFiltro('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: 'rgba(148,163,184,0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {filtroDoc && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>Filtrando por documento:</span>
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }}
            >
              {limpiarNombre(citas.find((c) => c.documentoId === filtroDoc)?.documentoNombre ?? filtroDoc)}
            </span>
            <button
              onClick={() => setFiltroDoc(null)}
              className="text-xs transition-colors"
              style={{ color: 'rgba(148,163,184,0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar de documentos (si hay suficientes) */}
        {uniqueDocs.length > 1 && (
          <div
            className="hidden w-56 flex-shrink-0 overflow-y-auto p-3 lg:block"
            style={{ borderRight: '1px solid rgba(255,255,255,0.05)', background: 'rgba(5,5,12,0.8)' }}
          >
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(139,92,246,0.6)' }}>Documentos</p>
            <button
              onClick={() => setFiltroDoc(null)}
              className="mb-0.5 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-all"
              style={!filtroDoc
                ? { background: 'linear-gradient(90deg, rgba(109,40,217,0.25), rgba(30,58,138,0.15))', color: '#fff', border: '1px solid rgba(139,92,246,0.15)' }
                : { color: 'rgba(148,163,184,0.6)', border: '1px solid transparent' }
              }
              onMouseEnter={(e) => { if (filtroDoc) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(203,213,225,0.9)' } }}
              onMouseLeave={(e) => { if (filtroDoc) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(148,163,184,0.6)' } }}
            >
              <span>Todos</span>
              <span style={{ color: 'rgba(148,163,184,0.4)' }}>{citas.length}</span>
            </button>
            {uniqueDocs.map((docId) => {
              const primera = citas.find((c) => c.documentoId === docId)
              const count = citas.filter((c) => c.documentoId === docId).length
              const nombre = limpiarNombre(primera?.documentoNombre ?? docId)
              const isActive = filtroDoc === docId
              return (
                <button
                  key={docId}
                  onClick={() => setFiltroDoc(isActive ? null : docId)}
                  className="mb-0.5 flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition-all"
                  style={isActive
                    ? { background: 'linear-gradient(90deg, rgba(109,40,217,0.25), rgba(30,58,138,0.15))', color: '#fff', border: '1px solid rgba(139,92,246,0.15)' }
                    : { color: 'rgba(148,163,184,0.6)', border: '1px solid transparent' }
                  }
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(203,213,225,0.9)' } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(148,163,184,0.6)' } }}
                >
                  <div className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${docColorMap[docId]?.replace('border-', 'bg-')}`} />
                  <span className="min-w-0 flex-1 truncate text-left">{nombre}</span>
                  <span style={{ color: 'rgba(148,163,184,0.4)' }}>{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Lista de citas */}
        <div className="flex-1 overflow-y-auto">
          {cargando ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full" style={{ border: '2px solid rgba(139,92,246,0.2)', borderTopColor: '#a78bfa' }} />
            </div>
          ) : citasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
                style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.06))', border: '1px solid rgba(139,92,246,0.2)' }}
              >
                <Quote className="h-8 w-8" style={{ color: 'rgba(139,92,246,0.5)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'rgba(148,163,184,0.5)' }}>
                {filtro || filtroDoc ? 'Sin resultados para esa búsqueda.' : 'No hay citas guardadas.'}
              </p>
              {!filtro && !filtroDoc && (
                <p className="mt-1 text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>Seleccioná texto en el lector para crear citas.</p>
              )}
            </div>
          ) : (
            <div className="p-6 space-y-8 max-w-3xl">
              {docOrder.map((docId) => {
                const docCitas = citasPorDoc[docId]
                if (!docCitas?.length) return null
                const primera = docCitas[0]
                const accentCls = docColorMap[docId] ?? ACCENTS[0]
                const nombre = limpiarNombre(primera.documentoNombre)

                return (
                  <div key={docId}>
                    {/* Cabecera del grupo */}
                    <button
                      onClick={() => setFiltroDoc(filtroDoc === docId ? null : docId)}
                      className="group mb-3 flex w-full items-center gap-3 text-left"
                    >
                      <div className={`h-5 w-1 flex-shrink-0 rounded-full ${accentCls.replace('border-', 'bg-')}`} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white transition-colors group-hover:text-violet-300">{nombre}</p>
                        {primera.autor && (
                          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
                            {primera.autor}{primera.año ? ` (${primera.año})` : ''}
                            <span className="ml-2" style={{ color: 'rgba(148,163,184,0.3)' }}>· {docCitas.length} {docCitas.length === 1 ? 'cita' : 'citas'}</span>
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
