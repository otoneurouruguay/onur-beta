import { AlertTriangle, CheckCircle2, Glasses, LogOut, Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type * as THREE from 'three'
import type { ExerciseConfig } from '../exercise/types'
import type { SessionAssignmentRecord, SessionEventLogEntry } from '../sessions/repository'
import { buildQuestProceduralPhases, recommendedQuestGeometry, type QuestProceduralExercisePhase } from './questProcedural'
type XrSessionLike = NonNullable<Parameters<THREE.WebXRManager['setSession']>[0]>
type RunnerStatus = 'ready' | 'starting' | 'calibrating' | 'running' | 'paused' | 'reconnect' | 'error' | 'complete'

function hexColor(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

function directionVector(direction: ExerciseConfig['backgroundDirection']): [number, number] {
  const diagonal = Math.SQRT1_2
  const vectors: Partial<Record<ExerciseConfig['backgroundDirection'], [number, number]>> = {
    left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1],
    up_left: [-diagonal, diagonal], up_right: [diagonal, diagonal],
    down_left: [-diagonal, -diagonal], down_right: [diagonal, -diagonal],
    clockwise: [1, 0], counterclockwise: [-1, 0], toward: [1, 0], away: [-1, 0],
  }
  return vectors[direction] ?? [1, 0]
}

function objectDirectionVector(direction: ExerciseConfig['objectDirection']): [number, number] {
  if (direction === 'vertical') return [0, 1]
  if (direction === 'diagonal_down') return [Math.SQRT1_2, -Math.SQRT1_2]
  if (direction === 'diagonal_up') return [Math.SQRT1_2, Math.SQRT1_2]
  return [1, 0]
}

function createTargetCanvas(config: ExerciseConfig) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) return canvas
  context.clearRect(0, 0, 128, 128)
  context.fillStyle = hexColor(config.objectColor, '#ef3e45')
  context.strokeStyle = '#ffffff'
  context.lineWidth = 7
  context.beginPath()
  context.arc(64, 64, 50, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  return canvas
}

interface SceneRuntime {
  root: THREE.Group
  material: THREE.ShaderMaterial | null
  particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null
  target: THREE.Sprite | null
  targetTexture: THREE.CanvasTexture | null
  config: ExerciseConfig
  update: (elapsedSeconds: number) => void
  dispose: () => void
}

