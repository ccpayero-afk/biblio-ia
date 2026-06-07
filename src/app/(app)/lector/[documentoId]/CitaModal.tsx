'use client'

import { useState } from 'react'
import { Documento } from '@/types'
import { X } from 'lucide-react'

const ETIQUETAS = ['teoría', 'metodología', 'empiria', 'debate', 'concepto clave']

interface Seleccion { texto: string; pagina: number }

interface Props {
  seleccion: Seleccion
  documento: Documento
  onGuardar: (datos: { notaPropia?: string; etiquetas: string[]; proyectoId?: string }) => void
  onCerrar: () => void
}

export default function CitaModal({ seleccion, documento, onGuardar, onCerrar }: Props) {
  const [notaPropia, setNotaPropia] = useState('')
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  function toggleEtiqueta(tag: string) {
    setEtiquetas((p) => p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag])
  }

  async function handleGuardar() {
    setGuardando(true)
    await onGuardar({ notaPropia: notaPropia || undefined, etiquetas })
    setGuardando(false)
  }

  const apellido = documento.autor ? documento.autor.split(',')[0] : 'Autor'
  const previewAPA = `${apellido} (${documento.año || 's.f.'}, p. ${seleccion.pagina})`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 p-5">
          <h2 className="text-sm font-medium text-white">Guardar cita</h2>
          <button onClick={onCerrar} className="text-neutral-500 hover:text-neutral-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Texto seleccionado */}
          <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-3">
            <p className="line-clamp-4 font-[family-name:var(--font-lora)] text-sm italic text-neutral-200">
              "{seleccion.texto}"
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              {documento.autor} · p. {seleccion.pagina}
            </p>
          </div>

          {/* Preview formato */}
          <div className="rounded-lg bg-neutral-800/50 px-3 py-2">
            <p className="text-xs text-neutral-500">APA: <span className="text-neutral-300">{previewAPA}</span></p>
          </div>

          {/* Nota propia */}
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Nota propia (opcional)</label>
            <textarea
              value={notaPropia}
              onChange={(e) => setNotaPropia(e.target.value)}
              rows={2}
              placeholder="¿Por qué guardás esta cita? ¿Cómo la vas a usar?"
              className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Etiquetas */}
          <div>
            <label className="mb-2 block text-xs text-neutral-400">Etiquetas</label>
            <div className="flex flex-wrap gap-2">
              {ETIQUETAS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleEtiqueta(tag)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    etiquetas.includes(tag)
                      ? 'bg-red-700/60 text-red-300'
                      : 'border border-neutral-700 text-neutral-400 hover:border-neutral-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-800 p-5">
          <button
            onClick={onCerrar}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar cita'}
          </button>
        </div>
      </div>
    </div>
  )
}
