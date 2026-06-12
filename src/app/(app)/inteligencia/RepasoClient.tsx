'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen, BookText, Check, X, Minus, Loader2, AlertCircle,
  RefreshCcw, Shuffle, ChevronRight,
} from 'lucide-react'
import type { Nota, TipoNota } from '@/types'

// ─── Spaced repetition ────────────────────────────────────────────────────────

interface CardState {
  interval: number   // days until next review
  ease: number       // 1.3–2.5
  due: string        // YYYY-MM-DD
  reviews: number
}

const STORAGE_KEY = 'biblioai_repaso_v1'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadAll(): Record<string, CardState> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}

function isDue(st: CardState | undefined): boolean {
  return !st || st.due <= todayStr()
}

// grade: 0 = no lo sabía · 1 = con dificultad · 2 = lo sabía
function advance(prev: CardState | undefined, grade: 0 | 1 | 2): CardState {
  const ease = prev?.ease ?? 2.0
  const interval = prev?.interval ?? 1

  let newEase: number
  let newInterval: number

  if (grade === 0) {
    newEase = Math.max(1.3, ease - 0.20)
    newInterval = 1
  } else if (grade === 1) {
    newEase = Math.max(1.3, ease - 0.10)
    newInterval = Math.max(1, Math.round(interval * Math.max(1.1, newEase * 0.8)))
  } else {
    newEase = Math.min(2.5, ease + 0.05)
    newInterval = Math.max(1, Math.round(interval * newEase))
  }

  const d = new Date()
  d.setDate(d.getDate() + newInterval)
  return { interval: newInterval, ease: newEase, due: d.toISOString().slice(0, 10), reviews: (prev?.reviews ?? 0) + 1 }
}

// ─── Card types ──────────────────────────────────────────────────────────────

type NotaCard = Nota & { kind: 'nota' }

interface ConceptoCard {
  kind: 'concepto'
  id: string
  concepto: string
  definicion: string
  documentoNombre: string
}

type RepasoCard = NotaCard | ConceptoCard

// ─── Metadata por tipo ────────────────────────────────────────────────────────

const TIPO_META: Record<TipoNota, { label: string; color: string; bg: string; border: string }> = {
  permanente: { label: 'Permanente', color: '#a78bfa', bg: 'rgba(124,58,237,0.12)',  border: 'rgba(139,92,246,0.28)' },
  referencia:  { label: 'Referencia', color: '#22d3ee', bg: 'rgba(6,182,212,0.09)',   border: 'rgba(6,182,212,0.25)'  },
  estructura:  { label: 'Estructura', color: '#60a5fa', bg: 'rgba(59,130,246,0.09)',  border: 'rgba(59,130,246,0.25)' },
  proyecto:    { label: 'Proyecto',   color: '#34d399', bg: 'rgba(52,211,153,0.09)',  border: 'rgba(52,211,153,0.25)' },
  efimera:     { label: 'Efímera',    color: '#fbbf24', bg: 'rgba(245,158,11,0.09)',  border: 'rgba(245,158,11,0.25)' },
  manual:      { label: 'Manual',     color: '#a78bfa', bg: 'rgba(124,58,237,0.09)',  border: 'rgba(139,92,246,0.22)' },
  ia:          { label: 'IA',         color: '#22d3ee', bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.20)'  },
  consulta:    { label: 'Consulta',   color: '#22d3ee', bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.20)'  },
  ficha:       { label: 'Ficha',      color: '#a78bfa', bg: 'rgba(124,58,237,0.09)',  border: 'rgba(139,92,246,0.22)' },
}

const CONCEPTO_META = {
  label: 'Concepto',
  color: '#34d399',
  bg: 'rgba(52,211,153,0.08)',
  border: 'rgba(52,211,153,0.25)',
}