function buildSceneRuntime(Three: typeof THREE, scene: THREE.Scene, config: ExerciseConfig): SceneRuntime {
  const root = new Three.Group()
  scene.add(root)
  const disposables: Array<{ dispose: () => void }> = []
  let material: THREE.ShaderMaterial | null = null
  let particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null
  let target: THREE.Sprite | null = null
  let targetTexture: THREE.CanvasTexture | null = null
  const recommended = recommendedQuestGeometry(config)
  const geometryMode = config.purpose === 'custom_free' ? config.questImmersiveGeometry : recommended
  const coverage = geometryMode === 'curved_panel' ? Math.min(90, config.questImmersiveCoverage) : config.questImmersiveCoverage

  scene.background = new Three.Color(hexColor(config.backgroundColor, '#081113'))
  if (geometryMode === 'particle_tunnel') {
    const count = 900
    const positions = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      const angle = ((index * 137.508) % 360) * Math.PI / 180
      const radius = 0.4 + ((index * 47) % 100) / 100 * 7
      positions[index * 3] = Math.cos(angle) * radius
      positions[index * 3 + 1] = Math.sin(angle) * radius
      positions[index * 3 + 2] = -1 - ((index * 83) % 1900) / 100
    }
    const geometry = new Three.BufferGeometry()
    geometry.setAttribute('position', new Three.BufferAttribute(positions, 3))
    const pointsMaterial = new Three.PointsMaterial({ color: hexColor(config.foregroundColor, '#ffffff'), size: 0.055, sizeAttenuation: true })
    particles = new Three.Points(geometry, pointsMaterial)
    root.add(particles)
    disposables.push(geometry, pointsMaterial)
  } else {
    const direction = directionVector(config.backgroundDirection)
    const pattern = config.backgroundType === 'checkerboard' ? 1 : config.backgroundType === 'dots' ? 2 : config.backgroundType === 'spiral' ? 3 : config.backgroundType === 'solid' ? 4 : 0
    material = new Three.ShaderMaterial({
      side: Three.BackSide,
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: new Three.Color(hexColor(config.foregroundColor, '#0a1214')) },
        uColorB: { value: new Three.Color(hexColor(config.backgroundColor, '#f7f6f4')) },
        uCoverage: { value: coverage },
        uVerticalCoverage: { value: geometryMode === 'sphere' ? 180 : 100 },
        uPatternSize: { value: config.questPatternAngularSize },
        uSpeed: { value: config.questBackgroundAngularSpeed },
        uFrequency: { value: config.backgroundFrequencyHz },
        uAmplitude: { value: coverage * config.backgroundAmplitudePercent / 100 },
        uMotionMode: { value: config.backgroundMotionMode === 'oscillating' ? 1 : 0 },
        uDirection: { value: new Three.Vector2(direction[0], direction[1]) },
        uPattern: { value: pattern },
        uContrast: { value: config.backgroundContrastPercent / 100 },
      },
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime; uniform vec3 uColorA; uniform vec3 uColorB;
        uniform float uCoverage; uniform float uVerticalCoverage; uniform float uPatternSize; uniform float uSpeed;
        uniform float uFrequency; uniform float uAmplitude; uniform float uMotionMode;
        uniform vec2 uDirection; uniform float uPattern; uniform float uContrast;
        void main(){
          float movement = uMotionMode > 0.5 ? sin(uTime * 6.2831853 * uFrequency) * uAmplitude : uTime * uSpeed;
          vec2 angular = vec2((vUv.x - 0.5) * uCoverage, (vUv.y - 0.5) * uVerticalCoverage);
          float mask = 0.0;
          if (uPattern > 3.5) {
            gl_FragColor = vec4(uColorB, 1.0);
            return;
          } else if (uPattern < 0.5) {
            mask = step(1.0, mod((dot(angular, uDirection) + movement) / max(1.0, uPatternSize), 2.0));
          } else if (uPattern < 1.5) {
            vec2 shifted = angular + uDirection * movement;
            mask = mod(floor(shifted.x / max(1.0, uPatternSize)) + floor(shifted.y / max(1.0, uPatternSize)), 2.0);
          } else if (uPattern < 2.5) {
            vec2 shifted = angular + uDirection * movement;
            vec2 cell = fract(shifted / max(1.0, uPatternSize)) - 0.5;
            mask = 1.0 - step(0.22, length(cell));
          } else {
            vec2 p = vUv * 2.0 - 1.0;
            float radius = length(p);
            float angle = atan(p.y, p.x);
            float spin = (uDirection.x >= 0.0 ? 1.0 : -1.0) * movement * 0.0174533;
            mask = step(1.0, mod((angle + spin + radius * 15.0) / 3.1415926, 2.0));
          }
          vec3 stimulus = mix(uColorB, uColorA, mask);
          vec3 neutral = mix(uColorA, uColorB, 0.5);
          gl_FragColor = vec4(mix(neutral, stimulus, uContrast), 1.0);
        }
      `,
    })
    let geometry: THREE.BufferGeometry
    if (geometryMode === 'front_disc') {
      geometry = new Three.CircleGeometry(2.75, 96)
      material.side = Three.DoubleSide
      const mesh = new Three.Mesh(geometry, material)
      mesh.position.set(0, 0, -3)
      root.add(mesh)
    } else if (geometryMode === 'sphere') {
      const coverageRadians = Three.MathUtils.degToRad(coverage)
      const phiStart = Math.PI * 1.5 - coverageRadians / 2
      geometry = new Three.SphereGeometry(3, 128, 64, phiStart, coverageRadians, 0.04, Math.PI - 0.08)
      const mesh = new Three.Mesh(geometry, material)
      root.add(mesh)
    } else {
      const coverageRadians = Three.MathUtils.degToRad(coverage)
      geometry = new Three.CylinderGeometry(3, 3, 5.4, 128, 1, true, Math.PI - coverageRadians / 2, coverageRadians)
      const mesh = new Three.Mesh(geometry, material)
      root.add(mesh)
    }
    disposables.push(geometry, material)
  }

  if (config.objectEnabled) {
    targetTexture = new Three.CanvasTexture(createTargetCanvas(config))
    targetTexture.colorSpace = Three.SRGBColorSpace
    const spriteMaterial = new Three.SpriteMaterial({ map: targetTexture, transparent: true, depthTest: false, depthWrite: false })
    target = new Three.Sprite(spriteMaterial)
    target.renderOrder = 20
    const distance = 2.4
    const size = 2 * distance * Math.tan(Three.MathUtils.degToRad(config.questTargetAngularSize) / 2)
    target.scale.set(size, size, 1)
    target.position.set(0, 0, -distance)
    root.add(target)
    disposables.push(spriteMaterial)
  }

  let previousElapsed = 0
  const update = (elapsedSeconds: number) => {
    const frameDelta = Math.max(0, Math.min(0.1, elapsedSeconds - previousElapsed))
    previousElapsed = elapsedSeconds
    if (material) material.uniforms.uTime.value = elapsedSeconds
    if (particles) {
      const attribute = particles.geometry.getAttribute('position') as THREE.BufferAttribute
      const toward = config.backgroundDirection !== 'away'
      const delta = config.questBackgroundAngularSpeed * frameDelta * 0.08
      for (let index = 0; index < attribute.count; index += 1) {
        let z = attribute.getZ(index) + (toward ? delta : -delta)
        if (z > -0.35) z = -20
        if (z < -20) z = -0.4
        attribute.setZ(index, z)
      }
      attribute.needsUpdate = true
    }
    if (!target) return
    const distance = 2.4
    let progress = 0
    if (config.objectMode === 'tracking') {
      const frequency = config.targetBackgroundRelation === 'independent' ? config.objectSpeedHz : config.backgroundFrequencyHz
      const relation = config.targetBackgroundRelation === 'counter_phase' ? -1 : 1
      progress = Math.sin(elapsedSeconds * Math.PI * 2 * frequency) * relation
    } else if (config.objectMode === 'saccades') progress = Math.sin(elapsedSeconds * Math.PI * 2 * config.saccadeFrequencyHz) >= 0 ? 1 : -1
    const saccadeDirection = config.saccadePattern === 'random' ? config.objectDirection : config.saccadePattern
    let [horizontal, vertical] = objectDirectionVector(config.objectMode === 'saccades' ? saccadeDirection : config.objectDirection)
    if (config.objectMode === 'saccades' && config.saccadePattern === 'random') {
      const step = Math.floor(elapsedSeconds * config.saccadeFrequencyHz * 2)
      horizontal = Math.sin(step * 12.9898) >= 0 ? 1 : -1
      vertical = Math.sin(step * 78.233) * 0.65
    }
    const amplitude = Three.MathUtils.degToRad(config.questTargetAmplitudeDegrees * progress)
    const yaw = amplitude * horizontal
    const pitch = amplitude * vertical
    target.position.set(Math.sin(yaw) * Math.cos(pitch) * distance, Math.sin(pitch) * distance, -Math.cos(yaw) * Math.cos(pitch) * distance)
  }

  return {
    root, material, particles, target, targetTexture, config, update,
    dispose: () => {
      scene.remove(root)
      targetTexture?.dispose()
      disposables.forEach((item) => item.dispose())
      root.clear()
    },
  }
}

function formatTime(seconds: number) {
  const rounded = Math.max(0, Math.ceil(seconds))
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`
}

