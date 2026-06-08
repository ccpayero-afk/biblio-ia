export function generarIdZettel(): string {
  const fecha = new Date()
  const año = fecha.getFullYear().toString().slice(2)
  const mes = (fecha.getMonth() + 1).toString().padStart(2, '0')
  const dia = fecha.getDate().toString().padStart(2, '0')
  const random = Math.random().toString(36).slice(2, 6)
  return `Z${año}${mes}${dia}-${random}`
}
