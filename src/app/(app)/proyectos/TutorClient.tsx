'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  GraduationCap, Send, RotateCcw, BookOpen, FileText,
  Lightbulb, ListOrdered, FlaskConical, HelpCircle,
  AlertTriangle, Footprints, ChevronDown, Loader2, Sparkles,
  Globe, ExternalLink, Stethoscope, History, Trash2, Clock, Folder,
} from 'lucide-react'
import type { Carpeta } from '@/types'

// ─── Tipos ────────────────────────────────────────────────────────────────────

const CARPETA_COLORS: Record<string, string> = {
  purple: '#a78bfa',
  teal:   '#2dd4bf',
  coral:  '#fb7185',
  amber:  '#fbbf24',
  blue:   '#60a5fa',
  green:  '#34d399',
  gray:   '#94a3b8',
}

const SIN_CARPETA_ID = '__sin_carpeta__'

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

interface FuenteAcademica {
  titulo: string
  autores: string
  año: number | null
  revista: string
  citas: number
  doi: string | null
  urlAbierto: string | null
  abstract: string
}

interface SesionTutor {
  id: string
  fecha: string
  tipo: string
  descripcion: string
  perspectiva?: string
  planTexto: string
  historialChat: Array<{ q: string; r: string }>
}

const SECCIONES_ESPERADAS = [
  'Diagnóstico del trabajo',
  'Bibliografía recomendada',
  'Bibliografía sugerida',
  'Estructura sugerida',
  'Orientación metodológica',
  'Hipótesis y preguntas orientadoras',
  'Citas y pasajes clave',
  'Gaps y desafíos',
  'Primeros pasos concretos',
]

// ─── Parseo de secciones ─────────────────────────────────────────────────────

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

// ─── Renderizador markdown ────────────────────────────────────────────────────

function renderMd(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
}

function Parrafo({ texto, color }: { texto: string; color: string }) {
  const lineas = texto.split('\n').filter((l) => l.trim())
  const elementos: React.ReactNode[] = []
  let lista: string[] = []
  let enumerada: string[] = []

  function flushLista() {
    if (lista.length) {
      elementos.push(
        <ul key={`ul-${elementos.length}`} className="mt-2 space-y-1.5 pl-1">
          {lista.map((li, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: 'rgba(203,213,225,0.82)' }}>
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: color }} />
              <span dangerouslySetInnerHTML={{ __html: renderMd(li) }} />
            </li>
          ))}
        </ul>,
      )
      lista = []
    }
    if (enumerada.length) {
      elementos.push(
        <ol key={`ol-${elementos.length}`} className="mt-2 space-y-1.5 pl-1">
          {enumerada.map((li, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: 'rgba(203,213,225,0.82)' }}>
              <span className="flex-shrink-0 text-xs font-bold mt-0.5" style={{ color, minWidth: 18 }}>{i + 1}.</span>
              <span dangerouslySetInnerHTML={{ __html: renderMd(li) }} />
            </li>
          ))}
        </ol>,
      )
      enumerada = []
    }
  }

  for (const linea of lineas) {
    if (linea.startsWith('- ') || linea.startsWith('• ')) {
      enumerada.length && flushLista()
      lista.push(linea.slice(2))
    } else if (/^\d+\.\s/.test(linea)) {
      lista.length && flushLista()
      enumerada.push(linea.replace(/^\d+\.\s/, ''))
    } else if (linea.startsWith('### ')) {
      flushLista()
      elementos.push(
        <p key={`h3-${elementos.length}`} className="mt-4 mb-1 text-xs font-bold uppercase tracking-wider" style={{ color }}>
          {linea.slice(4)}
        </p>,
      )
    } else {
      flushLista()
      elementos.push(
        <p key={`p-${elementos.length}`} className="mt-2 text-sm leading-relaxed" style={{ color: 'rgba(203,213,225,0.82)' }}
          dangerouslySetInnerHTML={{ __html: renderMd(linea) }}
        />,
      )
    }
  }
  flushLista()
  return <div className="space-y-0.5">{elementos}</div>
}

// ─── Config visual por sección ───────────────────────────────────────────────

