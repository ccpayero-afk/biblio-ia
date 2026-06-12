'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Upload, BookOpen, Sparkles, Loader2, FileText, ChevronRight,
  ArrowRight, StickyNote, CheckSquare, Eye, RefreshCw, MoveRight,
  Search, X, Check, Pencil,
} from 'lucide-react'
import { Documento } from '@/types'

interface GuiaLectura {
  documentoId: string
  orientacionGeneral: string
  preguntasGuia: string[]
  conceptosARastrear: string[]
  estrategiaLectura: string
  conexionesPosibes: string
  checklistPostLectura: string[]
  generadaEn: string
}

const shortName = (nombre: string) =>
  (nombre.split('/').pop() ?? nombre).replace(/\.pdf$/i, '')

// ─── Panel izquierdo: lista ────────────────────────────────────────────────────

function ListaPDFs({
  docs,
  docSelId,
  onSeleccionar,
  onSubir,
  subiendo,
  busqueda,
  setBusqueda,
}: {
  docs: Documento[]
  docSelId: string | null
  onSeleccionar: (id: string) => void
  onSubir: (file: File) => void
  subiendo: boolean
  busqueda: string
  setBusqueda: (v: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const docsFiltrados = docs.filter((d) =>
    busqueda
      ? shortName(d.nombre).toLowerCase().includes(busqueda.toLowerCase()) ||
        (d.autor ?? '').toLowerCase().includes(busqueda.toLowerCase())
      : true
  )

  return (
    <div className="flex h-full flex-col border-r border-neutral-800">
      {/* Upload */}
      <div className="border-b border-neutral-800 p-3 space-y-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-700 py-2.5 text-xs text-neutral-400 hover:border-violet-600 hover:text-violet-400 disabled:opacity-50 transition-colors"
        >
          {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {subiendo ? 'Subiendo…' : 'Subir PDF para leer'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onSubir(f)
            e.target.value = ''
          }}
        />
        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-600" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar…"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-1.5 pl-7 pr-3 text-xs text-neutral-300 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {docs.length === 0 && !subiendo && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <BookOpen className="h-8 w-8 text-neutral-700 mb-3" />
            <p className="text-xs text-neutral-500">Subí PDFs que querés leer</p>
            <p className="text-xs text-neutral-700 mt-1">Aparecerán acá hasta que los pases a Biblioteca</p>
          </div>
        )}
        {docsFiltrados.map((doc) => (
          <button
            key={doc.id}
            onClick={() => onSeleccionar(doc.id)}
            className={`block w-full border-b border-neutral-800/50 px-4 py-3 text-left transition-colors hover:bg-neutral-900 ${docSelId === doc.id ? 'bg-neutral-900' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 flex-1 text-xs font-medium text-neutral-200 leading-snug">
                {shortName(doc.nombre)}
              </p>
              <span
                className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${doc.estado === 'indexado' ? 'bg-emerald-500' : 'bg-neutral-700'}`}
                title={doc.estado === 'indexado' ? 'Indexado' : 'Sin indexar'}
              />
            </div>
            <p className="mt-0.5 truncate text-xs text-neutral-600">
              {doc.autor || 'Sin autor'}{doc.año ? ` · ${doc.año}` : ''}
            </p>
          </button>
        ))}
      </div>

      <div className="border-t border-neutral-800 px-4 py-2">
        <p className="text-xs text-neutral-700">{docs.length} PDF{docs.length !== 1 ? 's' : ''} por leer</p>
      </div>
    </div>
  )
}

// ─── Panel derecho: herramientas ───────────────────────────────────────────────

function PanelHerramientas({
  doc,
  guia,
  onRecargar,
}: {
  doc: Documento
  guia: GuiaLectura | null
  onRecargar: () => void
}) {
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [meta, setMeta] = useState({ autor: doc.autor || '', año: doc.año || '' })
  const [guardandoMeta, setGuardandoMeta] = useState(false)

  const [indexando, setIndexando] = useState(false)
  const [indexMsg, setIndexMsg] = useState<string | null>(null)
  const [indexDone, setIndexDone] = useState(doc.estado === 'indexado')

  const [generandoGuia, setGenerandoGuia] = useState(false)
  const [guiaLocal, setGuiaLocal] = useState<GuiaLectura | null>(guia)
  const [guiaError, setGuiaError] = useState<string | null>(null)

  const [extrayendoNotas, setExtrayendoNotas] = useState(false)
  const [notasMsg, setNotasMsg] = useState<string | null>(null)

  const [moviendoABibl, setMoviendoABibl] = useState(false)
  const [movido, setMovido] = useState(false)

  const [checklist, setChecklist] = useState<boolean[]>([])
  useEffect(() => {
    if (guiaLocal?.checklistPostLectura) {
      setChecklist(new Array(guiaLocal.checklistPostLectura.length).fill(false))
    }
  }, [guiaLocal])

  async function guardarMeta() {
    setGuardandoMeta(true)
    await fetch(`/api/drive/metadata/${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autor: meta.autor, año: meta.año }),
    })
    setGuardandoMeta(false)
    setEditandoMeta(false)
    onRecargar()
  }

  async function indexar() {
    setIndexando(true)
    setIndexMsg('Iniciando…')
    const res = await fetch(`/api/index/${doc.id}`, { method: 'POST' })
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const ev = JSON.parse(line.slice(6))
          if (ev.error) { setIndexMsg(`Error: ${ev.error}`); setIndexando(false); return }
          if (ev.done) { setIndexMsg(`Indexado: ${ev.fragmentos} fragmentos`); setIndexDone(true); setIndexando(false); onRecargar(); return }
          if (ev.msg) setIndexMsg(`${ev.msg} (${ev.paso}/${ev.total})`)
        } catch {}
      }
    }
    setIndexando(false)
  }

  async function generarGuia() {
    setGenerandoGuia(true)
    setGuiaError(null)
    try {
      const res = await fetch(`/api/sala-lectura/${doc.id}/guia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentoNombre: doc.nombre, autor: doc.autor, año: doc.año }),
      })
      const data = await res.json()
      if (data.error) { setGuiaError(data.error) } else { setGuiaLocal(data) }
    } catch (e) { setGuiaError(String(e)) }
    setGenerandoGuia(false)
  }

  async function extraerNotas() {
    setExtrayendoNotas(true)
    setNotasMsg(null)
    try {
      const res = await fetch(`/api/sala-lectura/${doc.id}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentoNombre: doc.nombre, autor: doc.autor, año: doc.año }),
      })
      const data = await res.json()
      if (data.error) { setNotasMsg(`Error: ${data.error}`) }
      else { setNotasMsg(`${data.creadas} notas creadas en Notas`) }
    } catch (e) { setNotasMsg(String(e)) }
    setExtrayendoNotas(false)
  }

  async function moverABiblioteca() {
    if (!confirm('¿Mover este PDF a Biblioteca? Desaparecerá de la Sala de Lectura.')) return
    setMoviendoABibl(true)
    try {
      await fetch(`/api/sala-lectura/${doc.id}/mover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      setMovido(true)
      onRecargar()
    } catch (e) { alert(String(e)) }
    setMoviendoABibl(false)
  }

  if (movido) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <Check className="h-10 w-10 text-emerald-500 mb-3" />
        <p className="text-sm text-neutral-300 font-medium">Movido a Biblioteca</p>
        <Link href="/biblioteca" className="mt-3 text-xs text-blue-400 hover:underline">Ir a Biblioteca →</Link>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header del documento */}
      <div className="flex items-start justify-between gap-4 border-b border-neutral-800 px-6 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-white leading-snug line-clamp-2">
            {shortName(doc.nombre)}
          </h2>
          {editandoMeta ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                value={meta.autor}
                onChange={(e) => setMeta((p) => ({ ...p, autor: e.target.value }))}
                placeholder="Autor"
                className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:border-violet-600"
              />
              <input
                value={meta.año}
                onChange={(e) => setMeta((p) => ({ ...p, año: e.target.value }))}
                placeholder="Año"
                className="w-20 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:border-violet-600"
              />
              <button
                onClick={guardarMeta}
                disabled={guardandoMeta}
                className="rounded bg-violet-700 px-2 py-1 text-xs text-white hover:bg-violet-600 disabled:opacity-50"
              >
                {guardandoMeta ? '…' : 'Guardar'}
              </button>
              <button onClick={() => setEditandoMeta(false)} className="text-neutral-600 hover:text-neutral-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-0.5 flex items-center gap-2">
              <p className="text-sm text-neutral-500">
                {doc.autor || 'Sin autor'}{doc.año ? ` · ${doc.año}` : ''}
              </p>
              <button
                onClick={() => { setMeta({ autor: doc.autor || '', año: doc.año || '' }); setEditandoMeta(true) }}
                className="text-neutral-700 hover:text-neutral-400"
                title="Editar metadatos"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${indexDone ? 'bg-emerald-950 text-emerald-400' : 'bg-neutral-800 text-neutral-500'}`}>
            {indexDone ? 'Indexado' : 'Sin indexar'}
          </span>
        </div>
      </div>

      {/* Herramientas */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* Acciones rápidas */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/lector/${doc.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-blue-600 hover:text-blue-400 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> Abrir lector
          </Link>
          <Link
            href={`/fichas`}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-violet-600 hover:text-violet-400 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" /> Ir a Fichas
          </Link>
        </div>

        {/* Indexación */}
        <Section titulo="1. Indexar documento" icono={<ArrowRight className="h-4 w-4 text-neutral-600" />}>
          <p className="text-xs text-neutral-500 mb-3">
            Indexá el texto para habilitar la Guía de Lectura, extracción de notas y generación de fichas.
          </p>
          {indexMsg && (
            <p className={`mb-2 text-xs ${indexMsg.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
              {indexMsg}
            </p>
          )}
          <button
            onClick={indexar}
            disabled={indexando || indexDone}
            className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-emerald-600 hover:text-emerald-400 disabled:opacity-40 transition-colors"
          >
            {indexando
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : indexDone
              ? <Check className="h-3.5 w-3.5 text-emerald-500" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            {indexando ? 'Indexando…' : indexDone ? 'Ya indexado' : 'Indexar'}
          </button>
        </Section>

        {/* Guía de Lectura */}
        <Section titulo="2. Guía de Lectura" icono={<BookOpen className="h-4 w-4 text-violet-500" />}>
          <p className="text-xs text-neutral-500 mb-3">
            La IA genera una orientación para abordar el texto: contexto, preguntas guía, conceptos a rastrear y estrategia de lectura.
          </p>

          {guiaError && (
            <div className="mb-3 rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2 text-xs text-red-400">
              {guiaError}
            </div>
          )}

          <button
            onClick={generarGuia}
            disabled={generandoGuia}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-700 to-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:from-violet-600 hover:to-blue-600 disabled:opacity-40 transition-colors mb-4"
          >
            {generandoGuia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {guiaLocal ? 'Regenerar guía' : 'Generar guía de lectura'}
          </button>

          {guiaLocal && (
            <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
              {guiaLocal.orientacionGeneral && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Orientación general</p>
                  <p className="text-sm text-neutral-300 leading-relaxed">{guiaLocal.orientacionGeneral}</p>
                </div>
              )}

              {guiaLocal.preguntasGuia?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Preguntas guía</p>
                  <ul className="space-y-1.5">
                    {guiaLocal.preguntasGuia.map((q, i) => (
                      <li key={i} className="flex gap-2 text-sm text-neutral-300">
                        <span className="text-violet-400 flex-shrink-0">?</span>{q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {guiaLocal.conceptosARastrear?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Conceptos a rastrear</p>
                  <div className="flex flex-wrap gap-1.5">
                    {guiaLocal.conceptosARastrear.map((c, i) => (
                      <span key={i} className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs text-neutral-400">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {guiaLocal.estrategiaLectura && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Estrategia de lectura</p>
                  <p className="text-sm text-neutral-300 leading-relaxed">{guiaLocal.estrategiaLectura}</p>
                </div>
              )}

              {guiaLocal.conexionesPosibes && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Conexiones posibles</p>
                  <p className="text-sm text-neutral-300 leading-relaxed">{guiaLocal.conexionesPosibes}</p>
                </div>
              )}

              {guiaLocal.checklistPostLectura?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Checklist post-lectura</p>
                  <ul className="space-y-1.5">
                    {guiaLocal.checklistPostLectura.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <button
                          onClick={() => setChecklist((p) => { const c = [...p]; c[i] = !c[i]; return c })}
                          className="mt-0.5 flex-shrink-0"
                        >
                          <CheckSquare className={`h-4 w-4 ${checklist[i] ? 'text-emerald-500' : 'text-neutral-700'}`} />
                        </button>
                        <span className={checklist[i] ? 'text-neutral-600 line-through' : 'text-neutral-300'}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-neutral-700 pt-1">
                Generada {new Date(guiaLocal.generadaEn).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
          )}
        </Section>

        {/* Extraer notas */}
        <Section titulo="3. Extraer notas Zettelkasten" icono={<StickyNote className="h-4 w-4 text-amber-500" />}>
          <p className="text-xs text-neutral-500 mb-3">
            La IA extrae entre 5 y 8 notas permanentes Zettelkasten del documento y las agrega a tu sección de Notas.
          </p>
          {notasMsg && (
            <p className={`mb-2 text-xs ${notasMsg.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
              {notasMsg}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={extraerNotas}
              disabled={extrayendoNotas || !indexDone}
              className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-amber-600 hover:text-amber-400 disabled:opacity-40 transition-colors"
            >
              {extrayendoNotas ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StickyNote className="h-3.5 w-3.5" />}
              {extrayendoNotas ? 'Extrayendo…' : 'Extraer notas'}
            </button>
            {notasMsg && !notasMsg.startsWith('Error') && (
              <Link href="/notas" className="text-xs text-blue-400 hover:underline">
                Ver en Notas →
              </Link>
            )}
          </div>
          {!indexDone && <p className="mt-1.5 text-xs text-neutral-700">Indexá el documento primero.</p>}
        </Section>

        {/* Pasar a Biblioteca */}
        <Section titulo="4. Pasar a Biblioteca" icono={<MoveRight className="h-4 w-4 text-emerald-500" />}>
          <p className="text-xs text-neutral-500 mb-3">
            Una vez procesado, mové el PDF a tu Biblioteca. Allí podrás generar la ficha completa, extraer citas y datos.
          </p>
          <button
            onClick={moverABiblioteca}
            disabled={moviendoABibl}
            className="flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-950/60 disabled:opacity-40 transition-colors"
          >
            {moviendoABibl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoveRight className="h-3.5 w-3.5" />}
            {moviendoABibl ? 'Moviendo…' : 'Mover a Biblioteca'}
          </button>
        </Section>
      </div>
    </div>
  )
}

function Section({
  titulo,
  icono,
  children,
}: {
  titulo: string
  icono?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icono}
        <h3 className="text-sm font-semibold text-neutral-200">{titulo}</h3>
      </div>
      {children}
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function SalaLecturaClient() {
  const [docs, setDocs] = useState<Documento[]>([])
  const [docSelId, setDocSelId] = useState<string | null>(null)
  const [guias, setGuias] = useState<Record<string, GuiaLectura | null>>({})
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/sala-lectura')
      const data = await res.json()
      if (Array.isArray(data)) setDocs(data)
    } catch {}
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function cargarGuia(docId: string) {
    if (guias[docId] !== undefined) return
    try {
      const res = await fetch(`/api/sala-lectura/${docId}/guia`)
      const data = await res.json()
      setGuias((p) => ({ ...p, [docId]: data }))
    } catch {
      setGuias((p) => ({ ...p, [docId]: null }))
    }
  }

  function seleccionar(id: string) {
    setDocSelId(id)
    cargarGuia(id)
  }

  async function subirPDF(file: File) {
    setSubiendo(true)
    const fd = new FormData()
    fd.append('file', file)
    await fetch('/api/sala-lectura', { method: 'POST', body: fd })
    await cargar()
    setSubiendo(false)
  }

  const docSel = docs.find((d) => d.id === docSelId) ?? null

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
      </div>
    )
  }

  return (
    <div className="-m-4 md:-m-6 flex h-full overflow-hidden">
      {/* Panel izquierdo */}
      <div className="w-72 flex-shrink-0">
        <ListaPDFs
          docs={docs}
          docSelId={docSelId}
          onSeleccionar={seleccionar}
          onSubir={subirPDF}
          subiendo={subiendo}
          busqueda={busqueda}
          setBusqueda={setBusqueda}
        />
      </div>

      {/* Panel derecho */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {docSel ? (
          <PanelHerramientas
            key={docSel.id}
            doc={docSel}
            guia={guias[docSel.id] ?? null}
            onRecargar={cargar}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center px-8">
            <BookOpen className="h-12 w-12 text-neutral-800 mb-4" />
            <h2 className="text-lg font-semibold text-white">Sala de Lectura</h2>
            <p className="mt-2 text-sm text-neutral-500 max-w-sm">
              Subí un PDF que querés leer. La IA te genera una guía de lectura, podés indexarlo, extraer notas y después moverlo a Biblioteca.
            </p>
            <div className="mt-6 flex flex-col gap-2 text-xs text-neutral-700">
              <div className="flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5" /> Subir PDF → Indexar</div>
              <div className="flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5" /> Generar guía de lectura</div>
              <div className="flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5" /> Leer + extraer notas</div>
              <div className="flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5" /> Pasar a Biblioteca</div>
            </div>
            <div className="mt-6">
              <ChevronRight className="h-4 w-4 text-neutral-800 mx-auto" />
              <p className="text-xs text-neutral-700 mt-1">Seleccioná un PDF de la lista</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
