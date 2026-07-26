import { useCallback, useEffect, useRef, useState } from 'react'
import { activateCardboardTracking, averageQuaternions, currentScreenOrientationAngle, quaternionAngularDistance, quaternionFromDeviceOrientation, relativeHeadPose, type CardboardHeadPose, type CardboardOrientationSignalSource, type Quaternion } from './cardboardTracking'

export type CardboardTrackingStatus = 'idle' | 'waiting' | 'calibrating' | 'tracking' | 'denied' | 'unavailable' | 'lost'
export type CardboardTrackingFailureReason = 'permission_denied' | 'insecure_context' | 'orientation_api_missing' | 'no_sensor_signal' | 'tracking_lost' | null

export interface CardboardTrackingState {
  status: CardboardTrackingStatus
  pose: CardboardHeadPose | null
  calibrationProgress: number
  recenterCount: number
  trackingLossCount: number
  failureReason: CardboardTrackingFailureReason
}

interface OrientationSample {
  quaternion: Quaternion
  at: number
}

const CALIBRATION_SAMPLE_WINDOW_MILLISECONDS = 300
const PREFERRED_CALIBRATION_MILLISECONDS = 220
const MAXIMUM_CALIBRATION_MILLISECONDS = 600
const MINIMUM_CALIBRATION_SAMPLES = 3
const PREFERRED_CALIBRATION_SPREAD_RADIANS = 18 * Math.PI / 180
const INITIAL_SIGNAL_TIMEOUT_MILLISECONDS = 8_000
const TRACKING_LOSS_MILLISECONDS = 2_500

