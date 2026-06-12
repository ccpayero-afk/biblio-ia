'use client'

import { Highlight, Cita } from '@/types'
import { Highlighter, Pin } from 'lucide-react'

interface Props {
  highlights: Highlight[]
  citas: Cita[]
  paginaActual: number
}

const COLOR_BORDER: Record<Highlight['color'], string> = {
  amarillo: 'rgba(251,191,36,0.7)',
  azul:     'rgba(96,165,250,0.7)',
  rojo:     'rgba(248,113,113,0.7)',
  verde:    'rgba(74,222,128,0.7)',
  morado:   'rgba(192,132,252,0.7)',
}

export default function PanelLateral({ highlights, citas, paginaActual }: Props) {
  const citasEnPagina = citas.filter((c) => c.pagina === paginaActual)

  return (
    <aside
      className="flex w-72 flex-shrink-0 flex-col overflow-hidden"
      style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', background: 'rgba(5,5,12,0.9)' }}
    >
      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.4)' }}>Página {paginaActual}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Highlights de la página */}
        {highlights.length > 0 && (
          <div className="p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'rgba(148,163,184,0.4)' }}>
              <Highlighter className="h-3.5 w-3.5" /> Highlights
            </p>
            <div className="space-y-2">
              {highlights.map((h) => (
                <div
                  key={h.id}
                  className="rounded-r-lg px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.025)', borderLeft: `2px solid ${COLOR_BORDER[h.color]}` }}
                >
                  <p className="line-clamp-3 font-[family-name:var(--font-lora)] text-xs italic" style={{ color: 'rgba(226,232,240,0.75)' }}>
                    &ldquo;{h.texto}&rdquo;
                  </p>
                  {h.nota && (
                    <p className="mt-1 text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>{h.nota}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Citas de la página */}
        {citasEnPagina.length > 0 && (
          <div className="p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'rgba(148,163,184,0.4)' }}>
              <Pin className="h-3.5 w-3.5" /> Citas guardadas
            </p>
            <div className="space-y-2">
              {citasEnPagina.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg p-3"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <p className="line-clamp-3 font-[family-name:var(--font-lora)] text-xs italic" style={{ color: 'rgba(226,232,240,0.75)' }}>
                    &ldquo;{c.texto}&rdquo;
                  </p>
                  <p className="mt-1.5 text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>{c.formatoAPA}</p>
                  {c.notaPropia && (
                    <p className="mt-1 text-xs" style={{ color: 'rgba(167,139,250,0.7)' }}>{c.notaPropia}</p>
                  )}
                  {c.etiquetas.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.etiquetas.map((t) => (
                        <span
                          key={t}
                          className="rounded-full px-1.5 py-0.5 text-xs"
                          style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: 'rgba(167,139,250,0.65)' }}
                        >{t}</span>
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
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}
            >
              <Highlighter className="h-5 w-5" style={{ color: 'rgba(139,92,246,0.5)' }} />
            </div>
            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>
              Seleccioná texto en el PDF para resaltar o guardar citas
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
