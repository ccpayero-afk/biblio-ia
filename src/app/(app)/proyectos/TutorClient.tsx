'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  GraduationCap, Send, RotateCcw, BookOpen, FileText,
  Lightbulb, ListOrdered, FlaskConical, HelpCircle,
  AlertTriangle, Footprints, ChevronDown, Loader2, Sparkles,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

const TIPOS = [
  { id: 'articulo',  label: 'Artículo' },
  { id: 'tesis',     label: 'Tesis' },
  { id: 'ponencia',  label: 'Ponencia' },
  { id: 'clase',     label: 'Clase' },
  { id: 'capitulo',  label: 'Capítulo' },
  { id: 'ensayo',    label: 'Ensayo' },
]

interface DocRelevante { id: string; nombre: string; autor: string; año: string }
interface Meta { docsRelevantes: DocRelevante[]; totalDocs: number; fragmentosAnalizados: number }

// ─── Parseo de secciones markdown ────────────────────────────────────────────

interface Seccion { titulo: string; cuerpo: string }

function parsearSecciones(texto: string): Seccion[] {
  const partes = texto.split(/^## /m).filter(Boolean)
  return partes.map((p) => {
    const nl = p.indexOf('\n')
    return nl === -1
      ? { titulo: p.trim(), cuerpo: '' }
      : { titulo: p.slice(0, nl).trim(), cuerpo: p.slice(nl + 1).trim() }
  })
}

// Renderiza markdown básico (negrita, listas, inline code)
function renderMd(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
}

function Parrafo({ texto }: { texto: string }) {
  const lineas = texto.split('\n').filter((l) => l.trim())
  const elementos: React.ReactNode[] = []
  let lista: string[] = []

  function flushLista() {
    if (!lista.length) return
    elementos.push(
      <ul key={`ul-${elementos.length}`} className="ml-4 mt-1 space-y-1">
        {lista.map((li, i) => (
          <li key={i} className="flex gap-2 text-sm" style={{ color: 'rgba(203,213,225,0.85)' }}>
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: 'rgba(139,92,246,0.6)' }} />
            <span dangerouslySetInnerHTML={{ __html: renderMd(li) }} />
          </li>
        ))}
      </ul>,
    )
    lista = []
  }

  for (const linea of lineas) {
    if (linea.startsWith('- ') || linea.startsWith('• ')) {
      lista.push(linea.slice(2))
    } else if (/^\d+\.\s/.test(linea)) {
      lista.push(linea.replace(/^\d+\.\s/, ''))
    } else {
      flushLista()
      elementos.push(
        <p key={`p-${elementos.length}`} className="mt-2 text-sm leading-relaxed" style={{ color: 'rgba(203,213,225,0.85)' }}
          dangerouslySetInnerHTML={{ __html: renderMd(linea) }}
        />,
      )
    }
  }
  flushLista()
  return <div>{elementos}</div>
}

// ─── Iconos por sección ───────────────────────────────────────────────────────

const ICONO_SECCION: Record<string, React.ReactNode> = {
  'Bibliografía recomendada':       <BookOpen className="h-4 w-4" />,
  'Estructura sugerida':            <ListOrdered className="h-4 w-4" />,
  'Orientación metodológica':       <FlaskConical className="h-4 w-4" />,
  'Hipótesis y preguntas orientadoras': <HelpCircle className="h-4 w-4" />,
  'Citas y pasajes clave':          <FileText className="h-4 w-4" />,
  'Gaps y desafíos':                <AlertTriangle className="h-4 w-4" />,
  'Primeros pasos concretos':       <Footprints className="h-4 w-4" />,
}

const COLOR_SECCION: Record<string, string> = {
  'Bibliografía recomendada':       'rgba(139,92,246,0.7)',
  'Estructura sugerida':            'rgba(6,182,212,0.7)',
  'Orientación metodológica':       'rgba(16,185,129,0.7)',
  'Hipótesis y preguntas orientadoras': 'rgba(245,158,11,0.7)',
  'Citas y pasajes clave':          'rgba(167,139,250,0.7)',
  'Gaps y desafíos':                'rgba(239,68,68,0.7)',
  'Primeros pasos concretos':       'rgba(99,102,241,0.7)',
}

