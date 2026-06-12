'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Carpeta, Documento } from '@/types'
import { Upload, RefreshCw, Zap, AlertCircle, FolderPlus, FolderOpen, Folder, MoreHorizontal, X, ChevronRight, ChevronDown, FolderInput, Trash2, CheckSquare2, LayoutList, LayoutGrid, PanelLeftClose, PanelLeftOpen, ChevronsDownUp, ChevronsUpDown, ScanSearch, ScanText, Wand2, Settings2 } from 'lucide-react'
import DocumentoCard from './DocumentoCard'
import MetadatosModal from './MetadatosModal'
import ImportarCarpetaModal from './ImportarCarpetaModal'
import PipelineModal from './PipelineModal'

const COLORES_CARPETA: Record<Carpeta['color'], string> = {
  purple: 'text-purple-400',
  teal: 'text-teal-400',
  coral: 'text-red-400',
  amber: 'text-amber-400',
  blue: 'text-blue-400',
  green: 'text-green-400',
  gray: 'text-neutral-400',
}

const OPCIONES_COLOR: { valor: Carpeta['color']; label: string; clase: string }[] = [
  { valor: 'blue', label: 'Azul', clase: 'bg-blue-500' },
  { valor: 'purple', label: 'Púrpura', clase: 'bg-purple-500' },
  { valor: 'teal', label: 'Teal', clase: 'bg-teal-500' },
  { valor: 'green', label: 'Verde', clase: 'bg-green-500' },
  { valor: 'amber', label: 'Ámbar', clase: 'bg-amber-500' },
  { valor: 'coral', label: 'Coral', clase: 'bg-red-400' },
  { valor: 'gray', label: 'Gris', clase: 'bg-neutral-500' },
]

// ─── Helpers árbol ────────────────────────────────────────────────────────────

function getSubtreeIds(carpetaId: string, carpetas: Carpeta[]): string[] {
  const hijos = carpetas.filter((c) => c.carpetaPadreId === carpetaId)
  return [carpetaId, ...hijos.flatMap((h) => getSubtreeIds(h.id, carpetas))]
}

function getRuta(carpetaId: string, carpetas: Carpeta[]): Carpeta[] {
  const c = carpetas.find((x) => x.id === carpetaId)
  if (!c) return []
  if (c.carpetaPadreId) return [...getRuta(c.carpetaPadreId, carpetas), c]
  return [c]
}

// ─── Árbol de carpetas (componente recursivo) ─────────────────────────────────

interface CarpetaItemProps {
  carpeta: Carpeta
  depth: number
  carpetas: Carpeta[]
  documentos: Documento[]
  carpetaActiva: string | null
  menuCarpeta: string | null
  colapsoGlobal: boolean
  onSelect: (id: string) => void
  onMenuToggle: (id: string | null) => void
  onNuevaSubcarpeta: (padreId: string) => void
  onEditar: (c: Carpeta) => void
  onEliminar: (id: string) => void
  onEliminarConArchivos: (id: string) => void
}

