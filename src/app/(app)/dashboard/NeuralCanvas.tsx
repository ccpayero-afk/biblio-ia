'use client'

import { useEffect, useRef } from 'react'

interface Node {
  x0: number; y0: number; z0: number
  phase: number; speed: number
  cr: number; cg: number; cb: number
}

const PALETTE: [number, number, number][] = [
  [124, 58, 237],
  [139, 92, 246],
  [109, 40, 217],
  [99, 102, 241],
  [79, 70, 229],
  [59, 130, 246],
  [37, 99, 235],
  [6, 182, 212],
  [34, 211, 238],
]

// Fibonacci sphere → brain-shaped ellipsoid with two hemispheres
function genBrain(count: number): Node[] {
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: count }, (_, i) => {
    const [cr, cg, cb] = PALETTE[Math.floor(Math.random() * PALETTE.length)]

    // Uniform point on unit sphere (Fibonacci)
    const yS = 1 - (i / (count - 1)) * 2
    const rS = Math.sqrt(Math.max(0, 1 - yS * yS))
    const theta = golden * i
    const sx = rS * Math.cos(theta)
    const sz = rS * Math.sin(theta)

    // Scale to brain ellipsoid
    let x = sx * 0.82
    let y = yS * 0.72
    if (y < 0) y *= 0.78        // flatten below (skull base)
    const z = sz * 0.50          // brain is shallower front-to-back

    // Medial fissure: push hemispheres apart
    const gap = 0.065
    x = x >= 0 ? x + gap : x - gap

    // Micro-jitter for gyri/sulci texture
    x += (Math.random() - 0.5) * 0.04
    y += (Math.random() - 0.5) * 0.04
    // z jitter omitted so depth stays clean

    return {
      x0: x, y0: y, z0: z,
      phase: Math.random() * Math.PI * 2,
      speed: 0.006 + Math.random() * 0.012,
      cr, cg, cb,
    }
  })
}

export default function NeuralCanvas({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctxOrNull = canvas.getContext('2d')
    if (!ctxOrNull) return
    const ctx = ctxOrNull

    let animId: number
    let nodes: Node[] = []
    let w = 0
    let h = 0

    function resize() {
      const dpr = window.devicePixelRatio || 1
      w = canvas!.offsetWidth
      h = canvas!.offsetHeight
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.max(60, Math.min(Math.floor((w * h) / 2200), 100))
      nodes = genBrain(count)
    }

    type PNode = Node & { sx: number; sy: number; rz: number; depth: number; pulse: number }

    function draw(t: number) {
      ctx.clearRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2
      const scale = Math.min(w * 0.50, h * 0.82)
      const angle = t * 0.00022
      const cosA = Math.cos(angle)
      const sinA = Math.sin(angle)
      const fov = 3.0

      // Project
      const proj: PNode[] = nodes.map((n) => {
        const rx = n.x0 * cosA + n.z0 * sinA
        const ry = n.y0
        const rz = -n.x0 * sinA + n.z0 * cosA
        const pf = fov / (fov + rz)
        const sx = cx + rx * pf * scale
        const sy = cy - ry * pf * scale   // canvas y inverted
        const depth = (rz + 1.2) / 2.4   // 0 = back, 1 = front
        const pulse = Math.sin(t * n.speed * 60 + n.phase) * 0.5 + 0.5
        return { ...n, sx, sy, rz, depth, pulse }
      })

      // Back-to-front
      proj.sort((a, b) => a.rz - b.rz)

      // Connections (3D distance threshold)
      const maxDist = 0.44
      for (let i = 0; i < proj.length; i++) {
        for (let j = i + 1; j < proj.length; j++) {
          const ni = proj[i]; const nj = proj[j]
          const dx = ni.x0 - nj.x0
          const dy = ni.y0 - nj.y0
          const dz = ni.z0 - nj.z0
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (dist > maxDist) continue

          const prox = 1 - dist / maxDist
          const avgD = (ni.depth + nj.depth) * 0.5
          const pf = (ni.pulse + nj.pulse) * 0.5
          const alpha = prox * 0.52 * Math.max(0.28, avgD) * (0.38 + pf * 0.62)
          if (alpha < 0.012) continue

          const grad = ctx.createLinearGradient(ni.sx, ni.sy, nj.sx, nj.sy)
          grad.addColorStop(0, `rgb(${ni.cr},${ni.cg},${ni.cb})`)
          grad.addColorStop(1, `rgb(${nj.cr},${nj.cg},${nj.cb})`)
          ctx.globalAlpha = alpha
          ctx.beginPath()
          ctx.moveTo(ni.sx, ni.sy)
          ctx.lineTo(nj.sx, nj.sy)
          ctx.strokeStyle = grad
          ctx.lineWidth = 0.35 + prox * 0.65
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1

      // Nodes
      for (const n of proj) {
        const bright = 0.35 + n.depth * 0.65
        const nodeR = 1.5 * (0.7 + n.pulse * 0.6) * (0.55 + n.depth * 0.52)
        const glowR = nodeR * (2.5 + n.pulse * 2.0)

        const grd = ctx.createRadialGradient(n.sx, n.sy, 0, n.sx, n.sy, Math.max(glowR, 0.1))
        grd.addColorStop(0, `rgba(${n.cr},${n.cg},${n.cb},${(0.55 * n.pulse * bright).toFixed(2)})`)
        grd.addColorStop(0.4, `rgba(${n.cr},${n.cg},${n.cb},${(0.14 * n.pulse * bright).toFixed(2)})`)
        grd.addColorStop(1, `rgba(${n.cr},${n.cg},${n.cb},0)`)
        ctx.beginPath()
        ctx.arc(n.sx, n.sy, Math.max(glowR, 0.1), 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()

        ctx.beginPath()
        ctx.arc(n.sx, n.sy, Math.max(nodeR, 0.1), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${n.cr},${n.cg},${n.cb},${(bright * (0.7 + 0.3 * n.pulse)).toFixed(2)})`
        ctx.fill()
      }
    }

    function animate(t: number) {
      draw(t)
      animId = requestAnimationFrame(animate)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    animId = requestAnimationFrame(animate)

    return () => { cancelAnimationFrame(animId); ro.disconnect() }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
    />
  )
}
