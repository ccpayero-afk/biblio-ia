import { PDFDocument, PDFDict, PDFName, PDFArray, PDFNumber, PDFString, PDFHexString, PDFRef } from 'pdf-lib'
import { join } from 'path'

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

// Parse RC (RichContent) XML field — strip tags to get plain text
function decodeRichContent(obj: unknown): string {
  const raw = decodeString(obj)
  if (!raw) return ''
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
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

interface PdfjsTextItem {
  str: string
  x: number  // left edge in PDF user space
  y: number  // baseline y in PDF user space (bottom-up)
  w: number  // width
  h: number  // height
}

// Use pdfjs-dist to extract text items with positions for each page.
// Returns empty map if pdfjs is unavailable (graceful fallback).
async function buildPageTextMap(buffer: ArrayBuffer): Promise<Map<number, PdfjsTextItem[]>> {
  const map = new Map<number, PdfjsTextItem[]>()
  try {
    const pdfjsLib = await import('pdfjs-dist')

    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      const workerPath = join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.mjs')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`
    }

    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer.slice(0)),
      isEvalSupported: false,
    }).promise

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const items: PdfjsTextItem[] = []

      for (const raw of textContent.items) {
        if (!('str' in raw) || !(raw as { str: string }).str.trim()) continue
        const item = raw as { str: string; transform: number[]; width: number; height: number }
        items.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          w: item.width,
          h: item.height || 10,
        })
      }

      map.set(pageNum, items)
      page.cleanup()
    }

    await pdf.destroy()
  } catch { /* pdfjs unavailable or failed — proceed without text map */ }
  return map
}

// Intersect annotation QuadPoints with pdfjs text items to recover highlighted text.
// QuadPoints and text items are both in PDF user space (bottom-left origin, y up).
function textFromQuadPoints(quadArr: PDFArray, pageItems: PdfjsTextItem[]): string {
  const qp: number[] = []
  for (let k = 0; k < quadArr.size(); k++) {
    const v = quadArr.get(k)
    qp.push(v instanceof PDFNumber ? v.asNumber() : 0)
  }
  if (qp.length < 8 || pageItems.length === 0) return ''

  const collected: string[] = []

  for (let i = 0; i + 7 < qp.length; i += 8) {
    // QuadPoints: (x1,y1),(x2,y2),(x3,y3),(x4,y4) — 4 corners of highlight quad
    const minX = Math.min(qp[i], qp[i + 2], qp[i + 4], qp[i + 6]) - 1
    const maxX = Math.max(qp[i], qp[i + 2], qp[i + 4], qp[i + 6]) + 1
    const minY = Math.min(qp[i + 1], qp[i + 3], qp[i + 5], qp[i + 7]) - 1
    const maxY = Math.max(qp[i + 1], qp[i + 3], qp[i + 5], qp[i + 7]) + 1

    for (const item of pageItems) {
      const iLeft = item.x
      const iRight = item.x + item.w
      const iBottom = item.y
      const iTop = item.y + item.h

      if (iLeft < maxX && iRight > minX && iBottom < maxY && iTop > minY) {
        if (!collected.includes(item.str)) {
          collected.push(item.str)
        }
      }
    }
  }

  return collected.join(' ').trim()
}

export async function extractAnnotations(pdfBuffer: ArrayBuffer): Promise<AnnotationExtraida[]> {
  let pdfDoc: PDFDocument
  try {
    pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
  } catch {
    return []
  }

  // Pre-build text map so we can extract highlighted text for annotations without /Contents
  const pageTextMap = await buildPageTextMap(pdfBuffer)

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

        const subtypeRaw = annot.get(PDFName.of('Subtype'))
        if (!subtypeRaw) continue
        const subtypeStr = subtypeRaw.toString().replace('/', '')
        if (!TIPOS_SOPORTADOS.has(subtypeStr)) continue
        const tipo = subtypeStr as AnnotationExtraida['tipo']

        // Try all possible text fields in order of reliability
        let texto = decodeString(annot.get(PDFName.of('Contents'))).trim()
        if (!texto) texto = decodeRichContent(annot.get(PDFName.of('RC')))
        if (!texto) texto = decodeString(annot.get(PDFName.of('T'))).trim()

        // Last resort: use QuadPoints + pdfjs text extraction
        if (!texto) {
          const quadRaw = annot.get(PDFName.of('QuadPoints'))
          const quadArr = resolveArray(pdfDoc, quadRaw)
          if (quadArr) {
            const pageItems = pageTextMap.get(i + 1) ?? []
            texto = textFromQuadPoints(quadArr, pageItems)
          }
        }

        if (!texto) continue

        // Color
        let color: AnnotationExtraida['color'] = 'amarillo'
        const colorRaw = annot.get(PDFName.of('C'))
        const colorArr = resolveArray(pdfDoc, colorRaw)
        if (colorArr) color = colorDesdeArray(colorArr)

        // Rect for position metadata
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
      } catch { /* skip malformed annotation */ }
    }
  }

  return annotations
}
