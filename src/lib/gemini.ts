import { GoogleGenerativeAI } from '@google/generative-ai'
import { initUserDrive, readJSON, writeJSON, findFile } from './drive'
import { ConfigUsuario } from '@/types'

export const GEMINI_MODEL_GENERATION = 'gemini-2.0-flash'
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
  // Validación de formato básica
  if (!apiKey.startsWith('AIza') || apiKey.length < 30) {
    return { valid: false, error: 'La key debe empezar con "AIza" y tener al menos 30 caracteres' }
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
    await model.generateContent('OK')
    return { valid: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)

    // 429 = quota excedida → la key es válida, solo está limitada
    if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
      return { valid: true }
    }

    // 400/401/403 = key inválida o sin acceso
    console.error('[Gemini validation error]', msg)
    return { valid: false, error: msg }
  }
}

export async function getGeminiClient(accessToken: string): Promise<GoogleGenerativeAI> {
  const estructura = await initUserDrive(accessToken)
  const configFileId = await findFile(accessToken, 'config.json', estructura.rootId)
  if (!configFileId) throw new Error('No hay API key configurada. Configurá tu clave de Gemini en Configuración.')

  const config = await readJSON<ConfigUsuario>(accessToken, configFileId)
  if (!config.geminiKeyEncriptada) throw new Error('No hay API key configurada.')

  const apiKey = await decryptApiKey(config.geminiKeyEncriptada)
  return new GoogleGenerativeAI(apiKey)
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