export function QuestProceduralSessionRunner({ session, onFinish, onExit }: {
  session: SessionAssignmentRecord
  onFinish: (activeSeconds: number, skippedExercises: number, eventLog: SessionEventLogEntry[]) => void
  onExit: (activeSeconds: number, skippedExercises: number, eventLog: SessionEventLogEntry[]) => void
}) {
  const phases = useMemo(() => buildQuestProceduralPhases(session.exercises), [session.exercises])
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [remaining, setRemaining] = useState(() => phases[0]?.type === 'exercise' ? phases[0].config.durationSeconds : phases[0]?.seconds ?? 0)
  const [status, setStatus] = useState<RunnerStatus>('ready')
  const [message, setMessage] = useState('El visor está listo para iniciar WebXR.')
  const [controlsVisible, setControlsVisible] = useState(true)
  const [exitOpen, setExitOpen] = useState(false)
  const [headWarning, setHeadWarning] = useState(false)
  const [headWarningCount, setHeadWarningCount] = useState(0)
  const [recenterCount, setRecenterCount] = useState(0)
  const [xrLossCount, setXrLossCount] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const runtimeRef = useRef<SceneRuntime | null>(null)
  const xrSessionRef = useRef<XrSessionLike | null>(null)
  const baselineRef = useRef<THREE.Quaternion | null>(null)
  const headDeviationStartedRef = useRef<number | null>(null)
  const headWarningActiveRef = useRef(false)
  const elapsedRef = useRef(0)
  const activeSecondsRef = useRef(0)
  const phaseActiveSecondsRef = useRef(0)
  const skippedRef = useRef(0)
  const eventLogRef = useRef<SessionEventLogEntry[]>([])
  const finishingRef = useRef(false)
  const hasStartedRef = useRef(false)
  const resumeAfterCalibrationRef = useRef(false)
  const resumeRemainingRef = useRef(0)
  const statusRef = useRef(status)
  const phaseIndexRef = useRef(phaseIndex)
  const phase = phases[phaseIndex]
  statusRef.current = status
  phaseIndexRef.current = phaseIndex

  const rebuildRuntimeRef = useRef<(config: ExerciseConfig) => void>(() => undefined)
  const recenterRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    let disposed = false
    let observer: ResizeObserver | null = null
    void import('three').then((Three) => {
      if (disposed || !containerRef.current) return
      const container = containerRef.current
      let renderer: THREE.WebGLRenderer
      try {
        renderer = new Three.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
      } catch {
        setStatus('error')
        setMessage('Este navegador no pudo iniciar WebGL.')
        return
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
      renderer.setClearColor(0x081113)
      renderer.domElement.className = 'absolute inset-0 block size-full'
      container.prepend(renderer.domElement)
      const scene = new Three.Scene()
      const camera = new Three.PerspectiveCamera(75, 1, 0.05, 100)
      camera.position.set(0, 0, 0)
      rendererRef.current = renderer
      cameraRef.current = camera

      const rebuildRuntime = (config: ExerciseConfig) => {
        runtimeRef.current?.dispose()
        runtimeRef.current = buildSceneRuntime(Three, scene, config)
        if (baselineRef.current) runtimeRef.current.root.quaternion.copy(baselineRef.current)
      }
      rebuildRuntimeRef.current = rebuildRuntime
      const first = phases.find((item): item is QuestProceduralExercisePhase => item.type === 'exercise')
      if (first) rebuildRuntime(first.config)

      const resize = () => {
        const width = Math.max(1, container.clientWidth)
        const height = Math.max(1, container.clientHeight)
        renderer.setSize(width, height, false)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
      }
      observer = new ResizeObserver(resize)
      observer.observe(container)
      resize()

      const currentHeadQuaternion = () => {
        if (!renderer.xr.isPresenting) return null
        return renderer.xr.getCamera().getWorldQuaternion(new Three.Quaternion())
      }
      recenterRef.current = () => {
        const current = currentHeadQuaternion()
        if (!current || !runtimeRef.current) return
        baselineRef.current = current.clone()
        runtimeRef.current.root.quaternion.copy(current)
        headDeviationStartedRef.current = null
        headWarningActiveRef.current = false
        setHeadWarning(false)
        setRecenterCount((count) => count + 1)
      }

      let lastTime = performance.now()
      renderer.setAnimationLoop((time) => {
        const delta = Math.min(0.1, Math.max(0, (time - lastTime) / 1000))
        lastTime = time
        if (statusRef.current === 'running' && phases[phaseIndexRef.current]?.type === 'exercise') elapsedRef.current += delta
        runtimeRef.current?.update(elapsedRef.current)
        const currentPhase = phases[phaseIndexRef.current]
        if (renderer.xr.isPresenting && currentPhase?.type === 'exercise' && currentPhase.config.questHeadStillGuard && baselineRef.current && statusRef.current === 'running') {
          const current = currentHeadQuaternion()
          const deviation = current ? Three.MathUtils.radToDeg(baselineRef.current.angleTo(current)) : 0
          if (deviation > 10) {
            headDeviationStartedRef.current ??= time
            if (!headWarningActiveRef.current && time - headDeviationStartedRef.current >= 1000) {
              headWarningActiveRef.current = true
              setHeadWarning(true)
              setHeadWarningCount((count) => count + 1)
            }
          } else if (deviation < 8) {
            headDeviationStartedRef.current = null
            headWarningActiveRef.current = false
            setHeadWarning(false)
          }
        }
        renderer.render(scene, camera)
      })
    }).catch(() => {
      if (!disposed) {
        setStatus('error')
        setMessage('No fue posible cargar el motor inmersivo.')
      }
    })
    return () => {
      disposed = true
      observer?.disconnect()
      const currentSession = xrSessionRef.current
      xrSessionRef.current = null
      if (currentSession) void currentSession.end().catch(() => undefined)
      rendererRef.current?.setAnimationLoop(null)
      runtimeRef.current?.dispose()
      runtimeRef.current = null
      rendererRef.current?.dispose()
      rendererRef.current?.domElement.remove()
      rendererRef.current = null
    }
  }, [phases])

  useEffect(() => {
    if (!phase || phase.type !== 'exercise') {
      if (runtimeRef.current) runtimeRef.current.root.visible = false
      return
    }
    rebuildRuntimeRef.current(phase.config)
    if (runtimeRef.current) runtimeRef.current.root.visible = true
    elapsedRef.current = 0
  }, [phase])

  const appendExerciseEvent = (completion: 'target_completed' | 'skipped' | 'partial') => {
    const current = phases[phaseIndexRef.current]
    if (!current || current.type !== 'exercise') return
    const seconds = Math.max(0, Math.round(phaseActiveSecondsRef.current))
    activeSecondsRef.current += seconds
    if (completion !== 'target_completed') skippedRef.current += 1
    eventLogRef.current.push({
      type: completion === 'target_completed' ? 'exercise_completed' : completion === 'skipped' ? 'exercise_skipped' : 'exercise_partial',
      at: new Date().toISOString(), exercise_index: current.exerciseIndex, round: current.round,
      exercise_name: current.config.name, exercise_kind: current.config.kind, dose_mode: current.config.doseMode,
      display_mode: current.config.displayMode, viewer_profile: 'quest_webxr', active_seconds: seconds, completion,
      immersive_rendering: 'webxr_6dof', immersive_kind: 'procedural',
      immersive_geometry: current.config.purpose === 'custom_free' ? current.config.questImmersiveGeometry : recommendedQuestGeometry(current.config),
      immersive_coverage_degrees: current.config.questImmersiveCoverage,
      immersive_angular_speed_degrees: current.config.questBackgroundAngularSpeed,
      immersive_pattern_angular_size_degrees: current.config.questPatternAngularSize,
      immersive_target_angular_size_degrees: current.config.objectEnabled ? current.config.questTargetAngularSize : undefined,
      tracking_recenter_count: recenterCount,
      head_deviation_warning_count: headWarningCount,
      xr_session_loss_count: xrLossCount,
    })
    phaseActiveSecondsRef.current = 0
  }

  const moveToPhase = (nextIndex: number) => {
    if (nextIndex >= phases.length) {
      finishingRef.current = true
      setStatus('complete')
      const currentSession = xrSessionRef.current
      xrSessionRef.current = null
      const finish = () => onFinish(activeSecondsRef.current, skippedRef.current, eventLogRef.current)
      if (currentSession) void currentSession.end().catch(() => undefined).finally(finish)
      else finish()
      return
    }
    const next = phases[nextIndex]
    setPhaseIndex(nextIndex)
    phaseIndexRef.current = nextIndex
    setRemaining(next.type === 'exercise' ? next.config.durationSeconds : next.seconds)
    setStatus('running')
    statusRef.current = 'running'
    setControlsVisible(true)
  }

  const completeCurrentPhase = (completion: 'target_completed' | 'skipped' = 'target_completed') => {
    if (phase?.type === 'exercise') appendExerciseEvent(completion)
    moveToPhase(phaseIndex + 1)
  }

  useEffect(() => {
    if (status !== 'running' && status !== 'calibrating') return
    const timer = window.setInterval(() => {
      setRemaining((value) => {
        const next = Math.max(0, value - 0.25)
        if (statusRef.current === 'running' && phases[phaseIndexRef.current]?.type === 'exercise') phaseActiveSecondsRef.current += Math.min(0.25, value)
        return next
      })
    }, 250)
    return () => window.clearInterval(timer)
  }, [phaseIndex, phases, status])

  useEffect(() => {
    if (remaining > 0) return
    if (status === 'calibrating') {
      recenterRef.current()
      hasStartedRef.current = true
      setStatus('running')
      statusRef.current = 'running'
      const current = phases[phaseIndex]
      setRemaining(resumeAfterCalibrationRef.current ? resumeRemainingRef.current : current?.type === 'exercise' ? current.config.durationSeconds : current?.seconds ?? 0)
      resumeAfterCalibrationRef.current = false
      setMessage('Inmersión activa y frente recentrado.')
      return
    }
    if (status === 'running') completeCurrentPhase()
    // completeCurrentPhase depends on current refs; this effect only fires at zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, status])

  const enterImmersion = async () => {
    const renderer = rendererRef.current
    const container = containerRef.current
    const xr = (navigator as Navigator & { xr?: { isSessionSupported: (mode: 'immersive-vr') => Promise<boolean>; requestSession: (mode: 'immersive-vr', options?: object) => Promise<XrSessionLike> } }).xr
    if (!renderer || !container || !xr || !window.isSecureContext) {
      setStatus('error')
      setMessage('Quest necesita HTTPS y Meta Quest Browser con WebXR habilitado.')
      return
    }
    try {
      setStatus('starting')
      setMessage('Solicitando acceso inmersivo…')
      if (!await xr.isSessionSupported('immersive-vr')) throw new Error('unsupported')
      renderer.xr.enabled = true
      renderer.xr.setReferenceSpaceType('local')
      const session = await xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'dom-overlay'],
        domOverlay: { root: container },
      })
      xrSessionRef.current = session
      const preventOverlaySelect = (event: Event) => event.preventDefault()
      container.addEventListener('beforexrselect', preventOverlaySelect)
      session.addEventListener('select', () => {
        if (statusRef.current === 'running') { setStatus('paused'); statusRef.current = 'paused'; setControlsVisible(true) }
        else if (statusRef.current === 'paused') { setStatus('running'); statusRef.current = 'running' }
      })
      session.addEventListener('visibilitychange', () => {
        const visibility = (session as XrSessionLike & { visibilityState?: string }).visibilityState
        if (visibility && visibility !== 'visible' && statusRef.current === 'running') {
          setStatus('paused')
          statusRef.current = 'paused'
          setControlsVisible(true)
          setXrLossCount((count) => count + 1)
          setMessage('Ejecución pausada porque el visor perdió visibilidad.')
        }
      })
      session.addEventListener('end', () => {
        container.removeEventListener('beforexrselect', preventOverlaySelect)
        xrSessionRef.current = null
        if (finishingRef.current) return
        setXrLossCount((count) => count + 1)
        setStatus('reconnect')
        statusRef.current = 'reconnect'
        setMessage('WebXR se cerró. El avance quedó pausado; podés volver a entrar o finalizar como parcial.')
      }, { once: true })
      await renderer.xr.setSession(session)
      resumeAfterCalibrationRef.current = hasStartedRef.current
      resumeRemainingRef.current = remaining
      setRemaining(2)
      setStatus('calibrating')
      statusRef.current = 'calibrating'
      setMessage('Mirá el + de frente: esta dirección será el centro del ejercicio.')
    } catch {
      setStatus('error')
      setMessage('No se pudo iniciar WebXR. Revisá HTTPS, permisos del navegador y que el visor no tenga otra experiencia abierta.')
    }
  }

  const togglePause = () => {
    if (status === 'running') { setStatus('paused'); statusRef.current = 'paused'; setControlsVisible(true) }
    else if (status === 'paused') { setStatus('running'); statusRef.current = 'running'; setMessage('Ejecución reanudada.') }
  }

  const confirmExit = () => {
    if (phase?.type === 'exercise' && phaseActiveSecondsRef.current > 0) appendExerciseEvent('partial')
    eventLogRef.current.push({ type: 'interrupted', at: new Date().toISOString(), active_seconds: activeSecondsRef.current, skipped_exercises: Math.max(1, skippedRef.current) })
    finishingRef.current = true
    const currentSession = xrSessionRef.current
    xrSessionRef.current = null
    const exit = () => onExit(activeSecondsRef.current, Math.max(1, skippedRef.current), eventLogRef.current)
    if (currentSession) void currentSession.end().catch(() => undefined).finally(exit)
    else exit()
  }

  const currentExercise = phase?.type === 'exercise' ? phase.config : null
  const completedExercises = phases.slice(0, phaseIndex).filter((item) => item.type === 'exercise').length
  const totalExercises = phases.filter((item) => item.type === 'exercise').length
  const canEnter = status === 'ready' || status === 'reconnect' || status === 'error'

  return <div ref={containerRef} data-testid="quest-procedural-runner" className="fixed inset-0 z-[140] overflow-hidden bg-[#081113] text-white" onPointerMove={() => setControlsVisible(true)}>
    {canEnter && <div className="absolute inset-0 z-30 grid place-items-center bg-[#071012]/82 p-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-white/12 bg-[#171717]/95 p-7 text-center shadow-2xl">
        <Glasses className="mx-auto text-[#E49A02]" size={52}/>
        <p className="mt-5 text-xs font-black uppercase tracking-[.16em] text-[#E49A02]">Quest · WebXR inmersivo</p>
        <h1 className="mt-3 text-2xl font-black">{status === 'reconnect' ? 'La inmersión quedó pausada' : 'Patrones anclados al entorno'}</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">{message}</p>
        <p className="mt-4 rounded-2xl bg-white/[0.06] p-4 text-xs font-bold leading-5 text-white/75">Sentado, superficie firme y profesional presente. Al entrar, mirá al frente durante 2 segundos. El gatillo del controlador pausa o reanuda; el menú del sistema siempre permite salir de WebXR.</p>
        <button type="button" onClick={() => void enterImmersion()} className="mt-6 h-14 w-full rounded-2xl bg-[#E49A02] px-5 text-sm font-black text-white">{status === 'reconnect' ? 'Volver a entrar y recentrar' : 'Entrar en modo inmersivo'}</button>
        {status === 'reconnect' && <button type="button" onClick={() => setExitOpen(true)} className="mt-3 h-12 w-full rounded-2xl bg-[#c74750] px-5 text-sm font-black text-white">Finalizar como parcial</button>}
      </div>
    </div>}

    {(status === 'starting' || status === 'calibrating') && <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-black/42 text-center">
      <div><div className="mx-auto grid size-16 place-items-center rounded-full border-2 border-white text-3xl font-black">+</div><p className="mt-5 text-sm font-black">{message}</p>{status === 'calibrating' && <p className="mt-2 text-4xl font-black tabular-nums">{Math.max(0, Math.ceil(remaining))}</p>}</div>
    </div>}

    {(status === 'running' || status === 'paused') && <>
      <div className={`absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-5 transition-opacity ${controlsVisible || status === 'paused' ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <div className="max-w-[70vw] rounded-2xl bg-black/55 px-4 py-3 backdrop-blur"><p className="text-xs font-black">{phase?.type === 'rest' ? 'Descanso' : currentExercise?.name}</p><p className="mt-1 text-[10px] leading-4 text-white/70">{phase?.type === 'rest' ? `Próximo: ${phase.nextName}` : currentExercise?.patientInstruction}</p></div>
        <div className="rounded-full bg-black/55 px-4 py-3 text-xs font-black tabular-nums backdrop-blur">{formatTime(remaining)} · {completedExercises + 1}/{totalExercises}</div>
      </div>
      <div className={`absolute inset-x-0 bottom-0 z-30 flex flex-wrap items-center justify-center gap-3 bg-gradient-to-t from-black/82 to-transparent p-7 transition-opacity ${controlsVisible || status === 'paused' ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <button type="button" onClick={togglePause} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-xs font-black text-[#171717]">{status === 'paused' ? <Play size={17}/> : <Pause size={17}/>} {status === 'paused' ? 'Continuar' : 'Pausar'}</button>
        <button type="button" onClick={recenterRef.current} className="inline-flex h-12 items-center gap-2 rounded-full bg-white/16 px-5 text-xs font-black backdrop-blur"><RotateCcw size={17}/> Recentrar</button>
        {phase?.type === 'exercise' && <button type="button" onClick={() => completeCurrentPhase('skipped')} className="inline-flex h-12 items-center gap-2 rounded-full bg-white/16 px-5 text-xs font-black backdrop-blur"><SkipForward size={17}/> Omitir</button>}
        <button type="button" onClick={() => { setStatus('paused'); statusRef.current = 'paused'; setExitOpen(true) }} className="inline-flex h-12 items-center gap-2 rounded-full bg-[#c74750] px-5 text-xs font-black"><LogOut size={17}/> Salir</button>
      </div>
    </>}

    {status === 'paused' && !exitOpen && <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/35"><p className="rounded-2xl bg-black/72 px-5 py-4 text-sm font-black">Ejecución en pausa</p></div>}
    {headWarning && <div role="status" className="absolute left-1/2 top-24 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#8A5B00] px-4 py-3 text-xs font-black shadow-xl"><AlertTriangle size={17}/> Volvé al centro y mantené la cabeza quieta</div>}

    {exitOpen && <div className="absolute inset-0 z-50 grid place-items-center bg-black/78 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center text-[#171717]"><LogOut className="mx-auto text-[#c74750]" size={42}/><h2 className="mt-4 text-xl font-black">¿Salir de la sesión?</h2><p className="mt-3 text-sm leading-6 text-[#747474]">El avance se conservará como parcial y quedará disponible para revisión profesional.</p><button type="button" onClick={confirmExit} className="mt-6 h-12 w-full rounded-2xl bg-[#c74750] text-sm font-black text-white">Salir y guardar parcial</button><button type="button" onClick={() => { setExitOpen(false); setStatus('running'); statusRef.current = 'running' }} className="mt-3 h-12 w-full rounded-2xl border border-[#E9E7E7] text-sm font-black">Continuar la sesión</button></div>
    </div>}

    {status === 'complete' && <div className="absolute inset-0 z-50 grid place-items-center bg-[#071012] p-6"><div className="text-center"><CheckCircle2 className="mx-auto text-[#E49A02]" size={58}/><p className="mt-5 text-xl font-black">Sesión inmersiva completada</p></div></div>}
  </div>
}

export function QuestProceduralExerciseRunner({ config, onClose }: { config: ExerciseConfig; onClose: () => void }) {
  const previewSession: SessionAssignmentRecord = {
    id: 'quest-procedural-preview', patientId: 'preview', patientName: 'Vista previa', treatmentCycleId: 'preview', sessionPlanId: 'preview',
    title: config.name, instructions: config.patientInstruction, mode: 'in_person', exercises: [{ ...config, rounds: 1 }],
    availableFrom: new Date().toISOString(), availableUntil: '', status: 'assigned', createdAt: new Date().toISOString(),
    activeSeconds: 0, completedAt: '', initialDiscomfort: null, finalDiscomfort: null, perceivedDifficulty: null, patientComment: '',
  }
  return <QuestProceduralSessionRunner session={previewSession} onFinish={onClose} onExit={onClose}/>
}
