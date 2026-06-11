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
  titulo?: string          // título del trabajo (distinto del nombre de archivo)
  autor: string
  año: string
  tipo?: 'articulo' | 'libro' | 'capitulo' | 'tesis' | 'otro'
  revista?: string         // nombre de la revista (para artículos)
  editorial?: string       // editorial/publisher
  volumen?: string         // volumen (artículos/libros)
  numero?: string          // número/issue (artículos)
  paginas?: string         // rango de páginas, ej: "45-67"
  url?: string
  doi?: string
  isbn?: string
  abstract?: string
  etiquetas: string[]
  estado: 'sin_indexar' | 'indexando' | 'indexado' | 'error'
  fragmentos: number
  indexadoEn?: string
  creadoEn: string
  fichaGenerada: boolean
  carpetaId?: string
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

// ─── Zettelkasten ───────────────────────────────────────────────────────────

export type TipoNota =
  | 'efimera'      // captura rápida sin procesar — bandeja de entrada
  | 'referencia'   // sobre un texto específico
  | 'permanente'   // idea atómica propia
  | 'estructura'   // índice de entrada a un cluster de notas
  | 'proyecto'     // nota de trabajo para un artículo o tesis
  // legado (se mapean a nuevos tipos en la UI)
  | 'manual'
  | 'ia'
  | 'consulta'
  | 'ficha'

export interface VinculoZettel {
  notaDestinoId: string
  tipo: 'complementa' | 'contradice' | 'ejemplifica' | 'aplica_en' |
        'es_consecuencia_de' | 'cuestiona' | 'define' | 'ver_tambien'
  nota?: string
  bidireccional: boolean
  creadoEn: string
}

export interface VinculoSugerido {
  notaId: string
  notaTitulo: string
  tipoVinculo: VinculoZettel['tipo']
  razon: string
  confianza: 'alta' | 'media' | 'baja'
}

export interface Nota {
  id: string
  titulo: string
  contenido: string
  tipo: TipoNota
  vinculos: VinculoZettel[]
  documentoOrigenId?: string
  paginaOrigen?: number
  citaOrigenId?: string
  etiquetas: string[]
  creadaEn: string
  actualizadaEn: string
  // legado — algunos de estos campos existían antes del Zettelkasten
  documentoId?: string
  pagina?: number
  fragmentoTexto?: string
  fichaData?: FichaLectura
  notasIndexadas?: string[]
}

// ─── Carpetas ────────────────────────────────────────────────────────────────

export interface Carpeta {
  id: string
  nombre: string
  descripcion?: string
  color: 'purple' | 'teal' | 'coral' | 'amber' | 'blue' | 'green' | 'gray'
  icono?: string
  carpetaPadreId?: string
  documentosIds: string[]
  subcarpetasIds: string[]
  creadaEn: string
  actualizadaEn: string
  orden: number
}

// ─── Grafo ───────────────────────────────────────────────────────────────────

export interface NodoGrafo {
  id: string
  tipo: 'documento' | 'concepto' | 'autor' | 'nota'
  label: string
  peso: number
}

export interface AristaGrafo {
  source: string
  target: string
  tipo: 'conceptual' | 'debate' | 'citacion' | 'manual' | VinculoZettel['tipo']
  label?: string
  peso: number
}

export interface Grafo {
  nodos: NodoGrafo[]
  aristas: AristaGrafo[]
  actualizadoEn: string
}

// ─── Proyectos ───────────────────────────────────────────────────────────────

export interface SeccionProyecto {
  id: string
  titulo: string
  argumento: string
  borrador?: string
  citasAsignadas: string[]
  notasAsignadas?: string[]
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
  metodologia?: string
  referenciasCitadas?: string[]
  palabrasClave?: string[]
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
  carpetasId?: string
  configFileId?: string
}

export interface ConfigUsuario {
  driveInitializado: boolean
  estructura: DriveStructure
  geminiKeyEncriptada?: string
}
