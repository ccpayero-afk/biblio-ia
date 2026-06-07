'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface MetadatoImportado {
  titulo: string
  autor: string
  año: string
  editorial?: string
  etiquetas: string[]
}

interface ResultadoPDF {
  nombre: string
  id: string
  ok: boolean
  error?: string
}

type Tab = 'bibtex' | 'zotero' | 'pdf'

export default function ImportarClient() {
  const [tab, setTab] = useState<Tab>('bibtex')
  const [contenido, setContenido] = useState('')
  const [metadatos, setMetadatos] = useState<MetadatoImportado[]>([])
  const [archivos, setArchivos] = useState<File[]>([])
  const [resultados, setResultados] = useState<ResultadoPDF[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  async function parsear() {
    if (!contenido.trim()) return
    setCargando(true)
    setError('')
    try {
      const res = await fetch(`/api/importar?tipo=${tab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido }),
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setMetadatos(data.metadatos ?? [])
    } catch (e) {
      setError(String(e))
    }
    setCargando(false)
  }

  async function subirPDFs() {
    if (!archivos.length) return
    setCargando(true)
    setError('')
    const formData = new FormData()
    archivos.forEach((f, i) => {
      formData.append(`file_${i}`, f)
      const meta = metadatos[i]
      if (meta) formData.append(`meta_file_${i}`, JSON.stringify(meta))
    })
    try {
      const res = await fetch('/api/importar?tipo=pdf', { method: 'POST', body: formData })
      const data = await res.json()
      setResultados(data.resultados ?? [])
    } catch (e) {
      setError(String(e))
    }
    setCargando(false)
  }

  function leerArchivo(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => setContenido(e.target?.result as string ?? '')
    reader.readAsText(file)
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Importación masiva</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Importá metadatos desde BibTeX o Zotero JSON, o cargá PDFs en lote.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-neutral-800 bg-neutral-900 p-1">
        {(['bibtex', 'zotero', 'pdf'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setMetadatos([]); setResultados([]); setContenido(''); setError('') }}
            className={`flex-1 rounded-lg py-2 text-sm capitalize transition-colors ${
              tab === t ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t === 'bibtex' ? 'BibTeX' : t === 'zotero' ? 'Zotero JSON' : 'PDFs'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-900 bg-red-900/20 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {tab !== 'pdf' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-600"
            >
              <FileText className="h-3.5 w-3.5" /> Cargar archivo
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={tab === 'bibtex' ? '.bib' : '.json'}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && leerArchivo(e.target.files[0])}
            />
            <span className="text-xs text-neutral-600">o pegá el contenido abajo</span>
          </div>
          <textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            placeholder={tab === 'bibtex' ? '@article{...}' : '[{"itemType": "book", ...}]'}
            rows={10}
            className="w-full resize-none rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 font-mono text-xs text-neutral-300 placeholder-neutral-700 focus:border-neutral-600 focus:outline-none"
          />
          <button
            onClick={parsear}
            disabled={cargando || !contenido.trim()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Parsear
          </button>

          {metadatos.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-white">{metadatos.length} registros encontrados</p>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {metadatos.map((m, i) => (
                  <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs">
                    <p className="font-medium text-white">{m.titulo}</p>
                    <p className="text-neutral-500">{m.autor} · {m.año}</p>
                    {m.editorial && <p className="text-neutral-600">{m.editorial}</p>}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-neutral-600">
                Estos metadatos se usarán al subir los PDFs correspondientes.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'pdf' && (
        <div className="space-y-4">
          <div
            onClick={() => pdfRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-700 py-12 hover:border-neutral-600"
          >
            <Upload className="h-8 w-8 text-neutral-600" />
            <p className="mt-2 text-sm text-neutral-500">Hacé clic para seleccionar PDFs</p>
            <p className="text-xs text-neutral-700">Podés seleccionar múltiples archivos</p>
            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => setArchivos(Array.from(e.target.files ?? []))}
            />
          </div>

          {archivos.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-white">{archivos.length} PDFs seleccionados</p>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {archivos.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-400">
                    <FileText className="h-3.5 w-3.5 text-neutral-600" />
                    {f.name}
                    <span className="ml-auto text-neutral-600">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                ))}
              </div>
              <button
                onClick={subirPDFs}
                disabled={cargando}
                className="mt-3 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Subir a Drive
              </button>
            </div>
          )}

          {resultados.length > 0 && (
            <div className="space-y-2">
              {resultados.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${r.ok ? 'border-green-900 text-green-400' : 'border-red-900 text-red-400'}`}>
                  {r.ok ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {r.nombre}
                  {!r.ok && <span className="ml-auto text-neutral-600">{r.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
