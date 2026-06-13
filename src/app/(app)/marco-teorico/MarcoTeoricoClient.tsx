'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Loader2, Lightbulb } from 'lucide-react'
import type { Documento } from '@/types'

interface ConceptoFundamental {
  concepto: string
  definicion: string
  autores: string[]
  relacion: string
}

interface CorrienteTeorica {
  nombre: string
  representantes: string[]
  planteamiento: string
}

interface MarcoTeorico {
  titulo: string
  conceptosFundamentales: ConceptoFundamental[]
  corrientesTeoricas: CorrienteTeorica[]
  tensiones: string[]
  propuestaEstructura: string[]
  sugerenciaInvestigador: string
}

interface DocUsado {
  id: string
  nombre: string
  autor: string
}

interface ResultadoMarco {
  marcoTeorico: MarcoTeorico
  documentosUsados: DocUsado[]
}

export default function MarcoTeoricoClient() {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [problema, setProblema] = useState('')
  const [docIdsSeleccionados, setDocIdsSeleccionados] = useState<string[]>([])
  const [resultado, setResultado] = useState<ResultadoMarco | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/drive/pdfs')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDocumentos(data.filter((d: Documento) => d.fichaGenerada).slice(0, 10))
        }
      })
      .catch(() => {})
  }, [])

  function toggleDoc(id: string) {
    setDocIdsSeleccionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function construir() {
    if (!problema.trim()) return
    setCargando(true)
    setResultado(null)
    setError(null)
    try {
      const res = await fetch('/api/marco-teorico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problema: problema.trim(),
          documentoIds: docIdsSeleccionados.length > 0 ? docIdsSeleccionados : undefined,
        }),
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
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Constructor de Marco Teórico</h1>
          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
            Construí un marco teórico sólido a partir de tu bibliografía
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="space-y-4 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.7)' }}>
            Problema de investigación *
          </label>
          <textarea
            value={problema}
            onChange={e => setProblema(e.target.value)}
            placeholder="Describí el problema o pregunta de investigación para la que necesitás construir el marco teórico…"
            rows={3}
            className="w-full resize-none rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
          />
        </div>

        {documentos.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.7)' }}>
              Documentos específicos{' '}
              <span style={{ color: 'rgba(148,163,184,0.4)' }}>
                (opcional — si no seleccionás, usa búsqueda semántica)
              </span>
            </label>
            <div className="space-y-1.5 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              {documentos.map(d => (
                <label key={d.id} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={docIdsSeleccionados.includes(d.id)}
                    onChange={() => toggleDoc(d.id)}
                    className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 accent-violet-500"
                  />
                  <span className="text-xs leading-relaxed" style={{ color: 'rgba(203,213,225,0.8)' }}>
                    <span className="font-medium text-white">{d.autor}</span>
                    {d.año ? ` (${d.año})` : ''}
                    {' — '}
                    <span style={{ color: 'rgba(148,163,184,0.6)' }}>{d.nombre}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={construir}
          disabled={cargando || !problema.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 12px rgba(124,58,237,0.3)' }}
        >
          {cargando ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Construyendo marco teórico…</>
          ) : (
            <><BookOpen className="h-4 w-4" /> Construir marco</>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
          {error}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="space-y-5">
          <h2 className="text-base font-bold text-white">{resultado.marcoTeorico.titulo}</h2>

          {/* Conceptos fundamentales */}
          {resultado.marcoTeorico.conceptosFundamentales?.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.5)' }}>
                Conceptos fundamentales
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {resultado.marcoTeorico.conceptosFundamentales.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4 space-y-2"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <p className="font-bold text-white text-sm">{c.concepto}</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(203,213,225,0.8)' }}>{c.definicion}</p>
                    {c.autores?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.autores.map((a, j) => (
                          <span
                            key={j}
                            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }}
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                    {c.relacion && (
                      <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(148,163,184,0.5)' }}>
                        {c.relacion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Corrientes teóricas */}
          {resultado.marcoTeorico.corrientesTeoricas?.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.5)' }}>
                Corrientes teóricas
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {resultado.marcoTeorico.corrientesTeoricas.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4 space-y-2"
                    style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.15)' }}
                  >
                    <p className="font-bold text-sm" style={{ color: '#22d3ee' }}>{c.nombre}</p>
                    {c.representantes?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.representantes.map((r, j) => (
                          <span
                            key={j}
                            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: 'rgba(34,211,238,0.1)', color: '#67e8f9', border: '1px solid rgba(34,211,238,0.2)' }}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(203,213,225,0.75)' }}>{c.planteamiento}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tensiones teóricas */}
          {resultado.marcoTeorico.tensiones?.length > 0 && (
            <div
              className="rounded-xl p-4 space-y-2"
              style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(251,191,36,0.7)' }}>
                Tensiones teóricas
              </p>
              <ul className="space-y-1.5">
                {resultado.marcoTeorico.tensiones.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'rgba(253,230,138,0.85)' }}>
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-amber-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Propuesta de estructura */}
          {resultado.marcoTeorico.propuestaEstructura?.length > 0 && (
            <div
              className="rounded-xl p-4 space-y-2"
              style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.18)' }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(34,211,238,0.7)' }}>
                Propuesta de estructura
              </p>
              <ol className="space-y-1.5">
                {resultado.marcoTeorico.propuestaEstructura.map((s, i) => (
                  <li key={i} className="text-sm" style={{ color: 'rgba(165,243,252,0.85)' }}>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Sugerencia */}
          {resultado.marcoTeorico.sugerenciaInvestigador && (
            <div
              className="flex items-start gap-3 rounded-xl p-4"
              style={{ border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.06)' }}
            >
              <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: '#a78bfa' }} />
              <div>
                <p className="mb-1 text-xs font-semibold" style={{ color: 'rgba(167,139,250,0.8)' }}>
                  Sugerencia para tu investigación
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(221,214,254,0.85)' }}>
                  {resultado.marcoTeorico.sugerenciaInvestigador}
                </p>
              </div>
            </div>
          )}

          {/* Documentos consultados */}
          {resultado.documentosUsados?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.4)' }}>
                Documentos consultados
              </p>
              <div className="flex flex-wrap gap-2">
                {resultado.documentosUsados.map(d => (
                  <span
                    key={d.id}
                    className="rounded-full px-3 py-1 text-xs font-medium"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.7)' }}
                  >
                    {d.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
