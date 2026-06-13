'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Search, Loader2, BookOpen } from 'lucide-react'

interface EntradaDiario {
  id: string
  titulo: string
  contenido: string
  etiquetas: string[]
  creadaEn: string
  actualizadaEn: string
}

export default function DiarioClient() {
  const [entradas, setEntradas] = useState<EntradaDiario[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [entradaActiva, setEntradaActiva] = useState<EntradaDiario | null>(null)
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [etiquetas, setEtiquetas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [esNueva, setEsNueva] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cambiosPendientes = useRef(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/diario')
      const data = await res.json()
      if (Array.isArray(data)) setEntradas(data)
    } catch { /* silencioso */ }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function abrirEntrada(e: EntradaDiario) {
    setEntradaActiva(e)
    setTitulo(e.titulo)
    setContenido(e.contenido)
    setEtiquetas(e.etiquetas.join(', '))
    setEsNueva(false)
    cambiosPendientes.current = false
  }

  function nuevaEntrada() {
    const nueva: EntradaDiario = {
      id: '',
      titulo: '',
      contenido: '',
      etiquetas: [],
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
    }
    setEntradaActiva(nueva)
    setTitulo('')
    setContenido('')
    setEtiquetas('')
    setEsNueva(true)
    cambiosPendientes.current = false
  }

  async function guardar() {
    if (!entradaActiva) return
    setGuardando(true)
    const etiquetasArr = etiquetas.split(',').map((e) => e.trim()).filter(Boolean)
    try {
      if (esNueva) {
        const res = await fetch('/api/diario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo: titulo.trim() || 'Sin título', contenido, etiquetas: etiquetasArr }),
        })
        const data = await res.json()
        if (data.id) {
          setEntradaActiva(data)
          setEsNueva(false)
          await cargar()
        }
      } else {
        const res = await fetch(`/api/diario/${entradaActiva.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo: titulo.trim() || 'Sin título', contenido, etiquetas: etiquetasArr }),
        })
        const data = await res.json()
        if (data.id) {
          setEntradaActiva(data)
          setEntradas((prev) => prev.map((e) => (e.id === data.id ? data : e)))
        }
      }
    } catch { /* silencioso */ }
    setGuardando(false)
    cambiosPendientes.current = false
  }

  async function eliminar() {
    if (!entradaActiva || esNueva) return
    if (!confirm('¿Eliminar esta entrada del diario?')) return
    await fetch(`/api/diario/${entradaActiva.id}`, { method: 'DELETE' })
    setEntradaActiva(null)
    await cargar()
  }

  // Auto-save con debounce 1500ms
  function onCambio(field: 'titulo' | 'contenido' | 'etiquetas', val: string) {
    if (field === 'titulo') setTitulo(val)
    if (field === 'contenido') setContenido(val)
    if (field === 'etiquetas') setEtiquetas(val)
    if (!entradaActiva) return
    cambiosPendientes.current = true
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (cambiosPendientes.current) guardar()
    }, 1500)
  }

  const entradasFiltradas = entradas.filter((e) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return e.titulo.toLowerCase().includes(q) || e.contenido.toLowerCase().includes(q)
  })

  return (
    <div className="-m-4 md:-m-6 flex h-full overflow-hidden">
      {/* Panel izquierdo */}
      <div
        className="flex w-72 flex-shrink-0 flex-col"
        style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div
          className="flex items-center gap-2 p-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(5,5,12,0.6)' }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.3)' }} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-lg py-1.5 pl-7 pr-3 text-xs text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
            />
          </div>
          <button
            onClick={nuevaEntrada}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 10px rgba(124,58,237,0.3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 18px rgba(124,58,237,0.5)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 10px rgba(124,58,237,0.3)' }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {cargando && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'rgba(139,92,246,0.5)' }} />
            </div>
          )}
          {!cargando && entradasFiltradas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <BookOpen className="h-8 w-8 mb-3" style={{ color: 'rgba(139,92,246,0.3)' }} />
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
                Empezá registrando las ideas de hoy
              </p>
              <button
                onClick={nuevaEntrada}
                className="mt-3 text-xs transition-colors"
                style={{ color: 'rgba(139,92,246,0.7)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#a78bfa' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(139,92,246,0.7)' }}
              >
                + Nueva entrada
              </button>
            </div>
          )}
          {entradasFiltradas.map((e) => {
            const isActive = entradaActiva?.id === e.id
            return (
              <button
                key={e.id}
                onClick={() => abrirEntrada(e)}
                className="block w-full px-4 py-3 text-left transition-all"
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: isActive ? 'linear-gradient(90deg, rgba(109,40,217,0.12), rgba(30,58,138,0.08))' : '',
                }}
                onMouseEnter={(el) => { if (!isActive) el.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={(el) => { if (!isActive) el.currentTarget.style.background = '' }}
              >
                <p className="line-clamp-1 text-sm font-medium text-neutral-100">
                  {e.titulo || 'Sin título'}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
                  {new Date(e.creadaEn).toLocaleDateString('es-AR')}
                </p>
                {e.contenido && (
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                    {e.contenido.slice(0, 80)}{e.contenido.length > 80 ? '…' : ''}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Panel derecho: editor */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {entradaActiva !== null ? (
          <div className="flex flex-1 flex-col overflow-hidden p-6 gap-4">
            <div className="flex items-center justify-between gap-4">
              <input
                value={titulo}
                onChange={(e) => onCambio('titulo', e.target.value)}
                placeholder="Título de la entrada"
                className="flex-1 bg-transparent text-2xl font-bold text-white placeholder:text-neutral-700 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                {guardando && <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'rgba(148,163,184,0.4)' }} />}
                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 10px rgba(124,58,237,0.25)' }}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.boxShadow = '0 0 18px rgba(124,58,237,0.45)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 10px rgba(124,58,237,0.25)' }}
                >
                  Guardar
                </button>
                {!esNueva && (
                  <button
                    onClick={eliminar}
                    className="rounded-lg px-3 py-2 text-sm transition-all"
                    style={{ border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.7)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; e.currentTarget.style.background = '' }}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>

            {!esNueva && (
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
                {new Date(entradaActiva.creadaEn).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}

            <textarea
              value={contenido}
              onChange={(e) => onCambio('contenido', e.target.value)}
              placeholder="Escribí tus ideas, reflexiones, avances del día…"
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-neutral-200 placeholder:text-neutral-700 focus:outline-none"
            />

            <input
              value={etiquetas}
              onChange={(e) => onCambio('etiquetas', e.target.value)}
              placeholder="etiquetas, separadas, por coma"
              className="rounded-lg px-3 py-2 text-sm text-neutral-400 placeholder:text-neutral-600 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center px-6">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.08))',
                border: '1px solid rgba(139,92,246,0.2)',
              }}
            >
              <BookOpen className="h-7 w-7" style={{ color: 'rgba(139,92,246,0.6)' }} />
            </div>
            <p className="text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>Seleccioná una entrada o creá una nueva</p>
            <button
              onClick={nuevaEntrada}
              className="mt-5 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 20px rgba(124,58,237,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 30px rgba(124,58,237,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(124,58,237,0.3)'; e.currentTarget.style.transform = '' }}
            >
              <Plus className="h-4 w-4" /> Nueva entrada
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
