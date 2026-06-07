'use client'

import { useState, useRef, useCallback } from 'react'
import { Send, BookMarked, RotateCcw } from 'lucide-react'
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

export default function ConsultarClient() {
  const [query, setQuery] = useState('')
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [consultando, setConsultando] = useState(false)
  const [respuestaActual, setRespuestaActual] = useState('')
  const [fuentesActuales, setFuentesActuales] = useState<Fuente[]>([])
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

  return (
    <div className="flex h-full flex-col -m-6">
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

        {/* Turnos anteriores */}
        {turnos.map((turno, i) => (
          <div key={i} className="space-y-4 max-w-3xl mx-auto w-full">
            {/* Pregunta */}
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-tr-sm bg-blue-700 px-4 py-3 text-sm text-white max-w-xl">
                {turno.pregunta}
              </div>
            </div>

            {/* Respuesta */}
            <div className="space-y-3">
              <div className="rounded-2xl rounded-tl-sm border border-neutral-800 bg-neutral-900 px-5 py-4 text-sm text-neutral-200 leading-relaxed font-[family-name:var(--font-lora)] max-w-2xl whitespace-pre-wrap">
                {turno.respuesta}
              </div>

              {/* Fuentes */}
              {turno.fuentes.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-1">
                  {turno.fuentes.map((f, j) => {
                    const apellido = f.autor?.split(',')[0] ?? 'Autor'
                    return (
                      <Link
                        key={j}
                        href={`/lector/${f.documentoId}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 transition-colors"
                      >
                        <BookMarked className="h-3 w-3" />
                        {apellido} ({f.año || 's.f.'}, p.{f.pagina})
                      </Link>
                    )
                  })}
                </div>
              )}

              {/* Guardar como nota */}
              <button
                onClick={() => guardarComoNota(turno)}
                className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-400 pl-1"
              >
                Guardar como nota
              </button>
            </div>
          </div>
        ))}

        {/* Respuesta en curso */}
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
            Busca en {' '}
            <span className="text-neutral-500">todos los documentos indexados</span>
            {' '}· Ctrl+Enter para enviar
          </p>
        </div>
      </div>
    </div>
  )
}
