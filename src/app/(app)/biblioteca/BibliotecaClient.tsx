'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Documento } from '@/types'
import { Upload, RefreshCw, Zap, AlertCircle } from 'lucide-react'
import DocumentoCard from './DocumentoCard'
import MetadatosModal from './MetadatosModal'

export default function BibliotecaClient() {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [editando, setEditando] = useState<Documento | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [errorSubida, setErrorSubida] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const indexarRefs = useRef<Record<string, () => void>>({})

  const cargarDocumentos = useCallback(async () => {
    setCargando(true)
    setErrorCarga(null)
    try {
      const res = await fetch('/api/drive/pdfs')
      const data = await res.json()
      if (Array.isArray(data)) {
        setDocumentos(data)
      } else {
        setErrorCarga(data?.error ?? 'Error al cargar documentos')
        setDocumentos([])
      }
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargarDocumentos() }, [cargarDocumentos])

  async function subirArchivos(files: FileList | File[]) {
    // Aceptar PDFs por MIME type O por extensión (en Windows el MIME puede venir vacío)
    const pdfs = Array.from(files).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    )
    if (!pdfs.length) {
      setErrorSubida('No se detectaron archivos PDF. Seleccioná archivos con extensión .pdf')
      return
    }
    setSubiendo(true)
    setErrorSubida(null)
    const fd = new FormData()
    pdfs.forEach((f) => fd.append('files', f))
    try {
      const res = await fetch('/api/drive/pdfs', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setErrorSubida(err?.error ?? `Error al subir (${res.status})`)
      } else {
        await cargarDocumentos()
      }
    } catch (e) {
      setErrorSubida(e instanceof Error ? e.message : 'Error de red al subir')
    } finally {
      setSubiendo(false)
    }
  }

  function onDocumentIndexado(documentoId: string, fragmentos: number) {
    setDocumentos((prev) =>
      prev.map((d) => d.id === documentoId ? { ...d, estado: 'indexado', fragmentos } : d)
    )
  }

  function registrarIndexar(id: string, fn: () => void) {
    indexarRefs.current[id] = fn
  }

  async function guardarMetadatos(id: string, datos: Partial<Documento>) {
    await fetch(`/api/drive/metadata/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    setDocumentos((prev) => prev.map((d) => d.id === id ? { ...d, ...datos } : d))
    setEditando(null)
  }

  const sinIndexar = documentos.filter((d) => d.estado === 'sin_indexar').length

  return (
    <div
      className="space-y-5"
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); subirArchivos(e.dataTransfer.files) }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Biblioteca</h1>
          <p className="mt-0.5 text-sm text-neutral-400">
            {documentos.length} documento{documentos.length !== 1 ? 's' : ''}
            {sinIndexar > 0 && ` · ${sinIndexar} sin indexar`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={cargarDocumentos}
            disabled={cargando}
            className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          {sinIndexar > 0 && (
            <button
              onClick={() => {
                documentos
                  .filter((d) => d.estado === 'sin_indexar')
                  .forEach((d) => indexarRefs.current[d.id]?.())
              }}
              className="flex items-center gap-2 rounded-lg border border-blue-700 bg-blue-950/40 px-3 py-2 text-sm text-blue-400 hover:bg-blue-950"
            >
              <Zap className="h-4 w-4" />
              Indexar todos ({sinIndexar})
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={subiendo}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {subiendo ? 'Subiendo…' : 'Subir PDF'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && subirArchivos(e.target.files)}
          />
        </div>
      </div>

      {/* Mensajes de error */}
      {errorCarga && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Error al cargar documentos: {errorCarga}</span>
        </div>
      )}
      {errorSubida && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{errorSubida}</span>
          <button onClick={() => setErrorSubida(null)} className="ml-auto text-xs underline">Cerrar</button>
        </div>
      )}

      {dragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-blue-500 bg-neutral-900 p-16 text-center">
            <Upload className="mx-auto h-12 w-12 text-blue-400" />
            <p className="mt-4 text-lg font-medium text-white">Soltá los PDFs aquí</p>
          </div>
        </div>
      )}

      {!cargando && documentos.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-700 py-20">
          <Upload className="h-10 w-10 text-neutral-600" />
          <p className="mt-3 text-sm font-medium text-neutral-400">No hay documentos todavía</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Subir primer PDF
          </button>
        </div>
      )}

      {cargando && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900" />
          ))}
        </div>
      )}

      {!cargando && documentos.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {documentos.map((doc) => (
            <DocumentoCard
              key={doc.id}
              documento={doc}
              onEditar={() => setEditando(doc)}
              onIndexadoOk={onDocumentIndexado}
              onRegistrarIndexar={(fn) => registrarIndexar(doc.id, fn)}
            />
          ))}
        </div>
      )}

      {editando && (
        <MetadatosModal
          documento={editando}
          onGuardar={(datos) => guardarMetadatos(editando.id, datos)}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}
