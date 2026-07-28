import { LogOut, Pause, Play, RotateCcw, Scan } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type * as THREE from 'three'
import { smoothCardboardHeadPose, type CardboardHeadPose } from '../exercise/cardboardTracking'
import { cardboardEyeProjectionFrustum, defaultCardboardViewerProfile, type CardboardEye, type CardboardViewerProfile } from '../exercise/cardboardViewerProfiles'
import { immersiveMediaUrl, type ImmersiveDevice, type ImmersiveScenario } from './catalog'

interface ImmersivePanoramaProps {
  scenario: ImmersiveScenario
  device?: ImmersiveDevice
  paused?: boolean
  headPose?: CardboardHeadPose | null
  viewerProfile?: CardboardViewerProfile
  controlsVisible?: boolean
  canEnterImmersion?: boolean
  formattedTime?: string
  className?: string
  onImmersionChange?: (active: boolean) => void
  onTogglePause?: () => void
  onExit?: () => void
}

type XrSessionLike = NonNullable<Parameters<THREE.WebXRManager['setSession']>[0]>

export function ImmersivePanorama({ scenario, device, paused = false, headPose = null, viewerProfile, controlsVisible = true, canEnterImmersion = true, formattedTime, className = '', onImmersionChange, onTogglePause, onExit }: ImmersivePanoramaProps) {
  const onDemand = device === undefined
  const [activated, setActivated] = useState(!onDemand)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const xrSessionRef = useRef<XrSessionLike | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const pausedRef = useRef(paused)
  const headPoseRef = useRef(headPose)
  const onImmersionChangeRef = useRef(onImmersionChange)
  const [status, setStatus] = useState<'loading' | 'ready' | 'xr_active' | 'unsupported' | 'error'>('loading')
  const [message, setMessage] = useState('Preparando escenario 360°…')
  const [manualView, setManualView] = useState({ yaw: 0, pitch: 0 })
  const manualViewRef = useRef(manualView)

  useEffect(() => {
    pausedRef.current = paused
    if (!videoRef.current) return
    if (paused) videoRef.current.pause()
    else void videoRef.current.play().catch(() => undefined)
  }, [paused])
  useEffect(() => { headPoseRef.current = headPose }, [headPose])
  useEffect(() => { onImmersionChangeRef.current = onImmersionChange }, [onImmersionChange])
  useEffect(() => { manualViewRef.current = manualView }, [manualView])

  useEffect(() => {
    if (!activated) return
    let disposed = false
    let release: (() => void) | undefined
    void import('three').then((THREE) => {
      if (disposed) return
      const container = containerRef.current
      if (!container) return
      let renderer: THREE.WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({ antialias: device === 'quest', alpha: false, powerPreference: 'high-performance' })
      } catch {
        setStatus('error')
        setMessage('Este navegador no pudo iniciar WebGL para mostrar la esfera 360°.')
        return
      }
    rendererRef.current = renderer
    renderer.setPixelRatio(onDemand ? 1 : Math.min(window.devicePixelRatio || 1, device === 'vr_box' ? 1.25 : 1.5))
    renderer.setClearColor(0x081113)
    renderer.domElement.className = 'block size-full'
    container.prepend(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(viewerProfile?.verticalFovDegrees ?? 75, 2, 0.1, 200)
    camera.position.set(0, 0, 0.01)
    const geometry = new THREE.SphereGeometry(100, 48, 32)
    geometry.scale(-1, 1, 1)
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const sphere = new THREE.Mesh(geometry, material)
    sphere.rotation.y = -Math.PI / 2
    scene.add(sphere)

    const opticalProfile = viewerProfile ?? defaultCardboardViewerProfile
    const eyeTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    })
    const distortionScene = new THREE.Scene()
    const distortionCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const distortionGeometry = new THREE.PlaneGeometry(2, 2)
    const distortionMaterial = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        sourceTexture: { value: eyeTarget.texture },
        distortionStrength: { value: opticalProfile.lensDistortionPercent / 100 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D sourceTexture;
        uniform float distortionStrength;
        varying vec2 vUv;
        void main() {
          vec2 centered = vUv * 2.0 - 1.0;
          float radiusSquared = dot(centered, centered);
          float radialScale = 1.0 + distortionStrength * radiusSquared + distortionStrength * 0.35 * radiusSquared * radiusSquared;
          vec2 sampleUv = centered * radialScale * 0.5 + 0.5;
          if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          } else {
            gl_FragColor = texture2D(sourceTexture, sampleUv);
          }
        }
      `,
    })
    distortionScene.add(new THREE.Mesh(distortionGeometry, distortionMaterial))

    let texture: THREE.Texture | null = null
    const mediaUrl = immersiveMediaUrl(scenario, device ?? 'vr_box')
    if (!mediaUrl) {
      setStatus('error')
      setMessage('La biblioteca 360° necesita la conexión de almacenamiento configurada.')
    } else if (scenario.mediaKind === 'image') {
      new THREE.TextureLoader().load(mediaUrl, (loaded) => {
        if (disposed) {
          loaded.dispose()
          return
        }
        loaded.colorSpace = THREE.SRGBColorSpace
        loaded.minFilter = THREE.LinearMipmapLinearFilter
        loaded.magFilter = THREE.LinearFilter
        loaded.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
        texture = loaded
        material.map = loaded
        material.needsUpdate = true
        setStatus('ready')
        setMessage('Escenario listo.')
      }, undefined, () => {
        setStatus('error')
        setMessage('No fue posible cargar la imagen 360°.')
      })
    } else {
      const video = document.createElement('video')
      videoRef.current = video
      video.src = mediaUrl
      video.crossOrigin = 'anonymous'
      video.muted = true
      video.playsInline = true
      video.preload = onDemand ? 'metadata' : 'auto'
      video.loop = false
      video.addEventListener('canplay', () => {
        setStatus('ready')
        setMessage('Escenario listo.')
        if (!pausedRef.current) void video.play().catch(() => undefined)
      }, { once: true })
      video.addEventListener('error', () => {
        setStatus('error')
        setMessage('No fue posible cargar el video 360°.')
      }, { once: true })
      texture = new THREE.VideoTexture(video)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.generateMipmaps = false
      material.map = texture
      material.needsUpdate = true
      video.load()
    }

    const resize = () => {
      const width = Math.max(1, container.clientWidth)
      const height = Math.max(1, container.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = device === 'vr_box' ? width / 2 / height : width / height
      camera.fov = viewerProfile?.verticalFovDegrees ?? 75
      camera.updateProjectionMatrix()
      if (device === 'vr_box') {
        const pixelRatio = renderer.getPixelRatio()
        eyeTarget.setSize(Math.max(1, Math.round(width / 2 * pixelRatio)), Math.max(1, Math.round(height * pixelRatio)))
      }
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    window.addEventListener('resize', resize)
    resize()

    let visible = true
    const visibilityObserver = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting)
      if (videoRef.current) {
        if (!visible || pausedRef.current) videoRef.current.pause()
        else void videoRef.current.play().catch(() => undefined)
      }
    }, { rootMargin: '120px' })
    visibilityObserver?.observe(container)

    let displayedPose: CardboardHeadPose | null = null
    let previousRenderTime: number | null = null
    const render = (time: number) => {
      if (!visible && !renderer.xr.isPresenting) return
      if (!renderer.xr.isPresenting) {
        const frameDelta = previousRenderTime === null ? 16 : Math.min(100, time - previousRenderTime)
        previousRenderTime = time
        const targetPose = device === 'vr_box' ? headPoseRef.current : null
        displayedPose = targetPose ? smoothCardboardHeadPose(displayedPose, targetPose, frameDelta) : null
        const pose = displayedPose
        const view = manualViewRef.current
        camera.rotation.order = 'YXZ'
        camera.rotation.set(pose?.pitchRadians ?? view.pitch, pose?.yawRadians ?? view.yaw, pose ? -pose.rollRadians : 0)
      }
      if (device === 'vr_box') {
        const width = renderer.domElement.width / renderer.getPixelRatio()
        const height = renderer.domElement.height / renderer.getPixelRatio()
        const eyeWidth = width / 2
        const renderEye = (eye: CardboardEye, viewportX: number) => {
          const frustum = cardboardEyeProjectionFrustum(opticalProfile, eye, camera.near)
          camera.projectionMatrix.makePerspective(frustum.left, frustum.right, frustum.top, frustum.bottom, camera.near, camera.far)
          camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
          renderer.setScissorTest(false)
          renderer.setRenderTarget(eyeTarget)
          renderer.render(scene, camera)
          renderer.setRenderTarget(null)
          renderer.setScissorTest(true)
          renderer.setViewport(viewportX, 0, eyeWidth, height)
          renderer.setScissor(viewportX, 0, eyeWidth, height)
          renderer.render(distortionScene, distortionCamera)
        }
        renderEye('left', 0)
        renderEye('right', eyeWidth)
        renderer.setScissorTest(false)
      } else renderer.render(scene, camera)
    }
    renderer.setAnimationLoop(render)

    release = () => {
      observer.disconnect()
      visibilityObserver?.disconnect()
      window.removeEventListener('resize', resize)
      renderer.setAnimationLoop(null)
      const activeSession = xrSessionRef.current
      xrSessionRef.current = null
      if (activeSession) void activeSession.end().catch(() => undefined)
      videoRef.current?.pause()
      videoRef.current?.removeAttribute('src')
      videoRef.current?.load()
      videoRef.current = null
      texture?.dispose()
      material.dispose()
      geometry.dispose()
      eyeTarget.dispose()
      distortionMaterial.dispose()
      distortionGeometry.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      rendererRef.current = null
      onImmersionChangeRef.current?.(false)
    }
    }).catch(() => {
      if (disposed) return
      setStatus('error')
      setMessage('Este navegador no pudo cargar el visor 360°.')
    })
    return () => {
      disposed = true
      release?.()
    }
  }, [activated, device, onDemand, scenario, viewerProfile])

  const enterQuestImmersion = async () => {
    const renderer = rendererRef.current
    const container = containerRef.current
    const xr = (navigator as Navigator & { xr?: { isSessionSupported: (mode: 'immersive-vr') => Promise<boolean>; requestSession: (mode: 'immersive-vr', options?: object) => Promise<XrSessionLike> } }).xr
    if (!renderer || !container || !xr || !window.isSecureContext) {
      setStatus('unsupported')
      setMessage('Quest necesita HTTPS y un navegador compatible con WebXR inmersivo.')
      return
    }
    try {
      if (!await xr.isSessionSupported('immersive-vr')) {
        setStatus('unsupported')
        setMessage('Este dispositivo no informa compatibilidad con WebXR inmersivo.')
        return
      }
      renderer.xr.enabled = true
      const session = await xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'dom-overlay'],
        domOverlay: { root: container },
      })
      xrSessionRef.current = session
      session.addEventListener('end', () => {
        xrSessionRef.current = null
        setStatus('ready')
        setMessage('La inmersión terminó. Podés volver a entrar o salir de la sesión.')
        onImmersionChangeRef.current?.(false)
      }, { once: true })
      await renderer.xr.setSession(session)
      setStatus('xr_active')
      setMessage('WebXR inmersivo activo.')
      onImmersionChangeRef.current?.(true)
    } catch {
      setStatus('error')
      setMessage('Quest no pudo iniciar la sesión inmersiva. Revisá permisos y volvé a intentar.')
      onImmersionChangeRef.current?.(false)
    }
  }

  const leaveQuestImmersion = async () => {
    const session = xrSessionRef.current
    if (session) await session.end().catch(() => undefined)
  }

  const pointerRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null)
  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (device === 'vr_box' || status === 'xr_active') return
    pointerRef.current = { x: event.clientX, y: event.clientY, yaw: manualView.yaw, pitch: manualView.pitch }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerRef.current
    if (!start) return
    setManualView({
      yaw: start.yaw - (event.clientX - start.x) * 0.004,
      pitch: Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, start.pitch - (event.clientY - start.y) * 0.004)),
    })
  }

  if (!activated) {
    const previewBytes = scenario.derivatives.vr_box.bytes
    const previewSize = previewBytes >= 1_000_000 ? `${(previewBytes / 1_000_000).toFixed(1)} MB` : `${Math.ceil(previewBytes / 1_000)} KB`
    return <div className={`relative isolate size-full overflow-hidden bg-[#081113] ${className}`} aria-label={`Previsualización liviana: ${scenario.title}`}>
      <img
        src={immersiveMediaUrl(scenario, 'thumbnail') || undefined}
        alt={`Vista equirectangular de ${scenario.title}`}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="size-full object-cover"
      />
      <div className="absolute inset-0 grid place-items-center bg-black/38 p-4 text-center text-white">
        <div>
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#E49A02] shadow-xl"><Play size={19} fill="currentColor"/></span>
          <p className="mt-3 text-xs font-black">Abrir vista previa 360°</p>
          <p className="mt-1 text-[10px] text-white/75">Carga bajo demanda · versión móvil {previewSize}</p>
          <button type="button" onClick={() => setActivated(true)} className="absolute inset-0" aria-label={`Cargar vista previa 360° de ${scenario.title}`}/>
        </div>
      </div>
    </div>
  }

  return <div ref={containerRef} className={`relative isolate size-full overflow-hidden bg-[#081113] ${className}`} onPointerDown={beginDrag} onPointerMove={drag} onPointerUp={() => { pointerRef.current = null }} onPointerCancel={() => { pointerRef.current = null }} aria-label={`Visor panorámico: ${scenario.title}`}>
    {status !== 'xr_active' && (device !== 'vr_box' || controlsVisible) && <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-between bg-gradient-to-b from-black/75 to-transparent p-4 text-white">
      <div><p className="text-xs font-black">{scenario.shortTitle}</p><p className="mt-1 text-[10px] text-white/65">360° real · {scenario.mediaKind === 'video' ? 'video continuo' : 'cámara fija'}</p></div>
      {device !== 'vr_box' && <span className="rounded-full bg-black/45 px-3 py-2 text-[10px] font-black">Arrastrá para explorar</span>}
    </div>}
    {(status === 'loading' || status === 'error' || status === 'unsupported') && <div role={status === 'error' ? 'alert' : 'status'} className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-[#081113]/88 p-6 text-center text-white"><div><Scan className="mx-auto text-[#E49A02]" size={36}/><p className="mt-4 text-sm font-black">{message}</p></div></div>}
    {device === 'quest' && status !== 'xr_active' && canEnterImmersion && <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 to-transparent p-5 text-center text-white">
      <p className="text-[11px] font-bold leading-5 text-white/85">Escenario preparado. El ejercicio todavía no comenzó.</p>
      <p className="mt-1 text-[10px] leading-5 text-white/60">Tocá el botón una vez. El cronómetro empieza únicamente cuando Quest confirma la inmersión.</p>
      <button type="button" disabled={status !== 'ready'} onClick={() => void enterQuestImmersion()} className="mt-3 inline-flex h-12 items-center gap-2 rounded-2xl bg-[#E49A02] px-5 text-xs font-black text-white disabled:opacity-40"><Scan size={17}/> Iniciar ejercicio en inmersión</button>
      {onExit && <button type="button" onClick={onExit} className="ml-2 h-12 rounded-2xl bg-[#c74750] px-5 text-xs font-black text-white">Salir</button>}
    </div>}
    {device === 'quest' && status === 'xr_active' && <div className="absolute inset-x-0 bottom-0 z-40 flex flex-wrap items-center justify-center gap-2 p-5 [contain:layout]" data-webxr-dom-overlay>
      {formattedTime && <span className="rounded-2xl bg-black/65 px-4 py-3 text-xs font-black tabular-nums text-white">{formattedTime}</span>}
      {onTogglePause && <button type="button" onClick={onTogglePause} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-[#171717]">{paused ? <Play size={16}/> : <Pause size={16}/>} {paused ? 'Continuar' : 'Pausar'}</button>}
      <button type="button" onClick={() => void leaveQuestImmersion()} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white/90 px-4 text-xs font-black text-[#171717]"><RotateCcw size={16}/> Salir de inmersión</button>
      {onExit && <button type="button" onClick={onExit} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#c74750] px-4 text-xs font-black text-white"><LogOut size={16}/> Salir de sesión</button>}
    </div>}
  </div>
}
