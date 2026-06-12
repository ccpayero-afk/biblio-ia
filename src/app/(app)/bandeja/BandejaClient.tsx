'use client'

import { useCallback, useEffect, useState } from 'react'
import { Nota } from '@/types'
import { Inbox, Loader2, Sparkles, Trash2, ArrowRight, Check } from 'lucide-react'

interface SugerenciaConversion {
  titulo_sugerido: string
  contenido_sugerido: string
  tipo_sugerido: 'permanente' | 'estructura' | 'proyecto'
  etiquetas_sugeridas: string[]
  razon_titulo: string
}

interface NotaConSugerencia extends Nota {
  sugerencia?: SugerenciaConversion
  procesando?: boolean
  aceptada?: boolean
}

export default function BandejaClient() {
  const [notas, setNotas] = useState<NotaConSugerencia[]>([])
  const [cargando, setCargando] = useState(true)
  const [procesandoTodas, setProcesandoTodas] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/notas?tipo=efimera')
      const data = await res.json()
      if (Array.isArray(data)) setNotas(data.filter((n: Nota) => n.tipo === 'efimera' || n.tipo === 'manual'))
    } catch { /* silencioso */ }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function convertirNota(id: string) {
    setNotas((prev) => prev.map((n) => n.id === id ? { ...n, procesando: true } : n))
    try {
      const res = await fetch(`/api/notas/${id}/convertir`, { method: 'POST' })
      const data = await res.json()
      if (!data.error) {
        setNotas((prev) => prev.map((n) => n.id === id ? { ...n, procesando: false, sugerencia: data } : n))
      } else {
        setNotas((prev) => prev.map((n) => n.id === id ? { ...n, procesando: false } : n))
      }
    } catch {
      setNotas((prev) => prev.map((n) => n.id === id ? { ...n, procesando: false } : n))
    }
  }

  async function aceptarSugerencia(nota: NotaConSugerencia) {
    if (!nota.sugerencia) return
    await fetch(`/api/notas/${nota.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: nota.sugerencia.titulo_sugerido,
        contenido: nota.sugerencia.contenido_sugerido,
        tipo: nota.sugerencia.tipo_sugerido,
        etiquetas: nota.sugerencia.etiquetas_sugeridas,
      }),
    })
    setNotas((prev) => prev.map((n) => n.id === nota.id ? { ...n, aceptada: true } : n))
  }

  async function descartarNota(id: string) {
    if (!confirm('¿Eliminar esta nota de la bandeja?')) return
    await fetch(`/api/notas/${id}`, { method: 'DELETE' })
    setNotas((prev) => prev.filter((n) => n.id !== id))
  }

  async function procesarTodas() {
    setProcesandoTodas(true)
    const pendientes = notas.filter((n) => !n.sugerencia && !n.aceptada)
    for (const nota of pendientes) {
      await convertirNota(nota.id)
      await new Promise((r) => setTimeout(r, 500))
    }
    setProcesandoTodas(false)
  }

  const pendientes = notas.filter((n) => !n.aceptada)

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Bandeja de entrada</h1>
          <p className="mt-0.5 text-sm text-neutral-400">
            {pendientes.length} nota{pendientes.length !== 1 ? 's' : ''} sin procesar
          </p>
        </div>
        {pendientes.length > 0 && (
          <button
            onClick={procesarTodas}
            disabled={procesandoTodas}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-500 hover:to-violet-500 disabled:opacity-50"
          >
            {procesandoTodas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Procesar todo con IA
          </button>
        )}
      </div>

      {cargando && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
        </div>
      )}

      {!cargando && pendientes.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-700 py-20 text-center">
          <Inbox className="h-12 w-12 text-neutral-700" />
          <p className="mt-4 text-lg font-semibold text-white">Bandeja vacía</p>
          <p className="mt-2 text-sm text-neutral-500">No hay notas efímeras pendientes de procesar.</p>
        </div>
      )}

      <div className="space-y-4">
        {pendientes.map((nota) => (
          <div
            key={nota.id}
            className={`rounded-xl border bg-neutral-900 p-5 transition-all ${nota.aceptada ? 'border-green-900/40 opacity-50' : 'border-neutral-800'}`}
          >
            {/* Cabecera */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <span className="font-mono text-xs text-neutral-600">{nota.id}</span>
                <p className="mt-1 text-sm text-neutral-300 line-clamp-3 whitespace-pre-wrap">{nota.contenido}</p>
              </div>
              <button
                onClick={() => descartarNota(nota.id)}
                className="flex-shrink-0 rounded p-1 text-neutral-700 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {(nota.documentoOrigenId ?? nota.documentoId) && (
              <p className="mb-3 text-xs text-neutral-600">
                Origen: {nota.documentoOrigenId ?? nota.documentoId}
                {(nota.paginaOrigen ?? nota.pagina) ? ` · p. ${nota.paginaOrigen ?? nota.pagina}` : ''}
              </p>
            )}

            {/* Sugerencia de conversión */}
            {nota.sugerencia && !nota.aceptada && (
              <div className="mt-3 rounded-lg border border-green-900/30 bg-green-950/10 p-4 space-y-3">
                <p className="text-xs font-semibold text-green-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Sugerencia IA
                </p>
                <div>
                  <p className="text-xs text-neutral-500">Título</p>
                  <p className="text-sm font-medium text-white">{nota.sugerencia.titulo_sugerido}</p>
                  <p className="text-xs text-neutral-600">{nota.sugerencia.razon_titulo}</p>
                </div>
                <p className="text-xs text-neutral-500">Tipo: <span className="text-neutral-300">{nota.sugerencia.tipo_sugerido}</span></p>
                <p className="text-xs text-neutral-500">Etiquetas: <span className="text-neutral-300">{nota.sugerencia.etiquetas_sugeridas.join(', ')}</span></p>
                <div className="flex gap-2">
                  <button
                    onClick={() => aceptarSugerencia(nota)}
                    className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600"
                  >
                    <Check className="h-3.5 w-3.5" /> Aceptar
                  </button>
                  <button
                    onClick={() => setNotas((prev) => prev.map((n) => n.id === nota.id ? { ...n, sugerencia: undefined } : n))}
                    className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}

            {nota.aceptada && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <Check className="h-4 w-4" /> Convertida en nota permanente
              </div>
            )}

            {/* Acciones cuando no tiene sugerencia */}
            {!nota.sugerencia && !nota.aceptada && (
              <div className="flex gap-2">
                <button
                  onClick={() => convertirNota(nota.id)}
                  disabled={nota.procesando}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-800/50 bg-blue-950/20 px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-950/40 disabled:opacity-50"
                >
                  {nota.procesando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Convertir en permanente
                </button>
                <button
                  onClick={() => window.open('/notas', '_self')}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:border-neutral-600"
                >
                  <ArrowRight className="h-3.5 w-3.5" /> Ver en Notas
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
