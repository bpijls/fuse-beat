import { useEffect, useRef, useState } from 'react'
import { useWebSocket } from './useWebSocket'
import { useDeviceStore } from '../store/device'

const WS_URL = `ws://${window.location.hostname}:5001/ws`
const BUFFER_SIZE = 500

export interface RawSample {
  device_id: string
  ir_value: number
  timestamp_ms: number
}

export function useRawSignal(deviceId: string | null) {
  const storeDeviceId = useDeviceStore(s => s.deviceId)
  const { state, lastMessage, sendMessage } = useWebSocket(storeDeviceId && deviceId ? WS_URL : null)
  const subscribedDevice = useRef<string | null>(null)

  const [buffer, setBuffer] = useState<RawSample[]>([])

  useEffect(() => {
    if (state === 'open' && deviceId && subscribedDevice.current !== deviceId) {
      sendMessage({ type: 'subscribe_raw', client_type: 'frontend', device_id: deviceId })
      subscribedDevice.current = deviceId
      setBuffer([])
    }
  }, [state, deviceId, sendMessage])

  useEffect(() => {
    if (!lastMessage || typeof lastMessage !== 'object') return
    const msg = lastMessage as Record<string, unknown>

    if (msg.type === 'raw_sample') {
      const sample: RawSample = {
        device_id:    msg.device_id as string,
        ir_value:     msg.ir_value as number,
        timestamp_ms: msg.timestamp_ms as number,
      }
      setBuffer(prev => {
        const next = [...prev, sample]
        return next.length > BUFFER_SIZE ? next.slice(next.length - BUFFER_SIZE) : next
      })
    }
  }, [lastMessage])

  return { buffer, wsState: state }
}
