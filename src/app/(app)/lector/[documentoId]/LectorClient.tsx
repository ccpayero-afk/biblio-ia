'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { Documento, Highlight, Cita } from '@/types'
import { crearCita } from '@/lib/citas'
import SelectionPopover from './SelectionPopover'
import CitaModal from './CitaModal'
import PanelLateral from './PanelLateral'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, PanelRight, X, Sparkles, Check, Loader2 } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Props {
  documento: Documento
  pdfUrl: string
}

interface Seleccion {
  texto: string
  pagina: number
  rect: DOMRect
}

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth < 768
}

export default function LectorClient({ documento, pdfUrl }: Props) {
  const [numPages, setNumPages] = useState(0)
  const [paginaActual, setPaginaActual] = useState(1)
  const [zoom, setZoom] = useState(1.0)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [citas, setCitas] = useState<Cita[]>([])
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null)
  const [modalCita, setModalCita] = useState<Seleccion | null>(null)
  const [inputPagina, setInputPagina] = useState('1')
  const [anchoContenedor, setAnchoContenedor] = useState(0)
  const [procesandoHL, setProcesandoHL] = useState(false)
  const [hlResultado, setHlResultado] = useState<{ citasCreadas: number; notasCreadas: number; fichaCreada: boolean; anotaciones: number; mensaje?: string; error?: string } | null>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)

  // Ajustar zoom según ancho disponible
  useEffect(() => {
    if (!contenedorRef.current) return
    const obs = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width
      setAnchoContenedor(w)
      // Auto-zoom: fit to container width (A4 PDF = ~595px at 1x)
      const autoZoom = Math.min(Math.max(w / 650, 0.5), 2.0)
      setZoom(parseFloat(autoZoom.toFixed(1)))
    })
    obs.observe(contenedorRef.current)
    return () => obs.disconnect()
  }, [])

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

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSeleccion(null)
      return
    }
    const texto = sel.toString().trim()
    if (texto.length < 5) return
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    setSeleccion({ texto, pagina: paginaActual, rect })
  }, [paginaActual])

  async function procesarHighlights() {
    setProcesandoHL(true)
    try {
      const res = await fetch(`/api/highlights/procesar/${documento.id}`, { method: 'POST' })
      const data = await res.json()
      setHlResultado(data)
      if (data.anotaciones > 0) {
        // Recargar highlights del panel
        const hlRes = await fetch(`/api/highlights/${documento.id}`)
        const hlData = await hlRes.json()
        if (Array.isArray(hlData)) setHighlights(hlData)
      }
    } catch { /* noop */ }
    setProcesandoHL(false)
  }

  function cerrarSeleccion() {
    setSeleccion(null)
    window.getSelection()?.removeAllRanges()
  }

  async function guardarHighlight(color: Highlight['color'], nota?: string) {
    if (!seleccion) return
    const h: Highlight = {
      id: `h_${Date.now()}`,
      documentoId: documento.id,
      texto: seleccion.texto,
      pagina: seleccion.pagina,
      posicion: { x: 0, y: 0, width: 0, height: 0 },
      color,
      nota,
      creadoEn: new Date().toISOString(),
    }
    setHighlights((prev) => [...prev, h])
    cerrarSeleccion()
    await fetch(`/api/highlights/${documento.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(h),
    })
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
    await guardarHighlight('rojo')
    setModalCita(null)
    await fetch('/api/citas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cita),
    })
  }

  function irAPagina(n: number) {
    const p = Math.max(1, Math.min(n, numPages))
    setPaginaActual(p)
    setInputPagina(String(p))
    contenedorRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="flex h-full gap-0 overflow-hidden -m-4 md:-m-6">
      {/* Visor principal */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="flex h-12 items-center gap-2 border-b border-neutral-800 bg-neutral-950 px-3">
          <h2 className="flex-1 truncate text-xs text-neutral-400 md:text-sm md:text-neutral-300">
            {documento.nombre.replace(/\.pdf$/i, '')}
          </h2>

          {/* Navegación */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => irAPagina(paginaActual - 1)}
              disabled={paginaActual <= 1}
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
              className="w-10 rounded border border-neutral-700 bg-neutral-800 px-1 py-0.5 text-center text-xs text-white"
            />
            <span className="text-xs text-neutral-500">/{numPages}</span>
            <button
              onClick={() => irAPagina(paginaActual + 1)}
              disabled={paginaActual >= numPages}
              className="rounded p-1 text-neutral-400 hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Zoom — hidden on very small screens */}
          <div className="hidden items-center gap-0.5 sm:flex">
            <button onClick={() => setZoom((z) => Math.max(0.5, parseFloat((z - 0.1).toFixed(1))))} className="rounded p-1 text-neutral-400 hover:text-white">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-xs text-neutral-400">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(3, parseFloat((z + 0.1).toFixed(1))))} className="rounded p-1 text-neutral-400 hover:text-white">
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          {/* Procesar highlights PDF */}
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
              {hlResultado.anotaciones === 0
                ? 'Sin highlights'
                : <><Check className="h-3 w-3" /> {hlResultado.citasCreadas}c · {hlResultado.notasCreadas}n</>
              }
            </span>
          )}

          <button
            onClick={() => setPanelAbierto((p) => !p)}
            className={`rounded p-1 transition-colors ${panelAbierto ? 'text-blue-400' : 'text-neutral-400 hover:text-white'}`}
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>

        {/* PDF */}
        <div
          ref={contenedorRef}
          className="flex-1 overflow-y-auto bg-neutral-800 flex justify-center py-4 md:py-6"
          onMouseUp={handleMouseUp}
        >
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<div className="text-neutral-400 text-sm mt-20">Cargando PDF…</div>}
            error={<div className="text-red-400 text-sm mt-20">Error al cargar el PDF</div>}
          >
            <Page
              pageNumber={paginaActual}
              scale={zoom}
              width={anchoContenedor > 0 ? Math.min(anchoContenedor - 32, 900) : undefined}
              renderTextLayer
              renderAnnotationLayer={false}
              className="shadow-2xl"
            />
          </Document>
        </div>
      </div>

      {/* Panel lateral — overlay on mobile, static on desktop */}
      {panelAbierto && (
        <>
          {/* Mobile overlay background */}
          <div
            className="fixed inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => setPanelAbierto(false)}
          />
          {/* Panel */}
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

      {seleccion && (
        <SelectionPopover
          rect={seleccion.rect}
          onHighlight={() => guardarHighlight('amarillo')}
          onAnotar={() => guardarHighlight('azul', 'nota')}
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
