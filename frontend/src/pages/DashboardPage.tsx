import { useState, useEffect } from 'react'
import { api, Device, Feed } from '../api'
import { useDeviceStore } from '../store/device'
import DeviceCard from '../components/DeviceCard'

export default function DashboardPage() {
  const deviceId = useDeviceStore(s => s.deviceId)!
  const [devices, setDevices] = useState<Device[]>([])
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [newDeviceId, setNewDeviceId] = useState('')
  const [newDeviceName, setNewDeviceName] = useState('')
  const [newFeedName, setNewFeedName] = useState('')
  const [newFeedDesc, setNewFeedDesc] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.listDevices(), api.listFeeds()]).then(([d, f]) => {
      setDevices(d)
      setFeeds(f)
      setLoading(false)
    })
  }, [])

  async function registerDevice(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const device = await api.registerDevice(newDeviceId.toUpperCase(), newDeviceName)
      setDevices(prev => {
        const exists = prev.find(x => x.device_id === device.device_id)
        return exists ? prev : [...prev, device]
      })
      setNewDeviceId('')
      setNewDeviceName('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register device')
    }
  }

  async function createFeed(e: React.FormEvent) {
    e.preventDefault()
    try {
      const feed = await api.createFeed(newFeedName, newFeedDesc)
      setFeeds(prev => [...prev, feed])
      setNewFeedName('')
      setNewFeedDesc('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create feed')
    }
  }

  if (loading) return <div className="text-gray-400 text-center mt-16">Loading…</div>

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Devices section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-700">Devices</h2>
          <span className="text-sm text-gray-400">{devices.length} device{devices.length !== 1 ? 's' : ''}</span>
        </div>

        {devices.length === 0 ? (
          <p className="text-gray-400 text-sm">No devices registered yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map(d => (
              <DeviceCard
                key={d.id}
                device={d}
                feeds={feeds}
                onUpdated={updated => setDevices(prev => prev.map(x => x.id === updated.id ? updated : x))}
                onDeleted={id => setDevices(prev => prev.filter(x => x.id !== id))}
              />
            ))}
          </div>
        )}

        <form onSubmit={registerDevice} className="mt-4 flex gap-2 flex-wrap">
          <input
            placeholder="Device ID (e.g. A1B2)"
            value={newDeviceId}
            onChange={e => setNewDeviceId(e.target.value)}
            maxLength={8}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-rose-300"
            required
          />
          <input
            placeholder="Name (optional)"
            value={newDeviceName}
            onChange={e => setNewDeviceName(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-rose-300"
          />
          <button
            type="submit"
            className="bg-rose-500 hover:bg-rose-600 text-white text-sm rounded-lg px-4 py-2 font-medium transition-colors"
          >
            Register Device
          </button>
        </form>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </section>

      {/* Feeds section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Feeds</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {feeds.map(f => (
            <div
              key={f.id}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm"
            >
              <span className="font-medium text-gray-800 text-sm">{f.name}</span>
              {f.description && (
                <p className="text-xs text-gray-400 mt-0.5">{f.description}</p>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={createFeed} className="flex gap-2 flex-wrap">
          <input
            placeholder="Feed name"
            value={newFeedName}
            onChange={e => setNewFeedName(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-rose-300"
            required
          />
          <input
            placeholder="Description (optional)"
            value={newFeedDesc}
            onChange={e => setNewFeedDesc(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-rose-300"
          />
          <button
            type="submit"
            className="bg-gray-800 hover:bg-gray-900 text-white text-sm rounded-lg px-4 py-2 font-medium transition-colors"
          >
            Create Feed
          </button>
        </form>
      </section>
    </div>
  )
}
