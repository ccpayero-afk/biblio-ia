'use client'

import { useState } from 'react'
import { Documento } from '@/types'
import { X } from 'lucide-react'

interface Props {
  documento: Documento
  onGuardar: (datos: Partial<Documento>) => void
  onCerrar: () => void
}

const ETIQUETAS_SUGERIDAS = ['teoría', 'metodología', 'empiria', 'debate', 'concepto clave', 'latinoamérica', 'historia', 'política', 'economía', 'sociología']

export default function MetadatosModal({ documento, onGuardar, onCerrar }: Props) {
  const [autor, setAutor] = useState(documento.autor)
  const [año, setAño] = useState(documento.año)
  const [editorial, setEditorial] = useState(documento.editorial ?? '')
  const [abstract, setAbstract] = useState(documento.abstract ?? '')
  const [etiquetas, setEtiquetas] = useState<string[]>(documento.etiquetas)
  const [guardando, setGuardando] = useState(false)

  function toggleEtiqueta(tag: string) {
    setEtiquetas((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
  }

  async function handleGuardar() {
    setGuardando(true)
    await onGuardar({ autor, año, editorial, abstract, etiquetas })
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 p-5">
          <h2 className="text-sm font-medium text-white">Editar metadatos</h2>
          <button onClick={onCerrar} className="rounded p-1 text-neutral-500 hover:text-neutral-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nombre del archivo (read-only) */}
        <div className="border-b border-neutral-800 px-5 py-3">
          <p className="truncate text-xs text-neutral-500">{documento.nombre}</p>
        </div>

        {/* Campos */}
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Autor / Autores</label>
              <input
                type="text"
                value={autor}
                onChange={(e) => setAutor(e.target.value)}
                placeholder="Apellido, N."
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Año</label>
              <input
                type="text"
                value={año}
                onChange={(e) => setAño(e.target.value)}
                placeholder="2023"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-400">Editorial / Revista</label>
            <input
              type="text"
              value={editorial}
              onChange={(e) => setEditorial(e.target.value)}
              placeholder="CLACSO, Nueva Sociedad, etc."
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-400">Abstract / Resumen</label>
            <textarea
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              rows={3}
              placeholder="Descripción breve del contenido..."
              className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-400">Etiquetas temáticas</label>
            <div className="flex flex-wrap gap-2">
              {ETIQUETAS_SUGERIDAS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleEtiqueta(tag)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    etiquetas.includes(tag)
                      ? 'bg-blue-600 text-white'
                      : 'border border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
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
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
