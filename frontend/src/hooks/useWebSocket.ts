import { useEffect, useRef, useState, useCallback } from 'react'

export type WsState = 'connecting' | 'open' | 'closed'

export function useWebSocket(url: string | null) {
  const [state, setState] = useState<WsState>('closed')
  const [lastMessage, setLastMessage] = useState<unknown>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryDelay = useRef(1000)

  const connect = useCallback(() => {
    if (!url) return
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return

    setState('connecting')
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setState('open')
      retryDelay.current = 1000
    }

    ws.onmessage = (evt) => {
      try {
        setLastMessage(JSON.parse(evt.data as string))
      } catch {
        setLastMessage(evt.data)
      }
    }

    ws.onclose = () => {
      setState('closed')
      wsRef.current = null
      // Exponential backoff reconnect
      retryTimer.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, 30000)
        connect()
      }, retryDelay.current)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [url])

  useEffect(() => {
    connect()
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback((msg: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  return { state, lastMessage, sendMessage }
}
