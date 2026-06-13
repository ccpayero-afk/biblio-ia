'use client'

import { useEffect, useState } from 'react'
import { Map, Loader2, CheckCircle, HelpCircle, Lightbulb } from 'lucide-react'
import { CarpetaSelector } from '@/components/CarpetaSelector'
import type { Carpeta } from '@/types'

interface Posicion {
  autor: string
  documentoNombre: string
  tesis: string
  argumentosClave: string[]
}

interface Tension {
  entre: string[]
  sobre: string
  tipo: 'teórica' | 'metodológica' | 'empírica'
}

interface MapaDebatesResultado {
  resumenDebate: string
  posiciones: Posicion[]
  tensiones: Tension[]
  acuerdos: string[]
  preguntasAbiertas: string[]
  sugerenciaInvestigador: string
}

const TENSION_COLORS: Record<string, string> = {
  'teórica': '#a78bfa',
  'metodológica': '#22d3ee',
  'empírica': '#fbbf24',
}

export default function MapaDebatesClient() {
  const [tema, setTema] = useState('')
  const [carpetas, setCarpetas] = useState<Carpeta[]>([])
  const [carpetasFiltro, setCarpetasFiltro] = useState<string[]>([])
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<MapaDebatesResultado | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/carpetas')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCarpetas(data) })
      .catch(() => {})
  }, [])

  async function analizar() {
    if (!tema.trim()) return
    setCargando(true)
    setResultado(null)
    setError(null)
    try {
      const res = await fetch('/api/mapa-debates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema: tema.trim(), carpetasIds: carpetasFiltro }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResultado(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}
        >
          <Map className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Mapa de Debates</h1>
          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
            Analizá posiciones, tensiones y acuerdos en tu bibliografía
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="space-y-3 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <input
          type="text"
          value={tema}
          onChange={e => setTema(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !cargando) analizar() }}
          placeholder="Ingresá un tema para mapear el debate…"
          className="w-full rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
        />

        {carpetas.length > 0 && (
          <CarpetaSelector
            carpetas={carpetas}
            filtro={carpetasFiltro}
            onChange={setCarpetasFiltro}
          />
        )}

        <button
          onClick={analizar}
          disabled={cargando || !tema.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 12px rgba(124,58,237,0.3)' }}
        >
          {cargando ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Analizando posiciones en la bibliografía…</>
          ) : (
            <><Map className="h-4 w-4" /> Analizar debates</>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="space-y-5">
          {/* Resumen del debate */}
          <div className="rounded-xl p-4" style={{ border: '1px solid rgba(167,139,250,0.25)', background: 'rgba(167,139,250,0.05)' }}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(167,139,250,0.7)' }}>
              Resumen del debate
            </p>
            <p className="text-sm leading-relaxed text-white">{resultado.resumenDebate}</p>
          </div>

          {/* Posiciones */}
          {resultado.posiciones?.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.5)' }}>
                Posiciones ({resultado.posiciones.length})
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {resultado.posiciones.map((pos, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <p className="mb-1 font-bold text-white text-sm">{pos.autor}</p>
                    <p className="mb-2 text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>{pos.documentoNombre}</p>
                    <p className="mb-2 text-xs italic" style={{ color: 'rgba(203,213,225,0.7)' }}>{pos.tesis}</p>
                    {pos.argumentosClave?.length > 0 && (
                      <ul className="space-y-0.5">
                        {pos.argumentosClave.map((arg, j) => (
                          <li key={j} className="text-xs" style={{ color: 'rgba(148,163,184,0.6)' }}>
                            · {arg}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tensiones */}
          {resultado.tensiones?.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.5)' }}>
                Tensiones ({resultado.tensiones.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {resultado.tensiones.map((t, i) => {
                  const color = TENSION_COLORS[t.tipo] ?? '#a78bfa'
                  return (
                    <div
                      key={i}
                      className="rounded-lg px-3 py-2 text-xs"
                      style={{ background: `${color}15`, border: `1px solid ${color}40`, color }}
                    >
                      <span className="font-semibold">{t.entre.join(' ↔ ')}</span>
                      <span style={{ color: `${color}cc` }}> · sobre: {t.sobre}</span>
                      <span
                        className="ml-2 rounded-full px-1.5 py-0.5 text-[10px]"
                        style={{ background: `${color}22`, color }}
                      >
                        {t.tipo}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Acuerdos */}
          {resultado.acuerdos?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.5)' }}>
                Acuerdos
              </p>
              <ul className="space-y-1.5">
                {resultado.acuerdos.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(203,213,225,0.8)' }}>
                    <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Preguntas abiertas */}
          {resultado.preguntasAbiertas?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.5)' }}>
                Preguntas abiertas
              </p>
              <ul className="space-y-1.5">
                {resultado.preguntasAbiertas.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(203,213,225,0.8)' }}>
                    <HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: '#a78bfa' }} />
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sugerencia para el investigador */}
          {resultado.sugerenciaInvestigador && (
            <div
              className="flex items-start gap-3 rounded-xl p-4"
              style={{ border: '1px solid rgba(34,211,170,0.3)', background: 'rgba(34,211,170,0.05)' }}
            >
              <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: '#22d3aa' }} />
              <div>
                <p className="mb-1 text-xs font-semibold" style={{ color: 'rgba(34,211,170,0.8)' }}>
                  Sugerencia para tu investigación
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(203,213,225,0.85)' }}>
                  {resultado.sugerenciaInvestigador}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
