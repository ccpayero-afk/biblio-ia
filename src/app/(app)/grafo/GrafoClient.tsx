'use client'

import { useEffect, useRef, useState, useCallback, useMemo, Component, ReactNode } from 'react'
import * as d3 from 'd3'
import { RefreshCw, Loader2, GitFork, AlertCircle, Network, BookOpen } from 'lucide-react'
import { Cita, Grafo, NodoGrafo, Nota, VinculoZettel } from '@/types'

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface GNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  tipo: string
  val: number
  color: string
}

interface GLink extends d3.SimulationLinkDatum<GNode> {
  source: string | GNode
  target: string | GNode
  color: string
  value: number
}

// ─── Colores ──────────────────────────────────────────────────────────────────

const COLOR_NODO: Record<NodoGrafo['tipo'], string> = {
  documento: '#3b82f6',
  autor:     '#f59e0b',
  concepto:  '#10b981',
  nota:      '#a78bfa',
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

class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean; msg: string }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: false, msg: '' }
  }
  static getDerivedStateFromError(e: Error) { return { error: true, msg: e.message } }
  render() {
    if (this.state.error) return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <AlertCircle className="h-10 w-10 text-red-700" />
        <p className="mt-4 text-sm text-red-400">Error al renderizar el grafo.</p>
        <p className="mt-1 text-xs text-neutral-600 max-w-xs">{this.state.msg}</p>
      </div>
    )
    return this.props.children
  }
}

// ─── Componente SVG ───────────────────────────────────────────────────────────

