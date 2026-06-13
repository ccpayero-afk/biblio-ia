import { GoogleGenerativeAI } from '@google/generative-ai'
import { initUserDrive, readJSON, writeJSON, findFile } from './drive'
import { ConfigUsuario } from '@/types'

export const GEMINI_MODEL_GENERATION = 'gemini-2.5-flash'
export const GEMINI_MODEL_EMBEDDING = 'gemini-embedding-2'

// Cifrado AES-256-GCM usando Web Crypto API (compatible con Edge y Node)
async function getKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const raw = enc.encode(secret.slice(0, 32).padEnd(32, '0'))
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptApiKey(apiKey: string): Promise<string> {
  const secret = process.env.ENCRYPTION_SECRET!
  const key = await getKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(apiKey))
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.byteLength)
  return Buffer.from(combined).toString('base64')
}

export async function decryptApiKey(encryptedB64: string): Promise<string> {
  const secret = process.env.ENCRYPTION_SECRET!
  const key = await getKey(secret)
  const combined = Buffer.from(encryptedB64, 'base64')
  const iv = combined.subarray(0, 12)
  const data = combined.subarray(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}

export async function validateGeminiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  if (apiKey.length < 10) {
    return { valid: false, error: 'La key es demasiado corta' }
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
    await model.generateContent('OK')
    return { valid: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)

    // 429 = rate limit → la key es válida, solo está limitada
    if (msg.includes('429') || msg.includes('Too Many Requests')) {
      return { valid: true }
    }

    // 404 = modelo no encontrado (problema de config, no de la key)
    if (msg.includes('404') || msg.includes('no longer available') || msg.includes('not found')) {
      return { valid: true }
    }

    // 401/403 = key inválida o sin acceso
    if (msg.includes('401') || msg.includes('403') || msg.includes('API_KEY_INVALID') || msg.includes('invalid')) {
      return { valid: false, error: 'La API key no es válida o no tiene acceso a Gemini. Verificá que la copiaste correctamente desde Google AI Studio.' }
    }

    // Otro error (red, timeout, etc.) — no rechazar la key por eso
    console.error('[Gemini validation error]', msg)
    return { valid: false, error: msg }
  }
}

// Promise-based cache — concurrent callers share the same in-flight request.
const geminiClientCache = new Map<string, { promise: Promise<GoogleGenerativeAI>; ts: number }>()
const GEMINI_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function getGeminiClient(accessToken: string): Promise<GoogleGenerativeAI> {
  const cached = geminiClientCache.get(accessToken)
  if (cached && Date.now() - cached.ts < GEMINI_CACHE_TTL) return cached.promise

  const promise = (async () => {
    const estructura = await initUserDrive(accessToken)
    const configFileId = await findFile(accessToken, 'config.json', estructura.rootId)
    if (!configFileId) throw new Error('No hay API key configurada. Configurá tu clave de Gemini en Configuración.')

    const config = await readJSON<ConfigUsuario>(accessToken, configFileId)
    if (!config.geminiKeyEncriptada) throw new Error('No hay API key configurada.')

    const apiKey = await decryptApiKey(config.geminiKeyEncriptada)
    return new GoogleGenerativeAI(apiKey)
  })()

  promise.catch(() => geminiClientCache.delete(accessToken))
  geminiClientCache.set(accessToken, { promise, ts: Date.now() })
  return promise
}

export async function saveApiKey(accessToken: string, apiKey: string): Promise<void> {
  const estructura = await initUserDrive(accessToken)
  const encriptada = await encryptApiKey(apiKey)

  const configFileId = await findFile(accessToken, 'config.json', estructura.rootId)
  if (configFileId) {
    const existente = await readJSON<ConfigUsuario>(accessToken, configFileId)
    await writeJSON(accessToken, estructura.rootId, 'config.json', {
      ...existente,
      geminiKeyEncriptada: encriptada,
    })
  } else {
    await writeJSON(accessToken, estructura.rootId, 'config.json', {
      driveInitializado: true,
      estructura,
      geminiKeyEncriptada: encriptada,
    })
  }
}

// Parsea errores de Gemini y devuelve un mensaje amigable, o null si no es un error de rate limit.
export function geminiRateLimitMessage(e: unknown): string | null {
  const msg = String(e)
  if (!msg.includes('429') && !msg.includes('Too Many Requests')) return null

  // Extraer retryDelay del JSON de la respuesta: "retryDelay":"57s"
  const jsonMatch = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/)
  // Fallback: buscar "retry in Xs" en el texto plano
  const textMatch = msg.match(/retry in (\d+(?:\.\d+)?)s/i)

  const rawSeg = jsonMatch?.[1] ?? textMatch?.[1] ?? null
  const segundos = rawSeg ? Math.round(parseFloat(rawSeg)) : null

  let espera: string
  if (!segundos || segundos > 3600) {
    espera = 'Esperá unos minutos y reintentá.'
  } else if (segundos >= 60) {
    espera = `Reintentá en ${Math.ceil(segundos / 60)} minuto${Math.ceil(segundos / 60) > 1 ? 's' : ''}.`
  } else {
    espera = `Reintentá en ${segundos} segundos.`
  }

  return `Gemini está limitando las solicitudes (rate limit). ${espera} Si el problema persiste, revisá tu cuota en Google AI Studio.`
}

export async function hasApiKey(accessToken: string): Promise<boolean> {
  try {
    const estructura = await initUserDrive(accessToken)
    const configFileId = await findFile(accessToken, 'config.json', estructura.rootId)
    if (!configFileId) return false
    const config = await readJSON<ConfigUsuario>(accessToken, configFileId)
    return !!config.geminiKeyEncriptada
  } catch {
    return false
  }
}
