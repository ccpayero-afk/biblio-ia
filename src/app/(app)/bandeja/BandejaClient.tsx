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
          <h1 className="text-2xl font-bold text-white">Bandeja de entrada</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'rgba(148,163,184,0.55)' }}>
            {pendientes.length} nota{pendientes.length !== 1 ? 's' : ''} sin procesar
          </p>
        </div>
        {pendientes.length > 0 && (
          <button
            onClick={procesarTodas}
            disabled={procesandoTodas}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 16px rgba(124,58,237,0.3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 24px rgba(124,58,237,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 16px rgba(124,58,237,0.3)'; e.currentTarget.style.transform = '' }}
          >
            {procesandoTodas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Procesar todo con IA
          </button>
        )}
      </div>

      {cargando && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'rgba(139,92,246,0.6)' }} />
        </div>
      )}

      {!cargando && pendientes.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-2xl py-20 text-center"
          style={{ border: '1px dashed rgba(139,92,246,0.25)', background: 'rgba(255,255,255,0.015)' }}
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.06))', border: '1px solid rgba(139,92,246,0.2)' }}
          >
            <Inbox className="h-8 w-8" style={{ color: 'rgba(139,92,246,0.6)' }} />
          </div>
          <p className="text-lg font-semibold text-white">Bandeja vacía</p>
          <p className="mt-2 text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>No hay notas efímeras pendientes de procesar.</p>
        </div>
      )}

      <div className="space-y-4">
        {pendientes.map((nota) => (
          <div
            key={nota.id}
            className="rounded-xl p-5 transition-all"
            style={nota.aceptada
              ? { background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.15)', opacity: 0.6 }
              : { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }
            }
          >
            {/* Cabecera */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <span className="font-mono text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>{nota.id}</span>
                <p className="mt-1 text-sm line-clamp-3 whitespace-pre-wrap" style={{ color: 'rgba(203,213,225,0.75)' }}>{nota.contenido}</p>
              </div>
              <button
                onClick={() => descartarNota(nota.id)}
                className="flex-shrink-0 rounded p-1 transition-colors"
                style={{ color: 'rgba(148,163,184,0.3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.3)' }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {(nota.documentoOrigenId ?? nota.documentoId) && (
              <p className="mb-3 text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>
                Origen: {nota.documentoOrigenId ?? nota.documentoId}
                {(nota.paginaOrigen ?? nota.pagina) ? ` · p. ${nota.paginaOrigen ?? nota.pagina}` : ''}
              </p>
            )}

            {/* Sugerencia de conversión */}
            {nota.sugerencia && !nota.aceptada && (
              <div
                className="mt-3 rounded-xl p-4 space-y-3"
                style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.15)' }}
              >
                <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'rgba(52,211,153,0.9)' }}>
                  <Sparkles className="h-3.5 w-3.5" /> Sugerencia IA
                </p>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'rgba(148,163,184,0.5)' }}>Título</p>
                  <p className="text-sm font-medium text-white">{nota.sugerencia.titulo_sugerido}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.4)' }}>{nota.sugerencia.razon_titulo}</p>
                </div>
                <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
                  Tipo: <span style={{ color: 'rgba(203,213,225,0.7)' }}>{nota.sugerencia.tipo_sugerido}</span>
                </p>
                <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
                  Etiquetas: <span style={{ color: 'rgba(203,213,225,0.7)' }}>{nota.sugerencia.etiquetas_sugeridas.join(', ')}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => aceptarSugerencia(nota)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all"
                    style={{ background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.3)', color: 'rgba(52,211,153,0.9)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(52,211,153,0.3)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(52,211,153,0.2)' }}
                  >
                    <Check className="h-3.5 w-3.5" /> Aceptar
                  </button>
                  <button
                    onClick={() => setNotas((prev) => prev.map((n) => n.id === nota.id ? { ...n, sugerencia: undefined } : n))}
                    className="rounded-lg px-3 py-1.5 text-xs transition-all"
                    style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.5)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.5)' }}
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}

            {nota.aceptada && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(52,211,153,0.8)' }}>
                <Check className="h-4 w-4" /> Convertida en nota permanente
              </div>
            )}

            {/* Acciones cuando no tiene sugerencia */}
            {!nota.sugerencia && !nota.aceptada && (
              <div className="flex gap-2">
                <button
                  onClick={() => convertirNota(nota.id)}
                  disabled={nota.procesando}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all disabled:opacity-50"
                  style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: 'rgba(167,139,250,0.8)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.15)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)' }}
                >
                  {nota.procesando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Convertir en permanente
                </button>
                <button
                  onClick={() => window.open('/notas', '_self')}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all"
                  style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.5)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(148,163,184,0.5)' }}
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
