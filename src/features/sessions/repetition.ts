import type { SessionAssignmentRecord } from './repository'

export type RepetitionScheduleMode = 'once' | 'consecutive' | 'custom'

export interface RepetitionScheduleValues {
  mode: RepetitionScheduleMode
  startDate: string
  count: number
  customDates: string[]
}

export interface SessionAssignmentGroup {
  id: string
  seriesId: string
  assignments: SessionAssignmentRecord[]
  expectedCount: number
  realizedCount: number
}

const CLINIC_TIME_ZONE = 'America/Montevideo'
export const MAX_REPETITION_DATES = 35

export function clinicDateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const parsed = parseDateKey(dateKey)
  if (!parsed) return ''
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

export function consecutiveDateKeys(startDate: string, count: number) {
  if (!parseDateKey(startDate) || !Number.isInteger(count) || count < 1 || count > MAX_REPETITION_DATES) return []
  return Array.from({ length: count }, (_, index) => addDaysToDateKey(startDate, index))
}

export function repetitionScheduleDates(values: RepetitionScheduleValues) {
  if (values.mode === 'custom') return normalizeDateKeys(values.customDates)
  if (values.mode === 'consecutive') return consecutiveDateKeys(values.startDate, values.count)
  return normalizeDateKeys([values.startDate])
}

export function validateRepetitionDates(dates: string[], today = clinicDateKey()) {
  if (dates.length === 0) return 'Elegí al menos una fecha para la nueva sesión.'
  if (dates.length > MAX_REPETITION_DATES) return `Podés programar hasta ${MAX_REPETITION_DATES} sesiones por vez.`
  if (dates.some((date) => !parseDateKey(date))) return 'Hay una fecha que no es válida.'
  if (new Set(dates).size !== dates.length) return 'No se puede programar dos veces la misma fecha dentro de una serie.'
  if (dates.some((date) => date < today)) return 'Las nuevas sesiones deben programarse desde hoy en adelante.'
  return ''
}

export function groupSessionAssignments(assignments: SessionAssignmentRecord[]): SessionAssignmentGroup[] {
  const groups: SessionAssignmentGroup[] = []
  const seriesIndexes = new Map<string, number>()

  for (const assignment of assignments) {
    const seriesId = assignment.repeatSeriesId ?? ''
    if (!seriesId) {
      groups.push({ id: assignment.id, seriesId: '', assignments: [assignment], expectedCount: 1, realizedCount: isRealized(assignment) ? 1 : 0 })
      continue
    }

    const existingIndex = seriesIndexes.get(seriesId)
    if (existingIndex == null) {
      seriesIndexes.set(seriesId, groups.length)
      groups.push({
        id: `series-${seriesId}`,
        seriesId,
        assignments: [assignment],
        expectedCount: Math.max(assignment.repeatSeriesSize ?? 1, 1),
        realizedCount: isRealized(assignment) ? 1 : 0,
      })
      continue
    }

    const group = groups[existingIndex]
    group.assignments.push(assignment)
    group.expectedCount = Math.max(group.expectedCount, assignment.repeatSeriesSize ?? group.assignments.length)
    if (isRealized(assignment)) group.realizedCount += 1
  }

  for (const group of groups) {
    if (!group.seriesId) continue
    group.assignments.sort((first, second) => (first.repeatSeriesPosition ?? 0) - (second.repeatSeriesPosition ?? 0) || first.availableFrom.localeCompare(second.availableFrom))
  }

  return groups
}

function normalizeDateKeys(dates: string[]) {
  return [...new Set(dates.filter((date) => parseDateKey(date)))].sort()
}

function parseDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null
  return parsed
}

function isRealized(assignment: SessionAssignmentRecord) {
  return assignment.status === 'completed' || assignment.status === 'partial'
}
