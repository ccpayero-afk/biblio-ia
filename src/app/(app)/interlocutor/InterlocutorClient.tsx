'use client'

import { useState, useRef, useCallback } from 'react'
import { Send, RotateCcw, Users, BookMarked } from 'lucide-react'
import { MensajeHistorial } from '@/lib/chat'

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

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
        body: JSON.stringify({ query: texto, modo, historial }),
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
      <div className="border-b border-neutral-800 px-6 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {MODOS.map((m) => (
            <button
              key={m.id}
              onClick={() => { setModo(m.id); setTurnos([]); setRespuestaActual('') }}
              className={`flex-shrink-0 rounded-lg px-3 py-2 text-xs transition-colors ${
                modo === m.id
                  ? 'bg-blue-700 text-white'
                  : 'border border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
              }`}
              title={m.desc}
            >
              {m.label}
            </button>
          ))}
          <span className="flex-shrink-0 ml-2 self-center text-xs text-neutral-600">
            {MODOS.find((m) => m.id === modo)?.desc}
          </span>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {turnos.length === 0 && !consultando && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="h-12 w-12 text-neutral-700" />
            <h1 className="mt-4 text-lg font-semibold text-white">Interlocutor teórico</h1>
            <p className="mt-2 max-w-sm text-sm text-neutral-500">
              {MODOS.find((m) => m.id === modo)?.desc}. Hacé una pregunta para empezar.
            </p>
          </div>
        )}

        {turnos.map((turno, i) => (
          <div key={i} className="space-y-3 max-w-3xl mx-auto w-full">
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-tr-sm bg-blue-700 px-4 py-3 text-sm text-white max-w-xl">{turno.pregunta}</div>
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-neutral-800 bg-neutral-900 px-5 py-4 text-sm text-neutral-200 leading-relaxed max-w-2xl whitespace-pre-wrap font-[family-name:var(--font-lora)]">
              {turno.respuesta}
            </div>
          </div>
        ))}

        {consultando && (
          <div className="space-y-3 max-w-3xl mx-auto w-full">
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-tr-sm bg-blue-700 px-4 py-3 text-sm text-white max-w-xl">
                {query || historial[historial.length - 1]?.contenido}
              </div>
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-neutral-800 bg-neutral-900 px-5 py-4 text-sm text-neutral-200 leading-relaxed max-w-2xl whitespace-pre-wrap min-h-12 font-[family-name:var(--font-lora)]">
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
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neutral-800 bg-neutral-950 px-6 py-4">
        <div className="mx-auto max-w-3xl">
          {turnos.length > 0 && (
            <button
              onClick={() => setTurnos([])}
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
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) consultar() }}
              placeholder={
                modo === 'socrático' ? 'Presentá una idea o posición para que el interlocutor la cuestione…' :
                modo === 'posicion' ? '¿Cuál es tu posición sobre X? El interlocutor responde como un autor de tu biblioteca…' :
                modo === 'debate' ? '¿Sobre qué concepto querés ver las tensiones teóricas?…' :
                '¿Qué querés explorar en tu biblioteca? (Ctrl+Enter)'
              }
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
        </div>
      </div>
    </div>
  )
}
