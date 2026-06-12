'use client'

import { useEffect, useState, useCallback } from 'react'
import { FileText, Sparkles, Loader2, Search, ChevronRight, RefreshCw, BookOpen, Tag } from 'lucide-react'
import Link from 'next/link'
import { Documento, FichaLectura } from '@/types'

function esFichaValida(f: unknown): f is FichaLectura {
  return !!f && typeof f === 'object' && ('tesisCentral' in (f as object) || 'contenidoRico' in (f as object))
}

const shortName = (nombre: string) =>
  (nombre.split('/').pop() ?? nombre).replace(/\.pdf$/i, '')

type Filtro = 'todas' | 'con_ficha' | 'sin_ficha'

// ─── Panel detalle ────────────────────────────────────────────────────────────

function Sec({ titulo, texto }: { titulo: string; texto?: string | null }) {
  if (!texto?.trim()) return null
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <h3
        className="mb-2 text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: 'rgba(139,92,246,0.6)' }}
      >
        {titulo}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: 'rgba(241,245,249,0.8)' }}>{texto}</p>
    </div>
  )
}

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
      <div
        className="flex items-start justify-between gap-4 px-6 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white leading-snug">{titulo}</h2>
          <div className="mt-0.5 flex items-center gap-3">
            <p className="text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
              {doc.autor || 'Autor desconocido'}{doc.año ? ` · ${doc.año}` : ''}
            </p>
            <Link
              href={`/lector/${doc.id}`}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: 'rgba(99,102,241,0.6)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#818cf8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(99,102,241,0.6)')}
            >
              <BookOpen className="h-3.5 w-3.5" /> Abrir PDF
            </Link>
          </div>
        </div>
        <button
          onClick={onGenerar}
          disabled={cargando}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40"
          style={{
            background: 'rgba(139,92,246,0.1)',
            border: '1px solid rgba(139,92,246,0.25)',
            color: '#a78bfa',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.2)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.1)' }}
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
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'rgba(139,92,246,0.6)' }} />
            <p className="mt-3 text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>Generando ficha con IA…</p>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!ficha && !cargando && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}
            >
              <BookOpen className="h-7 w-7" style={{ color: 'rgba(139,92,246,0.5)' }} />
            </div>
            <p className="text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>Este documento no tiene ficha todavía.</p>
            <button
              onClick={onGenerar}
              className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 14px rgba(124,58,237,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 22px rgba(124,58,237,0.5)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 14px rgba(124,58,237,0.3)' }}
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
          <div className="space-y-6">
            {/* 1. Datos bibliográficos */}
            <div
              className="rounded-xl px-4 py-3"
              style={{
                background: 'linear-gradient(135deg, rgba(109,40,217,0.12), rgba(6,182,212,0.06))',
                border: '1px solid rgba(139,92,246,0.2)',
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(139,92,246,0.6)' }}>Datos bibliográficos</p>
              <p className="text-sm font-semibold text-white">{shortName(doc.nombre)}</p>
              <p className="text-sm mt-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>{doc.autor || 'Autor desconocido'}{doc.año ? ` · ${doc.año}` : ''}</p>
            </div>

            {/* 2. Tesis central */}
            <Sec titulo="Tesis central" texto={ficha.tesisCentral} />

            {/* 3. Argumento principal */}
            {ficha.argumentoPrincipal && ficha.argumentoPrincipal !== ficha.tesisCentral && (
              <Sec titulo="Argumento principal" texto={ficha.argumentoPrincipal} />
            )}

            {/* 4. Contexto de producción */}
            <Sec titulo="Contexto de producción" texto={ficha.contextoProduccion} />

            {/* 5. Problema de investigación */}
            <Sec titulo="Problema de investigación" texto={ficha.problemaInvestigacion} />

            {/* 6. Preguntas de investigación */}
            {(ficha.preguntasInvestigacion?.length ?? 0) > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Preguntas de investigación</h3>
                <ul className="space-y-1.5">
                  {(ficha.preguntasInvestigacion ?? []).map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-neutral-300">
                      <span className="text-violet-400 flex-shrink-0">?</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 7. Objetivos */}
            <Sec titulo="Objetivos" texto={ficha.objetivos} />

            {/* 8. Hipótesis */}
            <Sec titulo="Hipótesis" texto={ficha.hipotesis} />

            {/* 9. Conceptos clave */}
            {ficha.conceptosClave?.length > 0 && (
              <div>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(139,92,246,0.6)' }}>Conceptos clave</h3>
                <div className="space-y-2">
                  {ficha.conceptosClave.map((ck, i) => (
                    <div
                      key={i}
                      className="rounded-xl px-3 py-2 text-sm"
                      style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
                    >
                      <span className="font-semibold" style={{ color: '#818cf8' }}>{ck.concepto}</span>
                      {ck.definicion && <span className="ml-2" style={{ color: 'rgba(148,163,184,0.7)' }}>{ck.definicion}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 10. Marco teórico */}
            <Sec titulo="Marco teórico" texto={ficha.marcoTeorico} />

            {/* 11. Metodología */}
            <Sec titulo="Metodología" texto={ficha.metodologia} />

            {/* 12. Estructura argumental */}
            <Sec titulo="Estructura argumental" texto={ficha.estructuraArgumental} />

            {/* 13. Evidencias */}
            <Sec titulo="Evidencias y datos empíricos" texto={ficha.evidencias} />

            {/* 14. Hallazgos y conclusiones */}
            <Sec titulo="Hallazgos y conclusiones" texto={ficha.hallazgos} />

            {/* 15. Posición en el debate */}
            <Sec titulo="Posición en el debate" texto={ficha.posicionDebate} />

            {/* 16. Debates y controversias */}
            <Sec titulo="Debates y controversias" texto={ficha.debatesControversias} />

            {/* 17. Limitaciones */}
            <Sec titulo="Limitaciones" texto={ficha.limitaciones} />

            {/* 18. Aportes */}
            {ficha.aportes && Object.values(ficha.aportes).some(Boolean) && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Aportes</h3>
                <div className="space-y-2">
                  {ficha.aportes.teoricos && (
                    <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                      <span className="text-xs font-medium block mb-0.5" style={{ color: 'rgba(167,139,250,0.8)' }}>Teóricos</span>
                      <span style={{ color: 'rgba(226,232,240,0.8)' }}>{ficha.aportes.teoricos}</span>
                    </div>
                  )}
                  {ficha.aportes.metodologicos && (
                    <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}>
                      <span className="text-xs font-medium block mb-0.5" style={{ color: 'rgba(34,211,238,0.8)' }}>Metodológicos</span>
                      <span style={{ color: 'rgba(226,232,240,0.8)' }}>{ficha.aportes.metodologicos}</span>
                    </div>
                  )}
                  {ficha.aportes.empiricos && (
                    <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)' }}>
                      <span className="text-xs font-medium block mb-0.5" style={{ color: 'rgba(52,211,153,0.8)' }}>Empíricos</span>
                      <span style={{ color: 'rgba(226,232,240,0.8)' }}>{ficha.aportes.empiricos}</span>
                    </div>
                  )}
                  {ficha.aportes.politicos && (
                    <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
                      <span className="text-xs font-medium block mb-0.5" style={{ color: 'rgba(251,191,36,0.8)' }}>Político-sociales</span>
                      <span style={{ color: 'rgba(226,232,240,0.8)' }}>{ficha.aportes.politicos}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 19. Citas textuales */}
            {ficha.citasDestacadas?.length > 0 && (
              <div>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(139,92,246,0.6)' }}>Citas textuales relevantes</h3>
                <div className="space-y-2">
                  {ficha.citasDestacadas.map((c, i) => (
                    <blockquote
                      key={i}
                      className="rounded-r-xl pl-4 pr-3 py-3 text-sm italic"
                      style={{
                        borderLeft: '3px solid',
                        borderImageSlice: 1,
                        borderImage: 'linear-gradient(180deg, #7c3aed, #06b6d4) 1',
                        background: 'rgba(255,255,255,0.02)',
                        color: 'rgba(241,245,249,0.75)',
                      }}
                    >
                      &ldquo;{c.texto}&rdquo;
                      <span className="ml-2 not-italic text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>p.{c.pagina}</span>
                    </blockquote>
                  ))}
                </div>
              </div>
            )}

            {/* 20. Palabras clave */}
            {(ficha.palabrasClave?.length ?? 0) > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Palabras clave</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(ficha.palabrasClave ?? []).map((k) => (
                    <span
                      key={k}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                      style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)', color: 'rgba(167,139,250,0.7)' }}
                    >
                      <Tag className="h-3 w-3" />{k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 21. Relación con otras obras */}
            <Sec titulo="Relación con otras obras" texto={ficha.relacionOtrasObras} />

            {/* 22. Utilidad para la investigación */}
            <Sec titulo="Utilidad para la investigación" texto={ficha.utilidadInvestigacion} />

            {/* 23. Evaluación crítica */}
            <Sec titulo="Evaluación crítica" texto={ficha.evaluacionCritica} />

            {/* 24. Notas Zettelkasten */}
            {(ficha.notasZettelkasten?.length ?? 0) > 0 && (
              <div>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(139,92,246,0.6)' }}>Notas Zettelkasten</h3>
                <div className="space-y-2">
                  {(ficha.notasZettelkasten ?? []).map((n, i) => (
                    <div
                      key={i}
                      className="rounded-xl px-3 py-2 text-sm"
                      style={{
                        background: 'linear-gradient(135deg, rgba(109,40,217,0.1), rgba(6,182,212,0.05))',
                        border: '1px solid rgba(139,92,246,0.2)',
                        color: 'rgba(241,245,249,0.8)',
                      }}
                    >
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Referencias citadas en el texto */}
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

            {/* Relevancia (campo legacy) */}
            {ficha.relevancia && !ficha.utilidadInvestigacion && (
              <Sec titulo="Relevancia" texto={ficha.relevancia} />
            )}

            <p className="pt-2 text-xs text-neutral-700">
              Generada {new Date(ficha.generadaEn).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        )}
      </div>
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
    Promise.all([
      fetch('/api/drive/pdfs').then((r) => r.json()),
      fetch('/api/fichas').then((r) => r.json()),
    ])
      .then(([docs, fichaIds]: [Documento[], unknown]) => {
        if (!Array.isArray(docs)) return
        const fichaIdSet = new Set(Array.isArray(fichaIds) ? fichaIds : [])
        setDocs(docs.map((d) => ({ ...d, fichaGenerada: d.fichaGenerada || fichaIdSet.has(d.id) })))
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
      <div
        className="flex w-72 flex-shrink-0 flex-col"
        style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Buscador */}
        <div className="p-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.3)' }} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por título o autor…"
              className="w-full rounded-lg py-1.5 pl-8 pr-3 text-xs placeholder:text-neutral-600 focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(241,245,249,0.8)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
            />
          </div>
        </div>

        {/* Filtros */}
        <div className="flex text-xs" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {([
            ['todas', `Todas (${docs.length})`],
            ['con_ficha', `Con (${conFicha})`],
            ['sin_ficha', `Sin (${sinFicha})`],
          ] as [Filtro, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFiltro(key)}
              className="flex-1 py-2 text-center transition-colors"
              style={filtro === key
                ? { color: '#a78bfa', borderBottom: '2px solid #7c3aed' }
                : { color: 'rgba(148,163,184,0.4)' }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {docsFiltrados.length === 0 && (
            <p className="p-4 text-center text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>Sin resultados</p>
          )}
          {docsFiltrados.map((doc) => {
            const tieneFicha = doc.fichaGenerada
            const cargandoEsta = !!cargandoFicha[doc.id]
            const activo = docSel === doc.id
            return (
              <button
                key={doc.id}
                onClick={() => seleccionarDoc(doc.id)}
                className="block w-full px-4 py-3 text-left transition-all"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  background: activo
                    ? 'linear-gradient(90deg, rgba(109,40,217,0.15), rgba(30,58,138,0.08))'
                    : undefined,
                  boxShadow: activo ? 'inset 3px 0 0 #7c3aed' : undefined,
                }}
                onMouseEnter={(e) => { if (!activo) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)' }}
                onMouseLeave={(e) => { if (!activo) (e.currentTarget as HTMLElement).style.background = '' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 flex-1 text-xs font-medium leading-snug" style={{ color: activo ? '#e2e8f0' : 'rgba(226,232,240,0.7)' }}>
                    {shortName(doc.nombre)}
                  </p>
                  {cargandoEsta
                    ? <Loader2 className="mt-0.5 h-3 w-3 flex-shrink-0 animate-spin" style={{ color: 'rgba(148,163,184,0.4)' }} />
                    : tieneFicha
                    ? <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,0.6)' }} title="Con ficha" />
                    : <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} title="Sin ficha" />
                  }
                </div>
                <p className="mt-0.5 truncate text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
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
          <div className="flex h-full flex-col items-center justify-center text-center px-8">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}
            >
              <FileText className="h-7 w-7" style={{ color: 'rgba(139,92,246,0.5)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'rgba(241,245,249,0.6)' }}>Seleccioná un documento</p>
            <p className="mt-1 text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>
              {conFicha} con ficha · {sinFicha} sin ficha
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
