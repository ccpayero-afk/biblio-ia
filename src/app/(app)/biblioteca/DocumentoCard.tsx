'use client'

import { useState, useEffect } from 'react'
import { Carpeta, Documento } from '@/types'
import { FileText, Pencil, Zap, FolderInput, Folder, CheckSquare2, Square, ScanSearch, CheckCircle2, ScanText, RefreshCw, Trash2 } from 'lucide-react'
import Link from 'next/link'

const COLORES_CARPETA: Record<Carpeta['color'], string> = {
  purple: 'text-purple-400', teal: 'text-teal-400', coral: 'text-red-400',
  amber: 'text-amber-400', blue: 'text-blue-400', green: 'text-green-400', gray: 'text-neutral-400',
}

const ESTADO_CONFIG = {
  sin_indexar: { label: 'Sin indexar', color: 'text-neutral-500 bg-neutral-800' },
  indexando:   { label: 'Indexando…', color: 'text-blue-400 bg-blue-950 animate-pulse' },
  indexado:    { label: 'Indexado',   color: 'text-green-400 bg-green-950' },
  error:       { label: 'Error',      color: 'text-red-400 bg-red-950' },
}

interface Props {
  documento: Documento
  carpeta?: Carpeta
  onEditar: () => void
  onMover?: () => void
  onIndexadoOk: (documentoId: string, fragmentos: number) => void
  onRegistrarIndexar?: (fn: () => void) => void
  onMetadatosExtraidos?: (documentoId: string, campos: string[]) => void
  onEliminar?: () => void
  modoSeleccion?: boolean
  seleccionado?: boolean
  onToggleSeleccion?: () => void
  vista?: 'grilla' | 'lista'
}

