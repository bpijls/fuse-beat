import { useState, useEffect } from 'react'
import { api, AdminStatus } from '../api'

export default function AdminPage() {
  const [status, setStatus] = useState<AdminStatus | null>(null)
  const [nDevices, setNDevices] = useState(3)
  const [feedId, setFeedId] = useState('default')
  const [bpmMin, setBpmMin] = useState(60)
  const [bpmMax, setBpmMax] = useState(90)
  const [wsUrl, setWsUrl] = useState(`ws://${window.location.hostname}:5001/ws`)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function refresh() {
    api.adminStatus().then(setStatus).catch(console.error)
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 2000)
    return () => clearInterval(interval)
  }, [])

  async function startSim() {
    setError('')
    setLoading(true)
    try {
      await api.startSimulator({ n_devices: nDevices, feed_id: feedId, bpm_min: bpmMin, bpm_max: bpmMax, ws_url: wsUrl })
      refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start')
    } finally {
      setLoading(false)
    }
  }

  async function stopSim() {
    setLoading(true)
    try {
      await api.stopSimulator()
      refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <span className="font-bold text-rose-500 text-lg">♥ FuseBeat Admin</span>
        <span className="ml-3 text-xs text-gray-400">Direct URL — not linked from main UI</span>
      </div>

      <div className="container mx-auto px-4 max-w-3xl py-8 space-y-6">
        {/* Live status */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-700 mb-3">Live Status</h2>
          {status ? (
            <div className="space-y-3">
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-gray-400">Connected devices</span>
                  <p className="font-semibold text-gray-800 text-lg">{status.connected_devices}</p>
                </div>
                <div>
                  <span className="text-gray-400">Simulator</span>
                  <p className={`font-semibold text-lg ${status.simulator_running ? 'text-green-600' : 'text-gray-400'}`}>
                    {status.simulator_running ? 'Running' : 'Stopped'}
                  </p>
                </div>
              </div>

              {Object.keys(status.feeds).length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Active feeds</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(status.feeds).map(([name, info]) => (
                      <div key={name} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        <span className="font-medium text-gray-700">{name}</span>
                        <span className="ml-2 text-gray-400">{info.bpm} BPM · {info.device_count} devices</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {status.devices.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-100">
                        <th className="pb-2">Device ID</th>
                        <th className="pb-2">Feed</th>
                        <th className="pb-2">BPM</th>
                        <th className="pb-2">Color</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.devices.map(d => (
                        <tr key={d.id} className="border-b border-gray-50">
                          <td className="py-1.5 font-mono text-gray-700">{d.id}</td>
                          <td className="py-1.5 text-gray-500">{d.feed_id}</td>
                          <td className="py-1.5 text-gray-700">{d.bpm}</td>
                          <td className="py-1.5">
                            <span
                              className="inline-block w-4 h-4 rounded-full border border-gray-200"
                              style={{ backgroundColor: d.color }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Loading…</p>
          )}
        </section>

        {/* Simulator controls */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Device Simulator</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">N devices</span>
              <input
                type="number"
                min={1}
                max={20}
                value={nDevices}
                onChange={e => setNDevices(Number(e.target.value))}
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
              <span className="text-xs text-gray-500">BPM min</span>
              <input
                type="number"
                value={bpmMin}
                onChange={e => setBpmMin(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">BPM max</span>
              <input
                type="number"
                value={bpmMax}
                onChange={e => setBpmMax(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
            </label>
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-xs text-gray-500">WS URL</span>
              <input
                value={wsUrl}
                onChange={e => setWsUrl(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
            </label>
          </div>

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={startSim}
              disabled={loading || status?.simulator_running}
              className="bg-rose-500 hover:bg-rose-600 text-white text-sm rounded-lg px-5 py-2 font-medium transition-colors disabled:opacity-50"
            >
              Start Simulation
            </button>
            <button
              onClick={stopSim}
              disabled={loading || !status?.simulator_running}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg px-5 py-2 font-medium transition-colors disabled:opacity-50"
            >
              Stop
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
