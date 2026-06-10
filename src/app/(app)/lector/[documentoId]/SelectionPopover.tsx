'use client'

import { useEffect, useRef, useState } from 'react'
import { Highlighter, MessageSquare, Pin, Check } from 'lucide-react'

interface Props {
  rect: DOMRect
  onHighlight: () => void
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

  const top = Math.max(8, rect.top - (mode === 'anotar' ? 160 : 52))
  const left = Math.max(130, Math.min(
    (typeof window !== 'undefined' ? window.innerWidth : 800) - 130,
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
      className="fixed z-50 flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 shadow-xl"
      style={{ top, left, transform: 'translateX(-50%)' }}
    >
      <button
        onClick={onHighlight}
        title="Resaltar"
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-amber-400 hover:bg-neutral-800"
      >
        <Highlighter className="h-3.5 w-3.5" /> Resaltar
      </button>
      <div className="h-4 w-px bg-neutral-700" />
      <button
        onClick={() => setMode('anotar')}
        title="Anotar"
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-blue-400 hover:bg-neutral-800"
      >
        <MessageSquare className="h-3.5 w-3.5" /> Anotar
      </button>
      <div className="h-4 w-px bg-neutral-700" />
      <button
        onClick={onCitar}
        title="Guardar como cita"
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-red-400 hover:bg-neutral-800"
      >
        <Pin className="h-3.5 w-3.5" /> Citar
      </button>
    </div>
  )
}
