import { FichaLectura, Fragmento } from '@/types'
import { generateWithRotation, GEMINI_MODEL_GENERATION } from './gemini'
import { initUserDrive, findFile, readJSON, writeJSON } from './drive'
import { cosineSimilarity } from './indexer'
import { leerIndice } from './notas'

// ── MMR-based diverse fragment selection ──────────────────────────────────────
// Picks fragments that collectively cover the maximum semantic territory of the doc.
// Always anchors at intro + conclusion; fills the middle via greedy MMR.

function seleccionarFragmentosMMR(todos: Fragmento[], n: number): Fragmento[] {
  if (todos.length <= n) return todos

  const introN = 3
  const conclusionN = 3
  const cuerpoN = n - introN - conclusionN

  const intro = todos.slice(0, introN)
  const conclusion = todos.slice(-conclusionN)
  const pool = todos.slice(introN, todos.length - conclusionN)

  if (cuerpoN <= 0 || pool.length === 0) {
    return [...intro, ...conclusion].sort((a, b) => a.pagina - b.pagina)
  }

  const conEmb = pool.filter((f) => f.embedding?.length > 0)

  if (conEmb.length < Math.ceil(cuerpoN * 0.5)) {
    // Not enough embeddings — equidistant fallback
    const step = Math.max(1, Math.floor(pool.length / cuerpoN))
    const cuerpo = Array.from({ length: Math.min(cuerpoN, pool.length) }, (_, i) => pool[i * step])
    return [...intro, ...cuerpo, ...conclusion].sort((a, b) => a.pagina - b.pagina)
  }

  // Greedy MMR: each iteration picks the fragment most dissimilar to all already selected
  const selected: Fragmento[] = [...intro]
  const candidates = [...pool]

  while (selected.length - introN < cuerpoN && candidates.length > 0) {
    let bestIdx = 0
    let lowestMaxSim = Infinity

    for (let i = 0; i < candidates.length; i++) {
      const emb = candidates[i].embedding
      if (!emb?.length) continue
      const selectedWithEmb = selected.filter((s) => s.embedding?.length)
      if (selectedWithEmb.length === 0) { bestIdx = i; break }
      const maxSim = Math.max(...selectedWithEmb.map((s) => cosineSimilarity(s.embedding, emb)))
      if (maxSim < lowestMaxSim) {
        lowestMaxSim = maxSim
        bestIdx = i
      }
    }
    selected.push(candidates.splice(bestIdx, 1)[0])
  }

  return [...selected, ...conclusion].sort((a, b) => a.pagina - b.pagina)
}

// ── Related notes context (keyword overlap on index — zero extra Drive calls) ──

async function buscarNotasRelacionadas(
  muestra: Fragmento[],
  accessToken: string
): Promise<string> {
  try {
    const { indice } = await leerIndice(accessToken)
    const elegibles = indice.filter(
      (n) => n.tipo === 'permanente' || n.tipo === 'referencia' || n.tipo === 'estructura'
    )
    if (elegibles.length === 0) return ''

    const texto = muestra.map((f) => f.texto.toLowerCase()).join(' ')
    const palabras = new Set(texto.split(/\W+/).filter((w) => w.length > 4))

    const conScore = elegibles
      .map((n) => {
        const haystack = `${n.titulo} ${(n.etiquetas ?? []).join(' ')}`.toLowerCase()
        const score = [...palabras].filter((p) => haystack.includes(p)).length
        return { n, score }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)

    if (conScore.length === 0) return ''

    return conScore
      .map(({ n }) =>
        `- "${n.titulo}"${n.etiquetas?.length ? ` [${n.etiquetas.slice(0, 3).join(', ')}]` : ''}`
      )
      .join('\n')
  } catch {
    return ''
  }
}

// ── Main ficha generator ──────────────────────────────────────────────────────

export async function generateFicha(
  documentoId: string,
  documentoNombre: string,
  autor: string,
  año: string,
  fragmentos: Fragmento[],
  accessToken: string
): Promise<FichaLectura> {

  const todos = fragmentos.filter((f) => f.documentoId === documentoId)
  const N = 25  // increased from 20 for better coverage
  const muestra = seleccionarFragmentosMMR(todos, N)

  // Run notes lookup in parallel with nothing — it's a fast local op
  const notasRelacionadasStr = await buscarNotasRelacionadas(muestra, accessToken)

  const muestraTexto = muestra
    .map((f) => `[p.${f.pagina}] ${f.texto.slice(0, 1000)}`)  // increased from 600
    .join('\n\n')

  const titulo = documentoNombre.replace(/\.pdf$/i, '')

  const notasCtx = notasRelacionadasStr
    ? `\nNOTAS EXISTENTES DEL INVESTIGADOR RELACIONADAS CON ESTE TEXTO:\n${notasRelacionadasStr}\n`
    : ''

  const prompt = `Analizá el siguiente texto académico y generá una ficha de lectura académica completa.

DOCUMENTO: "${titulo}" por ${autor || 'Autor desconocido'} (${año || 's.f.'})

FRAGMENTOS SELECCIONADOS (${muestra.length} de ${todos.length} — selección MMR para máxima cobertura temática):
${muestraTexto}
${notasCtx}
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
  "notasZettelkasten": ["Idea atómica 1 formulada como afirmación propia del investigador", "Idea atómica 2"],
  "datosEstadisticos": [
    { "valor": "el dato numérico, porcentaje o estadística exacta tal como aparece en el texto", "contexto": "qué mide o significa ese dato, marco temporal/espacial, a qué población o fenómeno refiere", "tematica": "una de las temáticas del listado", "pagina": 1 }
  ],
  "referenciasCitadas": ["Apellido, Nombre (año). Título. Editorial/Revista"]
}

REGLAS:
- Si algún campo no aplica al texto, devolvé null o [] según corresponda.
- datosEstadisticos: incluí SOLO datos con número, porcentaje, cifra o estadística concreta. Si no hay, devolvé [].
- tematica en datosEstadisticos DEBE ser una de: pobreza, desigualdad, riqueza, deuda, trabajo, empleo, salario, poblacion, educacion, salud, vivienda, genero, migracion, economia, finanzas, comercio, industria, agricultura, medio-ambiente, politica, violencia, otro.
- notasZettelkasten: formulá cada idea como afirmación propia del investigador (primera persona o forma afirmativa directa), no como resumen del texto. Si alguna idea conecta con las notas relacionadas listadas arriba, mencioná el título de esa nota entre doble corchete, por ejemplo: [[Título de la nota existente]].
- referenciasCitadas: reconstruí cada referencia lo más completa posible a partir del texto. Si la referencia está incompleta en los fragmentos, completá con "s.d." los campos faltantes.`

  const result = await generateWithRotation(accessToken, async (genAI) => {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_GENERATION })
    return model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 1, thinkingConfig: { thinkingBudget: 0 } } as never,
    })
  })
  let text = result.response.text().trim()

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
