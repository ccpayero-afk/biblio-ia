import type { Cita } from '@/types'

export function generarFormatoAPA(autor: string, año: string, titulo: string, pagina: number): string {
  const apellido = autor ? autor.split(',')[0].trim() : 'Autor desconocido'
  const anioStr = año || 's.f.'
  return `${apellido} (${anioStr}, p. ${pagina})`
}

export function generarFormatoChicago(autor: string, año: string, titulo: string, pagina: number): string {
  const apellido = autor ? autor.split(',')[0].trim() : 'Autor desconocido'
  const anioStr = año || 's.f.'
  const tituloCorto = titulo.length > 40 ? titulo.slice(0, 40) + '…' : titulo
  return `${apellido}, "${tituloCorto}", ${anioStr}, ${pagina}`
}

export function crearCita(params: {
  texto: string
  pagina: number
  documentoId: string
  documentoNombre: string
  autor: string
  año: string
  notaPropia?: string
  etiquetas?: string[]
  proyectoId?: string
}): Cita {
  const id = `cita_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const titulo = params.documentoNombre.replace(/\.pdf$/i, '')
  return {
    id,
    texto: params.texto,
    pagina: params.pagina,
    documentoId: params.documentoId,
    documentoNombre: params.documentoNombre,
    autor: params.autor,
    año: params.año,
    notaPropia: params.notaPropia,
    etiquetas: params.etiquetas ?? [],
    proyectoId: params.proyectoId,
    formatoAPA: generarFormatoAPA(params.autor, params.año, titulo, params.pagina),
    formatoChicago: generarFormatoChicago(params.autor, params.año, titulo, params.pagina),
    creadaEn: new Date().toISOString(),
  }
}
