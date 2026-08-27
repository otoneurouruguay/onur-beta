import type { PatientRecord } from '../patients/repository'
import { assessmentComparison, type AssessmentRecord } from '../assessments/repository'
import { sessionDurationSeconds, type AssignmentStatus, type SessionAssignmentRecord } from '../sessions/repository'

export type StatisticsPeriod = '30' | '90' | 'all'

export interface StatisticsFilters {
  period: StatisticsPeriod
  patientId: string
  now?: Date
}

const realizedStatuses: AssignmentStatus[] = ['completed', 'partial']
const statusOrder = ['completed', 'partial', 'assigned', 'started', 'interrupted', 'omitted'] as const satisfies readonly AssignmentStatus[]

function cutoffFor(period: StatisticsPeriod, now: Date) {
  if (period === 'all') return null
  const cutoff = new Date(now)
  cutoff.setUTCDate(cutoff.getUTCDate() - Number(period))
  return cutoff
}

function inRange(value: string, cutoff: Date | null, now: Date) {
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) && timestamp <= now.getTime() && (!cutoff || timestamp >= cutoff.getTime())
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('es-UY', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function buildProfessionalStatistics(assignments: SessionAssignmentRecord[], assessments: AssessmentRecord[], patients: PatientRecord[], filters: StatisticsFilters) {
  const now = filters.now ?? new Date()
  const cutoff = cutoffFor(filters.period, now)
  const sessions = assignments.filter((item) => item.status !== 'revoked' && (!filters.patientId || item.patientId === filters.patientId) && inRange(item.availableFrom || item.createdAt, cutoff, now))
  const evaluationItems = assessments.filter((item) => (!filters.patientId || item.patientId === filters.patientId) && inRange(item.completedAt || item.assignedAt, cutoff, now))
  const realized = sessions.filter((item) => realizedStatuses.includes(item.status))
  const completed = sessions.filter((item) => item.status === 'completed').length
  const partial = sessions.filter((item) => item.status === 'partial').length
  const totalActiveSeconds = realized.reduce((sum, item) => sum + item.activeSeconds, 0)
  const progressValues = realized.map((item) => {
    const planned = sessionDurationSeconds(item)
    return planned > 0 ? Math.min(1, item.activeSeconds / planned) : null
  }).filter((value): value is number => value !== null)

  const statusRows = statusOrder.map((status) => ({ status, count: sessions.filter((item) => item.status === status).length })).filter((item) => item.count > 0)
  const monthMap = new Map<string, { assigned: number; realized: number }>()
  sessions.forEach((item) => {
    const date = new Date(item.availableFrom || item.createdAt)
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    const current = monthMap.get(key) ?? { assigned: 0, realized: 0 }
    current.assigned += 1
    if (realizedStatuses.includes(item.status)) current.realized += 1
    monthMap.set(key, current)
  })
  const activityByMonth = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([key, values]) => ({ key, label: monthLabel(key), ...values }))

  const assessmentComparisons = [...new Set(evaluationItems.map((item) => `${item.patientId}:${item.treatmentCycleId}`))].flatMap((group) => {
    const [patientId, treatmentCycleId] = group.split(':')
    const comparison = assessmentComparison(assessments.filter((item) => item.patientId === patientId), treatmentCycleId)
    if (!comparison || !inRange(comparison.final.completedAt, cutoff, now)) return []
    const patientName = patients.find((patient) => patient.id === patientId)?.fullName || comparison.final.patientName || 'Paciente'
    return [{ patientId, patientName, treatmentCycleId, initialDate: comparison.initial.assessmentDate, finalDate: comparison.final.assessmentDate, initialTotal: comparison.initialTotal, finalTotal: comparison.finalTotal, difference: comparison.difference, maximumScore: comparison.maximumScore, comparedCount: 25 }]
  }).sort((a, b) => b.finalDate.localeCompare(a.finalDate))

  const patientIds = new Set([...sessions.map((item) => item.patientId), ...evaluationItems.map((item) => item.patientId)])
  const patientRows = [...patientIds].map((patientId) => {
    const patientSessions = sessions.filter((item) => item.patientId === patientId)
    const patientRealized = patientSessions.filter((item) => realizedStatuses.includes(item.status))
    const latestComparison = assessmentComparisons.find((item) => item.patientId === patientId)
    const patient = patients.find((item) => item.id === patientId)
    return {
      patientId,
      patientName: patient?.fullName || patientSessions[0]?.patientName || evaluationItems.find((item) => item.patientId === patientId)?.patientName || 'Paciente',
      assigned: patientSessions.length,
      realized: patientRealized.length,
      partial: patientSessions.filter((item) => item.status === 'partial').length,
      activeMinutes: Math.round(patientRealized.reduce((sum, item) => sum + item.activeSeconds, 0) / 60),
      realizationRate: patientSessions.length ? Math.round(patientRealized.length / patientSessions.length * 100) : null,
      questionnaireDifference: latestComparison?.difference ?? null,
      lastActivity: [...patientSessions.map((item) => item.completedAt || item.availableFrom), ...evaluationItems.filter((item) => item.patientId === patientId).map((item) => item.completedAt || item.assignedAt)].filter(Boolean).sort().at(-1) ?? '',
    }
  }).sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))

  return {
    totals: {
      sessions: sessions.length,
      realized: realized.length,
      completed,
      partial,
      pending: sessions.filter((item) => item.status === 'assigned' || item.status === 'started').length,
      interruptedOrOmitted: sessions.filter((item) => item.status === 'interrupted' || item.status === 'omitted').length,
      activeMinutes: Math.round(totalActiveSeconds / 60),
      realizationRate: sessions.length ? Math.round(realized.length / sessions.length * 100) : 0,
      averageActiveProgress: progressValues.length ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length * 100) : null,
      evaluations: evaluationItems.length,
      completeEvaluations: evaluationItems.filter((item) => item.status === 'completed').length,
    },
    modes: {
      home: sessions.filter((item) => item.mode === 'home').length,
      inPerson: sessions.filter((item) => item.mode === 'in_person').length,
    },
    statusRows,
    activityByMonth,
    assessmentComparisons,
    patientRows,
  }
}
