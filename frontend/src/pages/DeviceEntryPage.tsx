import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDeviceStore } from '../store/device'

export default function DeviceEntryPage() {
  const navigate = useNavigate()
  const setDeviceId = useDeviceStore(s => s.setDeviceId)
  const [input, setInput] = useState('')

  // WebSerial state
  const [port, setPort] = useState<SerialPort | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [detectedId, setDetectedId] = useState<string | null>(null)
  const [ssid, setSsid] = useState('')
  const [wifiPass, setWifiPass] = useState('')
  const [wifiSent, setWifiSent] = useState(false)
  const [log, setLog] = useState<string[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writerRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readerRef = useRef<any>(null)

  const hasSerial = typeof navigator !== 'undefined' && 'serial' in navigator

  function appendLog(line: string) {
    setLog(prev => [...prev.slice(-50), line])
  }

  function parseLine(line: string) {
    const m = line.match(/\[Serial\] Device ID:\s*([0-9A-Fa-f]{4,8})/)
    if (m) {
      const id = m[1].toUpperCase()
      setDetectedId(id)
      setInput(id)
      appendLog(`Device ID detected: ${id}`)
    }
  }

  async function sendLine(text: string) {
    if (!writerRef.current) return
    appendLog(`>> ${text}`)
    await writerRef.current.write(new TextEncoder().encode(text + '\n'))
  }

  async function connect() {
    setConnecting(true)
    try {
      const selected: SerialPort = await navigator.serial.requestPort()
      await selected.open({ baudRate: 115200 })
      setPort(selected)
      appendLog('Connected at 115200 baud')

      const decoder = new TextDecoderStream()
      selected.readable!.pipeTo(decoder.writable)
      const reader = decoder.readable.getReader()
      readerRef.current = reader

      const writer = selected.writable!.getWriter()
      writerRef.current = writer

      // Read loop — parse incoming lines for device ID
      ;(async () => {
        let buf = ''
        while (true) {
          try {
            const { value, done } = await (reader as ReadableStreamDefaultReader<string>).read()
            if (done) break
            buf += value
            const lines = buf.split('\n')
            buf = lines.pop() || ''
            for (const l of lines) {
              const trimmed = l.trim()
              if (trimmed) {
                appendLog(trimmed)
                parseLine(trimmed)
              }
            }
          } catch {
            break
          }
        }
        appendLog('Disconnected')
        setPort(null)
        writerRef.current = null
        readerRef.current = null
      })()

      // Auto-query device ID
      setTimeout(() => sendLine('status'), 800)
    } catch (err) {
      appendLog('Failed: ' + String(err))
    } finally {
      setConnecting(false)
    }
  }

  async function disconnect() {
    readerRef.current?.cancel()
    writerRef.current?.releaseLock()
    writerRef.current = null
    readerRef.current = null
    try { await port?.close() } catch { /* ignore */ }
    setPort(null)
    appendLog('Port closed')
  }

  async function applyWifi() {
    if (!ssid) return
    await sendLine(`wifi ${ssid} ${wifiPass}`)
    setWifiSent(true)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const id = input.trim().toUpperCase()
    if (!id) return
    setDeviceId(id)
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-4xl">♥</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">FuseBeat</h1>
          <p className="text-gray-500 text-sm mt-1">Synchronized heartbeats</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Your device ID</span>
            <input
              type="text"
              placeholder="e.g. A1B2"
              value={input}
              onChange={e => setInput(e.target.value)}
              maxLength={8}
              autoFocus
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-rose-300"
              required
            />
            {!port && (
              <span className="text-xs text-gray-400">
                Visible via <code>status</code> command in serial monitor
              </span>
            )}
            {detectedId && (
              <span className="text-xs text-green-600 font-medium">
                Auto-detected from device
              </span>
            )}
          </label>
          <button
            type="submit"
            className="bg-rose-500 hover:bg-rose-600 text-white rounded-lg py-2 text-sm font-semibold transition-colors mt-1"
          >
            Continue
          </button>
        </form>

        {/* WebSerial section */}
        {hasSerial && (
          <div className="border-t border-gray-100 pt-5 space-y-4">
            <p className="text-xs text-gray-400 text-center uppercase tracking-wide">Via USB</p>

            {!port ? (
              <button
                onClick={connect}
                disabled={connecting}
                className="w-full border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v6m0 0l-2-2m2 2l2-2M5 12H2m3 0a7 7 0 0014 0m0 0h3M9 17l-2 2-2-2m10 2l-2-2 2-2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {connecting ? 'Connecting…' : 'Connect Device'}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-600 font-medium">● Connected</span>
                  <div className="flex gap-3">
                    <button onClick={() => sendLine('status')} className="text-xs text-gray-400 hover:text-gray-600">
                      Re-read ID
                    </button>
                    <button onClick={disconnect} className="text-xs text-gray-400 hover:text-gray-600">
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* WiFi credentials */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600">Set WiFi credentials</p>
                  <input
                    type="text"
                    placeholder="Network name (SSID)"
                    value={ssid}
                    onChange={e => { setSsid(e.target.value); setWifiSent(false) }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={wifiPass}
                    onChange={e => { setWifiPass(e.target.value); setWifiSent(false) }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                  />
                  <button
                    onClick={applyWifi}
                    disabled={!ssid || wifiSent}
                    className="w-full bg-gray-800 hover:bg-gray-900 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-40"
                  >
                    {wifiSent ? 'WiFi credentials sent ✓' : 'Set WiFi'}
                  </button>
                </div>
              </div>
            )}

            {/* Mini terminal */}
            {log.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-300 h-28 overflow-y-auto">
                {log.map((line, i) => (
                  <div key={i} className={line.startsWith('>>') ? 'text-green-400' : 'text-gray-300'}>
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!hasSerial && (
          <p className="text-xs text-gray-400 text-center border-t border-gray-100 pt-4">
            USB auto-detect requires Chrome or Edge
          </p>
        )}
      </div>
    </div>
  )
}
