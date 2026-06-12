/**
 * Extrae el nombre legible de un documento.
 * Si el filename tiene separadores '/' (common en Drive con estructura de carpetas),
 * toma solo el último segmento.
 * Prefiere el título curado (titulo) sobre el nombre de archivo.
 */
export function displayNombre(doc: { nombre: string; titulo?: string | null }): string {
  if (doc.titulo?.trim()) return doc.titulo.trim()
  return limpiarNombre(doc.nombre)
}

export function limpiarNombre(nombre: string | null | undefined): string {
  const str = nombre ?? ''
  const ultima = str.split('/').pop() ?? str
  return ultima.replace(/\.pdf$/i, '').trim()
}

export function norm(str: string | null | undefined): string {
  return (str ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
