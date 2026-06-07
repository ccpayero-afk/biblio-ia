export interface Usuario {
  id: string
  email: string
  nombre: string
  imagen?: string
  apiKeyConfigurada: boolean
}

export interface Documento {
  id: string
  nombre: string
  autor: string
  año: string
  editorial?: string
  abstract?: string
  etiquetas: string[]
  estado: 'sin_indexar' | 'indexando' | 'indexado' | 'error'
  fragmentos: number
  indexadoEn?: string
  creadoEn: string
  fichaGenerada: boolean
}

export interface Fragmento {
  id: string
  documentoId: string
  texto: string
  pagina: number
  embedding: number[]
}

export interface Highlight {
  id: string
  documentoId: string
  texto: string
  pagina: number
  posicion: { x: number; y: number; width: number; height: number }
  color: 'amarillo' | 'azul' | 'rojo'
  nota?: string
  creadoEn: string
}

export interface Cita {
  id: string
  texto: string
  pagina: number
  documentoId: string
  documentoNombre: string
  autor: string
  año: string
  notaPropia?: string
  etiquetas: string[]
  proyectoId?: string
  formatoAPA: string
  formatoChicago: string
  creadaEn: string
}

export interface Nota {
  id: string
  contenido: string
  documentoId?: string
  pagina?: number
  fragmentoTexto?: string
  etiquetas: string[]
  tipo: 'manual' | 'ia' | 'consulta' | 'ficha'
  creadaEn: string
  actualizadaEn: string
}

export interface NodoGrafo {
  id: string
  tipo: 'documento' | 'concepto' | 'autor'
  label: string
  peso: number
}

export interface AristaGrafo {
  source: string
  target: string
  tipo: 'conceptual' | 'debate' | 'citacion' | 'manual'
  label?: string
  peso: number
}

export interface Grafo {
  nodos: NodoGrafo[]
  aristas: AristaGrafo[]
  actualizadoEn: string
}

export interface SeccionProyecto {
  id: string
  titulo: string
  argumento: string
  borrador?: string
  citasAsignadas: string[]
  orden: number
}

export interface Proyecto {
  id: string
  nombre: string
  tipo: 'tesis' | 'articulo' | 'ponencia' | 'clase' | 'informe'
  descripcion: string
  argumentoCentral: string
  documentosVinculados: string[]
  citasVinculadas: string[]
  notasVinculadas: string[]
  secciones: SeccionProyecto[]
  creadoEn: string
  actualizadoEn: string
}

export interface FichaLectura {
  documentoId: string
  tesisCentral: string
  argumentoPrincipal: string
  conceptosClave: { concepto: string; definicion: string }[]
  posicionDebate: string
  citasDestacadas: { texto: string; pagina: number }[]
  limitaciones: string
  relevancia: string
  generadaEn: string
}

export interface DriveStructure {
  rootId: string
  pdfsId: string
  highlightsId: string
  citasId: string
  notasId: string
  conceptosId: string
  proyectosId: string
  indexId: string
  configFileId?: string
}

export interface ConfigUsuario {
  driveInitializado: boolean
  estructura: DriveStructure
  geminiKeyEncriptada?: string
}
