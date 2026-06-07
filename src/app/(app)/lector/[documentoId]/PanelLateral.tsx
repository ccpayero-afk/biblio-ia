'use client'

import { Highlight, Cita } from '@/types'
import { Highlighter, Pin } from 'lucide-react'

interface Props {
  highlights: Highlight[]
  citas: Cita[]
  paginaActual: number
}

const COLOR_CLASS: Record<Highlight['color'], string> = {
  amarillo: 'border-l-amber-400',
  azul: 'border-l-blue-400',
  rojo: 'border-l-red-400',
}

export default function PanelLateral({ highlights, citas, paginaActual }: Props) {
  const citasEnPagina = citas.filter((c) => c.pagina === paginaActual)

  return (
    <aside className="flex w-72 flex-shrink-0 flex-col border-l border-neutral-800 bg-neutral-950 overflow-hidden">
      <div className="border-b border-neutral-800 px-4 py-3">
        <p className="text-xs font-medium text-neutral-400">Página {paginaActual}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Highlights de la página */}
        {highlights.length > 0 && (
          <div className="p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
              <Highlighter className="h-3.5 w-3.5" /> Highlights
            </p>
            <div className="space-y-2">
              {highlights.map((h) => (
                <div key={h.id} className={`rounded-r-lg border-l-2 bg-neutral-900 px-3 py-2 ${COLOR_CLASS[h.color]}`}>
                  <p className="line-clamp-3 font-[family-name:var(--font-lora)] text-xs italic text-neutral-300">
                    "{h.texto}"
                  </p>
                  {h.nota && (
                    <p className="mt-1 text-xs text-neutral-500">{h.nota}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Citas de la página */}
        {citasEnPagina.length > 0 && (
          <div className="p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
              <Pin className="h-3.5 w-3.5" /> Citas guardadas
            </p>
            <div className="space-y-2">
              {citasEnPagina.map((c) => (
                <div key={c.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                  <p className="line-clamp-3 font-[family-name:var(--font-lora)] text-xs italic text-neutral-300">
                    "{c.texto}"
                  </p>
                  <p className="mt-1.5 text-xs text-neutral-500">{c.formatoAPA}</p>
                  {c.notaPropia && (
                    <p className="mt-1 text-xs text-blue-400">{c.notaPropia}</p>
                  )}
                  {c.etiquetas.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.etiquetas.map((t) => (
                        <span key={t} className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-500">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {highlights.length === 0 && citasEnPagina.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Highlighter className="h-8 w-8 text-neutral-700" />
            <p className="mt-3 text-xs text-neutral-600">
              Seleccioná texto en el PDF para resaltar o guardar citas
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
