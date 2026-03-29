import type p5 from 'p5'
import type { RawSample } from '../hooks/useRawSignal'

interface RawSketchState {
  samples: RawSample[]
  width: number
  height: number
}

export function rawSignalSketch(state: RawSketchState) {
  return (p: p5) => {
    p.setup = () => {
      p.createCanvas(state.width, state.height)
    }

    p.draw = () => {
      p.background(250)

      const samples = state.samples
      if (samples.length < 2) {
        p.fill(180)
        p.noStroke()
        p.textSize(16)
        p.textAlign(p.CENTER, p.CENTER)
        p.text('Waiting for raw signal data…', p.width / 2, p.height / 2)
        return
      }

      // Compute min/max for scaling
      let minVal = Infinity, maxVal = -Infinity
      for (const s of samples) {
        if (s.ir_value < minVal) minVal = s.ir_value
        if (s.ir_value > maxVal) maxVal = s.ir_value
      }
      const range = maxVal - minVal || 1

      const padX = 40
      const padY = 20
      const drawW = p.width - padX * 2
      const drawH = p.height - padY * 2

      // Draw grid lines
      p.stroke(220)
      p.strokeWeight(1)
      for (let i = 0; i <= 4; i++) {
        const y = padY + (drawH * i) / 4
        p.line(padX, y, padX + drawW, y)
        const val = maxVal - (range * i) / 4
        p.fill(160)
        p.noStroke()
        p.textSize(10)
        p.textAlign(p.RIGHT, p.CENTER)
        p.text(Math.round(val).toString(), padX - 4, y)
        p.stroke(220)
      }

      // Draw signal line
      p.noFill()
      p.stroke(239, 68, 68)
      p.strokeWeight(1.5)
      p.beginShape()
      for (let i = 0; i < samples.length; i++) {
        const x = padX + (i / (samples.length - 1)) * drawW
        const y = padY + (1 - (samples[i].ir_value - minVal) / range) * drawH
        p.vertex(x, y)
      }
      p.endShape()

      // Detect and mark peaks (simple: local maxima)
      p.noStroke()
      p.fill(239, 68, 68, 150)
      for (let i = 1; i < samples.length - 1; i++) {
        const prev = samples[i - 1].ir_value
        const curr = samples[i].ir_value
        const next = samples[i + 1].ir_value
        const threshold = minVal + range * 0.7
        if (curr > prev && curr > next && curr > threshold) {
          const x = padX + (i / (samples.length - 1)) * drawW
          const y = padY + (1 - (curr - minVal) / range) * drawH
          p.circle(x, y, 6)
        }
      }
    }
  }
}

export type { RawSketchState }
