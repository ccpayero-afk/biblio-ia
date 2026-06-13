'use client'

import { useEffect, useState } from 'react'
import { GitCompare, Loader2, X } from 'lucide-react'
import type { Documento } from '@/types'

interface FilaComparacion { aspecto: string; doc1: string; doc2: string }
interface Comparacion { titulo: string; filas: FilaComparacion[]; conclusion: string }
interface ResultadoComparador {
  comparacion: Comparacion
  doc1: { nombre: string; autor: string }
  doc2: { nombre: string; autor: string }
}

function docLabel(d: Documento) {
  const nombreLimpio = (d.nombre.replace(/\.pdf$/i, '').split('/').pop() ?? d.nombre).replace(/_/g, ' ')
  const apellido = d.autor ? d.autor.split(',')[0].trim() : null
  const initial = (apellido ?? nombreLimpio).charAt(0).toUpperCase()
  return { apellido, nombreLimpio, initial }
}

export default function ComparadorClient() {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [doc1Id, setDoc1Id] = useState('')
  const [doc2Id, setDoc2Id] = useState('')
  const [resultado, setResultado] = useState<ResultadoComparador | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/drive/pdfs')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setDocumentos(data.filter((d: Documento) => d.fichaGenerada)) })
      .catch(() => {})
  }, [])

  function toggleDoc(id: string) {
    if (doc1Id === id) { setDoc1Id(''); return }
    if (doc2Id === id) { setDoc2Id(''); return }
    if (!doc1Id) { setDoc1Id(id); return }
    if (!doc2Id) { setDoc2Id(id); return }
    // Both slots full — replace doc2
    setDoc2Id(id)
  }

  async function comparar() {
    if (!doc1Id || !doc2Id || doc1Id === doc2Id) return
    setCargando(true); setResultado(null); setError(null)
    try {
      const res = await fetch('/api/comparador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docIds: [doc1Id, doc2Id] }),
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

  const doc1 = documentos.find(d => d.id === doc1Id)
  const doc2 = documentos.find(d => d.id === doc2Id)

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}>
          <GitCompare className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Comparador de Documentos</h1>
          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
            Compará dos textos académicos en profundidad con IA
          </p>
        </div>
      </div>

      {/* Slots de selección */}
      <div className="grid gap-3 sm:grid-cols-2">
        {(['A', 'B'] as const).map((slot) => {
          const doc = slot === 'A' ? doc1 : doc2
          const color = slot === 'A' ? 'rgba(139,92,246,' : 'rgba(34,211,238,'
          const hex = slot === 'A' ? '#a78bfa' : '#22d3ee'
          const label = doc ? docLabel(doc) : null
          return (
            <div key={slot} className="rounded-xl px-3 py-2.5 flex items-center gap-2.5 min-h-[52px]"
              style={{ border: `1px solid ${doc ? `${color}0.35)` : 'rgba(255,255,255,0.07)'}`, background: doc ? `${color}0.06)` : 'rgba(255,255,255,0.02)' }}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: doc ? `${color}0.2)` : 'rgba(255,255,255,0.06)', color: doc ? hex : 'rgba(148,163,184,0.4)' }}>
                {slot}
              </span>
              {doc && label ? (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: hex }}>{label.apellido ?? label.nombreLimpio}</p>
                    {label.apellido && <p className="text-[11px] truncate" style={{ color: 'rgba(148,163,184,0.6)' }}>{label.nombreLimpio}</p>}
                  </div>
                  <button onClick={() => slot === 'A' ? setDoc1Id('') : setDoc2Id('')}
                    className="shrink-0 rounded p-0.5 transition-colors"
                    style={{ color: 'rgba(148,163,184,0.4)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <p className="text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>
                  Hacé clic en un documento para asignarlo
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Lista de documentos */}
      {documentos.length === 0 ? (
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
            No hay documentos con fichas generadas. Generá fichas desde la sección Fichas.
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-3 py-2 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.5)' }}>
              Documentos con ficha — seleccioná dos
            </p>
            {(doc1Id || doc2Id) && (
              <button onClick={() => { setDoc1Id(''); setDoc2Id('') }}
                className="text-[11px] rounded px-1.5 py-0.5 transition-colors"
                style={{ color: 'rgba(248,113,113,0.7)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)' }}>
                Limpiar
              </button>
            )}
          </div>
          <div className="divide-y" style={{ '--tw-divide-opacity': '1', borderColor: 'rgba(255,255,255,0.04)' } as React.CSSProperties}>
            {documentos.map(d => {
              const isA = d.id === doc1Id
              const isB = d.id === doc2Id
              const { apellido, nombreLimpio, initial } = docLabel(d)
              const borderColor = isA ? 'rgba(139,92,246,0.4)' : isB ? 'rgba(34,211,238,0.4)' : 'transparent'
              const bgColor = isA ? 'rgba(139,92,246,0.08)' : isB ? 'rgba(34,211,238,0.08)' : 'transparent'
              const badgeColor = isA ? '#a78bfa' : '#22d3ee'
              return (
                <button key={d.id} onClick={() => toggleDoc(d.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
                  style={{ background: bgColor, borderLeft: `3px solid ${borderColor}` }}
                  onMouseEnter={e => { if (!isA && !isB) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { if (!isA && !isB) e.currentTarget.style.background = 'transparent' }}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ background: isA || isB ? `${isA ? 'rgba(139,92,246,' : 'rgba(34,211,238,'}0.2)` : 'rgba(255,255,255,0.07)', color: isA || isB ? badgeColor : 'rgba(148,163,184,0.5)' }}>
                    {isA ? 'A' : isB ? 'B' : initial}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: isA || isB ? badgeColor : 'rgba(226,232,240,0.85)' }}>
                      {apellido ?? nombreLimpio}
                    </p>
                    {apellido && <p className="text-[11px] truncate" style={{ color: 'rgba(148,163,184,0.55)' }}>{nombreLimpio}</p>}
                  </div>
                  {(isA || isB) && (
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ background: `${isA ? 'rgba(139,92,246,' : 'rgba(34,211,238,'}0.15)`, color: badgeColor, border: `1px solid ${badgeColor}44` }}>
                      Texto {isA ? 'A' : 'B'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Botón comparar */}
      {doc1Id && doc2Id && (
        <button onClick={comparar} disabled={cargando}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 12px rgba(124,58,237,0.3)' }}>
          {cargando ? <><Loader2 className="h-4 w-4 animate-spin" /> Comparando con IA…</> : <><GitCompare className="h-4 w-4" /> Comparar</>}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
          {error}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="space-y-5">
          <h2 className="text-base font-bold text-white">{resultado.comparacion.titulo}</h2>
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.6)', width: '22%' }}>Aspecto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest" style={{ color: '#a78bfa', width: '39%' }}>{resultado.doc1.autor}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest" style={{ color: '#22d3ee', width: '39%' }}>{resultado.doc2.autor}</th>
                </tr>
              </thead>
              <tbody>
                {resultado.comparacion.filas.map((fila, i) => (
                  <tr key={i} style={{ borderBottom: i < resultado.comparacion.filas.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: 'rgba(148,163,184,0.5)', verticalAlign: 'top' }}>{fila.aspecto}</td>
                    <td className="px-4 py-3 text-xs leading-relaxed" style={{ background: 'rgba(139,92,246,0.04)', color: 'rgba(221,214,254,0.85)', verticalAlign: 'top' }}>{fila.doc1}</td>
                    <td className="px-4 py-3 text-xs leading-relaxed" style={{ background: 'rgba(34,211,238,0.04)', color: 'rgba(165,243,252,0.85)', verticalAlign: 'top' }}>{fila.doc2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl p-4" style={{ border: '1px solid rgba(167,139,250,0.25)', background: 'rgba(167,139,250,0.05)' }}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(167,139,250,0.7)' }}>Síntesis comparativa</p>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(221,214,254,0.9)' }}>{resultado.comparacion.conclusion}</p>
          </div>
        </div>
      )}
    </div>
  )
}
