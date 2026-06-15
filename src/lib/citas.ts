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

// ─── Format utilities (re-exported from cita-formato for server-side use) ────

export { generarFormatoAPA, generarFormatoChicago, crearCita } from './cita-formato'
