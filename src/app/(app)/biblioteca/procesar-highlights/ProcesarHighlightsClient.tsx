'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Documento } from '@/types'
import { displayNombre } from '@/lib/nombre'
import {
  FileText, Sparkles, Check, X, Loader2, AlertCircle,
  ChevronLeft, CheckSquare, Square, Clock, Search,
} from 'lucide-react'
import { CarpetaSelector } from '@/components/CarpetaSelector'
import type { Carpeta } from '@/types'

interface ResultadoDoc {
  anotaciones: number
  citasCreadas: number
  conceptosCreados?: number
  ideasCreadas?: number
  notasCreadas: number
  fichaCreada: boolean
  mensaje?: string
  error?: string
}

interface EstadoDoc {
  estado: 'pendiente' | 'procesando' | 'esperando' | 'completado' | 'error' | 'sin_anotaciones'
  resultado?: ResultadoDoc
  retryEn?: number   // segundos restantes de espera
}

// Extrae segundos de un mensaje de error 429 de Gemini
function extraerSegundosRetry(msg: string): number {
  const m = msg.match(/Reintentá en (\d+) segundo/) ?? msg.match(/Reintentá en (\d+) minuto/)
  if (!m) return 45
  const n = parseInt(m[1])
  return msg.includes('minuto') ? n * 60 : n
}