export default function DocumentoCard({
  documento, carpeta, onEditar, onMover, onIndexadoOk, onRegistrarIndexar,
  onMetadatosExtraidos, onEliminar,
  modoSeleccion, seleccionado, onToggleSeleccion, vista = 'grilla',
}: Props) {
  const [estado, setEstado] = useState(documento.estado)
  const [progreso, setProgreso] = useState<{ msg: string; paso: number; total: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [extrayendo, setExtrayendo] = useState(false)
  const [extraidoOk, setExtraidoOk] = useState(false)
  const [actualizando, setActualizando] = useState(false)
  const [actualizadoOk, setActualizadoOk] = useState(false)
  const [ocrActivo, setOcrActivo] = useState(false)

  const estadoConfig = ESTADO_CONFIG[estado]

  useEffect(() => { onRegistrarIndexar?.(iniciarIndexacion) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function iniciarOCR() {
    setOcrActivo(true)
    await iniciarIndexacion()
    setOcrActivo(false)
  }

  async function iniciarIndexacion() {
    setEstado('indexando')
    setErrorMsg(null)
    setProgreso({ msg: 'Iniciando…', paso: 0, total: 5 })
    try {
      const res = await fetch(`/api/index/${documento.id}`, { method: 'POST' })
      if (!res.body) throw new Error('Sin respuesta del servidor')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = JSON.parse(line.slice(6))
          if (payload.error) { setEstado('error'); setErrorMsg(payload.error); setProgreso(null); return }
          if (payload.done) { setEstado('indexado'); setProgreso(null); onIndexadoOk(documento.id, payload.fragmentos); return }
          setProgreso({ msg: payload.msg, paso: payload.paso, total: payload.total })
        }
      }
    } catch (e) {
      setEstado('error')
      setErrorMsg(e instanceof Error ? e.message : 'Error desconocido')
      setProgreso(null)
    }
  }

  async function extraerMetadatos(forzar = false) {
    if (forzar) { setActualizando(true); setActualizadoOk(false) }
    else        { setExtrayendo(true);   setExtraidoOk(false) }
    try {
      const res = await fetch(`/api/metadatos/${documento.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forzar }),
      })
      const data = await res.json()
      if (data.ok && data.actualizados?.length > 0) {
        onMetadatosExtraidos?.(documento.id, data.actualizados)
        if (forzar) { setActualizadoOk(true); setTimeout(() => setActualizadoOk(false), 3000) }
        else        { setExtraidoOk(true);    setTimeout(() => setExtraidoOk(false), 3000) }
      }
    } catch { /* silencioso */ }
    if (forzar) setActualizando(false)
    else        setExtrayendo(false)
  }

  const nombre = (documento.nombre.split('/').pop() ?? documento.nombre).replace(/\.pdf$/i, '')

  // ── Vista lista (detalle) ────────────────────────────────────────────────────
  if (vista === 'lista') {
    return (
      <div
        className={`group flex min-h-[2.5rem] items-center gap-3 border-b border-neutral-800/50 px-4 py-2 text-sm transition-colors ${
          modoSeleccion
            ? `cursor-pointer ${seleccionado ? 'bg-blue-950/20' : 'hover:bg-neutral-900/60'}`
            : 'hover:bg-neutral-900/60'
        }`}
        onClick={modoSeleccion ? onToggleSeleccion : undefined}
      >
        {/* Checkbox */}
        {modoSeleccion && (
          seleccionado
            ? <CheckSquare2 className="h-4 w-4 flex-shrink-0 text-blue-400" />
            : <Square className="h-4 w-4 flex-shrink-0 text-neutral-600" />
        )}

        {/* Icono */}
        <FileText className="h-4 w-4 flex-shrink-0 text-neutral-500" />

        {/* Nombre + progreso */}
        <div className="min-w-0 flex-1">
          {progreso ? (
            <>
              <span className="block truncate text-white">{nombre}</span>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1 w-28 overflow-hidden rounded-full bg-neutral-800">
                  <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${(progreso.paso / progreso.total) * 100}%` }} />
                </div>
                <span className="truncate text-xs text-neutral-500">{progreso.msg}</span>
              </div>
            </>
          ) : modoSeleccion ? (
            <span className="block truncate text-white">{nombre}</span>
          ) : (
            <Link href={`/lector/${documento.id}`} className="block truncate text-white hover:text-blue-400">
              {nombre}
            </Link>
          )}
          {errorMsg && <p className="truncate text-xs text-red-400">{errorMsg}</p>}
        </div>

        {/* Autor */}
        <div className="w-40 flex-shrink-0 truncate text-xs text-neutral-500">
          {documento.autor ? `${documento.autor}${documento.año ? ` (${documento.año})` : ''}` : <span className="text-neutral-700">—</span>}
        </div>

        {/* Carpeta */}
        <div className="w-32 flex-shrink-0 truncate">
          {carpeta ? (
            <span className={`flex items-center gap-1 text-xs ${COLORES_CARPETA[carpeta.color]}`}>
              <Folder className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{carpeta.nombre}</span>
            </span>
          ) : (
            <span className="text-xs text-neutral-700">—</span>
          )}
        </div>

        {/* Estado */}
        <div className="w-24 flex-shrink-0">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${estadoConfig.color}`}>
            {estadoConfig.label}
          </span>
        </div>

        {/* Fragmentos */}
        <div className="w-16 flex-shrink-0 text-right text-xs text-neutral-600">
          {estado === 'indexado' && documento.fragmentos > 0 ? documento.fragmentos : <span className="text-neutral-700">—</span>}
        </div>

        {/* Acciones */}
        {!modoSeleccion && (
          <div className="flex w-28 flex-shrink-0 items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {(estado === 'sin_indexar' || estado === 'error') && (
              <button onClick={(e) => { e.stopPropagation(); iniciarIndexacion() }} className="rounded p-1 text-neutral-600 hover:text-blue-400" title="Indexar">
                <Zap className="h-3.5 w-3.5" />
              </button>
            )}
            {estado !== 'indexando' && (
              <button
                onClick={(e) => { e.stopPropagation(); iniciarOCR() }}
                disabled={ocrActivo}
                title="OCR + Indexar (para PDFs escaneados)"
                className="rounded p-1 text-neutral-600 hover:text-orange-400 disabled:opacity-40"
              >
                <ScanText className={`h-3.5 w-3.5 ${ocrActivo ? 'animate-pulse text-orange-400' : ''}`} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); extraerMetadatos(false) }}
              disabled={extrayendo}
              title="Extraer metadatos (rellena campos vacíos)"
              className="rounded p-1 text-neutral-600 hover:text-teal-400 disabled:opacity-40"
            >
              {extraidoOk
                ? <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
                : extrayendo
                ? <ScanSearch className="h-3.5 w-3.5 animate-pulse text-teal-400" />
                : <ScanSearch className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); extraerMetadatos(true) }}
              disabled={actualizando}
              title="Actualizar metadatos (sobrescribe todos)"
              className="rounded p-1 text-neutral-600 hover:text-violet-400 disabled:opacity-40"
            >
              {actualizadoOk
                ? <CheckCircle2 className="h-3.5 w-3.5 text-violet-400" />
                : <RefreshCw className={`h-3.5 w-3.5 ${actualizando ? 'animate-spin text-violet-400' : ''}`} />}
            </button>
            {onMover && (
              <button onClick={(e) => { e.stopPropagation(); onMover() }} className="rounded p-1 text-neutral-600 hover:text-neutral-300" title="Mover a carpeta">
                <FolderInput className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onEditar() }} className="rounded p-1 text-neutral-600 hover:text-neutral-300" title="Editar metadatos">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {onEliminar && (
              <button
                onClick={(e) => { e.stopPropagation(); onEliminar() }}
                title="Eliminar documento"
                className="rounded p-1 text-neutral-700 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Vista grilla (tarjeta) ───────────────────────────────────────────────────
  return (
    <div
      className={`group relative flex flex-col rounded-xl border bg-neutral-900 p-4 transition-colors ${
        modoSeleccion
          ? `cursor-pointer ${seleccionado ? 'border-blue-500 bg-blue-950/20 ring-1 ring-blue-500/30' : 'border-neutral-700 hover:border-neutral-600'}`
          : 'border-neutral-800 hover:border-neutral-700'
      }`}
      onClick={modoSeleccion ? onToggleSeleccion : undefined}
    >
      {modoSeleccion && (
        <div className="absolute left-3 top-3">
          {seleccionado ? <CheckSquare2 className="h-4 w-4 text-blue-400" /> : <Square className="h-4 w-4 text-neutral-600" />}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <FileText className={`mt-0.5 h-5 w-5 flex-shrink-0 text-neutral-500 ${modoSeleccion ? 'ml-6' : ''}`} />
        {!modoSeleccion && (
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {(estado === 'sin_indexar' || estado === 'error') && (
              <button onClick={iniciarIndexacion} className="rounded p-1 text-neutral-600 hover:text-blue-400" title="Indexar">
                <Zap className="h-3.5 w-3.5" />
              </button>
            )}
            {estado !== 'indexando' && (
              <button
                onClick={iniciarOCR}
                disabled={ocrActivo}
                title="OCR + Indexar (para PDFs escaneados)"
                className="rounded p-1 text-neutral-600 hover:text-orange-400 disabled:opacity-40"
              >
                <ScanText className={`h-3.5 w-3.5 ${ocrActivo ? 'animate-pulse text-orange-400' : ''}`} />
              </button>
            )}
            <button
              onClick={() => extraerMetadatos(false)}
              disabled={extrayendo}
              title="Extraer metadatos (rellena campos vacíos)"
              className="rounded p-1 text-neutral-600 hover:text-teal-400 disabled:opacity-40"
            >
              {extraidoOk
                ? <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
                : extrayendo
                ? <ScanSearch className="h-3.5 w-3.5 animate-pulse text-teal-400" />
                : <ScanSearch className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => extraerMetadatos(true)}
              disabled={actualizando}
              title="Actualizar metadatos (sobrescribe todos)"
              className="rounded p-1 text-neutral-600 hover:text-violet-400 disabled:opacity-40"
            >
              {actualizadoOk
                ? <CheckCircle2 className="h-3.5 w-3.5 text-violet-400" />
                : <RefreshCw className={`h-3.5 w-3.5 ${actualizando ? 'animate-spin text-violet-400' : ''}`} />}
            </button>
            {onMover && (
              <button onClick={onMover} className="rounded p-1 text-neutral-600 hover:text-neutral-300" title="Mover a carpeta">
                <FolderInput className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={onEditar} className="rounded p-1 text-neutral-600 hover:text-neutral-300" title="Editar metadatos">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {onEliminar && (
              <button
                onClick={onEliminar}
                title="Eliminar documento"
                className="rounded p-1 text-neutral-700 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex-1">
        {modoSeleccion ? (
          <span className="line-clamp-2 text-sm font-medium text-white">{nombre}</span>
        ) : (
          <Link href={`/lector/${documento.id}`} className="line-clamp-2 text-sm font-medium text-white hover:text-blue-400">
            {nombre}
          </Link>
        )}
        {documento.autor && (
          <p className="mt-1 text-xs text-neutral-500">{documento.autor}{documento.año ? ` (${documento.año})` : ''}</p>
        )}
        {carpeta && (
          <p className={`mt-1 flex items-center gap-1 text-xs ${COLORES_CARPETA[carpeta.color]}`}>
            <Folder className="h-3 w-3" />{carpeta.nombre}
          </p>
        )}
      </div>

      {progreso && (
        <div className="mt-3 space-y-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${(progreso.paso / progreso.total) * 100}%` }} />
          </div>
          <p className="truncate text-xs text-neutral-500">{progreso.msg}</p>
        </div>
      )}

      {!progreso && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${estadoConfig.color}`}>
            {estadoConfig.label}
          </span>
          {estado === 'indexado' && documento.fragmentos > 0 && (
            <span className="text-xs text-neutral-600">{documento.fragmentos} fragmentos</span>
          )}
        </div>
      )}

      {errorMsg && <p className="mt-1 line-clamp-2 text-xs text-red-400">{errorMsg}</p>}

      {documento.etiquetas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {documento.etiquetas.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">{tag}</span>
          ))}
        </div>
      )}
    </div>
  )
}
