'use client'

import { useEffect, useState, useCallback, Component, ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { RefreshCw, Loader2, GitFork, AlertCircle, Network, BookOpen } from 'lucide-react'
import { Cita, Grafo, NodoGrafo, Nota, VinculoZettel } from '@/types'

const ForceGraph2D = dynamic(
  () => import('react-force-graph').then((m) => m.ForceGraph2D).catch(() => () => null),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-neutral-600" /></div> }
)

// ─── Colores ──────────────────────────────────────────────────────────────────

const COLOR_NODO: Record<NodoGrafo['tipo'], string> = {
  documento: '#3b82f6',
  autor: '#f59e0b',
  concepto: '#10b981',
  nota: '#a78bfa',
}

const COLOR_TIPO_NOTA: Record<string, string> = {
  efimera:    '#f97316',
  referencia: '#60a5fa',
  permanente: '#4ade80',
  estructura: '#a78bfa',
  proyecto:   '#2dd4bf',
  cita:       '#fbbf24',
}

const COLOR_VINCULO: Record<VinculoZettel['tipo'], string> = {
  complementa:        '#22c55e',
  contradice:         '#ef4444',
  ejemplifica:        '#3b82f6',
  aplica_en:          '#14b8a6',
  es_consecuencia_de: '#8b5cf6',
  cuestiona:          '#f97316',
  define:             '#e5e7eb',
  ver_tambien:        '#6b7280',
}

const TIPOS_FILTRO = [
  { key: 'efimera',    label: 'Efímeras',    color: COLOR_TIPO_NOTA.efimera },
  { key: 'referencia', label: 'Referencia',  color: COLOR_TIPO_NOTA.referencia },
  { key: 'permanente', label: 'Permanentes', color: COLOR_TIPO_NOTA.permanente },
  { key: 'estructura', label: 'Estructura',  color: COLOR_TIPO_NOTA.estructura },
  { key: 'proyecto',   label: 'Proyecto',    color: COLOR_TIPO_NOTA.proyecto },
  { key: 'cita',       label: 'Citas',       color: COLOR_TIPO_NOTA.cita },
]

// ─── Error Boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { error: false } }
  static getDerivedStateFromError() { return { error: true } }
  render() {
    if (this.state.error) return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center">
        <AlertCircle className="h-10 w-10 text-red-700" />
        <p className="mt-4 text-sm text-red-400">El grafo no pudo renderizarse.</p>
        <p className="mt-1 text-xs text-neutral-600">Tu navegador puede no soportar WebGL/Canvas.</p>
      </div>
    )
    return this.props.children
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function GrafoClient() {
  const [modo, setModo] = useState<'bibliografico' | 'zettelkasten'>('bibliografico')
  const [grafo, setGrafo] = useState<Grafo | null>(null)
  const [notas, setNotas] = useState<Nota[]>([])
  const [citas, setCitas] = useState<Cita[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [nodoSel, setNodoSel] = useState<{ id: string; tipo: string } | null>(null)
  const [tiposActivos, setTiposActivos] = useState<Set<string>>(
    new Set(TIPOS_FILTRO.map((t) => t.key))
  )
  const [dimensiones, setDimensiones] = useState({ width: 800, height: 600 })

  // Mide en cliente con window — evita el colapso de h-full en overflow-y-auto
  useEffect(() => {
    function medirVentana() {
      // descuenta aprox: AppShell header ~56px + toolbar del grafo ~48px + sidebar ~192px (lg)
      const esMobile = window.innerWidth < 1024
      setDimensiones({
        width:  Math.max(300, window.innerWidth  - (esMobile ? 0 : 192)),
        height: Math.max(300, window.innerHeight - 56 - 48),
      })
    }
    medirVentana()
    window.addEventListener('resize', medirVentana)
    return () => window.removeEventListener('resize', medirVentana)
  }, [])

  const cargar = useCallback(async (rebuild = false) => {
    setCargando(true)
    setErrorMsg('')
    try {
      const [resGrafo, resNotas, resCitas] = await Promise.all([
        fetch(`/api/grafo${rebuild ? '?rebuild=1' : ''}`),
        fetch('/api/notas'),
        fetch('/api/citas'),
      ])
      const [dataGrafo, dataNotas, dataCitas] = await Promise.all([
        resGrafo.json(), resNotas.json(), resCitas.json(),
      ])
      if (dataGrafo.error) { setErrorMsg(dataGrafo.error); setGrafo(null) }
      else if (dataGrafo.nodos) setGrafo(dataGrafo as Grafo)
      else setGrafo(null)
      if (Array.isArray(dataNotas)) setNotas(dataNotas)
      if (Array.isArray(dataCitas)) setCitas(dataCitas)
    } catch (e) { setErrorMsg(String(e)) }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function toggleTipo(key: string) {
    setTiposActivos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  function toggleTodos(todos: boolean) {
    setTiposActivos(todos ? new Set(TIPOS_FILTRO.map((t) => t.key)) : new Set())
  }

  // ── Datos del grafo Zettelkasten ──────────────────────────────────────────

  const notasVisibles = notas.filter((n) => {
    const tipo = (n.tipo === 'manual' || n.tipo === 'ia' || n.tipo === 'consulta' || n.tipo === 'ficha')
      ? 'efimera'
      : n.tipo
    return tiposActivos.has(tipo)
  })
  const citasVisibles = tiposActivos.has('cita') ? citas : []

  const nodeIds = new Set([
    ...notasVisibles.map((n) => n.id),
    ...citasVisibles.map((c) => c.id),
  ])

  const graphDataZettel = {
    nodes: [
      ...notasVisibles.map((n) => {
        const tipoReal = (n.tipo === 'manual' || n.tipo === 'ia' || n.tipo === 'consulta' || n.tipo === 'ficha')
          ? 'efimera' : n.tipo
        const vinculosCount = (n.vinculos ?? []).length
        return {
          id: n.id,
          label: n.titulo,
          tipo: tipoReal,
          val: Math.max(1, vinculosCount + 1),
          color: (n.tipo === 'permanente' || n.tipo === 'estructura') && vinculosCount === 0
            ? '#4b5563'
            : COLOR_TIPO_NOTA[tipoReal] ?? '#888',
        }
      }),
      ...citasVisibles.map((c) => ({
        id: c.id,
        label: `"${c.texto.slice(0, 50)}${c.texto.length > 50 ? '…' : ''}"`,
        tipo: 'cita',
        val: 1,
        color: COLOR_TIPO_NOTA.cita,
      })),
    ],
    links: [
      // Vínculos entre notas
      ...notasVisibles.flatMap((n) =>
        (n.vinculos ?? [])
          .filter((v) => nodeIds.has(v.notaDestinoId))
          .map((v) => ({
            source: n.id,
            target: v.notaDestinoId,
            value: 1,
            color: COLOR_VINCULO[v.tipo] ?? '#6b7280',
          }))
      ),
      // Citas → notas del mismo documento
      ...citasVisibles.flatMap((c) =>
        notasVisibles
          .filter((n) =>
            (n.documentoOrigenId ?? n.documentoId) === c.documentoId
          )
          .map((n) => ({
            source: c.id,
            target: n.id,
            value: 0.3,
            color: '#374151',
          }))
      ),
    ],
  }

  const graphDataBiblio = {
    nodes: (grafo?.nodos ?? []).map((n) => ({
      id: n.id,
      label: n.label,
      tipo: n.tipo,
      val: n.peso,
      color: COLOR_NODO[n.tipo] ?? '#888',
    })),
    links: (grafo?.aristas ?? []).map((a) => ({
      source: a.source,
      target: a.target,
      value: a.peso,
      color: undefined as string | undefined,
    })),
  }

  const graphData = modo === 'zettelkasten' ? graphDataZettel : graphDataBiblio

  // ── Conteos para filtros ──────────────────────────────────────────────────

  const conteoPorTipo: Record<string, number> = {}
  for (const n of notas) {
    const t = (n.tipo === 'manual' || n.tipo === 'ia' || n.tipo === 'consulta' || n.tipo === 'ficha')
      ? 'efimera' : n.tipo
    conteoPorTipo[t] = (conteoPorTipo[t] ?? 0) + 1
  }
  conteoPorTipo['cita'] = citas.length

  // ── Estado vacío ──────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <AlertCircle className="h-10 w-10 text-red-700" />
        <p className="mt-4 text-sm text-red-400">{errorMsg}</p>
        <button onClick={() => cargar()} className="mt-4 text-xs text-neutral-500 hover:text-neutral-300">Reintentar</button>
      </div>
    )
  }

  const sinDatos = modo === 'bibliografico'
    ? !grafo?.nodos?.length
    : graphDataZettel.nodes.length === 0

  if (sinDatos) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
        <GitFork className="h-12 w-12 text-neutral-700" />
        <h2 className="mt-4 text-lg font-semibold text-white">Grafo vacío</h2>
        {modo === 'bibliografico' ? (
          <>
            <p className="mt-2 text-sm text-neutral-500">
              Necesitás tener documentos indexados en Biblioteca. Luego hacé clic en &quot;Construir grafo&quot;.
            </p>
            <button
              onClick={() => cargar(true)}
              className="mt-4 flex items-center gap-2 rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600"
            >
              <RefreshCw className="h-4 w-4" /> Construir grafo
            </button>
          </>
        ) : tiposActivos.size === 0 ? (
          <>
            <p className="mt-2 text-sm text-neutral-500">Todos los filtros están desactivados.</p>
            <button onClick={() => toggleTodos(true)} className="mt-3 text-xs text-blue-400 hover:text-blue-300">
              Activar todos
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-neutral-500">
              {notas.length === 0 && citas.length === 0
                ? 'No hay notas ni citas. Procesá highlights en Biblioteca o creá notas en la sección Notas.'
                : `Se cargaron ${notas.length} nota${notas.length !== 1 ? 's' : ''} y ${citas.length} cita${citas.length !== 1 ? 's' : ''}, pero ninguna coincide con los filtros activos.`}
            </p>
            {notas.length > 0 && (
              <button onClick={() => toggleTodos(true)} className="mt-3 text-xs text-blue-400 hover:text-blue-300">
                Mostrar todos los tipos
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const notaSelObj = nodoSel ? notas.find((n) => n.id === nodoSel.id) : null
  const citaSelObj = nodoSel?.tipo === 'cita' ? citas.find((c) => c.id === nodoSel.id) : null
  const nodoBiblioSel = nodoSel && modo === 'bibliografico'
    ? grafo?.nodos.find((n) => n.id === nodoSel.id) ?? null
    : null

  return (
    <div className="-m-4 md:-m-6 flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5 gap-4">
        <div className="flex rounded-lg border border-neutral-700 p-0.5">
          <button
            onClick={() => setModo('bibliografico')}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-colors ${modo === 'bibliografico' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            <BookOpen className="h-3.5 w-3.5" /> Bibliográfico
          </button>
          <button
            onClick={() => setModo('zettelkasten')}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-colors ${modo === 'zettelkasten' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            <Network className="h-3.5 w-3.5" /> Zettelkasten
          </button>
        </div>

        {/* Leyenda / info */}
        {modo === 'bibliografico' ? (
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />Documentos</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Autores</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Conceptos</span>
          </div>
        ) : (
          <p className="text-xs text-neutral-600">
            {graphDataZettel.nodes.length} nodos · {graphDataZettel.links.length} conexiones
          </p>
        )}

        <button
          onClick={() => cargar(true)}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reconstruir
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Panel filtros (solo Zettelkasten) */}
        {modo === 'zettelkasten' && (
          <div className="w-44 flex-shrink-0 overflow-y-auto border-r border-neutral-800 bg-neutral-950 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-600">Filtros</p>
            </div>

            {/* Todos / Ninguno */}
            <div className="mb-3 flex gap-1">
              <button
                onClick={() => toggleTodos(true)}
                className="flex-1 rounded py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                Todos
              </button>
              <button
                onClick={() => toggleTodos(false)}
                className="flex-1 rounded py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                Ninguno
              </button>
            </div>

            <div className="space-y-1">
              {TIPOS_FILTRO.map((t) => (
                <button
                  key={t.key}
                  onClick={() => toggleTipo(t.key)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                    tiposActivos.has(t.key) ? 'bg-neutral-800 text-white' : 'text-neutral-600 hover:text-neutral-400'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: tiposActivos.has(t.key) ? t.color : '#374151' }}
                  />
                  <span className="flex-1 text-left">{t.label}</span>
                  <span className="text-neutral-600">{conteoPorTipo[t.key] ?? 0}</span>
                </button>
              ))}
            </div>

            {/* Leyenda vínculos */}
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">Vínculos</p>
              <div className="space-y-1">
                {Object.entries(COLOR_VINCULO).map(([tipo, color]) => (
                  <div key={tipo} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs text-neutral-600">{tipo.replace(/_/g, ' ')}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-4 rounded-full flex-shrink-0 bg-neutral-700" />
                  <span className="text-xs text-neutral-600">cita → nota</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Grafo */}
        <div className="flex-1 overflow-hidden">
          <ErrorBoundary>
            <ForceGraph2D
              graphData={graphData}
              width={dimensiones.width}
              height={dimensiones.height}
              backgroundColor="#0a0a0a"
              nodeLabel="label"
              nodeColor={(n: Record<string, unknown>) => (n.color as string) ?? '#888'}
              nodeVal={(n: Record<string, unknown>) => (n.val as number) ?? 1}
              nodeRelSize={5}
              linkColor={(l: Record<string, unknown>) => (l.color as string) ?? '#374151'}
              linkWidth={(l: Record<string, unknown>) => Math.log(((l.value as number) || 1) + 1) + 0.5}
              onNodeClick={(n: Record<string, unknown>) => {
                setNodoSel({ id: n.id as string, tipo: n.tipo as string })
              }}
            />
          </ErrorBoundary>
        </div>

        {/* Panel detalle del nodo seleccionado */}
        {nodoSel && (
          <div className="w-64 flex-shrink-0 overflow-y-auto border-l border-neutral-800 bg-neutral-900 p-4">
            <button onClick={() => setNodoSel(null)} className="mb-3 text-xs text-neutral-600 hover:text-neutral-400">
              ✕ Cerrar
            </button>

            {/* Nota seleccionada */}
            {notaSelObj && modo === 'zettelkasten' && (
              <>
                <div
                  className="mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    color: COLOR_TIPO_NOTA[nodoSel.tipo] ?? '#888',
                    backgroundColor: `${COLOR_TIPO_NOTA[nodoSel.tipo] ?? '#888'}22`,
                  }}
                >
                  {nodoSel.tipo}
                </div>
                <p className="font-mono text-xs text-neutral-600 mb-1">{notaSelObj.id}</p>
                <p className="text-sm font-medium text-white leading-snug">{notaSelObj.titulo}</p>
                <p className="mt-2 text-xs text-neutral-400 line-clamp-5 whitespace-pre-wrap leading-relaxed">
                  {notaSelObj.contenido}
                </p>
                {notaSelObj.etiquetas.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {notaSelObj.etiquetas.map((e) => (
                      <span key={e} className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-500">#{e}</span>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-neutral-500">
                  {(notaSelObj.vinculos ?? []).length} vínculo{(notaSelObj.vinculos ?? []).length !== 1 ? 's' : ''}
                </p>
              </>
            )}

            {/* Cita seleccionada */}
            {citaSelObj && (
              <>
                <div className="mb-2 inline-block rounded-full bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-400">
                  Cita
                </div>
                <blockquote className="border-l-2 border-amber-800 pl-3 text-sm text-neutral-300 italic leading-relaxed">
                  "{citaSelObj.texto}"
                </blockquote>
                <p className="mt-2 text-xs text-neutral-500">
                  {citaSelObj.autor} ({citaSelObj.año}, p.{citaSelObj.pagina})
                </p>
                <p className="mt-1 text-xs text-neutral-600 truncate">{citaSelObj.documentoNombre}</p>
                {citaSelObj.notaPropia && (
                  <p className="mt-2 text-xs text-neutral-400 italic">{citaSelObj.notaPropia}</p>
                )}
                {citaSelObj.etiquetas.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {citaSelObj.etiquetas.map((e) => (
                      <span key={e} className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-500">#{e}</span>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Nodo bibliográfico */}
            {nodoBiblioSel && modo === 'bibliografico' && (
              <>
                <span className={`rounded-full px-2 py-0.5 text-xs ${
                  nodoBiblioSel.tipo === 'documento' ? 'bg-blue-900/40 text-blue-400' :
                  nodoBiblioSel.tipo === 'autor' ? 'bg-amber-900/40 text-amber-400' :
                  'bg-emerald-900/40 text-emerald-400'
                }`}>{nodoBiblioSel.tipo}</span>
                <p className="mt-2 text-sm font-medium text-white">{nodoBiblioSel.label}</p>
                <p className="mt-1 text-xs text-neutral-500">Peso: {nodoBiblioSel.peso}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Conexiones: {(grafo?.aristas ?? []).filter((a) => a.source === nodoBiblioSel.id || a.target === nodoBiblioSel.id).length}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
