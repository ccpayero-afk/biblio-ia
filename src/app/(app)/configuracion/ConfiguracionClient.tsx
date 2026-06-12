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
        <h1 className="text-2xl font-semibold text-white">Configuración</h1>
        <p className="mt-1 text-sm text-neutral-400">Configurá tu acceso a la IA y revisá los usuarios autorizados.</p>
      </div>

      {/* API Key de Gemini */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">API key de Gemini</h2>
          {configurada ? (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle className="h-3.5 w-3.5" /> Configurada
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <XCircle className="h-3.5 w-3.5" /> No configurada
            </span>
          )}
        </div>

        <p className="mt-2 text-xs text-neutral-500">
          Tu API key se guarda cifrada en tu Google Drive. Nunca se almacena en nuestros servidores.
          Conseguí tu key gratis en{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-blue-400 hover:underline"
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
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 pr-10 text-sm text-white placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && guardar()}
              />
              <button
                onClick={() => setMostrar(!mostrar)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
              >
                {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={guardar}
              disabled={guardando || !apiKey.trim()}
              className="rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:from-blue-500 hover:to-violet-500 disabled:opacity-50"
            >
              {guardando ? 'Verificando...' : 'Verificar y guardar'}
            </button>
          </div>

          {resultado === 'ok' && (
            <p className="flex items-center gap-1.5 text-xs text-green-400">
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
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-sm font-medium text-white">Usuarios autorizados</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Solo estos emails pueden acceder a la plataforma. Para modificar la lista, editá la variable{' '}
          <code className="rounded bg-neutral-800 px-1 py-0.5 text-neutral-300">ALLOWED_EMAILS</code>{' '}
          en el servidor.
        </p>
        <ul className="mt-4 space-y-2">
          {emailsAutorizados.map((email) => (
            <li key={email} className="flex items-center gap-2 text-sm">
              <span className={`h-2 w-2 rounded-full ${email === userEmail ? 'bg-green-400' : 'bg-neutral-600'}`} />
              <span className={email === userEmail ? 'text-white' : 'text-neutral-400'}>
                {email}
              </span>
              {email === userEmail && (
                <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-500">vos</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
