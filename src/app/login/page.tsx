import { Sora, Inter } from 'next/font/google'
import NeuralBrainCanvas from './NeuralBrainCanvas'
import SignInButton from './SignInButton'
import styles from './login.module.css'

const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-sora',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata = {
  title: 'BiblioIA — Segundo Cerebro Académico',
  description: 'Plataforma de gestión de conocimiento académico potenciada por IA.',
}

export default function LoginPage() {
  return (
    <div className={`${styles.page} ${sora.variable} ${inter.variable}`}>
      {/* Ambient glow blobs behind the canvas */}
      <div className={styles.glow}>
        <div className={styles.glowLeft} />
        <div className={styles.glowRight} />
      </div>

      <NeuralBrainCanvas />

      <div className={styles.content}>
        <div className={styles.card}>
          {/* Brand */}
          <div className={styles.logoArea}>
            <div className={styles.brandMark} aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="7"  r="3.5" fill="rgba(196,181,253,0.95)" />
                <circle cx="7"  cy="20" r="3"   fill="rgba(196,181,253,0.72)" />
                <circle cx="21" cy="20" r="3"   fill="rgba(196,181,253,0.72)" />
                <line x1="14" y1="7"  x2="7"  y2="20" stroke="rgba(196,181,253,0.45)" strokeWidth="1.4" />
                <line x1="14" y1="7"  x2="21" y2="20" stroke="rgba(196,181,253,0.45)" strokeWidth="1.4" />
                <line x1="7"  y1="20" x2="21" y2="20" stroke="rgba(196,181,253,0.35)" strokeWidth="1.4" />
              </svg>
            </div>
            <h1 className={styles.title}>BiblioIA</h1>
            <p className={styles.subtitle}>Segundo Cerebro Académico</p>
          </div>

          <div className={styles.divider} />

          <p className={styles.tagline}>
            Tu biblioteca académica, conectada<br />
            por inteligencia.
          </p>

          <SignInButton />

          <p className={styles.legal}>
            Al continuar, aceptás los{' '}
            <a href="#">Términos de servicio</a>
            {' '}y la{' '}
            <a href="#">Política de privacidad</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
