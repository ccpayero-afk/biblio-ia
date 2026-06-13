'use client'

import { useState } from 'react'
import { Search, Download, Loader2, Briefcase, FileText, BookOpen, StickyNote } from 'lucide-react'

interface PreviewStats {
  docsCount: number
  citasCount: number
  notasCount: number
}

export default function MaletinClient() {
  const [tema, setTema] = useState('')
  const [preview, setPreview] = useState<PreviewStats | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function buscarMaterial() {
    if (!tema.trim()) return
    setBuscando(true)
    setError(null)
    setPreview(null)
    try {
      const res = await fetch('/api/maletin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema, format: 'preview' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al buscar material')
      }
      const stats: PreviewStats = await res.json()
      setPreview(stats)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setBuscando(false)
    }
  }

  async function descargarMaletin() {
    if (!tema.trim()) return
    setDescargando(true)
    setError(null)
    try {
      const res = await fetch('/api/maletin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al generar maletín')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'maletin.docx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Briefcase className="h-5 w-5" style={{ color: 'rgba(139,92,246,0.7)' }} />
          <h1 className="text-xl font-bold text-white">Maletín de investigación</h1>
        </div>
        <p className="text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>
          Reúne citas, fichas y notas relevantes para un tema en un solo documento Word.
        </p>
      </div>

      {/* Input */}
      <div
        className="rounded-xl p-5 space-y-4"
        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(167,139,250,0.8)' }}>
            Tema de investigación
          </label>
          <input
            value={tema}
            onChange={(e) => {
              setTema(e.target.value)
              setPreview(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && buscarMaterial()}
            placeholder="ej. identidad y territorio en comunidades rurales"
            className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={buscarMaterial}
            disabled={!tema.trim() || buscando}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: 'rgba(167,139,250,0.9)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)' }}
          >
            {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {buscando ? 'Buscando…' : 'Buscar material'}
          </button>

          {preview && (
            <button
              onClick={descargarMaletin}
              disabled={descargando}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 12px rgba(124,58,237,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(124,58,237,0.5)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 12px rgba(124,58,237,0.3)' }}
            >
              {descargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {descargando ? 'Generando…' : 'Descargar maletín .docx'}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(252,165,165,0.8)' }}
        >
          {error}
        </div>
      )}

      {/* Preview stats */}
      {preview && (
        <div
          className="mt-4 rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(148,163,184,0.5)' }}>
            Material encontrado para "{tema}"
          </p>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: 'rgba(139,92,246,0.7)' }} />
              <span className="text-sm font-semibold text-white">{preview.docsCount}</span>
              <span className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>documentos</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" style={{ color: 'rgba(34,211,238,0.7)' }} />
              <span className="text-sm font-semibold text-white">{preview.citasCount}</span>
              <span className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>citas</span>
            </div>
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" style={{ color: 'rgba(167,139,250,0.7)' }} />
              <span className="text-sm font-semibold text-white">{preview.notasCount}</span>
              <span className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>notas</span>
            </div>
          </div>
          {preview.docsCount === 0 && (
            <p className="mt-3 text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
              No se encontraron documentos indexados para este tema. Intentá con otras palabras clave.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
