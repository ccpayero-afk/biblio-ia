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
const TIPOS = [
  { value: 'articulo',  label: 'Artículo' },
  { value: 'libro',     label: 'Libro' },
  { value: 'capitulo',  label: 'Capítulo' },
  { value: 'tesis',     label: 'Tesis' },
  { value: 'otro',      label: 'Otro' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-neutral-400">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-blue-500 focus:outline-none'

export default function MetadatosModal({ documento, onGuardar, onCerrar }: Props) {
  const nombreOriginal = (documento.nombre.split('/').pop() ?? documento.nombre).replace(/\.pdf$/i, '')
  const [nombre, setNombre]     = useState(nombreOriginal)
  const [titulo, setTitulo]     = useState(documento.titulo ?? '')
  const [autor, setAutor]       = useState(documento.autor)
  const [año, setAño]           = useState(documento.año)
  const [tipo, setTipo]         = useState<Documento['tipo']>(documento.tipo)
  const [revista, setRevista]   = useState(documento.revista ?? '')
  const [editorial, setEditorial] = useState(documento.editorial ?? '')
  const [volumen, setVolumen]   = useState(documento.volumen ?? '')
  const [numero, setNumero]     = useState(documento.numero ?? '')
  const [paginas, setPaginas]   = useState(documento.paginas ?? '')
  const [url, setUrl]           = useState(documento.url ?? '')
  const [doi, setDoi]           = useState(documento.doi ?? '')
  const [isbn, setIsbn]         = useState(documento.isbn ?? '')
  const [abstract, setAbstract] = useState(documento.abstract ?? '')
  const [etiquetas, setEtiquetas] = useState<string[]>(documento.etiquetas)
  const [guardando, setGuardando] = useState(false)

  function toggleEtiqueta(tag: string) {
    setEtiquetas((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
  }

  async function handleGuardar() {
    setGuardando(true)
    const datos: Partial<Documento> = {
      titulo:    titulo.trim() || undefined,
      autor,
      año,
      tipo,
      revista:   revista.trim() || undefined,
      editorial: editorial.trim() || undefined,
      volumen:   volumen.trim() || undefined,
      numero:    numero.trim() || undefined,
      paginas:   paginas.trim() || undefined,
      url:       url.trim() || undefined,
      doi:       doi.trim() || undefined,
      isbn:      isbn.trim() || undefined,
      abstract:  abstract.trim() || undefined,
      etiquetas,
    }
    if (nombre.trim() && nombre.trim() !== nombreOriginal) {
      datos.nombre = nombre.trim()
    }
    await onGuardar(datos)
    setGuardando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 p-5 flex-shrink-0">
          <h2 className="text-sm font-medium text-white">Editar metadatos</h2>
          <button onClick={onCerrar} className="rounded p-1 text-neutral-500 hover:text-neutral-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Campos — scrollable */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Nombre del archivo */}
          <Field label="Nombre del archivo">
            <div className="flex items-center rounded-lg border border-neutral-700 bg-neutral-800 focus-within:border-blue-500">
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del documento"
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
              />
              <span className="flex-shrink-0 pr-3 text-xs text-neutral-600">.pdf</span>
            </div>
          </Field>

          {/* Título del trabajo */}
          <Field label="Título del trabajo">
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título completo del artículo o libro"
              className={inputCls}
            />
          </Field>

          {/* Autor + Año */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Autor / Autores">
              <input
                type="text"
                value={autor}
                onChange={(e) => setAutor(e.target.value)}
                placeholder="Apellido, N.; Apellido2, M."
                className={inputCls}
              />
            </Field>
            <Field label="Año">
              <input
                type="text"
                value={año}
                onChange={(e) => setAño(e.target.value)}
                placeholder="2023"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Tipo */}
          <Field label="Tipo de documento">
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTipo(tipo === t.value as Documento['tipo'] ? undefined : t.value as Documento['tipo'])}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    tipo === t.value
                      ? 'bg-blue-600 text-white'
                      : 'border border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Revista / Editorial */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Revista / Publicación">
              <input
                type="text"
                value={revista}
                onChange={(e) => setRevista(e.target.value)}
                placeholder="Nueva Sociedad"
                className={inputCls}
              />
            </Field>
            <Field label="Editorial">
              <input
                type="text"
                value={editorial}
                onChange={(e) => setEditorial(e.target.value)}
                placeholder="CLACSO, Siglo XXI..."
                className={inputCls}
              />
            </Field>
          </div>

          {/* Vol / Num / Págs */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Volumen">
              <input
                type="text"
                value={volumen}
                onChange={(e) => setVolumen(e.target.value)}
                placeholder="12"
                className={inputCls}
              />
            </Field>
            <Field label="Número">
              <input
                type="text"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="3"
                className={inputCls}
              />
            </Field>
            <Field label="Páginas">
              <input
                type="text"
                value={paginas}
                onChange={(e) => setPaginas(e.target.value)}
                placeholder="45-67"
                className={inputCls}
              />
            </Field>
          </div>

          {/* URL / DOI / ISBN */}
          <Field label="URL">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="DOI">
              <input
                type="text"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                placeholder="10.xxxx/xxxx"
                className={inputCls}
              />
            </Field>
            <Field label="ISBN">
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="978-x-xxx-xxxxx-x"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Abstract */}
          <Field label="Abstract / Resumen">
            <textarea
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              rows={3}
              placeholder="Descripción breve del contenido..."
              className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
            />
          </Field>

          {/* Etiquetas */}
          <Field label="Etiquetas temáticas">
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
          </Field>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-neutral-800 p-5 flex-shrink-0">
          <button
            onClick={onCerrar}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando || !nombre.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
