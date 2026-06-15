import { GoogleGenerativeAI } from '@google/generative-ai'
import { initUserDrive, readJSON, writeJSON, findFile } from './drive'
import { ConfigUsuario } from '@/types'

export const GEMINI_MODEL_GENERATION = 'gemini-2.5-flash'   // tutor, borrador
export const GEMINI_MODEL_PIPELINE   = 'gemini-2.5-flash'   // ficha, notas, vinculos — thinkingBudget: 0
export const GEMINI_MODEL_EMBEDDING  = 'gemini-embedding-2'

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

// No client cache — keys are already cached by getDecryptedKeys.
// Picks a random key each call to distribute load across all available keys.
export async function getGeminiClient(accessToken: string): Promise<GoogleGenerativeAI> {
  const keys = await getDecryptedKeys(accessToken)
  if (!keys.length) throw new Error('No hay API key configurada. Configurá tu clave de Gemini en Configuración.')
  const key = keys[Math.floor(Math.random() * keys.length)]
  return new GoogleGenerativeAI(key)
}

// ── Multi-key support ─────────────────────────────────────────────────────────

const keysCache = new Map<string, { promise: Promise<string[]>; ts: number }>()
const KEYS_TTL = 2 * 60 * 1000

async function _loadDecryptedKeys(accessToken: string): Promise<string[]> {
  const estructura = await initUserDrive(accessToken)
  const configFileId = await findFile(accessToken, 'config.json', estructura.rootId)
  if (!configFileId) return []
  const config = await readJSON<ConfigUsuario>(accessToken, configFileId)

  if (config.geminiKeysEncriptadas?.length) {
    const keys: string[] = []
    for (const enc of config.geminiKeysEncriptadas) {
      try { keys.push(await decryptApiKey(enc)) } catch { /* skip */ }
    }
    return keys
  }
  if (config.geminiKeyEncriptada) {
    try { return [await decryptApiKey(config.geminiKeyEncriptada)] } catch { return [] }
  }
  return []
}

export function getDecryptedKeys(accessToken: string): Promise<string[]> {
  const cached = keysCache.get(accessToken)
  if (cached && Date.now() - cached.ts < KEYS_TTL) return cached.promise
  const promise = _loadDecryptedKeys(accessToken)
  promise.catch(() => keysCache.delete(accessToken))
  keysCache.set(accessToken, { promise, ts: Date.now() })
  return promise
}

function invalidateKeysCache(accessToken: string) {
  keysCache.delete(accessToken)
}

function isRateLimit(e: unknown): boolean {
  const msg = String(e)
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Too Many Requests')
}

function isServiceUnavailable(e: unknown): boolean {
  const msg = String(e)
  return msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('high demand')
}

// Retries fn up to maxRetries times on 503, with 1.5s delay between attempts.
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      if (isServiceUnavailable(e) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1500))
        continue
      }
      throw e
    }
  }
  throw new Error('unreachable')
}

export async function generateWithRotation<T>(
  accessToken: string,
  fn: (genAI: GoogleGenerativeAI) => Promise<T>
): Promise<T> {
  const keys = await getDecryptedKeys(accessToken)
  if (!keys.length) throw new Error('No hay API key configurada. Configurala en Configuración.')
  let lastError: unknown
  for (let i = 0; i < keys.length; i++) {
    try {
      return await withRetry(() => fn(new GoogleGenerativeAI(keys[i])))
    } catch (e) {
      lastError = e
      if (isRateLimit(e) && i < keys.length - 1) continue
      throw e
    }
  }
  throw lastError
}

export async function* streamWithRotation(
  accessToken: string,
  fn: (genAI: GoogleGenerativeAI) => AsyncGenerator<string>
): AsyncGenerator<string> {
  const keys = await getDecryptedKeys(accessToken)
  if (!keys.length) throw new Error('No hay API key configurada. Configurala en Configuración.')
  let lastError: unknown
  for (let i = 0; i < keys.length; i++) {
    try {
      yield* fn(new GoogleGenerativeAI(keys[i]))
      return
    } catch (e) {
      lastError = e
      if (isRateLimit(e) && i < keys.length - 1) continue
      throw e
    }
  }
  throw lastError
}

// Returns masked key info for display (never exposes raw keys)
export async function getKeyInfo(accessToken: string): Promise<{ count: number; masked: string[] }> {
  const estructura = await initUserDrive(accessToken)
  const configFileId = await findFile(accessToken, 'config.json', estructura.rootId)
  if (!configFileId) return { count: 0, masked: [] }
  const config = await readJSON<ConfigUsuario>(accessToken, configFileId)

  const encrypted = config.geminiKeysEncriptadas?.length
    ? config.geminiKeysEncriptadas
    : config.geminiKeyEncriptada ? [config.geminiKeyEncriptada] : []

  const masked: string[] = []
  for (const enc of encrypted) {
    try {
      const raw = await decryptApiKey(enc)
      masked.push(raw.length > 8 ? `••••••••${raw.slice(-6)}` : '••••••••••••••')
    } catch { masked.push('(inválida)') }
  }
  return { count: masked.length, masked }
}

export async function addApiKey(accessToken: string, apiKey: string): Promise<void> {
  const estructura = await initUserDrive(accessToken)
  const encriptada = await encryptApiKey(apiKey)
  const configFileId = await findFile(accessToken, 'config.json', estructura.rootId)

  let config: ConfigUsuario = { driveInitializado: true, estructura }
  if (configFileId) config = await readJSON<ConfigUsuario>(accessToken, configFileId)

  const existing = config.geminiKeysEncriptadas ?? (config.geminiKeyEncriptada ? [config.geminiKeyEncriptada] : [])
  const updated = [...existing, encriptada].slice(0, 5) // max 5

  await writeJSON(accessToken, estructura.rootId, 'config.json', {
    ...config,
    geminiKeyEncriptada: updated[0], // keep legacy field pointing to first key
    geminiKeysEncriptadas: updated,
  })
  invalidateKeysCache(accessToken)
}

export async function removeApiKey(accessToken: string, index: number): Promise<void> {
  const estructura = await initUserDrive(accessToken)
  const configFileId = await findFile(accessToken, 'config.json', estructura.rootId)
  if (!configFileId) return

  const config = await readJSON<ConfigUsuario>(accessToken, configFileId)
  const existing = config.geminiKeysEncriptadas ?? (config.geminiKeyEncriptada ? [config.geminiKeyEncriptada] : [])
  const updated = existing.filter((_, i) => i !== index)

  await writeJSON(accessToken, estructura.rootId, 'config.json', {
    ...config,
    geminiKeyEncriptada: updated[0] ?? undefined,
    geminiKeysEncriptadas: updated,
  })
  invalidateKeysCache(accessToken)
}

// Legacy single-key save — now delegates to addApiKey (replaces all keys with just this one)
export async function saveApiKey(accessToken: string, apiKey: string): Promise<void> {
  const estructura = await initUserDrive(accessToken)
  const encriptada = await encryptApiKey(apiKey)
  const configFileId = await findFile(accessToken, 'config.json', estructura.rootId)

  let config: ConfigUsuario = { driveInitializado: true, estructura }
  if (configFileId) config = await readJSON<ConfigUsuario>(accessToken, configFileId)

  await writeJSON(accessToken, estructura.rootId, 'config.json', {
    ...config,
    geminiKeyEncriptada: encriptada,
    geminiKeysEncriptadas: [encriptada],
  })
  invalidateKeysCache(accessToken)
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
    const keys = await getDecryptedKeys(accessToken)
    return keys.length > 0
  } catch {
    return false
  }
}
