import { useEffect, useRef, useState } from 'react'
import { useWebSocket } from './useWebSocket'
import { useDeviceStore } from '../store/device'

const WS_URL = `ws://${window.location.hostname}:5001/ws`

export interface FusedBeat {
  bpm: number
  interval_ms: number
  device_count: number
  timestamp_ms: number
}

export interface FeedDevice {
  id: string
  bpm: number
  color: string
  feed_id: string
}

export function useHeartbeat(feedId: string) {
  const deviceId = useDeviceStore(s => s.deviceId)
  const { state, lastMessage, sendMessage } = useWebSocket(deviceId ? WS_URL : null)
  const subscribedFeed = useRef<string | null>(null)

  const [beat, setBeat] = useState<FusedBeat | null>(null)
  const [devices, setDevices] = useState<FeedDevice[]>([])

  // Subscribe when connected
  useEffect(() => {
    if (state === 'open' && subscribedFeed.current !== feedId) {
      sendMessage({ type: 'subscribe', client_type: 'frontend', feed_id: feedId })
      subscribedFeed.current = feedId
    }
  }, [state, feedId, sendMessage])

  // Handle incoming messages
  useEffect(() => {
    if (!lastMessage || typeof lastMessage !== 'object') return
    const msg = lastMessage as Record<string, unknown>

    if (msg.type === 'fused_beat') {
      setBeat({
        bpm:          msg.bpm as number,
        interval_ms:  msg.interval_ms as number,
        device_count: msg.device_count as number,
        timestamp_ms: msg.timestamp_ms as number,
      })
    } else if (msg.type === 'feed_status') {
      setDevices((msg.devices as FeedDevice[]) || [])
    }
  }, [lastMessage])

  return { beat, devices, wsState: state }
}