const SECCION_CONFIG: Record<string, { icono: React.ReactNode; color: string; desc: string }> = {
  'Diagnóstico del trabajo':            { icono: <Stethoscope className="h-4 w-4" />,  color: '#e879f9', desc: 'Evaluación crítica de la propuesta' },
  'Bibliografía recomendada':           { icono: <BookOpen className="h-4 w-4" />,      color: '#a78bfa', desc: 'Textos de tu biblioteca a priorizar' },
  'Bibliografía sugerida':              { icono: <Globe className="h-4 w-4" />,          color: '#2dd4bf', desc: 'Textos a conseguir y por qué leerlos' },
  'Estructura sugerida':                { icono: <ListOrdered className="h-4 w-4" />,   color: '#22d3ee', desc: 'Organización del trabajo' },
  'Orientación metodológica':           { icono: <FlaskConical className="h-4 w-4" />,  color: '#34d399', desc: 'Enfoque y estrategia' },
  'Hipótesis y preguntas orientadoras': { icono: <HelpCircle className="h-4 w-4" />,   color: '#fbbf24', desc: 'Preguntas e hipótesis' },
  'Citas y pasajes clave':              { icono: <FileText className="h-4 w-4" />,      color: '#818cf8', desc: 'Fragmentos citables del corpus' },
  'Gaps y desafíos':                    { icono: <AlertTriangle className="h-4 w-4" />, color: '#fb7185', desc: 'Ausencias y riesgos' },
  'Primeros pasos concretos':           { icono: <Footprints className="h-4 w-4" />,    color: '#60a5fa', desc: 'Plan de acción inmediato' },
}

function getConfig(titulo: string) {
  return SECCION_CONFIG[titulo] ?? { icono: <Lightbulb className="h-4 w-4" />, color: 'rgba(139,92,246,0.9)', desc: '' }
}

// ─── Card de sección ─────────────────────────────────────────────────────────

