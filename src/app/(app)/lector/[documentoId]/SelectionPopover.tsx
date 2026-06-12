'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Pin, Check } from 'lucide-react'
import type { Highlight } from '@/types'

const COLORES: Array<{ key: Highlight['color']; label: string; circle: string }> = [
  { key: 'amarillo', label: 'Amarillo', circle: 'bg-yellow-300' },
  { key: 'verde',    label: 'Verde',    circle: 'bg-green-400' },
  { key: 'azul',     label: 'Azul',     circle: 'bg-blue-400' },
  { key: 'rojo',     label: 'Rojo',     circle: 'bg-red-400' },
  { key: 'morado',   label: 'Morado',   circle: 'bg-purple-400' },
]

interface Props {
  rect: DOMRect
  onHighlight: (color: Highlight['color']) => void
  onAnotar: (nota: string) => void
  onCitar: () => void
  onCerrar: () => void
}

export default function SelectionPopover({ rect, onHighlight, onAnotar, onCitar, onCerrar }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mode, setMode] = useState<'default' | 'anotar'>('default')
  const [nota, setNota] = useState('')

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCerrar()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onCerrar])

  useEffect(() => {
    if (mode === 'anotar') textareaRef.current?.focus()
  }, [mode])

  const top = Math.max(8, rect.top - (mode === 'anotar' ? 160 : 60))
  const left = Math.max(150, Math.min(
    (typeof window !== 'undefined' ? window.innerWidth : 800) - 150,
    rect.left + rect.width / 2
  ))

  if (mode === 'anotar') {
    return (
      <div
        ref={ref}
        className="fixed z-50 w-72 rounded-xl p-3 shadow-2xl"
        style={{ top, left, transform: 'translateX(-50%)', background: 'rgba(10,10,22,0.97)', border: '1px solid rgba(139,92,246,0.2)', backdropFilter: 'blur(12px)' }}
      >
        <p className="mb-2 text-xs font-medium" style={{ color: 'rgba(167,139,250,0.8)' }}>Anotación</p>
        <textarea
          ref={textareaRef}
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Escribe tu nota…"
          rows={3}
          className="w-full resize-none rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { if (nota.trim()) onAnotar(nota.trim()); e.preventDefault() }
            if (e.key === 'Escape') onCerrar()
          }}
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={onCerrar}
            className="rounded px-2 py-1 text-xs transition-colors"
            style={{ color: 'rgba(148,163,184,0.5)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.5)' }}
          >
            Cancelar
          </button>
          <button
            onClick={() => { if (nota.trim()) onAnotar(nota.trim()) }}
            disabled={!nota.trim()}
            className="flex items-center gap-1 rounded-lg px-3 py-1 text-xs text-white transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 8px rgba(124,58,237,0.3)' }}
          >
            <Check className="h-3 w-3" /> Guardar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 flex items-center gap-1.5 rounded-xl px-2.5 py-2 shadow-2xl"
      style={{ top, left, transform: 'translateX(-50%)', background: 'rgba(10,10,22,0.97)', border: '1px solid rgba(139,92,246,0.2)', backdropFilter: 'blur(12px)' }}
    >
      {/* Color swatches */}
      {COLORES.map(({ key, label, circle }) => (
        <button
          key={key}
          onClick={() => onHighlight(key)}
          title={`Resaltar en ${label}`}
          className={`h-5 w-5 rounded-full ${circle} ring-offset-1 ring-offset-black hover:ring-2 hover:ring-white transition-all`}
        />
      ))}

      <div className="mx-1 h-4 w-px" style={{ background: 'rgba(255,255,255,0.1)' }} />

      <button
        onClick={() => setMode('anotar')}
        title="Crear nota"
        className="flex items-center gap-1 rounded px-1.5 py-1 text-xs transition-colors"
        style={{ color: 'rgba(167,139,250,0.7)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(167,139,250,0.7)' }}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Anotar</span>
      </button>

      <button
        onClick={onCitar}
        title="Guardar como cita"
        className="flex items-center gap-1 rounded px-1.5 py-1 text-xs transition-colors"
        style={{ color: 'rgba(248,113,113,0.7)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(248,113,113,0.7)' }}
      >
        <Pin className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Citar</span>
      </button>
    </div>
  )
}
