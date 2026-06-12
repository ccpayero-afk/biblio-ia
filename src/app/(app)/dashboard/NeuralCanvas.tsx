'use client'

import { useEffect, useRef } from 'react'

interface Node {
  x: number; y: number; vx: number; vy: number
  r: number; phase: number; speed: number
  cr: number; cg: number; cb: number
}

const PALETTE: [number, number, number][] = [
  [124, 58, 237],
  [139, 92, 246],
  [99, 102, 241],
  [59, 130, 246],
  [6, 182, 212],
  [34, 211, 238],
  [109, 40, 217],
]

function mkNode(w: number, h: number): Node {
  const [cr, cg, cb] = PALETTE[Math.floor(Math.random() * PALETTE.length)]
  return {
    x: Math.random() * w, y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    r: 1.8 + Math.random() * 2.5,
    phase: Math.random() * Math.PI * 2,
    speed: 0.008 + Math.random() * 0.015,
    cr, cg, cb,
  }
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
      const count = Math.max(18, Math.min(Math.floor((w * h) / 7000), 45))
      nodes = Array.from({ length: count }, () => mkNode(w, h))
    }

    function draw(t: number) {
      ctx.clearRect(0, 0, w, h)
      const maxDist = Math.min(w, h) * 0.45

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > maxDist) continue

          const base = (1 - dist / maxDist) * 0.45
          const pulse = Math.sin(t * 0.001 + nodes[i].phase) * 0.5 + 0.5

          const grad = ctx.createLinearGradient(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y)
          grad.addColorStop(0, `rgb(${nodes[i].cr},${nodes[i].cg},${nodes[i].cb})`)
          grad.addColorStop(1, `rgb(${nodes[j].cr},${nodes[j].cg},${nodes[j].cb})`)
          ctx.globalAlpha = base * pulse * 0.65
          ctx.beginPath()
          ctx.moveTo(nodes[i].x, nodes[i].y)
          ctx.lineTo(nodes[j].x, nodes[j].y)
          ctx.strokeStyle = grad
          ctx.lineWidth = 0.4 + pulse * 0.5
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1

      for (const n of nodes) {
        const pulse = Math.sin(t * n.speed * 80 + n.phase) * 0.5 + 0.5
        const glowR = n.r * (3.5 + pulse * 2.5)

        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR)
        grd.addColorStop(0, `rgba(${n.cr},${n.cg},${n.cb},${(0.55 * pulse).toFixed(2)})`)
        grd.addColorStop(0.5, `rgba(${n.cr},${n.cg},${n.cb},${(0.15 * pulse).toFixed(2)})`)
        grd.addColorStop(1, `rgba(${n.cr},${n.cg},${n.cb},0)`)
        ctx.beginPath()
        ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()

        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r * (0.85 + pulse * 0.3), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${n.cr},${n.cg},${n.cb},${(0.85 + pulse * 0.15).toFixed(2)})`
        ctx.fill()

        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > w) { n.vx *= -1; n.x = Math.max(0, Math.min(w, n.x)) }
        if (n.y < 0 || n.y > h) { n.vy *= -1; n.y = Math.max(0, Math.min(h, n.y)) }
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

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
    />
  )
}
