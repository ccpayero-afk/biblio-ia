'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff, CheckCircle, XCircle, ExternalLink, Download, RefreshCw, FileText, Trash2, Plus, Key } from 'lucide-react'
import type { ZoteroItem, ZoteroImportResult } from '@/lib/zotero'

interface PropuestaRenombrado {
  id: string
  nombreActual: string
  nombrePropuesto: string
  autor: string
  año: string
  titulo: string | null
}

interface Props {
  apiKeyConfigurada: boolean
  emailsAutorizados: string[]
  userEmail: string
}

export default function ConfiguracionClient({ apiKeyConfigurada: inicial, emailsAutorizados, userEmail }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<'ok' | 'error' | null>(null)
  const [mensajeError, setMensajeError] = useState('')
  const [configurada, setConfigurada] = useState(inicial)
  const [keysMasked, setKeysMasked] = useState<string[]>([])
  const [cargandoKeys, setCargandoKeys] = useState(true)
  const [eliminandoIdx, setEliminandoIdx] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/config/apikey')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.masked)) setKeysMasked(d.masked)
        if (typeof d.configurada === 'boolean') setConfigurada(d.configurada)
      })
      .catch(() => { /* ignore */ })
      .finally(() => setCargandoKeys(false))
  }, [])

  async function eliminarKey(index: number) {
    setEliminandoIdx(index)
    try {
      const res = await fetch('/api/config/apikey', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index }),
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data.masked)) {
        setKeysMasked(data.masked)
        setConfigurada(data.count > 0)
      }
    } catch { /* ignore */ }
    setEliminandoIdx(null)
  }

  // ── Zotero ──────────────────────────────────────────────────────────────────
  const [zoteroUserId, setZoteroUserId] = useState('')
  const [zoteroApiKey, setZoteroApiKey] = useState('')
  const [zoteroMostrar, setZoteroMostrar] = useState(false)
  const [zoteroGuardando, setZoteroGuardando] = useState(false)
  const [zoteroResultado, setZoteroResultado] = useState<'ok' | 'error' | null>(null)
  const [zoteroError, setZoteroError] = useState('')
  const [zoteroConfigurado, setZoteroConfigurado] = useState(false)
  const [zoteroUserIdActual, setZoteroUserIdActual] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [importResult, setImportResult] = useState<ZoteroImportResult | null>(null)
  const [importados, setImportados] = useState<ZoteroItem[]>([])
  const [mostrarImportados, setMostrarImportados] = useState(false)

  // ── Renombrar archivos ───────────────────────────────────────────────────────
  const [propuestasRenombrado, setPropuestasRenombrado] = useState<PropuestaRenombrado[]>([])
  const [cargandoPropuestas, setCargandoPropuestas] = useState(false)
  const [seleccionadosRenombrar, setSeleccionadosRenombrar] = useState<Set<string>>(new Set())
  const [aplicandoRenombrado, setAplicandoRenombrado] = useState(false)
  const [resultadoRenombrado, setResultadoRenombrado] = useState<{ ok: number; errores: number } | null>(null)

  async function cargarPropuestas() {
    setCargandoPropuestas(true); setPropuestasRenombrado([]); setResultadoRenombrado(null)
    try {
      const res = await fetch('/api/drive/renombrar')
      const data = await res.json()
      if (Array.isArray(data)) {
        setPropuestasRenombrado(data)
        setSeleccionadosRenombrar(new Set(data.map((p: PropuestaRenombrado) => p.id)))
      }
    } catch { /* ignore */ }
    setCargandoPropuestas(false)
  }

  async function aplicarRenombrado() {
    if (seleccionadosRenombrar.size === 0) return
    setAplicandoRenombrado(true)
    try {
      const res = await fetch('/api/drive/renombrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(seleccionadosRenombrar) }),
      })
      const data = await res.json()
      setResultadoRenombrado({ ok: data.ok ?? 0, errores: data.errores ?? 0 })
      await cargarPropuestas()
    } catch { /* ignore */ }
    setAplicandoRenombrado(false)
  }

  useEffect(() => {
    fetch('/api/config/zotero')
      .then((r) => r.json())
      .then((d) => {
        setZoteroConfigurado(d.configurado ?? false)
        setZoteroUserIdActual(d.userId ?? null)
      })
      .catch(() => { /* ignore */ })
    fetch('/api/zotero/importar')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setImportados(d) })
      .catch(() => { /* ignore */ })
  }, [])

  async function guardarZotero() {
    if (!zoteroUserId.trim() || !zoteroApiKey.trim()) return
    setZoteroGuardando(true)
    setZoteroResultado(null)
    try {
      const res = await fetch('/api/config/zotero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: zoteroUserId.trim(), apiKey: zoteroApiKey.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setZoteroResultado('ok')
        setZoteroConfigurado(true)
        setZoteroUserIdActual(zoteroUserId.trim())
        setZoteroUserId('')
        setZoteroApiKey('')
      } else {
        setZoteroResultado('error')
        setZoteroError(data.error ?? 'Error al guardar')
      }
    } catch {
      setZoteroResultado('error')
      setZoteroError('Error de conexión')
    } finally {
      setZoteroGuardando(false)
    }
  }

  async function importarDesdeZotero() {
    setImportando(true)
    setImportResult(null)
    try {
      const res = await fetch('/api/zotero/importar', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setImportResult(data)
        if (Array.isArray(data.items) && data.items.length > 0) {
          setImportados((prev) => [...data.items, ...prev])
        }
      } else {
        setImportResult({ importados: 0, omitidos: 0, total: 0, items: [] })
      }
    } catch { /* silencioso */ }
    setImportando(false)
  }

  async function guardar() {
    if (!apiKey.trim()) return
    setGuardando(true)
    setResultado(null)

    try {
      const res = await fetch('/api/config/apikey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      const data = await res.json()

      if (res.ok) {
        setResultado('ok')
        setConfigurada(true)
        setApiKey('')
        if (Array.isArray(data.masked)) setKeysMasked(data.masked)
      } else {
        setResultado('error')
        setMensajeError(data.error ?? 'Error al guardar')
      }
    } catch {
      setResultado('error')
      setMensajeError('Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración</h1>
        <p className="mt-1 text-sm" style={{ color: 'rgba(148,163,184,0.55)' }}>Configurá tu acceso a la IA y revisá los usuarios autorizados.</p>
      </div>

      {/* API Keys de Gemini — hasta 5 con rotación automática */}
      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4" style={{ color: 'rgba(139,92,246,0.7)' }} />
            <h2 className="text-sm font-medium text-white">API keys de Gemini</h2>
          </div>
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs"
            style={configurada
              ? { background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(52,211,153,0.9)' }
              : { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'rgba(245,158,11,0.9)' }}
          >
            {configurada
              ? <><CheckCircle className="h-3.5 w-3.5" /> {keysMasked.length}/5 activa{keysMasked.length !== 1 ? 's' : ''}</>
              : <><XCircle className="h-3.5 w-3.5" /> No configurada</>}
          </span>
        </div>

        <p className="text-xs mb-4" style={{ color: 'rgba(148,163,184,0.5)' }}>
          Agregá hasta 5 keys. La IA rota automáticamente cuando una alcanza el límite de uso.
          Keys guardadas cifradas en tu Drive.{' '}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 hover:underline" style={{ color: 'rgba(34,211,238,0.8)' }}>
            Google AI Studio <ExternalLink className="h-3 w-3" />
          </a>
        </p>

        {/* Keys configuradas */}
        {!cargandoKeys && keysMasked.length > 0 && (
          <div className="space-y-2 mb-4">
            {keysMasked.map((masked, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: 'rgba(139,92,246,0.15)', color: 'rgba(167,139,250,0.8)' }}>
                  {i + 1}
                </div>
                <span className="flex-1 text-sm font-mono" style={{ color: 'rgba(203,213,225,0.7)' }}>{masked}</span>
                {i === 0 && (
                  <span className="text-xs rounded-full px-2 py-0.5 flex-shrink-0"
                    style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', color: 'rgba(34,211,238,0.7)' }}>
                    activa
                  </span>
                )}
                <button onClick={() => eliminarKey(i)} disabled={eliminandoIdx === i}
                  className="flex-shrink-0 p-1 rounded-lg transition-colors disabled:opacity-40"
                  style={{ color: 'rgba(239,68,68,0.4)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(239,68,68,0.4)' }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Agregar nueva key */}
        {keysMasked.length < 5 && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={mostrar ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setResultado(null) }}
                  placeholder="AIza..."
                  className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-neutral-600 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.1)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = '' }}
                  onKeyDown={(e) => e.key === 'Enter' && guardar()}
                />
                <button onClick={() => setMostrar(!mostrar)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'rgba(148,163,184,0.4)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}>
                  {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button onClick={guardar} disabled={guardando || !apiKey.trim()}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 14px rgba(124,58,237,0.3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 22px rgba(124,58,237,0.5)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 14px rgba(124,58,237,0.3)' }}>
                <Plus className="h-3.5 w-3.5" />
                {guardando ? 'Verificando...' : 'Agregar'}
              </button>
            </div>
            {resultado === 'ok' && (
              <p className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(52,211,153,0.9)' }}>
                <CheckCircle className="h-3.5 w-3.5" /> API key válida y agregada
              </p>
            )}
            {resultado === 'error' && (
              <p className="flex items-center gap-1.5 text-xs text-red-400">
                <XCircle className="h-3.5 w-3.5" /> {mensajeError}
              </p>
            )}
          </div>
        )}
        {keysMasked.length >= 5 && (
          <p className="text-xs mt-2" style={{ color: 'rgba(148,163,184,0.4)' }}>
            Límite de 5 keys alcanzado. Eliminá una para agregar otra.
          </p>
        )}
      </div>

      {/* Integración con Zotero */}
      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Integración con Zotero</h2>
          {zoteroConfigurado ? (
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(52,211,153,0.9)' }}>
              <CheckCircle className="h-3.5 w-3.5" /> Conectado {zoteroUserIdActual ? `(ID: ${zoteroUserIdActual})` : ''}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'rgba(245,158,11,0.9)' }}>
              <XCircle className="h-3.5 w-3.5" /> No conectado
            </span>
          )}
        </div>

        <p className="mt-2 text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
          Sincronizá tu Biblioteca con Zotero para citar desde Word con el plugin de Zotero.
          Creá una API key en{' '}
          <a href="https://www.zotero.org/settings/keys/new" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:underline" style={{ color: 'rgba(34,211,238,0.8)' }}>
            zotero.org/settings/keys <ExternalLink className="h-3 w-3" />
          </a>
          {' '}con permisos de escritura en tu librería. Tu User ID está en{' '}
          <a href="https://www.zotero.org/settings/keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:underline" style={{ color: 'rgba(34,211,238,0.8)' }}>
            zotero.org/settings <ExternalLink className="h-3 w-3" />
          </a>.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Zotero User ID</label>
            <input
              type="text"
              value={zoteroUserId}
              onChange={(e) => { setZoteroUserId(e.target.value); setZoteroResultado(null) }}
              placeholder={zoteroUserIdActual ?? '1234567'}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
            />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={zoteroMostrar ? 'text' : 'password'}
                value={zoteroApiKey}
                onChange={(e) => { setZoteroApiKey(e.target.value); setZoteroResultado(null) }}
                placeholder={zoteroConfigurado ? '••••••••••••••••••' : 'API key de Zotero'}
                className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-neutral-600 focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                onKeyDown={(e) => e.key === 'Enter' && guardarZotero()}
              />
              <button
                onClick={() => setZoteroMostrar(!zoteroMostrar)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'rgba(148,163,184,0.4)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}
              >
                {zoteroMostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={guardarZotero}
              disabled={zoteroGuardando || !zoteroUserId.trim() || !zoteroApiKey.trim()}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 14px rgba(124,58,237,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 22px rgba(124,58,237,0.5)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 14px rgba(124,58,237,0.3)' }}
            >
              {zoteroGuardando ? 'Verificando...' : 'Verificar y guardar'}
            </button>
          </div>
          {zoteroResultado === 'ok' && (
            <p className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(52,211,153,0.9)' }}>
              <CheckCircle className="h-3.5 w-3.5" /> Conectado correctamente con Zotero
            </p>
          )}
          {zoteroResultado === 'error' && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <XCircle className="h-3.5 w-3.5" /> {zoteroError}
            </p>
          )}
        </div>
      </div>

      {/* Importar desde Zotero */}
      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <h2 className="text-sm font-medium text-white">Importar desde Zotero</h2>
        <p className="mt-1 text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
          Importá las referencias de tu biblioteca Zotero hacia BiblioIA. Las referencias ya importadas no se duplican.
        </p>
        <div className="mt-4 space-y-3">
          <button
            onClick={importarDesdeZotero}
            disabled={importando || !zoteroConfigurado}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50"
            style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.3)', color: '#22d3ee' }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(34,211,238,0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(34,211,238,0.12)' }}
          >
            <Download className="h-4 w-4" />
            {importando ? 'Importando…' : 'Importar bibliografía de Zotero'}
          </button>
          {!zoteroConfigurado && (
            <p className="text-xs" style={{ color: 'rgba(245,158,11,0.8)' }}>Configurá Zotero primero para poder importar.</p>
          )}
          {importResult && (
            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.7)' }}>
              {importResult.importados} referencias importadas, {importResult.omitidos} ya existían
            </p>
          )}
          {importados.length > 0 && (
            <div>
              <button
                onClick={() => setMostrarImportados((v) => !v)}
                className="text-xs transition-colors"
                style={{ color: 'rgba(34,211,238,0.8)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#22d3ee' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(34,211,238,0.8)' }}
              >
                {mostrarImportados ? 'Ocultar' : `Ver ${importados.length} referencias importadas`}
              </button>
              {mostrarImportados && (
                <div className="mt-3 max-h-80 overflow-y-auto space-y-2">
                  {importados.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg p-3"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <p className="text-sm font-medium text-white">{item.titulo || '(sin título)'}</p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {item.autor && <span className="text-xs" style={{ color: 'rgba(148,163,184,0.6)' }}>{item.autor}</span>}
                        {item.año && <span className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>{item.año}</span>}
                        {item.tipo && (
                          <span className="rounded-full px-1.5 py-px text-xs" style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', color: 'rgba(34,211,238,0.8)' }}>
                            {item.tipo}
                          </span>
                        )}
                        {(item.doi || item.url) && (
                          <a
                            href={item.doi ? `https://doi.org/${item.doi}` : item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 text-xs hover:underline"
                            style={{ color: 'rgba(34,211,238,0.6)' }}
                          >
                            <ExternalLink className="h-2.5 w-2.5" /> Ver
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Usuarios autorizados */}
      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <h2 className="text-sm font-medium text-white">Usuarios autorizados</h2>
        <p className="mt-1 text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
          Solo estos emails pueden acceder a la plataforma. Para modificar la lista, editá la variable{' '}
          <code
            className="rounded px-1 py-0.5"
            style={{ background: 'rgba(139,92,246,0.1)', color: 'rgba(167,139,250,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
          >ALLOWED_EMAILS</code>{' '}
          en el servidor.
        </p>
        <ul className="mt-4 space-y-2">
          {emailsAutorizados.map((email) => (
            <li key={email} className="flex items-center gap-2 text-sm">
              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${email === userEmail ? 'bg-emerald-400' : 'bg-neutral-700'}`} />
              <span style={{ color: email === userEmail ? '#fff' : 'rgba(148,163,184,0.5)' }}>
                {email}
              </span>
              {email === userEmail && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: 'rgba(167,139,250,0.7)' }}
                >vos</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Renombrar archivos ─────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4" style={{ color: 'rgba(34,211,238,0.7)' }} />
          <h2 className="text-sm font-semibold text-white">Renombrar archivos desde metadatos</h2>
        </div>
        <p className="text-xs mb-4" style={{ color: 'rgba(148,163,184,0.5)' }}>
          Genera nombres legibles a partir del autor, año y título registrados. No usa IA.
        </p>

        <button onClick={cargarPropuestas} disabled={cargandoPropuestas}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all disabled:opacity-50"
          style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', color: 'rgba(34,211,238,0.8)' }}>
          {cargandoPropuestas ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Analizar archivos
        </button>

        {propuestasRenombrado.length === 0 && !cargandoPropuestas && resultadoRenombrado === null && (
          <p className="mt-3 text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>
            Hacé clic en "Analizar archivos" para ver qué se puede renombrar.
          </p>
        )}

        {resultadoRenombrado && (
          <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: resultadoRenombrado.errores > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${resultadoRenombrado.errores > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}`, color: resultadoRenombrado.errores > 0 ? '#fbbf24' : '#4ade80' }}>
            {resultadoRenombrado.ok} archivo{resultadoRenombrado.ok !== 1 ? 's' : ''} renombrado{resultadoRenombrado.ok !== 1 ? 's' : ''} correctamente
            {resultadoRenombrado.errores > 0 && ` · ${resultadoRenombrado.errores} error${resultadoRenombrado.errores > 1 ? 'es' : ''}`}
          </div>
        )}

        {propuestasRenombrado.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
                {propuestasRenombrado.length} archivo{propuestasRenombrado.length !== 1 ? 's' : ''} con renombrado propuesto
              </p>
              <div className="flex gap-2">
                <button onClick={() => setSeleccionadosRenombrar(new Set(propuestasRenombrado.map(p => p.id)))}
                  className="text-[11px] rounded px-2 py-0.5 transition-colors"
                  style={{ color: 'rgba(148,163,184,0.6)', background: 'rgba(255,255,255,0.05)' }}>
                  Todos
                </button>
                <button onClick={() => setSeleccionadosRenombrar(new Set())}
                  className="text-[11px] rounded px-2 py-0.5 transition-colors"
                  style={{ color: 'rgba(148,163,184,0.6)', background: 'rgba(255,255,255,0.05)' }}>
                  Ninguno
                </button>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)', maxHeight: '320px', overflowY: 'auto' }}>
              {propuestasRenombrado.map((p) => {
                const sel = seleccionadosRenombrar.has(p.id)
                return (
                  <label key={p.id} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: sel ? 'rgba(34,211,238,0.04)' : 'transparent' }}
                    onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <input type="checkbox" checked={sel} onChange={() => {
                      const next = new Set(seleccionadosRenombrar)
                      sel ? next.delete(p.id) : next.add(p.id)
                      setSeleccionadosRenombrar(next)
                    }} className="mt-0.5 accent-violet-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] truncate" style={{ color: 'rgba(148,163,184,0.45)' }}>{p.nombreActual}</p>
                      <p className="text-xs font-medium truncate" style={{ color: sel ? 'rgba(34,211,238,0.85)' : 'rgba(226,232,240,0.7)' }}>→ {p.nombrePropuesto}</p>
                    </div>
                  </label>
                )
              })}
            </div>

            <button onClick={aplicarRenombrado} disabled={aplicandoRenombrado || seleccionadosRenombrar.size === 0}
              className="mt-2 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #0891b2, #7c3aed)', boxShadow: '0 0 12px rgba(8,145,178,0.25)' }}>
              {aplicandoRenombrado ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Renombrar {seleccionadosRenombrar.size} archivo{seleccionadosRenombrar.size !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
