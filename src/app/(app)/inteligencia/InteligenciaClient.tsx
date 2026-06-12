'use client'

import { useEffect, useState } from 'react'
import { Brain, Loader2, RefreshCw, Lightbulb, TrendingUp, Users, AlertCircle } from 'lucide-react'

interface IntelData {
  stats: {
    totalDocumentos: number
    documentosIndexados: number
    fichasGeneradas: number
    totalFragmentos: number
    totalCitas: number
  }
  autoresMasCitados: { nombre: string; cantidad: number }[]
  conceptosMasFrecuentes: { concepto: string; frecuencia: number }[]
  preguntaDiaria: string
  brechasDetectadas: string[]
}

export default function InteligenciaClient() {
  const [data, setData] = useState<IntelData | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const res = await fetch('/api/inteligencia')
      const d = await res.json()
      if (d.error) setError(d.error)
      else setData(d)
    } catch (e) {
      setError(String(e))
    }
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'rgba(139,92,246,0.6)' }} />
        <p className="mt-3 text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>Analizando tu biblioteca…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <AlertCircle className="h-10 w-10" style={{ color: 'rgba(239,68,68,0.6)' }} />
        <p className="mt-4 text-sm text-red-400">{error}</p>
        <button
          onClick={cargar}
          className="mt-4 text-xs transition-colors"
          style={{ color: 'rgba(148,163,184,0.4)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}
        >Reintentar</button>
      </div>
    )
  }

  if (!data) return null

  const maxAutor = data.autoresMasCitados[0]?.cantidad ?? 1
  const maxConcepto = data.conceptosMasFrecuentes[0]?.frecuencia ?? 1

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Panel de inteligencia</h1>
          <p className="mt-1 text-sm" style={{ color: 'rgba(148,163,184,0.55)' }}>Análisis automático de tu biblioteca académica.</p>
        </div>
        <button
          onClick={cargar}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-all"
          style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.6)' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(148,163,184,0.6)' }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar
        </button>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Documentos', val: data.stats.totalDocumentos },
          { label: 'Indexados', val: data.stats.documentosIndexados },
          { label: 'Fichas', val: data.stats.fichasGeneradas },
          { label: 'Fragmentos', val: data.stats.totalFragmentos },
          { label: 'Citas', val: data.stats.totalCitas },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-4 text-center"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p
              className="text-2xl font-bold"
              style={{ background: 'linear-gradient(135deg, #f1f5f9, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >{s.val}</p>
            <p className="mt-0.5 text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pregunta diaria */}
      {data.preguntaDiaria && (
        <div
          className="mb-6 rounded-xl p-5"
          style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4" style={{ color: 'rgba(245,158,11,0.8)' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(245,158,11,0.8)' }}>Pregunta del día</span>
          </div>
          <p className="text-sm text-neutral-200 leading-relaxed">{data.preguntaDiaria}</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Autores */}
        <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: 'rgba(139,92,246,0.5)' }} />
            <h2 className="text-sm font-semibold text-white">Autores más presentes</h2>
          </div>
          {data.autoresMasCitados.length === 0 ? (
            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>Sin datos suficientes.</p>
          ) : (
            <div className="space-y-2.5">
              {data.autoresMasCitados.map((a) => (
                <div key={a.nombre}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span style={{ color: 'rgba(203,213,225,0.8)' }}>{a.nombre}</span>
                    <span style={{ color: 'rgba(148,163,184,0.5)' }}>{a.cantidad}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${(a.cantidad / maxAutor) * 100}%`, background: 'linear-gradient(90deg, #7c3aed, #6d28d9)' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conceptos */}
        <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: 'rgba(52,211,153,0.5)' }} />
            <h2 className="text-sm font-semibold text-white">Conceptos más frecuentes</h2>
          </div>
          {data.conceptosMasFrecuentes.length === 0 ? (
            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>Generá fichas de lectura para ver los conceptos.</p>
          ) : (
            <div className="space-y-2.5">
              {data.conceptosMasFrecuentes.map((c) => (
                <div key={c.concepto}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="capitalize" style={{ color: 'rgba(203,213,225,0.8)' }}>{c.concepto}</span>
                    <span style={{ color: 'rgba(148,163,184,0.5)' }}>{c.frecuencia}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${(c.frecuencia / maxConcepto) * 100}%`, background: 'linear-gradient(90deg, #059669, #34d399)' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Brechas */}
        {data.brechasDetectadas.length > 0 && (
          <div
            className="rounded-xl p-5 md:col-span-2"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="mb-4 flex items-center gap-2">
              <Brain className="h-4 w-4" style={{ color: 'rgba(139,92,246,0.6)' }} />
              <h2 className="text-sm font-semibold text-white">Brechas detectadas en la biblioteca</h2>
            </div>
            <ul className="space-y-2">
              {data.brechasDetectadas.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
                  <span className="mt-0.5 flex-shrink-0" style={{ color: 'rgba(139,92,246,0.4)' }}>·</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
