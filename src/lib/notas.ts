import { Nota, NotaVersion } from '@/types'
import { initUserDrive, findFile, readJSON, writeJSON, trashPDF } from './drive'

export type NotaLigera = Omit<Nota, 'contenido' | 'versiones'>

interface ContenidoNota {
  contenido: string
  versiones: NotaVersion[]
}

const INDEX = 'notas.json'
const contentFile = (id: string) => `nota_${id}.json`

async function _notasId(accessToken: string): Promise<string> {
  return (await initUserDrive(accessToken)).notasId
}

// Reads the lean index. Pre-migration entries may still have inline contenido/versiones.
export async function leerIndice(
  accessToken: string
): Promise<{ notasId: string; indice: NotaLigera[] }> {
  const notasId = await _notasId(accessToken)
  const fileId = await findFile(accessToken, INDEX, notasId)
  if (!fileId) return { notasId, indice: [] }
  const data = await readJSON<Nota[]>(accessToken, fileId).catch(() => [] as Nota[])
  return { notasId, indice: data as unknown as NotaLigera[] }
}

// Reads content file for a note. Falls back to inline fields for pre-migration entries.
export async function leerContenido(
  accessToken: string,
  notasId: string,
  id: string,
  fallback?: { contenido?: string; versiones?: NotaVersion[] }
): Promise<ContenidoNota> {
  const fileId = await findFile(accessToken, contentFile(id), notasId)
  if (fileId) {
    return readJSON<ContenidoNota>(accessToken, fileId).catch(() => ({
      contenido: fallback?.contenido ?? '',
      versiones: fallback?.versiones ?? [],
    }))
  }
  return { contenido: fallback?.contenido ?? '', versiones: fallback?.versiones ?? [] }
}

// Reads full note by ID (index entry + content file).
export async function leerNota(accessToken: string, id: string): Promise<Nota | null> {
  const { notasId, indice } = await leerIndice(accessToken)
  const ligera = indice.find((n) => n.id === id) as
    | (NotaLigera & { contenido?: string; versiones?: NotaVersion[] })
    | undefined
  if (!ligera) return null
  const c = await leerContenido(accessToken, notasId, id, ligera)
  return { ...ligera, contenido: c.contenido, versiones: c.versiones } as Nota
}

// Strips contenido + versiones from a full Nota to produce a lean index entry.
export function aLigera(nota: Nota): NotaLigera {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { contenido: _c, versiones: _v, ...rest } = nota
  return rest
}

// Writes lean index.
export async function escribirIndice(
  accessToken: string,
  notasId: string,
  indice: NotaLigera[]
): Promise<void> {
  await writeJSON(accessToken, notasId, INDEX, indice)
}

// Writes content file for a note.
export async function escribirContenido(
  accessToken: string,
  notasId: string,
  id: string,
  data: ContenidoNota
): Promise<void> {
  await writeJSON(accessToken, notasId, contentFile(id), data)
}

// Deletes content file for a note (used on hard delete).
export async function eliminarArchivoContenido(
  accessToken: string,
  notasId: string,
  id: string
): Promise<void> {
  const fileId = await findFile(accessToken, contentFile(id), notasId)
  if (fileId) await trashPDF(accessToken, fileId)
}

// Reads ALL full notes in batches of 20 (for AI operations that need contenido).
export async function leerTodasCompletas(accessToken: string): Promise<Nota[]> {
  const { notasId, indice } = await leerIndice(accessToken)
  const BATCH = 20
  const result: Nota[] = []
  for (let i = 0; i < indice.length; i += BATCH) {
    const lote = indice.slice(i, i + BATCH) as Array<
      NotaLigera & { contenido?: string; versiones?: NotaVersion[] }
    >
    const contenidos = await Promise.all(
      lote.map((n) => leerContenido(accessToken, notasId, n.id, n))
    )
    result.push(
      ...lote.map(
        (n, j) =>
          ({ ...n, contenido: contenidos[j].contenido, versiones: contenidos[j].versiones } as Nota)
      )
    )
  }
  return result
}
