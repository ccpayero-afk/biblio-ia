'use client'

import { useEffect, useRef } from 'react'
import { Highlighter, MessageSquare, Pin } from 'lucide-react'

interface Props {
  rect: DOMRect
  onHighlight: () => void
  onAnotar: () => void
  onCitar: () => void
  onCerrar: () => void
}

export default function SelectionPopover({ rect, onHighlight, onAnotar, onCitar, onCerrar }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCerrar()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onCerrar])

  const top = rect.top + window.scrollY - 48
  const left = rect.left + rect.width / 2

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
        onClick={onAnotar}
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
