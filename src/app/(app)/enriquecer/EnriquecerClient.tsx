'use client'

import { useState, useRef, useCallback, DragEvent, MouseEvent } from 'react'
import Link from 'next/link'
import {
  Sparkles, Upload, FileText, Quote, StickyNote, BookOpen,
  Loader2, AlertCircle, ArrowRight, X, ChevronDown, ChevronUp,
  Clock, BookmarkPlus, Check, Download,
} from 'lucide-react'
import type { Recomendacion } from '@/app/api/enriquecer/route'
import { useScope, scopeParam } from '@/lib/scope-context'

interface SesionEnriquecer {
  id: string
  fecha: string
  textoGuardado: string
  analisis: string
  recomendaciones: Recomendacion[]
  fragmentosIncluidos: number
}

const MAX_CHARS = 12000

function badge(tipo: Recomendacion['tipo']) {
  if (tipo === 'cita') return { label: 'Cita', color: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)', text: '#c4b5fd', Icon: Quote }
  if (tipo === 'nota') return { label: 'Nota', color: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.25)', text: '#67e8f9', Icon: StickyNote }
  if (tipo === 'fragmento') return { label: 'Pasaje', color: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', text: '#6ee7b7', Icon: BookOpen }
  return { label: 'Documento', color: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)', text: '#fde68a', Icon: BookOpen }
}

function linkFor(r: Recomendacion) {
  if (r.tipo === 'cita') return '/citas'
  if (r.tipo === 'nota') return '/notas'
  if ((r.tipo === 'fragmento' || r.tipo === 'documento') && r.pagina)
    return `/lector/${r.itemId}?page=${r.pagina}`
  return `/lector/${r.itemId}`
}

function RecomendacionCard({
  r,
  onGuardarNota,
  yaGuardada,
  guardando,
}: {
  r: Recomendacion
  onGuardarNota?: () => void
  yaGuardada?: boolean
  guardando?: boolean
}) {
  const [expandida, setExpandida] = useState(false)
  const b = badge(r.tipo)
  const Icon = b.Icon

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header row */}
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
        onClick={() => setExpandida(!expandida)}
      >
        <div
          className="mt-0.5 flex-shrink-0 h-6 w-6 rounded-lg flex items-center justify-center"
          style={{ background: b.color, border: `1px solid ${b.border}` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: b.text }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{ background: b.color, border: `1px solid ${b.border}`, color: b.text }}
            >
              {b.label}
            </span>
            {r.relevancia === 'alta' && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(52,211,153,0.85)' }}
              >
                Alta relevancia
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-white leading-snug truncate">{r.titulo}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {r.autor && <span className="text-xs truncate" style={{ color: 'rgba(148,163,184,0.5)' }}>{r.autor}</span>}
            {r.pagina && (
              <span className="text-xs rounded px-1.5 py-0.5" style={{ background: 'rgba(16,185,129,0.1)', color: '#6ee7b7' }}>
                p. {r.pagina}
              </span>
            )}
          </div>
        </div>
        <span className="flex-shrink-0 mt-1" style={{ color: 'rgba(148,163,184,0.35)' }}>
          {expandida ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Expandible detail */}
      {expandida && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          {/* Razon */}
          <div className="pt-3">
            <p className="text-xs font-medium mb-1" style={{ color: 'rgba(139,92,246,0.6)' }}>Por qué complementa tu texto</p>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(203,213,225,0.8)' }}>{r.razon}</p>
          </div>

          {/* Parrafo del texto relacionado */}
          {r.parrafo && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'rgba(148,163,184,0.4)' }}>Relacionado con</p>
              <p
                className="text-xs italic leading-relaxed px-3 py-2 rounded-lg border-l-2"
                style={{ color: 'rgba(148,163,184,0.6)', background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(139,92,246,0.3)' }}
              >
                &ldquo;{r.parrafo}&rdquo;
              </p>
            </div>
          )}

          {/* Fragmento del recurso */}
          {r.fragmento && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'rgba(148,163,184,0.4)' }}>Fragmento</p>
              <p
                className="text-xs italic leading-relaxed px-3 py-2 rounded-lg"
                style={{ color: 'rgba(203,213,225,0.65)', background: 'rgba(109,40,217,0.06)' }}
              >
                &ldquo;{r.fragmento}…&rdquo;
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={linkFor(r)}
              className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ color: '#a78bfa' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#c4b5fd' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#a78bfa' }}
            >
              {r.tipo === 'fragmento' && r.pagina ? `Ir a p. ${r.pagina}` : 'Ver en BiblioIA'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            {onGuardarNota && (
              yaGuardada ? (
                <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'rgba(52,211,153,0.7)' }}>
                  <Check className="h-3 w-3" /> Guardada
                </span>
              ) : (
                <button
                  onClick={onGuardarNota}
                  disabled={guardando}
                  className="inline-flex items-center gap-1 text-xs transition-colors disabled:opacity-50"
                  style={{ color: 'rgba(148,163,184,0.5)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#e2e8f0' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.5)' }}
                >
                  {guardando ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookmarkPlus className="h-3 w-3" />}
                  Guardar como nota
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function EnriquecerClient() {
  const [texto, setTexto] = useState('')
  const [arrastrando, setArrastrando] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [error, setError] = useState('')
  const [analisis, setAnalisis] = useState('')
  const [recomendaciones, setRecomendaciones] = useState<Recomendacion[]>([])
  const [fragmentosIncluidos, setFragmentosIncluidos] = useState(0)
  const [warningFragmentos, setWarningFragmentos] = useState('')
  const [yaAnalizado, setYaAnalizado] = useState(false)
  const [paginaActual, setPaginaActual] = useState(0)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [hayMas, setHayMas] = useState(true)
  const [todosLosIds, setTodosLosIds] = useState<string[]>([])
  const [mostrandoHistorial, setMostrandoHistorial] = useState(false)
  const [sesiones, setSesiones] = useState<SesionEnriquecer[]>([])
  const [cargandoSesiones, setCargandoSesiones] = useState(false)
  const [notasGuardadas, setNotasGuardadas] = useState<Set<string>>(new Set())
  const [guardandoNota, setGuardandoNota] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { scope } = useScope()

  const cargarArchivo = useCallback(async (file: File) => {
    const nombre = file.name.toLowerCase()
    if (nombre.endsWith('.txt')) {
      const t = await file.text()
      setTexto(t.slice(0, MAX_CHARS))
      return
    }
    if (nombre.endsWith('.docx')) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/enriquecer/extraer', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setTexto((data.texto as string).slice(0, MAX_CHARS))
      return
    }
    setError('Formato no soportado. Usá .txt o .docx, o pegá el texto directamente.')
  }, [])

  const onDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setArrastrando(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await cargarArchivo(file)
  }, [cargarArchivo])

  const analizar = useCallback(async () => {
    if (!texto.trim() || analizando) return
    setAnalizando(true)
    setTabMobile('resultados')
    setError('')
    setRecomendaciones([])
    setAnalisis('')
    setFragmentosIncluidos(0)
    setWarningFragmentos('')
    setYaAnalizado(false)
    setPaginaActual(0)
    setHayMas(true)
    setTodosLosIds([])
    try {
      const res = await fetch('/api/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, ...scopeParam(scope) }),
      })
      if (!res.ok && res.headers.get('content-type')?.includes('application/json') === false) {
        setError('El análisis tardó demasiado. Intentá con un texto más corto o menos documentos indexados.')
        return
      }
      const data = await res.json().catch(() => ({ error: 'Respuesta inválida del servidor. Intentá de nuevo.' }))
      if (data.error) { setError(data.error); return }
      const recs: Recomendacion[] = data.recomendaciones ?? []
      setAnalisis(data.analisis ?? '')
      setRecomendaciones(recs)
      setFragmentosIncluidos(data.fragmentosIncluidos ?? 0)
      setWarningFragmentos(data.warningFragmentos ?? '')
      setTodosLosIds(recs.map((r) => r.itemId))
      setYaAnalizado(true)
      // Auto-guardar sesión en Drive (fire-and-forget)
      fetch('/api/enriquecer/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `enr_${Date.now()}`,
          fecha: new Date().toISOString(),
          textoGuardado: texto.slice(0, 3000),
          analisis: data.analisis ?? '',
          recomendaciones: recs,
          fragmentosIncluidos: data.fragmentosIncluidos ?? 0,
        }),
      }).catch(() => {})
    } catch (e) {
      setError(String(e))
    } finally {
      setAnalizando(false)
    }
  }, [texto, analizando])

  const buscarMas = useCallback(async () => {
    if (cargandoMas) return
    setCargandoMas(true)
    const nuevaPagina = paginaActual + 1
    try {
      const res = await fetch('/api/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, ...scopeParam(scope), pagina: nuevaPagina, excluirIds: todosLosIds }),
      })
      const data = await res.json().catch(() => ({ error: 'Respuesta inválida del servidor.' }))
      if (data.error) { setError(data.error); setCargandoMas(false); return }
      const nuevas: Recomendacion[] = data.recomendaciones ?? []
      if (nuevas.length === 0) { setHayMas(false); setCargandoMas(false); return }
      setPaginaActual(nuevaPagina)
      setRecomendaciones((prev) => [...prev, ...nuevas])
      setTodosLosIds((prev) => [...prev, ...nuevas.map((r) => r.itemId)])
      setFragmentosIncluidos((prev) => prev + (data.fragmentosIncluidos ?? 0))
    } catch (e) {
      setError(String(e))
    } finally {
      setCargandoMas(false)
    }
  }, [cargandoMas, paginaActual, texto, scope, todosLosIds])

  const verHistorial = useCallback(async () => {
    if (mostrandoHistorial) { setMostrandoHistorial(false); return }
    setCargandoSesiones(true)
    setMostrandoHistorial(true)
    try {
      const res = await fetch('/api/enriquecer/sesiones')
      const data = await res.json()
      setSesiones(Array.isArray(data) ? data : [])
    } catch {}
    finally { setCargandoSesiones(false) }
  }, [mostrandoHistorial])

  const cargarSesion = useCallback((s: SesionEnriquecer) => {
    setTexto(s.textoGuardado)
    setAnalisis(s.analisis)
    setRecomendaciones(s.recomendaciones)
    setFragmentosIncluidos(s.fragmentosIncluidos)
    setTodosLosIds(s.recomendaciones.map((r) => r.itemId))
    setYaAnalizado(true)
    setHayMas(true)
    setPaginaActual(0)
    setError('')
    setNotasGuardadas(new Set())
    setMostrandoHistorial(false)
  }, [])

  const eliminarSesion = useCallback(async (id: string, e: MouseEvent) => {
    e.stopPropagation()
    setSesiones((prev) => prev.filter((s) => s.id !== id))
    fetch('/api/enriquecer/sesiones', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }, [])

  const guardarComoNota = useCallback(async (r: Recomendacion) => {
    if (guardandoNota === r.itemId) return
    setGuardandoNota(r.itemId)
    const lineas = [
      `**Por qué es relevante:** ${r.razon}`,
      r.fragmento ? `\n**Fragmento:**\n> ${r.fragmento}` : '',
      r.parrafo ? `\n**Contexto en mi texto:**\n> ${r.parrafo}` : '',
    ].filter(Boolean)
    const body: Record<string, unknown> = {
      titulo: r.titulo,
      tipo: 'referencia',
      contenido: lineas.join('\n'),
      etiquetas: [],
    }
    if (r.tipo === 'fragmento' || r.tipo === 'documento') {
      body.documentoOrigenId = r.itemId
      if (r.pagina) body.paginaOrigen = r.pagina
      if (r.fragmento) body.fragmentoTexto = r.fragmento
    } else if (r.tipo === 'cita') {
      body.citaOrigenId = r.itemId
    }
    try {
      const res = await fetch('/api/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) setNotasGuardadas((prev) => new Set([...prev, r.itemId]))
    } catch {}
    finally { setGuardandoNota(null) }
  }, [guardandoNota])

  const [tabMobile, setTabMobile] = useState<'editor' | 'resultados'>('editor')

  const altaRel = recomendaciones.filter((r) => r.relevancia === 'alta')
  const mediaRel = recomendaciones.filter((r) => r.relevancia !== 'alta')

  const porcentaje = Math.min(100, Math.round((texto.length / MAX_CHARS) * 100))

  function exportarResultados() {
    if (!yaAnalizado || recomendaciones.length === 0) return
    const fecha = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
    const lineas: string[] = [
      `# Enriquecimiento bibliográfico — BiblioIA`,
      `**Fecha:** ${fecha}\n`,
      `## Análisis del texto\n\n${analisis}\n`,
    ]
    if (altaRel.length > 0) {
      lineas.push(`## Alta relevancia\n`)
      altaRel.forEach((r) => {
        lineas.push(`### ${r.titulo}`)
        if (r.autor) lineas.push(`**Autor:** ${r.autor}${r.pagina ? ` — p. ${r.pagina}` : ''}`)
        lineas.push(`**Por qué:** ${r.razon}`)
        if (r.fragmento) lineas.push(`> "${r.fragmento}…"\n`)
        else lineas.push('')
      })
    }
    if (mediaRel.length > 0) {
      lineas.push(`## Complementarios\n`)
      mediaRel.forEach((r) => {
        lineas.push(`### ${r.titulo}`)
        if (r.autor) lineas.push(`**Autor:** ${r.autor}${r.pagina ? ` — p. ${r.pagina}` : ''}`)
        lineas.push(`**Por qué:** ${r.razon}`)
        if (r.fragmento) lineas.push(`> "${r.fragmento}…"\n`)
        else lineas.push('')
      })
    }
    lineas.push(`---\n*Exportado desde BiblioIA*`)
    const blob = new Blob([lineas.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `enriquecimiento_${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#080812' }}>

      {/* ── Tabs mobile ──────────────────────────────────────────────────── */}
      <div
        className="flex md:hidden flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {(['editor', 'resultados'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setTabMobile(tab)}
            className="flex-1 py-2.5 text-xs font-semibold capitalize transition-colors"
            style={tabMobile === tab
              ? { color: '#a78bfa', borderBottom: '2px solid #a78bfa' }
              : { color: 'rgba(148,163,184,0.4)', borderBottom: '2px solid transparent' }
            }
          >
            {tab === 'editor' ? 'Tu texto' : `Recomendaciones${recomendaciones.length > 0 ? ` (${recomendaciones.length})` : ''}`}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">

      {/* ── LEFT: Editor de texto ─────────────────────────────────────────── */}
      <div
        className={`${tabMobile === 'editor' ? 'flex' : 'hidden'} md:flex flex-col md:border-r w-full md:w-[52%] flex-shrink-0`}
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
            >
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Enriquecer texto</h1>
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
                Pegá o subí tu texto y la IA lo conecta con tu biblioteca
              </p>
            </div>
          </div>

          {texto && (
            <button
              onClick={() => { setTexto(''); setRecomendaciones([]); setAnalisis(''); setYaAnalizado(false) }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(148,163,184,0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#e2e8f0' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Drop zone + textarea */}
        <div
          className="flex-1 relative overflow-hidden"
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={onDrop}
        >
          {arrastrando && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-none"
              style={{ background: 'rgba(109,40,217,0.15)', border: '2px dashed rgba(139,92,246,0.5)' }}
            >
              <Upload className="h-8 w-8" style={{ color: '#a78bfa' }} />
              <p className="text-sm font-medium text-white">Soltá el archivo aquí</p>
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>.txt · .docx</p>
            </div>
          )}

          {texto === '' && !arrastrando && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}
              >
                <FileText className="h-7 w-7" style={{ color: 'rgba(139,92,246,0.5)' }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: 'rgba(148,163,184,0.5)' }}>Pegá tu texto aquí</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(148,163,184,0.3)' }}>
                  o arrastrá un .txt / .docx
                </p>
              </div>
            </div>
          )}

          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, MAX_CHARS))}
            placeholder=""
            className="absolute inset-0 w-full h-full resize-none bg-transparent px-5 py-5 text-sm leading-relaxed focus:outline-none font-[family-name:var(--font-lora)]"
            style={{ color: 'rgba(226,232,240,0.9)', caretColor: '#a78bfa' }}
          />
        </div>

        {/* Footer bar */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* File upload */}
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.docx"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) cargarArchivo(f) }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.6)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.6)' }}
          >
            <Upload className="h-3.5 w-3.5" /> Subir archivo
          </button>

          {/* Char counter */}
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${porcentaje}%`,
                  background: porcentaje > 90
                    ? 'rgba(239,68,68,0.7)'
                    : 'linear-gradient(90deg, rgba(139,92,246,0.5), rgba(6,182,212,0.4))',
                }}
              />
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'rgba(148,163,184,0.35)' }}>
              {texto.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>

          {/* Analyze button */}
          <button
            onClick={analizar}
            disabled={!texto.trim() || analizando}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.8), rgba(6,182,212,0.6))', color: '#fff' }}
          >
            {analizando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Analizando...</>
              : <><Sparkles className="h-4 w-4" /> Analizar</>
            }
          </button>
        </div>
      </div>

      {/* ── RIGHT: Resultados ─────────────────────────────────────────────── */}
      <div className={`${tabMobile === 'resultados' ? 'flex' : 'hidden'} md:flex flex-1 flex-col overflow-hidden`}>
        {/* Header */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div>
            <p className="text-sm font-semibold text-white">
              {mostrandoHistorial
                ? 'Historial de análisis'
                : yaAnalizado
                  ? `${recomendaciones.length} recurso${recomendaciones.length !== 1 ? 's' : ''} recomendado${recomendaciones.length !== 1 ? 's' : ''}`
                  : 'Recomendaciones'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.4)' }}>
              {mostrandoHistorial
                ? `${sesiones.length} análisis guardado${sesiones.length !== 1 ? 's' : ''}`
                : yaAnalizado
                  ? fragmentosIncluidos > 0
                    ? `${fragmentosIncluidos} fragmento${fragmentosIncluidos !== 1 ? 's' : ''} de PDFs incluido${fragmentosIncluidos !== 1 ? 's' : ''}`
                    : warningFragmentos
                      ? 'Solo metadatos de documentos (sin contenido indexado)'
                      : 'De tu biblioteca personal'
                  : 'Aparecerán aquí después de analizar'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {yaAnalizado && recomendaciones.length > 0 && (
              <button
                onClick={exportarResultados}
                title="Exportar como Markdown"
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'rgba(34,211,238,0.5)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#22d3ee' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(34,211,238,0.5)' }}
              >
                <Download className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={verHistorial}
              title="Historial de análisis"
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: mostrandoHistorial ? '#a78bfa' : 'rgba(148,163,184,0.35)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#a78bfa' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = mostrandoHistorial ? '#a78bfa' : 'rgba(148,163,184,0.35)' }}
            >
              <Clock className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* ── Historial panel ─────────────────────────────────────────── */}
          {mostrandoHistorial && (
            <div className="space-y-3">
              {cargandoSesiones && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'rgba(139,92,246,0.5)' }} />
                </div>
              )}
              {!cargandoSesiones && sesiones.length === 0 && (
                <div className="text-center py-16">
                  <Clock className="h-8 w-8 mx-auto mb-3" style={{ color: 'rgba(148,163,184,0.15)' }} />
                  <p className="text-sm" style={{ color: 'rgba(148,163,184,0.4)' }}>
                    Todavía no hay análisis guardados
                  </p>
                </div>
              )}
              {sesiones.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl p-4 cursor-pointer transition-all"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                  onClick={() => cargarSesion(s)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.3)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs mb-1" style={{ color: 'rgba(148,163,184,0.4)' }}>
                        {new Date(s.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {' · '}{s.recomendaciones.length} recomendaciones
                        {s.fragmentosIncluidos > 0 && ` · ${s.fragmentosIncluidos} fragmentos`}
                      </p>
                      <p className="text-sm leading-snug line-clamp-2" style={{ color: 'rgba(203,213,225,0.75)' }}>
                        {s.textoGuardado.slice(0, 180)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => eliminarSesion(s.id, e)}
                      className="flex-shrink-0 p-1 rounded transition-colors"
                      style={{ color: 'rgba(148,163,184,0.25)' }}
                      onMouseEnter={(ev) => { ev.currentTarget.style.color = '#f87171' }}
                      onMouseLeave={(ev) => { ev.currentTarget.style.color = 'rgba(148,163,184,0.25)' }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Normal results ───────────────────────────────────────────── */}
          {!mostrandoHistorial && (
            <>
              {/* Error */}
              {error && (
                <div
                  className="flex items-start gap-3 rounded-xl p-4 mb-4 text-sm"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {/* Loading */}
              {analizando && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.1))', border: '1px solid rgba(139,92,246,0.2)' }}
                  >
                    <Sparkles className="h-7 w-7 animate-pulse" style={{ color: 'rgba(139,92,246,0.8)' }} />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium">Analizando tu texto</p>
                    <p className="text-xs mt-1" style={{ color: 'rgba(148,163,184,0.5)' }}>
                      Buscando conexiones en tu biblioteca...
                    </p>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!analizando && !yaAnalizado && !error && (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <Sparkles className="h-7 w-7" style={{ color: 'rgba(148,163,184,0.2)' }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'rgba(148,163,184,0.4)' }}>
                    Pegá un texto a la izquierda
                  </p>
                  <p className="text-xs mt-1 max-w-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.25)' }}>
                    La IA analizará su contenido y buscará qué citas, notas y documentos de tu biblioteca lo pueden enriquecer
                  </p>
                </div>
              )}

              {/* Results */}
              {!analizando && yaAnalizado && (
                <div className="space-y-5">
                  {/* Analisis general */}
                  {analisis && (
                    <div
                      className="rounded-2xl p-4"
                      style={{ background: 'rgba(109,40,217,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}
                    >
                      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(139,92,246,0.6)' }}>
                        Análisis del texto
                      </p>
                      <p className="text-sm leading-relaxed" style={{ color: 'rgba(203,213,225,0.85)' }}>{analisis}</p>
                    </div>
                  )}

                  {/* No recommendations */}
                  {recomendaciones.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm" style={{ color: 'rgba(148,163,184,0.4)' }}>
                        No se encontraron recursos relevantes en tu biblioteca para este texto.
                      </p>
                    </div>
                  )}

                  {/* Alta relevancia */}
                  {altaRel.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(52,211,153,0.6)' }}>
                        Alta relevancia · {altaRel.length}
                      </p>
                      <div className="space-y-2">
                        {altaRel.map((r, i) => (
                          <RecomendacionCard
                            key={i} r={r}
                            onGuardarNota={() => guardarComoNota(r)}
                            yaGuardada={notasGuardadas.has(r.itemId)}
                            guardando={guardandoNota === r.itemId}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Media relevancia */}
                  {mediaRel.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(148,163,184,0.4)' }}>
                        Complementarios · {mediaRel.length}
                      </p>
                      <div className="space-y-2">
                        {mediaRel.map((r, i) => (
                          <RecomendacionCard
                            key={`m${i}`} r={r}
                            onGuardarNota={() => guardarComoNota(r)}
                            yaGuardada={notasGuardadas.has(r.itemId)}
                            guardando={guardandoNota === r.itemId}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Paginación */}
                  <div className="pt-2 flex justify-center">
                    {hayMas ? (
                      <button
                        onClick={buscarMas}
                        disabled={cargandoMas}
                        className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
                        style={{ background: 'rgba(109,40,217,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }}
                        onMouseEnter={(e) => { if (!cargandoMas) e.currentTarget.style.background = 'rgba(109,40,217,0.22)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(109,40,217,0.12)' }}
                      >
                        {cargandoMas
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> Buscando más...</>
                          : <><Sparkles className="h-4 w-4" /> Buscar 8 más</>
                        }
                      </button>
                    ) : (
                      recomendaciones.length > 0 && (
                        <p className="text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>
                          No hay más resultados disponibles
                        </p>
                      )
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      </div>{/* end flex wrapper */}
    </div>
  )
}
