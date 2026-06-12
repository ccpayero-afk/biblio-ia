'use client'

import { useRef, useState } from 'react'
import { Folder, FolderOpen, FileText, X, Upload, ChevronRight, ChevronDown, Loader2, Check, AlertCircle } from 'lucide-react'

// ─── Árbol de carpetas ────────────────────────────────────────────────────────

interface NodoArbol {
  nombre: string
  path: string  // relative path without filename
  hijos: Map<string, NodoArbol>
  archivos: File[]
}

function buildTree(files: File[]): NodoArbol {
  const root: NodoArbol = { nombre: '', path: '', hijos: new Map(), archivos: [] }
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.pdf')) continue
    const partes = file.webkitRelativePath.split('/')
    let current = root
    // Navigate/create folder nodes (all but last segment which is the filename)
    for (let i = 0; i < partes.length - 1; i++) {
      const nombre = partes[i]
      if (!current.hijos.has(nombre)) {
        const path = partes.slice(0, i + 1).join('/')
        current.hijos.set(nombre, { nombre, path, hijos: new Map(), archivos: [] })
      }
      current = current.hijos.get(nombre)!
    }
    current.archivos.push(file)
  }
  return root
}

function countPDFs(nodo: NodoArbol): number {
  let total = nodo.archivos.length
  for (const hijo of nodo.hijos.values()) total += countPDFs(hijo)
  return total
}

function collectFolderPaths(nodo: NodoArbol, paths: string[] = []): string[] {
  for (const hijo of nodo.hijos.values()) {
    paths.push(hijo.path)
    collectFolderPaths(hijo, paths)
  }
  return paths
}

// ─── Vista del árbol ──────────────────────────────────────────────────────────

