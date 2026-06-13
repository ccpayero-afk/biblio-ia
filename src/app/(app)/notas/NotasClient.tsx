'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Nota, TipoNota, VinculoZettel, VinculoSugerido, Cita } from '@/types' // VinculoSugerido usado en Editor
import {
  Plus, Search, X, Link2, Loader2, ChevronRight,
  AlertTriangle, Sparkles, Check, RefreshCw, Zap, BookOpen, ArrowLeft, Trash2, Download, Pin, History,
} from 'lucide-react'
import Link from 'next/link'
import { generarIdZettel } from '@/lib/zettel-id'

// ─── Configuración de tipos ──────────────────────────────────────────────────

const TIPOS_ZETTEL: { tipo: TipoNota; label: string; desc: string; color: string; barColor: string; dotColor: string }[] = [
  { tipo: 'efimera',    label: 'Efímera',    desc: 'Captura rápida, sin procesar todavía',          color: 'text-orange-400 bg-orange-950/40 border-orange-800/50', barColor: 'bg-orange-500', dotColor: 'bg-orange-500' },
  { tipo: 'referencia', label: 'Referencia', desc: 'Sobre un texto específico de la biblioteca',     color: 'text-blue-400 bg-blue-950/40 border-blue-800/50',       barColor: 'bg-blue-500',   dotColor: 'bg-blue-500'   },
  { tipo: 'permanente', label: 'Permanente', desc: 'Una idea propia, desvinculada del origen',       color: 'text-green-400 bg-green-950/40 border-green-800/50',    barColor: 'bg-green-500',  dotColor: 'bg-green-500'  },
  { tipo: 'estructura', label: 'Estructura', desc: 'Índice de entrada a un tema o cluster',          color: 'text-purple-400 bg-purple-950/40 border-purple-800/50', barColor: 'bg-purple-500', dotColor: 'bg-purple-500' },
  { tipo: 'proyecto',   label: 'Proyecto',   desc: 'Trabajo para un artículo o tesis específica',   color: 'text-teal-400 bg-teal-950/40 border-teal-800/50',       barColor: 'bg-teal-500',   dotColor: 'bg-teal-500'   },
]

const TIPOS_VINCULO: { tipo: VinculoZettel['tipo']; label: string }[] = [
  { tipo: 'complementa', label: 'Complementa' },
  { tipo: 'contradice', label: 'Contradice' },
  { tipo: 'ejemplifica', label: 'Ejemplifica' },
  { tipo: 'aplica_en', label: 'Aplica en' },
  { tipo: 'es_consecuencia_de', label: 'Es consecuencia de' },
  { tipo: 'cuestiona', label: 'Cuestiona' },
  { tipo: 'define', label: 'Define' },
  { tipo: 'ver_tambien', label: 'Ver también' },
]

const VINCULO_COLOR: Record<VinculoZettel['tipo'], string> = {
  complementa:        'text-blue-400 bg-blue-950/50 border-blue-800/40',
  contradice:         'text-red-400 bg-red-950/50 border-red-800/40',
  ejemplifica:        'text-amber-400 bg-amber-950/50 border-amber-800/40',
  aplica_en:          'text-green-400 bg-green-950/50 border-green-800/40',
  es_consecuencia_de: 'text-purple-400 bg-purple-950/50 border-purple-800/40',
  cuestiona:          'text-orange-400 bg-orange-950/50 border-orange-800/40',
  define:             'text-teal-400 bg-teal-950/50 border-teal-800/40',
  ver_tambien:        'text-neutral-400 bg-neutral-800/60 border-neutral-700/40',
}

function vinculoLabel(tipo: VinculoZettel['tipo']) {
  return TIPOS_VINCULO.find((t) => t.tipo === tipo)?.label ?? tipo.replace(/_/g, ' ')
}

