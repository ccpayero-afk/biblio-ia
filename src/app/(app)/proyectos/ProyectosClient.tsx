'use client'

import { useEffect, useState } from 'react'
import { FolderOpen, Plus, Trash2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Proyecto } from '@/types'

const TIPOS: Proyecto['tipo'][] = ['tesis', 'articulo', 'ponencia', 'clase', 'informe']

export default function ProyectosClient() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState({
    nombre: '',
    tipo: 'articulo' as Proyecto['tipo'],
    descripcion: '',
    argumentoCentral: '',
  })

  useEffect(() => {
    fetch('/api/proyectos')
      .then((r) => r.json())
      .then((data: Proyecto[]) => { setProyectos(data); setCargando(false) })
      .catch(() => setCargando(false))
  }, [])

  async function crear() {
    if (!form.nombre.trim()) return
    const nuevo: Proyecto = {
      id: `proy_${Date.now()}`,
      nombre: form.nombre,
      tipo: form.tipo,
      descripcion: form.descripcion,
      argumentoCentral: form.argumentoCentral,
      documentosVinculados: [],
      citasVinculadas: [],
      notasVinculadas: [],
      secciones: [],
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    }
    await fetch('/api/proyectos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevo),
    })
    setProyectos((prev) => [nuevo, ...prev])
    setCreando(false)
    setForm({ nombre: '', tipo: 'articulo', descripcion: '', argumentoCentral: '' })
  }

  async function eliminar(id: string) {
    await fetch(`/api/proyectos/${id}`, { method: 'DELETE' })
    setProyectos((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Proyectos de escritura</h1>
          <p className="mt-1 text-sm text-neutral-500">Tesis, artículos, ponencias y más con asistencia de IA.</p>
        </div>
        <button
          onClick={() => setCreando(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" /> Nuevo proyecto
        </button>
      </div>

      {/* Formulario de creación */}
      {creando && (
        <div className="mb-6 rounded-xl border border-neutral-700 bg-neutral-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Nuevo proyecto</h2>
          <input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Título del proyecto"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
          />
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value as Proyecto['tipo'] })}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none"
          >
            {TIPOS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <textarea
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Descripción breve"
            rows={2}
            className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
          />
          <textarea
            value={form.argumentoCentral}
            onChange={(e) => setForm({ ...form, argumentoCentral: e.target.value })}
            placeholder="Argumento central del proyecto"
            rows={2}
            className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
          />
          <div className="flex gap-2">
            <button onClick={crear} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
              Crear
            </button>
            <button onClick={() => setCreando(false)} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="py-10 text-center text-sm text-neutral-600">Cargando…</div>
      ) : proyectos.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <FolderOpen className="h-12 w-12 text-neutral-700" />
          <p className="mt-4 text-sm text-neutral-500">Aún no hay proyectos. Creá uno para empezar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proyectos.map((p) => (
            <div key={p.id} className="group flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <FolderOpen className="h-5 w-5 flex-shrink-0 text-neutral-500" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-500">{p.tipo}</span>
                  <span className="truncate text-sm font-medium text-white">{p.nombre}</span>
                </div>
                {p.descripcion && (
                  <p className="mt-0.5 truncate text-xs text-neutral-500">{p.descripcion}</p>
                )}
                <p className="mt-0.5 text-xs text-neutral-600">
                  {p.secciones.length} secciones · {new Date(p.actualizadoEn).toLocaleDateString('es')}
                </p>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => eliminar(p.id)}
                  className="text-neutral-600 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <Link
                  href={`/proyectos/${p.id}`}
                  className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white"
                >
                  Abrir <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
