'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Search, Loader2, BookOpen, Tag, X, Check, Sparkles, Hash } from 'lucide-react'

interface EntradaDiario {
  id: string
  titulo: string
  contenido: string
  etiquetas: string[]
  creadaEn: string
  actualizadaEn: string
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

export default function DiarioClient() {
  const [entradas, setEntradas] = useState<EntradaDiario[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [entradaActiva, setEntradaActiva] = useState<EntradaDiario | null>(null)
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [etiquetas, setEtiquetas] = useState<string[]>([])
  const [etiquetaInput, setEtiquetaInput] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardadoEn, setGuardadoEn] = useState<Date | null>(null)
  const [esNueva, setEsNueva] = useState(false)
  const [reflexion, setReflexion] = useState<string | null>(null)
  const [cargandoReflexion, setCargandoReflexion] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const entradaIdRef = useRef<string>('')
  const esNuevaRef = useRef(false)
  const tituloRef = useRef('')
  const contenidoRef = useRef('')
  const etiquetasRef = useRef<string[]>([])

  // Keep refs in sync
  useEffect(() => { tituloRef.current = titulo }, [titulo])
  useEffect(() => { contenidoRef.current = contenido }, [contenido])
  useEffect(() => { etiquetasRef.current = etiquetas }, [etiquetas])

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

  // Ctrl+S save
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        guardarConRefs()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function abrirEntrada(e: EntradaDiario) {
    setEntradaActiva(e)
    setTitulo(e.titulo)
    setContenido(e.contenido)
    setEtiquetas(e.etiquetas)
    setEsNueva(false)
    esNuevaRef.current = false
    entradaIdRef.current = e.id
    setReflexion(null)
  }

  function nuevaEntrada() {
    const nueva: EntradaDiario = {
      id: '', titulo: '', contenido: '', etiquetas: [],
      creadaEn: new Date().toISOString(), actualizadaEn: new Date().toISOString(),
    }
    setEntradaActiva(nueva)
    setTitulo(''); setContenido(''); setEtiquetas([])
    setEsNueva(true); esNuevaRef.current = true
    entradaIdRef.current = ''
    setReflexion(null)
  }

  async function guardarConRefs() {
    if (!entradaIdRef.current && !esNuevaRef.current) return
    setGuardando(true)
    try {
      if (esNuevaRef.current) {
        const res = await fetch('/api/diario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo: tituloRef.current.trim() || 'Sin título', contenido: contenidoRef.current, etiquetas: etiquetasRef.current }),
        })
        const data = await res.json()
        if (data.id) {
          setEntradaActiva(data); setEsNueva(false)
          esNuevaRef.current = false; entradaIdRef.current = data.id
          setEntradas(prev => [data, ...prev])
        }
      } else {
        const id = entradaIdRef.current
        const res = await fetch(`/api/diario/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo: tituloRef.current.trim() || 'Sin título', contenido: contenidoRef.current, etiquetas: etiquetasRef.current }),
        })
        const data = await res.json()
        if (data.id) {
          setEntradaActiva(data)
          setEntradas(prev => prev.map(e => e.id === data.id ? data : e))
        }
      }
      setGuardadoEn(new Date())
    } catch { /* silencioso */ }
    setGuardando(false)
  }

  function programarAutoguardado() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => guardarConRefs(), 1500)
  }

  async function eliminar() {
    if (!entradaActiva || esNueva) return
    if (!confirm('¿Eliminar esta entrada del diario?')) return
    await fetch(`/api/diario/${entradaActiva.id}`, { method: 'DELETE' })
    setEntradaActiva(null)
    setEntradas(prev => prev.filter(e => e.id !== entradaActiva.id))
  }

  function agregarEtiqueta(tag: string) {
    const t = tag.trim().toLowerCase().replace(/^#/, '')
    if (!t || etiquetas.includes(t)) return
    const nuevas = [...etiquetas, t]
    setEtiquetas(nuevas)
    etiquetasRef.current = nuevas
    setEtiquetaInput('')
    programarAutoguardado()
  }

  function quitarEtiqueta(tag: string) {
    const nuevas = etiquetas.filter(t => t !== tag)
    setEtiquetas(nuevas)
    etiquetasRef.current = nuevas
    programarAutoguardado()
  }

  async function generarReflexion() {
    if (!contenido.trim()) return
    setCargandoReflexion(true); setReflexion(null)
    try {
      const res = await fetch('/api/inteligencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pregunta: `Leé esta entrada de diario de investigación y generá 3 preguntas reflexivas breves que ayuden al investigador a profundizar en sus ideas o descubrir puntos ciegos. Sé directo y específico al contenido. Entrada:\n\n${contenido.slice(0, 1500)}`,
          tipo: 'reflexion',
        }),
      })
      const data = await res.json()
      if (data.respuesta) setReflexion(data.respuesta)
    } catch { /* silencioso */ }
    setCargandoReflexion(false)
  }

  const entradasFiltradas = entradas.filter(e => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return e.titulo.toLowerCase().includes(q) || e.contenido.toLowerCase().includes(q) || e.etiquetas.some(t => t.includes(q))
  })

  const palabras = wordCount(contenido)

  return (
    <div className="-m-4 md:-m-6 flex h-full overflow-hidden">
      {/* Panel izquierdo */}
      <div className="flex w-72 flex-shrink-0 flex-col" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2 p-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(5,5,12,0.6)' }}>
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.3)' }} />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..."
              className="w-full rounded-lg py-1.5 pl-7 pr-3 text-xs text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }} />
          </div>
          <button onClick={nuevaEntrada}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 10px rgba(124,58,237,0.3)' }}
            title="Nueva entrada">
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
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>Empezá registrando las ideas de hoy</p>
              <button onClick={nuevaEntrada} className="mt-3 text-xs transition-colors" style={{ color: 'rgba(139,92,246,0.7)' }}>
                + Nueva entrada
              </button>
            </div>
          )}
          {entradasFiltradas.map(e => {
            const isActive = entradaActiva?.id === e.id
            return (
              <button key={e.id} onClick={() => abrirEntrada(e)}
                className="block w-full px-4 py-3 text-left transition-all"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isActive ? 'linear-gradient(90deg, rgba(109,40,217,0.12), rgba(30,58,138,0.08))' : '', borderLeft: isActive ? '2px solid rgba(139,92,246,0.5)' : '2px solid transparent' }}
                onMouseEnter={el => { if (!isActive) el.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={el => { if (!isActive) el.currentTarget.style.background = '' }}>
                <p className="line-clamp-1 text-sm font-medium text-neutral-100">{e.titulo || 'Sin título'}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
                    {new Date(e.creadaEn).toLocaleDateString('es-AR')}
                  </p>
                  {e.etiquetas.length > 0 && (
                    <div className="flex gap-1">
                      {e.etiquetas.slice(0, 2).map(t => (
                        <span key={t} className="rounded px-1 text-[10px]" style={{ background: 'rgba(139,92,246,0.12)', color: 'rgba(167,139,250,0.7)' }}>#{t}</span>
                      ))}
                      {e.etiquetas.length > 2 && <span className="text-[10px]" style={{ color: 'rgba(148,163,184,0.3)' }}>+{e.etiquetas.length - 2}</span>}
                    </div>
                  )}
                </div>
                {e.contenido && (
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{e.contenido.slice(0, 80)}{e.contenido.length > 80 ? '…' : ''}</p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Panel derecho: editor */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {entradaActiva !== null ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Barra superior */}
            <div className="flex items-center justify-between gap-3 px-6 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(5,5,12,0.4)' }}>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
                  {new Date(entradaActiva.creadaEn || new Date()).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                {palabras > 0 && (
                  <span className="text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>
                    · {palabras} {palabras === 1 ? 'palabra' : 'palabras'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {guardando && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
                    <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
                  </span>
                )}
                {!guardando && guardadoEn && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(34,197,94,0.5)' }}>
                    <Check className="h-3 w-3" /> Guardado
                  </span>
                )}
                <button onClick={guardarConRefs} disabled={guardando}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all disabled:opacity-50"
                  style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
                  title="Guardar (Ctrl+S)">
                  Guardar
                </button>
                {!esNueva && (
                  <button onClick={eliminar}
                    className="rounded-lg px-3 py-1.5 text-xs transition-all"
                    style={{ border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.6)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '' }}>
                    Eliminar
                  </button>
                )}
              </div>
            </div>

            {/* Área de edición */}
            <div className="flex flex-1 flex-col overflow-y-auto px-8 py-6 gap-4">
              {/* Título editable */}
              <div className="group relative">
                <input
                  value={titulo}
                  onChange={e => { setTitulo(e.target.value); tituloRef.current = e.target.value; programarAutoguardado() }}
                  placeholder="Título de la entrada"
                  className="w-full bg-transparent text-2xl font-bold text-white placeholder:text-neutral-700 focus:outline-none pb-1"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                  onFocus={e => { e.currentTarget.style.borderBottomColor = 'rgba(139,92,246,0.5)' }}
                  onBlur={e => { e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.08)' }}
                />
              </div>

              {/* Contenido */}
              <textarea
                value={contenido}
                onChange={e => { setContenido(e.target.value); contenidoRef.current = e.target.value; programarAutoguardado() }}
                placeholder="Escribí tus ideas, reflexiones, avances del día…"
                className="flex-1 min-h-[240px] resize-none bg-transparent text-sm leading-relaxed text-neutral-200 placeholder:text-neutral-700 focus:outline-none"
                style={{ lineHeight: '1.8' }}
              />

              {/* Etiquetas */}
              <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-3.5 w-3.5" style={{ color: 'rgba(139,92,246,0.6)' }} />
                  <span className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.5)' }}>Etiquetas</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {etiquetas.map(tag => (
                    <span key={tag} className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs"
                      style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }}>
                      <Hash className="h-2.5 w-2.5" />{tag}
                      <button onClick={() => quitarEtiqueta(tag)} className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={etiquetaInput}
                    onChange={e => setEtiquetaInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); agregarEtiqueta(etiquetaInput) }
                      if (e.key === 'Backspace' && !etiquetaInput && etiquetas.length) quitarEtiqueta(etiquetas[etiquetas.length - 1])
                    }}
                    placeholder={etiquetas.length ? '+ etiqueta' : 'metodología, terreno, teoría…'}
                    className="min-w-[120px] flex-1 bg-transparent text-xs text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
                  />
                </div>
                <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.3)' }}>Enter o coma para agregar · Backspace para quitar la última</p>
              </div>

              {/* Reflexión IA */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
                <button onClick={generarReflexion} disabled={cargandoReflexion || !contenido.trim()}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-all disabled:opacity-40"
                  style={{ background: 'rgba(139,92,246,0.05)', color: 'rgba(167,139,250,0.8)' }}
                  onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(139,92,246,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.05)' }}>
                  {cargandoReflexion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  <span className="text-xs font-medium">Preguntas reflexivas con IA</span>
                  <span className="ml-auto text-[10px]" style={{ color: 'rgba(148,163,184,0.3)' }}>basadas en esta entrada</span>
                </button>
                {reflexion && (
                  <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(139,92,246,0.1)', background: 'rgba(139,92,246,0.03)' }}>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(221,214,254,0.85)' }}>{reflexion}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.08))', border: '1px solid rgba(139,92,246,0.2)' }}>
              <BookOpen className="h-7 w-7" style={{ color: 'rgba(139,92,246,0.6)' }} />
            </div>
            <p className="text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>Seleccioná una entrada o creá una nueva</p>
            <button onClick={nuevaEntrada}
              className="mt-5 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 20px rgba(124,58,237,0.3)' }}>
              <Plus className="h-4 w-4" /> Nueva entrada
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