function tipoBadge(tipo: TipoNota) {
  const cfg = TIPOS_ZETTEL.find((t) => t.tipo === tipo)
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

// ─── Editor modal ─────────────────────────────────────────────────────────────

function Editor({
  nota,
  todasLasNotas,
  onGuardar,
  onCerrar,
}: {
  nota: Partial<Nota>
  todasLasNotas: Nota[]
  onGuardar: (n: Partial<Nota>) => Promise<void>
  onCerrar: () => void
}) {
  const [titulo, setTitulo] = useState(nota.titulo ?? '')
  const [contenido, setContenido] = useState(nota.contenido ?? '')
  const [tipo, setTipo] = useState<TipoNota>(nota.tipo ?? 'efimera')
  const [etiquetas, setEtiquetas] = useState((nota.etiquetas ?? []).join(', '))
  const [vinculos, setVinculos] = useState<VinculoZettel[]>(nota.vinculos ?? [])
  const [guardando, setGuardando] = useState(false)
  const [buscarVinculo, setBuscarVinculo] = useState('')
  const [tipoVinculo, setTipoVinculo] = useState<VinculoZettel['tipo']>('ver_tambien')
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false)
  const [sugerencias, setSugerencias] = useState<VinculoSugerido[]>([])
  const [buscandoSugerencias, setBuscandoSugerencias] = useState(false)
  const [autocomplete, setAutocomplete] = useState<{ query: string; pos: number } | null>(null)
  const [acIndex, setAcIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [citasBusqueda, setCitasBusqueda] = useState('')
  const [citasDisponibles, setCitasDisponibles] = useState<Cita[]>([])
  const [citaSelId, setCitaSelId] = useState<string | null>(nota.citaOrigenId ?? null)
  const [citaExpandida, setCitaExpandida] = useState(false)

  useEffect(() => {
    fetch('/api/citas').then((r) => r.json()).then((data) => setCitasDisponibles(Array.isArray(data) ? data : []))
  }, [])

  const acSugerencias = autocomplete
    ? todasLasNotas
        .filter((n) => n.id !== nota.id && n.titulo.toLowerCase().includes(autocomplete.query.toLowerCase()))
        .slice(0, 8)
    : []

  function onContenidoChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setContenido(val)
    const cursor = e.target.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const match = before.match(/\[\[([^\]]*)?$/)
    if (match) {
      setAutocomplete({ query: match[1] ?? '', pos: before.lastIndexOf('[[') })
      setAcIndex(0)
    } else {
      setAutocomplete(null)
    }
  }

  function insertarNotaAc(n: Nota) {
    if (!textareaRef.current || !autocomplete) return
    const cursor = textareaRef.current.selectionStart ?? contenido.length
    const antes = contenido.slice(0, autocomplete.pos)
    const despues = contenido.slice(cursor)
    const nuevo = `${antes}[[${n.id}]]${despues}`
    setContenido(nuevo)
    setAutocomplete(null)
    // restaurar foco y posición del cursor después del link insertado
    requestAnimationFrame(() => {
      if (!textareaRef.current) return
      textareaRef.current.focus()
      const pos = antes.length + `[[${n.id}]]`.length
      textareaRef.current.setSelectionRange(pos, pos)
    })
  }

  function onContenidoKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!autocomplete || acSugerencias.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setAcIndex((i) => (i + 1) % acSugerencias.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAcIndex((i) => (i - 1 + acSugerencias.length) % acSugerencias.length) }
    else if (e.key === 'Enter') { e.preventDefault(); insertarNotaAc(acSugerencias[acIndex]) }
    else if (e.key === 'Escape') { e.preventDefault(); setAutocomplete(null) }
  }

  const candidatas = todasLasNotas.filter(
    (n) =>
      n.id !== nota.id &&
      !vinculos.find((v) => v.notaDestinoId === n.id) &&
      (buscarVinculo === '' || n.titulo.toLowerCase().includes(buscarVinculo.toLowerCase()))
  )

  async function buscarSugerencias() {
    if (!contenido.trim()) return
    setBuscandoSugerencias(true)
    try {
      const res = await fetch('/api/notas/ia/sugerir-vinculos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nota: { id: nota.id ?? 'nueva', titulo, contenido, tipo, vinculos, etiquetas: [], creadaEn: new Date().toISOString(), actualizadaEn: new Date().toISOString() },
        }),
      })
      const data = await res.json()
      if (Array.isArray(data)) setSugerencias(data)
    } catch { /* silencioso */ }
    setBuscandoSugerencias(false)
  }

  function agregarVinculo(n: Nota) {
    if (vinculos.find((v) => v.notaDestinoId === n.id)) return
    setVinculos((prev) => [
      ...prev,
      { notaDestinoId: n.id, tipo: tipoVinculo, bidireccional: true, creadoEn: new Date().toISOString() },
    ])
    setBuscarVinculo('')
    setMostrarBusqueda(false)
  }

  function agregarSugerida(s: VinculoSugerido) {
    if (vinculos.find((v) => v.notaDestinoId === s.notaId)) return
    setVinculos((prev) => [
      ...prev,
      { notaDestinoId: s.notaId, tipo: s.tipoVinculo, bidireccional: true, creadoEn: new Date().toISOString() },
    ])
    setSugerencias((prev) => prev.filter((x) => x.notaId !== s.notaId))
  }

  async function guardar() {
    setGuardando(true)
    await onGuardar({
      ...nota,
      titulo: titulo.trim() || 'Sin título',
      contenido,
      tipo,
      etiquetas: etiquetas.split(',').map((e) => e.trim()).filter(Boolean),
      vinculos,
      citaOrigenId: citaSelId ?? undefined,
    })
    setGuardando(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}
    >
      <div
        className="flex h-full max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, #0d0d1f 0%, #080810 100%)',
          border: '1px solid rgba(139,92,246,0.2)',
          boxShadow: '0 0 40px rgba(124,58,237,0.15), 0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3">
            {nota.id ? (
              <button
                onClick={() => navigator.clipboard.writeText(`[[${nota.id}]]`)}
                title="Copiar [[ID]]"
                className="font-mono text-xs text-neutral-600 hover:text-neutral-400"
              >
                {nota.id}
              </button>
            ) : (
              <span className="text-xs text-neutral-600">Nueva nota</span>
            )}
            {tipoBadge(tipo)}
          </div>
          <button
            onClick={onCerrar}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: 'rgba(148,163,184,0.5)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.5)'; e.currentTarget.style.background = '' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título (una afirmación, no un tema)"
              className="w-full rounded-lg px-3 py-2 text-lg font-semibold text-white placeholder:text-neutral-600 focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = '' }}
            />
            {/* Cita de origen */}
            <div className="rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
              <button
                onClick={() => setCitaExpandida((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                <Pin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: citaSelId ? '#a78bfa' : 'rgba(148,163,184,0.4)' }} />
                <span className="text-xs" style={{ color: citaSelId ? '#a78bfa' : 'rgba(148,163,184,0.5)' }}>
                  Cita de origen{citaSelId ? '' : ' (sin vincular)'}
                </span>
              </button>
              {citaExpandida && (
                <div className="border-t px-3 pb-3 pt-2 space-y-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {citaSelId && (() => {
                    const citaSel = citasDisponibles.find((c) => c.id === citaSelId)
                    return citaSel ? (
                      <div className="flex items-start justify-between gap-2 rounded-lg p-2" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-neutral-300">{citaSel.texto.slice(0, 80)}{citaSel.texto.length > 80 ? '…' : ''}</p>
                          <p className="text-xs" style={{ color: 'rgba(167,139,250,0.7)' }}>{citaSel.autor}</p>
                        </div>
                        <button onClick={() => setCitaSelId(null)} className="flex-shrink-0 text-xs text-neutral-500 hover:text-red-400">✕ Quitar vínculo</button>
                      </div>
                    ) : null
                  })()}
                  <input
                    value={citasBusqueda}
                    onChange={(e) => setCitasBusqueda(e.target.value)}
                    placeholder="Buscar cita..."
                    className="w-full rounded px-2 py-1.5 text-xs text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  />
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {citasDisponibles
                      .filter((c) => !citasBusqueda || c.texto.toLowerCase().includes(citasBusqueda.toLowerCase()) || c.autor.toLowerCase().includes(citasBusqueda.toLowerCase()))
                      .slice(0, 10)
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setCitaSelId(c.id)}
                          className="block w-full rounded px-2 py-1.5 text-left text-xs transition-colors"
                          style={{
                            background: citaSelId === c.id ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                            border: citaSelId === c.id ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.06)',
                            color: 'rgba(203,213,225,0.8)',
                          }}
                        >
                          <span className="block truncate">{c.texto.slice(0, 80)}{c.texto.length > 80 ? '…' : ''}</span>
                          <span className="text-xs" style={{ color: 'rgba(167,139,250,0.6)' }}>{c.autor}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {TIPOS_ZETTEL.map((t) => (
                <button
                  key={t.tipo}
                  onClick={() => setTipo(t.tipo)}
                  title={t.desc}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${tipo === t.tipo ? t.color : 'border-neutral-800 text-neutral-500 hover:border-neutral-600'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tipo === 'efimera' && (
              <div className="flex items-start gap-2 rounded-lg border border-orange-900/40 bg-orange-950/10 px-4 py-3 text-xs text-orange-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>Nota de captura. Escribí la idea, después convertila en permanente.</span>
              </div>
            )}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={contenido}
                onChange={onContenidoChange}
                onKeyDown={onContenidoKeyDown}
                placeholder="Escribí una sola idea. Si tenés más de una, creá otra nota."
                rows={10}
                className="w-full resize-none rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.08)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = '' }}
              />
              {autocomplete && acSugerencias.length > 0 && (
                <div
                  className="absolute left-0 right-0 z-50 overflow-y-auto rounded-lg"
                  style={{
                    top: '100%',
                    marginTop: 4,
                    background: '#0d0d1a',
                    border: '1px solid rgba(139,92,246,0.4)',
                    borderRadius: 8,
                    maxHeight: 280,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  {acSugerencias.map((n, i) => (
                    <button
                      key={n.id}
                      onMouseDown={(e) => { e.preventDefault(); insertarNotaAc(n) }}
                      className="block w-full px-3 py-2 text-left text-sm text-white"
                      style={{ background: i === acIndex ? 'rgba(139,92,246,0.15)' : '' }}
                      onMouseEnter={() => setAcIndex(i)}
                    >
                      <span className="font-mono text-xs" style={{ color: 'rgba(139,92,246,0.7)' }}>{n.id}</span>
                      <span className="ml-2">{n.titulo}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              value={etiquetas}
              onChange={(e) => setEtiquetas(e.target.value)}
              placeholder="Etiquetas separadas por coma: gramsci, hegemonía"
              className="rounded-lg px-3 py-2 text-sm text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
            />
          </div>

          {/* Panel de vínculos */}
          <div
            className="w-64 flex-shrink-0 overflow-y-auto p-4"
            style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', background: 'rgba(5,5,12,0.5)' }}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(139,92,246,0.7)' }}>
              Vínculos ({vinculos.length})
            </p>
            {vinculos.map((v, i) => {
              const destino = todasLasNotas.find((n) => n.id === v.notaDestinoId)
              return (
                <div
                  key={i}
                  className="mb-2 rounded-lg p-2"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <span className="block text-xs font-medium text-neutral-500">{v.tipo.replace(/_/g, ' ')}</span>
                      <span className="block truncate text-xs text-neutral-300">{destino?.titulo ?? v.notaDestinoId}</span>
                    </div>
                    <button
                      onClick={() => setVinculos((prev) => prev.filter((_, j) => j !== i))}
                      className="flex-shrink-0 rounded p-0.5 text-neutral-700 hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}

            {mostrarBusqueda ? (
              <div className="mt-2 space-y-2">
                <select
                  value={tipoVinculo}
                  onChange={(e) => setTipoVinculo(e.target.value as VinculoZettel['tipo'])}
                  className="w-full rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {TIPOS_VINCULO.map((t) => (
                    <option key={t.tipo} value={t.tipo}>{t.label}</option>
                  ))}
                </select>
                <input
                  value={buscarVinculo}
                  onChange={(e) => setBuscarVinculo(e.target.value)}
                  placeholder="Buscar nota..."
                  className="w-full rounded px-2 py-1 text-xs text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {candidatas.slice(0, 10).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => agregarVinculo(n)}
                      className="block w-full truncate rounded px-2 py-1 text-left text-xs text-neutral-400 transition-colors"
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; e.currentTarget.style.color = '#fff' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '' }}
                    >
                      {n.titulo}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setMostrarBusqueda(false)}
                  className="text-xs transition-colors"
                  style={{ color: 'rgba(148,163,184,0.4)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.8)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}
                >Cancelar</button>
              </div>
            ) : (
              <button
                onClick={() => setMostrarBusqueda(true)}
                className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-all"
                style={{
                  border: '1px dashed rgba(139,92,246,0.25)',
                  color: 'rgba(148,163,184,0.5)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; e.currentTarget.style.color = '#a78bfa'; e.currentTarget.style.background = 'rgba(139,92,246,0.06)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)'; e.currentTarget.style.color = 'rgba(148,163,184,0.5)'; e.currentTarget.style.background = '' }}
              >
                <Link2 className="h-3.5 w-3.5" /> Agregar vínculo
              </button>
            )}

            <button
              onClick={buscarSugerencias}
              disabled={buscandoSugerencias || !contenido.trim()}
              className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-all disabled:opacity-40"
              style={{
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(148,163,184,0.6)',
              }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.color = '#a78bfa' } }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(148,163,184,0.6)' }}
            >
              {buscandoSugerencias ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Sugerir con IA
            </button>

            {sugerencias.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.5)' }}>Sugeridas:</p>
                {sugerencias.map((s) => (
                  <div
                    key={s.notaId}
                    className="rounded-lg p-2"
                    style={{ border: '1px solid rgba(6,182,212,0.2)', background: 'rgba(6,182,212,0.05)' }}
                  >
                    <p className="truncate text-xs text-neutral-300">{s.notaTitulo}</p>
                    <p className="text-xs" style={{ color: '#22d3ee' }}>{s.tipoVinculo.replace(/_/g, ' ')}</p>
                    <p className="mt-0.5 text-xs text-neutral-600 line-clamp-2">{s.razon}</p>
                    <button onClick={() => agregarSugerida(s)} className="mt-1 flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
                      <Check className="h-3 w-3" /> Agregar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={onCerrar}
            className="rounded-lg px-4 py-2 text-sm transition-colors"
            style={{ color: 'rgba(148,163,184,0.6)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.6)' }}
          >Cancelar</button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 10px rgba(124,58,237,0.25)' }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.boxShadow = '0 0 18px rgba(124,58,237,0.45)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 10px rgba(124,58,237,0.25)' }}
          >
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Vista de detalle ─────────────────────────────────────────────────────────


function NotaDetalle({
  nota,
  todasLasNotas,
  onEditar,
  onEliminar,
  onSeleccionarNota,
  onFiltrarEtiqueta,
  onRefrescar,
}: {
  nota: Nota
  todasLasNotas: Nota[]
  onEditar: () => void
  onEliminar: () => void
  onSeleccionarNota: (n: Nota) => void
  onFiltrarEtiqueta: (e: string) => void
  onRefrescar?: () => Promise<void>
}) {
  const [comentario, setComentario] = useState(nota.comentarioPersonal ?? '')
  const [guardandoComentario, setGuardandoComentario] = useState(false)
  const [convertiendo, setConvirtiendo] = useState(false)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [restaurando, setRestaurando] = useState<string | null>(null)
  const [sugerencia, setSugerencia] = useState<null | {
    titulo_sugerido: string
    contenido_sugerido: string
    tipo_sugerido: 'permanente' | 'estructura' | 'proyecto'
    etiquetas_sugeridas: string[]
    razon_titulo: string
  }>(null)

  async function convertir() {
    setConvirtiendo(true)
    try {
      const res = await fetch(`/api/notas/${nota.id}/convertir`, { method: 'POST' })
      const data = await res.json()
      if (!data.error) setSugerencia(data)
    } catch { /* silencioso */ }
    setConvirtiendo(false)
  }

  const esEfimera = nota.tipo === 'efimera' || nota.tipo === 'manual'
  const vinculos = nota.vinculos ?? []

  // Backlinks: notas que tienen un vínculo apuntando a esta nota
  const backlinks = todasLasNotas.filter(
    (n) => n.id !== nota.id && (n.vinculos ?? []).some((v) => v.notaDestinoId === nota.id)
  )

  // Etiquetas visibles (excluye tags de sistema internos)
  const etiquetasUsuario = nota.etiquetas.filter(
    (e) => e !== 'auto-ficha' && e !== 'auto-highlights'
  )
  const etiquetasSistema = nota.etiquetas.filter(
    (e) => e === 'auto-ficha' || e === 'auto-highlights'
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigator.clipboard.writeText(`[[${nota.id}]]`)}
            title="Copiar [[ID]]"
            className="font-mono text-xs transition-colors"
            style={{ color: 'rgba(148,163,184,0.3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(167,139,250,0.8)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.3)' }}
          >
            {nota.id}
          </button>
          {tipoBadge(nota.tipo)}
        </div>
        <div className="flex items-center gap-2">
          {(nota.versiones ?? []).length > 0 && (
            <button
              onClick={() => setMostrarHistorial((v) => !v)}
              title="Historial de versiones"
              className="rounded-lg px-2 py-1.5 text-xs transition-all"
              style={mostrarHistorial
                ? { border: '1px solid rgba(139,92,246,0.5)', color: '#a78bfa', background: 'rgba(139,92,246,0.1)' }
                : { border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.6)' }
              }
              onMouseEnter={(e) => { if (!mostrarHistorial) { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.color = '#a78bfa' } }}
              onMouseLeave={(e) => { if (!mostrarHistorial) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(148,163,184,0.6)' } }}
            >
              <History className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onEditar}
            className="rounded-lg px-3 py-1.5 text-xs transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(203,213,225,0.8)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(139,92,246,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(203,213,225,0.8)'; e.currentTarget.style.background = '' }}
          >
            Editar
          </button>
          <button
            onClick={onEliminar}
            className="rounded-lg px-3 py-1.5 text-xs transition-all"
            style={{ border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.8)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; e.currentTarget.style.background = '' }}
          >
            Eliminar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Banner efímera */}
        {esEfimera && !sugerencia && (
          <div
            className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
            style={{
              background: 'linear-gradient(135deg, rgba(251,146,60,0.08) 0%, rgba(245,158,11,0.05) 100%)',
              border: '1px solid rgba(251,146,60,0.25)',
            }}
          >
            <div className="flex items-center gap-2 text-xs" style={{ color: '#fb923c' }}>
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>Captura sin procesar. Convertila en permanente cuando estés list@.</span>
            </div>
            <button
              onClick={convertir}
              disabled={convertiendo}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{ background: 'rgba(251,146,60,0.15)', color: '#fdba74', border: '1px solid rgba(251,146,60,0.2)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(251,146,60,0.25)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(251,146,60,0.15)' }}
            >
              {convertiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Convertir
            </button>
          </div>
        )}

        {/* Sugerencia de conversión */}
        {sugerencia && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: 'linear-gradient(135deg, rgba(52,211,153,0.07) 0%, rgba(16,185,129,0.04) 100%)',
              border: '1px solid rgba(52,211,153,0.2)',
            }}
          >
            <p className="text-xs font-semibold" style={{ color: '#34d399' }}>Sugerencia de conversión</p>
            <div>
              <p className="text-xs text-neutral-500">Título sugerido</p>
              <p className="text-sm font-medium text-white">{sugerencia.titulo_sugerido}</p>
              <p className="text-xs text-neutral-600">{sugerencia.razon_titulo}</p>
            </div>
            <p className="text-sm text-neutral-300 whitespace-pre-wrap">{sugerencia.contenido_sugerido}</p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await fetch(`/api/notas/${nota.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      titulo: sugerencia.titulo_sugerido,
                      contenido: sugerencia.contenido_sugerido,
                      tipo: sugerencia.tipo_sugerido,
                      etiquetas: sugerencia.etiquetas_sugeridas,
                    }),
                  })
                  window.location.reload()
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all"
                style={{ background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(52,211,153,0.3)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(52,211,153,0.2)' }}
              >
                Aceptar
              </button>
              <button
                onClick={() => setSugerencia(null)}
                className="rounded-lg px-3 py-1.5 text-xs transition-all"
                style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.6)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.6)' }}
              >
                Descartar
              </button>
            </div>
          </div>
        )}

        {/* Título y contenido */}
        <div>
          <h1 className="text-xl font-bold leading-snug text-white">{nota.titulo}</h1>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">{nota.contenido}</p>
        </div>

        {/* Etiquetas del usuario */}
        {etiquetasUsuario.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(139,92,246,0.5)' }}>Etiquetas</p>
            <div className="flex flex-wrap gap-1.5">
              {etiquetasUsuario.map((e) => (
                <button
                  key={e}
                  onClick={() => onFiltrarEtiqueta(e)}
                  title={`Filtrar por #${e}`}
                  className="rounded-full px-2.5 py-1 text-xs transition-all"
                  style={{
                    background: 'rgba(139,92,246,0.08)',
                    border: '1px solid rgba(139,92,246,0.2)',
                    color: 'rgba(167,139,250,0.7)',
                  }}
                  onMouseEnter={(e2) => { e2.currentTarget.style.background = 'rgba(139,92,246,0.16)'; e2.currentTarget.style.borderColor = 'rgba(139,92,246,0.45)'; e2.currentTarget.style.color = '#a78bfa' }}
                  onMouseLeave={(e2) => { e2.currentTarget.style.background = 'rgba(139,92,246,0.08)'; e2.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)'; e2.currentTarget.style.color = 'rgba(167,139,250,0.7)' }}
                >
                  #{e}
                </button>
              ))}
              {etiquetasSistema.map((e) => (
                <span
                  key={e}
                  className="rounded-full px-2.5 py-1 text-xs"
                  style={{ border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(148,163,184,0.3)' }}
                >
                  #{e}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Vínculos SALIENTES */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(139,92,246,0.5)' }}>
            Vínculos ({vinculos.length})
          </p>
          {vinculos.length === 0 ? (
            <div
              className="rounded-xl px-4 py-5 text-center"
              style={{ border: '1px dashed rgba(139,92,246,0.2)' }}
            >
              <Link2 className="mx-auto h-5 w-5" style={{ color: 'rgba(139,92,246,0.3)' }} />
              <p className="mt-2 text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>Sin vínculos todavía</p>
              <p className="mt-0.5 text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>
                Editá la nota y usá <span style={{ color: 'rgba(167,139,250,0.6)' }}>Sugerir con IA</span> para descubrir conexiones automáticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {vinculos.map((v, i) => {
                const destino = todasLasNotas.find((n) => n.id === v.notaDestinoId)
                const colores = VINCULO_COLOR[v.tipo] ?? VINCULO_COLOR.ver_tambien
                const destCfg = destino ? TIPOS_ZETTEL.find((t) => t.tipo === destino.tipo) : null
                return (
                  <button
                    key={i}
                    onClick={() => destino && onSeleccionarNota(destino)}
                    disabled={!destino}
                    className="group flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)' } }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
                  >
                    <span className={`mt-px flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${colores}`}>
                      {vinculoLabel(v.tipo)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-neutral-200 group-hover:text-white">
                        {destino?.titulo ?? v.notaDestinoId}
                      </p>
                      {destCfg && (
                        <p className={`mt-0.5 text-xs ${destCfg.color.split(' ')[0]}`}>
                          {destCfg.label}
                        </p>
                      )}
                      {v.nota && (
                        <p className="mt-1 text-xs leading-relaxed text-neutral-600">{v.nota}</p>
                      )}
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-700 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-400" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Backlinks: notas que apuntan A ESTA */}
        {backlinks.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(6,182,212,0.6)' }}>
              Mencionada en ({backlinks.length})
            </p>
            <div className="space-y-1.5">
              {backlinks.map((bl) => {
                const blCfg = TIPOS_ZETTEL.find((t) => t.tipo === bl.tipo)
                const vinculo = (bl.vinculos ?? []).find((v) => v.notaDestinoId === nota.id)
                const colores = vinculo ? (VINCULO_COLOR[vinculo.tipo] ?? VINCULO_COLOR.ver_tambien) : null
                return (
                  <button
                    key={bl.id}
                    onClick={() => onSeleccionarNota(bl)}
                    className="group flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all"
                    style={{ background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.12)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(6,182,212,0.08)'; e.currentTarget.style.borderColor = 'rgba(6,182,212,0.25)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(6,182,212,0.04)'; e.currentTarget.style.borderColor = 'rgba(6,182,212,0.12)' }}
                  >
                    <ArrowLeft className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-neutral-700 group-hover:text-neutral-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-neutral-300 group-hover:text-white">
                        {bl.titulo}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        {blCfg && (
                          <span className={`text-xs ${blCfg.color.split(' ')[0]}`}>{blCfg.label}</span>
                        )}
                        {colores && vinculo && (
                          <span className={`rounded-full border px-1.5 py-px text-xs ${colores}`}>
                            {vinculoLabel(vinculo.tipo)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-700 group-hover:text-neutral-400" />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Origen del documento */}
        {(nota.documentoOrigenId ?? nota.documentoId) && (
          <div
            className="rounded-xl p-3"
            style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium" style={{ color: 'rgba(6,182,212,0.7)' }}>Documento origen</p>
              <Link
                href={`/lector/${nota.documentoOrigenId ?? nota.documentoId}${(nota.paginaOrigen ?? nota.pagina) ? `?pagina=${nota.paginaOrigen ?? nota.pagina}` : ''}`}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-blue-400 hover:bg-blue-950/30 hover:text-blue-300 transition-colors"
              >
                <BookOpen className="h-3 w-3" /> Abrir en lector
              </Link>
            </div>
            <p className="mt-1 text-xs text-neutral-600">
              {(nota.paginaOrigen ?? nota.pagina) ? `p. ${nota.paginaOrigen ?? nota.pagina}` : 'Sin página'}
            </p>
          </div>
        )}

        {/* Comentario personal */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(139,92,246,0.5)' }}>Mis notas</p>
            {guardandoComentario && (
              <span className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>Guardando…</span>
            )}
          </div>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            onBlur={async () => {
              if (comentario === (nota.comentarioPersonal ?? '')) return
              setGuardandoComentario(true)
              await fetch(`/api/notas/${nota.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comentarioPersonal: comentario }),
              })
              setGuardandoComentario(false)
            }}
            placeholder="Escribí tus reflexiones personales sobre esta nota…"
            rows={4}
            className="w-full resize-none rounded-lg px-3 py-2 text-sm text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.08)' }}
            onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = '' }}
          />
        </div>
      </div>

      {/* Panel historial de versiones */}
      {mostrarHistorial && (nota.versiones ?? []).length > 0 && (
        <div
          className="flex-shrink-0 overflow-y-auto p-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(5,5,12,0.7)', maxHeight: '260px' }}
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(167,139,250,0.7)' }}>
            <History className="inline h-3.5 w-3.5 mr-1" />
            Historial ({(nota.versiones ?? []).length})
          </p>
          <div className="space-y-2">
            {(nota.versiones ?? []).map((v, i) => (
              <div
                key={i}
                className="rounded-lg p-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-neutral-300 truncate">{v.titulo}</p>
                    <p className="mt-0.5 text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
                      {new Date(v.guardadaEn).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed line-clamp-2" style={{ color: 'rgba(148,163,184,0.55)' }}>
                      {v.contenido.slice(0, 100)}{v.contenido.length > 100 ? '…' : ''}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      setRestaurando(String(i))
                      await fetch(`/api/notas/${nota.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contenido: v.contenido, titulo: v.titulo }),
                      })
                      setRestaurando(null)
                      setMostrarHistorial(false)
                      if (onRefrescar) await onRefrescar()
                    }}
                    disabled={restaurando === String(i)}
                    className="flex-shrink-0 rounded px-2 py-1 text-xs transition-all disabled:opacity-50"
                    style={{ border: '1px solid rgba(139,92,246,0.3)', color: 'rgba(167,139,250,0.8)' }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = 'rgba(139,92,246,0.12)'; e.currentTarget.style.color = '#a78bfa' } }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(167,139,250,0.8)' }}
                  >
                    {restaurando === String(i) ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Restaurar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function NotasClient() {
  const [notas, setNotas] = useState<Nota[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoNota | ''>('')
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('')
  const [notaSel, setNotaSel] = useState<Nota | null>(null)
  const [editando, setEditando] = useState<Partial<Nota> | null>(null)
  const [mostrarConvLote, setMostrarConvLote] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [tipoConvLote, setTipoConvLote] = useState<TipoNota>('permanente')
  const [convirtiendo, setConvirtiendo] = useState(false)
  const [progresoConv, setProgresoConv] = useState<{ actual: number; total: number } | null>(null)
  const [vinculandoIA, setVinculandoIA] = useState(false)
  const [progresoVinc, setProgresoVinc] = useState<{ actual: number; total: number; nuevos: number; ultimoError?: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const convRef = useRef<HTMLDivElement>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/notas')
      const data = await res.json()
      if (Array.isArray(data)) setNotas(data)
    } catch { /* silencioso */ }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function guardarNota(datos: Partial<Nota>) {
    const esNueva = !datos.id
    if (esNueva) {
      const ahora = new Date().toISOString()
      const id = generarIdZettel()
      await fetch('/api/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, id, creadaEn: ahora, actualizadaEn: ahora }),
      })
    } else {
      await fetch(`/api/notas/${datos.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
    }
    await cargar()
    setEditando(null)
  }

  async function eliminarNota(id: string) {
    if (!confirm('¿Mover esta nota a la papelera?')) return
    await fetch(`/api/notas/${id}`, { method: 'DELETE' })
    if (notaSel?.id === id) setNotaSel(null)
    await cargar()
    setToast('papelera')
    setTimeout(() => setToast(null), 4000)
  }

  async function convertirLote(notasAConvertir: Nota[], tipo: TipoNota) {
    if (notasAConvertir.length === 0) return
    setConvirtiendo(true)
    setMostrarConvLote(false)
    setProgresoConv({ actual: 0, total: notasAConvertir.length })
    for (let i = 0; i < notasAConvertir.length; i++) {
      setProgresoConv({ actual: i + 1, total: notasAConvertir.length })
      await fetch(`/api/notas/${notasAConvertir[i].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      })
    }
    setProgresoConv(null)
    setConvirtiendo(false)
    await cargar()
  }

  async function limpiarTodosVinculos() {
    if (!confirm(`¿Eliminar TODOS los vínculos de las ${notas.length} notas? Esta acción no se puede deshacer.`)) return
    try {
      const res = await fetch('/api/notas/limpiar-vinculos', { method: 'POST' })
      const data = await res.json() as { limpiadas?: number; error?: string }
      if (res.ok) await cargar()
      else alert(data.error ?? 'Error al limpiar vínculos')
    } catch (e) { alert(String(e)) }
  }

  async function vincularTodoConIA(soloSinVinculos: boolean) {
    if (vinculandoIA) return
    setVinculandoIA(true)
    setProgresoVinc({ actual: 1, total: 1, nuevos: 0 })
    try {
      const res = await fetch('/api/notas/ia/vincular-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soloSinVinculos }),
      })
      const raw = await res.text()
      let data: { aplicados?: number; conexiones?: number; notas?: number; error?: string } = {}
      try { data = JSON.parse(raw) } catch {
        data = { error: res.ok ? 'Respuesta inválida del servidor' : `Error ${res.status}: ${raw.slice(0, 120)}` }
      }
      if (!res.ok || data.error) {
        setProgresoVinc((p) => p ? { ...p, ultimoError: data.error ?? `Error ${res.status}` } : p)
      } else {
        setProgresoVinc((p) => p ? { ...p, nuevos: data.aplicados ?? 0 } : p)
        if ((data.aplicados ?? 0) > 0) await cargar()
      }
    } catch (e) {
      setProgresoVinc((p) => p ? { ...p, ultimoError: String(e) } : p)
    }
    await new Promise((r) => setTimeout(r, 3000))
    setVinculandoIA(false)
    setProgresoVinc(null)
  }

  const etiquetasUnicas = [...new Set(notas.flatMap((n) => n.etiquetas))].sort()
  const conteosPorTipo = notas.reduce<Record<string, number>>((acc, n) => {
    acc[n.tipo] = (acc[n.tipo] ?? 0) + 1
    return acc
  }, {})

  // Mapa de backlinks: cuántas notas apuntan a cada nota (para mostrar "centralidad")
  const backlinksCount = new Map<string, number>()
  for (const n of notas) {
    for (const v of n.vinculos ?? []) {
      backlinksCount.set(v.notaDestinoId, (backlinksCount.get(v.notaDestinoId) ?? 0) + 1)
    }
  }
  const sinVinculos = notas.filter((n) => (n.vinculos ?? []).length === 0 && n.tipo === 'permanente').length

  function norm(str: string): string {
    return (str ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  }

  const notasFiltradas = notas.filter((n) => {
    if (filtroTipo && n.tipo !== filtroTipo) return false
    if (filtroEtiqueta && !n.etiquetas.includes(filtroEtiqueta)) return false
    if (busqueda) {
      const q = norm(busqueda)
      return (
        norm(n.titulo).includes(q) ||
        norm(n.contenido).includes(q) ||
        n.etiquetas.some((e) => norm(e).includes(q))
      )
    }
    return true
  })

  return (
    <div className="-m-4 md:-m-6 flex h-full overflow-hidden">
      {/* Toast papelera */}
      {toast === 'papelera' && (
        <div
          className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl px-4 py-3 text-sm shadow-2xl"
          style={{ background: 'rgba(10,10,22,0.97)', border: '1px solid rgba(139,92,246,0.4)', color: '#e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        >
          Nota enviada a la papelera{' '}
          <Link href="/papelera" style={{ color: '#a78bfa' }}>Ver papelera</Link>
        </div>
      )}

      {/* Panel izquierdo: filtros */}
      <div
        className="hidden w-48 flex-shrink-0 overflow-y-auto p-4 lg:flex lg:flex-col"
        style={{
          background: 'rgba(5,5,12,0.95)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(139,92,246,0.6)' }}>Por tipo</p>
        <button
          onClick={() => setFiltroTipo('')}
          className="mb-0.5 flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-all"
          style={filtroTipo === ''
            ? { background: 'linear-gradient(90deg, rgba(109,40,217,0.25), rgba(30,58,138,0.15))', color: '#fff', border: '1px solid rgba(139,92,246,0.15)' }
            : { color: 'rgba(148,163,184,0.6)', border: '1px solid transparent' }
          }
          onMouseEnter={(e) => { if (filtroTipo !== '') { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(203,213,225,0.9)' } }}
          onMouseLeave={(e) => { if (filtroTipo !== '') { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(148,163,184,0.6)' } }}
        >
          <span>Todas</span>
          <span className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>{notas.length}</span>
        </button>
        {TIPOS_ZETTEL.map((t) => {
          const isActive = filtroTipo === t.tipo
          return (
            <div key={t.tipo} className="group relative">
              <button
                onClick={() => setFiltroTipo(isActive ? '' : t.tipo)}
                className="mb-0.5 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-all"
                style={isActive
                  ? { background: 'linear-gradient(90deg, rgba(109,40,217,0.25), rgba(30,58,138,0.15))', color: '#fff', border: '1px solid rgba(139,92,246,0.15)' }
                  : { color: 'rgba(148,163,184,0.6)', border: '1px solid transparent' }
                }
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(203,213,225,0.9)' } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(148,163,184,0.6)' } }}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${t.dotColor}`} />
                  <span>{t.label}</span>
                </div>
                <span className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>{conteosPorTipo[t.tipo] ?? 0}</span>
              </button>
              <div
                className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-52 rounded-lg p-2.5 shadow-xl group-hover:block"
                style={{ background: 'rgba(12,12,26,0.95)', border: '1px solid rgba(139,92,246,0.2)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
              >
                <p className={`mb-1 text-xs font-semibold ${t.color.split(' ')[0]}`}>{t.label}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.6)' }}>{t.desc}</p>
              </div>
            </div>
          )
        })}

        {sinVinculos > 0 && (
          <div
            className="mt-4 rounded-lg p-2"
            style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <p className="text-xs" style={{ color: '#fbbf24' }}>⚠ {sinVinculos} permanente{sinVinculos !== 1 ? 's' : ''} sin vínculos</p>
          </div>
        )}

        {etiquetasUnicas.length > 0 && (
          <>
            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(139,92,246,0.6)' }}>Por etiqueta</p>
            {etiquetasUnicas.map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEtiqueta(filtroEtiqueta === e ? '' : e)}
                className="mb-0.5 truncate rounded-lg px-2 py-1 text-left text-xs transition-all"
                style={filtroEtiqueta === e
                  ? { background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }
                  : { color: 'rgba(148,163,184,0.5)', border: '1px solid transparent' }
                }
                onMouseEnter={(e2) => { if (filtroEtiqueta !== e) { e2.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e2.currentTarget.style.color = 'rgba(203,213,225,0.8)' } }}
                onMouseLeave={(e2) => { if (filtroEtiqueta !== e) { e2.currentTarget.style.background = ''; e2.currentTarget.style.color = 'rgba(148,163,184,0.5)' } }}
              >
                #{e}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Panel central: lista */}
      <div
        className="flex w-72 flex-shrink-0 flex-col"
        style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div
          className="flex items-center gap-2 p-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(5,5,12,0.6)' }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.3)' }} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-lg py-1.5 pl-7 pr-3 text-xs text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
            />
          </div>
          {/* Botón convertir lote */}
          <div className="relative" ref={convRef}>
            <button
              onClick={() => setMostrarConvLote((v) => !v)}
              disabled={convirtiendo || notasFiltradas.length === 0}
              title="Convertir notas visibles en lote"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-all disabled:opacity-40"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.5)' }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#fff' } }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(148,163,184,0.5)' }}
            >
              {convirtiendo
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
            </button>
            {mostrarConvLote && (
              <div
                className="absolute right-0 top-9 z-50 w-64 rounded-xl p-3 shadow-2xl"
                style={{ background: 'rgba(10,10,22,0.97)', border: '1px solid rgba(139,92,246,0.25)', boxShadow: '0 16px 40px rgba(0,0,0,0.6)' }}
              >
                <p className="mb-2 text-xs font-semibold text-neutral-300">
                  Convertir {notasFiltradas.length} nota{notasFiltradas.length !== 1 ? 's' : ''} visibles a:
                </p>
                <div className="mb-3 space-y-1">
                  {TIPOS_ZETTEL.map((t) => (
                    <button
                      key={t.tipo}
                      onClick={() => setTipoConvLote(t.tipo)}
                      className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${tipoConvLote === t.tipo ? `${t.color} border` : 'text-neutral-400 hover:bg-neutral-800'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{t.label}</p>
                        <p className="text-xs text-neutral-500 leading-relaxed">{t.desc}</p>
                      </div>
                      {tipoConvLote === t.tipo && <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => convertirLote(notasFiltradas, tipoConvLote)}
                    className="flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 8px rgba(124,58,237,0.25)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 14px rgba(124,58,237,0.45)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 8px rgba(124,58,237,0.25)' }}
                  >
                    Convertir
                  </button>
                  <button
                    onClick={() => setMostrarConvLote(false)}
                    className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Botón vincular todo con IA */}
          <div className="group relative">
            <button
              onClick={() => vincularTodoConIA(true)}
              disabled={vinculandoIA || notas.length === 0}
              title="Vincular con IA (solo notas sin vínculos)"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-all disabled:opacity-40"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.5)' }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; e.currentTarget.style.color = '#a78bfa'; e.currentTarget.style.background = 'rgba(139,92,246,0.08)' } }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(148,163,184,0.5)'; e.currentTarget.style.background = '' }}
            >
              {vinculandoIA
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Zap className="h-3.5 w-3.5" />}
            </button>
            {!vinculandoIA && (
              <div
                className="pointer-events-none absolute right-0 top-9 z-50 hidden w-56 rounded-lg p-2.5 shadow-xl group-hover:block"
                style={{ background: 'rgba(10,10,22,0.97)', border: '1px solid rgba(139,92,246,0.25)', boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }}
              >
                <p className="mb-1 text-xs font-semibold" style={{ color: '#a78bfa' }}>Vincular con IA</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.5)' }}>
                  Analiza todas las notas en una sola llamada y aplica los vínculos más relevantes.
                </p>
                <button
                  className="pointer-events-auto mt-2 block w-full rounded-lg py-1 text-center text-xs transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(203,213,225,0.8)' }}
                  onClick={(e) => { e.stopPropagation(); vincularTodoConIA(false) }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.15)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                >
                  Procesar todas las notas
                </button>
                <div className="pointer-events-auto mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-xs text-red-500 hover:bg-red-950/30"
                    onClick={(e) => { e.stopPropagation(); limpiarTodosVinculos() }}
                    disabled={notas.length === 0}
                  >
                    <Trash2 className="h-3 w-3" /> Eliminar todos los vínculos
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Botón exportar */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              title="Exportar notas a DOCX"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.5)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(148,163,184,0.5)' }}
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            {showExportMenu && (
              <div
                className="absolute right-0 top-9 z-50 w-48 rounded-xl py-1 shadow-2xl"
                style={{ background: 'rgba(10,10,22,0.97)', border: '1px solid rgba(139,92,246,0.2)', boxShadow: '0 16px 40px rgba(0,0,0,0.6)' }}
                onMouseLeave={() => setShowExportMenu(false)}
              >
                <button
                  onClick={() => { window.open('/api/notas/exportar', '_blank'); setShowExportMenu(false) }}
                  className="block w-full px-4 py-2 text-left text-xs transition-colors"
                  style={{ color: 'rgba(203,213,225,0.8)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(203,213,225,0.8)' }}
                >
                  Todas las notas
                </button>
                <button
                  onClick={() => { window.open('/api/notas/exportar?tipo=permanente', '_blank'); setShowExportMenu(false) }}
                  className="block w-full px-4 py-2 text-left text-xs transition-colors"
                  style={{ color: 'rgba(203,213,225,0.8)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(203,213,225,0.8)' }}
                >
                  Solo permanentes
                </button>
                <button
                  onClick={() => { window.open('/api/notas/exportar?tipo=referencia', '_blank'); setShowExportMenu(false) }}
                  className="block w-full px-4 py-2 text-left text-xs transition-colors"
                  style={{ color: 'rgba(203,213,225,0.8)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(203,213,225,0.8)' }}
                >
                  Solo referencias
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setEditando({})}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 10px rgba(124,58,237,0.3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 18px rgba(124,58,237,0.5)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 10px rgba(124,58,237,0.3)' }}
          >
            <Plus className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Progreso de conversión en lote */}
        {progresoConv && (
          <div className="px-4 py-2 text-xs" style={{ background: 'rgba(6,182,212,0.07)', borderBottom: '1px solid rgba(6,182,212,0.15)', color: '#22d3ee' }}>
            Convirtiendo {progresoConv.actual}/{progresoConv.total}…
          </div>
        )}
        {/* Progreso de vinculación IA */}
        {progresoVinc && (
          <div className="px-4 py-2 text-xs" style={{ background: 'rgba(139,92,246,0.07)', borderBottom: '1px solid rgba(139,92,246,0.15)', color: '#a78bfa' }}>
            {progresoVinc.ultimoError ? (
              <span className="text-red-400" title={progresoVinc.ultimoError}>
                Error: {progresoVinc.ultimoError.slice(0, 100)}
              </span>
            ) : progresoVinc.nuevos > 0 ? (
              <span>{progresoVinc.nuevos} vínculos aplicados</span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Analizando notas con IA…
              </span>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {cargando && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'rgba(139,92,246,0.5)' }} />
            </div>
          )}
          {!cargando && notasFiltradas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm" style={{ color: 'rgba(148,163,184,0.4)' }}>Sin notas</p>
              <button
                onClick={() => setEditando({})}
                className="mt-3 text-xs transition-colors"
                style={{ color: 'rgba(139,92,246,0.7)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#a78bfa' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(139,92,246,0.7)' }}
              >
                Crear primera nota
              </button>
            </div>
          )}
          {notasFiltradas.map((n) => {
            const cfg = TIPOS_ZETTEL.find((t) => t.tipo === n.tipo)
            const isSelected = notaSel?.id === n.id
            const salientes = (n.vinculos ?? []).length
            const entrantes = backlinksCount.get(n.id) ?? 0
            const etiquetas = n.etiquetas.filter((e) => e !== 'auto-ficha' && e !== 'auto-highlights')
            return (
              <button
                key={n.id}
                onClick={() => setNotaSel(n)}
                className="relative block w-full pl-4 pr-3 py-3 text-left transition-all"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: isSelected ? 'linear-gradient(90deg, rgba(109,40,217,0.12), rgba(30,58,138,0.08))' : '',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = '' }}
              >
                {/* Barra de color según tipo con glow */}
                <div
                  className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full ${cfg?.barColor ?? 'bg-neutral-600'}`}
                  style={isSelected ? { boxShadow: '0 0 8px currentColor' } : {}}
                />

                {/* Título */}
                <p className="line-clamp-2 text-sm font-medium leading-snug text-neutral-100">{n.titulo}</p>

                {/* Etiquetas del usuario */}
                {etiquetas.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {etiquetas.slice(0, 3).map((e) => (
                      <span
                        key={e}
                        className="rounded-full px-1.5 py-px text-xs"
                        style={{
                          background: 'rgba(139,92,246,0.08)',
                          border: '1px solid rgba(139,92,246,0.15)',
                          color: 'rgba(167,139,250,0.6)',
                        }}
                      >
                        #{e}
                      </span>
                    ))}
                    {etiquetas.length > 3 && (
                      <span className="text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>+{etiquetas.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Meta: tipo + vínculos */}
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={`text-xs font-medium ${cfg?.color.split(' ')[0] ?? 'text-neutral-500'}`}>
                    {cfg?.label ?? n.tipo}
                  </span>
                  {(salientes > 0 || entrantes > 0) && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>
                      <Link2 className="h-2.5 w-2.5" />
                      {salientes > 0 && <span title="vínculos salientes">{salientes}↗</span>}
                      {entrantes > 0 && <span title="backlinks" style={{ color: 'rgba(139,92,246,0.7)' }}>{entrantes}↙</span>}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Panel derecho: detalle */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {notaSel ? (
          <NotaDetalle
            key={notaSel.id}
            nota={notaSel}
            todasLasNotas={notas}
            onEditar={() => setEditando(notaSel)}
            onEliminar={() => eliminarNota(notaSel.id)}
            onSeleccionarNota={(n) => {
              setNotaSel(n)
              // sincronizar filtros para que la nota aparezca en la lista
              setBusqueda('')
              setFiltroTipo('')
              setFiltroEtiqueta('')
            }}
            onFiltrarEtiqueta={(e) => {
              setFiltroEtiqueta(filtroEtiqueta === e ? '' : e)
              setNotaSel(null)
            }}
            onRefrescar={async () => {
              await cargar()
              // Refresh the selected nota with latest data
              const res = await fetch(`/api/notas/${notaSel.id}`)
              if (res.ok) {
                const updated = await res.json()
                setNotaSel(updated)
              }
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center px-6">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.08))',
                border: '1px solid rgba(139,92,246,0.2)',
                boxShadow: '0 0 24px rgba(124,58,237,0.1)',
              }}
            >
              <ChevronRight className="h-7 w-7" style={{ color: 'rgba(139,92,246,0.6)' }} />
            </div>
            <p className="mt-4 text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>Seleccioná una nota para verla</p>
            <button
              onClick={() => setEditando({})}
              className="mt-5 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #0891b2)',
                boxShadow: '0 0 20px rgba(124,58,237,0.3)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 30px rgba(124,58,237,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(124,58,237,0.3)'; e.currentTarget.style.transform = '' }}
            >
              <Plus className="h-4 w-4" /> Nueva nota
            </button>
          </div>
        )}
      </div>

      {editando !== null && (
        <Editor
          nota={editando}
          todasLasNotas={notas}
          onGuardar={guardarNota}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}
