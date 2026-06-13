'use client'

import { useState } from 'react'
import { Documento } from '@/types'
import { X } from 'lucide-react'

const ETIQUETAS = ['teoría', 'metodología', 'empiria', 'debate', 'concepto clave']

interface Seleccion { texto: string; pagina: number }

interface Props {
  seleccion: Seleccion
  documento: Documento
  onGuardar: (datos: { notaPropia?: string; etiquetas: string[]; proyectoId?: string }) => Promise<{ duplicado?: boolean }>
  onCerrar: () => void
}

export default function CitaModal({ seleccion, documento, onGuardar, onCerrar }: Props) {
  const [notaPropia, setNotaPropia] = useState('')
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [duplicado, setDuplicado] = useState(false)

  function toggleEtiqueta(tag: string) {
    setEtiquetas((p) => p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag])
  }

  async function handleGuardar() {
    setGuardando(true)
    const resultado = await onGuardar({ notaPropia: notaPropia || undefined, etiquetas })
    setGuardando(false)
    if (resultado?.duplicado) {
      setDuplicado(true)
    }
  }

  const apellido = documento.autor ? documento.autor.split(',')[0] : 'Autor'
  const previewAPA = `${apellido} (${documento.año || 's.f.'}, p. ${seleccion.pagina})`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl"
        style={{ background: 'rgba(8,8,20,0.98)', border: '1px solid rgba(139,92,246,0.25)' }}
      >
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-sm font-medium text-white">Guardar cita</h2>
          <button
            onClick={onCerrar}
            className="transition-colors"
            style={{ color: 'rgba(148,163,184,0.5)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.5)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Texto seleccionado */}
          <div
            className="rounded-lg p-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '2px solid rgba(248,113,113,0.4)' }}
          >
            <p className="line-clamp-4 font-[family-name:var(--font-lora)] text-sm italic" style={{ color: 'rgba(226,232,240,0.85)' }}>
              &ldquo;{seleccion.texto}&rdquo;
            </p>
            <p className="mt-2 text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
              {documento.autor} · p. {seleccion.pagina}
            </p>
          </div>

          {/* Preview formato */}
          <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
              APA: <span style={{ color: 'rgba(226,232,240,0.7)' }}>{previewAPA}</span>
            </p>
          </div>

          {/* Nota propia */}
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>Nota propia (opcional)</label>
            <textarea
              value={notaPropia}
              onChange={(e) => setNotaPropia(e.target.value)}
              rows={2}
              placeholder="¿Por qué guardás esta cita? ¿Cómo la vas a usar?"
              className="w-full resize-none rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
            />
          </div>

          {/* Etiquetas */}
          <div>
            <label className="mb-2 block text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>Etiquetas</label>
            <div className="flex flex-wrap gap-2">
              {ETIQUETAS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleEtiqueta(tag)}
                  className="rounded-full px-3 py-1 text-xs transition-all"
                  style={etiquetas.includes(tag)
                    ? { background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', color: 'rgba(167,139,250,0.9)' }
                    : { background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.5)' }
                  }
                  onMouseEnter={(e) => { if (!etiquetas.includes(tag)) { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; e.currentTarget.style.color = 'rgba(167,139,250,0.7)' } }}
                  onMouseLeave={(e) => { if (!etiquetas.includes(tag)) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(148,163,184,0.5)' } }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {duplicado ? (
            <div className="flex w-full items-center justify-between">
              <p className="text-sm font-medium" style={{ color: '#fbbf24' }}>Ya tenés esta cita guardada</p>
              <button
                onClick={onCerrar}
                className="rounded-lg px-4 py-2 text-sm transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.6)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(148,163,184,0.6)' }}
              >
                Cerrar
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={onCerrar}
                className="rounded-lg px-4 py-2 text-sm transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.6)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(148,163,184,0.6)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                disabled={guardando}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 10px rgba(124,58,237,0.25)' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 18px rgba(124,58,237,0.45)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 10px rgba(124,58,237,0.25)' }}
              >
                {guardando ? 'Guardando…' : 'Guardar cita'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
