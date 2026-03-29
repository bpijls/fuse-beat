import type p5 from 'p5'
import type { FusedBeat, FeedDevice } from '../hooks/useHeartbeat'

interface Ring {
  radius: number
  maxRadius: number
  alpha: number
  color: [number, number, number]
  speed: number
}

interface SketchState {
  rings: Ring[]
  lastBeat: FusedBeat | null
  devices: FeedDevice[]
  width: number
  height: number
}

export function heartbeatSketch(state: SketchState) {
  return (p: p5) => {
    p.setup = () => {
      p.createCanvas(state.width, state.height)
      p.colorMode(p.RGB, 255, 255, 255, 255)
    }

    p.draw = () => {
      p.background(250)

      const cx = p.width / 2
      const cy = p.height / 2

      // Draw expanding rings
      for (let i = state.rings.length - 1; i >= 0; i--) {
        const ring = state.rings[i]
        ring.radius += ring.speed
        ring.alpha -= 2

        if (ring.alpha <= 0 || ring.radius > ring.maxRadius) {
          state.rings.splice(i, 1)
          continue
        }

        p.noFill()
        p.stroke(ring.color[0], ring.color[1], ring.color[2], ring.alpha)
        p.strokeWeight(2)
        p.circle(cx, cy, ring.radius * 2)
      }

      // Draw center circle
      p.noStroke()
      p.fill(239, 68, 68, 200)
      p.circle(cx, cy, 40)

      // BPM text
      if (state.lastBeat) {
        p.fill(50)
        p.noStroke()
        p.textSize(32)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`${Math.round(state.lastBeat.bpm)} BPM`, cx, cy + 60)

        p.textSize(14)
        p.fill(150)
        p.text(`${state.lastBeat.device_count} device${state.lastBeat.device_count !== 1 ? 's' : ''}`, cx, cy + 90)
      } else {
        p.fill(180)
        p.noStroke()
        p.textSize(18)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Waiting for heartbeats…', cx, cy + 60)
      }

      // Device dots around center
      if (state.devices.length > 0) {
        const radius = 80
        state.devices.forEach((device, i) => {
          const angle = (i / state.devices.length) * p.TWO_PI - p.HALF_PI
          const dx = cx + Math.cos(angle) * radius
          const dy = cy + Math.sin(angle) * radius
          const color = hexToRgb(device.color)
          if (color) {
            p.noStroke()
            p.fill(color[0], color[1], color[2])
            p.circle(dx, dy, 12)
          }
        })
      }
    }

    // Called externally when a fused_beat arrives
    ;(p as unknown as Record<string, unknown>)['triggerBeat'] = (beat: FusedBeat, devices: FeedDevice[]) => {
      state.lastBeat = beat
      state.devices  = devices

      const maxRadius = Math.min(p.width, p.height) * 0.45

      // Add rings for each device color
      if (devices.length > 0) {
        devices.forEach(device => {
          const color = hexToRgb(device.color) || [239, 68, 68]
          state.rings.push({ radius: 20, maxRadius, alpha: 200, color, speed: 2 })
        })
      } else {
        state.rings.push({ radius: 20, maxRadius, alpha: 200, color: [239, 68, 68], speed: 2 })
      }
    }
  }
}

function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : null
}

export type { SketchState }
