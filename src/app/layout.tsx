import type { Metadata } from 'next'
import { Geist, Lora } from 'next/font/google'
import SessionProvider from '@/components/SessionProvider'
import './globals.css'

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

const lora = Lora({
  variable: '--font-lora',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'BiblioIA — Segundo Cerebro Académico',
  description: 'Plataforma de gestión de conocimiento académico con IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} ${lora.variable} h-full antialiased`}>
      <body className="min-h-full bg-neutral-950 text-neutral-100">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