function ForceGraphSVG({
  nodes,
  links,
  width,
  height,
  selectedId,
  onNodeClick,
}: {
  nodes: GNode[]
  links: GLink[]
  width: number
  height: number
  selectedId: string | null
  onNodeClick: (id: string, tipo: string) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const simRef = useRef<d3.Simulation<GNode, GLink> | null>(null)
  const [, setTick] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [hovered, setHovered] = useState<string | null>(null)

  const nodesRef = useRef<GNode[]>([])
  const linksRef = useRef<GLink[]>([])

  useEffect(() => {
    const oldPos = new Map(nodesRef.current.map(n => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }]))
    nodesRef.current = nodes.map(n => {
      const old = oldPos.get(n.id)
      return { ...n, x: old?.x ?? width / 2 + (Math.random() - 0.5) * 100, y: old?.y ?? height / 2 + (Math.random() - 0.5) * 100, vx: old?.vx ?? 0, vy: old?.vy ?? 0 }
    })
    linksRef.current = links.map(l => ({ ...l }))
    simRef.current?.stop()
    const sim = d3.forceSimulation<GNode>(nodesRef.current)
      .force('link', d3.forceLink<GNode, GLink>(linksRef.current).id(d => d.id).distance(100).strength(0.4))
      .force('charge', d3.forceManyBody<GNode>().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force('collision', d3.forceCollide<GNode>(d => Math.sqrt(d.val) * 7 + 18))
      .on('tick', () => setTick(t => t + 1))
    simRef.current = sim
    return () => { sim.stop() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, links.length, width, height])

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    const g = svg.select<SVGGElement>('g.graph-root')
    const z = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
        setZoom(event.transform.k)
      })
    svg.call(z)
    zoomRef.current = z
    return () => { svg.on('.zoom', null) }
  }, [])

  function zoomBy(factor: number) {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, factor)
  }

  function resetZoom() {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(400).call(zoomRef.current.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8))
  }

  const nMap = useMemo(() => new Map(nodesRef.current.map(n => [n.id, n])), [nodesRef.current.length])
  const showLabels = zoom >= 0.6

  return (
    <div className="relative" style={{ width, height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="cursor-grab active:cursor-grabbing select-none"
        style={{ background: '#0a0a0a' }}
      >
        <defs>
          {/* Glow filter for selected node */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g className="graph-root">
          {/* Links */}
          <g>
            {linksRef.current.map((l, i) => {
              const s = typeof l.source === 'object' ? l.source as GNode : nMap.get(l.source as string)
              const t = typeof l.target === 'object' ? l.target as GNode : nMap.get(l.target as string)
              if (!s || !t || s.x == null || t.x == null) return null
              const isActive = selectedId && (s.id === selectedId || t.id === selectedId)
              return (
                <line
                  key={i}
                  x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke={l.color}
                  strokeWidth={isActive ? 2 : Math.log((l.value || 1) + 1) + 0.5}
                  strokeOpacity={selectedId ? (isActive ? 0.9 : 0.1) : 0.4}
                />
              )
            })}
          </g>
          {/* Nodes */}
          <g>
            {nodesRef.current.map((n) => {
              if (n.x == null || n.y == null) return null
              const r = Math.sqrt(n.val) * 6 + 5
              const isSelected = n.id === selectedId
              const isHovered = n.id === hovered
              const dimmed = selectedId && !isSelected
              const label = n.label.length > 22 ? n.label.slice(0, 20) + '…' : n.label
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  onClick={() => onNodeClick(n.id, n.tipo)}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer"
                  style={{ filter: isSelected ? 'url(#glow)' : undefined }}
                >
                  {/* Outer ring for selected */}
                  {isSelected && (
                    <circle r={r + 5} fill="none" stroke={n.color} strokeWidth={2} strokeOpacity={0.6} />
                  )}
                  {/* Main circle */}
                  <circle
                    r={r}
                    fill={n.color}
                    fillOpacity={dimmed ? 0.2 : isHovered ? 1 : 0.85}
                    stroke={isSelected || isHovered ? n.color : '#111'}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  {/* Label — always visible, dimmed when not selected */}
                  {showLabels && (
                    <text
                      y={r + 13}
                      textAnchor="middle"
                      fontSize={10 / Math.max(1, zoom * 0.5 + 0.5)}
                      fill={isSelected ? '#fff' : isHovered ? '#e5e7eb' : '#9ca3af'}
                      fillOpacity={dimmed ? 0.3 : 1}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {label}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </g>
      </svg>

      {/* Tooltip on hover */}
      {hovered && (() => {
        const n = nodesRef.current.find(x => x.id === hovered)
        if (!n) return null
        return (
          <div className="pointer-events-none absolute left-4 top-4 max-w-xs rounded-lg border border-neutral-700 bg-neutral-900/95 px-3 py-2 shadow-xl backdrop-blur-sm">
            <p className="text-xs font-medium" style={{ color: n.color }}>{n.tipo}</p>
            <p className="mt-0.5 text-sm text-white leading-snug">{n.label}</p>
          </div>
        )
      })()}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button onClick={() => zoomBy(1.5)} className="flex h-8 w-8 items-center justify-center rounded border border-neutral-700 bg-neutral-900/80 text-neutral-300 hover:text-white text-sm font-bold">+</button>
        <button onClick={resetZoom} className="flex h-8 w-8 items-center justify-center rounded border border-neutral-700 bg-neutral-900/80 text-xs text-neutral-400 hover:text-white">⌂</button>
        <button onClick={() => zoomBy(0.67)} className="flex h-8 w-8 items-center justify-center rounded border border-neutral-700 bg-neutral-900/80 text-neutral-300 hover:text-white text-sm font-bold">−</button>
      </div>
    </div>
  )
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
  const [dimensiones, setDimensiones] = useState({ width: 900, height: 650 })

  useEffect(() => {
    function medir() {
      setDimensiones({
        width:  Math.max(400, window.innerWidth  - (window.innerWidth >= 1024 ? 192 : 0)),
        height: Math.max(400, window.innerHeight - 56 - 52),
      })
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
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
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleTodos(todos: boolean) {
    setTiposActivos(todos ? new Set(TIPOS_FILTRO.map(t => t.key)) : new Set())
  }

  // ── Datos Zettelkasten ────────────────────────────────────────────────────

  const notasVisibles = notas.filter(n => {
    const tipo = (n.tipo === 'manual' || n.tipo === 'ia' || n.tipo === 'consulta' || n.tipo === 'ficha') ? 'efimera' : n.tipo
    return tiposActivos.has(tipo)
  })
  const citasVisibles = tiposActivos.has('cita') ? citas : []
  const nodeIds = new Set([...notasVisibles.map(n => n.id), ...citasVisibles.map(c => c.id)])

  const graphDataZettel: { nodes: GNode[]; links: GLink[] } = {
    nodes: [
      ...notasVisibles.map(n => {
        const tipoReal = (n.tipo === 'manual' || n.tipo === 'ia' || n.tipo === 'consulta' || n.tipo === 'ficha') ? 'efimera' : n.tipo
        return {
          id: n.id,
          label: n.titulo,
          tipo: tipoReal,
          val: Math.max(1, (n.vinculos ?? []).length + 1),
          color: COLOR_TIPO_NOTA[tipoReal] ?? '#888',
        }
      }),
      ...citasVisibles.map(c => ({
        id: c.id,
        label: c.texto.slice(0, 60),
        tipo: 'cita',
        val: 1,
        color: COLOR_TIPO_NOTA.cita,
      })),
    ],
    links: [
      ...notasVisibles.flatMap(n =>
        (n.vinculos ?? [])
          .filter(v => nodeIds.has(v.notaDestinoId))
          .map(v => ({ source: n.id, target: v.notaDestinoId, value: 1, color: COLOR_VINCULO[v.tipo] ?? '#6b7280' }))
      ),
      ...citasVisibles.flatMap(c =>
        notasVisibles
          .filter(n => (n.documentoOrigenId ?? n.documentoId) === c.documentoId)
          .map(n => ({ source: c.id, target: n.id, value: 0.3, color: '#374151' }))
      ),
    ],
  }

  const graphDataBiblio: { nodes: GNode[]; links: GLink[] } = {
    nodes: (grafo?.nodos ?? []).map(n => ({
      id: n.id, label: n.label, tipo: n.tipo, val: n.peso,
      color: COLOR_NODO[n.tipo] ?? '#888',
    })),
    links: (grafo?.aristas ?? []).map(a => ({
      source: a.source, target: a.target, value: a.peso, color: '#374151',
    })),
  }

  const graphData = modo === 'zettelkasten' ? graphDataZettel : graphDataBiblio

  const conteoPorTipo: Record<string, number> = {}
  for (const n of notas) {
    const t = (n.tipo === 'manual' || n.tipo === 'ia' || n.tipo === 'consulta' || n.tipo === 'ficha') ? 'efimera' : n.tipo
    conteoPorTipo[t] = (conteoPorTipo[t] ?? 0) + 1
  }
  conteoPorTipo['cita'] = citas.length

  // ── Estados ───────────────────────────────────────────────────────────────

  if (cargando) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
    </div>
  )

  if (errorMsg) return (
    <div className="flex flex-col items-center py-20 text-center">
      <AlertCircle className="h-10 w-10 text-red-700" />
      <p className="mt-4 text-sm text-red-400">{errorMsg}</p>
      <button onClick={() => cargar()} className="mt-4 text-xs text-neutral-500 hover:text-neutral-300">Reintentar</button>
    </div>
  )

  const sinDatos = modo === 'bibliografico' ? !grafo?.nodos?.length : graphData.nodes.length === 0

  if (sinDatos) return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
      <GitFork className="h-12 w-12 text-neutral-700" />
      <h2 className="mt-4 text-lg font-semibold text-white">Grafo vacío</h2>
      {modo === 'bibliografico' ? (
        <>
          <p className="mt-2 text-sm text-neutral-500">Necesitás tener documentos indexados en Biblioteca.</p>
          <button onClick={() => cargar(true)} className="mt-4 flex items-center gap-2 rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600">
            <RefreshCw className="h-4 w-4" /> Construir grafo
          </button>
        </>
      ) : tiposActivos.size === 0 ? (
        <>
          <p className="mt-2 text-sm text-neutral-500">Todos los filtros están desactivados.</p>
          <button onClick={() => toggleTodos(true)} className="mt-3 text-xs text-blue-400 hover:text-blue-300">Activar todos</button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-neutral-500">
            {notas.length === 0 && citas.length === 0
              ? 'No hay notas ni citas. Procesá highlights en Biblioteca o creá notas en la sección Notas.'
              : `${notas.length} notas y ${citas.length} citas cargadas, pero ninguna visible con los filtros activos.`}
          </p>
          {notas.length > 0 && (
            <button onClick={() => toggleTodos(true)} className="mt-3 text-xs text-blue-400 hover:text-blue-300">Mostrar todos los tipos</button>
          )}
        </>
      )}
    </div>
  )

  // ── Nodo seleccionado ─────────────────────────────────────────────────────

  const notaSelObj = nodoSel ? notas.find(n => n.id === nodoSel.id) : null
  const citaSelObj = nodoSel?.tipo === 'cita' ? citas.find(c => c.id === nodoSel.id) : null
  const nodoBiblioSel = nodoSel && modo === 'bibliografico' ? grafo?.nodos.find(n => n.id === nodoSel.id) ?? null : null

  return (
    <div className="-m-4 md:-m-6 flex flex-col" style={{ height: dimensiones.height + 52 }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5 gap-4 flex-shrink-0">
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

        <p className="text-xs text-neutral-600">
          {graphData.nodes.length} nodos · {graphData.links.length} conexiones
        </p>

        <button
          onClick={() => cargar(true)}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reconstruir
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Panel filtros Zettelkasten */}
        {modo === 'zettelkasten' && (
          <div className="w-44 flex-shrink-0 overflow-y-auto border-r border-neutral-800 bg-neutral-950 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">Filtros</p>
            <div className="mb-3 flex gap-1">
              <button onClick={() => toggleTodos(true)} className="flex-1 rounded py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white">Todos</button>
              <button onClick={() => toggleTodos(false)} className="flex-1 rounded py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white">Ninguno</button>
            </div>
            <div className="space-y-1">
              {TIPOS_FILTRO.map(t => (
                <button
                  key={t.key}
                  onClick={() => toggleTipo(t.key)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${tiposActivos.has(t.key) ? 'bg-neutral-800 text-white' : 'text-neutral-600 hover:text-neutral-400'}`}
                >
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: tiposActivos.has(t.key) ? t.color : '#374151' }} />
                  <span className="flex-1 text-left">{t.label}</span>
                  <span className="text-neutral-600">{conteoPorTipo[t.key] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-600">Vínculos</p>
              <div className="space-y-1">
                {Object.entries(COLOR_VINCULO).map(([tipo, color]) => (
                  <div key={tipo} className="flex items-center gap-1.5">
                    <span className="h-1 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs text-neutral-600">{tipo.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SVG Grafo */}
        <div className="flex-1 overflow-hidden">
          <ErrorBoundary>
            <ForceGraphSVG
              nodes={graphData.nodes}
              links={graphData.links}
              width={dimensiones.width - (modo === 'zettelkasten' ? 176 : 0) - (nodoSel ? 256 : 0)}
              height={dimensiones.height}
              selectedId={nodoSel?.id ?? null}
              onNodeClick={(id, tipo) => setNodoSel(prev => prev?.id === id ? null : { id, tipo })}
            />
          </ErrorBoundary>
        </div>

        {/* Panel detalle */}
        {nodoSel && (
          <div className="w-64 flex-shrink-0 overflow-y-auto border-l border-neutral-800 bg-neutral-900 p-4">
            <button onClick={() => setNodoSel(null)} className="mb-3 text-xs text-neutral-600 hover:text-neutral-400">✕ Cerrar</button>

            {notaSelObj && modo === 'zettelkasten' && (
              <>
                <div className="mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium" style={{ color: COLOR_TIPO_NOTA[nodoSel.tipo] ?? '#888', backgroundColor: `${COLOR_TIPO_NOTA[nodoSel.tipo] ?? '#888'}22` }}>
                  {nodoSel.tipo}
                </div>
                <p className="text-sm font-medium text-white leading-snug">{notaSelObj.titulo}</p>
                <p className="mt-2 text-xs text-neutral-400 line-clamp-5 whitespace-pre-wrap leading-relaxed">{notaSelObj.contenido}</p>
                {notaSelObj.etiquetas.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {notaSelObj.etiquetas.map(e => <span key={e} className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-500">#{e}</span>)}
                  </div>
                )}
                <p className="mt-2 text-xs text-neutral-600">{(notaSelObj.vinculos ?? []).length} vínculos</p>
              </>
            )}

            {citaSelObj && (
              <>
                <div className="mb-2 inline-block rounded-full bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-400">Cita</div>
                <blockquote className="border-l-2 border-amber-800 pl-3 text-sm text-neutral-300 italic leading-relaxed">"{citaSelObj.texto}"</blockquote>
                <p className="mt-2 text-xs text-neutral-500">{citaSelObj.autor} ({citaSelObj.año}, p.{citaSelObj.pagina})</p>
                <p className="mt-1 text-xs text-neutral-600 truncate">{citaSelObj.documentoNombre}</p>
              </>
            )}

            {nodoBiblioSel && modo === 'bibliografico' && (
              <>
                <span className={`rounded-full px-2 py-0.5 text-xs ${nodoBiblioSel.tipo === 'documento' ? 'bg-blue-900/40 text-blue-400' : nodoBiblioSel.tipo === 'autor' ? 'bg-amber-900/40 text-amber-400' : 'bg-emerald-900/40 text-emerald-400'}`}>
                  {nodoBiblioSel.tipo}
                </span>
                <p className="mt-2 text-sm font-medium text-white">{nodoBiblioSel.label}</p>
                <p className="mt-1 text-xs text-neutral-500">Peso: {nodoBiblioSel.peso}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Conexiones: {(grafo?.aristas ?? []).filter(a => a.source === nodoBiblioSel.id || a.target === nodoBiblioSel.id).length}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
