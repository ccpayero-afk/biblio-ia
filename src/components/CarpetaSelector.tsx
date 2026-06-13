'use client'
import { useState, useMemo } from 'react'
import { ChevronDown, Folder } from 'lucide-react'
import type { Carpeta } from '@/types'

// ─── Colores de carpetas ──────────────────────────────────────────────────────

const CARPETA_COLORS: Record<string, string> = {
  purple: '#a78bfa',
  teal:   '#2dd4bf',
  coral:  '#fb7185',
  amber:  '#fbbf24',
  blue:   '#60a5fa',
  green:  '#34d399',
  gray:   '#94a3b8',
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CarpetaNode { c: Carpeta; children: CarpetaNode[]; totalDocs: number }

// ─── Funciones de árbol ───────────────────────────────────────────────────────

function buildTree(carpetas: Carpeta[]): CarpetaNode[] {
  const map = new Map<string, CarpetaNode>()
  for (const c of carpetas) map.set(c.id, { c, children: [], totalDocs: c.documentosIds.length })
  const roots: CarpetaNode[] = []
  for (const node of map.values()) {
    const p = node.c.carpetaPadreId
    if (p && map.has(p)) map.get(p)!.children.push(node)
    else roots.push(node)
  }
  function calcTotal(n: CarpetaNode): number {
    n.totalDocs = n.children.reduce((a, ch) => a + calcTotal(ch), n.c.documentosIds.length)
    return n.totalDocs
  }
  roots.forEach(calcTotal)
  function sort(ns: CarpetaNode[]) {
    ns.sort((a, b) => b.totalDocs - a.totalDocs || a.c.nombre.localeCompare(b.c.nombre, 'es'))
    ns.forEach(n => sort(n.children))
  }
  sort(roots)
  return roots.filter(n => n.totalDocs > 0)
}

function getAllLeafIds(node: CarpetaNode): string[] {
  const own = node.c.documentosIds.length > 0 ? [node.c.id] : []
  return [...own, ...node.children.flatMap(getAllLeafIds)]
}

// ─── Chip de carpeta hoja ─────────────────────────────────────────────────────

function LeafChip({ node, filtro, onToggle }: { node: CarpetaNode; filtro: string[]; onToggle: (id: string) => void }) {
  const color = CARPETA_COLORS[node.c.color] ?? '#94a3b8'
  const sel = filtro.includes(node.c.id)
  return (
    <button onClick={() => onToggle(node.c.id)}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all"
      style={{
        background: sel ? `${color}22` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${sel ? `${color}55` : 'rgba(255,255,255,0.08)'}`,
        color: sel ? color : 'rgba(148,163,184,0.7)',
      }}>
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: color }} />
      <span className="max-w-[130px] truncate">{node.c.nombre}</span>
      <span className="opacity-40">({node.c.documentosIds.length})</span>
    </button>
  )
}

// ─── Nodo de segundo nivel (puede tener hijos) ────────────────────────────────

function ChildNode({ node, filtro, onToggle, onToggleBranch }: { node: CarpetaNode; filtro: string[]; onToggle: (id: string) => void; onToggleBranch: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const color = CARPETA_COLORS[node.c.color] ?? '#94a3b8'
  const kids = node.children.filter(c => c.totalDocs > 0)

  if (kids.length === 0) return <LeafChip node={node} filtro={filtro} onToggle={onToggle} />

  const branchIds = getAllLeafIds(node)
  const allSel = branchIds.length > 0 && branchIds.every(id => filtro.includes(id))
  const someSel = branchIds.some(id => filtro.includes(id))
  return (
    <div className="w-full">
      <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
        style={{ background: someSel ? `${color}0d` : 'transparent' }}>
        <button onClick={() => setOpen(v => !v)}>
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
            style={{ color: `${color}80` }} />
        </button>
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: color }} />
        <span className="flex-1 text-xs truncate" style={{ color: someSel ? color : 'rgba(203,213,225,0.7)' }}>
          {node.c.nombre} <span className="opacity-40">· {node.totalDocs}</span>
        </span>
        <button onClick={() => onToggleBranch(branchIds)}
          className="rounded px-1.5 py-0.5 text-[10px] transition-all flex-shrink-0"
          style={{ background: allSel ? `${color}22` : 'rgba(255,255,255,0.05)', color: allSel ? color : 'rgba(148,163,184,0.45)', border: `1px solid ${allSel ? `${color}44` : 'rgba(255,255,255,0.07)'}` }}>
          {allSel ? 'Quitar' : someSel ? 'Completar' : 'Sel. todo'}
        </button>
      </div>
      {open && (
        <div className="ml-5 mt-1 mb-1 flex flex-wrap gap-1.5">
          {node.c.documentosIds.length > 0 && <LeafChip node={node} filtro={filtro} onToggle={onToggle} />}
          {kids.map(gc => <LeafChip key={gc.c.id} node={gc} filtro={filtro} onToggle={onToggle} />)}
        </div>
      )}
    </div>
  )
}

// ─── Nodo raíz ────────────────────────────────────────────────────────────────

function RootNode({ node, filtro, onToggle, onToggleBranch }: { node: CarpetaNode; filtro: string[]; onToggle: (id: string) => void; onToggleBranch: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const color = CARPETA_COLORS[node.c.color] ?? '#94a3b8'
  const kids = node.children.filter(c => c.totalDocs > 0)
  const branchIds = getAllLeafIds(node)
  const allSel = branchIds.length > 0 && branchIds.every(id => filtro.includes(id))
  const someSel = branchIds.some(id => filtro.includes(id))
  const isLeaf = kids.length === 0

  return (
    <div>
      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
        style={{ background: someSel ? `${color}0d` : 'transparent' }}>
        {!isLeaf && (
          <button onClick={() => setOpen(v => !v)} className="flex-shrink-0">
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
              style={{ color: `${color}70` }} />
          </button>
        )}
        {isLeaf && <span className="w-3 flex-shrink-0" />}
        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />
        <span className="flex-1 min-w-0 text-xs truncate font-medium"
          style={{ color: someSel ? color : 'rgba(203,213,225,0.8)' }}>
          {node.c.nombre}
        </span>
        <span className="text-[10px] flex-shrink-0" style={{ color: 'rgba(148,163,184,0.35)' }}>
          {node.totalDocs}
        </span>
        {isLeaf ? (
          <button onClick={() => onToggle(node.c.id)}
            className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] transition-all"
            style={{ background: filtro.includes(node.c.id) ? `${color}22` : 'rgba(255,255,255,0.05)', color: filtro.includes(node.c.id) ? color : 'rgba(148,163,184,0.5)', border: `1px solid ${filtro.includes(node.c.id) ? `${color}44` : 'rgba(255,255,255,0.07)'}` }}>
            {filtro.includes(node.c.id) ? '✓ Activa' : '+ Agregar'}
          </button>
        ) : (
          <button onClick={() => onToggleBranch(branchIds)}
            className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] transition-all"
            style={{ background: allSel ? `${color}22` : 'rgba(255,255,255,0.05)', color: allSel ? color : someSel ? `${color}cc` : 'rgba(148,163,184,0.5)', border: `1px solid ${allSel ? `${color}44` : 'rgba(255,255,255,0.07)'}` }}>
            {allSel ? '✓ Todo' : someSel ? 'Completar' : 'Sel. todo'}
          </button>
        )}
      </div>
      {open && kids.length > 0 && (
        <div className="ml-7 mt-0.5 mb-1 flex flex-wrap gap-1.5">
          {node.c.documentosIds.length > 0 && (
            <LeafChip node={node} filtro={filtro} onToggle={onToggle} />
          )}
          {kids.map(ch => (
            <ChildNode key={ch.c.id} node={ch} filtro={filtro} onToggle={onToggle} onToggleBranch={onToggleBranch} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Selector de carpetas ─────────────────────────────────────────────────────

export function CarpetaSelector({ carpetas, filtro, onChange }: { carpetas: Carpeta[]; filtro: string[]; onChange: (ids: string[]) => void }) {
  const [abierto, setAbierto] = useState(false)
  const tree = useMemo(() => buildTree(carpetas), [carpetas])

  const toggle = (id: string) =>
    onChange(filtro.includes(id) ? filtro.filter(x => x !== id) : [...filtro, id])

  const toggleBranch = (ids: string[]) => {
    const allIn = ids.length > 0 && ids.every(id => filtro.includes(id))
    onChange(allIn ? filtro.filter(id => !ids.includes(id)) : Array.from(new Set([...filtro, ...ids])))
  }

  if (tree.length === 0) return null

  const selCount = filtro.length
  const docsCount = carpetas.filter(c => filtro.includes(c.id)).reduce((a, c) => a + c.documentosIds.length, 0)

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ border: selCount > 0 ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(255,255,255,0.07)', background: selCount > 0 ? 'rgba(139,92,246,0.05)' : 'rgba(255,255,255,0.03)' }}>
      <button onClick={() => setAbierto(v => !v)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
        <Folder className="h-4 w-4 flex-shrink-0" style={{ color: selCount > 0 ? '#a78bfa' : 'rgba(148,163,184,0.4)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium" style={{ color: selCount > 0 ? '#a78bfa' : 'rgba(148,163,184,0.6)' }}>
            {selCount > 0 ? `${selCount} carpeta${selCount > 1 ? 's' : ''} · ${docsCount} docs` : 'Filtrar por carpetas'}
          </p>
          <p className="text-[10px]" style={{ color: 'rgba(148,163,184,0.35)' }}>
            {selCount > 0 ? 'Solo esas carpetas se analizan' : 'Todas incluidas por defecto'}
          </p>
        </div>
        {selCount > 0 && (
          <button onClick={(e) => { e.stopPropagation(); onChange([]) }}
            className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px]"
            style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
            Limpiar
          </button>
        )}
        <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`}
          style={{ color: 'rgba(148,163,184,0.4)' }} />
      </button>

      {abierto && (
        <div className="max-h-60 overflow-y-auto px-3 pt-1 pb-3 space-y-0.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {tree.map((node) => (
            <RootNode key={node.c.id} node={node} filtro={filtro} onToggle={toggle} onToggleBranch={toggleBranch} />
          ))}
        </div>
      )}
    </div>
  )
}
