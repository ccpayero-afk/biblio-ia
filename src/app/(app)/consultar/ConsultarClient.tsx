'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, BookMarked, RotateCcw, MessageSquare, ChevronDown, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { MensajeHistorial } from '@/lib/chat'

interface Fuente {
  documentoId: string
  documentoNombre: string
  autor: string
  año: string
  pagina: number
  fragmentoId: string
}

interface Turno {
  pregunta: string
  respuesta: string
  fuentes: Fuente[]
}

interface Conversacion {
  id: string
  titulo: string
  fecha: string
  turnos: Turno[]
}

const STORAGE_KEY = 'biblio_chat_historial'
const MAX_CONVERSACIONES = 30

function cargarHistorial(): Conversacion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function guardarHistorial(convs: Conversacion[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs.slice(0, MAX_CONVERSACIONES)))
  } catch { /* quota exceeded — no crítico */ }
}

function nuevaId() {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function formatearFecha(iso: string): string {
  const d = new Date(iso)
  const hoy = new Date()
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
  if (d.toDateString() === hoy.toDateString()) return `Hoy ${d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`
  if (d.toDateString() === ayer.toDateString()) return `Ayer ${d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

export default function ConsultarClient() {
  const [query, setQuery] = useState('')
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [consultando, setConsultando] = useState(false)
  const [respuestaActual, setRespuestaActual] = useState('')
  const [fuentesActuales, setFuentesActuales] = useState<Fuente[]>([])
  const [convId, setConvId] = useState<string>(() => nuevaId())
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [panelAbierto, setPanelAbierto] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Cargar historial al montar
  useEffect(() => {
    const hist = cargarHistorial()
    setConversaciones(hist)
    // Si hay una conversación guardada reciente (< 24h), cargarla automáticamente
    if (hist.length > 0) {
      const ultima = hist[0]
      const hace24h = Date.now() - 24 * 60 * 60 * 1000
      if (new Date(ultima.fecha).getTime() > hace24h) {
        setConvId(ultima.id)
        setTurnos(ultima.turnos)
      }
    }
  }, [])

  // Cerrar panel al hacer clic fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelAbierto(false)
      }
    }
    if (panelAbierto) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [panelAbierto])

  // Guardar conversación actual en localStorage cuando cambian los turnos
  useEffect(() => {
    if (turnos.length === 0) return
    const conv: Conversacion = {
      id: convId,
      titulo: turnos[0].pregunta.slice(0, 60) + (turnos[0].pregunta.length > 60 ? '…' : ''),
      fecha: new Date().toISOString(),
      turnos,
    }
    setConversaciones((prev) => {
      const sin = prev.filter((c) => c.id !== convId)
      const nuevas = [conv, ...sin]
      guardarHistorial(nuevas)
      return nuevas
    })
  }, [turnos, convId])

  const historial: MensajeHistorial[] = turnos.flatMap((t) => [
    { rol: 'user' as const, contenido: t.pregunta },
    { rol: 'assistant' as const, contenido: t.respuesta },
  ])

  function iniciarNuevaConversacion() {
    setTurnos([])
    setConvId(nuevaId())
    setQuery('')
    setPanelAbierto(false)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  function cargarConversacion(conv: Conversacion) {
    setConvId(conv.id)
    setTurnos(conv.turnos)
    setPanelAbierto(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50)
  }

  function eliminarConversacion(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setConversaciones((prev) => {
      const nuevas = prev.filter((c) => c.id !== id)
      guardarHistorial(nuevas)
      return nuevas
    })
    if (id === convId) iniciarNuevaConversacion()
  }

  const consultar = useCallback(async () => {
    const texto = query.trim()
    if (!texto || consultando) return

    setConsultando(true)
    setQuery('')
    setRespuestaActual('')
    setFuentesActuales([])

    let respuestaFinal = ''
    let fuentesFinal: Fuente[] = []

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: texto, historial }),
      })

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

          if (payload.fuentes) {
            fuentesFinal = payload.fuentes
            setFuentesActuales(payload.fuentes)
          } else if (payload.texto) {
            respuestaFinal += payload.texto
            setRespuestaActual((prev) => prev + payload.texto)
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          } else if (payload.error) {
            respuestaFinal = `Error: ${payload.error}`
            setRespuestaActual(respuestaFinal)
          }
        }
      }

      setTurnos((prev) => [
        ...prev,
        { pregunta: texto, respuesta: respuestaFinal, fuentes: fuentesFinal },
      ])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error de conexión'
      setRespuestaActual(`Error: ${msg}`)
      setTurnos((prev) => [
        ...prev,
        { pregunta: texto, respuesta: `Error: ${msg}`, fuentes: [] },
      ])
    } finally {
      setRespuestaActual('')
      setFuentesActuales([])
      setConsultando(false)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [query, consultando, historial])

  async function guardarComoNota(turno: Turno) {
    const nota = {
      id: `nota_consulta_${Date.now()}`,
      contenido: `**Pregunta:** ${turno.pregunta}\n\n**Respuesta:** ${turno.respuesta}`,
      etiquetas: ['consulta'],
      tipo: 'consulta',
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
    }
    await fetch('/api/notas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nota),
    })
  }

  const tituloActual = turnos.length > 0
    ? (turnos[0].pregunta.slice(0, 50) + (turnos[0].pregunta.length > 50 ? '…' : ''))
    : 'Nueva conversación'

  return (
    <div className="flex h-full flex-col -m-4 md:-m-6">

      {/* Barra superior con historial */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5">
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setPanelAbierto((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            <MessageSquare className="h-4 w-4 text-neutral-500" />
            <span className="max-w-[200px] truncate">{tituloActual}</span>
            <ChevronDown className={`h-3.5 w-3.5 text-neutral-500 transition-transform ${panelAbierto ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown de conversaciones */}
          {panelAbierto && (
            <div className="absolute left-0 top-full z-30 mt-1 w-80 rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
              <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
                <span className="text-xs font-medium text-neutral-400">Conversaciones guardadas</span>
                <span className="text-xs text-neutral-600">{conversaciones.length}/{MAX_CONVERSACIONES}</span>
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {conversaciones.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-neutral-600">No hay conversaciones guardadas</p>
                )}
                {conversaciones.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => cargarConversacion(conv)}
                    className={`group flex cursor-pointer items-start gap-2 px-3 py-2.5 hover:bg-neutral-800 ${conv.id === convId ? 'bg-neutral-800/60' : ''}`}
                  >
                    <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-neutral-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-neutral-300">{conv.titulo}</p>
                      <p className="mt-0.5 text-xs text-neutral-600">
                        {formatearFecha(conv.fecha)} · {conv.turnos.length} {conv.turnos.length === 1 ? 'pregunta' : 'preguntas'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => eliminarConversacion(conv.id, e)}
                      className="flex-shrink-0 rounded p-0.5 text-neutral-700 opacity-0 hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={iniciarNuevaConversacion}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva
        </button>
      </div>

      {/* Historial de turnos */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
        {turnos.length === 0 && !consultando && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookMarked className="h-12 w-12 text-neutral-700" />
            <h1 className="mt-4 text-xl font-semibold text-white">Consultar la biblioteca</h1>
            <p className="mt-2 max-w-sm text-sm text-neutral-500">
              Hacé una pregunta en lenguaje natural. Gemini buscará en tus documentos indexados y responderá citando las fuentes.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 max-w-xl w-full">
              {[
                '¿Cuáles son los argumentos centrales sobre hegemonía cultural?',
                '¿Qué dicen los textos sobre informalidad laboral en América Latina?',
                '¿Cómo se define la noción de campo en la bibliografía?',
                '¿Qué autores debaten sobre identidad y subalternidad?',
              ].map((sugerencia) => (
                <button
                  key={sugerencia}
                  onClick={() => setQuery(sugerencia)}
                  className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-left text-xs text-neutral-400 hover:border-neutral-700 hover:text-neutral-300"
                >
                  {sugerencia}
                </button>
              ))}
            </div>
          </div>
        )}

        {turnos.map((turno, i) => (
          <div key={i} className="space-y-4 max-w-3xl mx-auto w-full">
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-tr-sm bg-blue-700 px-4 py-3 text-sm text-white max-w-xl">
                {turno.pregunta}
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl rounded-tl-sm border border-neutral-800 bg-neutral-900 px-5 py-4 text-sm text-neutral-200 leading-relaxed font-[family-name:var(--font-lora)] max-w-2xl whitespace-pre-wrap">
                {turno.respuesta}
              </div>
              {turno.fuentes.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-1">
                  {turno.fuentes.map((f, j) => {
                    const apellido = f.autor?.split(',')[0] ?? 'Autor'
                    return (
                      <Link
                        key={j}
                        href={`/lector/${f.documentoId}?pagina=${f.pagina}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 transition-colors"
                      >
                        <BookMarked className="h-3 w-3" />
                        {apellido} ({f.año || 's.f.'}, p.{f.pagina})
                      </Link>
                    )
                  })}
                </div>
              )}
              <button
                onClick={() => guardarComoNota(turno)}
                className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-400 pl-1"
              >
                Guardar como nota
              </button>
            </div>
          </div>
        ))}

        {consultando && (
          <div className="space-y-4 max-w-3xl mx-auto w-full">
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-tr-sm bg-blue-700 px-4 py-3 text-sm text-white max-w-xl">
                {query || historial[historial.length - 1]?.contenido}
              </div>
            </div>
            <div className="space-y-3">
              {fuentesActuales.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-1">
                  {fuentesActuales.map((f, j) => {
                    const apellido = f.autor?.split(',')[0] ?? 'Autor'
                    return (
                      <span key={j} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-500">
                        <BookMarked className="h-3 w-3" />
                        {apellido} ({f.año || 's.f.'}, p.{f.pagina})
                      </span>
                    )
                  })}
                </div>
              )}
              <div className="rounded-2xl rounded-tl-sm border border-neutral-800 bg-neutral-900 px-5 py-4 text-sm text-neutral-200 leading-relaxed font-[family-name:var(--font-lora)] max-w-2xl whitespace-pre-wrap min-h-12">
                {respuestaActual}
                {!respuestaActual && (
                  <span className="inline-flex gap-1 text-neutral-600">
                    <span className="animate-bounce">·</span>
                    <span className="animate-bounce [animation-delay:0.15s]">·</span>
                    <span className="animate-bounce [animation-delay:0.3s]">·</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neutral-800 bg-neutral-950 px-6 py-4">
        <div className="mx-auto max-w-3xl">
          {turnos.length > 0 && (
            <button
              onClick={iniciarNuevaConversacion}
              className="mb-2 flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-400"
            >
              <RotateCcw className="h-3 w-3" /> Nueva conversación
            </button>
          )}
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) consultar()
              }}
              placeholder="Hacé una pregunta sobre tu biblioteca… (Ctrl+Enter para enviar)"
              rows={3}
              disabled={consultando}
              className="flex-1 resize-none rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-blue-600 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={consultar}
              disabled={!query.trim() || consultando}
              className="flex h-12 w-12 flex-shrink-0 self-end items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-xs text-neutral-700">
            Busca en{' '}
            <span className="text-neutral-500">todos los documentos indexados</span>
            {' '}· Ctrl+Enter para enviar
          </p>
        </div>
      </div>
    </div>
  )
}
