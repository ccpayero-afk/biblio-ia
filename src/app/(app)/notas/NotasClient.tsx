'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Nota, TipoNota, VinculoZettel, VinculoSugerido } from '@/types'
import {
  Plus, Search, X, Link2, Loader2, ChevronRight,
  AlertTriangle, Sparkles, Check, ExternalLink, RefreshCw, Zap, BookOpen,
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
    })
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="flex h-full max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
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
          <button onClick={onCerrar} className="rounded p-1 text-neutral-600 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título (una afirmación, no un tema)"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-lg font-semibold text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
            />
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
            <textarea
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              placeholder="Escribí una sola idea. Si tenés más de una, creá otra nota."
              rows={10}
              className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
            />
            <input
              value={etiquetas}
              onChange={(e) => setEtiquetas(e.target.value)}
              placeholder="Etiquetas separadas por coma: gramsci, hegemonía"
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
            />
          </div>

          {/* Panel de vínculos */}
          <div className="w-64 flex-shrink-0 overflow-y-auto border-l border-neutral-800 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Vínculos ({vinculos.length})
            </p>
            {vinculos.map((v, i) => {
              const destino = todasLasNotas.find((n) => n.id === v.notaDestinoId)
              return (
                <div key={i} className="mb-2 rounded-lg border border-neutral-800 bg-neutral-900 p-2">
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
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
                >
                  {TIPOS_VINCULO.map((t) => (
                    <option key={t.tipo} value={t.tipo}>{t.label}</option>
                  ))}
                </select>
                <input
                  value={buscarVinculo}
                  onChange={(e) => setBuscarVinculo(e.target.value)}
                  placeholder="Buscar nota..."
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
                />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {candidatas.slice(0, 10).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => agregarVinculo(n)}
                      className="block w-full truncate rounded px-2 py-1 text-left text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
                    >
                      {n.titulo}
                    </button>
                  ))}
                </div>
                <button onClick={() => setMostrarBusqueda(false)} className="text-xs text-neutral-600 hover:text-neutral-400">Cancelar</button>
              </div>
            ) : (
              <button
                onClick={() => setMostrarBusqueda(true)}
                className="mt-2 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-neutral-700 px-2 py-1.5 text-xs text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
              >
                <Link2 className="h-3.5 w-3.5" /> Agregar vínculo
              </button>
            )}

            <button
              onClick={buscarSugerencias}
              disabled={buscandoSugerencias || !contenido.trim()}
              className="mt-2 flex w-full items-center gap-1.5 rounded-lg border border-neutral-700 px-2 py-1.5 text-xs text-neutral-400 hover:border-neutral-600 disabled:opacity-40"
            >
              {buscandoSugerencias ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Sugerir con IA
            </button>

            {sugerencias.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-neutral-500">Sugeridas:</p>
                {sugerencias.map((s) => (
                  <div key={s.notaId} className="rounded-lg border border-blue-900/30 bg-blue-950/10 p-2">
                    <p className="truncate text-xs text-neutral-300">{s.notaTitulo}</p>
                    <p className="text-xs text-blue-400">{s.tipoVinculo.replace(/_/g, ' ')}</p>
                    <p className="mt-0.5 text-xs text-neutral-600 line-clamp-2">{s.razon}</p>
                    <button onClick={() => agregarSugerida(s)} className="mt-1 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                      <Check className="h-3 w-3" /> Agregar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-neutral-800 px-6 py-4">
          <button onClick={onCerrar} className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:text-white">Cancelar</button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-500 hover:to-violet-500 disabled:opacity-50"
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
}: {
  nota: Nota
  todasLasNotas: Nota[]
  onEditar: () => void
  onEliminar: () => void
}) {
  const [convertiendo, setConvirtiendo] = useState(false)
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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigator.clipboard.writeText(`[[${nota.id}]]`)}
            title="Copiar [[ID]]"
            className="font-mono text-xs text-neutral-500 hover:text-neutral-300"
          >
            {nota.id}
          </button>
          {tipoBadge(nota.tipo)}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEditar} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600">
            Editar
          </button>
          <button onClick={onEliminar} className="rounded-lg border border-red-900/50 px-3 py-1.5 text-xs text-red-500 hover:border-red-700">
            Eliminar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {esEfimera && !sugerencia && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-orange-900/40 bg-orange-950/10 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-orange-400">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>Captura sin procesar. Convertila en permanente cuando estés list@.</span>
            </div>
            <button
              onClick={convertir}
              disabled={convertiendo}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-orange-900/40 px-3 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-900/60"
            >
              {convertiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Convertir
            </button>
          </div>
        )}

        {sugerencia && (
          <div className="rounded-xl border border-green-900/40 bg-green-950/10 p-4 space-y-3">
            <p className="text-xs font-semibold text-green-400">Sugerencia de conversión</p>
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
                className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600"
              >
                Aceptar
              </button>
              <button onClick={() => setSugerencia(null)} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400">
                Descartar
              </button>
            </div>
          </div>
        )}

        <h1 className="text-xl font-bold text-white">{nota.titulo}</h1>
        <p className="whitespace-pre-wrap text-sm text-neutral-300">{nota.contenido}</p>

        {nota.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {nota.etiquetas.map((e) => (
              <span key={e} className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs text-neutral-400">#{e}</span>
            ))}
          </div>
        )}

        {(nota.vinculos ?? []).length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Vínculos ({(nota.vinculos ?? []).length})
            </p>
            <div className="space-y-2">
              {(nota.vinculos ?? []).map((v, i) => {
                const destino = todasLasNotas.find((n) => n.id === v.notaDestinoId)
                return (
                  <div key={i} className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-neutral-500">{v.tipo.replace(/_/g, ' ')} →</span>
                      <p className="truncate text-sm text-neutral-200">{destino?.titulo ?? v.notaDestinoId}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 flex-shrink-0 text-neutral-700" />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {(nota.documentoOrigenId ?? nota.documentoId) && (
          <div className="rounded-lg border border-neutral-800 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-neutral-500">Origen</p>
              <Link
                href={`/lector/${nota.documentoOrigenId ?? nota.documentoId}${(nota.paginaOrigen ?? nota.pagina) ? `?pagina=${nota.paginaOrigen ?? nota.pagina}` : ''}`}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-blue-400 hover:bg-blue-950/30 hover:text-blue-300"
              >
                <BookOpen className="h-3 w-3" /> Abrir en lector
              </Link>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {(nota.paginaOrigen ?? nota.pagina) ? `p. ${nota.paginaOrigen ?? nota.pagina}` : 'Sin página'}
            </p>
          </div>
        )}
      </div>
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
  const [tipoConvLote, setTipoConvLote] = useState<TipoNota>('permanente')
  const [convirtiendo, setConvirtiendo] = useState(false)
  const [progresoConv, setProgresoConv] = useState<{ actual: number; total: number } | null>(null)
  const [vinculandoIA, setVinculandoIA] = useState(false)
  const [progresoVinc, setProgresoVinc] = useState<{ actual: number; total: number; nuevos: number } | null>(null)
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
    if (!confirm('¿Eliminar esta nota? Se quitarán sus vínculos de otras notas.')) return
    await fetch(`/api/notas/${id}`, { method: 'DELETE' })
    if (notaSel?.id === id) setNotaSel(null)
    await cargar()
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

  async function vincularTodoConIA(soloSinVinculos: boolean) {
    const candidatas = soloSinVinculos
      ? notas.filter((n) => (n.vinculos ?? []).length === 0)
      : notas
    if (candidatas.length === 0 || vinculandoIA) return
    setVinculandoIA(true)
    setProgresoVinc({ actual: 0, total: candidatas.length, nuevos: 0 })
    let totalNuevos = 0
    for (let i = 0; i < candidatas.length; i++) {
      const nota = candidatas[i]
      setProgresoVinc({ actual: i + 1, total: candidatas.length, nuevos: totalNuevos })
      try {
        const res = await fetch('/api/notas/ia/sugerir-vinculos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nota }),
        })
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 60000))
          i--
          continue
        }
        const sugerencias: VinculoSugerido[] = await res.json()
        if (!Array.isArray(sugerencias)) continue
        const altas = sugerencias.filter((s) => s.confianza === 'alta')
        if (altas.length > 0) {
          const yaExisten = new Set((nota.vinculos ?? []).map((v) => v.notaDestinoId))
          const nuevosVinculos: VinculoZettel[] = altas
            .filter((s) => !yaExisten.has(s.notaId))
            .map((s) => ({
              notaDestinoId: s.notaId,
              tipo: s.tipoVinculo,
              nota: s.razon,
              bidireccional: true,
              creadoEn: new Date().toISOString(),
            }))
          if (nuevosVinculos.length > 0) {
            await fetch(`/api/notas/${nota.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ vinculos: [...(nota.vinculos ?? []), ...nuevosVinculos] }),
            })
            totalNuevos += nuevosVinculos.length
          }
        }
      } catch { /* silencioso */ }
      if (i < candidatas.length - 1) await new Promise((r) => setTimeout(r, 1500))
    }
    setProgresoVinc(null)
    setVinculandoIA(false)
    if (totalNuevos > 0) await cargar()
  }

  const etiquetasUnicas = [...new Set(notas.flatMap((n) => n.etiquetas))].sort()
  const conteosPorTipo = notas.reduce<Record<string, number>>((acc, n) => {
    acc[n.tipo] = (acc[n.tipo] ?? 0) + 1
    return acc
  }, {})
  const sinVinculos = notas.filter((n) => (n.vinculos ?? []).length === 0 && n.tipo === 'permanente').length

  const notasFiltradas = notas.filter((n) => {
    if (filtroTipo && n.tipo !== filtroTipo) return false
    if (filtroEtiqueta && !n.etiquetas.includes(filtroEtiqueta)) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return (
        n.titulo.toLowerCase().includes(q) ||
        n.contenido.toLowerCase().includes(q) ||
        n.etiquetas.some((e) => e.toLowerCase().includes(q))
      )
    }
    return true
  })

  return (
    <div className="-m-4 md:-m-6 flex h-full overflow-hidden">
      {/* Panel izquierdo: filtros */}
      <div className="hidden w-48 flex-shrink-0 overflow-y-auto border-r border-neutral-800 bg-neutral-950 p-4 lg:flex lg:flex-col">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">Por tipo</p>
        <button
          onClick={() => setFiltroTipo('')}
          className={`mb-0.5 flex items-center justify-between rounded px-2 py-1.5 text-sm ${filtroTipo === '' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
        >
          <span>Todas</span>
          <span className="text-xs text-neutral-600">{notas.length}</span>
        </button>
        {TIPOS_ZETTEL.map((t) => (
          <div key={t.tipo} className="group relative">
            <button
              onClick={() => setFiltroTipo(filtroTipo === t.tipo ? '' : t.tipo)}
              className={`mb-0.5 flex w-full items-center justify-between rounded px-2 py-1.5 text-sm ${filtroTipo === t.tipo ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              <span>{t.label}</span>
              <span className="text-xs text-neutral-600">{conteosPorTipo[t.tipo] ?? 0}</span>
            </button>
            <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-52 rounded-lg border border-neutral-700 bg-neutral-900 p-2.5 shadow-xl group-hover:block">
              <p className={`mb-1 text-xs font-semibold ${t.color.split(' ')[0]}`}>{t.label}</p>
              <p className="text-xs leading-relaxed text-neutral-400">{t.desc}</p>
            </div>
          </div>
        ))}

        {sinVinculos > 0 && (
          <div className="mt-4 rounded-lg border border-yellow-900/40 bg-yellow-950/10 p-2">
            <p className="text-xs text-yellow-500">⚠ {sinVinculos} permanente{sinVinculos !== 1 ? 's' : ''} sin vínculos</p>
          </div>
        )}

        {etiquetasUnicas.length > 0 && (
          <>
            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-neutral-600">Por etiqueta</p>
            {etiquetasUnicas.map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEtiqueta(filtroEtiqueta === e ? '' : e)}
                className={`mb-0.5 truncate rounded px-2 py-1 text-left text-xs ${filtroEtiqueta === e ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                #{e}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Panel central: lista */}
      <div className="flex w-72 flex-shrink-0 flex-col border-r border-neutral-800">
        <div className="flex items-center gap-2 border-b border-neutral-800 p-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-1.5 pl-7 pr-3 text-xs text-neutral-300 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
            />
          </div>
          {/* Botón convertir lote */}
          <div className="relative" ref={convRef}>
            <button
              onClick={() => setMostrarConvLote((v) => !v)}
              disabled={convirtiendo || notasFiltradas.length === 0}
              title="Convertir notas visibles en lote"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-white disabled:opacity-40"
            >
              {convirtiendo
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
            </button>
            {mostrarConvLote && (
              <div className="absolute right-0 top-9 z-50 w-64 rounded-xl border border-neutral-700 bg-neutral-900 p-3 shadow-2xl">
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
                    className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:from-blue-500 hover:to-violet-500"
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
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-neutral-700 text-neutral-400 hover:border-purple-700 hover:text-purple-400 disabled:opacity-40"
            >
              {vinculandoIA
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Zap className="h-3.5 w-3.5" />}
            </button>
            {!vinculandoIA && (
              <div className="pointer-events-none absolute right-0 top-9 z-50 hidden w-52 rounded-lg border border-neutral-700 bg-neutral-900 p-2.5 shadow-xl group-hover:block">
                <p className="mb-1 text-xs font-semibold text-purple-400">Vincular con IA</p>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Sugiere y aplica vínculos automáticos entre notas sin vínculos usando Gemini.
                  Solo aplica sugerencias de alta confianza.
                </p>
                <button
                  className="pointer-events-auto mt-2 block w-full rounded bg-neutral-800 py-1 text-center text-xs text-neutral-300 hover:bg-neutral-700"
                  onClick={(e) => { e.stopPropagation(); vincularTodoConIA(false) }}
                >
                  Procesar todas las notas
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setEditando({})}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 shadow-sm shadow-violet-900/40"
          >
            <Plus className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Progreso de conversión en lote */}
        {progresoConv && (
          <div className="border-b border-neutral-800 bg-blue-950/20 px-4 py-2 text-xs text-blue-400">
            Convirtiendo {progresoConv.actual}/{progresoConv.total}…
          </div>
        )}
        {/* Progreso de vinculación IA */}
        {progresoVinc && (
          <div className="border-b border-neutral-800 bg-purple-950/20 px-4 py-2 text-xs text-purple-400">
            Vinculando {progresoVinc.actual}/{progresoVinc.total}… · {progresoVinc.nuevos} nuevos vínculos
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {cargando && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-600" />
            </div>
          )}
          {!cargando && notasFiltradas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-neutral-600">Sin notas</p>
              <button onClick={() => setEditando({})} className="mt-3 text-xs text-blue-500 hover:text-blue-400">
                Crear primera nota
              </button>
            </div>
          )}
          {notasFiltradas.map((n) => {
            const cfg = TIPOS_ZETTEL.find((t) => t.tipo === n.tipo)
            const isSelected = notaSel?.id === n.id
            return (
              <button
                key={n.id}
                onClick={() => setNotaSel(n)}
                className={`relative block w-full border-b border-neutral-800/50 pl-4 pr-3 py-3 text-left transition-colors hover:bg-neutral-900/80 ${isSelected ? 'bg-neutral-900' : ''}`}
              >
                {/* Barra de color izquierda */}
                <div className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full ${cfg?.barColor ?? 'bg-neutral-600'}`} />

                {/* Título */}
                <p className="line-clamp-2 text-sm font-medium leading-snug text-neutral-100">{n.titulo}</p>

                {/* Meta row */}
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium ${cfg?.color.split(' ')[0] ?? 'text-neutral-500'}`}>
                    {cfg?.label ?? n.tipo}
                  </span>
                  {(n.vinculos ?? []).length > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-neutral-600">
                      <Link2 className="h-2.5 w-2.5" />
                      {(n.vinculos ?? []).length}
                    </span>
                  )}
                  {n.etiquetas.filter((e) => e !== 'auto-ficha' && e !== 'concepto-clave').slice(0, 2).map((e) => (
                    <span key={e} className="rounded-full bg-neutral-800 px-1.5 py-px text-xs text-neutral-500">#{e}</span>
                  ))}
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
            nota={notaSel}
            todasLasNotas={notas}
            onEditar={() => setEditando(notaSel)}
            onEliminar={() => eliminarNota(notaSel.id)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <ChevronRight className="h-10 w-10 text-neutral-800" />
            <p className="mt-3 text-sm text-neutral-600">Seleccioná una nota</p>
            <button
              onClick={() => setEditando({})}
              className="mt-4 flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-500 hover:to-violet-500"
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
