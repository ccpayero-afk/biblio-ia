'use client'

import { useState, useCallback } from 'react'
import { Documento } from '@/types'
import { X, CheckCircle2, AlertCircle, Loader2, Circle, ChevronRight } from 'lucide-react'

interface Props {
  documentos: Documento[]
  onCerrar: () => void
  onTerminado: () => void
}

type FaseEstado = 'pendiente' | 'activo' | 'ok' | 'error' | 'saltado'

interface FaseInfo {
  estado: FaseEstado
  progreso: { actual: number; total: number } | null
  detalle: string
  resultado?: string
}

const FASE_INICIAL: FaseInfo = { estado: 'pendiente', progreso: null, detalle: '' }

function EstadoIcon({ estado }: { estado: FaseEstado }) {
  if (estado === 'ok')      return <CheckCircle2 className="h-5 w-5 text-green-400" />
  if (estado === 'error')   return <AlertCircle  className="h-5 w-5 text-red-400" />
  if (estado === 'activo')  return <Loader2      className="h-5 w-5 animate-spin text-blue-400" />
  if (estado === 'saltado') return <CheckCircle2 className="h-5 w-5 text-neutral-500" />
  return <Circle className="h-5 w-5 text-neutral-600" />
}

function BarraProgreso({ progreso }: { progreso: { actual: number; total: number } | null }) {
  if (!progreso) return null
  const pct = progreso.total > 0 ? (progreso.actual / progreso.total) * 100 : 0
  return (
    <div className="mt-1.5 space-y-0.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-neutral-500">{progreso.actual} / {progreso.total}</p>
    </div>
  )
}

