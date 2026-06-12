'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { Documento, Highlight, Cita } from '@/types'
import { crearCita } from '@/lib/citas'
import SelectionPopover from './SelectionPopover'
import CitaModal from './CitaModal'
import PanelLateral from './PanelLateral'
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  PanelRight, X, Sparkles, Check, Loader2,
  Maximize2, Minimize2, Search,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Props {
  documento: Documento
  pdfUrl: string
  initialPage?: number
  initialSearch?: string
}

interface Seleccion {
  texto: string
  pagina: number
  rect: DOMRect
  rects?: Array<{ x: number; y: number; width: number; height: number }>
}

// Legacy text-layer coloring (fallback for old highlights without rects)
const COLOR_BG: Record<string, string> = {
  amarillo: '#fef08a',
  azul: '#93c5fd',
  rojo: '#fca5a5',
  verde: '#86efac',
  morado: '#d8b4fe',
}

// Overlay fill colors (mix-blend-mode: multiply for natural highlight look)
const COLOR_FILL: Record<string, string> = {
  amarillo: 'rgba(253,224,71,0.55)',
  verde:    'rgba(74,222,128,0.45)',
  azul:     'rgba(96,165,250,0.45)',
  rojo:     'rgba(248,113,113,0.45)',
  morado:   'rgba(192,132,252,0.45)',
}

const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0]
const RENDER_WINDOW = 3