function CarpetaItem({
  carpeta, depth, carpetas, documentos, carpetaActiva, menuCarpeta, colapsoGlobal,
  onSelect, onMenuToggle, onNuevaSubcarpeta, onEditar, onEliminar, onEliminarConArchivos,
}: CarpetaItemProps) {
  const [expandido, setExpandido] = useState(true)

  useEffect(() => { setExpandido(!colapsoGlobal) }, [colapsoGlobal])
  const hijos = carpetas.filter((c) => c.carpetaPadreId === carpeta.id)
  const estaActiva = carpetaActiva === carpeta.id
  const ids = getSubtreeIds(carpeta.id, carpetas)
  const count = documentos.filter((d) => d.carpetaId && ids.includes(d.carpetaId)).length

  return (
    <div>
      <div className="group relative" style={{ paddingLeft: depth * 12 }}>
        <div className="flex items-center">
          <button
            onClick={(e) => { e.stopPropagation(); setExpandido((v) => !v) }}
            className="flex h-6 w-4 flex-shrink-0 items-center justify-center"
          >
            {hijos.length > 0 && (
              expandido
                ? <ChevronDown className="h-3 w-3 text-neutral-600" />
                : <ChevronRight className="h-3 w-3 text-neutral-600" />
            )}
          </button>
          <button
            onClick={() => onSelect(carpeta.id)}
            className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-sm ${estaActiva ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}`}
          >
            <Folder className={`h-3.5 w-3.5 flex-shrink-0 ${COLORES_CARPETA[carpeta.color]}`} />
            <span className="flex-1 truncate text-left">{carpeta.nombre}</span>
            {count > 0 && <span className="flex-shrink-0 text-xs text-neutral-600">{count}</span>}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMenuToggle(menuCarpeta === carpeta.id ? null : carpeta.id) }}
            className="flex-shrink-0 rounded p-0.5 text-neutral-700 opacity-0 hover:text-neutral-300 group-hover:opacity-100"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
        {menuCarpeta === carpeta.id && (
          <div className="absolute right-0 top-full z-20 mt-0.5 w-52 rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-lg">
            <button onClick={() => { onNuevaSubcarpeta(carpeta.id); onMenuToggle(null) }} className="block w-full px-3 py-1.5 text-left text-xs text-neutral-300 hover:bg-neutral-800">+ Subcarpeta</button>
            <button onClick={() => { onEditar(carpeta); onMenuToggle(null) }} className="block w-full px-3 py-1.5 text-left text-xs text-neutral-300 hover:bg-neutral-800">Editar</button>
            <div className="my-1 border-t border-neutral-800" />
            <button onClick={() => { onEliminar(carpeta.id); onMenuToggle(null) }} className="block w-full px-3 py-1.5 text-left text-xs text-neutral-400 hover:bg-neutral-800">Eliminar carpeta</button>
            <button onClick={() => { onEliminarConArchivos(carpeta.id); onMenuToggle(null) }} className="block w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-neutral-800">Eliminar carpeta + archivos</button>
          </div>
        )}
      </div>
      {expandido && hijos.map((h) => (
        <CarpetaItem
          key={h.id}
          carpeta={h}
          depth={depth + 1}
          carpetas={carpetas}
          documentos={documentos}
          carpetaActiva={carpetaActiva}
          menuCarpeta={menuCarpeta}
          colapsoGlobal={colapsoGlobal}
          onSelect={onSelect}
          onMenuToggle={onMenuToggle}
          onNuevaSubcarpeta={onNuevaSubcarpeta}
          onEditar={onEditar}
          onEliminar={onEliminar}
          onEliminarConArchivos={onEliminarConArchivos}
        />
      ))}
    </div>
  )
}

// ─── Modal de nueva/editar carpeta ───────────────────────────────────────────

function CarpetaModal({
  carpeta,
  onGuardar,
  onCerrar,
}: {
  carpeta?: Carpeta
  onGuardar: (datos: { nombre: string; color: Carpeta['color']; descripcion?: string }) => void
  onCerrar: () => void
}) {
  const [nombre, setNombre] = useState(carpeta?.nombre ?? '')
  const [color, setColor] = useState<Carpeta['color']>(carpeta?.color ?? 'blue')
  const [descripcion, setDescripcion] = useState(carpeta?.descripcion ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-white">{carpeta ? 'Editar carpeta' : 'Nueva carpeta'}</h3>
        <div className="space-y-4">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de la carpeta"
            autoFocus
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
          />
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción (opcional)"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
          />
          <div>
            <p className="mb-2 text-xs text-neutral-500">Color</p>
            <div className="flex gap-2">
              {OPCIONES_COLOR.map((c) => (
                <button
                  key={c.valor}
                  onClick={() => setColor(c.valor)}
                  title={c.label}
                  className={`h-6 w-6 rounded-full ${c.clase} ${color === c.valor ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCerrar} className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:text-white">Cancelar</button>
          <button
            onClick={() => { if (nombre.trim()) onGuardar({ nombre: nombre.trim(), color, descripcion: descripcion.trim() || undefined }) }}
            disabled={!nombre.trim()}
            className="rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-500 hover:to-violet-500 disabled:opacity-50"
          >
            {carpeta ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de mover documento ─────────────────────────────────────────────────

function MoverModal({
  documento,
  carpetas,
  onMover,
  onCerrar,
}: {
  documento: Documento
  carpetas: Carpeta[]
  onMover: (carpetaId: string | null) => void
  onCerrar: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Mover a carpeta</h3>
          <button onClick={onCerrar}><X className="h-4 w-4 text-neutral-500" /></button>
        </div>
        <p className="mb-3 text-xs text-neutral-500 truncate">{documento.nombre}</p>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          <button
            onClick={() => onMover(null)}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left ${!documento.carpetaId ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800'}`}
          >
            <FolderOpen className="h-4 w-4 text-neutral-500" />
            Sin carpeta
          </button>
          {carpetas.map((c) => (
            <button
              key={c.id}
              onClick={() => onMover(c.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left ${documento.carpetaId === c.id ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800'}`}
            >
              <Folder className={`h-4 w-4 ${COLORES_CARPETA[c.color]}`} />
              {c.nombre}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BibliotecaClient() {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [carpetas, setCarpetas] = useState<Carpeta[]>([])
  const [carpetaActiva, setCarpetaActiva] = useState<string | null>(null) // null = todas
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [editando, setEditando] = useState<Documento | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [errorSubida, setErrorSubida] = useState<string | null>(null)
  const [modalCarpeta, setModalCarpeta] = useState<{ carpeta?: Carpeta; padreId?: string } | null>(null)
  const [modalImportarCarpeta, setModalImportarCarpeta] = useState(false)
  const [menuCarpeta, setMenuCarpeta] = useState<string | null>(null)
  const [moviendo, setMoviendo] = useState<Documento | null>(null)
  const [indexandoLote, setIndexandoLote] = useState(false)
  const [progresoLote, setProgresoLote] = useState<{ actual: number; total: number } | null>(null)
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [eliminandoLote, setEliminandoLote] = useState(false)
  const [extrayendoMeta, setExtrayendoMeta] = useState(false)
  const [progresoMeta, setProgresoMeta] = useState<{ actual: number; total: number } | null>(null)
  const [actualizandoMetaLote, setActualizandoMetaLote] = useState(false)
  const [progresoActMeta, setProgresoActMeta] = useState<{ actual: number; total: number } | null>(null)
  const [ocrLoteActivo, setOcrLoteActivo] = useState(false)
  const [progresoOcrLote, setProgresoOcrLote] = useState<{ actual: number; total: number } | null>(null)
  const [showPipeline, setShowPipeline] = useState(false)
  const [menuHerramientas, setMenuHerramientas] = useState(false)
  const herramientasRef = useRef<HTMLDivElement>(null)
  const [vista, setVista] = useState<'lista' | 'grilla'>('lista')
  const [sidebarAbierto, setSidebarAbierto] = useState(true)
  const [todosColapsados, setTodosColapsados] = useState(false)
  const [panelWidth, setPanelWidth] = useState(208)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const PANEL_MIN = 150
  const PANEL_MAX = 420

  function onPanelDragStart(e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = panelWidth
    function onMove(ev: MouseEvent) {
      setPanelWidth(Math.min(PANEL_MAX, Math.max(PANEL_MIN, startWidth + ev.clientX - startX)))
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  const indexarRefs = useRef<Record<string, () => void>>({})

  const cargar = useCallback(async () => {
    setCargando(true)
    setErrorCarga(null)
    try {
      const [resDocs, resCarpetas, resFichas] = await Promise.all([
        fetch('/api/drive/pdfs'),
        fetch('/api/carpetas'),
        fetch('/api/fichas'),
      ])
      const docs = await resDocs.json()
      const carps = await resCarpetas.json()
      const fichaIds: unknown = await resFichas.json().catch(() => [])
      if (Array.isArray(docs)) {
        const fichaSet = new Set(Array.isArray(fichaIds) ? fichaIds as string[] : [])
        setDocumentos(docs.map((d: Documento) => ({ ...d, fichaGenerada: d.fichaGenerada || fichaSet.has(d.id) })))
      } else {
        setErrorCarga(docs?.error ?? 'Error al cargar documentos')
      }
      if (Array.isArray(carps)) setCarpetas(carps)
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (herramientasRef.current && !herramientasRef.current.contains(e.target as Node)) {
        setMenuHerramientas(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function subirArchivos(files: FileList | File[]) {
    const pdfs = Array.from(files).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    )
    if (!pdfs.length) { setErrorSubida('No se detectaron archivos PDF'); return }
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
        await cargar()
      }
    } catch (e) {
      setErrorSubida(e instanceof Error ? e.message : 'Error de red al subir')
    } finally {
      setSubiendo(false)
    }
  }

  function onDocumentIndexado(id: string, fragmentos: number) {
    setDocumentos((prev) => prev.map((d) => d.id === id ? { ...d, estado: 'indexado', fragmentos } : d))
  }

  async function indexarTodosSecuencial(pendientes: Documento[]) {
    if (pendientes.length === 0 || indexandoLote) return
    setIndexandoLote(true)
    setProgresoLote({ actual: 0, total: pendientes.length })
    for (let i = 0; i < pendientes.length; i++) {
      setProgresoLote({ actual: i, total: pendientes.length })
      const fn = indexarRefs.current[pendientes[i].id]
      if (fn) await (fn as () => Promise<void>)()
      // Pausa entre documentos para no saturar la API de embeddings
      if (i < pendientes.length - 1) {
        await new Promise((r) => setTimeout(r, 3000))
      }
    }
    setProgresoLote(null)
    setIndexandoLote(false)
  }

  function onMetadatosExtraidos(_docId: string, campos: string[]) {
    if (campos.length > 0) cargar()
  }

  async function extraerMetadatosLote() {
    const sinDatos = documentosFiltrados.filter((d) => !d.autor && !d.año)
    if (!sinDatos.length || extrayendoMeta) return
    setExtrayendoMeta(true)
    setProgresoMeta({ actual: 0, total: sinDatos.length })
    for (let i = 0; i < sinDatos.length; i++) {
      setProgresoMeta({ actual: i + 1, total: sinDatos.length })
      try {
        await fetch(`/api/metadatos/${sinDatos[i].id}`, { method: 'POST' })
      } catch { /* continuar */ }
      if (i < sinDatos.length - 1) await new Promise((r) => setTimeout(r, 300))
    }
    setProgresoMeta(null)
    setExtrayendoMeta(false)
    cargar()
  }

  async function actualizarMetadatosLote() {
    if (actualizandoMetaLote || documentosFiltrados.length === 0) return
    setActualizandoMetaLote(true)
    setProgresoActMeta({ actual: 0, total: documentosFiltrados.length })
    for (let i = 0; i < documentosFiltrados.length; i++) {
      setProgresoActMeta({ actual: i + 1, total: documentosFiltrados.length })
      try {
        await fetch(`/api/metadatos/${documentosFiltrados[i].id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forzar: true }),
        })
      } catch { /* continuar */ }
      if (i < documentosFiltrados.length - 1) await new Promise((r) => setTimeout(r, 400))
    }
    setProgresoActMeta(null)
    setActualizandoMetaLote(false)
    cargar()
  }

  async function ocrTodosSecuencial() {
    const conError = documentosFiltrados.filter((d) => d.estado === 'error')
    if (!conError.length || ocrLoteActivo) return
    setOcrLoteActivo(true)
    setProgresoOcrLote({ actual: 0, total: conError.length })
    for (let i = 0; i < conError.length; i++) {
      setProgresoOcrLote({ actual: i, total: conError.length })
      const fn = indexarRefs.current[conError[i].id]
      if (fn) await (fn as () => Promise<void>)()
      if (i < conError.length - 1) await new Promise((r) => setTimeout(r, 3000))
    }
    setProgresoOcrLote(null)
    setOcrLoteActivo(false)
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

  async function crearCarpeta(datos: { nombre: string; color: Carpeta['color']; descripcion?: string }) {
    const res = await fetch('/api/carpetas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...datos, carpetaPadreId: modalCarpeta?.padreId }),
    })
    const nueva = await res.json()
    if (!nueva.error) {
      setCarpetas((prev) => {
        const actualizada = nueva.carpetaPadreId
          ? prev.map((c) => c.id === nueva.carpetaPadreId
              ? { ...c, subcarpetasIds: [...c.subcarpetasIds, nueva.id] }
              : c)
          : prev
        return [...actualizada, nueva]
      })
    }
    setModalCarpeta(null)
  }

  async function editarCarpeta(id: string, datos: { nombre: string; color: Carpeta['color']; descripcion?: string }) {
    const res = await fetch(`/api/carpetas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    const actualizada = await res.json()
    if (!actualizada.error) setCarpetas((prev) => prev.map((c) => c.id === id ? actualizada : c))
    setModalCarpeta(null)
  }

  async function eliminarCarpeta(id: string) {
    if (!confirm('¿Eliminar esta carpeta? Los documentos quedan sin carpeta.')) return
    await fetch(`/api/carpetas/${id}`, { method: 'DELETE' })
    setCarpetas((prev) => prev.filter((c) => c.id !== id))
    setDocumentos((prev) => prev.map((d) => d.carpetaId === id ? { ...d, carpetaId: undefined } : d))
    if (carpetaActiva === id) setCarpetaActiva(null)
    setMenuCarpeta(null)
  }

  async function moverDocumento(documentoId: string, carpetaId: string | null) {
    const carpetaIdStr = carpetaId ?? 'sin-carpeta'
    await fetch(`/api/carpetas/${carpetaIdStr}/mover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentoId }),
    })
    setDocumentos((prev) =>
      prev.map((d) => d.id === documentoId ? { ...d, carpetaId: carpetaId ?? undefined } : d)
    )
    setMoviendo(null)
  }

  function toggleSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function salirModoSeleccion() {
    setModoSeleccion(false)
    setSeleccionados(new Set())
  }

  async function eliminarSeleccionados() {
    if (!seleccionados.size) return
    const n = seleccionados.size
    if (!confirm(`¿Eliminar ${n} documento${n !== 1 ? 's' : ''}? Los archivos irán a la papelera de Google Drive.`)) return
    setEliminandoLote(true)
    try {
      await fetch('/api/drive/pdfs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(seleccionados) }),
      })
      setDocumentos((prev) => prev.filter((d) => !seleccionados.has(d.id)))
      salirModoSeleccion()
    } finally {
      setEliminandoLote(false)
    }
  }

  async function eliminarDocumento(doc: Documento) {
    const nombre = (doc.nombre.split('/').pop() ?? doc.nombre).replace(/\.pdf$/i, '')
    if (!confirm(`¿Eliminar "${nombre}"? El archivo irá a la papelera de Google Drive.`)) return
    await fetch('/api/drive/pdfs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [doc.id] }),
    })
    setDocumentos((prev) => prev.filter((d) => d.id !== doc.id))
  }

  async function eliminarCarpetaConDocumentos(id: string) {
    const subtreeIds = getSubtreeIds(id, carpetas)
    const docsEnSubarbol = documentos.filter((d) => d.carpetaId && subtreeIds.includes(d.carpetaId))
    const n = docsEnSubarbol.length
    if (!confirm(`¿Eliminar esta carpeta${n > 0 ? ` y sus ${n} documento${n !== 1 ? 's' : ''}` : ''}? Los archivos irán a la papelera de Google Drive.`)) return

    if (n > 0) {
      await fetch('/api/drive/pdfs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: docsEnSubarbol.map((d) => d.id) }),
      })
    }

    await fetch(`/api/carpetas/${id}?subtree=true`, { method: 'DELETE' })

    const subtreeSet = new Set(subtreeIds)
    setCarpetas((prev) =>
      prev
        .filter((c) => !subtreeSet.has(c.id))
        .map((c) => ({ ...c, subcarpetasIds: c.subcarpetasIds.filter((sid) => !subtreeSet.has(sid)) }))
    )
    setDocumentos((prev) => prev.filter((d) => !d.carpetaId || !subtreeSet.has(d.carpetaId)))
    if (carpetaActiva && subtreeSet.has(carpetaActiva)) setCarpetaActiva(null)
  }

  // Documentos filtrados por carpeta activa (incluye subcarpetas)
  const documentosFiltrados = (() => {
    if (carpetaActiva === 'sin-carpeta') return documentos.filter((d) => !d.carpetaId)
    if (!carpetaActiva) return documentos
    const ids = new Set(getSubtreeIds(carpetaActiva, carpetas))
    return documentos.filter((d) => d.carpetaId && ids.has(d.carpetaId))
  })()

  const sinIndexar = documentosFiltrados.filter((d) => d.estado === 'sin_indexar').length
  const conError = documentosFiltrados.filter((d) => d.estado === 'error').length
  const sinMetadatos = documentosFiltrados.filter((d) => !d.autor && !d.año).length
  const sinCarpeta = documentos.filter((d) => !d.carpetaId).length

  return (
    <div
      className="-m-4 md:-m-6 flex h-full overflow-hidden"
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); subirArchivos(e.dataTransfer.files) }}
    >
      {/* Panel de carpetas */}
      <div
        className="hidden flex-shrink-0 overflow-hidden bg-neutral-950 transition-[width] duration-200 md:block"
        style={{ width: sidebarAbierto ? panelWidth : 0 }}
      >
        <div className="flex h-full flex-col overflow-y-auto p-3" style={{ width: panelWidth }}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-600">Carpetas</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTodosColapsados((v) => !v)}
              className="rounded p-0.5 text-neutral-600 hover:text-neutral-300"
              title={todosColapsados ? 'Expandir todo' : 'Colapsar todo'}
            >
              {todosColapsados
                ? <ChevronsUpDown className="h-3.5 w-3.5" />
                : <ChevronsDownUp className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setModalCarpeta({})} className="rounded p-0.5 text-neutral-600 hover:text-neutral-300" title="Nueva carpeta">
              <FolderPlus className="h-4 w-4" />
            </button>
            <button onClick={() => setSidebarAbierto(false)} className="rounded p-0.5 text-neutral-600 hover:text-neutral-300" title="Colapsar panel">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Todas */}
        <button
          onClick={() => setCarpetaActiva(null)}
          className={`mb-0.5 flex items-center justify-between rounded-lg px-2 py-2 text-sm ${carpetaActiva === null ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}`}
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-neutral-500" />
            <span>Todos</span>
          </div>
          <span className="text-xs text-neutral-600">{documentos.length}</span>
        </button>

        {/* Sin carpeta */}
        {sinCarpeta > 0 && (
          <button
            onClick={() => setCarpetaActiva('sin-carpeta')}
            className={`mb-0.5 flex items-center justify-between rounded-lg px-2 py-2 text-sm ${carpetaActiva === 'sin-carpeta' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}`}
          >
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-neutral-600" />
              <span>Sin carpeta</span>
            </div>
            <span className="text-xs text-neutral-600">{sinCarpeta}</span>
          </button>
        )}

        {/* Árbol de carpetas */}
        {carpetas.filter((c) => !c.carpetaPadreId).map((c) => (
          <CarpetaItem
            key={c.id}
            carpeta={c}
            depth={0}
            carpetas={carpetas}
            documentos={documentos}
            carpetaActiva={carpetaActiva}
            menuCarpeta={menuCarpeta}
            colapsoGlobal={todosColapsados}
            onSelect={(id) => setCarpetaActiva(carpetaActiva === id ? null : id)}
            onMenuToggle={setMenuCarpeta}
            onNuevaSubcarpeta={(padreId) => setModalCarpeta({ padreId })}
            onEditar={(c) => setModalCarpeta({ carpeta: c })}
            onEliminar={eliminarCarpeta}
            onEliminarConArchivos={eliminarCarpetaConDocumentos}
          />
        ))}

        <button
          onClick={() => setModalCarpeta({})}
          className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-neutral-800 px-2 py-2 text-xs text-neutral-600 hover:border-neutral-700 hover:text-neutral-400"
        >
          <FolderPlus className="h-3.5 w-3.5" /> Nueva carpeta
        </button>
        </div>
      </div>

      {/* Drag handle redimensionable */}
      {sidebarAbierto && (
        <div
          onMouseDown={onPanelDragStart}
          className="group hidden w-1.5 flex-shrink-0 cursor-col-resize bg-neutral-800 hover:bg-blue-500/50 transition-colors md:block"
          title="Arrastrar para redimensionar"
        />
      )}

      {/* Área principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Barra superior */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {!sidebarAbierto && (
              <button onClick={() => setSidebarAbierto(true)} className="hidden rounded p-1 text-neutral-600 hover:text-neutral-300 md:block" title="Expandir panel">
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
            <h1 className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-sm font-semibold text-white">
              {(() => {
                if (!carpetaActiva || carpetaActiva === 'sin-carpeta') {
                  return <span className="text-base">{carpetaActiva === 'sin-carpeta' ? 'Sin carpeta' : 'Biblioteca'}</span>
                }
                const ruta = getRuta(carpetaActiva, carpetas)
                const truncada = ruta.length > 3
                const visible = truncada ? ruta.slice(-2) : ruta
                return (
                  <>
                    {truncada && (
                      <span className="flex items-center gap-1 text-neutral-600">
                        <span className="text-xs">…</span>
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    )}
                    {visible.map((c, i, arr) => (
                      <span key={c.id} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight className="h-3 w-3 text-neutral-600" />}
                        <button
                          onClick={() => setCarpetaActiva(c.id)}
                          className={`truncate ${i === arr.length - 1 ? 'max-w-[200px] text-white' : 'max-w-[120px] text-neutral-400 hover:text-white'}`}
                          title={c.nombre}
                        >
                          {c.nombre}
                        </button>
                      </span>
                    ))}
                  </>
                )
              })()}
            </h1>
            <p className="text-xs text-neutral-500">
              {documentosFiltrados.length} documento{documentosFiltrados.length !== 1 ? 's' : ''}
              {sinIndexar > 0 && ` · ${sinIndexar} sin indexar`}
            </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {/* Reload */}
            <button
              onClick={cargar}
              disabled={cargando}
              title="Recargar"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
            </button>

            {/* Toggle vista */}
            <div className="flex overflow-hidden rounded-lg border border-neutral-700">
              <button onClick={() => setVista('lista')} title="Vista lista" className={`flex h-9 w-9 items-center justify-center ${vista === 'lista' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
                <LayoutList className="h-4 w-4" />
              </button>
              <button onClick={() => setVista('grilla')} title="Vista grilla" className={`flex h-9 w-9 items-center justify-center ${vista === 'grilla' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>

            {/* Seleccionar */}
            {!modoSeleccion && (
              <button
                onClick={() => setModoSeleccion(true)}
                title="Seleccionar documentos"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-white"
              >
                <CheckSquare2 className="h-4 w-4" />
              </button>
            )}

            {/* Dropdown Herramientas */}
            <div className="relative" ref={herramientasRef}>
              <button
                onClick={() => setMenuHerramientas((v) => !v)}
                className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors ${menuHerramientas ? 'border-neutral-500 bg-neutral-800 text-white' : 'border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-white'}`}
              >
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">Herramientas</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${menuHerramientas ? 'rotate-180' : ''}`} />
              </button>

              {menuHerramientas && (
                <div className="absolute right-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
                  <div className="p-1.5 space-y-0.5">

                    {/* Indexar pendientes */}
                    <button
                      onClick={() => { setMenuHerramientas(false); indexarTodosSecuencial(documentosFiltrados.filter((d) => d.estado === 'sin_indexar' || d.estado === 'error')) }}
                      disabled={indexandoLote || sinIndexar === 0}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-neutral-800 disabled:opacity-40"
                    >
                      <Zap className={`h-4 w-4 flex-shrink-0 text-blue-400 ${indexandoLote ? 'animate-pulse' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">
                          {indexandoLote && progresoLote ? `Indexando ${progresoLote.actual + 1}/${progresoLote.total}…` : 'Indexar pendientes'}
                        </p>
                        <p className="text-xs text-neutral-500">{sinIndexar} sin indexar</p>
                      </div>
                    </button>

                    {/* OCR */}
                    <button
                      onClick={() => { setMenuHerramientas(false); ocrTodosSecuencial() }}
                      disabled={ocrLoteActivo || conError === 0}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-neutral-800 disabled:opacity-40"
                    >
                      <ScanText className={`h-4 w-4 flex-shrink-0 text-orange-400 ${ocrLoteActivo ? 'animate-pulse' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{ocrLoteActivo && progresoOcrLote ? `OCR ${progresoOcrLote.actual + 1}/${progresoOcrLote.total}…` : 'OCR + Reindexar errores'}</p>
                        <p className="text-xs text-neutral-500">{conError} con error</p>
                      </div>
                    </button>

                    <div className="my-1 border-t border-neutral-800" />

                    {/* Extraer metadatos vacíos */}
                    <button
                      onClick={() => { setMenuHerramientas(false); extraerMetadatosLote() }}
                      disabled={extrayendoMeta || sinMetadatos === 0}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-neutral-800 disabled:opacity-40"
                    >
                      <ScanSearch className={`h-4 w-4 flex-shrink-0 text-teal-400 ${extrayendoMeta ? 'animate-pulse' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{extrayendoMeta && progresoMeta ? `Extrayendo ${progresoMeta.actual}/${progresoMeta.total}…` : 'Extraer metadatos vacíos'}</p>
                        <p className="text-xs text-neutral-500">{sinMetadatos} sin autor/año</p>
                      </div>
                    </button>

                    {/* Actualizar todos los metadatos */}
                    <button
                      onClick={() => { setMenuHerramientas(false); actualizarMetadatosLote() }}
                      disabled={actualizandoMetaLote || documentosFiltrados.length === 0}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-neutral-800 disabled:opacity-40"
                    >
                      <RefreshCw className={`h-4 w-4 flex-shrink-0 text-violet-400 ${actualizandoMetaLote ? 'animate-spin' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{actualizandoMetaLote && progresoActMeta ? `Actualizando ${progresoActMeta.actual}/${progresoActMeta.total}…` : 'Actualizar todos los metadatos'}</p>
                        <p className="text-xs text-neutral-500">Sobrescribe con datos frescos (CrossRef)</p>
                      </div>
                    </button>

                    <div className="my-1 border-t border-neutral-800" />

                    {/* Pipeline */}
                    <button
                      onClick={() => { setMenuHerramientas(false); setShowPipeline(true) }}
                      disabled={documentosFiltrados.filter((d) => d.estado === 'indexado').length === 0}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-neutral-800 disabled:opacity-40"
                    >
                      <Wand2 className="h-4 w-4 flex-shrink-0 text-purple-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">Procesar biblioteca</p>
                        <p className="text-xs text-neutral-500">Fichas + notas + citas + vínculos</p>
                      </div>
                    </button>

                    {/* Importar carpeta */}
                    <button
                      onClick={() => { setMenuHerramientas(false); setModalImportarCarpeta(true) }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-neutral-800"
                    >
                      <FolderInput className="h-4 w-4 flex-shrink-0 text-neutral-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">Importar carpeta</p>
                        <p className="text-xs text-neutral-500">Subir varios PDFs desde carpeta local</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Subir PDF — botón principal siempre visible */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={subiendo}
              className="flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 text-sm font-medium text-white hover:from-blue-500 hover:to-violet-500 shadow-md shadow-violet-900/30 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              <span>{subiendo ? 'Subiendo…' : 'Subir PDF'}</span>
            </button>
            <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => e.target.files && subirArchivos(e.target.files)} />
          </div>
        </div>

        {/* Barra de selección */}
        {modoSeleccion && (
          <div className="flex items-center gap-3 border-b border-neutral-800 bg-neutral-950 px-6 py-2.5">
            <span className="text-sm text-neutral-400">
              {seleccionados.size > 0 ? `${seleccionados.size} seleccionado${seleccionados.size !== 1 ? 's' : ''}` : 'Ninguno seleccionado'}
            </span>
            <button
              onClick={() => setSeleccionados(new Set(documentosFiltrados.map((d) => d.id)))}
              className="text-xs text-blue-400 hover:underline"
            >
              Todo
            </button>
            {seleccionados.size > 0 && (
              <button onClick={() => setSeleccionados(new Set())} className="text-xs text-neutral-500 hover:underline">
                Limpiar
              </button>
            )}
            <div className="ml-auto flex gap-2">
              <button onClick={salirModoSeleccion} className="rounded-lg px-3 py-1.5 text-sm text-neutral-400 hover:text-white">
                Cancelar
              </button>
              <button
                onClick={eliminarSeleccionados}
                disabled={!seleccionados.size || eliminandoLote}
                className="flex items-center gap-1.5 rounded-lg border border-red-800 bg-red-950/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {eliminandoLote ? 'Eliminando…' : `Eliminar (${seleccionados.size})`}
              </button>
            </div>
          </div>
        )}

        {/* Errores */}
        <div className="px-6">
          {errorCarga && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{errorCarga}</span>
            </div>
          )}
          {errorSubida && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{errorSubida}</span>
              <button onClick={() => setErrorSubida(null)} className="ml-auto text-xs underline">Cerrar</button>
            </div>
          )}
        </div>

        {/* Contenido principal */}
        <div className={`flex-1 overflow-y-auto ${vista === 'lista' ? 'p-0' : 'p-6'}`}>
          {dragging && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm">
              <div className="rounded-2xl border-2 border-dashed border-blue-500 bg-neutral-900 p-16 text-center">
                <Upload className="mx-auto h-12 w-12 text-blue-400" />
                <p className="mt-4 text-lg font-medium text-white">Soltá los PDFs aquí</p>
              </div>
            </div>
          )}

          {!cargando && documentosFiltrados.length === 0 && (
            <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-700 py-20 ${vista === 'lista' ? 'mx-6 mt-6' : ''}`}>
              <Upload className="h-10 w-10 text-neutral-600" />
              <p className="mt-3 text-sm font-medium text-neutral-400">
                {carpetaActiva ? 'Esta carpeta está vacía' : 'No hay documentos todavía'}
              </p>
              {!carpetaActiva && (
                <button onClick={() => fileInputRef.current?.click()} className="mt-5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-500 hover:to-violet-500 shadow-md shadow-violet-900/30">
                  Subir primer PDF
                </button>
              )}
              {carpetaActiva && (
                <p className="mt-2 text-xs text-neutral-600">
                  Subí un PDF y usá "Mover a carpeta" para asignarlo aquí.
                </p>
              )}
            </div>
          )}

          {cargando && (
            vista === 'lista' ? (
              <div className="space-y-0">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-neutral-800/50 px-4 py-2.5">
                    <div className="h-4 w-4 animate-pulse rounded bg-neutral-800" />
                    <div className="h-3 flex-1 animate-pulse rounded bg-neutral-800" />
                    <div className="h-3 w-32 animate-pulse rounded bg-neutral-800" />
                    <div className="h-3 w-24 animate-pulse rounded bg-neutral-800" />
                    <div className="h-5 w-20 animate-pulse rounded-full bg-neutral-800" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900" />
                ))}
              </div>
            )
          )}

          {!cargando && documentosFiltrados.length > 0 && (
            vista === 'lista' ? (
              <div>
                {/* Cabecera de columnas */}
                <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-800 bg-neutral-950/95 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-neutral-600 backdrop-blur">
                  {modoSeleccion && <div className="h-4 w-4 flex-shrink-0" />}
                  <div className="h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0 flex-1">Nombre</div>
                  <div className="w-40 flex-shrink-0">Autor</div>
                  <div className="w-32 flex-shrink-0">Carpeta</div>
                  <div className="w-24 flex-shrink-0">Estado</div>
                  <div className="w-14 flex-shrink-0">Ficha</div>
                  <div className="w-16 flex-shrink-0 text-right">Frags.</div>
                  {!modoSeleccion && <div className="w-16 flex-shrink-0" />}
                </div>
                {documentosFiltrados.map((doc) => (
                  <DocumentoCard
                    key={doc.id}
                    documento={doc}
                    carpeta={carpetas.find((c) => c.id === doc.carpetaId)}
                    onEditar={() => setEditando(doc)}
                    onMover={() => setMoviendo(doc)}
                    onEliminar={() => eliminarDocumento(doc)}
                    onIndexadoOk={onDocumentIndexado}
                    onRegistrarIndexar={(fn) => { indexarRefs.current[doc.id] = fn }}
                    onMetadatosExtraidos={onMetadatosExtraidos}
                    modoSeleccion={modoSeleccion}
                    seleccionado={seleccionados.has(doc.id)}
                    onToggleSeleccion={() => toggleSeleccion(doc.id)}
                    vista="lista"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {documentosFiltrados.map((doc) => (
                  <DocumentoCard
                    key={doc.id}
                    documento={doc}
                    carpeta={carpetas.find((c) => c.id === doc.carpetaId)}
                    onEditar={() => setEditando(doc)}
                    onMover={() => setMoviendo(doc)}
                    onEliminar={() => eliminarDocumento(doc)}
                    onIndexadoOk={onDocumentIndexado}
                    onRegistrarIndexar={(fn) => { indexarRefs.current[doc.id] = fn }}
                    onMetadatosExtraidos={onMetadatosExtraidos}
                    modoSeleccion={modoSeleccion}
                    seleccionado={seleccionados.has(doc.id)}
                    onToggleSeleccion={() => toggleSeleccion(doc.id)}
                    vista="grilla"
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Modales */}
      {modalCarpeta !== null && (
        <CarpetaModal
          carpeta={modalCarpeta.carpeta}
          onGuardar={(datos) =>
            modalCarpeta.carpeta ? editarCarpeta(modalCarpeta.carpeta.id, datos) : crearCarpeta(datos)
          }
          onCerrar={() => setModalCarpeta(null)}
        />
      )}

      {moviendo && (
        <MoverModal
          documento={moviendo}
          carpetas={carpetas}
          onMover={(carpetaId) => moverDocumento(moviendo.id, carpetaId)}
          onCerrar={() => setMoviendo(null)}
        />
      )}

      {editando && (
        <MetadatosModal
          documento={editando}
          onGuardar={(datos) => guardarMetadatos(editando.id, datos)}
          onActualizar={async () => {
            const docId = editando.id
            const res = await fetch(`/api/metadatos/${docId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ forzar: true }),
            })
            const data = await res.json()
            if (data.ok) {
              cargar()
              setEditando(null)
            }
          }}
          onCerrar={() => setEditando(null)}
        />
      )}

      {modalImportarCarpeta && (
        <ImportarCarpetaModal
          onCerrar={() => setModalImportarCarpeta(false)}
          onTerminado={() => { cargar() }}
        />
      )}

      {showPipeline && (
        <PipelineModal
          documentos={documentosFiltrados}
          onCerrar={() => setShowPipeline(false)}
          onTerminado={() => { cargar() }}
        />
      )}

      {/* Cerrar menú al hacer clic fuera */}
      {menuCarpeta && (
        <div className="fixed inset-0 z-0" onClick={() => setMenuCarpeta(null)} />
      )}
    </div>
  )
}
