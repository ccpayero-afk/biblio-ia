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
    <div
      className="flex h-full flex-col"
      style={{ borderRight: '1px solid rgba(255,255,255,0.05)', background: 'rgba(5,5,12,0.95)' }}
    >
      {/* Upload */}
      <div className="p-3 space-y-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs transition-all disabled:opacity-50"
          style={{
            border: '1px dashed rgba(139,92,246,0.3)',
            color: 'rgba(148,163,184,0.6)',
          }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.6)'; e.currentTarget.style.color = '#a78bfa'; e.currentTarget.style.background = 'rgba(139,92,246,0.06)' } }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; e.currentTarget.style.color = 'rgba(148,163,184,0.6)'; e.currentTarget.style.background = '' }}
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
          <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.3)' }} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar…"
            className="w-full rounded-lg py-1.5 pl-7 pr-3 text-xs text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
          />
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {docs.length === 0 && !subiendo && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl mb-3"
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.06))',
                border: '1px solid rgba(139,92,246,0.2)',
              }}
            >
              <BookOpen className="h-6 w-6" style={{ color: 'rgba(139,92,246,0.6)' }} />
            </div>
            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>Subí PDFs que querés leer</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(148,163,184,0.3)' }}>Aparecerán acá hasta que los pases a Biblioteca</p>
          </div>
        )}
        {docsFiltrados.map((doc) => {
          const isSel = docSelId === doc.id
          return (
            <button
              key={doc.id}
              onClick={() => onSeleccionar(doc.id)}
              className="block w-full px-4 py-3 text-left transition-all"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: isSel ? 'linear-gradient(90deg, rgba(109,40,217,0.15), rgba(30,58,138,0.08))' : '',
              }}
              onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
              onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = '' }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 flex-1 text-xs font-medium leading-snug" style={{ color: isSel ? '#f1f5f9' : 'rgba(203,213,225,0.8)' }}>
                  {shortName(doc.nombre)}
                </p>
                <span
                  className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${doc.estado === 'indexado' ? 'bg-emerald-500' : 'bg-neutral-700'}`}
                  title={doc.estado === 'indexado' ? 'Indexado' : 'Sin indexar'}
                  style={doc.estado === 'indexado' ? { boxShadow: '0 0 6px rgba(52,211,153,0.5)' } : {}}
                />
              </div>
              <p className="mt-0.5 truncate text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>
                {doc.autor || 'Sin autor'}{doc.año ? ` · ${doc.año}` : ''}
              </p>
            </button>
          )
        })}
      </div>

      <div className="px-4 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <p className="text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>{docs.length} PDF{docs.length !== 1 ? 's' : ''} por leer</p>
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
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
          style={{
            background: 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(16,185,129,0.08))',
            border: '1px solid rgba(52,211,153,0.3)',
            boxShadow: '0 0 24px rgba(52,211,153,0.15)',
          }}
        >
          <Check className="h-7 w-7" style={{ color: '#34d399' }} />
        </div>
        <p className="text-sm font-medium text-white">Movido a Biblioteca</p>
        <Link
          href="/biblioteca"
          className="mt-3 text-xs transition-colors"
          style={{ color: 'rgba(6,182,212,0.7)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#22d3ee' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(6,182,212,0.7)' }}
        >Ir a Biblioteca →</Link>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header del documento */}
      <div
        className="flex items-start justify-between gap-4 px-6 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
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
                className="flex-1 rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
              />
              <input
                value={meta.año}
                onChange={(e) => setMeta((p) => ({ ...p, año: e.target.value }))}
                placeholder="Año"
                className="w-20 rounded px-2 py-1 text-xs text-neutral-300 focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
              />
              <button
                onClick={guardarMeta}
                disabled={guardandoMeta}
                className="rounded px-2 py-1 text-xs text-white transition-all disabled:opacity-50"
                style={{ background: 'rgba(124,58,237,0.4)', border: '1px solid rgba(139,92,246,0.4)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.6)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.4)' }}
              >
                {guardandoMeta ? '…' : 'Guardar'}
              </button>
              <button
                onClick={() => setEditandoMeta(false)}
                className="transition-colors"
                style={{ color: 'rgba(148,163,184,0.4)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-0.5 flex items-center gap-2">
              <p className="text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>
                {doc.autor || 'Sin autor'}{doc.año ? ` · ${doc.año}` : ''}
              </p>
              <button
                onClick={() => { setMeta({ autor: doc.autor || '', año: doc.año || '' }); setEditandoMeta(true) }}
                className="transition-colors"
                title="Editar metadatos"
                style={{ color: 'rgba(148,163,184,0.3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(167,139,250,0.8)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.3)' }}
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={indexDone
              ? { background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.4)' }
            }
          >
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
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all"
            style={{ border: '1px solid rgba(6,182,212,0.2)', color: 'rgba(34,211,238,0.7)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.5)'; e.currentTarget.style.color = '#22d3ee'; e.currentTarget.style.background = 'rgba(6,182,212,0.07)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.2)'; e.currentTarget.style.color = 'rgba(34,211,238,0.7)'; e.currentTarget.style.background = '' }}
          >
            <Eye className="h-3.5 w-3.5" /> Abrir lector
          </Link>
          <Link
            href={`/fichas`}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all"
            style={{ border: '1px solid rgba(139,92,246,0.2)', color: 'rgba(167,139,250,0.7)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; e.currentTarget.style.color = '#a78bfa'; e.currentTarget.style.background = 'rgba(139,92,246,0.07)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)'; e.currentTarget.style.color = 'rgba(167,139,250,0.7)'; e.currentTarget.style.background = '' }}
          >
            <FileText className="h-3.5 w-3.5" /> Ir a Fichas
          </Link>
        </div>

        {/* Indexación */}
        <Section titulo="1. Indexar documento" icono={<ArrowRight className="h-4 w-4" style={{ color: 'rgba(52,211,153,0.7)' }} />}>
          <p className="text-xs mb-3" style={{ color: 'rgba(148,163,184,0.5)' }}>
            Indexá el texto para habilitar la Guía de Lectura, extracción de notas y generación de fichas.
          </p>
          {indexMsg && (
            <p className={`mb-2 text-xs ${indexMsg.startsWith('Error') ? 'text-red-400' : ''}`} style={!indexMsg.startsWith('Error') ? { color: '#34d399' } : {}}>
              {indexMsg}
            </p>
          )}
          <button
            onClick={indexar}
            disabled={indexando || indexDone}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all disabled:opacity-40"
            style={indexDone
              ? { border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', background: 'rgba(52,211,153,0.07)' }
              : { border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(203,213,225,0.7)' }
            }
            onMouseEnter={(e) => { if (!e.currentTarget.disabled && !indexDone) { e.currentTarget.style.borderColor = 'rgba(52,211,153,0.4)'; e.currentTarget.style.color = '#34d399'; e.currentTarget.style.background = 'rgba(52,211,153,0.07)' } }}
            onMouseLeave={(e) => { if (!indexDone) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(203,213,225,0.7)'; e.currentTarget.style.background = '' } }}
          >
            {indexando
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : indexDone
              ? <Check className="h-3.5 w-3.5" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            {indexando ? 'Indexando…' : indexDone ? 'Ya indexado' : 'Indexar'}
          </button>
        </Section>

        {/* Guía de Lectura */}
        <Section titulo="2. Guía de Lectura" icono={<BookOpen className="h-4 w-4" style={{ color: '#a78bfa' }} />}>
          <p className="text-xs mb-3" style={{ color: 'rgba(148,163,184,0.5)' }}>
            La IA genera una orientación para abordar el texto: contexto, preguntas guía, conceptos a rastrear y estrategia de lectura.
          </p>

          {guiaError && (
            <div
              className="mb-3 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
            >
              {guiaError}
            </div>
          )}

          <button
            onClick={generarGuia}
            disabled={generandoGuia}
            className="mb-4 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #0891b2)',
              boxShadow: '0 0 16px rgba(124,58,237,0.3)',
            }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.boxShadow = '0 0 24px rgba(124,58,237,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 16px rgba(124,58,237,0.3)'; e.currentTarget.style.transform = '' }}
          >
            {generandoGuia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {guiaLocal ? 'Regenerar guía' : 'Generar guía de lectura'}
          </button>

          {guiaLocal && (
            <div
              className="space-y-4 rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {guiaLocal.orientacionGeneral && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(139,92,246,0.7)' }}>Orientación general</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(241,245,249,0.8)' }}>{guiaLocal.orientacionGeneral}</p>
                </div>
              )}

              {guiaLocal.preguntasGuia?.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(139,92,246,0.7)' }}>Preguntas guía</p>
                  <ul className="space-y-1.5">
                    {guiaLocal.preguntasGuia.map((q, i) => (
                      <li key={i} className="flex gap-2 text-sm" style={{ color: 'rgba(241,245,249,0.75)' }}>
                        <span className="flex-shrink-0 font-bold" style={{ color: '#a78bfa' }}>?</span>{q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {guiaLocal.conceptosARastrear?.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(6,182,212,0.7)' }}>Conceptos a rastrear</p>
                  <div className="flex flex-wrap gap-1.5">
                    {guiaLocal.conceptosARastrear.map((c, i) => (
                      <span
                        key={i}
                        className="rounded-full px-2.5 py-1 text-xs"
                        style={{
                          background: 'rgba(6,182,212,0.08)',
                          border: '1px solid rgba(6,182,212,0.2)',
                          color: 'rgba(34,211,238,0.8)',
                        }}
                      >{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {guiaLocal.estrategiaLectura && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(139,92,246,0.7)' }}>Estrategia de lectura</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(241,245,249,0.8)' }}>{guiaLocal.estrategiaLectura}</p>
                </div>
              )}

              {guiaLocal.conexionesPosibes && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(139,92,246,0.7)' }}>Conexiones posibles</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(241,245,249,0.8)' }}>{guiaLocal.conexionesPosibes}</p>
                </div>
              )}

              {guiaLocal.checklistPostLectura?.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(52,211,153,0.7)' }}>Checklist post-lectura</p>
                  <ul className="space-y-1.5">
                    {guiaLocal.checklistPostLectura.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <button
                          onClick={() => setChecklist((p) => { const c = [...p]; c[i] = !c[i]; return c })}
                          className="mt-0.5 flex-shrink-0"
                        >
                          <CheckSquare className={`h-4 w-4 ${checklist[i] ? 'text-emerald-500' : 'text-neutral-700'}`} />
                        </button>
                        <span style={checklist[i] ? { color: 'rgba(148,163,184,0.3)', textDecoration: 'line-through' } : { color: 'rgba(241,245,249,0.75)' }}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs pt-1" style={{ color: 'rgba(148,163,184,0.3)' }}>
                Generada {new Date(guiaLocal.generadaEn).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
          )}
        </Section>

        {/* Extraer notas */}
        <Section titulo="3. Extraer notas Zettelkasten" icono={<StickyNote className="h-4 w-4" style={{ color: '#fbbf24' }} />}>
          <p className="text-xs mb-3" style={{ color: 'rgba(148,163,184,0.5)' }}>
            La IA extrae entre 5 y 8 notas permanentes Zettelkasten del documento y las agrega a tu sección de Notas.
          </p>
          {notasMsg && (
            <p className={`mb-2 text-xs ${notasMsg.startsWith('Error') ? 'text-red-400' : ''}`} style={!notasMsg.startsWith('Error') ? { color: '#34d399' } : {}}>
              {notasMsg}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={extraerNotas}
              disabled={extrayendoNotas || !indexDone}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all disabled:opacity-40"
              style={{ border: '1px solid rgba(245,158,11,0.25)', color: 'rgba(251,191,36,0.7)' }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'; e.currentTarget.style.color = '#fbbf24'; e.currentTarget.style.background = 'rgba(245,158,11,0.07)' } }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.25)'; e.currentTarget.style.color = 'rgba(251,191,36,0.7)'; e.currentTarget.style.background = '' }}
            >
              {extrayendoNotas ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StickyNote className="h-3.5 w-3.5" />}
              {extrayendoNotas ? 'Extrayendo…' : 'Extraer notas'}
            </button>
            {notasMsg && !notasMsg.startsWith('Error') && (
              <Link
                href="/notas"
                className="text-xs transition-colors"
                style={{ color: 'rgba(6,182,212,0.7)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#22d3ee' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(6,182,212,0.7)' }}
              >
                Ver en Notas →
              </Link>
            )}
          </div>
          {!indexDone && <p className="mt-1.5 text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>Indexá el documento primero.</p>}
        </Section>

        {/* Pasar a Biblioteca */}
        <Section titulo="4. Pasar a Biblioteca" icono={<MoveRight className="h-4 w-4" style={{ color: '#34d399' }} />}>
          <p className="text-xs mb-3" style={{ color: 'rgba(148,163,184,0.5)' }}>
            Una vez procesado, mové el PDF a tu Biblioteca. Allí podrás generar la ficha completa, extraer citas y datos.
          </p>
          <button
            onClick={moverABiblioteca}
            disabled={moviendoABibl}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all disabled:opacity-40"
            style={{ border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', background: 'rgba(52,211,153,0.07)' }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = 'rgba(52,211,153,0.14)'; e.currentTarget.style.borderColor = 'rgba(52,211,153,0.5)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(52,211,153,0.15)' } }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(52,211,153,0.07)'; e.currentTarget.style.borderColor = 'rgba(52,211,153,0.3)'; e.currentTarget.style.boxShadow = '' }}
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
    <div
      className="rounded-xl p-4"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        {icono}
        <h3 className="text-sm font-semibold" style={{ color: 'rgba(241,245,249,0.9)' }}>{titulo}</h3>
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
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'rgba(139,92,246,0.5)' }} />
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
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl mb-5"
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.08))',
                border: '1px solid rgba(139,92,246,0.25)',
                boxShadow: '0 0 30px rgba(124,58,237,0.12)',
              }}
            >
              <BookOpen className="h-8 w-8" style={{ color: 'rgba(139,92,246,0.7)' }} />
            </div>
            <h2
              className="text-lg font-bold"
              style={{
                background: 'linear-gradient(90deg, #f1f5f9 30%, #a78bfa 70%, #22d3ee 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >Sala de Lectura</h2>
            <p className="mt-2 text-sm max-w-sm" style={{ color: 'rgba(148,163,184,0.55)' }}>
              Subí un PDF que querés leer. La IA te genera una guía de lectura, podés indexarlo, extraer notas y después moverlo a Biblioteca.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {[
                'Subir PDF → Indexar',
                'Generar guía de lectura',
                'Leer + extraer notas',
                'Pasar a Biblioteca',
              ].map((paso, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div
                    className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, #7c3aed, #06b6d4)`, opacity: 0.7 - i * 0.1 }}
                  />
                  <span style={{ color: 'rgba(148,163,184,0.4)' }}>{paso}</span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>← Seleccioná un PDF de la lista</p>
          </div>
        )}
      </div>
    </div>
  )
}
