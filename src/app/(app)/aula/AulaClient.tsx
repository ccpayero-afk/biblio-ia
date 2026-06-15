'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { BookOpen, GraduationCap, Plus, ChevronRight, Loader2, Send, ArrowLeft, Trash2, CheckCircle, Circle, PlayCircle, ChevronDown, ChevronUp, AlertCircle, ClipboardCheck, Star } from 'lucide-react'
import type { Documento, Curso, ModuloCurso, MensajeCurso } from '@/types'
import type { CursoResumen } from '@/lib/aula'
import type { PreguntaEvaluacion, ResultadoEvaluacion } from '@/app/api/aula/evaluar/route'

interface Props {
  documentos: Documento[]
}

type Vista = 'lista' | 'selector' | 'curso'

interface CursoActivo extends Curso {
  id: string
}

function ModuloItem({
  modulo,
  actual,
  onClick,
}: {
  modulo: ModuloCurso
  actual: boolean
  onClick: () => void
}) {
  const [expandido, setExpandido] = useState(actual)

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: actual ? 'rgba(109,40,217,0.12)' : 'rgba(255,255,255,0.02)',
        border: actual ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => { onClick(); setExpandido(!expandido) }}
      >
        <span className="flex-shrink-0">
          {actual
            ? <PlayCircle className="h-4 w-4" style={{ color: '#a78bfa' }} />
            : <Circle className="h-4 w-4" style={{ color: 'rgba(148,163,184,0.3)' }} />}
        </span>
        <span
          className="flex-1 text-xs font-medium leading-tight"
          style={{ color: actual ? '#e2e8f0' : 'rgba(148,163,184,0.7)' }}
        >
          {modulo.numero}. {modulo.titulo}
        </span>
        {expandido
          ? <ChevronUp className="h-3 w-3 flex-shrink-0" style={{ color: 'rgba(148,163,184,0.4)' }} />
          : <ChevronDown className="h-3 w-3 flex-shrink-0" style={{ color: 'rgba(148,163,184,0.4)' }} />}
      </button>

      {expandido && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.6)' }}>
            {modulo.descripcion}
          </p>
          <div className="space-y-1">
            {modulo.temas.map((t, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 rounded-full flex-shrink-0" style={{ background: 'rgba(139,92,246,0.5)' }} />
                <span className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MensajeItem({ msg }: { msg: MensajeCurso }) {
  const esDocente = msg.rol === 'docente'
  return (
    <div className={`flex gap-3 ${esDocente ? '' : 'flex-row-reverse'}`}>
      <div
        className="flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold"
        style={
          esDocente
            ? { background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', color: '#fff' }
            : { background: 'rgba(255,255,255,0.08)', color: 'rgba(203,213,225,0.8)' }
        }
      >
        {esDocente ? 'D' : 'Yo'}
      </div>
      <div
        className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
        style={
          esDocente
            ? { background: 'rgba(109,40,217,0.12)', border: '1px solid rgba(139,92,246,0.15)', color: '#e2e8f0' }
            : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(226,232,240,0.9)' }
        }
      >
        {msg.contenido.split('\n').map((line, i) => (
          <span key={i}>{line}{i < msg.contenido.split('\n').length - 1 && <br />}</span>
        ))}
      </div>
    </div>
  )
}

function StreamingMessage({ texto }: { texto: string }) {
  return (
    <div className="flex gap-3">
      <div
        className="flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', color: '#fff' }}
      >
        D
      </div>
      <div
        className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
        style={{ background: 'rgba(109,40,217,0.12)', border: '1px solid rgba(139,92,246,0.15)', color: '#e2e8f0' }}
      >
        {texto || <span className="inline-flex gap-0.5 items-center">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>}
        {texto && <span className="inline-block w-0.5 h-3.5 bg-violet-400 ml-0.5 animate-pulse" />}
      </div>
    </div>
  )
}

export default function AulaClient({ documentos }: Props) {
  const [vista, setVista] = useState<Vista>('lista')
  const [cursos, setCursos] = useState<CursoResumen[]>([])
  const [cargandoCursos, setCargandoCursos] = useState(true)
  const [cursoActivo, setCursoActivo] = useState<CursoActivo | null>(null)
  const [moduloActual, setModuloActual] = useState(1)
  const [cargandoCurso, setCargandoCurso] = useState(false)
  const [generandoPlan, setGenerandoPlan] = useState(false)
  const [mensajeInput, setMensajeInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [streamingTexto, setStreamingTexto] = useState('')
  const [error, setError] = useState('')
  const [brechas, setBrechas] = useState<string[]>([])
  // Quiz state
  const [modoEval, setModoEval] = useState(false)
  const [preguntas, setPreguntas] = useState<PreguntaEvaluacion[]>([])
  const [preguntaIdx, setPreguntaIdx] = useState(0)
  const [respuestaEval, setRespuestaEval] = useState('')
  const [enviandoEval, setEnviandoEval] = useState(false)
  const [resultadoEval, setResultadoEval] = useState<ResultadoEvaluacion | null>(null)
  const [puntajesEval, setPuntajesEval] = useState<number[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/aula/cursos')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCursos(data) })
      .finally(() => setCargandoCursos(false))
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [cursoActivo?.conversacion, streamingTexto])

  const abrirCurso = useCallback(async (id: string, modulo?: number) => {
    setCargandoCurso(true)
    try {
      const res = await fetch(`/api/aula/cursos/${id}`)
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setCursoActivo(data)
      setModuloActual(modulo ?? data.moduloActual ?? 1)
      setVista('curso')
      // Fetch brechas async in background — non-blocking
      fetch('/api/inteligencia/brechas')
        .then(r => r.json())
        .then(d => setBrechas(d.brechas ?? []))
        .catch(() => {})
    } catch (e) {
      setError(String(e))
    } finally {
      setCargandoCurso(false)
    }
  }, [])

  const crearCurso = useCallback(async (doc: Documento) => {
    setGenerandoPlan(true)
    setError('')
    try {
      const res = await fetch('/api/aula/cursos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libroId: doc.id,
          libroNombre: doc.nombre,
          libroTitulo: doc.titulo || doc.nombre.replace(/\.pdf$/i, ''),
          libroAutor: doc.autor || 'Autor desconocido',
        }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      // Add to list and open
      setCursos((prev) => [{
        id: data.id,
        libroTitulo: data.libroTitulo,
        libroAutor: data.libroAutor,
        moduloActual: 1,
        totalModulos: data.plan.length,
        creadoEn: data.creadoEn,
      }, ...prev])
      setCursoActivo(data)
      setModuloActual(1)
      setVista('curso')
    } catch (e) {
      setError(String(e))
    } finally {
      setGenerandoPlan(false)
    }
  }, [])

  const cambiarModulo = useCallback(async (num: number) => {
    if (!cursoActivo) return
    setModuloActual(num)
    // Persist
    await fetch(`/api/aula/cursos/${cursoActivo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduloActual: num }),
    })
  }, [cursoActivo])

  const enviarMensaje = useCallback(async () => {
    if (!cursoActivo || !mensajeInput.trim() || enviando) return
    const msg = mensajeInput.trim()
    setMensajeInput('')
    setEnviando(true)
    setStreamingTexto('')

    // Optimistically add user message
    const msgUsuario: MensajeCurso = { rol: 'usuario', contenido: msg, timestamp: new Date().toISOString() }
    setCursoActivo((prev) => prev ? { ...prev, conversacion: [...prev.conversacion, msgUsuario] } : prev)

    try {
      const res = await fetch('/api/aula/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursoId: cursoActivo.id, mensaje: msg, moduloActual }),
      })

      if (!res.ok || !res.body) {
        const data = await res.json()
        setError(data.error ?? 'Error al conectar con el docente')
        setEnviando(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let respuesta = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = JSON.parse(line.slice(6))
          if (payload.error) { setError(payload.error); break }
          if (payload.texto) {
            respuesta += payload.texto
            setStreamingTexto(respuesta)
          }
          if (payload.done) {
            const msgDocente: MensajeCurso = { rol: 'docente', contenido: respuesta, timestamp: new Date().toISOString() }
            setCursoActivo((prev) => prev ? { ...prev, conversacion: [...prev.conversacion, msgDocente] } : prev)
            setStreamingTexto('')
          }
        }
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setEnviando(false)
    }
  }, [cursoActivo, mensajeInput, enviando, moduloActual])

  const eliminarCurso = useCallback(async (id: string) => {
    await fetch(`/api/aula/cursos/${id}`, { method: 'DELETE' })
    setCursos((prev) => prev.filter((c) => c.id !== id))
    if (cursoActivo?.id === id) { setCursoActivo(null); setVista('lista') }
  }, [cursoActivo])

  const iniciarEvaluacion = useCallback(async () => {
    if (!cursoActivo) return
    setModoEval(true)
    setPreguntas([])
    setPreguntaIdx(0)
    setResultadoEval(null)
    setPuntajesEval([])
    setRespuestaEval('')
    setEnviandoEval(true)
    try {
      const res = await fetch('/api/aula/evaluar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursoId: cursoActivo.id, moduloNumero: moduloActual }),
      })
      const data = await res.json()
      setPreguntas(data.preguntas ?? [])
    } catch (e) {
      setError(String(e))
      setModoEval(false)
    } finally {
      setEnviandoEval(false)
    }
  }, [cursoActivo, moduloActual])

  const corregirRespuesta = useCallback(async () => {
    if (!cursoActivo || !preguntas[preguntaIdx] || !respuestaEval.trim()) return
    const pregunta = preguntas[preguntaIdx]
    setEnviandoEval(true)
    try {
      const res = await fetch('/api/aula/evaluar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cursoId: cursoActivo.id,
          moduloNumero: moduloActual,
          respuesta: respuestaEval.trim(),
          preguntaId: pregunta.pregunta,
          rubrica: pregunta.rubrica,
        }),
      })
      const data = await res.json() as ResultadoEvaluacion
      setResultadoEval(data)
      setPuntajesEval((prev) => [...prev, data.puntaje])
    } catch (e) {
      setError(String(e))
    } finally {
      setEnviandoEval(false)
    }
  }, [cursoActivo, preguntas, preguntaIdx, respuestaEval, moduloActual])

  // ── VISTA: Lista de cursos ──────────────────────────────────────────────────
  if (vista === 'lista') {
    return (
      <div className="flex flex-col h-full" style={{ background: '#080812' }}>
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Aula IA</h1>
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>Tu docente pedagógico personal</p>
            </div>
          </div>
          <button
            onClick={() => setVista('selector')}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all"
            style={{ background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(109,40,217,0.25)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(109,40,217,0.15)' }}
          >
            <Plus className="h-4 w-4" /> Nuevo curso
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          {error && (
            <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {error}
            </div>
          )}

          {cargandoCursos ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'rgba(139,92,246,0.5)' }} />
            </div>
          ) : cursos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <GraduationCap className="h-8 w-8" style={{ color: 'rgba(139,92,246,0.6)' }} />
              </div>
              <p className="text-base font-medium text-white mb-1">Ningún curso todavía</p>
              <p className="text-sm mb-6" style={{ color: 'rgba(148,163,184,0.5)' }}>
                Elegí un libro de tu biblioteca y la IA generará un plan de estudios completo
              </p>
              <button
                onClick={() => setVista('selector')}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium"
                style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.8), rgba(6,182,212,0.6))', color: '#fff' }}
              >
                <Plus className="h-4 w-4" /> Crear primer curso
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {cursos.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl p-5 flex flex-col gap-3 cursor-pointer transition-all group"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.border = '1px solid rgba(139,92,246,0.25)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)' }}
                  onClick={() => abrirCurso(c.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{c.libroTitulo}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(148,163,184,0.55)' }}>{c.libroAutor}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); eliminarCurso(c.id) }}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
                      style={{ color: 'rgba(239,68,68,0.5)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(239,68,68,0.5)' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>Módulo {c.moduloActual}/{c.totalModulos}</span>
                      <span className="text-xs" style={{ color: 'rgba(139,92,246,0.7)' }}>
                        {Math.round((c.moduloActual / c.totalModulos) * 100)}%
                      </span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(c.moduloActual / c.totalModulos) * 100}%`,
                          background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
                        }}
                      />
                    </div>
                  </div>

                  <button
                    className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition-all"
                    style={{ background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa' }}
                  >
                    Continuar <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── VISTA: Selector de libro ────────────────────────────────────────────────
  if (vista === 'selector') {
    return (
      <div className="flex flex-col h-full" style={{ background: '#080812' }}>
        <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => { setVista('lista'); setError('') }}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(148,163,184,0.5)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.5)' }}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-base font-bold text-white">Nuevo curso</h1>
            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>Elegí un libro para generar el plan de estudios</p>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          {generandoPlan ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'rgba(139,92,246,0.6)' }} />
              </div>
              <div className="text-center">
                <p className="text-white font-medium">Generando plan de estudios</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(148,163,184,0.5)' }}>La IA está diseñando los módulos, objetivos y temas...</p>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  {error}
                </div>
              )}
              {documentos.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>No hay documentos en tu biblioteca todavía.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {documentos.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => crearCurso(doc)}
                      className="rounded-xl p-4 text-left transition-all"
                      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.border = '1px solid rgba(139,92,246,0.3)'; e.currentTarget.style.background = 'rgba(109,40,217,0.08)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(109,40,217,0.15)' }}>
                          <BookOpen className="h-4 w-4" style={{ color: 'rgba(139,92,246,0.7)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{doc.titulo || doc.nombre.replace(/\.pdf$/i, '')}</p>
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(148,163,184,0.5)' }}>
                            {doc.autor || 'Sin autor'}{doc.año ? ` · ${doc.año}` : ''}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ── VISTA: Curso activo ─────────────────────────────────────────────────────
  if (!cursoActivo) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: '#080812' }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'rgba(139,92,246,0.5)' }} />
      </div>
    )
  }

  const moduloObj = cursoActivo.plan.find((m) => m.numero === moduloActual) ?? cursoActivo.plan[0]

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#080812' }}>
      {/* ── Left Panel: Plan ────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex flex-col overflow-hidden"
        style={{
          width: 272,
          borderRight: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.015)',
        }}
      >
        {/* Back + Course info */}
        <div className="flex-shrink-0 px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={() => setVista('lista')}
            className="flex items-center gap-1.5 text-xs mb-3 transition-colors"
            style={{ color: 'rgba(148,163,184,0.45)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.45)' }}
          >
            <ArrowLeft className="h-3 w-3" /> Mis cursos
          </button>
          <p className="text-xs font-semibold text-white leading-tight line-clamp-2">{cursoActivo.libroTitulo}</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(148,163,184,0.45)' }}>{cursoActivo.libroAutor}</p>

          {/* Progress bar */}
          <div className="mt-2">
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(moduloActual / cursoActivo.plan.length) * 100}%`,
                  background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
                }}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: 'rgba(148,163,184,0.35)' }}>
              Módulo {moduloActual}/{cursoActivo.plan.length}
            </p>
          </div>
        </div>

        {/* Module list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(139,92,246,0.5)' }}>
            Plan de estudios
          </p>
          {cursoActivo.plan.map((m) => (
            <ModuloItem
              key={m.numero}
              modulo={m}
              actual={m.numero === moduloActual}
              onClick={() => cambiarModulo(m.numero)}
            />
          ))}

          {/* Brechas de la biblioteca */}
          {brechas.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <AlertCircle className="h-3 w-3 flex-shrink-0" style={{ color: 'rgba(251,191,36,0.6)' }} />
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(251,191,36,0.5)' }}>
                  Brechas de tu biblioteca
                </p>
              </div>
              <div className="space-y-1.5">
                {brechas.map((b, i) => (
                  <p key={i} className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.5)' }}>
                    · {b}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel: Chat ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat header */}
        <div
          className="flex-shrink-0 px-5 py-3 flex items-center gap-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
          >
            D
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">Docente IA</p>
            <p className="text-xs truncate" style={{ color: 'rgba(148,163,184,0.45)' }}>
              Módulo {moduloObj?.numero}: {moduloObj?.titulo}
            </p>
          </div>
          <button
            onClick={modoEval ? () => { setModoEval(false); setResultadoEval(null) } : iniciarEvaluacion}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all"
            style={modoEval
              ? { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.7)' }
              : { background: 'rgba(109,40,217,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }
            }
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            {modoEval ? 'Volver al chat' : 'Evaluar módulo'}
          </button>
          {cargandoCurso && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" style={{ color: 'rgba(139,92,246,0.5)' }} />}
        </div>

        {/* Quiz panel */}
        {modoEval && (
          <div className="flex-1 overflow-y-auto px-5 py-6">
            {enviandoEval && preguntas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'rgba(139,92,246,0.5)' }} />
                <p className="text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>Generando preguntas...</p>
              </div>
            ) : puntajesEval.length === preguntas.length && preguntas.length > 0 && !resultadoEval ? (
              // Summary screen
              <div className="max-w-lg mx-auto text-center py-10">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(6,182,212,0.2))', border: '1px solid rgba(139,92,246,0.3)' }}>
                  <Star className="h-8 w-8" style={{ color: '#a78bfa' }} />
                </div>
                <p className="text-xl font-bold text-white mb-1">Evaluación completada</p>
                <p className="text-3xl font-bold mt-3 mb-1" style={{ color: '#a78bfa' }}>
                  {(puntajesEval.reduce((a, b) => a + b, 0) / puntajesEval.length).toFixed(1)}<span className="text-base text-slate-400">/10</span>
                </p>
                <p className="text-sm mt-1 mb-6" style={{ color: 'rgba(148,163,184,0.5)' }}>
                  Promedio de {preguntas.length} preguntas · Módulo {moduloActual}
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {puntajesEval.map((p, i) => (
                    <div key={i} className="rounded-xl px-3 py-2 text-center"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="text-xs mb-0.5" style={{ color: 'rgba(148,163,184,0.4)' }}>P{i + 1}</p>
                      <p className="text-sm font-bold" style={{ color: p >= 7 ? 'rgba(52,211,153,0.9)' : p >= 5 ? '#fbbf24' : '#f87171' }}>{p}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={iniciarEvaluacion}
                  className="mt-6 rounded-xl px-5 py-2.5 text-sm font-medium"
                  style={{ background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
                >Repetir evaluación</button>
              </div>
            ) : preguntas.length > 0 ? (
              <div className="max-w-lg mx-auto">
                {/* Progress */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${(puntajesEval.length / preguntas.length) * 100}%`, background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }} />
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: 'rgba(148,163,184,0.4)' }}>
                    {puntajesEval.length + (resultadoEval ? 0 : 0)}/{preguntas.length}
                  </span>
                </div>

                {/* Question */}
                {!resultadoEval ? (
                  <div>
                    <div className="rounded-2xl p-5 mb-4"
                      style={{ background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                      <p className="text-xs font-medium mb-2" style={{ color: 'rgba(139,92,246,0.6)' }}>
                        Pregunta {preguntaIdx + 1} de {preguntas.length}
                      </p>
                      <p className="text-sm text-white leading-relaxed">{preguntas[preguntaIdx].pregunta}</p>
                    </div>
                    <textarea
                      value={respuestaEval}
                      onChange={(e) => setRespuestaEval(e.target.value)}
                      placeholder="Escribí tu respuesta aquí..."
                      rows={5}
                      className="w-full rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#e2e8f0' }}
                      disabled={enviandoEval}
                    />
                    <button
                      onClick={corregirRespuesta}
                      disabled={!respuestaEval.trim() || enviandoEval}
                      className="mt-3 w-full rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.7), rgba(6,182,212,0.5))', color: '#fff' }}
                    >
                      {enviandoEval ? <><Loader2 className="h-4 w-4 animate-spin" /> Corrigiendo...</> : 'Enviar respuesta'}
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* Result */}
                    <div className="rounded-2xl p-5 mb-4"
                      style={{
                        background: resultadoEval.puntaje >= 7 ? 'rgba(52,211,153,0.06)' : resultadoEval.puntaje >= 5 ? 'rgba(251,191,36,0.06)' : 'rgba(239,68,68,0.06)',
                        border: `1px solid ${resultadoEval.puntaje >= 7 ? 'rgba(52,211,153,0.2)' : resultadoEval.puntaje >= 5 ? 'rgba(251,191,36,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-white">Resultado</p>
                        <span className="text-2xl font-bold" style={{ color: resultadoEval.puntaje >= 7 ? 'rgba(52,211,153,0.9)' : resultadoEval.puntaje >= 5 ? '#fbbf24' : '#f87171' }}>
                          {resultadoEval.puntaje}<span className="text-sm text-slate-400">/10</span>
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed mb-3" style={{ color: 'rgba(226,232,240,0.8)' }}>{resultadoEval.feedback}</p>
                      {resultadoEval.aciertos.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-medium mb-1" style={{ color: 'rgba(52,211,153,0.7)' }}>Aciertos</p>
                          {resultadoEval.aciertos.map((a, i) => (
                            <p key={i} className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.7)' }}>· {a}</p>
                          ))}
                        </div>
                      )}
                      {resultadoEval.mejoras.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: 'rgba(251,191,36,0.7)' }}>Para mejorar</p>
                          {resultadoEval.mejoras.map((m, i) => (
                            <p key={i} className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.7)' }}>· {m}</p>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (preguntaIdx + 1 < preguntas.length) {
                          setPreguntaIdx((prev) => prev + 1)
                          setRespuestaEval('')
                          setResultadoEval(null)
                        } else {
                          setResultadoEval(null)
                        }
                      }}
                      className="w-full rounded-xl py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2"
                      style={{ background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
                    >
                      {preguntaIdx + 1 < preguntas.length ? 'Siguiente pregunta' : 'Ver resumen'}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Messages */}
        {!modoEval && <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {cursoActivo.conversacion.length === 0 && !streamingTexto && (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.1))', border: '1px solid rgba(139,92,246,0.2)' }}>
                <GraduationCap className="h-7 w-7" style={{ color: 'rgba(139,92,246,0.8)' }} />
              </div>
              <p className="text-white font-medium mb-1">Módulo {moduloObj?.numero}: {moduloObj?.titulo}</p>
              <p className="text-sm max-w-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.5)' }}>
                {moduloObj?.descripcion}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {[
                  `Explicame el módulo ${moduloObj?.numero}`,
                  `¿Cuáles son los conceptos más importantes?`,
                  `Evaluame sobre lo que sé`,
                ].map((sugerencia) => (
                  <button
                    key={sugerencia}
                    onClick={() => { setMensajeInput(sugerencia); inputRef.current?.focus() }}
                    className="rounded-full px-3 py-1.5 text-xs transition-all"
                    style={{ background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: 'rgba(167,139,250,0.8)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(109,40,217,0.2)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(109,40,217,0.1)' }}
                  >
                    {sugerencia}
                  </button>
                ))}
              </div>
            </div>
          )}

          {cursoActivo.conversacion.map((msg, i) => (
            <MensajeItem key={i} msg={msg} />
          ))}

          {(enviando || streamingTexto) && (
            <StreamingMessage texto={streamingTexto} />
          )}

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {error}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>}

        {/* Input */}
        {!modoEval && <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div
            className="flex items-end gap-3 rounded-2xl px-4 py-3 transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            onFocus={() => {}}
          >
            <textarea
              ref={inputRef}
              value={mensajeInput}
              onChange={(e) => setMensajeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  enviarMensaje()
                }
              }}
              placeholder="Preguntale al docente... (Enter para enviar)"
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
              style={{ maxHeight: 120, minHeight: 24 }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 120) + 'px'
              }}
              disabled={enviando}
            />
            <button
              onClick={enviarMensaje}
              disabled={!mensajeInput.trim() || enviando}
              className="flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
            >
              {enviando
                ? <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                : <Send className="h-3.5 w-3.5 text-white" />}
            </button>
          </div>
          <p className="text-center text-xs mt-2" style={{ color: 'rgba(148,163,184,0.25)' }}>
            Shift+Enter para nueva línea
          </p>
        </div>}
      </div>
    </div>
  )
}
