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
          <h1 className="text-xl font-bold text-white">Proyectos de escritura</h1>
          <p className="mt-1 text-sm" style={{ color: 'rgba(148,163,184,0.55)' }}>Tesis, artículos, ponencias y más con asistencia de IA.</p>
        </div>
        <button
          onClick={() => setCreando(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white transition-all"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #0891b2)',
            boxShadow: '0 0 16px rgba(124,58,237,0.3)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 24px rgba(124,58,237,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 16px rgba(124,58,237,0.3)'; e.currentTarget.style.transform = '' }}
        >
          <Plus className="h-4 w-4" /> Nuevo proyecto
        </button>
      </div>

      {/* Formulario de creación */}
      {creando && (
        <div
          className="mb-6 rounded-2xl p-5 space-y-3"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(139,92,246,0.25)' }}
        >
          <h2 className="text-sm font-semibold text-white">Nuevo proyecto</h2>
          <input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Título del proyecto"
            className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
          />
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value as Proyecto['tipo'] })}
            className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {TIPOS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <textarea
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Descripción breve"
            rows={2}
            className="w-full resize-none rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
          />
          <textarea
            value={form.argumentoCentral}
            onChange={(e) => setForm({ ...form, argumentoCentral: e.target.value })}
            placeholder="Argumento central del proyecto"
            rows={2}
            className="w-full resize-none rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
          />
          <div className="flex gap-2">
            <button
              onClick={crear}
              className="rounded-xl px-4 py-2 text-sm text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 12px rgba(124,58,237,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(124,58,237,0.5)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 12px rgba(124,58,237,0.3)' }}
            >
              Crear
            </button>
            <button
              onClick={() => setCreando(false)}
              className="rounded-xl px-4 py-2 text-sm transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(148,163,184,0.6)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.6)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="py-10 text-center text-sm" style={{ color: 'rgba(148,163,184,0.4)' }}>Cargando…</div>
      ) : proyectos.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.06))', border: '1px solid rgba(139,92,246,0.2)' }}
          >
            <FolderOpen className="h-8 w-8" style={{ color: 'rgba(139,92,246,0.6)' }} />
          </div>
          <p className="text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>Aún no hay proyectos. Creá uno para empezar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proyectos.map((p) => (
            <div
              key={p.id}
              className="group flex items-center gap-4 rounded-xl p-4 transition-all"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(124,58,237,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = '' }}
            >
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
              >
                <FolderOpen className="h-4.5 w-4.5" style={{ color: 'rgba(167,139,250,0.8)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: 'rgba(167,139,250,0.7)' }}
                  >{p.tipo}</span>
                  <span className="truncate text-sm font-medium text-white">{p.nombre}</span>
                </div>
                {p.descripcion && (
                  <p className="mt-0.5 truncate text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>{p.descripcion}</p>
                )}
                <p className="mt-0.5 text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>
                  {p.secciones.length} secciones · {new Date(p.actualizadoEn).toLocaleDateString('es')}
                </p>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => eliminar(p.id)}
                  className="transition-colors"
                  style={{ color: 'rgba(148,163,184,0.4)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <Link
                  href={`/proyectos/${p.id}`}
                  className="flex items-center gap-1 text-xs transition-colors"
                  style={{ color: 'rgba(148,163,184,0.5)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#a78bfa' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.5)' }}
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
