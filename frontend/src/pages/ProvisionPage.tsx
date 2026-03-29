import { useState, useRef } from 'react'

interface SerialLine {
  text: string
  dir: 'out' | 'in'
}

export default function ProvisionPage() {
  const [port, setPort] = useState<SerialPort | null>(null)
  const [log, setLog] = useState<SerialLine[]>([])
  const [ssid, setSsid] = useState('')
  const [pass, setPass] = useState('')
  const [serverUrl, setServerUrl] = useState('ws://192.168.1.100:5001/ws')
  const [feedId, setFeedId] = useState('default')
  const [color, setColor] = useState('#FF0000')
  const [connecting, setConnecting] = useState(false)
  const [applying, setApplying] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writerRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readerRef = useRef<any>(null)

  const hasSerial = typeof navigator !== 'undefined' && 'serial' in navigator

  function appendLog(text: string, dir: SerialLine['dir'] = 'in') {
    setLog(prev => [...prev.slice(-200), { text, dir }])
  }

  async function connect() {
    setConnecting(true)
    try {
      const selectedPort: SerialPort = await navigator.serial.requestPort()
      await selectedPort.open({ baudRate: 115200 })
      setPort(selectedPort)
      appendLog('[Connected at 115200 baud]', 'in')

      // Start reading
      const decoder = new TextDecoderStream()
      selectedPort.readable.pipeTo(decoder.writable)
      const reader = decoder.readable.getReader()
      readerRef.current = reader

      const writer = selectedPort.writable.getWriter()
      writerRef.current = writer

      ;(async () => {
        let buffer = ''
        while (true) {
          try {
            const { value, done } = await (reader as ReadableStreamDefaultReader<string>).read()
            if (done) break
            buffer += value
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              if (line.trim()) appendLog(line.trim(), 'in')
            }
          } catch {
            break
          }
        }
        appendLog('[Disconnected]', 'in')
        setPort(null)
      })()
    } catch (err) {
      appendLog('[Failed to connect: ' + String(err) + ']', 'in')
    } finally {
      setConnecting(false)
    }
  }

  async function sendLine(line: string) {
    if (!writerRef.current) return
    const encoder = new TextEncoder()
    await writerRef.current.write(encoder.encode(line + '\n'))
    appendLog(line, 'out')
  }

  async function applyConfig() {
    setApplying(true)
    try {
      if (ssid)      await sendLine(`wifi ${ssid} ${pass}`)
      if (serverUrl) await sendLine(`server ${serverUrl}`)
      if (feedId)    await sendLine(`feed ${feedId}`)
      if (color)     await sendLine(`color ${color}`)
      await new Promise(r => setTimeout(r, 500))
      await sendLine('status')
    } finally {
      setApplying(false)
    }
  }

  async function disconnect() {
    writerRef.current?.releaseLock()
    readerRef.current?.cancel()
    if (port) await port.close()
    setPort(null)
    appendLog('[Port closed]', 'in')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Provision Device</h1>

      {!hasSerial && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          Web Serial is not supported in this browser. Please use <strong>Chrome</strong> or <strong>Edge</strong>.
          <br /><br />
          Alternatively, use <code>esptool.py</code> and configure via the serial monitor:
          <pre className="mt-2 bg-yellow-100 rounded p-2 text-xs overflow-x-auto">
{`pip install esptool
# Flash firmware (if needed):
esptool.py --port /dev/ttyUSB0 --baud 921600 write_flash 0x0 firmware.bin

# Then open serial monitor at 115200 and type:
wifi YourSSID YourPassword
server ws://192.168.1.100:5001/ws
feed default
color #FF0000`}
          </pre>
        </div>
      )}

      {hasSerial && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-5">
          {/* Connection */}
          <div className="flex items-center gap-3">
            {!port ? (
              <button
                onClick={connect}
                disabled={connecting}
                className="bg-gray-800 hover:bg-gray-900 text-white text-sm rounded-lg px-5 py-2 font-medium transition-colors disabled:opacity-50"
              >
                {connecting ? 'Connecting…' : 'Connect Device'}
              </button>
            ) : (
              <>
                <span className="text-sm text-green-600 font-medium">● Connected</span>
                <button
                  onClick={disconnect}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>

          {/* Config form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">WiFi SSID</span>
              <input
                value={ssid}
                onChange={e => setSsid(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                placeholder="Your network name"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">WiFi Password</span>
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                placeholder="Password"
              />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs text-gray-500">Server WebSocket URL</span>
              <input
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Feed ID</span>
              <input
                value={feedId}
                onChange={e => setFeedId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Device Color</span>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-9 h-9 rounded border border-gray-200 cursor-pointer"
                />
                <span className="text-sm text-gray-500 font-mono">{color}</span>
              </div>
            </label>
          </div>

          <button
            onClick={applyConfig}
            disabled={!port || applying}
            className="bg-rose-500 hover:bg-rose-600 text-white text-sm rounded-lg px-6 py-2 font-medium transition-colors disabled:opacity-50"
          >
            {applying ? 'Applying…' : 'Apply Configuration'}
          </button>
        </div>
      )}

      {/* Terminal log */}
      {log.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs text-gray-300 h-48 overflow-y-auto">
          {log.map((line, i) => (
            <div key={i} className={line.dir === 'out' ? 'text-green-400' : 'text-gray-300'}>
              {line.dir === 'out' ? '>> ' : '   '}{line.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
