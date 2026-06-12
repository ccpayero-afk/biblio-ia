'use client'

import { useEffect, useRef, useState } from 'react'
import { Dato } from '@/types'
import { BarChart2, Search, X, Trash2, Copy, Check, ChevronDown, BookMarked, Download } from 'lucide-react'
import Link from 'next/link'

// Paleta de colores por temática
const TEMATICA_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pobreza:       { label: 'Pobreza',          color: 'text-red-400',      bg: 'bg-red-950/30 border-red-800/50',       dot: 'bg-red-500' },
  desigualdad:   { label: 'Desigualdad',      color: 'text-orange-400',   bg: 'bg-orange-950/30 border-orange-800/50', dot: 'bg-orange-500' },
  riqueza:       { label: 'Riqueza',          color: 'text-amber-400',    bg: 'bg-amber-950/30 border-amber-800/50',   dot: 'bg-amber-500' },
  deuda:         { label: 'Deuda',            color: 'text-yellow-400',   bg: 'bg-yellow-950/30 border-yellow-800/50', dot: 'bg-yellow-500' },
  trabajo:       { label: 'Trabajo',          color: 'text-lime-400',     bg: 'bg-lime-950/30 border-lime-800/50',     dot: 'bg-lime-500' },
  empleo:        { label: 'Empleo',           color: 'text-green-400',    bg: 'bg-green-950/30 border-green-800/50',   dot: 'bg-green-500' },
  salario:       { label: 'Salario',          color: 'text-emerald-400',  bg: 'bg-emerald-950/30 border-emerald-800/50', dot: 'bg-emerald-500' },
  poblacion:     { label: 'Población',        color: 'text-teal-400',     bg: 'bg-teal-950/30 border-teal-800/50',     dot: 'bg-teal-500' },
  educacion:     { label: 'Educación',        color: 'text-cyan-400',     bg: 'bg-cyan-950/30 border-cyan-800/50',     dot: 'bg-cyan-500' },
  salud:         { label: 'Salud',            color: 'text-sky-400',      bg: 'bg-sky-950/30 border-sky-800/50',       dot: 'bg-sky-500' },
  vivienda:      { label: 'Vivienda',         color: 'text-blue-400',     bg: 'bg-blue-950/30 border-blue-800/50',     dot: 'bg-blue-500' },
  genero:        { label: 'Género',           color: 'text-violet-400',   bg: 'bg-violet-950/30 border-violet-800/50', dot: 'bg-violet-500' },
  migracion:     { label: 'Migración',        color: 'text-purple-400',   bg: 'bg-purple-950/30 border-purple-800/50', dot: 'bg-purple-500' },
  economia:      { label: 'Economía',         color: 'text-fuchsia-400',  bg: 'bg-fuchsia-950/30 border-fuchsia-800/50', dot: 'bg-fuchsia-500' },
  finanzas:      { label: 'Finanzas',         color: 'text-pink-400',     bg: 'bg-pink-950/30 border-pink-800/50',     dot: 'bg-pink-500' },
  comercio:      { label: 'Comercio',         color: 'text-rose-400',     bg: 'bg-rose-950/30 border-rose-800/50',     dot: 'bg-rose-500' },
  industria:     { label: 'Industria',        color: 'text-slate-400',    bg: 'bg-slate-950/30 border-slate-800/50',   dot: 'bg-slate-500' },
  agricultura:   { label: 'Agricultura',      color: 'text-green-300',    bg: 'bg-green-950/20 border-green-900/40',   dot: 'bg-green-400' },
  'medio-ambiente': { label: 'Medio ambiente', color: 'text-teal-300',   bg: 'bg-teal-950/20 border-teal-900/40',     dot: 'bg-teal-400' },
  politica:      { label: 'Política',         color: 'text-indigo-400',   bg: 'bg-indigo-950/30 border-indigo-800/50', dot: 'bg-indigo-500' },
  violencia:     { label: 'Violencia',        color: 'text-red-300',      bg: 'bg-red-950/20 border-red-900/40',       dot: 'bg-red-400' },
  otro:          { label: 'Otro',             color: 'text-neutral-400',  bg: 'bg-neutral-800/30 border-neutral-700/50', dot: 'bg-neutral-500' },
}

function getTematica(t: string) {
  return TEMATICA_CONFIG[t] ?? TEMATICA_CONFIG['otro']
}

