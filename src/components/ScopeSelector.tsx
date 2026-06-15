'use client'

import { useEffect, useRef, useState } from 'react'
import { Folder, FolderOpen, Library, ChevronDown, Check } from 'lucide-react'
import { useScope, Scope } from '@/lib/scope-context'

interface CarpetaItem {
  id: string
  nombre: string
  color?: string
  documentosIds: string[]
}

interface Props {
  colapsada?: boolean
}

const COLOR_MAP: Record<string, string> = {
  blue:   '#3b82f6',
  violet: '#7c3aed',
  cyan:   '#06b6d4',
  green:  '#22c55e',
  amber:  '#f59e0b',
  red:    '#ef4444',
  pink:   '#ec4899',
  teal:   '#14b8a6',
}

export default function ScopeSelector({ colapsada }: Props) {
  const { scope, setScope } = useScope()
  const [carpetas, setCarpetas] = useState<CarpetaItem[]>([])
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/carpetas')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCarpetas(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activa = scope.ids.length > 0
  const etiqueta = activa ? scope.nombres[0] ?? 'Filtrado' : 'Toda la biblioteca'
  const colorActivo = activa
    ? COLOR_MAP[carpetas.find((c) => c.id === scope.ids[0])?.color ?? ''] ?? '#a78bfa'
    : 'rgba(148,163,184,0.5)'

  function seleccionar(c: CarpetaItem | null) {
    if (!c) {
      setScope({ ids: [], nombres: [] })
    } else {
      setScope({ ids: [c.id], nombres: [c.nombre] })
    }
    setAbierto(false)
  }

  if (colapsada) {
    return (
      <div className="relative mx-1 mb-1" ref={ref}>
        <button
          onClick={() => setAbierto((v) => !v)}
          title={etiqueta}
          className="flex w-full items-center justify-center rounded-lg py-2.5 transition-all"
          style={activa
            ? { background: 'rgba(124,58,237,0.15)', color: colorActivo }
            : { color: 'rgba(148,163,184,0.45)' }
          }
          onMouseEnter={(e) => { if (!activa) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(203,213,225,0.8)' } }}
          onMouseLeave={(e) => { if (!activa) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(148,163,184,0.45)' } }}
        >
          {activa ? <Folder className="h-4 w-4" /> : <Library className="h-4 w-4" />}
          {activa && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-violet-400" />}
        </button>

        {abierto && (
          <DropdownMenu
            carpetas={carpetas}
            scope={scope}
            onSelect={seleccionar}
            posicion="right"
          />
        )}
      </div>
    )
  }

  return (
    <div className="relative mx-2 mb-2" ref={ref}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-all"
        style={activa
          ? { background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', color: '#fff' }
          : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(148,163,184,0.6)' }
        }
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = activa ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.07)'
          e.currentTarget.style.color = activa ? '#fff' : 'rgba(148,163,184,0.6)'
        }}
      >
        {activa
          ? <Folder className="h-3.5 w-3.5 flex-shrink-0" style={{ color: colorActivo }} />
          : <Library className="h-3.5 w-3.5 flex-shrink-0" />
        }
        <span className="flex-1 truncate">{etiqueta}</span>
        <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <DropdownMenu
          carpetas={carpetas}
          scope={scope}
          onSelect={seleccionar}
          posicion="bottom"
        />
      )}
    </div>
  )
}

function DropdownMenu({
  carpetas,
  scope,
  onSelect,
  posicion,
}: {
  carpetas: CarpetaItem[]
  scope: Scope
  onSelect: (c: CarpetaItem | null) => void
  posicion: 'bottom' | 'right'
}) {
  const esAll = scope.ids.length === 0

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 100,
    background: 'rgba(10,10,22,0.98)',
    border: '1px solid rgba(139,92,246,0.25)',
    borderRadius: 10,
    boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
    minWidth: 200,
    maxHeight: 260,
    overflowY: 'auto',
    padding: '4px 0',
    ...(posicion === 'bottom'
      ? { top: 'calc(100% + 4px)', left: 0, right: 0 }
      : { top: 0, left: 'calc(100% + 6px)' }
    ),
  }

  return (
    <div style={baseStyle}>
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(139,92,246,0.5)' }}>
        Alcance de búsqueda
      </p>

      <DropdownItem
        icono={<Library className="h-3.5 w-3.5" />}
        label="Toda la biblioteca"
        activo={esAll}
        color="rgba(148,163,184,0.6)"
        onClick={() => onSelect(null)}
      />

      {carpetas.length > 0 && (
        <div className="mx-3 my-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      )}

      {carpetas.map((c) => (
        <DropdownItem
          key={c.id}
          icono={<Folder className="h-3.5 w-3.5" />}
          label={c.nombre}
          sublabel={`${c.documentosIds.length} doc${c.documentosIds.length !== 1 ? 's' : ''}`}
          activo={scope.ids.includes(c.id)}
          color={COLOR_MAP[c.color ?? ''] ?? '#a78bfa'}
          onClick={() => onSelect(c)}
        />
      ))}

      {carpetas.length === 0 && (
        <p className="px-3 py-2 text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>
          Sin carpetas creadas
        </p>
      )}
    </div>
  )
}

function DropdownItem({
  icono, label, sublabel, activo, color, onClick,
}: {
  icono: React.ReactNode
  label: string
  sublabel?: string
  activo: boolean
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors"
      style={{ color: activo ? '#fff' : 'rgba(148,163,184,0.7)', background: activo ? 'rgba(124,58,237,0.12)' : '' }}
      onMouseEnter={(e) => { if (!activo) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fff' } }}
      onMouseLeave={(e) => { if (!activo) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(148,163,184,0.7)' } }}
    >
      <span style={{ color }}>{icono}</span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {sublabel && <span className="flex-shrink-0 text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>{sublabel}</span>}
      {activo && <Check className="h-3 w-3 flex-shrink-0" style={{ color: '#a78bfa' }} />}
    </button>
  )
}
