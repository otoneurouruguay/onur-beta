import { useEffect, useRef } from 'react'
import { headPoseToCanvasTransform, smoothCardboardHeadPose, type CardboardHeadPose } from './cardboardTracking'
import { cardboardEyeOpticalOffset, defaultCardboardViewerProfile, type CardboardViewerProfile } from './cardboardViewerProfiles'
import { renderExerciseBackground, renderExerciseObject } from './engine'
import type { ExerciseConfig } from './types'

export function StereoscopicExerciseCanvas({ config, paused = false, headPose = null, viewerProfile = defaultCardboardViewerProfile }: { config: ExerciseConfig; paused?: boolean; headPose?: CardboardHeadPose | null; viewerProfile?: CardboardViewerProfile }) {
  const leftRef = useRef<HTMLCanvasElement>(null)
  const rightRef = useRef<HTMLCanvasElement>(null)
  const configRef = useRef(config)
  const pausedRef = useRef(paused)
  const headPoseRef = useRef(headPose)
  const elapsedRef = useRef(0)
  const previousTimeRef = useRef<number | null>(null)

  useEffect(() => { configRef.current = config }, [config])
  useEffect(() => { pausedRef.current = paused; previousTimeRef.current = null }, [paused])
  useEffect(() => { headPoseRef.current = headPose }, [headPose])

  useEffect(() => {
    const canvases = [leftRef.current, rightRef.current].filter((canvas): canvas is HTMLCanvasElement => Boolean(canvas))
    if (canvases.length !== 2) return
    const contexts = canvases.map((canvas) => canvas.getContext('2d', { alpha: false }))
    if (contexts.some((context) => !context)) return
    let animationFrame = 0
    let displayedPose: CardboardHeadPose | null = null
    let previousFrameTime: number | null = null
    const sizes = canvases.map(() => ({ width: 1, height: 1 }))

    const resize = () => canvases.forEach((canvas, index) => {
      const context = contexts[index]!
      const rect = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const pixelWidth = Math.max(1, Math.round(rect.width * ratio))
      const pixelHeight = Math.max(1, Math.round(rect.height * ratio))
      sizes[index] = { width: rect.width, height: rect.height }
      if (canvas.width === pixelWidth && canvas.height === pixelHeight) return
      canvas.width = pixelWidth
      canvas.height = pixelHeight
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    })
    const observer = new ResizeObserver(resize)
    canvases.forEach((canvas) => observer.observe(canvas))
    resize()

    const draw = (time: number) => {
      const frameDelta = previousFrameTime === null ? 16 : Math.min(100, time - previousFrameTime)
      previousFrameTime = time
      if (!pausedRef.current) {
        if (previousTimeRef.current !== null) elapsedRef.current += Math.min((time - previousTimeRef.current) / 1000, 0.1)
        previousTimeRef.current = time
      }
      const targetPose = configRef.current.cardboardEnabled ? headPoseRef.current : null
      displayedPose = targetPose ? smoothCardboardHeadPose(displayedPose, targetPose, frameDelta) : null
      canvases.forEach((_, index) => {
        const { width, height } = sizes[index]
        const context = contexts[index]!
        const eye = index === 0 ? 'left' : 'right'
        context.save()
        context.fillStyle = configRef.current.backgroundColor
        context.fillRect(0, 0, width, height)
        const opticalOffset = configRef.current.cardboardEnabled ? cardboardEyeOpticalOffset(viewerProfile, eye, width, height) : { offsetX: 0, offsetY: 0 }
        const transform = displayedPose ? headPoseToCanvasTransform(displayedPose, width, height, viewerProfile) : null
        if (configRef.current.backgroundType !== 'solid') {
          context.save()
          context.translate(opticalOffset.offsetX, opticalOffset.offsetY)
          if (transform) {
            context.translate(width / 2 + transform.offsetX, height / 2 + transform.offsetY)
            context.rotate(transform.rotationRadians)
            context.translate(-width / 2, -height / 2)
          }
          renderExerciseBackground(context, configRef.current, elapsedRef.current, width, height, false)
          context.restore()
        }
        context.save()
        context.translate(opticalOffset.offsetX, opticalOffset.offsetY)
        if (displayedPose) {
          context.translate(width / 2 + transform!.offsetX, height / 2 + transform!.offsetY)
          context.rotate(transform!.rotationRadians)
          context.translate(-width / 2, -height / 2)
        }
        renderExerciseObject(context, configRef.current, elapsedRef.current, width, height)
        context.restore()
        context.restore()
      })
      animationFrame = requestAnimationFrame(draw)
    }
    animationFrame = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(animationFrame); observer.disconnect() }
  }, [viewerProfile])

  const viewerLabel = config.cardboardEnabled ? 'Cardboard' : 'VR Box'
  return <div className="absolute inset-0 grid grid-cols-2 bg-black" data-viewer-profile={config.cardboardEnabled ? 'cardboard' : 'vr_box'} aria-label={`Vista binocular 2D para ${viewerLabel}`}>
    <canvas ref={leftRef} className="block h-full w-full border-r-2 border-black" aria-label="Vista izquierda"/>
    <canvas ref={rightRef} className="block h-full w-full border-l-2 border-black" aria-label="Vista derecha"/>
  </div>
}
