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
        className="fixed z-50 w-72 rounded-lg border border-neutral-700 bg-neutral-900 p-3 shadow-xl"
        style={{ top, left, transform: 'translateX(-50%)' }}
      >
        <p className="mb-2 text-xs font-medium text-blue-400">Anotación</p>
        <textarea
          ref={textareaRef}
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Escribe tu nota…"
          rows={3}
          className="w-full resize-none rounded border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm text-white placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { if (nota.trim()) onAnotar(nota.trim()); e.preventDefault() }
            if (e.key === 'Escape') onCerrar()
          }}
        />
        <div className="mt-2 flex justify-end gap-2">
          <button onClick={onCerrar} className="rounded px-2 py-1 text-xs text-neutral-500 hover:text-white">
            Cancelar
          </button>
          <button
            onClick={() => { if (nota.trim()) onAnotar(nota.trim()) }}
            disabled={!nota.trim()}
            className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-40"
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
      className="fixed z-50 flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-900 px-2.5 py-2 shadow-xl"
      style={{ top, left, transform: 'translateX(-50%)' }}
    >
      {/* Color swatches */}
      {COLORES.map(({ key, label, circle }) => (
        <button
          key={key}
          onClick={() => onHighlight(key)}
          title={`Resaltar en ${label}`}
          className={`h-5 w-5 rounded-full ${circle} ring-offset-1 ring-offset-neutral-900 hover:ring-2 hover:ring-white transition-all`}
        />
      ))}

      <div className="mx-1 h-4 w-px bg-neutral-700" />

      <button
        onClick={() => setMode('anotar')}
        title="Crear nota"
        className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-blue-400 hover:bg-neutral-800"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Anotar</span>
      </button>

      <button
        onClick={onCitar}
        title="Guardar como cita"
        className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-red-400 hover:bg-neutral-800"
      >
        <Pin className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Citar</span>
      </button>
    </div>
  )
}
