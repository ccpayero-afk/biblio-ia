'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Sparkles, Loader2, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Proyecto, SeccionProyecto } from '@/types'

export default function ProyectoClient() {
  const { id } = useParams<{ id: string }>()
  const [proyecto, setProyecto] = useState<Proyecto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [seccionAbierta, setSeccionAbierta] = useState<string | null>(null)
  const [generando, setGenerando] = useState<string | null>(null)
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [nuevoArgumento, setNuevoArgumento] = useState('')
  const borradorRef = useRef<Record<string, string>>({})

  useEffect(() => {
    fetch(`/api/proyectos/${id}`)
      .then((r) => r.json())
      .then((p: Proyecto) => { setProyecto(p); setCargando(false) })
      .catch(() => setCargando(false))
  }, [id])

  async function guardar(p: Proyecto) {
    await fetch(`/api/proyectos/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    })
  }

  async function agregarSeccion() {
    if (!proyecto || !nuevoTitulo.trim()) return
    const nueva: SeccionProyecto = {
      id: `sec_${Date.now()}`,
      titulo: nuevoTitulo,
      argumento: nuevoArgumento,
      citasAsignadas: [],
      orden: proyecto.secciones.length,
    }
    const actualizado = {
      ...proyecto,
      secciones: [...proyecto.secciones, nueva],
      actualizadoEn: new Date().toISOString(),
    }
    setProyecto(actualizado)
    setNuevoTitulo('')
    setNuevoArgumento('')
    await guardar(actualizado)
  }

  async function generarBorrador(seccionId: string) {
    if (!proyecto) return
    setGenerando(seccionId)
    setSeccionAbierta(seccionId)
    borradorRef.current[seccionId] = ''

    const res = await fetch(`/api/proyectos/${id}/borrador`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seccionId }),
    })

    if (!res.body) { setGenerando(null); return }

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
          borradorRef.current[seccionId] = (borradorRef.current[seccionId] ?? '') + payload.texto
          // Force re-render
          setProyecto((prev) => prev ? { ...prev } : prev)
        }
        if (payload.done) {
          setProyecto((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              secciones: prev.secciones.map((s) =>
                s.id === seccionId ? { ...s, borrador: borradorRef.current[seccionId] } : s
              ),
            }
          })
        }
      }
    }
    setGenerando(null)
  }

  if (cargando || !proyecto) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-neutral-600" /></div>
  }

  return (
    <div className="max-w-3xl">
      <Link href="/proyectos" className="mb-6 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a proyectos
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-500">{proyecto.tipo}</span>
        </div>
        <h1 className="text-xl font-semibold text-white">{proyecto.nombre}</h1>
        {proyecto.argumentoCentral && (
          <p className="mt-2 text-sm text-neutral-400 border-l-2 border-neutral-700 pl-3">{proyecto.argumentoCentral}</p>
        )}
      </div>

      {/* Secciones */}
      <div className="space-y-3 mb-6">
        <h2 className="text-sm font-semibold text-white">Secciones</h2>
        {proyecto.secciones.map((sec) => (
          <div key={sec.id} className="rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{sec.titulo}</p>
                {sec.argumento && <p className="text-xs text-neutral-500 mt-0.5">{sec.argumento}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => generarBorrador(sec.id)}
                  disabled={generando === sec.id}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-50"
                >
                  {generando === sec.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {generando === sec.id ? 'Generando…' : sec.borrador ? 'Regenerar' : 'Generar'}
                </button>
                <button
                  onClick={() => setSeccionAbierta(seccionAbierta === sec.id ? null : sec.id)}
                  className="text-neutral-500 hover:text-neutral-300"
                >
                  {seccionAbierta === sec.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {seccionAbierta === sec.id && (
              <div className="border-t border-neutral-800 px-4 py-4">
                {(generando === sec.id || sec.borrador || borradorRef.current[sec.id]) ? (
                  <div className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap font-[family-name:var(--font-lora)]">
                    {borradorRef.current[sec.id] || sec.borrador}
                    {generando === sec.id && (
                      <span className="inline-flex gap-1 ml-1 text-neutral-600">
                        <span className="animate-bounce">·</span>
                        <span className="animate-bounce [animation-delay:0.15s]">·</span>
                        <span className="animate-bounce [animation-delay:0.3s]">·</span>
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-600">Sin borrador generado. Usá "Generar" para que la IA redacte esta sección.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Nueva sección */}
      <div className="rounded-xl border border-dashed border-neutral-700 p-4 space-y-2">
        <h3 className="text-xs font-semibold text-neutral-500">Agregar sección</h3>
        <input
          value={nuevoTitulo}
          onChange={(e) => setNuevoTitulo(e.target.value)}
          placeholder="Título de la sección"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
        />
        <textarea
          value={nuevoArgumento}
          onChange={(e) => setNuevoArgumento(e.target.value)}
          placeholder="Argumento o propósito de esta sección"
          rows={2}
          className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
        />
        <button
          onClick={agregarSeccion}
          disabled={!nuevoTitulo.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Agregar
        </button>
      </div>
    </div>
  )
}
