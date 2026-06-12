'use client'

import { useEffect, useState, useCallback } from 'react'
import { FileText, Sparkles, Loader2, Search, ChevronRight, RefreshCw, BookOpen, Tag } from 'lucide-react'
import Link from 'next/link'
import { Documento, FichaLectura } from '@/types'

function esFichaValida(f: unknown): f is FichaLectura {
  return !!f && typeof f === 'object' && 'tesisCentral' in (f as object)
}

const shortName = (nombre: string) =>
  (nombre.split('/').pop() ?? nombre).replace(/\.pdf$/i, '')

type Filtro = 'todas' | 'con_ficha' | 'sin_ficha'

// ─── Panel detalle ────────────────────────────────────────────────────────────

function FichaDetalle({
  doc,
  ficha,
  cargando,
  error,
  onGenerar,
}: {
  doc: Documento
  ficha: FichaLectura | null
  cargando: boolean
  error: string | null
  onGenerar: () => void
}) {
  const titulo = shortName(doc.nombre)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-neutral-800 px-6 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white leading-snug">{titulo}</h2>
          <div className="mt-0.5 flex items-center gap-3">
            <p className="text-sm text-neutral-500">
              {doc.autor || 'Autor desconocido'}{doc.año ? ` · ${doc.año}` : ''}
            </p>
            <Link
              href={`/lector/${doc.id}`}
              className="flex items-center gap-1 text-xs text-neutral-600 hover:text-blue-400"
            >
              <BookOpen className="h-3.5 w-3.5" /> Abrir PDF
            </Link>
          </div>
        </div>
        <button
          onClick={onGenerar}
          disabled={cargando}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500 hover:text-white disabled:opacity-40"
        >
          {cargando
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5" />}
          {ficha ? 'Regenerar' : 'Generar ficha'}
        </button>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {cargando && !ficha && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
            <p className="mt-3 text-sm text-neutral-500">Generando ficha con IA…</p>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!ficha && !cargando && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpen className="h-10 w-10 text-neutral-700" />
            <p className="mt-4 text-sm text-neutral-500">
              Este documento no tiene ficha todavía.
            </p>
            <button
              onClick={onGenerar}
              className="mt-4 flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-500 hover:to-violet-500"
            >
              <Sparkles className="h-4 w-4" /> Generar ficha
            </button>
            {doc.estado !== 'indexado' && (
              <p className="mt-3 text-xs text-neutral-600">
                Este documento no está indexado. Indexalo primero en Biblioteca.
              </p>
            )}
          </div>
        )}

        {ficha && (
          <div className="space-y-5">
            <Section titulo="Tesis central" texto={ficha.tesisCentral} />
            {ficha.argumentoPrincipal !== ficha.tesisCentral && (
              <Section titulo="Argumento principal" texto={ficha.argumentoPrincipal} />
            )}
            <Section titulo="Posición en el debate" texto={ficha.posicionDebate} />
            {ficha.metodologia && <Section titulo="Metodología" texto={ficha.metodologia} />}

            {ficha.conceptosClave?.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Conceptos clave</h3>
                <div className="space-y-2">
                  {ficha.conceptosClave.map((ck, i) => (
                    <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-sm">
                      <span className="font-medium text-blue-400">{ck.concepto}</span>
                      {ck.definicion && <span className="ml-2 text-neutral-400">{ck.definicion}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(ficha.palabrasClave?.length ?? 0) > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Palabras clave</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(ficha.palabrasClave ?? []).map((k) => (
                    <span key={k} className="flex items-center gap-1 rounded-full bg-neutral-800 px-2.5 py-1 text-xs text-neutral-400">
                      <Tag className="h-3 w-3" />{k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {ficha.citasDestacadas?.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Citas destacadas</h3>
                <div className="space-y-2">
                  {ficha.citasDestacadas.map((c, i) => (
                    <blockquote key={i} className="border-l-2 border-neutral-700 pl-3 text-sm text-neutral-300 italic">
                      "{c.texto}"
                      <span className="ml-2 not-italic text-xs text-neutral-600">p.{c.pagina}</span>
                    </blockquote>
                  ))}
                </div>
              </div>
            )}

            {(ficha.referenciasCitadas?.length ?? 0) > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Referencias citadas en el texto</h3>
                <ul className="space-y-1">
                  {(ficha.referenciasCitadas ?? []).map((r, i) => (
                    <li key={i} className="text-sm text-neutral-400">· {r}</li>
                  ))}
                </ul>
              </div>
            )}

            {ficha.limitaciones && <Section titulo="Tensiones / limitaciones" texto={ficha.limitaciones} />}
            {ficha.relevancia && <Section titulo="Relevancia" texto={ficha.relevancia} />}

            <p className="pt-2 text-xs text-neutral-700">
              Generada {new Date(ficha.generadaEn).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ titulo, texto }: { titulo: string; texto: string }) {
  if (!texto?.trim()) return null
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">{titulo}</h3>
      <p className="text-sm text-neutral-300 leading-relaxed">{texto}</p>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FichasClient() {
  const [docs, setDocs] = useState<Documento[]>([])
  const [fichas, setFichas] = useState<Record<string, FichaLectura | null>>({})
  const [cargandoFicha, setCargandoFicha] = useState<Record<string, boolean>>({})
  const [errores, setErrores] = useState<Record<string, string | null>>({})
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [docSel, setDocSel] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/drive/pdfs')
      .then((r) => r.json())
      .then((data: Documento[]) => {
        if (!Array.isArray(data)) return
        setDocs(data)
        setCargando(false)
      })
      .catch(() => setCargando(false))
  }, [])

  const cargarFicha = useCallback(async (docId: string) => {
    if (fichas[docId] !== undefined) return   // ya cargada
    setCargandoFicha((p) => ({ ...p, [docId]: true }))
    try {
      const res = await fetch(`/api/fichas/${docId}`)
      const data = await res.json()
      setFichas((p) => ({ ...p, [docId]: esFichaValida(data) ? data : null }))
    } catch {
      setFichas((p) => ({ ...p, [docId]: null }))
    }
    setCargandoFicha((p) => ({ ...p, [docId]: false }))
  }, [fichas])

  function seleccionarDoc(docId: string) {
    setDocSel(docId)
    cargarFicha(docId)
  }

  async function generarFicha(doc: Documento) {
    setCargandoFicha((p) => ({ ...p, [doc.id]: true }))
    setErrores((p) => ({ ...p, [doc.id]: null }))
    try {
      const res = await fetch(`/api/fichas/${doc.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentoNombre: doc.nombre, autor: doc.autor, año: doc.año }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setErrores((p) => ({ ...p, [doc.id]: data.error ?? 'Error al generar' }))
      } else {
        setFichas((p) => ({ ...p, [doc.id]: esFichaValida(data) ? data : null }))
        setDocs((p) => p.map((d) => d.id === doc.id ? { ...d, fichaGenerada: true } : d))
      }
    } catch (e) {
      setErrores((p) => ({ ...p, [doc.id]: String(e) }))
    }
    setCargandoFicha((p) => ({ ...p, [doc.id]: false }))
  }

  // Filtros y búsqueda
  const docsFiltrados = docs.filter((d) => {
    if (filtro === 'con_ficha' && !d.fichaGenerada) return false
    if (filtro === 'sin_ficha' && d.fichaGenerada) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return (
        shortName(d.nombre).toLowerCase().includes(q) ||
        d.nombre.toLowerCase().includes(q) ||
        (d.autor ?? '').toLowerCase().includes(q) ||
        (d.año ?? '').includes(q)
      )
    }
    return true
  }).sort((a, b) => {
    // Con ficha primero
    if (a.fichaGenerada && !b.fichaGenerada) return -1
    if (!a.fichaGenerada && b.fichaGenerada) return 1
    return shortName(a.nombre).localeCompare(shortName(b.nombre))
  })

  const conFicha = docs.filter((d) => d.fichaGenerada).length
  const sinFicha = docs.length - conFicha
  const docSelObj = docs.find((d) => d.id === docSel) ?? null

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
      </div>
    )
  }

  if (!docs.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText className="h-12 w-12 text-neutral-700" />
        <h2 className="mt-4 text-lg font-semibold text-white">Sin documentos</h2>
        <p className="mt-2 text-sm text-neutral-500">Subí PDFs en la Biblioteca para generar fichas.</p>
      </div>
    )
  }

  return (
    <div className="-m-4 md:-m-6 flex h-full overflow-hidden">
      {/* Panel izquierdo: filtros + lista */}
      <div className="flex w-72 flex-shrink-0 flex-col border-r border-neutral-800">
        {/* Buscador */}
        <div className="border-b border-neutral-800 p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por título o autor…"
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-1.5 pl-8 pr-3 text-xs text-neutral-300 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Filtros */}
        <div className="flex border-b border-neutral-800 text-xs">
          {([
            ['todas', `Todas (${docs.length})`],
            ['con_ficha', `Con ficha (${conFicha})`],
            ['sin_ficha', `Sin ficha (${sinFicha})`],
          ] as [Filtro, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFiltro(key)}
              className={`flex-1 py-2 text-center transition-colors ${
                filtro === key
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {docsFiltrados.length === 0 && (
            <p className="p-4 text-center text-xs text-neutral-600">Sin resultados</p>
          )}
          {docsFiltrados.map((doc) => {
            const tieneFicha = doc.fichaGenerada
            const cargandoEsta = !!cargandoFicha[doc.id]
            const activo = docSel === doc.id
            return (
              <button
                key={doc.id}
                onClick={() => seleccionarDoc(doc.id)}
                className={`block w-full border-b border-neutral-800/50 px-4 py-3 text-left transition-colors hover:bg-neutral-900 ${activo ? 'bg-neutral-900' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 flex-1 text-xs font-medium text-neutral-200 leading-snug">
                    {shortName(doc.nombre)}
                  </p>
                  {cargandoEsta
                    ? <Loader2 className="mt-0.5 h-3 w-3 flex-shrink-0 animate-spin text-neutral-500" />
                    : tieneFicha
                    ? <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-green-500" title="Con ficha" />
                    : <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-neutral-700" title="Sin ficha" />
                  }
                </div>
                <p className="mt-0.5 truncate text-xs text-neutral-600">
                  {doc.autor || 'Sin autor'}{doc.año ? ` · ${doc.año}` : ''}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Panel derecho: detalle */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {docSelObj ? (
          <FichaDetalle
            doc={docSelObj}
            ficha={fichas[docSelObj.id] ?? null}
            cargando={!!cargandoFicha[docSelObj.id]}
            error={errores[docSelObj.id] ?? null}
            onGenerar={() => generarFicha(docSelObj)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <ChevronRight className="h-10 w-10 text-neutral-800" />
            <p className="mt-3 text-sm text-neutral-500">Seleccioná un documento</p>
            <p className="mt-1 text-xs text-neutral-700">
              {conFicha} con ficha · {sinFicha} sin ficha
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