export default function PipelineModal({ documentos, onCerrar, onTerminado }: Props) {
  const [corriendo, setCorriendo] = useState(false)
  const [terminado, setTerminado] = useState(false)
  const [fases, setFases] = useState<[FaseInfo, FaseInfo, FaseInfo, FaseInfo]>([
    FASE_INICIAL, FASE_INICIAL, FASE_INICIAL, FASE_INICIAL,
  ])

  const setFase = useCallback((i: 0 | 1 | 2 | 3, patch: Partial<FaseInfo>) => {
    setFases((prev) => {
      const next = [...prev] as typeof prev
      next[i] = { ...next[i], ...patch }
      return next
    })
  }, [])

  // ── Conteos para mostrar antes de correr ─────────────────────────────────────
  const indexados  = documentos.filter((d) => d.estado === 'indexado')
  const sinFicha   = indexados.filter((d) => !d.fichaGenerada)
  const conFicha   = indexados.filter((d) => d.fichaGenerada)

  async function correrPipeline() {
    setCorriendo(true)

    // ── Fase 1: Generar fichas ──────────────────────────────────────────────────
    setFase(0, { estado: 'activo', detalle: 'Generando fichas de lectura…', progreso: { actual: 0, total: sinFicha.length } })

    let fichasOk = 0
    let fichasNuevas: Documento[] = []

    if (sinFicha.length === 0) {
      setFase(0, { estado: 'saltado', detalle: 'Todos los documentos ya tienen ficha.', resultado: `${conFicha.length} fichas existentes` })
    } else {
      for (let i = 0; i < sinFicha.length; i++) {
        const doc = sinFicha[i]
        setFase(0, { estado: 'activo', detalle: `Ficha: ${doc.nombre.replace(/\.pdf$/i, '').slice(0, 50)}…`, progreso: { actual: i, total: sinFicha.length } })
        try {
          const res = await fetch(`/api/fichas/${doc.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentoNombre: doc.nombre, autor: doc.autor, año: doc.año }),
          })
          if (res.ok) { fichasOk++; fichasNuevas.push(doc) }
        } catch { /* continuar */ }
        if (i < sinFicha.length - 1) await new Promise((r) => setTimeout(r, 800))
      }
      setFase(0, {
        estado: fichasOk > 0 || sinFicha.length === 0 ? 'ok' : 'error',
        progreso: { actual: fichasOk, total: sinFicha.length },
        detalle: fichasOk === sinFicha.length ? 'Fichas generadas.' : `${fichasOk}/${sinFicha.length} generadas.`,
        resultado: `${fichasOk} nuevas fichas`,
      })
    }

    // ── Fase 2: Extraer notas + citas de fichas ───────────────────────────────
    const docsParaExtraer = [...conFicha, ...fichasNuevas]
    setFase(1, { estado: 'activo', detalle: 'Extrayendo notas y citas…', progreso: { actual: 0, total: docsParaExtraer.length } })

    let notasTotales = 0
    let citasTotales = 0
    let datosTotales = 0

    if (docsParaExtraer.length === 0) {
      setFase(1, { estado: 'saltado', detalle: 'No hay fichas para procesar.', resultado: '—' })
    } else {
      for (let i = 0; i < docsParaExtraer.length; i++) {
        const doc = docsParaExtraer[i]
        setFase(1, { estado: 'activo', detalle: `Notas: ${doc.nombre.replace(/\.pdf$/i, '').slice(0, 50)}…`, progreso: { actual: i, total: docsParaExtraer.length } })
        try {
          const res = await fetch(`/api/procesar/desde-ficha/${doc.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentoNombre: doc.nombre, autor: doc.autor, año: doc.año }),
          })
          const data = await res.json()
          if (data.ok && !data.saltado) {
            notasTotales += data.notasCreadas ?? 0
            citasTotales += data.citasCreadas ?? 0
            datosTotales += data.datosCreados ?? 0
          }
        } catch { /* continuar */ }
        if (i < docsParaExtraer.length - 1) await new Promise((r) => setTimeout(r, 500))
      }
      setFase(1, {
        estado: 'ok',
        progreso: { actual: docsParaExtraer.length, total: docsParaExtraer.length },
        detalle: 'Notas, citas y datos extraídos.',
        resultado: `${notasTotales} notas · ${citasTotales} citas · ${datosTotales} datos`,
      })
    }

    // ── Fase 3: Vincular notas (en lotes de 15) ───────────────────────────────
    setFase(2, { estado: 'activo', detalle: 'Generando vínculos automáticos…', progreso: null })

    let vinculosTotal = 0
    let notasProcesadas = 0
    let offset = 0
    let intentos = 0
    const MAX_INTENTOS = 5

    try {
      while (intentos < MAX_INTENTOS) {
        setFase(2, { estado: 'activo', detalle: `Vinculando notas (lote ${intentos + 1})…`, progreso: null })
        const res = await fetch('/api/procesar/vinculos-lote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset }),
        })
        const data = await res.json()
        if (!data.ok) break
        vinculosTotal += data.vinculosCreados ?? 0
        notasProcesadas += data.notasProcesadas ?? 0
        offset += data.notasProcesadas ?? 0
        if ((data.restantes ?? 0) === 0 || (data.notasProcesadas ?? 0) === 0) break
        intentos++
        await new Promise((r) => setTimeout(r, 1000))
      }
      setFase(2, {
        estado: 'ok',
        detalle: 'Vínculos generados.',
        resultado: `${vinculosTotal} vínculos en ${notasProcesadas} notas`,
        progreso: null,
      })
    } catch {
      setFase(2, { estado: 'error', detalle: 'Error al generar vínculos.', progreso: null })
    }

    // ── Fase 4: Actualizar metadatos masivo (forzar) ─────────────────────────
    setFase(3, { estado: 'activo', detalle: 'Actualizando metadatos (PDF + CrossRef)…', progreso: { actual: 0, total: indexados.length } })

    let metaOk = 0
    for (let i = 0; i < indexados.length; i++) {
      const doc = indexados[i]
      setFase(3, { estado: 'activo', detalle: `Metadatos: ${doc.nombre.replace(/\.pdf$/i, '').slice(0, 50)}…`, progreso: { actual: i, total: indexados.length } })
      try {
        await fetch(`/api/metadatos/${doc.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forzar: false }),  // solo rellena vacíos
        })
        metaOk++
      } catch { /* continuar */ }
      if (i < indexados.length - 1) await new Promise((r) => setTimeout(r, 300))
    }
    setFase(3, {
      estado: 'ok',
      progreso: { actual: metaOk, total: indexados.length },
      detalle: 'Metadatos actualizados.',
      resultado: `${metaOk} documentos`,
    })

    setCorriendo(false)
    setTerminado(true)
  }

  const fasesInfo = [
    { titulo: 'Generar fichas de lectura', desc: `${sinFicha.length} sin ficha · ${conFicha.length} ya generadas` },
    { titulo: 'Extraer notas, citas y datos de fichas', desc: 'Sin costo de tokens — usa fichas ya generadas' },
    { titulo: 'Vincular notas automáticamente', desc: 'IA detecta relaciones conceptuales entre notas' },
    { titulo: 'Completar metadatos (PDF + CrossRef)', desc: 'Solo rellena campos vacíos, sin sobreescribir' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 p-5 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">Procesar biblioteca</h2>
            <p className="mt-0.5 text-xs text-neutral-500">{indexados.length} documentos indexados</p>
          </div>
          {!corriendo && (
            <button onClick={onCerrar} className="rounded p-1 text-neutral-500 hover:text-neutral-300">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Fases */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {fasesInfo.map((info, i) => {
            const fase = fases[i]
            return (
              <div
                key={i}
                className={`rounded-xl border p-4 transition-colors ${
                  fase.estado === 'activo' ? 'border-blue-700 bg-blue-950/20' :
                  fase.estado === 'ok'     ? 'border-green-800 bg-green-950/20' :
                  fase.estado === 'error'  ? 'border-red-800 bg-red-950/20' :
                  fase.estado === 'saltado'? 'border-neutral-800 bg-neutral-900/50' :
                  'border-neutral-800 bg-neutral-900/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">
                    <EstadoIcon estado={fase.estado} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Fase {i + 1}</span>
                      {i > 0 && fases[i - 1].estado !== 'ok' && fases[i - 1].estado !== 'saltado' && fase.estado === 'pendiente' && (
                        <ChevronRight className="h-3 w-3 text-neutral-700" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-white">{info.titulo}</p>
                    <p className="text-xs text-neutral-500">
                      {fase.estado === 'pendiente' ? info.desc : fase.detalle}
                    </p>
                    {fase.resultado && (
                      <p className="mt-1 text-xs font-medium text-green-400">{fase.resultado}</p>
                    )}
                    <BarraProgreso progreso={fase.progreso} />
                  </div>
                </div>
              </div>
            )
          })}

          {indexados.length === 0 && (
            <div className="rounded-xl border border-amber-800 bg-amber-950/20 p-4 text-sm text-amber-400">
              No hay documentos indexados. Indexá los PDFs primero para generar fichas.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-neutral-800 p-5 flex-shrink-0">
          {terminado ? (
            <>
              <p className="mr-auto self-center text-xs text-green-400">Pipeline completado</p>
              <button
                onClick={() => { onTerminado(); onCerrar() }}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
              >
                Cerrar y recargar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onCerrar}
                disabled={corriendo}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={correrPipeline}
                disabled={corriendo || indexados.length === 0}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {corriendo
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando…</>
                  : '▶ Iniciar pipeline'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
