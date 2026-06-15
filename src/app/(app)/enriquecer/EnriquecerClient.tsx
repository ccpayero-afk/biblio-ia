'use client'

import { useState, useRef, useCallback, DragEvent } from 'react'
import Link from 'next/link'
import {
  Sparkles, Upload, FileText, Quote, StickyNote, BookOpen,
  Loader2, AlertCircle, ArrowRight, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import type { Recomendacion } from '@/app/api/enriquecer/route'
import { useScope, scopeParam } from '@/lib/scope-context'

const MAX_CHARS = 12000

function badge(tipo: Recomendacion['tipo']) {
  if (tipo === 'cita') return { label: 'Cita', color: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.3)', text: '#c4b5fd', Icon: Quote }
  if (tipo === 'nota') return { label: 'Nota', color: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.25)', text: '#67e8f9', Icon: StickyNote }
  if (tipo === 'fragmento') return { label: 'Pasaje', color: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', text: '#6ee7b7', Icon: BookOpen }
  return { label: 'Documento', color: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)', text: '#fde68a', Icon: BookOpen }
}

function linkFor(r: Recomendacion) {
  if (r.tipo === 'cita') return '/citas'
  if (r.tipo === 'nota') return '/notas'
  if ((r.tipo === 'fragmento' || r.tipo === 'documento') && r.pagina)
    return `/lector/${r.itemId}?page=${r.pagina}`
  return `/lector/${r.itemId}`
}

function RecomendacionCard({ r }: { r: Recomendacion }) {
  const [expandida, setExpandida] = useState(false)
  const b = badge(r.tipo)
  const Icon = b.Icon

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header row */}
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
        onClick={() => setExpandida(!expandida)}
      >
        <div
          className="mt-0.5 flex-shrink-0 h-6 w-6 rounded-lg flex items-center justify-center"
          style={{ background: b.color, border: `1px solid ${b.border}` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: b.text }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{ background: b.color, border: `1px solid ${b.border}`, color: b.text }}
            >
              {b.label}
            </span>
            {r.relevancia === 'alta' && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(52,211,153,0.85)' }}
              >
                Alta relevancia
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-white leading-snug truncate">{r.titulo}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {r.autor && <span className="text-xs truncate" style={{ color: 'rgba(148,163,184,0.5)' }}>{r.autor}</span>}
            {r.pagina && (
              <span className="text-xs rounded px-1.5 py-0.5" style={{ background: 'rgba(16,185,129,0.1)', color: '#6ee7b7' }}>
                p. {r.pagina}
              </span>
            )}
          </div>
        </div>
        <span className="flex-shrink-0 mt-1" style={{ color: 'rgba(148,163,184,0.35)' }}>
          {expandida ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Expandible detail */}
      {expandida && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          {/* Razon */}
          <div className="pt-3">
            <p className="text-xs font-medium mb-1" style={{ color: 'rgba(139,92,246,0.6)' }}>Por qué complementa tu texto</p>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(203,213,225,0.8)' }}>{r.razon}</p>
          </div>

          {/* Parrafo del texto relacionado */}
          {r.parrafo && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'rgba(148,163,184,0.4)' }}>Relacionado con</p>
              <p
                className="text-xs italic leading-relaxed px-3 py-2 rounded-lg border-l-2"
                style={{ color: 'rgba(148,163,184,0.6)', background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(139,92,246,0.3)' }}
              >
                &ldquo;{r.parrafo}&rdquo;
              </p>
            </div>
          )}

          {/* Fragmento del recurso */}
          {r.fragmento && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'rgba(148,163,184,0.4)' }}>Fragmento</p>
              <p
                className="text-xs italic leading-relaxed px-3 py-2 rounded-lg"
                style={{ color: 'rgba(203,213,225,0.65)', background: 'rgba(109,40,217,0.06)' }}
              >
                &ldquo;{r.fragmento}…&rdquo;
              </p>
            </div>
          )}

          {/* Link */}
          <Link
            href={linkFor(r)}
            className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{ color: '#a78bfa' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#c4b5fd' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#a78bfa' }}
          >
            {r.tipo === 'fragmento' && r.pagina ? `Ir a p. ${r.pagina}` : 'Ver en BiblioIA'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  )
}

