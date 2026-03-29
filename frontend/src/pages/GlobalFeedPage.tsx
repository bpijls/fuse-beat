import { useEffect, useRef, useState } from 'react'
import p5 from 'p5'
import { useHeartbeat } from '../hooks/useHeartbeat'
import { api, Feed } from '../api'
import { heartbeatSketch } from '../sketches/HeartbeatSketch'

const CANVAS_W = 600
const CANVAS_H = 400

export default function GlobalFeedPage() {
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [selectedFeed, setSelectedFeed] = useState('default')
  const canvasRef = useRef<HTMLDivElement>(null)
  const p5Ref = useRef<p5 | null>(null)
  const sketchStateRef = useRef({ rings: [], lastBeat: null, devices: [], width: CANVAS_W, height: CANVAS_H })

  const { beat, devices, wsState } = useHeartbeat(selectedFeed)

  useEffect(() => {
    api.listFeeds().then(setFeeds)
  }, [])

  // Initialize p5 canvas
  useEffect(() => {
    if (!canvasRef.current) return
    const sketch = heartbeatSketch(sketchStateRef.current)
    p5Ref.current = new p5(sketch, canvasRef.current)
    return () => {
      p5Ref.current?.remove()
      p5Ref.current = null
    }
  }, [])

  // Trigger beat animation
  useEffect(() => {
    if (beat && p5Ref.current) {
      const triggerBeat = (p5Ref.current as unknown as Record<string, unknown>)['triggerBeat']
      if (typeof triggerBeat === 'function') {
        triggerBeat(beat, devices)
      }
    }
  }, [beat, devices])

  const wsColor = wsState === 'open' ? 'text-green-500' : wsState === 'connecting' ? 'text-yellow-500' : 'text-gray-400'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Global Feed</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedFeed}
            onChange={e => setSelectedFeed(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          >
            {feeds.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
          <span className={`text-xs font-medium ${wsColor}`}>
            ● {wsState}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex justify-center">
        <div ref={canvasRef} />
      </div>

      {beat && (
        <div className="flex gap-4 text-sm text-gray-500">
          <span>BPM: <strong className="text-gray-800">{Math.round(beat.bpm)}</strong></span>
          <span>Devices: <strong className="text-gray-800">{beat.device_count}</strong></span>
          <span>Interval: <strong className="text-gray-800">{beat.interval_ms}ms</strong></span>
        </div>
      )}
    </div>
  )
}