const TIPOS_REPASO: TipoNota[] = ['permanente', 'referencia', 'manual', 'ia']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RepasoClient() {
  const [notas, setNotas] = useState<Nota[]>([])
  const [conceptos, setConceptos] = useState<ConceptoCard[]>([])
  const [states, setStates] = useState<Record<string, CardState>>({})
  const [cargando, setCargando] = useState(true)
  const [cargandoFichas, setCargandoFichas] = useState(false)
  const [error, setError] = useState('')

  // Session
  const [queue, setQueue] = useState<RepasoCard[]>([])
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [sessionDone, setSessionDone] = useState(0)
  const [modoTodas, setModoTodas] = useState(false)
  const [incluirFichas, setIncluirFichas] = useState(false)

  // Fetch notas once
  useEffect(() => {
    async function cargar() {
      try {
        const res = await fetch('/api/notas')
        const data = await res.json()
        if (!Array.isArray(data)) throw new Error('Respuesta inválida')
        const validas = (data as Nota[]).filter(
          (n) => TIPOS_REPASO.includes(n.tipo) && n.titulo?.trim() && n.contenido?.trim()
        )
        const sts = loadAll()
        setNotas(validas)
        setStates(sts)
      } catch (e) {
        setError(String(e))
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  // Fetch conceptos when toggle is enabled (lazy, cached)
  useEffect(() => {
    if (!incluirFichas || conceptos.length > 0) return
    setCargandoFichas(true)
    fetch('/api/fichas/conceptos')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setConceptos(data as ConceptoCard[]) })
      .catch(() => { /* best effort */ })
      .finally(() => setCargandoFichas(false))
  }, [incluirFichas]) // eslint-disable-line react-hooks/exhaustive-deps

  const buildQueue = useCallback(
    (todas: boolean, sts: Record<string, CardState>, ns: Nota[], cs: ConceptoCard[], usarFichas: boolean) => {
      const notaCards: NotaCard[] = ns.map((n) => ({ ...n, kind: 'nota' as const }))
      const notasPool = todas ? notaCards : notaCards.filter((c) => isDue(sts[c.id]))
      const concPool = usarFichas ? (todas ? cs : cs.filter((c) => isDue(sts[c.id]))) : []
      setQueue(shuffle([...notasPool, ...concPool]))
      setIdx(0)
      setRevealed(false)
      setSessionDone(0)
    },
    []
  )

  // Build initial queue once notas load
  useEffect(() => {
    if (notas.length > 0) buildQueue(modoTodas, states, notas, conceptos, incluirFichas)
  }, [notas]) // eslint-disable-line react-hooks/exhaustive-deps

  // Rebuild when conceptos load after toggle
  useEffect(() => {
    if (conceptos.length > 0 && incluirFichas) buildQueue(modoTodas, states, notas, conceptos, true)
  }, [conceptos]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: Space = reveal, 1/2/3 = grade
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space' && !revealed) { e.preventDefault(); setRevealed(true) }
      if (e.key === '1' && revealed) grade(0)
      if (e.key === '2' && revealed) grade(1)
      if (e.key === '3' && revealed) grade(2)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // intentionally no deps so grade closure stays fresh

  function grade(g: 0 | 1 | 2) {
    const card = queue[idx]
    if (!card) return
    const newSt = advance(states[card.id], g)
    const newStates = { ...states, [card.id]: newSt }
    setStates(newStates)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newStates))
    setSessionDone((d) => d + 1)
    setRevealed(false)
    setIdx((i) => i + 1)
  }

  function toggleModo() {
    const next = !modoTodas
    setModoTodas(next)
    buildQueue(next, states, notas, conceptos, incluirFichas)
  }

  function toggleFichas() {
    const next = !incluirFichas
    setIncluirFichas(next)
    if (next && conceptos.length > 0) {
      buildQueue(modoTodas, states, notas, conceptos, true)
    } else if (!next) {
      buildQueue(modoTodas, states, notas, [], false)
    }
    // If next=true and conceptos.length===0, the useEffect will rebuild when conceptos load
  }

  // ─── States: cargando / error / sin notas ────────────────────────────────

  if (cargando) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', gap: '14px' }}>
      <Loader2 style={{ height: '24px', width: '24px', color: 'rgba(139,92,246,0.6)', animation: 'spin 1s linear infinite' }} />
      <p style={{ fontSize: '13px', color: 'rgba(148,163,184,0.5)', margin: 0 }}>Cargando notas…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', gap: '14px' }}>
      <AlertCircle style={{ height: '28px', width: '28px', color: 'rgba(239,68,68,0.6)' }} />
      <p style={{ fontSize: '13px', color: 'rgba(239,68,68,0.7)', margin: 0 }}>{error}</p>
    </div>
  )

  if (notas.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', gap: '16px', textAlign: 'center' }}>
      <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
        <BookOpen style={{ height: '28px', width: '28px', color: 'rgba(139,92,246,0.5)' }} />
      </div>
      <div>
        <p style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(248,250,252,0.8)', margin: '0 0 6px' }}>Sin notas para repasar</p>
        <p style={{ fontSize: '13px', color: 'rgba(148,163,184,0.45)', margin: 0, lineHeight: 1.5 }}>
          Creá notas permanentes, de referencia o de literatura<br />para que aparezcan aquí.
        </p>
      </div>
    </div>
  )

  const card = queue[idx]
  const finished = idx >= queue.length
  const totalCards = notas.length + (incluirFichas ? conceptos.length : 0)
  const dueNotas = notas.filter((n) => isDue(states[n.id])).length
  const dueConceptos = incluirFichas ? conceptos.filter((c) => isDue(states[c.id])).length : 0
  const dueCount = dueNotas + dueConceptos
  const progress = queue.length > 0 ? Math.min(1, idx / queue.length) * 100 : 0

  // ─── Header ──────────────────────────────────────────────────────────────

  const Header = () => (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: '0 0 4px' }}>Repaso</h1>
        <p style={{ fontSize: '12px', color: 'rgba(148,163,184,0.45)', margin: 0 }}>
          {dueCount > 0
            ? <><span style={{ color: '#a78bfa', fontWeight: 600 }}>{dueCount}</span> pendiente{dueCount !== 1 ? 's' : ''} hoy &middot; {totalCards} carta{totalCards !== 1 ? 's' : ''}</>
            : <>Al día · {totalCards} carta{totalCards !== 1 ? 's' : ''}</>
          }
        </p>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={toggleFichas}
          disabled={cargandoFichas}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
            background: incluirFichas ? 'rgba(52,211,153,0.14)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${incluirFichas ? 'rgba(52,211,153,0.38)' : 'rgba(255,255,255,0.08)'}`,
            color: incluirFichas ? '#34d399' : 'rgba(148,163,184,0.5)',
            cursor: cargandoFichas ? 'wait' : 'pointer', letterSpacing: '0.03em',
          }}
        >
          {cargandoFichas
            ? <Loader2 style={{ height: '11px', width: '11px', animation: 'spin 1s linear infinite' }} />
            : <BookText style={{ height: '11px', width: '11px' }} />
          }
          {incluirFichas ? 'Con fichas' : 'Solo notas'}
        </button>
        <button
          onClick={toggleModo}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
            background: modoTodas ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${modoTodas ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: modoTodas ? '#a78bfa' : 'rgba(148,163,184,0.5)',
            cursor: 'pointer', letterSpacing: '0.03em',
          }}
        >
          <Shuffle style={{ height: '11px', width: '11px' }} />
          {modoTodas ? 'Todas' : 'Pendientes'}
        </button>
        <button
          onClick={() => buildQueue(modoTodas, states, notas, conceptos, incluirFichas)}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 12px', borderRadius: '8px', fontSize: '11px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(148,163,184,0.45)', cursor: 'pointer',
          }}
        >
          <RefreshCcw style={{ height: '11px', width: '11px' }} /> Mezclar
        </button>
      </div>
    </div>
  )

  // ─── Pantalla final ───────────────────────────────────────────────────────

  if (finished) return (
    <div style={{ maxWidth: '600px' }}>
      <Header />
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '56px 32px', borderRadius: '20px', textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(10,7,24,0.95), rgba(8,8,20,0.88))',
        border: '1px solid rgba(139,92,246,0.18)',
        boxShadow: '0 0 40px rgba(109,40,217,0.07)',
      }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%', marginBottom: '18px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.28)',
        }}>
          <Check style={{ height: '24px', width: '24px', color: '#34d399' }} />
        </div>
        <p style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: '0 0 8px' }}>
          {sessionDone > 0 ? `Repasaste ${sessionDone} carta${sessionDone !== 1 ? 's' : ''}` : '¡Todo al día!'}
        </p>
        <p style={{ fontSize: '13px', color: 'rgba(148,163,184,0.5)', margin: '0 0 28px', lineHeight: 1.6 }}>
          {dueCount === 0
            ? 'No hay pendientes para hoy. Volvé mañana.'
            : `Todavía tenés ${dueCount} carta${dueCount !== 1 ? 's' : ''} pendiente${dueCount !== 1 ? 's' : ''}.`}
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => buildQueue(false, states, notas, conceptos, incluirFichas)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
              background: 'linear-gradient(135deg, #7c3aed, #0891b2)',
              color: '#fff', border: 'none', cursor: 'pointer',
              boxShadow: '0 0 20px rgba(124,58,237,0.3)',
            }}
          >
            <RefreshCcw style={{ height: '13px', width: '13px' }} /> Repetir pendientes
          </button>
          <button
            onClick={() => buildQueue(true, states, notas, conceptos, incluirFichas)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '9px 18px', borderRadius: '10px', fontSize: '13px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(148,163,184,0.7)', cursor: 'pointer',
            }}
          >
            <Shuffle style={{ height: '13px', width: '13px' }} /> Ver todas
          </button>
        </div>
      </div>
    </div>
  )

  // ─── Tarjeta activa ───────────────────────────────────────────────────────

  if (!card) return null

  const isConcepto = card.kind === 'concepto'
  const meta = isConcepto ? CONCEPTO_META : TIPO_META[(card as NotaCard).tipo]
  const cardTags = isConcepto
    ? [(card as ConceptoCard).documentoNombre.slice(0, 45)]
    : ((card as NotaCard).etiquetas ?? []).slice(0, 4)

  const frente = isConcepto ? (card as ConceptoCard).concepto : (card as NotaCard).titulo
  const dorso  = isConcepto ? (card as ConceptoCard).definicion : (card as NotaCard).contenido

  return (
    <div style={{ maxWidth: '600px' }}>
      <Header />

      {/* Barra de progreso */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <div style={{ flex: 1, height: '3px', borderRadius: '100px', background: 'rgba(255,255,255,0.06)' }}>
          <div style={{
            height: '100%', borderRadius: '100px',
            background: 'linear-gradient(90deg, #7c3aed, #0891b2)',
            width: `${progress}%`, transition: 'width 0.35s ease',
          }} />
        </div>
        <span style={{ fontSize: '11px', color: 'rgba(148,163,184,0.35)', flexShrink: 0 }}>
          {idx + 1} / {queue.length}
        </span>
      </div>

      {/* Tarjeta */}
      <div style={{
        borderRadius: '20px', overflow: 'hidden',
        background: 'linear-gradient(150deg, rgba(10,6,24,0.97) 0%, rgba(7,7,18,0.94) 100%)',
        border: `1px solid ${revealed ? meta.border : 'rgba(255,255,255,0.08)'}`,
        boxShadow: revealed
          ? `0 0 28px rgba(109,40,217,0.1), inset 0 1px 0 rgba(255,255,255,0.04)`
          : `0 0 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)`,
        marginBottom: '14px',
        minHeight: '300px',
        display: 'flex', flexDirection: 'column',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}>

        {/* Top bar: tipo + tags */}
        <div style={{
          padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
            padding: '3px 9px', borderRadius: '100px',
            background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color,
          }}>
            {meta.label}
          </span>
          {cardTags.map((t) => (
            <span key={t} style={{
              fontSize: '10px', color: 'rgba(148,163,184,0.4)',
              padding: '2px 8px', borderRadius: '100px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            }}>{t}</span>
          ))}
        </div>

        {/* Cuerpo */}
        <div style={{ flex: 1, padding: '28px 28px 24px', display: 'flex', flexDirection: 'column' }}>
          {!revealed ? (
            /* FRENTE */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '22px', textAlign: 'center' }}>
              <p style={{ fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.35, color: '#f1f5f9', margin: 0, maxWidth: '88%' }}>
                {frente}
              </p>
              <button
                onClick={() => setRevealed(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '9px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 500,
                  background: 'rgba(124,58,237,0.14)', border: '1px solid rgba(139,92,246,0.28)',
                  color: '#a78bfa', cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.26)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.14)' }}
              >
                <ChevronRight style={{ height: '14px', width: '14px' }} />
                {isConcepto ? 'Ver definición' : 'Mostrar contenido'}
              </button>
              <span style={{ fontSize: '11px', color: 'rgba(148,163,184,0.25)' }}>Espacio para revelar</span>
            </div>
          ) : (
            /* DORSO */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'rgba(148,163,184,0.45)' }}>
                {frente}
              </p>
              <div style={{
                flex: 1, overflowY: 'auto', maxHeight: '240px',
                borderLeft: `2px solid ${meta.color}`,
                paddingLeft: '14px',
              }}>
                {dorso.split('\n').map((line, i) => (
                  line.trim()
                    ? <p key={i} style={{ margin: '0 0 7px', fontSize: '13.5px', lineHeight: 1.65, color: 'rgba(203,213,225,0.82)' }}>{line}</p>
                    : <div key={i} style={{ height: '6px' }} />
                ))}
              </div>
              {!isConcepto && (card as NotaCard).comentarioPersonal && (
                <div style={{
                  padding: '9px 13px', borderRadius: '8px',
                  background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)',
                  fontSize: '12px', color: 'rgba(251,191,36,0.7)', lineHeight: 1.5,
                }}>
                  {(card as NotaCard).comentarioPersonal}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Botones de calificación — solo cuando está revelada */}
      {revealed ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {([
            { g: 0 as const, label: 'No lo sabía',    sub: 'Repetir mañana',      color: '#f87171', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.22)',   Icon: X     },
            { g: 1 as const, label: 'Con dificultad', sub: 'Pronto de nuevo',      color: '#fbbf24', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)', Icon: Minus },
            { g: 2 as const, label: 'Lo sabía',        sub: 'Siguiente intervalo',  color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.22)', Icon: Check },
          ]).map(({ g, label, sub, color, bg, border, Icon }) => (
            <button
              key={g}
              onClick={() => grade(g)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                padding: '14px 10px', borderRadius: '12px',
                background: bg, border: `1px solid ${border}`,
                cursor: 'pointer', transition: 'filter 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)' }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
            >
              <Icon style={{ height: '15px', width: '15px', color }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color }}>{label}</span>
              <span style={{ fontSize: '10px', color: 'rgba(148,163,184,0.38)' }}>{sub}</span>
            </button>
          ))}
        </div>
      ) : (
        /* Hint de teclado */
        <div style={{ textAlign: 'center', marginTop: '4px' }}>
          <span style={{ fontSize: '10px', color: 'rgba(148,163,184,0.22)', letterSpacing: '0.05em' }}>
            Después de revelar: <kbd style={{ fontFamily: 'inherit' }}>1</kbd> No sabía &nbsp;
            <kbd style={{ fontFamily: 'inherit' }}>2</kbd> Costó &nbsp;
            <kbd style={{ fontFamily: 'inherit' }}>3</kbd> Sabía
          </span>
        </div>
      )}
    </div>
  )
}