function DatoCard({ dato, onEliminar }: { dato: Dato; onEliminar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const cfg = getTematica(dato.tematica)

  function copiar() {
    const texto = `${dato.valor} — ${dato.contexto} (${dato.autor ?? ''}${dato.año ? `, ${dato.año}` : ''}${dato.pagina ? `, p. ${dato.pagina}` : ''})`
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    })
  }

  return (
    <div className={`group relative rounded-xl border p-4 transition-colors hover:brightness-110 ${cfg.bg}`}>
      {/* Badge temática */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
        {dato.año && (
          <span className="text-xs text-neutral-600">{dato.año}</span>
        )}
      </div>

      {/* Valor estadístico — protagonista */}
      <p className="text-base font-semibold leading-snug text-white">
        {dato.valor}
      </p>

      {/* Contexto */}
      {dato.contexto && (
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          {dato.contexto}
        </p>
      )}

      {/* Fuente */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          {dato.autor && (
            <p className="text-xs font-medium text-neutral-500">
              {dato.autor}{dato.año ? ` (${dato.año})` : ''}{dato.pagina ? `, p. ${dato.pagina}` : ''}
            </p>
          )}
          <Link
            href={`/lector/${dato.documentoId}?${dato.pagina ? `pagina=${dato.pagina}&` : ''}buscar=${encodeURIComponent(dato.valor.slice(0, 60))}`}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-blue-400 transition-colors"
            title="Abrir en lector"
          >
            <BookMarked className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{dato.documentoNombre.replace(/\.pdf$/i, '')}{dato.pagina ? ` · p. ${dato.pagina}` : ''}</span>
          </Link>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={copiar}
            title="Copiar dato"
            className="flex items-center gap-1 rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-600 hover:text-white"
          >
            {copiado ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            Copiar
          </button>
          <button
            onClick={onEliminar}
            className="rounded-lg p-1.5 text-neutral-700 hover:text-red-400 transition-colors"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DatosClient() {
  const [datos, setDatos] = useState<Dato[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [filtroTematica, setFiltroTematica] = useState<string | null>(null)
  const [menuExport, setMenuExport] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/datos')
      .then((r) => r.json())
      .then((data: Dato[]) => { setDatos(data); setCargando(false) })
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
    await fetch(`/api/datos/${id}`, { method: 'DELETE' })
    setDatos((prev) => prev.filter((d) => d.id !== id))
  }

  // Temáticas presentes
  const tematicasPresentes = [...new Set(datos.map((d) => d.tematica))].sort()

  const datosFiltrados = datos.filter((d) => {
    if (filtroTematica && d.tematica !== filtroTematica) return false
    if (!filtro) return true
    const q = filtro.toLowerCase()
    return (
      d.valor.toLowerCase().includes(q) ||
      d.contexto.toLowerCase().includes(q) ||
      d.documentoNombre.toLowerCase().includes(q) ||
      (d.autor ?? '').toLowerCase().includes(q)
    )
  })

  // Agrupar por temática
  const tematicasEnVista = [...new Set(datosFiltrados.map((d) => d.tematica))].sort()
  const porTematica: Record<string, Dato[]> = {}
  for (const d of datosFiltrados) {
    if (!porTematica[d.tematica]) porTematica[d.tematica] = []
    porTematica[d.tematica].push(d)
  }

  function exportarMarkdown() {
    const lines: string[] = ['# Banco de datos estadísticos\n']
    tematicasEnVista.forEach((t) => {
      const cfg = getTematica(t)
      lines.push(`## ${cfg.label}\n`)
      porTematica[t].forEach((d) => {
        lines.push(`**${d.valor}**`)
        if (d.contexto) lines.push(d.contexto)
        lines.push(`*Fuente: ${d.autor ?? ''}${d.año ? ` (${d.año})` : ''}${d.pagina ? `, p. ${d.pagina}` : ''} — ${d.documentoNombre.replace(/\.pdf$/i, '')}*\n`)
      })
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'datos-estadisticos.md'; a.click()
    URL.revokeObjectURL(url)
    setMenuExport(false)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden -m-4 md:-m-6">

      {/* Header */}
      <div
        className="flex flex-shrink-0 items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(3,3,8,0.8)' }}
      >
        <div>
          <h1 className="text-lg font-semibold text-white">Banco de datos</h1>
          <p className="mt-0.5 text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
            {datos.length} datos · {tematicasPresentes.length} temáticas
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
              <button
                onClick={exportarMarkdown}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
                style={{ color: 'rgba(203,213,225,0.7)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(203,213,225,0.7)' }}
              >
                <Download className="h-3.5 w-3.5" /> Markdown
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Buscador */}
      <div
        className="flex-shrink-0 px-6 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(3,3,8,0.5)' }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.3)' }} />
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por valor, contexto, autor o documento…"
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
        {filtroTematica && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>Temática:</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getTematica(filtroTematica).bg} ${getTematica(filtroTematica).color}`}>
              {getTematica(filtroTematica).label}
            </span>
            <button
              onClick={() => setFiltroTematica(null)}
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

        {/* Sidebar temáticas */}
        {tematicasPresentes.length > 1 && (
          <div
            className="hidden w-52 flex-shrink-0 overflow-y-auto p-3 lg:block"
            style={{ borderRight: '1px solid rgba(255,255,255,0.05)', background: 'rgba(5,5,12,0.8)' }}
          >
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(139,92,246,0.6)' }}>Temáticas</p>
            <button
              onClick={() => setFiltroTematica(null)}
              className="mb-0.5 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-all"
              style={!filtroTematica
                ? { background: 'linear-gradient(90deg, rgba(109,40,217,0.25), rgba(30,58,138,0.15))', color: '#fff', border: '1px solid rgba(139,92,246,0.15)' }
                : { color: 'rgba(148,163,184,0.6)', border: '1px solid transparent' }
              }
              onMouseEnter={(e) => { if (filtroTematica) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(203,213,225,0.9)' } }}
              onMouseLeave={(e) => { if (filtroTematica) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(148,163,184,0.6)' } }}
            >
              <span>Todas</span>
              <span style={{ color: 'rgba(148,163,184,0.4)' }}>{datos.length}</span>
            </button>
            {tematicasPresentes.map((t) => {
              const cfg = getTematica(t)
              const count = datos.filter((d) => d.tematica === t).length
              const isActive = filtroTematica === t
              return (
                <button
                  key={t}
                  onClick={() => setFiltroTematica(isActive ? null : t)}
                  className="mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-all"
                  style={isActive
                    ? { background: 'linear-gradient(90deg, rgba(109,40,217,0.25), rgba(30,58,138,0.15))', color: '#fff', border: '1px solid rgba(139,92,246,0.15)' }
                    : { color: 'rgba(148,163,184,0.6)', border: '1px solid transparent' }
                  }
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(203,213,225,0.9)' } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(148,163,184,0.6)' } }}
                >
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`} />
                  <span className="flex-1 text-left">{cfg.label}</span>
                  <span style={{ color: 'rgba(148,163,184,0.4)' }}>{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {cargando ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full" style={{ border: '2px solid rgba(139,92,246,0.2)', borderTopColor: '#a78bfa' }} />
            </div>
          ) : datosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
                style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.06))', border: '1px solid rgba(139,92,246,0.2)' }}
              >
                <BarChart2 className="h-8 w-8" style={{ color: 'rgba(139,92,246,0.5)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'rgba(148,163,184,0.5)' }}>
                {filtro || filtroTematica ? 'Sin resultados para esa búsqueda.' : 'No hay datos estadísticos guardados.'}
              </p>
              {!filtro && !filtroTematica && (
                <p className="mt-1 text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>
                  Usá el pipeline "Procesar biblioteca" para extraer datos de las fichas.
                </p>
              )}
            </div>
          ) : (
            <div className="p-6 space-y-10 max-w-4xl">
              {tematicasEnVista.map((t) => {
                const cfg = getTematica(t)
                const items = porTematica[t]
                if (!items?.length) return null
                return (
                  <div key={t}>
                    {/* Cabecera de grupo */}
                    <button
                      onClick={() => setFiltroTematica(filtroTematica === t ? null : t)}
                      className="mb-4 flex items-center gap-3 group text-left"
                    >
                      <span className={`h-3 w-3 flex-shrink-0 rounded-full ${cfg.dot}`} />
                      <h2 className={`text-sm font-bold uppercase tracking-wide ${cfg.color} group-hover:opacity-80 transition-opacity`}>
                        {cfg.label}
                      </h2>
                      <span className="text-xs text-neutral-600">{items.length} datos</span>
                    </button>

                    {/* Grid de datos */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {items.map((d) => (
                        <DatoCard key={d.id} dato={d} onEliminar={() => eliminar(d.id)} />
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
