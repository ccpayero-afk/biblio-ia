'use client'

import { useEffect, useState } from 'react'
import { GitCompare, Loader2 } from 'lucide-react'
import type { Documento } from '@/types'

interface FilaComparacion {
  aspecto: string
  doc1: string
  doc2: string
}

interface Comparacion {
  titulo: string
  filas: FilaComparacion[]
  conclusion: string
}

interface ResultadoComparador {
  comparacion: Comparacion
  doc1: { nombre: string; autor: string }
  doc2: { nombre: string; autor: string }
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
      .then(data => {
        if (Array.isArray(data)) {
          setDocumentos(data.filter((d: Documento) => d.fichaGenerada))
        }
      })
      .catch(() => {})
  }, [])

  async function comparar() {
    if (!doc1Id || !doc2Id || doc1Id === doc2Id) return
    setCargando(true)
    setResultado(null)
    setError(null)
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

  const docsParaDoc2 = documentos.filter(d => d.id !== doc1Id)
  const docsParaDoc1 = documentos.filter(d => d.id !== doc2Id)

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}
        >
          <GitCompare className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Comparador de Documentos</h1>
          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
            Compará dos textos académicos en profundidad con IA
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="space-y-4 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {documentos.length === 0 ? (
          <p className="text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
            No hay documentos con fichas generadas. Generá fichas desde la sección Fichas.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.7)' }}>
                  Documento 1
                </label>
                <select
                  value={doc1Id}
                  onChange={e => setDoc1Id(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <option value="">Seleccioná un documento…</option>
                  {docsParaDoc1.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.autor} — {d.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.7)' }}>
                  Documento 2
                </label>
                <select
                  value={doc2Id}
                  onChange={e => setDoc2Id(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <option value="">Seleccioná un documento…</option>
                  {docsParaDoc2.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.autor} — {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={comparar}
              disabled={cargando || !doc1Id || !doc2Id || doc1Id === doc2Id}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 12px rgba(124,58,237,0.3)' }}
            >
              {cargando ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Comparando documentos con IA…</>
              ) : (
                <><GitCompare className="h-4 w-4" /> Comparar</>
              )}
            </button>
          </>
        )}
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
          <h2 className="text-base font-bold text-white">{resultado.comparacion.titulo}</h2>

          {/* Tabla comparativa */}
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.6)', width: '22%' }}>
                    Aspecto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest" style={{ color: '#a78bfa', width: '39%' }}>
                    {resultado.doc1.autor}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest" style={{ color: '#22d3ee', width: '39%' }}>
                    {resultado.doc2.autor}
                  </th>
                </tr>
              </thead>
              <tbody>
                {resultado.comparacion.filas.map((fila, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: i < resultado.comparacion.filas.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                  >
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: 'rgba(148,163,184,0.5)', verticalAlign: 'top' }}>
                      {fila.aspecto}
                    </td>
                    <td
                      className="px-4 py-3 text-xs leading-relaxed"
                      style={{ background: 'rgba(139,92,246,0.04)', color: 'rgba(221,214,254,0.85)', verticalAlign: 'top' }}
                    >
                      {fila.doc1}
                    </td>
                    <td
                      className="px-4 py-3 text-xs leading-relaxed"
                      style={{ background: 'rgba(34,211,238,0.04)', color: 'rgba(165,243,252,0.85)', verticalAlign: 'top' }}
                    >
                      {fila.doc2}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Conclusión */}
          <div
            className="rounded-xl p-4"
            style={{ border: '1px solid rgba(167,139,250,0.25)', background: 'rgba(167,139,250,0.05)' }}
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(167,139,250,0.7)' }}>
              Síntesis comparativa
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(221,214,254,0.9)' }}>
              {resultado.comparacion.conclusion}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
