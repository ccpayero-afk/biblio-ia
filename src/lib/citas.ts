import { Cita } from '@/types'
import { initUserDrive, findFile, readJSON, writeJSON } from './drive'

// ─── Storage CRUD ────────────────────────────────────────────────────────────

const CITAS_FILE = 'citas.json'

async function _citasId(accessToken: string): Promise<string> {
  return (await initUserDrive(accessToken)).citasId
}

export async function leerCitas(
  accessToken: string
): Promise<{ citasId: string; citas: Cita[] }> {
  const citasId = await _citasId(accessToken)
  const fileId = await findFile(accessToken, CITAS_FILE, citasId)
  if (!fileId) return { citasId, citas: [] }
  const data = await readJSON<Cita[]>(accessToken, fileId).catch(() => [] as Cita[])
  return { citasId, citas: Array.isArray(data) ? data : [] }
}

export async function escribirCitas(
  accessToken: string,
  citasId: string,
  citas: Cita[]
): Promise<void> {
  await writeJSON(accessToken, citasId, CITAS_FILE, citas)
}

export async function agregarCita(
  accessToken: string,
  cita: Cita
): Promise<{ duplicado: boolean; citaExistente?: Cita }> {
  const { citasId, citas } = await leerCitas(accessToken)
  const fp = (cita.texto ?? '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120)
  if (fp.length > 10) {
    const dup = citas.find(
      (c) => (c.texto ?? '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120) === fp
    )
    if (dup) return { duplicado: true, citaExistente: dup }
  }
  citas.push(cita)
  await escribirCitas(accessToken, citasId, citas)
  return { duplicado: false }
}

export async function eliminarCita(accessToken: string, id: string): Promise<void> {
  const { citasId, citas } = await leerCitas(accessToken)
  await escribirCitas(accessToken, citasId, citas.filter((c) => c.id !== id))
}

// ─── Format utilities ────────────────────────────────────────────────────────

export function generarFormatoAPA(
  autor: string,
  año: string,
  titulo: string,
  pagina: number
): string {
  const apellido = autor ? autor.split(',')[0].trim() : 'Autor desconocido'
  const anioStr = año || 's.f.'
  return `${apellido} (${anioStr}, p. ${pagina})`
}

export function generarFormatoChicago(
  autor: string,
  año: string,
  titulo: string,
  pagina: number
): string {
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
