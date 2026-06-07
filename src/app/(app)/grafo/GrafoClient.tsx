'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { RefreshCw, Loader2, GitFork } from 'lucide-react'
import { Grafo, NodoGrafo } from '@/types'

const ForceGraph2D = dynamic(() => import('react-force-graph').then((m) => m.ForceGraph2D), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-neutral-600" /></div>,
})

const COLOR_NODO: Record<NodoGrafo['tipo'], string> = {
  documento: '#3b82f6',
  autor: '#f59e0b',
  concepto: '#10b981',
}

export default function GrafoClient() {
  const [grafo, setGrafo] = useState<Grafo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [nodoSel, setNodoSel] = useState<NodoGrafo | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensiones, setDimensiones] = useState({ width: 800, height: 600 })

  const cargar = useCallback(async (rebuild = false) => {
    setCargando(true)
    try {
      const res = await fetch(`/api/grafo${rebuild ? '?rebuild=1' : ''}`)
      const data = await res.json()
      setGrafo(data)
    } catch { /* skip */ }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensiones({ width, height })
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
      </div>
    )
  }

  if (!grafo || !grafo.nodos.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <GitFork className="h-12 w-12 text-neutral-700" />
        <h2 className="mt-4 text-lg font-semibold text-white">Grafo vacío</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Indexá documentos y generá fichas para ver el grafo de relaciones.
        </p>
        <button
          onClick={() => cargar(true)}
          className="mt-4 flex items-center gap-2 rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600"
        >
          <RefreshCw className="h-4 w-4" /> Construir grafo
        </button>
      </div>
    )
  }

  const graphData = {
    nodes: grafo.nodos.map((n) => ({
      id: n.id,
      label: n.label,
      tipo: n.tipo,
      val: n.peso,
      color: COLOR_NODO[n.tipo],
    })),
    links: grafo.aristas.map((a) => ({
      source: a.source,
      target: a.target,
      value: a.peso,
    })),
  }

  return (
    <div className="-m-6 flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />Documentos</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Autores</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Conceptos</span>
        </div>
        <button
          onClick={() => cargar(true)}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reconstruir
        </button>
      </div>

      {/* Graph + Panel */}
      <div className="flex flex-1 overflow-hidden">
        <div ref={containerRef} className="flex-1">
          <ForceGraph2D
            graphData={graphData}
            width={dimensiones.width}
            height={dimensiones.height}
            backgroundColor="#0a0a0a"
            nodeLabel="label"
            nodeColor={(n: Record<string, unknown>) => (n.color as string) ?? '#888'}
            nodeVal={(n: Record<string, unknown>) => (n.val as number) ?? 1}
            linkColor={() => '#374151'}
            linkWidth={(l: Record<string, unknown>) => Math.log((l.value as number) + 1) + 0.5}
            onNodeClick={(n: Record<string, unknown>) => {
              const nodo = grafo.nodos.find((nd) => nd.id === n.id)
              setNodoSel(nodo ?? null)
            }}
            nodeCanvasObject={(node: Record<string, unknown>, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.label as string
              const x = node.x as number
              const y = node.y as number
              const r = Math.sqrt((node.val as number) * 3) + 3
              ctx.beginPath()
              ctx.arc(x, y, r, 0, 2 * Math.PI)
              ctx.fillStyle = node.color as string
              ctx.fill()
              if (globalScale >= 1.2) {
                const fontSize = 10 / globalScale
                ctx.font = `${fontSize}px sans-serif`
                ctx.fillStyle = '#d1d5db'
                ctx.textAlign = 'center'
                ctx.fillText(label.slice(0, 20), x, y + r + fontSize)
              }
            }}
          />
        </div>

        {/* Node detail panel */}
        {nodoSel && (
          <div className="w-60 border-l border-neutral-800 bg-neutral-900 p-4">
            <button onClick={() => setNodoSel(null)} className="mb-3 text-xs text-neutral-600 hover:text-neutral-400">✕ Cerrar</button>
            <span className={`rounded-full px-2 py-0.5 text-xs ${
              nodoSel.tipo === 'documento' ? 'bg-blue-900/40 text-blue-400' :
              nodoSel.tipo === 'autor' ? 'bg-amber-900/40 text-amber-400' :
              'bg-emerald-900/40 text-emerald-400'
            }`}>{nodoSel.tipo}</span>
            <p className="mt-2 text-sm font-medium text-white">{nodoSel.label}</p>
            <p className="mt-1 text-xs text-neutral-500">Peso: {nodoSel.peso}</p>
            <p className="mt-1 text-xs text-neutral-500">
              Conexiones: {grafo.aristas.filter((a) => a.source === nodoSel.id || a.target === nodoSel.id).length}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
