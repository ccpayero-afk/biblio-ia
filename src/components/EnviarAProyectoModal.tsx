'use client'

import { useState, useEffect } from 'react'
import { X, FolderOpen, Check, Loader2 } from 'lucide-react'
import type { Proyecto } from '@/types'

interface Props {
  tipo: 'nota' | 'cita' | 'documento'
  itemId: string
  itemLabel?: string
  onClose: () => void
  onEnviado?: (proyectoNombre: string) => void
}

export default function EnviarAProyectoModal({ tipo, itemId, itemLabel, onClose, onEnviado }: Props) {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [enviados, setEnviados] = useState<Set<string>>(new Set())
  const [seccionPorProyecto, setSeccionPorProyecto] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/proyectos')
      .then(r => r.json())
      .then(data => setProyectos(Array.isArray(data) ? data : []))
      .catch(() => setProyectos([]))
      .finally(() => setCargando(false))
  }, [])

  async function enviar(proyecto: Proyecto) {
    if (enviando) return
    setEnviando(proyecto.id)
    try {
      const res = await fetch('/api/proyectos/vincular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyectoId: proyecto.id,
          tipo,
          itemId,
          seccionId: seccionPorProyecto[proyecto.id] || undefined,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setEnviados(prev => new Set([...prev, proyecto.id]))
        onEnviado?.(proyecto.nombre)
      }
    } finally {
      setEnviando(null)
    }
  }

  const tipoLabel = tipo === 'nota' ? 'nota' : tipo === 'cita' ? 'cita' : 'documento'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="text-sm font-semibold text-white">Enviar a proyecto</h2>
            {itemLabel && <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(148,163,184,0.5)' }}>{tipoLabel}: {itemLabel}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(148,163,184,0.5)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {cargando ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'rgba(139,92,246,0.5)' }} />
            </div>
          ) : proyectos.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'rgba(148,163,184,0.4)' }}>
              No hay proyectos. Creá uno primero desde Proyectos.
            </p>
          ) : (
            proyectos.map((proyecto) => {
              const yaEnviado = enviados.has(proyecto.id)
              return (
                <div
                  key={proyecto.id}
                  className="rounded-xl p-3 space-y-2"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <FolderOpen className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'rgba(139,92,246,0.6)' }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{proyecto.nombre}</p>
                        <p className="text-xs truncate" style={{ color: 'rgba(148,163,184,0.4)' }}>
                          {proyecto.tipo} · {proyecto.secciones.length} secciones
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => enviar(proyecto)}
                      disabled={!!enviando || yaEnviado}
                      className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                      style={yaEnviado
                        ? { background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(52,211,153,0.8)' }
                        : { background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }
                      }
                    >
                      {enviando === proyecto.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : yaEnviado
                          ? <><Check className="h-3 w-3" /> Enviado</>
                          : 'Agregar'}
                    </button>
                  </div>

                  {/* Optional: assign to specific section */}
                  {proyecto.secciones.length > 0 && !yaEnviado && (
                    <select
                      className="w-full text-xs rounded-lg px-2 py-1.5 outline-none"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.7)' }}
                      value={seccionPorProyecto[proyecto.id] ?? ''}
                      onChange={e => setSeccionPorProyecto(prev => ({ ...prev, [proyecto.id]: e.target.value }))}
                    >
                      <option value="">Sin sección específica</option>
                      {proyecto.secciones.map(s => (
                        <option key={s.id} value={s.id}>{s.titulo}</option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
