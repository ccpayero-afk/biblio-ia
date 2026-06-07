'use client'

import { useEffect, useState } from 'react'
import { FileText, Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Documento, FichaLectura } from '@/types'

interface DocConFicha {
  doc: Documento
  ficha: FichaLectura | null
  cargando: boolean
}

export default function FichasClient() {
  const [items, setItems] = useState<DocConFicha[]>([])
  const [cargando, setCargando] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/drive/pdfs')
      .then((r) => r.json())
      .then(async (docs: Documento[]) => {
        const indexados = docs.filter((d) => d.estado === 'indexado')
        const lista: DocConFicha[] = indexados.map((doc) => ({ doc, ficha: null, cargando: false }))
        setItems(lista)
        setCargando(false)

        // Load fichas in parallel
        for (const item of lista) {
          fetch(`/api/fichas/${item.doc.id}`)
            .then((r) => r.json())
            .then((ficha: FichaLectura | null) => {
              setItems((prev) =>
                prev.map((i) => (i.doc.id === item.doc.id ? { ...i, ficha } : i))
              )
            })
            .catch(() => {/* skip */})
        }
      })
      .catch(() => setCargando(false))
  }, [])

  async function generarFicha(item: DocConFicha) {
    setItems((prev) =>
      prev.map((i) => (i.doc.id === item.doc.id ? { ...i, cargando: true } : i))
    )
    try {
      const res = await fetch(`/api/fichas/${item.doc.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentoNombre: item.doc.nombre,
          autor: item.doc.autor,
          año: item.doc.año,
        }),
      })
      const ficha = await res.json()
      setItems((prev) =>
        prev.map((i) => (i.doc.id === item.doc.id ? { ...i, ficha, cargando: false } : i))
      )
      setExpandido(item.doc.id)
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.doc.id === item.doc.id ? { ...i, cargando: false } : i))
      )
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-600" />
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText className="h-12 w-12 text-neutral-700" />
        <h2 className="mt-4 text-lg font-semibold text-white">Sin documentos indexados</h2>
        <p className="mt-2 text-sm text-neutral-500">Indexá documentos en la Biblioteca para generar fichas.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Fichas de lectura</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Análisis estructurado generado por IA a partir de los documentos indexados.
        </p>
      </div>

      {items.map((item) => (
        <div key={item.doc.id} className="rounded-xl border border-neutral-800 bg-neutral-900">
          <div className="flex items-center gap-3 px-4 py-3">
            <FileText className="h-4 w-4 flex-shrink-0 text-neutral-500" />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {item.doc.nombre.replace(/\.pdf$/i, '')}
              </p>
              <p className="text-xs text-neutral-500">
                {item.doc.autor || 'Sin autor'} · {item.doc.año || 's.f.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {item.ficha ? (
                <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-xs text-green-400">Ficha generada</span>
              ) : (
                <button
                  onClick={() => generarFicha(item)}
                  disabled={item.cargando}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600 disabled:opacity-50"
                >
                  {item.cargando ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {item.cargando ? 'Generando…' : 'Generar ficha'}
                </button>
              )}
              {item.ficha && (
                <button
                  onClick={() => setExpandido(expandido === item.doc.id ? null : item.doc.id)}
                  className="text-neutral-500 hover:text-neutral-300"
                >
                  {expandido === item.doc.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>

          {expandido === item.doc.id && item.ficha && (
            <div className="border-t border-neutral-800 px-4 py-4 space-y-4 text-sm">
              <Section titulo="Tesis central" texto={item.ficha.tesisCentral} />
              <Section titulo="Argumento principal" texto={item.ficha.argumentoPrincipal} />
              <Section titulo="Posición en el debate" texto={item.ficha.posicionDebate} />

              {item.ficha.conceptosClave?.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Conceptos clave</h3>
                  <div className="space-y-2">
                    {item.ficha.conceptosClave.map((ck, i) => (
                      <div key={i} className="rounded-lg border border-neutral-700 px-3 py-2">
                        <span className="font-medium text-blue-400">{ck.concepto}:</span>
                        <span className="ml-2 text-neutral-300">{ck.definicion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {item.ficha.citasDestacadas?.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Citas destacadas</h3>
                  <div className="space-y-2">
                    {item.ficha.citasDestacadas.map((c, i) => (
                      <blockquote key={i} className="border-l-2 border-neutral-600 pl-3 text-neutral-300 italic">
                        "{c.texto}" <span className="not-italic text-neutral-500">(p.{c.pagina})</span>
                      </blockquote>
                    ))}
                  </div>
                </div>
              )}

              <Section titulo="Limitaciones" texto={item.ficha.limitaciones} />
              <Section titulo="Relevancia" texto={item.ficha.relevancia} />

              <button
                onClick={() => generarFicha(item)}
                disabled={item.cargando}
                className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-400"
              >
                <Sparkles className="h-3 w-3" /> Regenerar ficha
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Section({ titulo, texto }: { titulo: string; texto: string }) {
  if (!texto) return null
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">{titulo}</h3>
      <p className="text-neutral-300 leading-relaxed">{texto}</p>
    </div>
  )
}
