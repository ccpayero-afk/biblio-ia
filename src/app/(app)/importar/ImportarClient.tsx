'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react'

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
  duplicado?: { id: string; nombre: string }
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
  const [progreso, setProgreso] = useState<{ actual: number; total: number; nombre: string } | null>(null)
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
    setResultados([])
    const acumulados: ResultadoPDF[] = []

    for (let i = 0; i < archivos.length; i++) {
      const f = archivos[i]
      setProgreso({ actual: i + 1, total: archivos.length, nombre: f.name })

      try {
        // Paso 1: crear sesión de carga en Drive (solo JSON pequeño → no hay límite 4.5 MB)
        const sessionRes = await fetch('/api/importar/upload-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: f.name, fileSize: f.size }),
        })
        const sessionData = await sessionRes.json()

        if (sessionData.duplicado) {
          acumulados.push({ nombre: f.name, id: sessionData.duplicado.id, ok: false, duplicado: sessionData.duplicado })
          setResultados([...acumulados])
          continue
        }
        if (sessionData.error || !sessionData.uploadUrl) {
          acumulados.push({ nombre: f.name, id: '', ok: false, error: sessionData.error ?? 'Sin URL de carga' })
          setResultados([...acumulados])
          continue
        }

        // Paso 2: subir el archivo directo a Drive (bypasea Vercel, sin límite de tamaño)
        const uploadRes = await fetch(sessionData.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/pdf' },
          body: f,
        })
        if (!uploadRes.ok) {
          throw new Error(`Drive upload: ${uploadRes.status}`)
        }
        const driveFile = await uploadRes.json() as { id?: string }
        const fileId = driveFile.id
        if (!fileId) throw new Error('Drive no devolvió fileId')

        // Paso 3: guardar metadatos en Drive
        const meta = metadatos[i]
        await fetch('/api/importar/upload-finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId, meta }),
        })

        acumulados.push({ nombre: f.name, id: fileId, ok: true })
      } catch (e) {
        acumulados.push({ nombre: f.name, id: '', ok: false, error: String(e) })
      }
      setResultados([...acumulados])
    }

    setProgreso(null)
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
        <h1 className="text-xl font-bold text-white">Importación masiva</h1>
        <p className="mt-1 text-sm" style={{ color: 'rgba(148,163,184,0.55)' }}>
          Importá metadatos desde BibTeX o Zotero JSON, o cargá PDFs en lote.
        </p>
      </div>

      {/* Tabs */}
      <div
        className="mb-6 flex gap-1 rounded-xl p-1"
        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {(['bibtex', 'zotero', 'pdf'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setMetadatos([]); setResultados([]); setContenido(''); setError('') }}
            className="flex-1 rounded-lg py-2 text-sm capitalize transition-all"
            style={tab === t
              ? { background: 'linear-gradient(90deg, rgba(109,40,217,0.25), rgba(30,58,138,0.15))', color: '#fff', border: '1px solid rgba(139,92,246,0.25)' }
              : { color: 'rgba(148,163,184,0.5)', border: '1px solid transparent' }
            }
          >
            {t === 'bibtex' ? 'BibTeX' : t === 'zotero' ? 'Zotero JSON' : 'PDFs'}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm text-red-400"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
        >{error}</div>
      )}

      {tab !== 'pdf' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.6)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(148,163,184,0.6)' }}
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
            <span className="text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>o pegá el contenido abajo</span>
          </div>
          <textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            placeholder={tab === 'bibtex' ? '@article{...}' : '[{"itemType": "book", ...}]'}
            rows={10}
            className="w-full resize-none rounded-xl px-4 py-3 font-mono text-xs text-neutral-300 placeholder-neutral-700 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
          />
          <button
            onClick={parsear}
            disabled={cargando || !contenido.trim()}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 12px rgba(124,58,237,0.3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(124,58,237,0.5)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 12px rgba(124,58,237,0.3)' }}
          >
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Parsear
          </button>

          {metadatos.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-white">{metadatos.length} registros encontrados</p>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {metadatos.map((m, i) => (
                  <div
                    key={i}
                    className="rounded-lg px-3 py-2 text-xs"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <p className="font-medium text-white">{m.titulo}</p>
                    <p style={{ color: 'rgba(148,163,184,0.5)' }}>{m.autor} · {m.año}</p>
                    {m.editorial && <p style={{ color: 'rgba(148,163,184,0.35)' }}>{m.editorial}</p>}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>
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
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl py-12 transition-all"
            style={{ border: '2px dashed rgba(139,92,246,0.25)', background: 'rgba(255,255,255,0.015)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; e.currentTarget.style.background = 'rgba(139,92,246,0.04)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)'; e.currentTarget.style.background = 'rgba(255,255,255,0.015)' }}
          >
            <Upload className="h-8 w-8" style={{ color: 'rgba(139,92,246,0.5)' }} />
            <p className="mt-2 text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>Hacé clic para seleccionar PDFs</p>
            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>Podés seleccionar múltiples archivos</p>
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
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(148,163,184,0.6)' }}
                  >
                    <FileText className="h-3.5 w-3.5" style={{ color: 'rgba(139,92,246,0.5)' }} />
                    {f.name}
                    <span className="ml-auto" style={{ color: 'rgba(148,163,184,0.35)' }}>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                ))}
              </div>
              <button
                onClick={subirPDFs}
                disabled={cargando}
                className="mt-3 flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 12px rgba(124,58,237,0.3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(124,58,237,0.5)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 12px rgba(124,58,237,0.3)' }}
              >
                {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {cargando ? 'Subiendo…' : 'Subir a Drive'}
              </button>

              {progreso && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs" style={{ color: 'rgba(148,163,184,0.6)' }}>
                    <span className="truncate max-w-xs">{progreso.nombre}</span>
                    <span className="flex-shrink-0 ml-2">{progreso.actual}/{progreso.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(progreso.actual / progreso.total) * 100}%`,
                        background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {resultados.length > 0 && (
            <div className="space-y-2">
              {resultados.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                  style={r.ok
                    ? { background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(52,211,153,0.9)' }
                    : r.duplicado
                      ? { background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', color: 'rgba(251,191,36,0.9)' }
                      : { background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(248,113,113,0.9)' }
                  }
                >
                  {r.ok
                    ? <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    : r.duplicado
                      ? <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      : <XCircle className="h-3.5 w-3.5 flex-shrink-0" />}
                  <span className="flex-1 truncate">{r.nombre}</span>
                  {r.duplicado && (
                    <span className="ml-auto text-right shrink-0" style={{ color: 'rgba(251,191,36,0.6)' }}>
                      Ya existe: {r.duplicado.nombre}
                    </span>
                  )}
                  {!r.ok && !r.duplicado && <span className="ml-auto" style={{ color: 'rgba(148,163,184,0.4)' }}>{r.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
