'use client'

import { useState, useEffect, useCallback } from 'react'
import { Documento } from '@/types'

export function useBiblioteca() {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/drive/pdfs')
      if (!res.ok) throw new Error('Error al cargar documentos')
      setDocumentos(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { documentos, cargando, error, recargar: cargar, setDocumentos }
}
