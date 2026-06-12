'use client'

import { useState } from 'react'
import { Eye, EyeOff, CheckCircle, XCircle, ExternalLink } from 'lucide-react'

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

      {/* API Key de Gemini */}
      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">API key de Gemini</h2>
          {configurada ? (
            <span
              className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs"
              style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: 'rgba(52,211,153,0.9)' }}
            >
              <CheckCircle className="h-3.5 w-3.5" /> Configurada
            </span>
          ) : (
            <span
              className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'rgba(245,158,11,0.9)' }}
            >
              <XCircle className="h-3.5 w-3.5" /> No configurada
            </span>
          )}
        </div>

        <p className="mt-2 text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
          Tu API key se guarda cifrada en tu Google Drive. Nunca se almacena en nuestros servidores.
          Conseguí tu key gratis en{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 hover:underline"
            style={{ color: 'rgba(34,211,238,0.8)' }}
          >
            Google AI Studio <ExternalLink className="h-3 w-3" />
          </a>
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={mostrar ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setResultado(null) }}
                placeholder={configurada ? '••••••••••••••••••••••••' : 'AIza...'}
                className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-neutral-600 focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.1)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = '' }}
                onKeyDown={(e) => e.key === 'Enter' && guardar()}
              />
              <button
                onClick={() => setMostrar(!mostrar)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'rgba(148,163,184,0.4)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(148,163,184,0.4)' }}
              >
                {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={guardar}
              disabled={guardando || !apiKey.trim()}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', boxShadow: '0 0 14px rgba(124,58,237,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 22px rgba(124,58,237,0.5)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 14px rgba(124,58,237,0.3)' }}
            >
              {guardando ? 'Verificando...' : 'Verificar y guardar'}
            </button>
          </div>

          {resultado === 'ok' && (
            <p className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(52,211,153,0.9)' }}>
              <CheckCircle className="h-3.5 w-3.5" /> API key válida y guardada correctamente
            </p>
          )}
          {resultado === 'error' && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <XCircle className="h-3.5 w-3.5" /> {mensajeError}
            </p>
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
    </div>
  )
}