function NodoView({ nodo, depth = 0, estado }: {
  nodo: NodoArbol
  depth?: number
  estado: Map<string, 'pendiente' | 'subiendo' | 'ok' | 'error'>
}) {
  const [expandido, setExpandido] = useState(true)
  const tieneHijos = nodo.hijos.size > 0
  const total = countPDFs(nodo)

  return (
    <div>
      <div
        className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-neutral-800 cursor-pointer select-none"
        style={{ paddingLeft: depth * 16 + 6 }}
        onClick={() => tieneHijos && setExpandido((e) => !e)}
      >
        {tieneHijos ? (
          expandido ? <ChevronDown className="h-3 w-3 text-neutral-500 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 text-neutral-500 flex-shrink-0" />
        ) : <span className="w-3 flex-shrink-0" />}
        <FolderOpen className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
        <span className="text-sm text-white truncate">{nodo.nombre}</span>
        <span className="ml-auto text-xs text-neutral-500 flex-shrink-0">{total} pdf</span>
      </div>

      {expandido && (
        <>
          {/* Sub-carpetas */}
          {Array.from(nodo.hijos.values()).map((hijo) => (
            <NodoView key={hijo.path} nodo={hijo} depth={depth + 1} estado={estado} />
          ))}
          {/* Archivos directos */}
          {nodo.archivos.map((f, i) => {
            const est = estado.get(f.webkitRelativePath)
            return (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded px-1.5 py-0.5"
                style={{ paddingLeft: (depth + 1) * 16 + 6 }}
              >
                <span className="w-3 flex-shrink-0" />
                <FileText className="h-3.5 w-3.5 text-neutral-500 flex-shrink-0" />
                <span className="text-xs text-neutral-400 truncate flex-1">{f.name}</span>
                {est === 'subiendo' && <Loader2 className="h-3 w-3 animate-spin text-blue-400 flex-shrink-0" />}
                {est === 'ok' && <Check className="h-3 w-3 text-green-400 flex-shrink-0" />}
                {est === 'error' && <AlertCircle className="h-3 w-3 text-red-400 flex-shrink-0" />}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// ─── Indexar via SSE ──────────────────────────────────────────────────────────

async function indexarDocumento(docId: string, onMsg?: (m: string) => void) {
  const res = await fetch(`/api/index/${docId}`, { method: 'POST' })
  if (!res.body) return
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const data = JSON.parse(line.slice(6))
        if (data.msg && onMsg) onMsg(data.msg)
        if (data.done || data.error) return
      } catch { /* ignore parse errors */ }
    }
  }
}

// ─── Modal principal ──────────────────────────────────────────────────────────

interface Props {
  onCerrar: () => void
  onTerminado: () => void
}

type Fase = 'seleccion' | 'preview' | 'importando' | 'done'

export default function ImportarCarpetaModal({ onCerrar, onTerminado }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fase, setFase] = useState<Fase>('seleccion')
  const [archivos, setArchivos] = useState<File[]>([])
  const [arbol, setArbol] = useState<NodoArbol | null>(null)
  const [estadoArchivos, setEstadoArchivos] = useState<Map<string, 'pendiente' | 'subiendo' | 'ok' | 'error'>>(new Map())
  const [paso, setPaso] = useState('')
  const [progreso, setProgreso] = useState<{ actual: number; total: number } | null>(null)
  const [indexar, setIndexar] = useState(true)
  const [errores, setErrores] = useState<string[]>([])

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (!files.length) return
    setArchivos(files)
    setArbol(buildTree(files))
    setFase('preview')
  }

  function collectArchivos(nodo: NodoArbol, lista: File[] = []): File[] {
    lista.push(...nodo.archivos)
    for (const hijo of nodo.hijos.values()) collectArchivos(hijo, lista)
    return lista
  }

  async function iniciarImportacion() {
    if (!arbol) return
    setFase('importando')
    setErrores([])

    const pdfs = collectArchivos(arbol)
    const totalPDFs = pdfs.length

    // ── Paso 1: Crear estructura de carpetas ─────────────────────────────────
    setPaso('Creando estructura de carpetas…')
    setProgreso(null)

    const rutas = pdfs.map(f => f.webkitRelativePath)
    let mapa: Record<string, string> = {}

    try {
      const res = await fetch('/api/importar/carpeta-estructura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rutas }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      mapa = data.mapa
    } catch (e) {
      setErrores([`Error creando carpetas: ${e}`])
      setFase('done')
      return
    }

    // ── Paso 2: Subir PDFs uno a uno ─────────────────────────────────────────
    setPaso('Subiendo PDFs…')
    setProgreso({ actual: 0, total: totalPDFs })

    const docsSubidos: { id: string; nombre: string }[] = []
    const nuevosErrores: string[] = []

    const estadoMap = new Map<string, 'pendiente' | 'subiendo' | 'ok' | 'error'>()
    for (const f of pdfs) estadoMap.set(f.webkitRelativePath, 'pendiente')
    setEstadoArchivos(new Map(estadoMap))

    for (let i = 0; i < pdfs.length; i++) {
      const file = pdfs[i]
      const partes = file.webkitRelativePath.split('/')
      const carpetaPath = partes.slice(0, partes.length - 1).join('/')
      const carpetaId = mapa[carpetaPath]

      estadoMap.set(file.webkitRelativePath, 'subiendo')
      setEstadoArchivos(new Map(estadoMap))
      setProgreso({ actual: i, total: totalPDFs })

      try {
        const fd = new FormData()
        fd.append('files', file)
        if (carpetaId) fd.append('carpetaId_0', carpetaId)

        const res = await fetch('/api/drive/pdfs', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok || !data.ids?.[0]) throw new Error(data.error ?? 'Sin ID de respuesta')

        estadoMap.set(file.webkitRelativePath, 'ok')
        docsSubidos.push({ id: data.ids[0], nombre: file.name })
      } catch (e) {
        estadoMap.set(file.webkitRelativePath, 'error')
        nuevosErrores.push(`${file.name}: ${e}`)
      }

      setEstadoArchivos(new Map(estadoMap))
    }

    setProgreso({ actual: totalPDFs, total: totalPDFs })

    // ── Paso 3: Indexar (opcional) ───────────────────────────────────────────
    if (indexar && docsSubidos.length > 0) {
      setPaso('Indexando documentos…')
      setProgreso({ actual: 0, total: docsSubidos.length })

      for (let i = 0; i < docsSubidos.length; i++) {
        const doc = docsSubidos[i]
        setPaso(`Indexando: ${doc.nombre}`)
        setProgreso({ actual: i, total: docsSubidos.length })
        try {
          await indexarDocumento(doc.id)
        } catch (e) {
          nuevosErrores.push(`Error indexando ${doc.nombre}: ${e}`)
        }
      }
      setProgreso({ actual: docsSubidos.length, total: docsSubidos.length })
    }

    setErrores(nuevosErrores)
    setPaso(docsSubidos.length > 0 ? `Importación completada: ${docsSubidos.length} PDF${docsSubidos.length !== 1 ? 's' : ''}` : 'Sin documentos importados')
    setFase('done')
    onTerminado()
  }

  const totalPDFs = arbol ? countPDFs(arbol) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="flex w-full max-w-lg flex-col rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div>
            <h3 className="font-semibold text-white">Importar carpeta</h3>
            {fase === 'preview' && <p className="text-xs text-neutral-500 mt-0.5">{totalPDFs} PDF{totalPDFs !== 1 ? 's' : ''} encontrados</p>}
          </div>
          <button onClick={onCerrar} className="rounded p-1 text-neutral-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {fase === 'seleccion' && (
            <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
              <Folder className="h-12 w-12 text-neutral-600" />
              <div>
                <p className="text-sm text-neutral-300">Seleccioná una carpeta de tu PC</p>
                <p className="mt-1 text-xs text-neutral-600">Se importarán todos los PDFs respetando la estructura de subcarpetas</p>
              </div>
              <button
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-500 hover:to-violet-500"
              >
                <Upload className="h-4 w-4" /> Seleccionar carpeta
              </button>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                multiple
                accept=".pdf"
                onChange={onFilesChange}
                {...{ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>}
              />
            </div>
          )}

          {fase === 'preview' && arbol && (
            <div>
              <div className="mb-3 rounded-lg border border-neutral-800 bg-neutral-950 p-3 max-h-72 overflow-y-auto">
                {Array.from(arbol.hijos.values()).map((hijo) => (
                  <NodoView key={hijo.path} nodo={hijo} depth={0} estado={estadoArchivos} />
                ))}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={indexar}
                  onChange={(e) => setIndexar(e.target.checked)}
                  className="rounded border-neutral-600 bg-neutral-800 text-blue-500"
                />
                <span className="text-sm text-neutral-300">Indexar automáticamente después de subir</span>
              </label>
              {indexar && (
                <p className="mt-1 ml-6 text-xs text-neutral-600">La indexación puede tardar según la cantidad de PDFs</p>
              )}
            </div>
          )}

          {(fase === 'importando' || fase === 'done') && arbol && (
            <div>
              {/* Estado por archivo */}
              <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-950 p-3 max-h-64 overflow-y-auto">
                {Array.from(arbol.hijos.values()).map((hijo) => (
                  <NodoView key={hijo.path} nodo={hijo} depth={0} estado={estadoArchivos} />
                ))}
              </div>

              {/* Progreso */}
              {fase === 'importando' && progreso && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-neutral-500 mb-1">
                    <span className="truncate">{paso}</span>
                    <span className="flex-shrink-0 ml-2">{progreso.actual}/{progreso.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${progreso.total ? (progreso.actual / progreso.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {fase === 'done' && (
                <div className={`rounded-lg border px-3 py-2 text-sm ${errores.length ? 'border-yellow-900 text-yellow-300' : 'border-green-900 text-green-400'}`}>
                  <p className="font-medium">{paso}</p>
                  {errores.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {errores.slice(0, 5).map((e, i) => <li key={i} className="text-xs text-yellow-500">• {e}</li>)}
                      {errores.length > 5 && <li className="text-xs text-neutral-500">…y {errores.length - 5} más</li>}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-neutral-800 px-5 py-4">
          {fase === 'done' ? (
            <button onClick={onCerrar} className="rounded-lg bg-neutral-700 px-4 py-2 text-sm text-white hover:bg-neutral-600">
              Cerrar
            </button>
          ) : (
            <>
              <button onClick={onCerrar} className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:text-white">
                Cancelar
              </button>
              {fase === 'preview' && (
                <button
                  onClick={iniciarImportacion}
                  disabled={totalPDFs === 0}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-500 hover:to-violet-500 disabled:opacity-40"
                >
                  <Upload className="h-4 w-4" />
                  Importar {totalPDFs} PDF{totalPDFs !== 1 ? 's' : ''}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
