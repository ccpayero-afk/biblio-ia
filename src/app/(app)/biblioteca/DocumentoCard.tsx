'use client'

import { useState } from 'react'
import { Documento } from '@/types'
import { FileText, Pencil, Zap } from 'lucide-react'
import Link from 'next/link'

const ESTADO_CONFIG = {
  sin_indexar: { label: 'Sin indexar', color: 'text-neutral-500 bg-neutral-800' },
  indexando: { label: 'Indexando…', color: 'text-blue-400 bg-blue-950 animate-pulse' },
  indexado: { label: 'Indexado', color: 'text-green-400 bg-green-950' },
  error: { label: 'Error', color: 'text-red-400 bg-red-950' },
}

interface Props {
  documento: Documento
  onEditar: () => void
  onIndexadoOk: (documentoId: string, fragmentos: number) => void
}

export default function DocumentoCard({ documento, onEditar, onIndexadoOk }: Props) {
  const [estado, setEstado] = useState(documento.estado)
  const [progreso, setProgreso] = useState<{ msg: string; paso: number; total: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const estadoConfig = ESTADO_CONFIG[estado]

  async function iniciarIndexacion() {
    setEstado('indexando')
    setErrorMsg(null)
    setProgreso({ msg: 'Iniciando…', paso: 0, total: 5 })

    try {
      const res = await fetch(`/api/index/${documento.id}`, { method: 'POST' })
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

          if (payload.error) {
            setEstado('error')
            setErrorMsg(payload.error)
            setProgreso(null)
            return
          }
          if (payload.done) {
            setEstado('indexado')
            setProgreso(null)
            onIndexadoOk(documento.id, payload.fragmentos)
            return
          }
          setProgreso({ msg: payload.msg, paso: payload.paso, total: payload.total })
        }
      }
    } catch (e) {
      setEstado('error')
      setErrorMsg(e instanceof Error ? e.message : 'Error desconocido')
      setProgreso(null)
    }
  }

  return (
    <div className="group relative flex flex-col rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700">
      <div className="flex items-start justify-between gap-2">
        <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-neutral-500" />
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {(estado === 'sin_indexar' || estado === 'error') && (
            <button
              onClick={iniciarIndexacion}
              className="rounded p-1 text-neutral-600 hover:text-blue-400"
              title="Indexar documento"
            >
              <Zap className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onEditar}
            className="rounded p-1 text-neutral-600 hover:text-neutral-300"
            title="Editar metadatos"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex-1">
        <Link
          href={`/lector/${documento.id}`}
          className="line-clamp-2 text-sm font-medium text-white hover:text-blue-400"
        >
          {documento.nombre.replace(/\.pdf$/i, '')}
        </Link>
        {documento.autor && (
          <p className="mt-1 text-xs text-neutral-500">
            {documento.autor}{documento.año ? ` (${documento.año})` : ''}
          </p>
        )}
      </div>

      {/* Barra de progreso */}
      {progreso && (
        <div className="mt-3 space-y-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${(progreso.paso / progreso.total) * 100}%` }}
            />
          </div>
          <p className="truncate text-xs text-neutral-500">{progreso.msg}</p>
        </div>
      )}

      {/* Estado + fragmentos */}
      {!progreso && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${estadoConfig.color}`}>
            {estadoConfig.label}
          </span>
          {estado === 'indexado' && documento.fragmentos > 0 && (
            <span className="text-xs text-neutral-600">{documento.fragmentos} fragmentos</span>
          )}
        </div>
      )}

      {errorMsg && (
        <p className="mt-1 line-clamp-2 text-xs text-red-400">{errorMsg}</p>
      )}

      {documento.etiquetas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {documento.etiquetas.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
