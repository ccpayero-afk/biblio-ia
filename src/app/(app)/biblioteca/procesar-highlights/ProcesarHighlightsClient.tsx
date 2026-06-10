'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Documento } from '@/types'
import {
  FileText, Sparkles, Check, X, Loader2, AlertCircle,
  ChevronLeft, CheckSquare, Square, Clock,
} from 'lucide-react'

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

  function toggleDoc(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodos() {
    if (seleccionados.size === documentos.length) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(documentos.map((d) => d.id)))
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

  if (documentos.length === 0) {
    return (
      <div className="max-w-2xl">
        <button onClick={() => router.push('/biblioteca')} className="mb-6 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white">
          <ChevronLeft className="h-4 w-4" /> Volver a Biblioteca
        </button>
        <div className="flex flex-col items-center py-20 text-center">
          <FileText className="h-12 w-12 text-neutral-700" />
          <p className="mt-4 text-lg font-semibold text-white">Sin documentos indexados</p>
          <p className="mt-2 text-sm text-neutral-500">Indexá documentos en la Biblioteca primero.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <button onClick={() => router.push('/biblioteca')} className="mb-6 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-white">
        <ChevronLeft className="h-4 w-4" /> Volver a Biblioteca
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Procesar Highlights</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Extrae highlights de tus PDFs y genera citas directas, conceptos teóricos, ideas clave y fichas automáticamente.
        </p>
      </div>

      {/* Aviso técnico */}
      <div className="mb-5 flex gap-2 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
        <p className="text-xs text-amber-400">
          <strong>Compatible con:</strong> Adobe Acrobat, Zotero, PDF Expert, Foxit.
          Los highlights de <strong>macOS Preview</strong> no incluyen el texto resaltado y no serán detectados.
          Si hay rate limit de Gemini, la app espera automáticamente y reintenta.
        </p>
      </div>

      {/* Controles */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={toggleTodos}
          disabled={procesando}
          className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white disabled:opacity-50"
        >
          {seleccionados.size === documentos.length
            ? <CheckSquare className="h-4 w-4" />
            : <Square className="h-4 w-4" />
          }
          {seleccionados.size === documentos.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
        </button>
        <span className="text-xs text-neutral-600">{seleccionados.size} de {documentos.length} seleccionados</span>
        <div className="flex-1" />
        <button
          onClick={procesarSeleccionados}
          disabled={seleccionados.size === 0 || procesando}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {procesando ? 'Procesando…' : 'Procesar seleccionados'}
        </button>
      </div>

      {/* Resumen de progreso */}
      {completados > 0 && (
        <div className="mb-4 rounded-lg border border-green-900/50 bg-green-950/20 px-4 py-3 text-sm">
          <p className="text-green-400">
            ✓ {completados} documento{completados > 1 ? 's' : ''} procesado{completados > 1 ? 's' : ''}
            {totalCitas > 0 && <span className="text-green-300"> · {totalCitas} citas</span>}
            {totalConceptos > 0 && <span className="text-purple-400"> · {totalConceptos} conceptos</span>}
            {totalIdeas > 0 && <span className="text-blue-400"> · {totalIdeas} ideas</span>}
            {totalNotas !== totalConceptos + totalIdeas && totalNotas > 0 && <span className="text-neutral-400"> · {totalNotas} notas total</span>}
          </p>
        </div>
      )}

      {/* Lista de documentos */}
      <div className="space-y-2">
        {documentos.map((doc) => {
          const estadoDoc = estados[doc.id]
          const seleccionado = seleccionados.has(doc.id)

          return (
            <div
              key={doc.id}
              className={`rounded-xl border bg-neutral-900 transition-colors ${
                seleccionado ? 'border-blue-800' : 'border-neutral-800'
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Checkbox */}
                <button
                  onClick={() => toggleDoc(doc.id)}
                  disabled={procesando || !!estadoDoc}
                  className="flex-shrink-0 text-neutral-400 hover:text-white disabled:opacity-40"
                >
                  {seleccionado
                    ? <CheckSquare className="h-4 w-4 text-blue-400" />
                    : <Square className="h-4 w-4" />
                  }
                </button>

                <FileText className="h-4 w-4 flex-shrink-0 text-neutral-600" />

                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {doc.nombre.replace(/\.pdf$/i, '')}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {doc.autor || 'Sin autor'} · {doc.año || 's.f.'}
                  </p>
                </div>

                {/* Estado */}
                <div className="flex-shrink-0">
                  {!estadoDoc && <span className="text-xs text-neutral-600">Pendiente</span>}
                  {estadoDoc?.estado === 'procesando' && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
                  {estadoDoc?.estado === 'esperando' && (
                    <span className="flex items-center gap-1 text-xs text-amber-400">
                      <Clock className="h-3.5 w-3.5" />
                      {estadoDoc.retryEn}s
                    </span>
                  )}
                  {estadoDoc?.estado === 'completado' && <Check className="h-4 w-4 text-green-400" />}
                  {estadoDoc?.estado === 'sin_anotaciones' && <span className="text-xs text-neutral-500">Sin highlights</span>}
                  {estadoDoc?.estado === 'error' && <X className="h-4 w-4 text-red-400" />}
                </div>
              </div>

              {/* Resultado detallado */}
              {estadoDoc?.resultado && estadoDoc.estado !== 'procesando' && estadoDoc.estado !== 'esperando' && (
                <div className="border-t border-neutral-800 px-4 py-2">
                  {estadoDoc.estado === 'completado' && (
                    <p className="text-xs text-neutral-400">
                      {estadoDoc.resultado.anotaciones} highlights →{' '}
                      {(estadoDoc.resultado.citasCreadas ?? 0) > 0 && (
                        <span className="text-green-400">{estadoDoc.resultado.citasCreadas} citas</span>
                      )}
                      {(estadoDoc.resultado.conceptosCreados ?? 0) > 0 && (
                        <span className="text-purple-400"> · {estadoDoc.resultado.conceptosCreados} conceptos</span>
                      )}
                      {(estadoDoc.resultado.ideasCreadas ?? 0) > 0 && (
                        <span className="text-blue-400"> · {estadoDoc.resultado.ideasCreadas} ideas</span>
                      )}
                      {estadoDoc.resultado.fichaCreada && (
                        <span className="text-amber-400"> · ficha</span>
                      )}
                    </p>
                  )}
                  {estadoDoc.estado === 'sin_anotaciones' && (
                    <p className="text-xs text-neutral-500">{estadoDoc.resultado.mensaje}</p>
                  )}
                  {estadoDoc.estado === 'error' && (
                    <p className="text-xs text-red-400">{estadoDoc.resultado.error}</p>
                  )}
                </div>
              )}

              {/* Mensaje de espera con countdown */}
              {estadoDoc?.estado === 'esperando' && (
                <div className="border-t border-neutral-800 px-4 py-2">
                  <p className="text-xs text-amber-400">
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
