'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, RotateCcw, Users, BookMarked } from 'lucide-react'
import { MensajeHistorial } from '@/lib/chat'
import { CarpetaSelector } from '@/components/CarpetaSelector'
import type { Carpeta } from '@/types'

type Modo = 'exploración' | 'posicion' | 'debate' | 'socrático'

const MODOS: { id: Modo; label: string; desc: string }[] = [
  { id: 'exploración', label: 'Exploración', desc: 'Guía con preguntas de profundización' },
  { id: 'posicion', label: 'Posición de autor', desc: 'Responde como el autor del texto' },
  { id: 'debate', label: 'Debate', desc: 'Muestra las tensiones en la bibliografía' },
  { id: 'socrático', label: 'Socrático', desc: 'Solo hace preguntas, nunca responde directo' },
]

interface Turno {
  pregunta: string
  respuesta: string
}

export default function InterlocutorClient() {
  const [modo, setModo] = useState<Modo>('exploración')
  const [query, setQuery] = useState('')
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [consultando, setConsultando] = useState(false)
  const [respuestaActual, setRespuestaActual] = useState('')
  const [carpetas, setCarpetas] = useState<Carpeta[]>([])
  const [carpetasFiltro, setCarpetasFiltro] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/carpetas')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCarpetas(data) })
      .catch(() => {})
  }, [])

  const historial: MensajeHistorial[] = turnos.flatMap((t) => [
    { rol: 'user' as const, contenido: t.pregunta },
    { rol: 'assistant' as const, contenido: t.respuesta },
  ])

  const consultar = useCallback(async () => {
    const texto = query.trim()
    if (!texto || consultando) return
    setConsultando(true)
    setQuery('')
    setRespuestaActual('')

    let respuestaFinal = ''
    try {
      const res = await fetch('/api/interlocutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: texto, modo, historial, carpetasIds: carpetasFiltro.length ? carpetasFiltro : undefined }),
      })
      if (!res.body) throw new Error('Sin respuesta')

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
          if (payload.texto) {
            respuestaFinal += payload.texto
            setRespuestaActual((prev) => prev + payload.texto)
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          } else if (payload.error) {
            respuestaFinal = `Error: ${payload.error}`
            setRespuestaActual(respuestaFinal)
          }
        }
      }

      setTurnos((prev) => [...prev, { pregunta: texto, respuesta: respuestaFinal }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setTurnos((prev) => [...prev, { pregunta: texto, respuesta: `Error: ${msg}` }])
    } finally {
      setRespuestaActual('')
      setConsultando(false)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [query, consultando, modo, historial])

  return (
    <div className="flex h-full flex-col -m-4 md:-m-6">
      {/* Mode selector */}
      <div className="px-6 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(3,3,8,0.6)' }}>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {MODOS.map((m) => (
            <button
              key={m.id}
              onClick={() => { setModo(m.id); setTurnos([]); setRespuestaActual('') }}
              className="flex-shrink-0 rounded-lg px-3 py-2 text-xs transition-all"
              style={modo === m.id
                ? { background: 'linear-gradient(90deg, rgba(109,40,217,0.3), rgba(30,58,138,0.2))', color: '#fff', border: '1px solid rgba(139,92,246,0.3)' }
                : { border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.5)' }
              }
              onMouseEnter={(e) => { if (modo !== m.id) { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; e.currentTarget.style.color = '#fff' } }}
              onMouseLeave={(e) => { if (modo !== m.id) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(148,163,184,0.5)' } }}
              title={m.desc}
            >
              {m.label}
            </button>
          ))}
          <span className="flex-shrink-0 ml-2 self-center text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>
            {MODOS.find((m) => m.id === modo)?.desc}
          </span>
        </div>
        {/* Filtro carpetas */}
        <div className="mt-2">
          <CarpetaSelector carpetas={carpetas} filtro={carpetasFiltro} onChange={setCarpetasFiltro} />
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {turnos.length === 0 && !consultando && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.06))', border: '1px solid rgba(139,92,246,0.2)' }}
            >
              <Users className="h-8 w-8" style={{ color: 'rgba(139,92,246,0.6)' }} />
            </div>
            <h1 className="text-lg font-semibold text-white">Interlocutor teórico</h1>
            <p className="mt-2 max-w-sm text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>
              {MODOS.find((m) => m.id === modo)?.desc}. Hacé una pregunta para empezar.
            </p>
          </div>
        )}

        {turnos.map((turno, i) => (
          <div key={i} className="space-y-3 max-w-3xl mx-auto w-full">
            <div className="flex justify-end">
              <div
                className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white max-w-xl"
                style={{ background: 'linear-gradient(135deg, #6d28d9, #1e40af)', boxShadow: '0 0 16px rgba(109,40,217,0.3)' }}
              >{turno.pregunta}</div>
            </div>
            <div
              className="rounded-2xl rounded-tl-sm px-5 py-4 text-sm leading-relaxed max-w-2xl whitespace-pre-wrap font-[family-name:var(--font-lora)]"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(203,213,225,0.85)' }}
            >
              {turno.respuesta}
            </div>
          </div>
        ))}

        {consultando && (
          <div className="space-y-3 max-w-3xl mx-auto w-full">
            <div className="flex justify-end">
              <div
                className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white max-w-xl"
                style={{ background: 'linear-gradient(135deg, #6d28d9, #1e40af)', boxShadow: '0 0 16px rgba(109,40,217,0.3)' }}
              >
                {query || historial[historial.length - 1]?.contenido}
              </div>
            </div>
            <div
              className="rounded-2xl rounded-tl-sm px-5 py-4 text-sm leading-relaxed max-w-2xl whitespace-pre-wrap min-h-12 font-[family-name:var(--font-lora)]"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(203,213,225,0.85)' }}
            >
              {respuestaActual}
              {!respuestaActual && (
                <span className="inline-flex gap-1" style={{ color: 'rgba(139,92,246,0.6)' }}>
                  <span className="animate-bounce">·</span>
                  <span className="animate-bounce [animation-delay:0.15s]">·</span>
                  <span className="animate-bounce [animation-delay:0.3s]">·</span>
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(3,3,8,0.7)' }}>
        <div className="mx-auto max-w-3xl">
          {turnos.length > 0 && (
            <button
              onClick={() => setTurnos([])}
              className="mb-2 flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: 'rgba(148,163,184,0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.8)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}
            >
              <RotateCcw className="h-3 w-3" /> Nueva conversación
            </button>
          )}
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) consultar() }}
              placeholder={
                modo === 'socrático' ? 'Presentá una idea o posición para que el interlocutor la cuestione…' :
                modo === 'posicion' ? '¿Cuál es tu posición sobre X? El interlocutor responde como un autor de tu biblioteca…' :
                modo === 'debate' ? '¿Sobre qué concepto querés ver las tensiones teóricas?…' :
                '¿Qué querés explorar en tu biblioteca? (Ctrl+Enter)'
              }
              rows={3}
              disabled={consultando}
              className="flex-1 resize-none rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.1)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = '' }}
            />
            <button
              onClick={consultar}
              disabled={!query.trim() || consultando}
              className="flex h-12 w-12 flex-shrink-0 self-end items-center justify-center rounded-xl text-white transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 14px rgba(124,58,237,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 22px rgba(124,58,237,0.5)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 14px rgba(124,58,237,0.3)' }}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