export default function EnriquecerClient() {
  const [texto, setTexto] = useState('')
  const [arrastrando, setArrastrando] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [error, setError] = useState('')
  const [analisis, setAnalisis] = useState('')
  const [recomendaciones, setRecomendaciones] = useState<Recomendacion[]>([])
  const [fragmentosIncluidos, setFragmentosIncluidos] = useState(0)
  const [warningFragmentos, setWarningFragmentos] = useState('')
  const [yaAnalizado, setYaAnalizado] = useState(false)
  const [paginaActual, setPaginaActual] = useState(0)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [hayMas, setHayMas] = useState(true)
  const [todosLosIds, setTodosLosIds] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const { scope } = useScope()

  const cargarArchivo = useCallback(async (file: File) => {
    const nombre = file.name.toLowerCase()
    if (nombre.endsWith('.txt')) {
      const t = await file.text()
      setTexto(t.slice(0, MAX_CHARS))
      return
    }
    if (nombre.endsWith('.docx')) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/enriquecer/extraer', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setTexto((data.texto as string).slice(0, MAX_CHARS))
      return
    }
    setError('Formato no soportado. Usá .txt o .docx, o pegá el texto directamente.')
  }, [])

  const onDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setArrastrando(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await cargarArchivo(file)
  }, [cargarArchivo])

  const analizar = useCallback(async () => {
    if (!texto.trim() || analizando) return
    setAnalizando(true)
    setError('')
    setRecomendaciones([])
    setAnalisis('')
    setFragmentosIncluidos(0)
    setWarningFragmentos('')
    setYaAnalizado(false)
    setPaginaActual(0)
    setHayMas(true)
    setTodosLosIds([])
    try {
      const res = await fetch('/api/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, ...scopeParam(scope) }),
      })
      if (!res.ok && res.headers.get('content-type')?.includes('application/json') === false) {
        setError('El análisis tardó demasiado. Intentá con un texto más corto o menos documentos indexados.')
        return
      }
      const data = await res.json().catch(() => ({ error: 'Respuesta inválida del servidor. Intentá de nuevo.' }))
      if (data.error) { setError(data.error); return }
      const recs: Recomendacion[] = data.recomendaciones ?? []
      setAnalisis(data.analisis ?? '')
      setRecomendaciones(recs)
      setFragmentosIncluidos(data.fragmentosIncluidos ?? 0)
      setWarningFragmentos(data.warningFragmentos ?? '')
      setTodosLosIds(recs.map((r) => r.itemId))
      setYaAnalizado(true)
    } catch (e) {
      setError(String(e))
    } finally {
      setAnalizando(false)
    }
  }, [texto, analizando])

  const buscarMas = useCallback(async () => {
    if (cargandoMas) return
    setCargandoMas(true)
    const nuevaPagina = paginaActual + 1
    try {
      const res = await fetch('/api/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, ...scopeParam(scope), pagina: nuevaPagina, excluirIds: todosLosIds }),
      })
      const data = await res.json().catch(() => ({ error: 'Respuesta inválida del servidor.' }))
      if (data.error) { setError(data.error); setCargandoMas(false); return }
      const nuevas: Recomendacion[] = data.recomendaciones ?? []
      if (nuevas.length === 0) { setHayMas(false); setCargandoMas(false); return }
      setPaginaActual(nuevaPagina)
      setRecomendaciones((prev) => [...prev, ...nuevas])
      setTodosLosIds((prev) => [...prev, ...nuevas.map((r) => r.itemId)])
      setFragmentosIncluidos((prev) => prev + (data.fragmentosIncluidos ?? 0))
    } catch (e) {
      setError(String(e))
    } finally {
      setCargandoMas(false)
    }
  }, [cargandoMas, paginaActual, texto, scope, todosLosIds])

  const altaRel = recomendaciones.filter((r) => r.relevancia === 'alta')
  const mediaRel = recomendaciones.filter((r) => r.relevancia !== 'alta')

  const porcentaje = Math.min(100, Math.round((texto.length / MAX_CHARS) * 100))

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#080812' }}>

      {/* ── LEFT: Editor de texto ─────────────────────────────────────────── */}
      <div
        className="flex flex-col"
        style={{ width: '52%', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
            >
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Enriquecer texto</h1>
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
                Pegá o subí tu texto y la IA lo conecta con tu biblioteca
              </p>
            </div>
          </div>

          {texto && (
            <button
              onClick={() => { setTexto(''); setRecomendaciones([]); setAnalisis(''); setYaAnalizado(false) }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(148,163,184,0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#e2e8f0' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Drop zone + textarea */}
        <div
          className="flex-1 relative overflow-hidden"
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={onDrop}
        >
          {arrastrando && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-none"
              style={{ background: 'rgba(109,40,217,0.15)', border: '2px dashed rgba(139,92,246,0.5)' }}
            >
              <Upload className="h-8 w-8" style={{ color: '#a78bfa' }} />
              <p className="text-sm font-medium text-white">Soltá el archivo aquí</p>
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>.txt · .docx</p>
            </div>
          )}

          {texto === '' && !arrastrando && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}
              >
                <FileText className="h-7 w-7" style={{ color: 'rgba(139,92,246,0.5)' }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: 'rgba(148,163,184,0.5)' }}>Pegá tu texto aquí</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(148,163,184,0.3)' }}>
                  o arrastrá un .txt / .docx
                </p>
              </div>
            </div>
          )}

          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, MAX_CHARS))}
            placeholder=""
            className="absolute inset-0 w-full h-full resize-none bg-transparent px-5 py-5 text-sm leading-relaxed focus:outline-none font-[family-name:var(--font-lora)]"
            style={{ color: 'rgba(226,232,240,0.9)', caretColor: '#a78bfa' }}
          />
        </div>

        {/* Footer bar */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* File upload */}
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.docx"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) cargarArchivo(f) }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.6)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#e2e8f0' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.6)' }}
          >
            <Upload className="h-3.5 w-3.5" /> Subir archivo
          </button>

          {/* Char counter */}
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${porcentaje}%`,
                  background: porcentaje > 90
                    ? 'rgba(239,68,68,0.7)'
                    : 'linear-gradient(90deg, rgba(139,92,246,0.5), rgba(6,182,212,0.4))',
                }}
              />
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'rgba(148,163,184,0.35)' }}>
              {texto.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>

          {/* Analyze button */}
          <button
            onClick={analizar}
            disabled={!texto.trim() || analizando}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.8), rgba(6,182,212,0.6))', color: '#fff' }}
          >
            {analizando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Analizando...</>
              : <><Sparkles className="h-4 w-4" /> Analizar</>
            }
          </button>
        </div>
      </div>

      {/* ── RIGHT: Resultados ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className="flex-shrink-0 px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-sm font-semibold text-white">
            {yaAnalizado
              ? `${recomendaciones.length} recurso${recomendaciones.length !== 1 ? 's' : ''} recomendado${recomendaciones.length !== 1 ? 's' : ''}`
              : 'Recomendaciones'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.4)' }}>
            {yaAnalizado
              ? fragmentosIncluidos > 0
                ? `${fragmentosIncluidos} fragmento${fragmentosIncluidos !== 1 ? 's' : ''} de PDFs incluido${fragmentosIncluidos !== 1 ? 's' : ''}`
                : warningFragmentos
                  ? 'Solo metadatos de documentos (sin contenido indexado)'
                  : 'De tu biblioteca personal'
              : 'Aparecerán aquí después de analizar'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-3 rounded-xl p-4 mb-4 text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Loading */}
          {analizando && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.1))', border: '1px solid rgba(139,92,246,0.2)' }}
                >
                  <Sparkles className="h-7 w-7 animate-pulse" style={{ color: 'rgba(139,92,246,0.8)' }} />
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-medium">Analizando tu texto</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(148,163,184,0.5)' }}>
                  Buscando conexiones en tu biblioteca...
                </p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!analizando && !yaAnalizado && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <Sparkles className="h-7 w-7" style={{ color: 'rgba(148,163,184,0.2)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'rgba(148,163,184,0.4)' }}>
                Pegá un texto a la izquierda
              </p>
              <p className="text-xs mt-1 max-w-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.25)' }}>
                La IA analizará su contenido y buscará qué citas, notas y documentos de tu biblioteca lo pueden enriquecer
              </p>
            </div>
          )}

          {/* Results */}
          {!analizando && yaAnalizado && (
            <div className="space-y-5">
              {/* Analisis general */}
              {analisis && (
                <div
                  className="rounded-2xl p-4"
                  style={{ background: 'rgba(109,40,217,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}
                >
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(139,92,246,0.6)' }}>
                    Análisis del texto
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(203,213,225,0.85)' }}>{analisis}</p>
                </div>
              )}

              {/* No recommendations */}
              {recomendaciones.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm" style={{ color: 'rgba(148,163,184,0.4)' }}>
                    No se encontraron recursos relevantes en tu biblioteca para este texto.
                  </p>
                </div>
              )}

              {/* Alta relevancia */}
              {altaRel.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(52,211,153,0.6)' }}>
                    Alta relevancia · {altaRel.length}
                  </p>
                  <div className="space-y-2">
                    {altaRel.map((r, i) => <RecomendacionCard key={i} r={r} />)}
                  </div>
                </div>
              )}

              {/* Media relevancia */}
              {mediaRel.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(148,163,184,0.4)' }}>
                    Complementarios · {mediaRel.length}
                  </p>
                  <div className="space-y-2">
                    {mediaRel.map((r, i) => <RecomendacionCard key={`m${i}`} r={r} />)}
                  </div>
                </div>
              )}

              {/* Buscar más */}
              {hayMas && (
                <div className="pt-2 flex justify-center">
                  <button
                    onClick={buscarMas}
                    disabled={cargandoMas}
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'rgba(109,40,217,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }}
                    onMouseEnter={(e) => { if (!cargandoMas) e.currentTarget.style.background = 'rgba(109,40,217,0.22)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(109,40,217,0.12)' }}
                  >
                    {cargandoMas
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Buscando más...</>
                      : <><Sparkles className="h-4 w-4" /> Buscar 8 más</>
                    }
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
