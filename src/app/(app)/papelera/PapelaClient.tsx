'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Nota, TipoNota } from '@/types'

type NotaEliminada = Nota & { eliminadaEn: string }

const TIPOS_LABEL: Record<string, string> = {
  efimera: 'Efímera',
  referencia: 'Referencia',
  permanente: 'Permanente',
  estructura: 'Estructura',
  proyecto: 'Proyecto',
  manual: 'Manual',
  ia: 'IA',
  consulta: 'Consulta',
  ficha: 'Ficha',
}

const TIPOS_COLOR: Record<string, string> = {
  efimera: 'text-orange-400 bg-orange-950/40 border-orange-800/50',
  referencia: 'text-blue-400 bg-blue-950/40 border-blue-800/50',
  permanente: 'text-green-400 bg-green-950/40 border-green-800/50',
  estructura: 'text-purple-400 bg-purple-950/40 border-purple-800/50',
  proyecto: 'text-teal-400 bg-teal-950/40 border-teal-800/50',
}

export default function PapelaClient() {
  const [notas, setNotas] = useState<NotaEliminada[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      try {
        const res = await fetch('/api/notas?incluir_eliminadas=true')
        const data = await res.json()
        if (!Array.isArray(data)) return
        const eliminadas = (data as (Nota & { eliminadaEn?: string })[])
          .filter((n) => n.eliminadaEn)
          .map((n) => ({ ...n, eliminadaEn: n.eliminadaEn! })) as NotaEliminada[]

        // Auto-purge notas con más de 30 días (en background)
        for (const n of eliminadas) {
          const dias = Math.floor((Date.now() - new Date(n.eliminadaEn).getTime()) / 86400000)
          if (dias >= 30) {
            fetch(`/api/notas/${n.id}`, { method: 'DELETE' })
          }
        }

        const activas = eliminadas.filter((n) => {
          const dias = Math.floor((Date.now() - new Date(n.eliminadaEn).getTime()) / 86400000)
          return dias < 30
        })
        setNotas(activas)
      } catch { /* silencioso */ }
      setCargando(false)
    }
    cargar()
  }, [])

  async function restaurar(id: string) {
    await fetch(`/api/notas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore' }),
    })
    setNotas((prev) => prev.filter((n) => n.id !== id))
  }

  async function eliminarDefinitivamente(id: string) {
    if (!confirm('¿Eliminar esta nota definitivamente? Esta acción no se puede deshacer.')) return
    await fetch(`/api/notas/${id}`, { method: 'DELETE' })
    setNotas((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Papelera</h1>
        <p className="mt-1 text-sm" style={{ color: 'rgba(148,163,184,0.55)' }}>
          Las notas se eliminan definitivamente a los 30 días
        </p>
      </div>

      {cargando && (
        <div className="py-16 text-center text-sm" style={{ color: 'rgba(148,163,184,0.4)' }}>
          Cargando…
        </div>
      )}

      {!cargando && notas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Trash2 className="h-10 w-10 mb-4" style={{ color: 'rgba(148,163,184,0.25)' }} />
          <p className="text-sm" style={{ color: 'rgba(148,163,184,0.4)' }}>No hay notas en la papelera</p>
        </div>
      )}

      {!cargando && notas.length > 0 && (
        <div className="space-y-3">
          {notas.map((n) => {
            const diasRestantes = 30 - Math.floor((Date.now() - new Date(n.eliminadaEn).getTime()) / 86400000)
            const colorDias = diasRestantes <= 3 ? '#f87171' : diasRestantes <= 7 ? '#fbbf24' : 'rgba(148,163,184,0.5)'
            const tipoCfg = TIPOS_COLOR[n.tipo as TipoNota] ?? 'text-neutral-400 bg-neutral-800/40 border-neutral-700/50'
            return (
              <div
                key={n.id}
                className="rounded-xl p-4"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{n.titulo}</p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tipoCfg}`}>
                        {TIPOS_LABEL[n.tipo] ?? n.tipo}
                      </span>
                      <span className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
                        Eliminada el {new Date(n.eliminadaEn).toLocaleDateString('es-AR')}
                      </span>
                      <span className="text-xs font-medium" style={{ color: colorDias }}>
                        Quedan {diasRestantes} día{diasRestantes !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <button
                      onClick={() => restaurar(n.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                      style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.22)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)' }}
                    >
                      Restaurar
                    </button>
                    <button
                      onClick={() => eliminarDefinitivamente(n.id)}
                      className="rounded-lg px-3 py-1.5 text-xs transition-all"
                      style={{ border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.8)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; e.currentTarget.style.background = '' }}
                    >
                      Eliminar definitivamente
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