export default function LectorClient({ documento, pdfUrl, initialPage = 1, initialSearch }: Props) {
  const [numPages, setNumPages] = useState(0)
  const [paginaActual, setPaginaActual] = useState(initialPage)
  const [zoom, setZoom] = useState(1.2)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [citas, setCitas] = useState<Cita[]>([])
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null)
  const [modalCita, setModalCita] = useState<Seleccion | null>(null)
  const [inputPagina, setInputPagina] = useState(String(initialPage))
  const [anchoContenedor, setAnchoContenedor] = useState(0)
  const [naturalPageWidth, setNaturalPageWidth] = useState(0)
  const [fitApplied, setFitApplied] = useState(false)
  const [procesandoHL, setProcesandoHL] = useState(false)
  const [hlResultado, setHlResultado] = useState<{
    citasCreadas: number; notasCreadas: number; fichaCreada: boolean
    anotaciones: number; mensaje?: string; error?: string
  } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [textosPaginas, setTextosPaginas] = useState<Record<number, string>>({})
  const [buscadorAbierto, setBuscadorAbierto] = useState(false)
  const [queryBusqueda, setQueryBusqueda] = useState('')
  const [resultadosBusq, setResultadosBusq] = useState<{ pagina: number; contexto: string }[]>([])
  const [indiceResultado, setIndiceResultado] = useState(0)

  const lectorRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const highlightsRef = useRef(highlights)
  highlightsRef.current = highlights
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const paginaActualRef = useRef(paginaActual)
  paginaActualRef.current = paginaActual

  // Track container width only — never auto-change zoom
  useEffect(() => {
    if (!contenedorRef.current) return
    const obs = new ResizeObserver((entries) => {
      setAnchoContenedor(entries[0].contentRect.width)
    })
    obs.observe(contenedorRef.current)
    return () => obs.disconnect()
  }, [])

  // Auto fit-width once on first load
  useEffect(() => {
    if (anchoContenedor > 0 && naturalPageWidth > 0 && !fitApplied) {
      const fit = (anchoContenedor - 48) / naturalPageWidth
      setZoom(parseFloat(Math.min(Math.max(fit, 0.5), 2.5).toFixed(3)))
      setFitApplied(true)
    }
  }, [anchoContenedor, naturalPageWidth, fitApplied])

  // Scroll to initialPage once PDF is loaded, then find text if requested
  useEffect(() => {
    if (numPages > 0) {
      if (initialPage > 1) {
        const target = pageRefs.current[initialPage - 1]
        if (target) {
          setTimeout(() => {
            target.scrollIntoView({ behavior: 'instant', block: 'start' })
            if (initialSearch) {
              // Give the text layer time to render before searching
              setTimeout(() => (window as Window & { find?: (...args: unknown[]) => boolean }).find?.(initialSearch, false, false, true, false, false, false), 600)
            }
          }, 300)
          return
        }
      }
      if (initialSearch) {
        setTimeout(() => (window as Window & { find?: (...args: unknown[]) => boolean }).find?.(initialSearch, false, false, true, false, false, false), 900)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages])

  // IntersectionObserver — track which page is most visible while scrolling
  useEffect(() => {
    if (!numPages || !contenedorRef.current) return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (!visible.length) return
        const best = visible.reduce((a, b) => (a.intersectionRatio > b.intersectionRatio ? a : b))
        const p = parseInt((best.target as HTMLElement).dataset.page ?? '0')
        if (p > 0) { setPaginaActual(p); setInputPagina(String(p)) }
      },
      { root: contenedorRef.current, threshold: [0.1, 0.3, 0.5] }
    )
    pageRefs.current.forEach((ref) => ref && obs.observe(ref))
    return () => obs.disconnect()
  }, [numPages])

  // Highlights and citas
  useEffect(() => {
    fetch(`/api/highlights/${documento.id}`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setHighlights(data))
      .catch(() => {})
    fetch('/api/citas')
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setCitas(data.filter((c: Cita) => c.documentoId === documento.id)))
      .catch(() => {})
  }, [documento.id])

  // Texto por página (para búsqueda interna, incluye OCR)
  useEffect(() => {
    fetch(`/api/texto/${documento.id}`)
      .then((r) => r.json())
      .then((data) => { if (data && !data.error) setTextosPaginas(data) })
      .catch(() => {})
  }, [documento.id])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === '+' || (e.key === '=' && !e.metaKey)) { e.preventDefault(); zoomIn() }
      if (e.key === '-') { e.preventDefault(); zoomOut() }
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey) toggleFullscreen()
      if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setBuscadorAbierto((v) => !v)
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') { setBuscadorAbierto(false); setQueryBusqueda(''); setResultadosBusq([]) }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') irAPagina(paginaActualRef.current + 1)
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') irAPagina(paginaActualRef.current - 1)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages])

  // Selection detection — works across all pages
  useEffect(() => {
    function handleMouseUp(e: MouseEvent) {
      if (!contenedorRef.current?.contains(e.target as Node)) return
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) { setSeleccion(null); return }
      const texto = sel.toString().trim()
      if (texto.length < 5) return
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      // Walk up DOM to find react-pdf Page element and its page number
      let pageEl: HTMLElement | null = null
      let node: Element | null = range.startContainer.parentElement
      let pagina = paginaActualRef.current
      while (node) {
        if ((node as HTMLElement).classList?.contains('react-pdf__Page')) {
          const p = (node as HTMLElement).dataset.pageNumber
          if (p) pagina = parseInt(p)
          pageEl = node as HTMLElement
          break
        }
        node = node.parentElement
      }
      // Capture normalized rects relative to the page (zoom-independent)
      let rects: Array<{ x: number; y: number; width: number; height: number }> | undefined
      if (pageEl) {
        const pageRect = pageEl.getBoundingClientRect()
        rects = Array.from(range.getClientRects())
          .filter((r) => r.width > 2 && r.height > 2)
          .map((r) => ({
            x: (r.left - pageRect.left) / pageRect.width,
            y: (r.top - pageRect.top) / pageRect.height,
            width: r.width / pageRect.width,
            height: r.height / pageRect.height,
          }))
      }
      setSeleccion({ texto, pagina, rect, rects })
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  // Apply highlights to all visible text layers
  const applyHighlightsToDOM = useCallback(() => {
    if (!contenedorRef.current) return
    const textLayers = contenedorRef.current.querySelectorAll('.react-pdf__Page__textContent')
    textLayers.forEach((textLayer) => {
      const pageEl = textLayer.closest('.react-pdf__Page') as HTMLElement | null
      const pageNum = parseInt(pageEl?.dataset.pageNumber ?? '0')
      if (!pageNum) return
      const pageHighlights = highlightsRef.current.filter((h) => h.pagina === pageNum)
      const spans = textLayer.querySelectorAll('span')
      for (const span of spans) {
        const text = (span.textContent ?? '').trim()
        ;(span as HTMLElement).style.backgroundColor = ''
        if (!text || text.length < 2) continue
        for (const h of pageHighlights) {
          if (h.texto.toLowerCase().includes(text.toLowerCase())) {
            ;(span as HTMLElement).style.backgroundColor = COLOR_BG[h.color] ?? '#fef08a'
            ;(span as HTMLElement).style.borderRadius = '2px'
            ;(span as HTMLElement).style.padding = '0 1px'
            break
          }
        }
      }
    })
  }, [])

  useEffect(() => { applyHighlightsToDOM() }, [highlights, paginaActual, applyHighlightsToDOM])

  // Fullscreen
  function toggleFullscreen() {
    if (!lectorRef.current) return
    if (!document.fullscreenElement) {
      lectorRef.current.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }
  useEffect(() => {
    const cb = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', cb)
    return () => document.removeEventListener('fullscreenchange', cb)
  }, [])

  // Zoom helpers
  function zoomIn() {
    setZoom((z) => ZOOM_PRESETS.find((p) => p > z + 0.01) ?? z)
  }
  function zoomOut() {
    setZoom((z) => [...ZOOM_PRESETS].reverse().find((p) => p < z - 0.01) ?? z)
  }
  function setFitWidth() {
    if (anchoContenedor > 0 && naturalPageWidth > 0) {
      setZoom(parseFloat(Math.min(Math.max((anchoContenedor - 48) / naturalPageWidth, 0.5), 2.5).toFixed(3)))
    }
  }

  const matchedPreset = ZOOM_PRESETS.find((p) => Math.abs(p - zoom) < 0.02)
  const selectValue = matchedPreset?.toString() ?? 'custom'

  function buscarEnTexto(query: string) {
    setQueryBusqueda(query)
    if (!query.trim()) { setResultadosBusq([]); return }
    const q = query.toLowerCase()
    const resultados: { pagina: number; contexto: string }[] = []
    for (const [p, texto] of Object.entries(textosPaginas)) {
      const idx = (texto as string).toLowerCase().indexOf(q)
      if (idx !== -1) {
        const start = Math.max(0, idx - 40)
        const end = Math.min((texto as string).length, idx + query.length + 40)
        const contexto = (start > 0 ? '…' : '') + (texto as string).slice(start, end) + (end < (texto as string).length ? '…' : '')
        resultados.push({ pagina: parseInt(p), contexto })
      }
    }
    resultados.sort((a, b) => a.pagina - b.pagina)
    setResultadosBusq(resultados)
    setIndiceResultado(0)
    if (resultados.length > 0) irAPagina(resultados[0].pagina)
  }

  function irAPagina(n: number) {
    const p = Math.max(1, Math.min(n, numPages))
    setPaginaActual(p)
    setInputPagina(String(p))
    pageRefs.current[p - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }
  function cerrarSeleccion() {
    setSeleccion(null)
    window.getSelection()?.removeAllRanges()
  }

  async function guardarHighlight(sel: Seleccion, color: Highlight['color']) {
    const h: Highlight = {
      id: `h_${Date.now()}`,
      documentoId: documento.id,
      texto: sel.texto,
      pagina: sel.pagina,
      posicion: { x: 0, y: 0, width: 0, height: 0 },
      rects: sel.rects,
      color,
      creadoEn: new Date().toISOString(),
    }
    setHighlights((prev) => [...prev, h])
    await fetch(`/api/highlights/${documento.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(h),
    })
  }

  async function onResaltar(color: Highlight['color'] = 'amarillo') {
    if (!seleccion) return
    const sel = seleccion
    cerrarSeleccion()
    showToast('Texto resaltado ✓')
    await guardarHighlight(sel, color)
  }

  async function onAnotar(nota: string) {
    if (!seleccion) return
    const sel = seleccion
    cerrarSeleccion()
    showToast('Guardando nota…')
    const contenido = `${nota}\n\n> "${sel.texto}"\n— p. ${sel.pagina}, *${documento.nombre.replace(/\.pdf$/i, '')}*`
    await fetch('/api/notas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: nota.split('\n')[0].slice(0, 80) || sel.texto.slice(0, 60),
        contenido,
        tipo: 'efimera',
        documentoOrigenId: documento.id,
        paginaOrigen: sel.pagina,
        fragmentoTexto: sel.texto,
        etiquetas: [],
      }),
    })
    await guardarHighlight(sel, 'azul')
    showToast('Nota creada ✓')
  }

  async function guardarCita(datos: { notaPropia?: string; etiquetas: string[]; proyectoId?: string }) {
    if (!modalCita) return
    const cita = crearCita({
      texto: modalCita.texto,
      pagina: modalCita.pagina,
      documentoId: documento.id,
      documentoNombre: documento.nombre,
      autor: documento.autor,
      año: documento.año,
      ...datos,
    })
    setCitas((prev) => [...prev, cita])
    const sel = modalCita
    setModalCita(null)
    await guardarHighlight(sel, 'rojo')
    await fetch('/api/citas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cita),
    })
  }

  async function procesarHighlights() {
    setProcesandoHL(true)
    try {
      const res = await fetch(`/api/highlights/procesar/${documento.id}`, { method: 'POST' })
      const data = await res.json()
      setHlResultado(data)
      if (data.anotaciones > 0) {
        const hlRes = await fetch(`/api/highlights/${documento.id}`)
        const hlData = await hlRes.json()
        if (Array.isArray(hlData)) setHighlights(hlData)
      }
    } catch { /* noop */ }
    setProcesandoHL(false)
  }

  // Placeholder size for un-rendered pages (avoids layout jumps)
  const pageW = naturalPageWidth > 0 ? Math.round(naturalPageWidth * zoom) : Math.round(612 * zoom)
  const pageH = Math.round(pageW * 1.414)

  return (
    <div ref={lectorRef} className="flex h-full gap-0 overflow-hidden -m-4 md:-m-6 bg-neutral-950">
      {/* Visor principal */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">

        {/* ── Toolbar ── */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-neutral-800 bg-neutral-950 px-3">
          <h2 className="flex-1 truncate text-xs text-neutral-400 md:text-sm md:text-neutral-300">
            {documento.nombre.replace(/\.pdf$/i, '')}
          </h2>

          {/* Navegación de páginas */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => irAPagina(paginaActual - 1)}
              disabled={paginaActual <= 1}
              title="Página anterior (←)"
              className="rounded p-1 text-neutral-400 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="number"
              value={inputPagina}
              onChange={(e) => setInputPagina(e.target.value)}
              onBlur={() => irAPagina(parseInt(inputPagina) || 1)}
              onKeyDown={(e) => e.key === 'Enter' && irAPagina(parseInt(inputPagina) || 1)}
              className="w-10 rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-center text-xs text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-xs text-neutral-500">/{numPages}</span>
            <button
              onClick={() => irAPagina(paginaActual + 1)}
              disabled={paginaActual >= numPages}
              title="Página siguiente (→)"
              className="rounded p-1 text-neutral-400 hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Zoom */}
          <div className="hidden items-center gap-0.5 sm:flex">
            <button
              onClick={zoomOut}
              title="Reducir zoom (−)"
              className="rounded p-1 text-neutral-400 hover:text-white"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <select
              value={selectValue}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'fit') setFitWidth()
                else if (v !== 'custom') setZoom(parseFloat(v))
              }}
              className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-xs text-white cursor-pointer"
            >
              {selectValue === 'custom' && (
                <option value="custom">{Math.round(zoom * 100)}%</option>
              )}
              <option value="fit">Ajustar ancho</option>
              {ZOOM_PRESETS.map((p) => (
                <option key={p} value={String(p)}>{Math.round(p * 100)}%</option>
              ))}
            </select>
            <button
              onClick={zoomIn}
              title="Aumentar zoom (+)"
              className="rounded p-1 text-neutral-400 hover:text-white"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          {/* Buscar en el documento */}
          <button
            onClick={() => { setBuscadorAbierto((v) => !v); setTimeout(() => searchInputRef.current?.focus(), 50) }}
            title="Buscar en el documento (Ctrl+F)"
            className={`rounded p-1 transition-colors ${buscadorAbierto ? 'text-blue-400' : 'text-neutral-400 hover:text-white'}`}
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Pantalla completa */}
          <button
            onClick={toggleFullscreen}
            title={fullscreen ? 'Salir de pantalla completa (F)' : 'Pantalla completa (F)'}
            className="rounded p-1 text-neutral-400 hover:text-white"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {/* Procesar highlights */}
          {hlResultado === null ? (
            <button
              onClick={procesarHighlights}
              disabled={procesandoHL}
              title="Procesar highlights del PDF original"
              className="hidden items-center gap-1.5 rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white disabled:opacity-40 sm:flex"
            >
              {procesandoHL ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {procesandoHL ? 'Procesando…' : 'Highlights PDF'}
            </button>
          ) : hlResultado.error ? (
            <button
              onClick={() => setHlResultado(null)}
              title={hlResultado.error}
              className="hidden max-w-[200px] items-center gap-1 truncate rounded-lg border border-red-900 px-2 py-1 text-xs text-red-400 hover:border-red-700 sm:flex"
            >
              Error (clic para reintentar)
            </button>
          ) : (
            <span
              title={hlResultado.mensaje ?? `${hlResultado.citasCreadas} citas · ${hlResultado.notasCreadas} notas`}
              className={`hidden items-center gap-1 rounded-lg border px-2 py-1 text-xs sm:flex ${
                hlResultado.anotaciones === 0
                  ? 'border-neutral-700 text-neutral-500'
                  : 'border-green-900 text-green-400'
              }`}
            >
              {hlResultado.anotaciones === 0 ? (
                'Sin highlights'
              ) : (
                <><Check className="h-3 w-3" /> {hlResultado.citasCreadas}c · {hlResultado.notasCreadas}n</>
              )}
            </span>
          )}

          {/* Panel lateral */}
          <button
            onClick={() => setPanelAbierto((p) => !p)}
            title="Panel lateral"
            className={`rounded p-1 transition-colors ${
              panelAbierto ? 'text-blue-400' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>

        {/* ── PDF — scroll continuo ── */}
        <div
          ref={contenedorRef}
          className="relative flex-1 overflow-auto bg-neutral-700"
        >
          {/* Buscador superpuesto (Ctrl+F) */}
          {buscadorAbierto && (
            <div className="absolute right-4 top-3 z-40 w-80 rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
              <div className="flex items-center gap-2 p-2">
                <Search className="h-4 w-4 shrink-0 text-neutral-500" />
                <input
                  ref={searchInputRef}
                  value={queryBusqueda}
                  onChange={(e) => buscarEnTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setBuscadorAbierto(false); setQueryBusqueda(''); setResultadosBusq([]) }
                    if (e.key === 'Enter' && resultadosBusq.length > 0) {
                      const next = (indiceResultado + 1) % resultadosBusq.length
                      setIndiceResultado(next)
                      irAPagina(resultadosBusq[next].pagina)
                    }
                  }}
                  placeholder="Buscar en el documento…"
                  className="flex-1 bg-transparent text-sm text-white placeholder-neutral-600 focus:outline-none"
                />
                {queryBusqueda && (
                  <span className="shrink-0 text-xs text-neutral-500">{resultadosBusq.length}</span>
                )}
                <button
                  onClick={() => { setBuscadorAbierto(false); setQueryBusqueda(''); setResultadosBusq([]) }}
                  className="shrink-0 text-neutral-500 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {resultadosBusq.length > 0 && (
                <div className="max-h-60 overflow-y-auto border-t border-neutral-800 p-1">
                  {resultadosBusq.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => { setIndiceResultado(i); irAPagina(r.pagina) }}
                      className={`flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                        i === indiceResultado ? 'bg-neutral-700' : 'hover:bg-neutral-800'
                      }`}
                    >
                      <span className="shrink-0 text-xs font-semibold text-blue-400">p. {r.pagina}</span>
                      <span className="truncate text-xs text-neutral-400">{r.contexto}</span>
                    </button>
                  ))}
                </div>
              )}
              {queryBusqueda && resultadosBusq.length === 0 && (
                <p className="border-t border-neutral-800 px-3 py-2 text-xs text-neutral-600">
                  {Object.keys(textosPaginas).length === 0
                    ? 'Sin texto guardado. Reindexá el documento para activar la búsqueda.'
                    : 'Sin resultados.'}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col items-center gap-4 py-6 px-4">
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              loading={<div className="text-neutral-300 text-sm mt-20">Cargando PDF…</div>}
              error={<div className="text-red-400 text-sm mt-20">Error al cargar el PDF</div>}
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
                const shouldRender = Math.abs(pageNum - paginaActual) <= RENDER_WINDOW
                return (
                  <div
                    key={pageNum}
                    ref={(el) => { pageRefs.current[pageNum - 1] = el }}
                    data-page={pageNum}
                    className="relative shadow-2xl"
                    style={shouldRender ? undefined : { width: pageW, height: pageH, backgroundColor: 'white' }}
                  >
                    {shouldRender && (
                      <>
                        <Page
                          pageNumber={pageNum}
                          scale={zoom}
                          renderTextLayer
                          renderAnnotationLayer={false}
                          onRenderSuccess={applyHighlightsToDOM}
                          onLoadSuccess={
                            pageNum === 1
                              ? (page) => setNaturalPageWidth(page.getViewport({ scale: 1 }).width)
                              : undefined
                          }
                        />
                        {/* Highlight overlay — positioned over canvas, below text layer */}
                        {highlights
                          .filter((h) => h.pagina === pageNum && h.rects?.length)
                          .map((h) => (
                            <div key={h.id} className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 1 }}>
                              {h.rects!.map((r, i) => (
                                <div
                                  key={i}
                                  style={{
                                    position: 'absolute',
                                    left: `${r.x * 100}%`,
                                    top: `${r.y * 100}%`,
                                    width: `${r.width * 100}%`,
                                    height: `${r.height * 100}%`,
                                    backgroundColor: COLOR_FILL[h.color] ?? COLOR_FILL.amarillo,
                                    mixBlendMode: 'multiply',
                                  }}
                                />
                              ))}
                            </div>
                          ))
                        }
                      </>
                    )}
                  </div>
                )
              })}
            </Document>
          </div>
        </div>
      </div>

      {/* ── Panel lateral ── */}
      {panelAbierto && (
        <>
          <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setPanelAbierto(false)} />
          <div className="fixed inset-y-0 right-0 z-30 w-72 md:static md:z-auto md:w-auto">
            <div className="relative h-full">
              <button
                onClick={() => setPanelAbierto(false)}
                className="absolute right-2 top-2 z-10 rounded p-1 text-neutral-500 hover:text-white md:hidden"
              >
                <X className="h-4 w-4" />
              </button>
              <PanelLateral
                highlights={highlights.filter((h) => h.pagina === paginaActual)}
                citas={citas}
                paginaActual={paginaActual}
              />
            </div>
          </div>
        </>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-neutral-800 px-4 py-2 text-sm text-white shadow-xl border border-neutral-700">
          {toast}
        </div>
      )}

      {seleccion && (
        <SelectionPopover
          rect={seleccion.rect}
          onHighlight={(color) => onResaltar(color)}
          onAnotar={onAnotar}
          onCitar={() => { setModalCita(seleccion); cerrarSeleccion() }}
          onCerrar={cerrarSeleccion}
        />
      )}

      {modalCita && (
        <CitaModal
          seleccion={modalCita}
          documento={documento}
          onGuardar={guardarCita}
          onCerrar={() => setModalCita(null)}
        />
      )}
    </div>
  )
}
