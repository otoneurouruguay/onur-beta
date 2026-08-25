export type VestibularNarrativeSection = 'conclusion' | 'conduct'

function fold(value: string) {
  return value.toLocaleLowerCase('es-UY').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function labelPattern(section: VestibularNarrativeSection) {
  const label = section === 'conclusion' ? '(?:en\\s+suma|conclusi[oó]n)' : 'co[nm]ducta'
  // Sin dos puntos sólo se considera etiqueta cuando ocupa la línea completa.
  // Así, frases válidas como "Conclusión vestibular literal" o "Conducta
  // expectante" no pierden su primera palabra.
  return new RegExp(`(?:^|[\\r\\n])\\s*${label}\\s*(?::\\s*|(?=[\\r\\n]|$))|\\b${label}\\s*:\\s*`, 'giu')
}

function normalizedKey(value: string) {
  return fold(value).replace(/[^a-z0-9]+/g, ' ').trim()
}

export function deduplicateOcrSentences(value: string) {
  const segments = value.match(/[^.!?;]+(?:[.!?;]+|$)/g) ?? [value]
  const kept: Array<{ text: string; key: string }> = []
  for (const rawSegment of segments) {
    const text = rawSegment.replace(/\s+/g, ' ').trim()
    const key = normalizedKey(text)
    if (!key) continue
    const containedBy = kept.find((item) => item.key === key || item.key.includes(key))
    if (containedBy) continue
    const shorterIndex = kept.findIndex((item) => key.includes(item.key))
    if (shorterIndex >= 0) kept[shorterIndex] = { text, key }
    else kept.push({ text, key })
  }
  return kept.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim()
}

function beforeOtherSection(value: string, section: VestibularNarrativeSection) {
  const stopPatterns = section === 'conclusion'
    ? [labelPattern('conduct')]
    : [/(?:^|[\r\n])\s*(?:observaciones?|firma)\s*:?\s*|\b(?:observaciones?|firma)\s*:\s*/giu]
  let end = value.length
  for (const pattern of stopPatterns) {
    const match = pattern.exec(value)
    if (match?.index !== undefined) end = Math.min(end, match.index)
  }
  const bounded = value.slice(0, end)
  if (section !== 'conclusion') return bounded
  // Algunas pasadas OCR dejan solamente "Cancelación" (inicio de la etiqueta
  // "Cancelación del VOR") pegado justo antes de "Conducta:". Es un fragmento
  // estructural incompleto, no contenido clínico, y no debe cerrar la conclusión.
  return bounded.replace(/\bcancelaci[oó]n[\s:;,.-–—]*$/iu, '').trimEnd()
}

function informationScore(value: string) {
  const words = normalizedKey(value).split(' ').filter((word) => word.length > 2)
  return new Set(words).size * 1000 + value.length
}

/**
 * Limpia únicamente artefactos estructurales del OCR: etiquetas de sección,
 * bloques superpuestos y frases idénticas. No corrige ni interpreta contenido
 * clínico.
 */
export function sanitizeVestibularNarrative(value: string, section: VestibularNarrativeSection) {
  const bounded = beforeOtherSection(value, section).trim()
  if (!bounded) return ''
  const candidates = bounded.split(labelPattern(section))
    .map((candidate) => deduplicateOcrSentences(candidate.replace(/^[\s:;,.\-–—]+/, '').trim()))
    .filter(Boolean)
  if (!candidates.length) return ''
  return candidates.sort((first, second) => informationScore(second) - informationScore(first))[0]
}
