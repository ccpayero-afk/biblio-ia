import { PDFDocument, PDFDict, PDFName, PDFArray, PDFNumber, PDFString, PDFHexString, PDFRef } from 'pdf-lib'

export interface AnnotationExtraida {
  texto: string
  pagina: number
  color: 'amarillo' | 'azul' | 'verde' | 'rojo' | 'otro'
  nota?: string
  rect: number[]
  tipo: 'Highlight' | 'Underline' | 'StrikeOut' | 'Note'
}

const TIPOS_SOPORTADOS = new Set(['Highlight', 'Underline', 'StrikeOut', 'Note'])

function resolveDict(pdfDoc: PDFDocument, obj: unknown): PDFDict | undefined {
  if (obj instanceof PDFDict) return obj
  if (obj instanceof PDFRef) {
    try {
      const resolved = pdfDoc.context.lookup(obj)
      if (resolved instanceof PDFDict) return resolved
    } catch { /* noop */ }
  }
  return undefined
}

function resolveArray(pdfDoc: PDFDocument, obj: unknown): PDFArray | undefined {
  if (obj instanceof PDFArray) return obj
  if (obj instanceof PDFRef) {
    try {
      const resolved = pdfDoc.context.lookup(obj)
      if (resolved instanceof PDFArray) return resolved
    } catch { /* noop */ }
  }
  return undefined
}

function decodeString(obj: unknown): string {
  if (obj instanceof PDFString) return obj.decodeText()
  if (obj instanceof PDFHexString) return obj.decodeText()
  return ''
}

function colorDesdeArray(arr: PDFArray): 'amarillo' | 'azul' | 'verde' | 'rojo' | 'otro' {
  if (arr.size() < 3) return 'amarillo'
  const r = arr.get(0) instanceof PDFNumber ? (arr.get(0) as PDFNumber).asNumber() : 0
  const g = arr.get(1) instanceof PDFNumber ? (arr.get(1) as PDFNumber).asNumber() : 0
  const b = arr.get(2) instanceof PDFNumber ? (arr.get(2) as PDFNumber).asNumber() : 0
  if (r > 0.6 && g > 0.6 && b < 0.4) return 'amarillo'
  if (r < 0.4 && g < 0.4 && b > 0.5) return 'azul'
  if (r < 0.4 && g > 0.5 && b < 0.4) return 'verde'
  if (r > 0.5 && g < 0.4 && b < 0.4) return 'rojo'
  return 'otro'
}

export async function extractAnnotations(pdfBuffer: ArrayBuffer): Promise<AnnotationExtraida[]> {
  let pdfDoc: PDFDocument
  try {
    pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
  } catch {
    return []
  }

  const pages = pdfDoc.getPages()
  const annotations: AnnotationExtraida[] = []

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const annotsRaw = page.node.get(PDFName.of('Annots'))
    if (!annotsRaw) continue

    const annotsArray = resolveArray(pdfDoc, annotsRaw)
    if (!annotsArray) continue

    for (let j = 0; j < annotsArray.size(); j++) {
      try {
        const annot = resolveDict(pdfDoc, annotsArray.get(j))
        if (!annot) continue

        // Verificar subtipo
        const subtypeRaw = annot.get(PDFName.of('Subtype'))
        if (!subtypeRaw) continue
        const subtypeStr = subtypeRaw.toString().replace('/', '')
        if (!TIPOS_SOPORTADOS.has(subtypeStr)) continue
        const tipo = subtypeStr as AnnotationExtraida['tipo']

        // Intentar obtener texto desde Contents
        const texto = decodeString(annot.get(PDFName.of('Contents'))).trim()
        if (!texto) continue // Sin texto, skip (ver nota técnica abajo)

        // Color del highlight
        let color: AnnotationExtraida['color'] = 'amarillo'
        const colorRaw = annot.get(PDFName.of('C'))
        const colorArr = resolveArray(pdfDoc, colorRaw)
        if (colorArr) color = colorDesdeArray(colorArr)

        // Rect para posición
        const rectRaw = annot.get(PDFName.of('Rect'))
        const rectArr = resolveArray(pdfDoc, rectRaw)
        const rect: number[] = []
        if (rectArr) {
          for (let k = 0; k < Math.min(4, rectArr.size()); k++) {
            const v = rectArr.get(k)
            rect.push(v instanceof PDFNumber ? v.asNumber() : 0)
          }
        }

        annotations.push({ texto, pagina: i + 1, color, rect, tipo })
      } catch { /* skip anotación malformada */ }
    }
  }

  return annotations
}

// Nota: Las anotaciones tipo Highlight almacenan el texto resaltado en /Contents.
// Adobe, Zotero, PDF Expert sí lo guardan ahí.
// macOS Preview NO guarda el texto en /Contents para highlights simples — solo para notas.
// En ese caso esta función retorna 0 anotaciones (comportamiento esperado).
