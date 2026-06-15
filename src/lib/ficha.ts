import { FichaLectura, Fragmento } from '@/types'
import { generateWithRotation, GEMINI_MODEL_GENERATION } from './gemini'
import { initUserDrive, findFile, readJSON, writeJSON } from './drive'

export async function generateFicha(
  documentoId: string,
  documentoNombre: string,
  autor: string,
  año: string,
  fragmentos: Fragmento[],
  accessToken: string
): Promise<FichaLectura> {

  const todos = fragmentos.filter((f) => f.documentoId === documentoId)
  const N = 20
  const introN = 3
  const conclusionN = 3
  const middleN = N - introN - conclusionN

  let muestra: typeof todos
  if (todos.length <= N || todos.length <= introN + conclusionN) {
    muestra = todos
  } else {
    const intro = todos.slice(0, introN)
    const conclusion = todos.slice(todos.length - conclusionN)
    const middlePool = todos.slice(introN, todos.length - conclusionN)
    const middle = Array.from(
      { length: Math.min(middleN, middlePool.length) },
      (_, i) => middlePool[Math.floor(i * (middlePool.length - 1) / (Math.min(middleN, middlePool.length) - 1))]
    )
    const seen = new Set<number>()
    muestra = [...intro, ...middle, ...conclusion]
      .filter((f) => { const idx = todos.indexOf(f); if (seen.has(idx)) return false; seen.add(idx); return true })
      .sort((a, b) => a.pagina - b.pagina)
  }

  const muestraTexto = muestra
    .map((f) => `[p.${f.pagina}] ${f.texto.slice(0, 600)}`)
    .join('\n\n')

  const titulo = documentoNombre.replace(/\.pdf$/i, '')
  const prompt = `Analizá el siguiente texto académico y generá una ficha de lectura académica completa.

DOCUMENTO: "${titulo}" por ${autor || 'Autor desconocido'} (${año || 's.f.'})

FRAGMENTOS SELECCIONADOS (${muestra.length} de ${todos.length} total (${introN} intro, ${conclusionN} conclusión, ${middleN} desarrollo)):
${muestraTexto}

Respondé ÚNICAMENTE con un objeto JSON puro (sin markdown, sin \`\`\`json) con esta estructura exacta:
{
  "tesisCentral": "Una oración precisa que sintetice la tesis o argumento central del texto",
  "argumentoPrincipal": "2-3 oraciones que expliquen cómo el autor sostiene y desarrolla su tesis",
  "contextoProduccion": "Contexto histórico, institucional y académico en que fue producido el texto. Campo disciplinar, tradición teórica, momento del debate en que interviene",
  "problemaInvestigacion": "Cuál es el problema concreto que el texto busca resolver o explicar",
  "preguntasInvestigacion": ["¿Pregunta central que guía la investigación?", "¿Otras preguntas secundarias si las hay?"],
  "objetivos": "Objetivos generales y específicos del trabajo (qué se propone demostrar, analizar o construir)",
  "hipotesis": "Hipótesis central o supuestos de partida del trabajo. Si no hay hipótesis explícita, reconstruirla",
  "conceptosClave": [
    { "concepto": "nombre del concepto", "definicion": "cómo lo define el autor en el texto, diferenciándolo de otros usos" }
  ],
  "marcoTeorico": "Principales corrientes teóricas, autores y debates en que se apoya el trabajo. Qué tradición adopta y con qué autores dialoga",
  "metodologia": "Diseño metodológico: tipo de estudio, fuentes, técnicas de recolección y análisis, universo/muestra, período y ámbito geográfico",
  "estructuraArgumental": "Cómo está organizado el texto: partes, capítulos o secciones y su lógica argumentativa",
  "evidencias": "Principales evidencias empíricas, casos, ejemplos o datos que el autor usa para sostener su argumento",
  "hallazgos": "Principales hallazgos, resultados y conclusiones a las que llega el texto",
  "posicionDebate": "En qué debate académico se inscribe y qué posición adopta frente a otros autores o corrientes",
  "debatesControversias": "Con qué autores, enfoques o posiciones polemiza explícita o implícitamente. Qué debates abre o cierra",
  "limitaciones": "Limitaciones metodológicas, alcances acotados, aspectos no abordados o posibles críticas al trabajo",
  "aportes": {
    "teoricos": "Contribuciones al marco conceptual o teórico del campo",
    "metodologicos": "Innovaciones o aportes al enfoque o diseño metodológico",
    "empiricos": "Datos, casos o hallazgos empíricos novedosos",
    "politicos": "Implicaciones para políticas públicas, intervenciones o debates político-sociales"
  },
  "citasDestacadas": [
    { "texto": "cita textual relevante extraída del fragmento", "pagina": 1 }
  ],
  "palabrasClave": ["palabra1", "palabra2", "palabra3"],
  "relacionOtrasObras": "Cómo se relaciona con otros textos del campo: qué continúa, cuestiona o complementa",
  "utilidadInvestigacion": "Para qué tipo de investigaciones en ciencias sociales latinoamericanas es más útil este texto y cómo usarlo",
  "evaluacionCritica": "Evaluación crítica del texto: fortalezas, debilidades, coherencia entre preguntas-método-conclusiones, originalidad y relevancia",
  "notasZettelkasten": ["Idea atómica 1 extraída del texto formulada como afirmación propia", "Idea atómica 2"],
  "datosEstadisticos": [
    { "valor": "el dato numérico, porcentaje o estadística exacta tal como aparece en el texto", "contexto": "qué mide o significa ese dato, marco temporal/espacial, a qué población o fenómeno refiere", "tematica": "una de las temáticas del listado", "pagina": 1 }
  ],
  "referenciasCitadas": ["Apellido, Nombre (año). Título. Editorial"]
}

REGLAS:
- Si algún campo no aplica al texto, devolvé null o [] según corresponda.
- datosEstadisticos: incluí SOLO datos con número, porcentaje, cifra o estadística concreta. Si no hay, devolvé [].
- tematica en datosEstadisticos DEBE ser una de: pobreza, desigualdad, riqueza, deuda, trabajo, empleo, salario, poblacion, educacion, salud, vivienda, genero, migracion, economia, finanzas, comercio, industria, agricultura, medio-ambiente, politica, violencia, otro.
- notasZettelkasten: formulá cada idea como una afirmación propia del investigador, no como resumen del texto.`

  const result = await generateWithRotation(accessToken, async (genAI) => {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
    return model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      // temperature: 1 is required alongside thinkingBudget: 0 to actually disable thinking
      generationConfig: { temperature: 1, thinkingConfig: { thinkingBudget: 0 } } as never,
    })
  })
  let text = result.response.text().trim()

  // Extract the JSON object regardless of markdown wrappers
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: Record<string, any>
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Gemini no devolvió JSON válido. Intentá de nuevo o verificá que el documento tiene texto indexado.')
  }

  return {
    documentoId,
    tesisCentral: parsed.tesisCentral ?? '',
    argumentoPrincipal: parsed.argumentoPrincipal ?? '',
    conceptosClave: parsed.conceptosClave ?? [],
    posicionDebate: parsed.posicionDebate ?? '',
    citasDestacadas: parsed.citasDestacadas ?? [],
    datosEstadisticos: parsed.datosEstadisticos ?? [],
    limitaciones: parsed.limitaciones ?? '',
    relevancia: parsed.relevancia ?? '',
    metodologia: parsed.metodologia ?? '',
    referenciasCitadas: parsed.referenciasCitadas ?? [],
    palabrasClave: parsed.palabrasClave ?? [],
    generadaEn: new Date().toISOString(),
    // Campos ricos
    contextoProduccion: parsed.contextoProduccion ?? '',
    problemaInvestigacion: parsed.problemaInvestigacion ?? '',
    preguntasInvestigacion: parsed.preguntasInvestigacion ?? [],
    objetivos: parsed.objetivos ?? '',
    hipotesis: parsed.hipotesis ?? '',
    marcoTeorico: parsed.marcoTeorico ?? '',
    estructuraArgumental: parsed.estructuraArgumental ?? '',
    evidencias: parsed.evidencias ?? '',
    hallazgos: parsed.hallazgos ?? '',
    debatesControversias: parsed.debatesControversias ?? '',
    aportes: parsed.aportes ?? {},
    relacionOtrasObras: parsed.relacionOtrasObras ?? '',
    utilidadInvestigacion: parsed.utilidadInvestigacion ?? '',
    evaluacionCritica: parsed.evaluacionCritica ?? '',
    notasZettelkasten: parsed.notasZettelkasten ?? [],
  }
}

export async function getFicha(documentoId: string, accessToken: string): Promise<FichaLectura | null> {
  const estructura = await initUserDrive(accessToken)
  const fileId = await findFile(accessToken, `ficha_${documentoId}.json`, estructura.notasId)
  if (!fileId) return null
  return readJSON<FichaLectura>(accessToken, fileId)
}

export async function saveFicha(ficha: FichaLectura, accessToken: string): Promise<void> {
  const estructura = await initUserDrive(accessToken)
  await writeJSON(accessToken, estructura.notasId, `ficha_${ficha.documentoId}.json`, ficha)
}
