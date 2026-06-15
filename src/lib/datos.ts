import { Dato } from '@/types'
import { initUserDrive, findFile, readJSON, writeJSON } from './drive'

const DATOS_FILE = 'datos.json'

async function _citasId(accessToken: string): Promise<string> {
  return (await initUserDrive(accessToken)).citasId
}

export async function leerDatos(
  accessToken: string
): Promise<{ citasId: string; datos: Dato[] }> {
  const citasId = await _citasId(accessToken)
  const fileId = await findFile(accessToken, DATOS_FILE, citasId)
  if (!fileId) return { citasId, datos: [] }
  const data = await readJSON<Dato[]>(accessToken, fileId).catch(() => [] as Dato[])
  return { citasId, datos: Array.isArray(data) ? data : [] }
}

export async function escribirDatos(
  accessToken: string,
  citasId: string,
  datos: Dato[]
): Promise<void> {
  await writeJSON(accessToken, citasId, DATOS_FILE, datos)
}

export async function agregarDatos(accessToken: string, nuevos: Dato[]): Promise<void> {
  if (nuevos.length === 0) return
  const { citasId, datos } = await leerDatos(accessToken)
  await escribirDatos(accessToken, citasId, [...datos, ...nuevos])
}

export async function eliminarDato(accessToken: string, id: string): Promise<void> {
  const { citasId, datos } = await leerDatos(accessToken)
  await escribirDatos(accessToken, citasId, datos.filter((d) => d.id !== id))
}
