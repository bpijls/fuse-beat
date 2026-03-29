import { useEffect, useRef, useState } from 'react'
import p5 from 'p5'
import { useRawSignal } from '../hooks/useRawSignal'
import { api, Device } from '../api'
import { rawSignalSketch } from '../sketches/RawSignalSketch'

const CANVAS_W = 700
const CANVAS_H = 300

export default function RawSignalPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const p5Ref = useRef<p5 | null>(null)
  const sketchStateRef = useRef({ samples: [], width: CANVAS_W, height: CANVAS_H })

  const { buffer, wsState } = useRawSignal(selectedDevice)

  useEffect(() => {
    api.listDevices().then(devs => {
      setDevices(devs)
      if (devs.length > 0 && !selectedDevice) {
        setSelectedDevice(devs[0].device_id)
      }
    })
  }, [])

  // Init p5
  useEffect(() => {
    if (!canvasRef.current) return
    const sketch = rawSignalSketch(sketchStateRef.current)
    p5Ref.current = new p5(sketch, canvasRef.current)
    return () => {
      p5Ref.current?.remove()
      p5Ref.current = null
    }
  }, [])

  // Keep sketch state in sync with buffer
  useEffect(() => {
    sketchStateRef.current.samples = buffer as typeof sketchStateRef.current.samples
  }, [buffer])

  const wsColor = wsState === 'open' ? 'text-green-500' : wsState === 'connecting' ? 'text-yellow-500' : 'text-gray-400'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Raw Signal</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedDevice || ''}
            onChange={e => setSelectedDevice(e.target.value || null)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
          >
            <option value="">Select device</option>
            {devices.map(d => (
              <option key={d.device_id} value={d.device_id}>
                {d.name} ({d.device_id})
              </option>
            ))}
          </select>
          <span className={`text-xs font-medium ${wsColor}`}>
            ● {wsState}
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Enable <strong>raw signal mode</strong> on the device via serial (<code>rawmode on</code>) or the button (short press).
        The device must be connected to the server.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex justify-center">
        <div ref={canvasRef} />
      </div>

      <div className="text-sm text-gray-500">
        Samples buffered: <strong className="text-gray-800">{buffer.length}</strong>
      </div>
    </div>
  )
}
