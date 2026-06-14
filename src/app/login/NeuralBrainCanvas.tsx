'use client'

import { useEffect, useRef } from 'react'
import styles from './login.module.css'

const N_NODES = 92
const MAX_PARTICLES = 42
const SPAWN_CHANCE = 0.052

interface Node {
  x: number
  y: number
  r: number
  phase: number
  hz: number
  glow: number
}

interface Particle {
  fi: number
  ti: number
  t: number
  spd: number
}

interface Edge {
  a: number
  b: number
  alpha: number
  aim: number
  rate: number
}

function inBrain(px: number, py: number, cx: number, cy: number, s: number): boolean {
  // Left hemisphere
  const lx = (px - (cx - s * 0.26)) / (s * 0.46)
  const ly = (py - cy) / (s * 0.56)
  const isLeft = lx * lx + ly * ly < 1

  // Right hemisphere (mirror)
  const rx = (px - (cx + s * 0.26)) / (s * 0.46)
  const ry = (py - cy) / (s * 0.56)
  const isRight = rx * rx + ry * ry < 1

  if (!isLeft && !isRight) return false

  // Interhemispheric fissure — narrow vertical exclusion at top center
  if (py < cy - s * 0.15) {
    const fx = (px - cx) / (s * 0.065)
    const fy = (py - (cy - s * 0.56)) / (s * 0.44)
    if (fx * fx + fy * fy < 1) return false
  }

  return true
}

function makeNodes(w: number, h: number): Node[] {
  const cx = w / 2
  const cy = h * 0.44
  const s = Math.min(w * 0.44, h * 0.40, 340)
  const out: Node[] = []
  let tries = 0
  while (out.length < N_NODES && tries++ < 5000) {
    const px = cx + (Math.random() - 0.5) * s * 2.1
    const py = cy + (Math.random() - 0.5) * s * 1.5
    if (inBrain(px, py, cx, cy, s)) {
      out.push({
        x: px, y: py,
        r: 2.0 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2,
        hz: 0.22 + Math.random() * 0.46,
        glow: 0,
      })
    }
  }
  return out
}

function makeEdges(nodes: Node[], w: number, h: number): Edge[] {
  const s = Math.min(w * 0.44, h * 0.40, 340)
  const maxD2 = (s * 0.30) ** 2
  const edges: Edge[] = []
  const deg = new Int32Array(nodes.length)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (deg[i] >= 5 || deg[j] >= 5) continue
      const dx = nodes[i].x - nodes[j].x
      const dy = nodes[i].y - nodes[j].y
      if (dx * dx + dy * dy < maxD2) {
        edges.push({
          a: i, b: j,
          alpha: Math.random() * 0.12,
          aim: Math.random() < 0.55 ? 0.18 + Math.random() * 0.18 : 0.03,
          rate: 0.0022 + Math.random() * 0.006,
        })
        deg[i]++
        deg[j]++
      }
    }
  }
  return edges
}

export default function NeuralBrainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const context = el.getContext('2d')
    if (!context) return

    // Explicit non-null aliases — safe because we checked above
    const cv = el as HTMLCanvasElement
    const ctx = context as CanvasRenderingContext2D

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf: number
    let nodes: Node[] = []
    let edges: Edge[] = []
    const particles: Particle[] = []

    function init() {
      cv.width = window.innerWidth
      cv.height = window.innerHeight
      nodes = makeNodes(cv.width, cv.height)
      edges = makeEdges(nodes, cv.width, cv.height)
      particles.length = 0
    }

    function frame() {
      const W = cv.width
      const H = cv.height
      ctx.clearRect(0, 0, W, H)
      const now = performance.now() * 0.001

      // ── Edges ──────────────────────────────────────────────────────────────
      ctx.lineWidth = 0.75
      for (const e of edges) {
        if (Math.random() < 0.0016) {
          e.aim = Math.random() < 0.55
            ? 0.15 + Math.random() * 0.22
            : 0.02 + Math.random() * 0.04
        }
        e.alpha += (e.aim - e.alpha) * e.rate

        const na = nodes[e.a]
        const nb = nodes[e.b]
        ctx.beginPath()
        ctx.moveTo(na.x, na.y)
        ctx.lineTo(nb.x, nb.y)
        ctx.strokeStyle = `rgba(109,40,217,${e.alpha.toFixed(3)})`
        ctx.stroke()
      }

      // ── Particles ──────────────────────────────────────────────────────────
      if (!reduced) {
        if (particles.length < MAX_PARTICLES && Math.random() < SPAWN_CHANCE && edges.length > 0) {
          const e = edges[Math.floor(Math.random() * edges.length)]
          const fwd = Math.random() < 0.5
          particles.push({
            fi: fwd ? e.a : e.b,
            ti: fwd ? e.b : e.a,
            t: 0,
            spd: 0.005 + Math.random() * 0.011,
          })
        }

        ctx.save()
        ctx.shadowBlur = 7
        ctx.shadowColor = '#9333ea'
        ctx.fillStyle = '#c4b5fd'

        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]
          p.t += p.spd
          if (p.t >= 1) {
            nodes[p.ti].glow = 1
            particles.splice(i, 1)
            continue
          }
          const fn = nodes[p.fi]
          const tn = nodes[p.ti]
          const px = fn.x + (tn.x - fn.x) * p.t
          const py = fn.y + (tn.y - fn.y) * p.t
          ctx.beginPath()
          ctx.arc(px, py, 1.8, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      // ── Nodes ──────────────────────────────────────────────────────────────
      for (const n of nodes) {
        const breathe = reduced ? 1 : 1 + 0.12 * Math.sin(now * n.hz * Math.PI * 2 + n.phase)
        const r = n.r * breathe
        const active = n.glow > 0.04

        ctx.save()
        ctx.shadowBlur = active ? 18 + n.glow * 12 : 5
        ctx.shadowColor = active ? '#a855f7' : '#5b21b6'

        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fillStyle = active
          ? `rgba(147,51,234,${(0.75 + n.glow * 0.25).toFixed(2)})`
          : 'rgba(76,29,149,0.88)'
        ctx.fill()

        ctx.beginPath()
        ctx.arc(n.x, n.y, r * 0.38, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(196,181,253,${active ? (0.7 + n.glow * 0.3).toFixed(2) : '0.50'})`
        ctx.fill()

        ctx.restore()

        if (active && !reduced) n.glow *= 0.935
      }

      raf = requestAnimationFrame(frame)
    }

    init()
    raf = requestAnimationFrame(frame)
    window.addEventListener('resize', init)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', init)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      aria-hidden="true"
    />
  )
}