function SeccionCard({ seccion }: { seccion: Seccion }) {
  const [abierta, setAbierta] = useState(true)
  const { icono, color, desc } = getConfig(seccion.titulo)
  const colorBg   = `${color}1a`
  const colorBord = `${color}33`

  const preview = seccion.cuerpo
    .replace(/\*\*/g, '').replace(/\*/g, '').replace(/^[-•]\s/gm, '').replace(/^#+\s/gm, '').replace(/\n/g, ' ').trim()
    .slice(0, 130)

  return (
    <div className="overflow-hidden rounded-2xl" style={{ background: 'rgba(12,12,18,0.7)', border: `1px solid ${colorBord}`, borderLeft: `3px solid ${color}` }}>
      <button onClick={() => setAbierta((v) => !v)} className="flex w-full items-start gap-3.5 px-5 py-4 text-left">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl mt-0.5" style={{ background: colorBg, color }}>
          {icono}
        </span>
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{seccion.titulo}</p>
            <span className="text-xs hidden sm:block" style={{ color: `${color}99` }}>{desc}</span>
          </div>
          {!abierta && preview && (
            <p className="mt-0.5 text-xs line-clamp-1" style={{ color: 'rgba(148,163,184,0.45)' }}>{preview}…</p>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform mt-1 ${abierta ? 'rotate-180' : ''}`} style={{ color: `${color}66` }} />
      </button>
      {abierta && (
        <div className="px-5 pb-5">
          <div className="h-px mb-4" style={{ background: colorBord }} />
          <Parrafo texto={seccion.cuerpo} color={color} />
        </div>
      )}
    </div>
  )
}

// ─── Progreso ────────────────────────────────────────────────────────────────

function ProgresoSecciones({ secciones, generando }: { secciones: Seccion[]; generando: boolean }) {
  const cargadas = secciones.length
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex gap-1.5">
        {SECCIONES_ESPERADAS.map((s, i) => {
          const loaded = i < cargadas
          const cfg = getConfig(s)
          return (
            <div key={s} title={s} className="h-2 w-2 rounded-full transition-all duration-500"
              style={{ background: loaded ? cfg.color : 'rgba(255,255,255,0.1)', boxShadow: loaded ? `0 0 6px ${cfg.color}88` : 'none' }} />
          )
        })}
      </div>
      <p className="text-xs" style={{ color: 'rgba(148,163,184,0.45)' }}>
        {generando ? `${cargadas} / ${SECCIONES_ESPERADAS.length} secciones…` : `Plan completo · ${cargadas} secciones`}
      </p>
    </div>
  )
}

// ─── Panel de fuentes académicas ─────────────────────────────────────────────

function FuentesAcademicasPanel({ fuentes }: { fuentes: FuenteAcademica[] }) {
  const [abierto, setAbierto] = useState(true)
  if (!fuentes.length) return null
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(6,182,212,0.03)', border: '1px solid rgba(6,182,212,0.15)' }}>
      <button onClick={() => setAbierto((v) => !v)} className="flex w-full items-center gap-2.5 px-5 py-3 text-left" style={{ borderBottom: abierto ? '1px solid rgba(6,182,212,0.1)' : 'none' }}>
        <Globe className="h-4 w-4 text-cyan-400 flex-shrink-0" />
        <p className="flex-1 text-xs font-semibold text-cyan-400">
          Bibliografía externa sugerida ({fuentes.length} fuentes — OpenAlex)
        </p>
        <ChevronDown className={`h-3.5 w-3.5 text-cyan-600 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <div className="px-4 py-3 space-y-3">
          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
            Estos textos <strong className="text-white">no están en tu biblioteca</strong>. Son sugerencias para ampliar el corpus. Buscalos por DOI o en el enlace de acceso abierto.
          </p>
          <div className="space-y-2.5">
            {fuentes.map((f, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(6,182,212,0.1)' }}>
                <p className="text-sm font-medium text-white leading-snug">{f.titulo}</p>
                <p className="mt-0.5 text-xs" style={{ color: 'rgba(148,163,184,0.65)' }}>
                  {f.autores}{f.año ? ` · ${f.año}` : ''}{f.revista ? ` · ${f.revista}` : ''}{f.citas > 0 ? ` · ${f.citas} citas` : ''}
                </p>
                {f.abstract && (
                  <p className="mt-1.5 text-xs leading-relaxed line-clamp-3" style={{ color: 'rgba(148,163,184,0.5)' }}>{f.abstract}</p>
                )}
                <div className="mt-2 flex gap-2 flex-wrap">
                  {f.doi && (
                    <a href={`https://doi.org/${f.doi}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors"
                      style={{ background: 'rgba(6,182,212,0.1)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.2)' }}>
                      <ExternalLink className="h-2.5 w-2.5" /> DOI
                    </a>
                  )}
                  {f.urlAbierto && (
                    <a href={f.urlAbierto} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors"
                      style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                      <ExternalLink className="h-2.5 w-2.5" /> Acceso abierto
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
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
  const [buscarEnWeb, setBuscarEnWeb] = useState(false)
  const [generando, setGenerando]     = useState(false)
  const [texto, setTexto]             = useState('')
  const [meta, setMeta]               = useState<Meta | null>(null)
  const [fuentesAcademicas, setFuentesAcademicas] = useState<FuenteAcademica[]>([])
  const [error, setError]             = useState<string | null>(null)

  const [seguimiento, setSeguimiento]     = useState('')
  const [chatTexto, setChatTexto]         = useState('')
  const [enviando, setEnviando]           = useState(false)
  const [historialChat, setHistorialChat] = useState<Array<{ q: string; r: string }>>([])

  // Sesiones
  const [sesiones, setSesiones]               = useState<SesionTutor[]>([])
  const [sesionActualId, setSesionActualId]   = useState<string | null>(null)
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [cargandoSesiones, setCargandoSesiones] = useState(false)

  // Carpetas
  const [carpetas, setCarpetas]                   = useState<Carpeta[]>([])
  const [carpetasFiltro, setCarpetasFiltro]       = useState<string[]>([])
  const [carpetasSelectorAbierto, setCarpetasSelectorAbierto] = useState(false)

  const textareaRef   = useRef<HTMLTextAreaElement>(null)
  const chatRef       = useRef<HTMLInputElement>(null)
  const planBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (generando || enviando) planBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [texto, chatTexto, generando, enviando])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [descripcion])

  // ── Cargar sesiones y carpetas al montar ─────────────────────────────────
  useEffect(() => {
    setCargandoSesiones(true)
    fetch('/api/tutor/sesiones')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSesiones(data) })
      .catch(() => {})
      .finally(() => setCargandoSesiones(false))

    fetch('/api/carpetas')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCarpetas(data) })
      .catch(() => {})
  }, [])

  // ── CRUD sesiones ─────────────────────────────────────────────────────────
  function guardarSesion(planTexto: string, chatActual: Array<{ q: string; r: string }>) {
    const id = sesionActualId ?? `ses_${Date.now()}`
    setSesionActualId(id)
    const sesion: SesionTutor = { id, fecha: new Date().toISOString(), tipo, descripcion, perspectiva, planTexto, historialChat: chatActual }
    fetch('/api/tutor/sesiones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sesion) }).catch(() => {})
    setSesiones((prev) => {
      const idx = prev.findIndex((s) => s.id === id)
      if (idx >= 0) { const n = [...prev]; n[idx] = sesion; return n }
      return [sesion, ...prev].slice(0, 20)
    })
  }

  function eliminarSesion(id: string) {
    fetch('/api/tutor/sesiones', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {})
    setSesiones((prev) => prev.filter((s) => s.id !== id))
    if (sesionActualId === id) setSesionActualId(null)
  }

  function cargarSesion(sesion: SesionTutor) {
    setTipo(sesion.tipo)
    setDescripcion(sesion.descripcion)
    setPerspectiva(sesion.perspectiva ?? '')
    setTexto(sesion.planTexto)
    setHistorialChat(sesion.historialChat)
    setSesionActualId(sesion.id)
    setMeta(null)
    setFuentesAcademicas([])
    setError(null)
    setChatTexto('')
    setSeguimiento('')
    setHistorialAbierto(false)
  }

  // ── Stream helper ─────────────────────────────────────────────────────────
  async function consumirStream(
    body: object,
    onMeta: (m: Meta) => void,
    onTexto: (t: string) => void,
    onFuentesAcademicas: (f: FuenteAcademica[]) => void,
    onDone: () => void,
    onError: (e: string) => void,
  ) {
    const res = await fetch('/api/tutor/planificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => '')
      let mensaje: string
      try { const d = JSON.parse(txt); mensaje = d.error ?? `Error ${res.status}` }
      catch { mensaje = `Error ${res.status}${res.statusText ? `: ${res.statusText}` : ''}` }
      onError(mensaje)
      return
    }
    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let doneCalled = false
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
          if (d.meta)             onMeta(d.meta)
          if (d.texto)            onTexto(d.texto)
          if (d.fuentesAcademicas) onFuentesAcademicas(d.fuentesAcademicas)
          if (d.done)             { doneCalled = true; onDone() }
          if (d.error)            onError(d.error)
        } catch { /* skip malformed */ }
      }
    }
    if (!doneCalled) onDone()
  }

  // ── Planificar ────────────────────────────────────────────────────────────
  async function planificar() {
    if (!descripcion.trim() || generando) return
    setGenerando(true)
    setTexto('')
    setMeta(null)
    setFuentesAcademicas([])
    setError(null)
    setHistorialChat([])
    setChatTexto('')
    setSesionActualId(null)

    let acum = ''
    try {
      await consumirStream(
        { tipo, descripcion, perspectiva, buscarEnWeb, carpetasIds: carpetasFiltro.length ? carpetasFiltro : undefined },
        (m) => setMeta(m),
        (t) => { acum += t; setTexto(acum) },
        (f) => setFuentesAcademicas(f),
        () => {
          setGenerando(false)
          guardarSesion(acum, [])
        },
        (e) => { setError(e); setGenerando(false) },
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red al conectar con el tutor')
      setGenerando(false)
    }
  }

  // ── Follow-up ─────────────────────────────────────────────────────────────
  async function enviarSeguimiento() {
    if (!seguimiento.trim() || enviando || !texto) return
    setEnviando(true)
    const pregunta = seguimiento
    setSeguimiento('')
    setChatTexto('')

    let respuesta = ''
    try {
      await consumirStream(
        { seguimiento: pregunta, planTexto: texto, buscarEnWeb },
        () => {},
        (t) => { respuesta += t; setChatTexto(respuesta) },
        () => {},
        () => {
          const nuevaEntrada = { q: pregunta, r: respuesta }
          const nuevoHistorial = [...historialChat, nuevaEntrada]
          setHistorialChat(nuevoHistorial)
          setChatTexto('')
          setEnviando(false)
          guardarSesion(texto, nuevoHistorial)
        },
        (e) => { setError(e); setEnviando(false) },
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red al conectar con el tutor')
      setEnviando(false)
    }
  }

  const secciones = texto ? parsearSecciones(texto) : []
  const hayPlan   = secciones.length > 0 || generando

  function formatFecha(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-6 lg:flex-row">

      {/* ── Panel izquierdo ─────────────────────────────────────────────── */}
      <aside className="w-full flex-shrink-0 lg:w-80 xl:w-96 space-y-3">

        {/* Formulario */}
        <div className="rounded-2xl p-5 space-y-5" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}>
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Tutor Académico</h1>
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>Metodología · Bibliografía · Planificación</p>
            </div>
          </div>

          {/* Tipo */}
          <div>
            <label className="mb-2 block text-xs font-medium" style={{ color: 'rgba(148,163,184,0.6)' }}>Tipo de trabajo</label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS.map((t) => (
                <button key={t.id} onClick={() => setTipo(t.id)} className="rounded-full px-3 py-1 text-xs transition-all"
                  style={tipo === t.id
                    ? { background: 'linear-gradient(90deg, rgba(109,40,217,0.4), rgba(30,58,138,0.3))', border: '1px solid rgba(139,92,246,0.5)', color: '#c4b5fd' }
                    : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.6)' }
                  }>{t.label}</button>
              ))}
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="mb-2 block text-xs font-medium" style={{ color: 'rgba(148,163,184,0.6)' }}>Describí tu trabajo</label>
            <textarea
              ref={textareaRef} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: quiero hacer un artículo sobre el trabajo no registrado en Argentina desde una perspectiva histórico-sociológica…"
              rows={4} className="w-full resize-none rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', minHeight: 96, maxHeight: 220, lineHeight: 1.6 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) planificar() }}
            />
          </div>

          {/* Perspectiva */}
          <div>
            <label className="mb-2 block text-xs font-medium" style={{ color: 'rgba(148,163,184,0.6)' }}>
              Perspectiva / enfoque <span style={{ color: 'rgba(148,163,184,0.35)' }}>(opcional)</span>
            </label>
            <input type="text" value={perspectiva} onChange={(e) => setPerspectiva(e.target.value)}
              placeholder="Ej: marxismo histórico, teoría de la dependencia…"
              className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            />
          </div>

          {/* Selector de carpetas */}
          {carpetas.length > 0 && (() => {
            const sinCarpeta = carpetas.reduce((acc, c) => acc - c.documentosIds.length, meta?.totalDocs ?? 0)
            const toggleCarpeta = (id: string) =>
              setCarpetasFiltro((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            const seleccionadas = carpetasFiltro.length
            return (
              <div className="rounded-xl overflow-hidden" style={{ border: seleccionadas > 0 ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.07)', background: seleccionadas > 0 ? 'rgba(139,92,246,0.05)' : 'rgba(255,255,255,0.03)' }}>
                <button onClick={() => setCarpetasSelectorAbierto((v) => !v)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
                  <Folder className="h-4 w-4 flex-shrink-0" style={{ color: seleccionadas > 0 ? '#a78bfa' : 'rgba(148,163,184,0.4)' }} />
                  <div className="flex-1">
                    <p className="text-xs font-medium" style={{ color: seleccionadas > 0 ? '#a78bfa' : 'rgba(148,163,184,0.6)' }}>
                      {seleccionadas > 0 ? `${seleccionadas} carpeta${seleccionadas > 1 ? 's' : ''} seleccionada${seleccionadas > 1 ? 's' : ''}` : 'Filtrar por carpetas'}
                    </p>
                    <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.35)' }}>
                      {seleccionadas > 0 ? 'Solo esas carpetas van al tutor' : 'Todas incluidas por defecto'}
                    </p>
                  </div>
                  {seleccionadas > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); setCarpetasFiltro([]) }}
                      className="rounded px-1.5 py-0.5 text-[10px] flex-shrink-0"
                      style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                      Limpiar
                    </button>
                  )}
                  <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${carpetasSelectorAbierto ? 'rotate-180' : ''}`} style={{ color: 'rgba(148,163,184,0.4)' }} />
                </button>

                {carpetasSelectorAbierto && (
                  <div className="px-3 pb-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="pt-2 pb-1 text-[10px]" style={{ color: 'rgba(148,163,184,0.4)' }}>
                      Elegí qué carpetas usar. Vacío = todas.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {carpetas.map((c) => {
                        const color = CARPETA_COLORS[c.color] ?? '#94a3b8'
                        const activa = carpetasFiltro.includes(c.id)
                        return (
                          <button key={c.id} onClick={() => toggleCarpeta(c.id)}
                            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-all"
                            style={{
                              background: activa ? `${color}22` : 'rgba(255,255,255,0.04)',
                              border: activa ? `1px solid ${color}55` : '1px solid rgba(255,255,255,0.08)',
                              color: activa ? color : 'rgba(148,163,184,0.6)',
                            }}>
                            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                            {c.nombre}
                            <span className="opacity-50">({c.documentosIds.length})</span>
                          </button>
                        )
                      })}
                      {sinCarpeta > 0 && (() => {
                        const activa = carpetasFiltro.includes(SIN_CARPETA_ID)
                        return (
                          <button onClick={() => toggleCarpeta(SIN_CARPETA_ID)}
                            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-all"
                            style={{
                              background: activa ? 'rgba(148,163,184,0.12)' : 'rgba(255,255,255,0.04)',
                              border: activa ? '1px solid rgba(148,163,184,0.35)' : '1px solid rgba(255,255,255,0.08)',
                              color: activa ? '#94a3b8' : 'rgba(148,163,184,0.5)',
                            }}>
                            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: '#94a3b8' }} />
                            Sin carpeta
                            <span className="opacity-50">({sinCarpeta})</span>
                          </button>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Toggle web */}
          <button onClick={() => setBuscarEnWeb((v) => !v)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all"
            style={{ background: buscarEnWeb ? 'rgba(6,182,212,0.08)' : 'rgba(255,255,255,0.03)', border: buscarEnWeb ? '1px solid rgba(6,182,212,0.3)' : '1px solid rgba(255,255,255,0.07)' }}>
            <Globe className="h-4 w-4 flex-shrink-0" style={{ color: buscarEnWeb ? '#22d3ee' : 'rgba(148,163,184,0.4)' }} />
            <div className="flex-1 text-left">
              <p className="text-xs font-medium" style={{ color: buscarEnWeb ? '#22d3ee' : 'rgba(148,163,184,0.6)' }}>
                {buscarEnWeb ? 'Biblioteca + OpenAlex' : 'Agregar búsqueda académica externa'}
              </p>
              <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.35)' }}>
                {buscarEnWeb ? 'Biblioteca siempre incluida · + OpenAlex 250M+ papers' : 'Biblioteca siempre incluida · activar para sumar OpenAlex'}
              </p>
            </div>
            <div className="h-5 w-9 rounded-full transition-all flex-shrink-0 relative" style={{ background: buscarEnWeb ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.1)' }}>
              <span className="absolute top-0.5 h-4 w-4 rounded-full transition-all" style={{ background: buscarEnWeb ? '#22d3ee' : 'rgba(148,163,184,0.5)', left: buscarEnWeb ? '18px' : '2px' }} />
            </div>
          </button>

          {/* Botón */}
          <button onClick={planificar} disabled={!descripcion.trim() || generando}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 18px rgba(124,58,237,0.35)' }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 28px rgba(124,58,237,0.55)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 18px rgba(124,58,237,0.35)' }}>
            {generando ? <><Loader2 className="h-4 w-4 animate-spin" /> Analizando…</> : <><Sparkles className="h-4 w-4" /> Planificar trabajo</>}
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
              {meta.fragmentosAnalizados === 0 && meta.totalDocs > 0 && (
                <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(251,191,36,0.65)' }}>
                  Los documentos están en la biblioteca pero sin indexar. Indexalos desde <strong style={{ color: 'rgba(251,191,36,0.85)' }}>Biblioteca → Indexar</strong> para obtener análisis profundo de contenido. La bibliografía completa igualmente se incluye.
                </p>
              )}
              {meta.docsRelevantes.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium" style={{ color: 'rgba(148,163,184,0.45)' }}>Más relevantes:</p>
                  <div className="space-y-1">
                    {meta.docsRelevantes.slice(0, 4).map((d) => (
                      <Link key={d.id} href={`/lector/${d.id}`}
                        className="flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}>
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

        {/* Historial de sesiones */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setHistorialAbierto((v) => !v)}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
            <History className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'rgba(148,163,184,0.5)' }} />
            <p className="flex-1 text-xs font-medium" style={{ color: 'rgba(148,163,184,0.6)' }}>
              Historial {sesiones.length > 0 && <span style={{ color: 'rgba(148,163,184,0.35)' }}>({sesiones.length})</span>}
            </p>
            {cargandoSesiones
              ? <Loader2 className="h-3 w-3 animate-spin" style={{ color: 'rgba(148,163,184,0.3)' }} />
              : <ChevronDown className={`h-3.5 w-3.5 transition-transform ${historialAbierto ? 'rotate-180' : ''}`} style={{ color: 'rgba(148,163,184,0.4)' }} />
            }
          </button>

          {historialAbierto && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {sesiones.length === 0 ? (
                <p className="px-4 py-3 text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>No hay sesiones guardadas aún.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  {sesiones.map((s) => (
                    <div key={s.id} className="group flex items-start gap-2 px-3 py-2.5 transition-colors"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.06)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '' }}>
                      <button onClick={() => cargarSesion(s)} className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                            {TIPOS.find((t) => t.id === s.tipo)?.label ?? s.tipo}
                          </span>
                          <span className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(148,163,184,0.35)' }}>
                            <Clock className="h-2.5 w-2.5" />{formatFecha(s.fecha)}
                          </span>
                        </div>
                        <p className="truncate text-xs text-white">{s.descripcion}</p>
                      </button>
                      <button onClick={() => eliminarSesion(s.id)}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                        style={{ color: 'rgba(248,113,113,0.6)' }}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Panel derecho ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-3">

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
                Describí tu trabajo en el panel izquierdo y la IA analizará tu biblioteca para guiarte.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
              {['Diagnóstico crítico', 'Bibliografía priorizada', 'Diseño metodológico', 'Fuentes académicas externas'].map((tag) => (
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

        {/* Generando sin secciones */}
        {generando && !secciones.length && (
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
              <p className="text-sm text-white">Analizando tu biblioteca y construyendo el plan…</p>
            </div>
            {texto && (
              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(148,163,184,0.5)' }}>{texto.slice(-400)}</p>
            )}
          </div>
        )}

        {/* Fuentes académicas — aparecen antes del texto para no interrumpir el streaming */}
        {fuentesAcademicas.length > 0 && (
          <FuentesAcademicasPanel fuentes={fuentesAcademicas} />
        )}

        {/* Plan */}
        {hayPlan && secciones.length > 0 && (
          <>
            <ProgresoSecciones secciones={secciones} generando={generando} />
            {secciones.map((s, i) => <SeccionCard key={`${s.titulo}-${i}`} seccion={s} />)}
            {generando && (
              <div className="flex items-center gap-2 rounded-2xl px-5 py-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
                  Completando sección {secciones.length} de {SECCIONES_ESPERADAS.length}…
                </p>
              </div>
            )}
          </>
        )}

        {/* Chat de seguimiento */}
        {!generando && texto && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {historialChat.length > 0 && (
              <div className="space-y-4 p-5">
                {historialChat.map((turno, i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex justify-end">
                      <div className="max-w-xl rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white" style={{ background: 'rgba(109,40,217,0.25)', border: '1px solid rgba(139,92,246,0.2)' }}>{turno.q}</div>
                    </div>
                    <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Parrafo texto={turno.r} color="rgba(139,92,246,0.9)" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {enviando && chatTexto && (
              <div className="px-5 pb-4">
                <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(203,213,225,0.85)', whiteSpace: 'pre-wrap' }}>{chatTexto}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 border-t px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <GraduationCap className="h-4 w-4 flex-shrink-0" style={{ color: 'rgba(139,92,246,0.6)' }} />
              <input ref={chatRef} type="text" value={seguimiento} onChange={(e) => setSeguimiento(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviarSeguimiento()}
                placeholder="Preguntá sobre el plan, pedí ajustes, profundizá en alguna sección…"
                className="flex-1 bg-transparent text-sm text-white placeholder-neutral-600 focus:outline-none" disabled={enviando} />
              {enviando
                ? <Loader2 className="h-4 w-4 animate-spin text-violet-400 flex-shrink-0" />
                : <button onClick={enviarSeguimiento} disabled={!seguimiento.trim()}
                    className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 transition-all disabled:opacity-30"
                    style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>
                    <Send className="h-3.5 w-3.5" />
                  </button>
              }
            </div>
          </div>
        )}

        {/* Reset */}
        {texto && !generando && (
          <button
            onClick={() => { setTexto(''); setMeta(null); setHistorialChat([]); setChatTexto(''); setFuentesAcademicas([]); setSesionActualId(null) }}
            className="flex items-center gap-2 text-xs transition-colors"
            style={{ color: 'rgba(148,163,184,0.35)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.7)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.35)' }}>
            <RotateCcw className="h-3 w-3" /> Nuevo plan
          </button>
        )}

        <div ref={planBottomRef} />
      </div>
    </div>
  )
}
