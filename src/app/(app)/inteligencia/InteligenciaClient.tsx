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
        <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
        <p className="mt-3 text-sm text-neutral-500">Analizando tu biblioteca…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <AlertCircle className="h-10 w-10 text-red-700" />
        <p className="mt-4 text-sm text-red-400">{error}</p>
        <button onClick={cargar} className="mt-4 text-xs text-neutral-500 hover:text-neutral-300">Reintentar</button>
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
          <h1 className="text-xl font-semibold text-white">Panel de inteligencia</h1>
          <p className="mt-1 text-sm text-neutral-500">Análisis automático de tu biblioteca académica.</p>
        </div>
        <button
          onClick={cargar}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-600"
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
          <div key={s.label} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-center">
            <p className="text-2xl font-bold text-white">{s.val}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pregunta diaria */}
      {data.preguntaDiaria && (
        <div className="mb-6 rounded-xl border border-amber-900/50 bg-amber-900/10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Pregunta del día</span>
          </div>
          <p className="text-sm text-neutral-200 leading-relaxed">{data.preguntaDiaria}</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Autores */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-neutral-500" />
            <h2 className="text-sm font-semibold text-white">Autores más presentes</h2>
          </div>
          {data.autoresMasCitados.length === 0 ? (
            <p className="text-xs text-neutral-600">Sin datos suficientes.</p>
          ) : (
            <div className="space-y-2.5">
              {data.autoresMasCitados.map((a) => (
                <div key={a.nombre}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-neutral-300">{a.nombre}</span>
                    <span className="text-neutral-500">{a.cantidad}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-neutral-800">
                    <div
                      className="h-1.5 rounded-full bg-blue-600"
                      style={{ width: `${(a.cantidad / maxAutor) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conceptos */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-neutral-500" />
            <h2 className="text-sm font-semibold text-white">Conceptos más frecuentes</h2>
          </div>
          {data.conceptosMasFrecuentes.length === 0 ? (
            <p className="text-xs text-neutral-600">Generá fichas de lectura para ver los conceptos.</p>
          ) : (
            <div className="space-y-2.5">
              {data.conceptosMasFrecuentes.map((c) => (
                <div key={c.concepto}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-neutral-300 capitalize">{c.concepto}</span>
                    <span className="text-neutral-500">{c.frecuencia}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-neutral-800">
                    <div
                      className="h-1.5 rounded-full bg-emerald-600"
                      style={{ width: `${(c.frecuencia / maxConcepto) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Brechas */}
        {data.brechasDetectadas.length > 0 && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 md:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Brain className="h-4 w-4 text-neutral-500" />
              <h2 className="text-sm font-semibold text-white">Brechas detectadas en la biblioteca</h2>
            </div>
            <ul className="space-y-2">
              {data.brechasDetectadas.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-neutral-400">
                  <span className="mt-0.5 flex-shrink-0 text-neutral-600">·</span>
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