// ─── Card de sección ─────────────────────────────────────────────────────────

function SeccionCard({ seccion, index }: { seccion: Seccion; index: number }) {
  const [abierta, setAbierta] = useState(true)
  const icono  = ICONO_SECCION[seccion.titulo]  ?? <Lightbulb className="h-4 w-4" />
  const color  = COLOR_SECCION[seccion.titulo]  ?? 'rgba(139,92,246,0.7)'

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid rgba(255,255,255,0.07)`,
        animationDelay: `${index * 80}ms`,
      }}
    >
      <button
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: `${color.replace('0.7', '0.15')}`, color }}>
          {icono}
        </span>
        <span className="flex-1 text-sm font-semibold text-white">{seccion.titulo}</span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform text-neutral-500 ${abierta ? 'rotate-180' : ''}`} />
      </button>
      {abierta && (
        <div className="px-5 pb-5">
          <div className="h-px mb-4" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <Parrafo texto={seccion.cuerpo} />
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function TutorClient() {
  const [tipo, setTipo]               = useState('articulo')
  const [descripcion, setDescripcion] = useState('')
  const [perspectiva, setPerspectiva] = useState('')
  const [generando, setGenerando]     = useState(false)
  const [texto, setTexto]             = useState('')       // full streamed plan
  const [meta, setMeta]               = useState<Meta | null>(null)
  const [error, setError]             = useState<string | null>(null)

  // Follow-up chat
  const [seguimiento, setSeguimiento] = useState('')
  const [chatTexto, setChatTexto]     = useState('')       // streamed follow-up
  const [enviando, setEnviando]       = useState(false)
  const [historialChat, setHistorialChat] = useState<Array<{ q: string; r: string }>>([])

  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const chatRef        = useRef<HTMLInputElement>(null)
  const planBottomRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (generando || enviando) planBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [texto, chatTexto, generando, enviando])

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [descripcion])

  // ── Stream helper ─────────────────────────────────────────────────────────
  async function consumirStream(
    body: object,
    onMeta: (m: Meta) => void,
    onTexto: (t: string) => void,
    onDone: () => void,
    onError: (e: string) => void,
  ) {
    const res = await fetch('/api/tutor/planificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}))
      onError(data.error ?? 'Error al conectar con el tutor')
      return
    }
    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lineas = buf.split('\n\n')
      buf = lineas.pop() ?? ''
      for (const linea of lineas) {
        if (!linea.startsWith('data: ')) continue
        try {
          const d = JSON.parse(linea.slice(6))
          if (d.meta)   onMeta(d.meta)
          if (d.texto)  onTexto(d.texto)
          if (d.done)   onDone()
          if (d.error)  onError(d.error)
        } catch { /* skip malformed */ }
      }
    }
  }

  // ── Planificar ────────────────────────────────────────────────────────────
  async function planificar() {
    if (!descripcion.trim() || generando) return
    setGenerando(true)
    setTexto('')
    setMeta(null)
    setError(null)
    setHistorialChat([])
    setChatTexto('')

    let acum = ''
    await consumirStream(
      { tipo, descripcion, perspectiva },
      (m) => setMeta(m),
      (t) => { acum += t; setTexto(acum) },
      () => { setGenerando(false) },
      (e) => { setError(e); setGenerando(false) },
    )
  }

  // ── Follow-up ─────────────────────────────────────────────────────────────
  async function enviarSeguimiento() {
    if (!seguimiento.trim() || enviando || !texto) return
    setEnviando(true)
    const pregunta = seguimiento
    setSeguimiento('')
    setChatTexto('')

    let respuesta = ''
    await consumirStream(
      { seguimiento: pregunta, planTexto: texto },
      () => { /* no meta in follow-up */ },
      (t) => { respuesta += t; setChatTexto(respuesta) },
      () => {
        setHistorialChat((prev) => [...prev, { q: pregunta, r: respuesta }])
        setChatTexto('')
        setEnviando(false)
      },
      (e) => { setError(e); setEnviando(false) },
    )
  }

  const secciones = texto ? parsearSecciones(texto) : []
  const hayPlan   = secciones.length > 0 || generando

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-6 lg:flex-row">

      {/* ── Panel izquierdo: formulario ─────────────────────────────────── */}
      <aside className="w-full flex-shrink-0 lg:w-80 xl:w-96">
        <div
          className="sticky top-0 rounded-2xl p-5 space-y-5"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}>
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Tutor Metodológico</h1>
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>Asistente de planificación académica</p>
            </div>
          </div>

          {/* Tipo de trabajo */}
          <div>
            <label className="mb-2 block text-xs font-medium" style={{ color: 'rgba(148,163,184,0.6)' }}>Tipo de trabajo</label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTipo(t.id)}
                  className="rounded-full px-3 py-1 text-xs transition-all"
                  style={tipo === t.id
                    ? { background: 'linear-gradient(90deg, rgba(109,40,217,0.4), rgba(30,58,138,0.3))', border: '1px solid rgba(139,92,246,0.5)', color: '#c4b5fd' }
                    : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.6)' }
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Descripción del tema */}
          <div>
            <label className="mb-2 block text-xs font-medium" style={{ color: 'rgba(148,163,184,0.6)' }}>
              Describí tu trabajo
            </label>
            <textarea
              ref={textareaRef}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: quiero hacer un artículo sobre el trabajo no registrado en Argentina desde una perspectiva histórico-sociológica…"
              rows={4}
              className="w-full resize-none rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                minHeight: 96,
                maxHeight: 220,
                lineHeight: 1.6,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) planificar() }}
            />
          </div>

          {/* Perspectiva */}
          <div>
            <label className="mb-2 block text-xs font-medium" style={{ color: 'rgba(148,163,184,0.6)' }}>Perspectiva / enfoque <span style={{ color: 'rgba(148,163,184,0.35)' }}>(opcional)</span></label>
            <input
              type="text"
              value={perspectiva}
              onChange={(e) => setPerspectiva(e.target.value)}
              placeholder="Ej: marxismo histórico, teoría de la dependencia…"
              className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            />
          </div>

          {/* Botón principal */}
          <button
            onClick={planificar}
            disabled={!descripcion.trim() || generando}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 18px rgba(124,58,237,0.35)' }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 28px rgba(124,58,237,0.55)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 18px rgba(124,58,237,0.35)' }}
          >
            {generando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Analizando…</>
              : <><Sparkles className="h-4 w-4" /> Planificar trabajo</>
            }
          </button>
          <p className="text-center text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>⌘↵ para planificar</p>

          {/* Metadata */}
          {meta && (
            <div className="space-y-2 pt-1">
              <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.45)' }}>
                Analizados <strong className="text-white">{meta.fragmentosAnalizados}</strong> fragmentos de{' '}
                <strong className="text-white">{meta.totalDocs}</strong> documentos
              </p>
              {meta.docsRelevantes.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium" style={{ color: 'rgba(148,163,184,0.45)' }}>Documentos más relevantes:</p>
                  <div className="space-y-1">
                    {meta.docsRelevantes.slice(0, 5).map((d) => (
                      <Link
                        key={d.id}
                        href={`/lector/${d.id}`}
                        className="flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                      >
                        <BookOpen className="mt-0.5 h-3 w-3 flex-shrink-0 text-violet-400" />
                        <div className="min-w-0">
                          <p className="truncate text-xs text-white">{d.nombre.replace(/\.pdf$/i, '')}</p>
                          <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.45)' }}>{d.autor}{d.año ? ` · ${d.año}` : ''}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Panel derecho: plan + chat ──────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Estado vacío */}
        {!hayPlan && !error && (
          <div className="flex h-full min-h-96 flex-col items-center justify-center gap-4 rounded-2xl py-16 text-center"
            style={{ background: 'rgba(255,255,255,0.015)', border: '1px dashed rgba(255,255,255,0.06)' }}>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <GraduationCap className="h-8 w-8" style={{ color: 'rgba(139,92,246,0.6)' }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Tu tutor está listo</h2>
              <p className="mt-1 max-w-xs text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>
                Describí tu trabajo académico en el panel izquierdo y la IA analizará tu biblioteca para guiarte.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
              {['Estructura argumentativa', 'Bibliografía priorizada', 'Orientación metodológica', 'Preguntas de investigación'].map((tag) => (
                <span key={tag} className="rounded-full px-3 py-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-2xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Error al generar el plan</p>
              <p className="mt-0.5 text-xs opacity-80">{error}</p>
              <button onClick={() => setError(null)} className="mt-2 text-xs underline opacity-70">Cerrar</button>
            </div>
          </div>
        )}

        {/* Generando — streaming */}
        {generando && !secciones.length && (
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
              <p className="text-sm text-white">Analizando tu biblioteca y construyendo el plan…</p>
            </div>
            {texto && (
              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(148,163,184,0.6)' }}>
                {texto.slice(-400)}
              </p>
            )}
          </div>
        )}

        {/* Secciones del plan */}
        {secciones.map((s, i) => (
          <SeccionCard key={`${s.titulo}-${i}`} seccion={s} index={i} />
        ))}

        {/* Streaming en curso dentro del plan */}
        {generando && secciones.length > 0 && (
          <div className="flex items-center gap-2 rounded-2xl px-5 py-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>Completando el plan…</p>
          </div>
        )}

        {/* Chat de seguimiento */}
        {!generando && texto && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>

            {/* Historial de seguimiento */}
            {historialChat.length > 0 && (
              <div className="space-y-4 p-5">
                {historialChat.map((turno, i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex justify-end">
                      <div className="max-w-xl rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white" style={{ background: 'rgba(109,40,217,0.25)', border: '1px solid rgba(139,92,246,0.2)' }}>
                        {turno.q}
                      </div>
                    </div>
                    <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Parrafo texto={turno.r} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Respuesta streaming del chat */}
            {enviando && chatTexto && (
              <div className="px-5 pb-4">
                <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(203,213,225,0.85)', whiteSpace: 'pre-wrap' }}>{chatTexto}</p>
                </div>
              </div>
            )}

            {/* Input de seguimiento */}
            <div className="flex items-center gap-3 border-t px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <GraduationCap className="h-4 w-4 flex-shrink-0" style={{ color: 'rgba(139,92,246,0.6)' }} />
              <input
                ref={chatRef}
                type="text"
                value={seguimiento}
                onChange={(e) => setSeguimiento(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviarSeguimiento()}
                placeholder="Preguntá sobre el plan, pedí ajustes, profundizá en alguna sección…"
                className="flex-1 bg-transparent text-sm text-white placeholder-neutral-600 focus:outline-none"
                disabled={enviando}
              />
              {enviando
                ? <Loader2 className="h-4 w-4 animate-spin text-violet-400 flex-shrink-0" />
                : (
                  <button
                    onClick={enviarSeguimiento}
                    disabled={!seguimiento.trim()}
                    className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 transition-all disabled:opacity-30"
                    style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                )
              }
            </div>
          </div>
        )}

        {/* Botón de reset */}
        {texto && !generando && (
          <button
            onClick={() => { setTexto(''); setMeta(null); setHistorialChat([]); setChatTexto('') }}
            className="flex items-center gap-2 text-xs transition-colors"
            style={{ color: 'rgba(148,163,184,0.35)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.7)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.35)' }}
          >
            <RotateCcw className="h-3 w-3" /> Nuevo plan
          </button>
        )}

        <div ref={planBottomRef} />
      </div>
    </div>
  )
}
