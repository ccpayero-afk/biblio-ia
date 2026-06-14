import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean)

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  const tokens = await res.json()
  if (!res.ok) throw new Error(tokens.error ?? 'Error al refrescar token')
  return tokens as { access_token: string; expires_in: number }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/drive',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Primer login: guarda los tokens
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        }
      }

      // Token todavía válido (con 60s de margen)
      if (Date.now() < (token.expiresAt as number) * 1000 - 60_000) {
        return token
      }

      // Token expirado → refresh
      try {
        const refreshed = await refreshAccessToken(token.refreshToken as string)
        return {
          ...token,
          accessToken: refreshed.access_token,
          expiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in,
        }
      } catch (e) {
        console.error('[Token refresh failed]', e)
        return { ...token, error: 'RefreshTokenError' }
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.refreshToken = token.refreshToken as string
      if (token.error) session.error = token.error as string
      return session
    },
    async signIn({ profile }) {
      const email = profile?.email ?? ''
      if (ALLOWED_EMAILS.length === 0) return true
      return ALLOWED_EMAILS.includes(email)
    },
  },
  pages: {
    signIn: '/login',
    error: '/acceso-denegado',
  },
  secret: process.env.AUTH_SECRET,
})
