import { Session } from 'next-auth'

export function getAccessToken(session: Session | null): string {
  if (!session?.accessToken) {
    throw new Error('No hay token de acceso disponible. Iniciá sesión nuevamente.')
  }
  return session.accessToken
}

export function requireApiKey(session: Session | null): void {
  if (!session) {
    throw new Error('No autenticado.')
  }
  // La verificación real se hace leyendo config.json desde Drive
  // Esta función es un placeholder que se expande en Fase 3
}

export function isEmailAllowed(email: string): boolean {
  const allowed = (process.env.ALLOWED_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean)
  if (allowed.length === 0) return true
  return allowed.includes(email)
}