export function useCardboardHeadTracking(enabled: boolean, calibrationReady = true) {
  const initialStatus: CardboardTrackingStatus = enabled ? calibrationReady ? 'calibrating' : 'waiting' : 'idle'
  const [generation, setGeneration] = useState(0)
  const [state, setState] = useState<CardboardTrackingState>({ status: initialStatus, pose: null, calibrationProgress: 0, recenterCount: 0, trackingLossCount: 0, failureReason: null })
  const statusRef = useRef<CardboardTrackingStatus>(initialStatus)
  const calibrationReadyRef = useRef(calibrationReady)
  const referenceRef = useRef<Quaternion | null>(null)
  const latestRef = useRef<Quaternion | null>(null)
  const samplesRef = useRef<OrientationSample[]>([])
  const lastEventRef = useRef(0)
  const signalWaitStartedAtRef = useRef(-1)
  const signalSourceRef = useRef<CardboardOrientationSignalSource | null>(null)
  const recenterCountRef = useRef(0)
  const lossCountRef = useRef(0)

  const updateStatus = useCallback((status: CardboardTrackingStatus, pose: CardboardHeadPose | null = null, calibrationProgress = 0, failureReason: CardboardTrackingFailureReason = null) => {
    statusRef.current = status
    setState({ status, pose, calibrationProgress, recenterCount: recenterCountRef.current, trackingLossCount: lossCountRef.current, failureReason })
  }, [])

  const beginCalibration = useCallback((countRecenter = false) => {
    if (!enabled || !calibrationReadyRef.current) return updateStatus(enabled ? 'waiting' : 'idle')
    if (countRecenter) recenterCountRef.current += 1
    referenceRef.current = null
    samplesRef.current = []
    lastEventRef.current = 0
    signalWaitStartedAtRef.current = performance.now()
    updateStatus('calibrating')
  }, [enabled, updateStatus])

  const requestAndRecenter = useCallback(async () => {
    const activation = await activateCardboardTracking()
    if (activation.permission === 'denied') return updateStatus('denied', null, 0, 'permission_denied')
    if (activation.permission === 'insecure') return updateStatus('unavailable', null, 0, 'insecure_context')
    if (activation.permission === 'unsupported') return updateStatus('unavailable', null, 0, 'orientation_api_missing')
    if (activation.permission === 'no_signal') return updateStatus('unavailable', null, 0, 'no_sensor_signal')
    signalSourceRef.current = activation.signalSource ?? null
    latestRef.current = null
    referenceRef.current = null
    samplesRef.current = []
    lastEventRef.current = 0
    signalWaitStartedAtRef.current = performance.now()
    updateStatus(calibrationReadyRef.current ? 'calibrating' : 'waiting')
    setGeneration((value) => value + 1)
  }, [updateStatus])

  useEffect(() => {
    calibrationReadyRef.current = calibrationReady
    if (!enabled) {
      signalSourceRef.current = null
      return updateStatus('idle')
    }
    if (!calibrationReady) {
      referenceRef.current = null
      samplesRef.current = []
      updateStatus('waiting')
      return
    }
    beginCalibration(false)
  }, [beginCalibration, calibrationReady, enabled, updateStatus])

  useEffect(() => {
    if (!enabled) return
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      updateStatus('unavailable', null, 0, 'insecure_context')
      return
    }
    if (!window.DeviceOrientationEvent) {
      updateStatus('unavailable', null, 0, 'orientation_api_missing')
      return
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha === null || event.beta === null || event.gamma === null) return
      const source: CardboardOrientationSignalSource = event.type === 'deviceorientationabsolute' ? 'absolute' : 'relative'
      if (signalSourceRef.current && signalSourceRef.current !== source) return
      signalSourceRef.current = source
      const now = performance.now()
      const quaternion = quaternionFromDeviceOrientation(event.alpha, event.beta, event.gamma, currentScreenOrientationAngle())
      latestRef.current = quaternion
      lastEventRef.current = now

      if (statusRef.current === 'waiting' || statusRef.current === 'lost' || statusRef.current === 'unavailable' || statusRef.current === 'denied' || statusRef.current === 'idle') return
      if (statusRef.current === 'calibrating') {
        const samples = [...samplesRef.current, { quaternion, at: now }].filter((sample) => now - sample.at <= CALIBRATION_SAMPLE_WINDOW_MILLISECONDS)
        samplesRef.current = samples
        const sampleElapsed = samples.length > 1 ? samples.at(-1)!.at - samples[0].at : 0
        const calibrationElapsed = Math.max(0, now - signalWaitStartedAtRef.current)
        const average = averageQuaternions(samples.map((sample) => sample.quaternion))
        const maximumSpread = samples.reduce((maximum, sample) => Math.max(maximum, quaternionAngularDistance(average, sample.quaternion)), 0)
        const preferredReferenceReady = (
          samples.length >= MINIMUM_CALIBRATION_SAMPLES
          && sampleElapsed >= PREFERRED_CALIBRATION_MILLISECONDS
          && maximumSpread <= PREFERRED_CALIBRATION_SPREAD_RADIANS
        )
        const deadlineReached = calibrationElapsed >= MAXIMUM_CALIBRATION_MILLISECONDS
        if (!preferredReferenceReady && !deadlineReached) {
          const progress = Math.min(0.98, calibrationElapsed / MAXIMUM_CALIBRATION_MILLISECONDS)
          updateStatus('calibrating', null, progress)
          return
        }
        const reference = preferredReferenceReady ? average : quaternion
        referenceRef.current = reference
        updateStatus('tracking', relativeHeadPose(reference, quaternion, event.absolute === true, now), 1)
        return
      }
      if (referenceRef.current) updateStatus('tracking', relativeHeadPose(referenceRef.current, quaternion, event.absolute === true, now), 1)
    }

    let lastOrientationChangeAt = Number.NEGATIVE_INFINITY
    const handleOrientationChange = () => {
      const now = performance.now()
      if (now - lastOrientationChangeAt < 250) return
      lastOrientationChangeAt = now
      if (calibrationReadyRef.current) beginCalibration(true)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        referenceRef.current = null
        samplesRef.current = []
        updateStatus('waiting')
      } else if (calibrationReadyRef.current) beginCalibration(true)
    }

    window.addEventListener('deviceorientation', handleOrientation)
    window.addEventListener('deviceorientationabsolute', handleOrientation)
    window.addEventListener('orientationchange', handleOrientationChange)
    screen.orientation?.addEventListener?.('change', handleOrientationChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    const monitor = window.setInterval(() => {
      const now = performance.now()
      if (statusRef.current === 'calibrating' && lastEventRef.current === 0 && signalWaitStartedAtRef.current >= 0 && now - signalWaitStartedAtRef.current >= INITIAL_SIGNAL_TIMEOUT_MILLISECONDS) {
        updateStatus('unavailable', null, 0, 'no_sensor_signal')
        return
      }
      if ((statusRef.current === 'tracking' || statusRef.current === 'calibrating') && lastEventRef.current > 0 && now - lastEventRef.current >= TRACKING_LOSS_MILLISECONDS) {
        lossCountRef.current += 1
        referenceRef.current = null
        samplesRef.current = []
        updateStatus('lost', null, 0, 'tracking_lost')
      }
    }, 250)

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
      window.removeEventListener('deviceorientationabsolute', handleOrientation)
      window.removeEventListener('orientationchange', handleOrientationChange)
      screen.orientation?.removeEventListener?.('change', handleOrientationChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.clearInterval(monitor)
    }
  }, [beginCalibration, enabled, generation, updateStatus])

  const recenter = useCallback(() => {
    if (!latestRef.current) return void requestAndRecenter()
    beginCalibration(true)
  }, [beginCalibration, requestAndRecenter])

  return { ...state, recenter, requestAndRecenter }
}