export default function ProcesarHighlightsClient({ documentos }: { documentos: Documento[] }) {
  const router = useRouter()
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [estados, setEstados] = useState<Record<string, EstadoDoc>>({})
  const [procesando, setProcesando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [carpetas, setCarpetas] = useState<Carpeta[]>([])
  const [carpetasFiltro, setCarpetasFiltro] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/carpetas')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCarpetas(data) })
      .catch(() => {})
  }, [])

  // Filtrado por búsqueda y carpetas
  const docsFiltrados = documentos.filter((d) => {
    if (carpetasFiltro.length && !carpetasFiltro.includes(d.carpetaId ?? '__sin_carpeta__')) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return (
        displayNombre(d).toLowerCase().includes(q) ||
        (d.autor ?? '').toLowerCase().includes(q) ||
        (d.titulo ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  function toggleDoc(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodos() {
    if (seleccionados.size === docsFiltrados.length) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(docsFiltrados.map((d) => d.id)))
    }
  }

  async function procesarSeleccionados() {
    if (seleccionados.size === 0 || procesando) return
    setProcesando(true)

    const ids = [...seleccionados]
    for (const id of ids) {
      setEstados((prev) => ({ ...prev, [id]: { estado: 'procesando' } }))

      let intentos = 0
      let procesado = false

      while (!procesado && intentos < 4) {
        try {
          const res = await fetch(`/api/highlights/procesar/${id}`, { method: 'POST' })
          const data: ResultadoDoc = await res.json()

          if (res.status === 429 || (data.error && data.error.includes('rate limit'))) {
            const espera = extraerSegundosRetry(data.error ?? '')
            intentos++
            // Cuenta regresiva visible
            for (let t = espera; t > 0; t--) {
              setEstados((prev) => ({ ...prev, [id]: { estado: 'esperando', retryEn: t } }))
              await new Promise((r) => setTimeout(r, 1000))
            }
            setEstados((prev) => ({ ...prev, [id]: { estado: 'procesando' } }))
            continue
          }

          if (data.error) {
            setEstados((prev) => ({ ...prev, [id]: { estado: 'error', resultado: data } }))
          } else if (data.anotaciones === 0) {
            setEstados((prev) => ({ ...prev, [id]: { estado: 'sin_anotaciones', resultado: data } }))
          } else {
            setEstados((prev) => ({ ...prev, [id]: { estado: 'completado', resultado: data } }))
          }
          procesado = true
        } catch (e) {
          setEstados((prev) => ({
            ...prev,
            [id]: { estado: 'error', resultado: { anotaciones: 0, citasCreadas: 0, notasCreadas: 0, fichaCreada: false, error: String(e) } },
          }))
          procesado = true
        }
      }

      if (!procesado) {
        setEstados((prev) => ({
          ...prev,
          [id]: { estado: 'error', resultado: { anotaciones: 0, citasCreadas: 0, notasCreadas: 0, fichaCreada: false, error: 'Rate limit: se agotaron los reintentos. Esperá unos minutos y volvé a procesar.' } },
        }))
      }

      // Pausa entre documentos para no saturar Gemini
      await new Promise((r) => setTimeout(r, 2000))
    }

    setProcesando(false)
  }

  const completados = Object.values(estados).filter((e) => e.estado === 'completado').length
  const totalCitas = Object.values(estados).reduce((s, e) => s + (e.resultado?.citasCreadas ?? 0), 0)
  const totalConceptos = Object.values(estados).reduce((s, e) => s + (e.resultado?.conceptosCreados ?? 0), 0)
  const totalIdeas = Object.values(estados).reduce((s, e) => s + (e.resultado?.ideasCreadas ?? 0), 0)
  const totalNotas = Object.values(estados).reduce((s, e) => s + (e.resultado?.notasCreadas ?? 0), 0)

  const backBtn = (
    <button
      onClick={() => router.push('/biblioteca')}
      className="mb-6 flex items-center gap-1.5 text-sm transition-colors"
      style={{ color: 'rgba(34,211,238,0.6)' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#22d3ee' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(34,211,238,0.6)' }}
    >
      <ChevronLeft className="h-4 w-4" /> Volver a Biblioteca
    </button>
  )

  if (documentos.length === 0) {
    return (
      <div className="max-w-2xl">
        {backBtn}
        <div className="flex flex-col items-center py-20 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.06))', border: '1px solid rgba(139,92,246,0.2)' }}
          >
            <FileText className="h-8 w-8" style={{ color: 'rgba(139,92,246,0.6)' }} />
          </div>
          <p className="text-lg font-semibold text-white">Sin documentos</p>
          <p className="mt-2 text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>Subí PDFs en la Biblioteca para empezar.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {backBtn}

      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Procesar Highlights</h1>
        <p className="mt-1 text-sm" style={{ color: 'rgba(148,163,184,0.55)' }}>
          Extrae highlights de tus PDFs y genera citas directas, conceptos teóricos, ideas clave y fichas automáticamente.
        </p>
      </div>

      {/* Aviso técnico */}
      <div
        className="mb-5 flex gap-2 rounded-xl px-4 py-3"
        style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}
      >
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: 'rgba(245,158,11,0.8)' }} />
        <p className="text-xs" style={{ color: 'rgba(245,158,11,0.75)' }}>
          <strong>Compatible con:</strong> Adobe Acrobat, Zotero, PDF Expert, Foxit.
          Los highlights de <strong>macOS Preview</strong> no incluyen el texto resaltado y no serán detectados.
          Si hay rate limit de Gemini, la app espera automáticamente y reintenta.
        </p>
      </div>

      {/* Búsqueda */}
      <div className="mb-3 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.3)' }} />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o autor…"
          className="w-full rounded-xl py-2.5 pl-9 pr-4 text-sm text-white placeholder-neutral-600 focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
        />
      </div>

      {/* Filtro carpetas */}
      <div className="mb-4">
        <CarpetaSelector carpetas={carpetas} filtro={carpetasFiltro} onChange={setCarpetasFiltro} />
      </div>

      {/* Controles */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={toggleTodos}
          disabled={procesando}
          className="flex items-center gap-1.5 text-sm transition-colors disabled:opacity-50"
          style={{ color: 'rgba(148,163,184,0.5)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.5)' }}
        >
          {seleccionados.size === docsFiltrados.length && docsFiltrados.length > 0
            ? <CheckSquare className="h-4 w-4" style={{ color: 'rgba(139,92,246,0.8)' }} />
            : <Square className="h-4 w-4" />
          }
          {seleccionados.size === docsFiltrados.length && docsFiltrados.length > 0 ? 'Deseleccionar todos' : 'Seleccionar todos'}
        </button>
        <span className="text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>{seleccionados.size} de {docsFiltrados.length} seleccionados</span>
        <div className="flex-1" />
        <button
          onClick={procesarSeleccionados}
          disabled={seleccionados.size === 0 || procesando}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 14px rgba(124,58,237,0.3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 22px rgba(124,58,237,0.5)' }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 14px rgba(124,58,237,0.3)' }}
        >
          {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {procesando ? 'Procesando…' : 'Procesar seleccionados'}
        </button>
      </div>

      {/* Resumen de progreso */}
      {completados > 0 && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)' }}
        >
          <p style={{ color: 'rgba(52,211,153,0.9)' }}>
            ✓ {completados} documento{completados > 1 ? 's' : ''} procesado{completados > 1 ? 's' : ''}
            {totalCitas > 0 && <span style={{ color: 'rgba(52,211,153,0.7)' }}> · {totalCitas} citas</span>}
            {totalConceptos > 0 && <span style={{ color: 'rgba(167,139,250,0.8)' }}> · {totalConceptos} conceptos</span>}
            {totalIdeas > 0 && <span style={{ color: 'rgba(34,211,238,0.8)' }}> · {totalIdeas} ideas</span>}
            {totalNotas !== totalConceptos + totalIdeas && totalNotas > 0 && <span style={{ color: 'rgba(148,163,184,0.5)' }}> · {totalNotas} notas total</span>}
          </p>
        </div>
      )}

      {/* Lista de documentos */}
      <div className="space-y-2">
        {docsFiltrados.length === 0 && (
          <p className="py-8 text-center text-sm" style={{ color: 'rgba(148,163,184,0.4)' }}>Sin resultados para la búsqueda o filtro.</p>
        )}
        {docsFiltrados.map((doc) => {
          const estadoDoc = estados[doc.id]
          const seleccionado = seleccionados.has(doc.id)

          return (
            <div
              key={doc.id}
              className="rounded-xl transition-all"
              style={seleccionado
                ? { background: 'rgba(109,40,217,0.06)', border: '1px solid rgba(139,92,246,0.3)' }
                : { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }
              }
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Checkbox */}
                <button
                  onClick={() => toggleDoc(doc.id)}
                  disabled={procesando || !!estadoDoc}
                  className="flex-shrink-0 transition-colors disabled:opacity-40"
                  style={{ color: 'rgba(148,163,184,0.4)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}
                >
                  {seleccionado
                    ? <CheckSquare className="h-4 w-4" style={{ color: 'rgba(139,92,246,0.8)' }} />
                    : <Square className="h-4 w-4" />
                  }
                </button>

                <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'rgba(139,92,246,0.5)' }} />

                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {displayNombre(doc)}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
                    {doc.autor || 'Sin autor'} · {doc.año || 's.f.'}
                  </p>
                </div>

                {/* Estado */}
                <div className="flex-shrink-0">
                  {!estadoDoc && <span className="text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>Pendiente</span>}
                  {estadoDoc?.estado === 'procesando' && <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'rgba(139,92,246,0.7)' }} />}
                  {estadoDoc?.estado === 'esperando' && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(245,158,11,0.8)' }}>
                      <Clock className="h-3.5 w-3.5" />
                      {estadoDoc.retryEn}s
                    </span>
                  )}
                  {estadoDoc?.estado === 'completado' && <Check className="h-4 w-4" style={{ color: 'rgba(52,211,153,0.8)' }} />}
                  {estadoDoc?.estado === 'sin_anotaciones' && <span className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>Sin highlights</span>}
                  {estadoDoc?.estado === 'error' && <X className="h-4 w-4 text-red-400" />}
                </div>
              </div>

              {/* Resultado detallado */}
              {estadoDoc?.resultado && estadoDoc.estado !== 'procesando' && estadoDoc.estado !== 'esperando' && (
                <div className="px-4 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  {estadoDoc.estado === 'completado' && (
                    <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
                      {estadoDoc.resultado.anotaciones} highlights →{' '}
                      {(estadoDoc.resultado.citasCreadas ?? 0) > 0 && (
                        <span style={{ color: 'rgba(52,211,153,0.8)' }}>{estadoDoc.resultado.citasCreadas} citas</span>
                      )}
                      {(estadoDoc.resultado.conceptosCreados ?? 0) > 0 && (
                        <span style={{ color: 'rgba(167,139,250,0.8)' }}> · {estadoDoc.resultado.conceptosCreados} conceptos</span>
                      )}
                      {(estadoDoc.resultado.ideasCreadas ?? 0) > 0 && (
                        <span style={{ color: 'rgba(34,211,238,0.8)' }}> · {estadoDoc.resultado.ideasCreadas} ideas</span>
                      )}
                      {estadoDoc.resultado.fichaCreada && (
                        <span style={{ color: 'rgba(245,158,11,0.8)' }}> · ficha</span>
                      )}
                    </p>
                  )}
                  {estadoDoc.estado === 'sin_anotaciones' && (
                    <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>{estadoDoc.resultado.mensaje}</p>
                  )}
                  {estadoDoc.estado === 'error' && (
                    <p className="text-xs text-red-400">{estadoDoc.resultado.error}</p>
                  )}
                </div>
              )}

              {/* Mensaje de espera con countdown */}
              {estadoDoc?.estado === 'esperando' && (
                <div className="px-4 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-xs" style={{ color: 'rgba(245,158,11,0.75)' }}>
                    Rate limit de Gemini — reintentando en {estadoDoc.retryEn}s…
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
