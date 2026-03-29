import { useState } from 'react'
import { api, Device, Feed } from '../api'
import StatusBadge from './StatusBadge'
import ColorPicker from './ColorPicker'

interface Props {
  device: Device
  feeds: Feed[]
  onUpdated: (device: Device) => void
  onDeleted: (id: number) => void
}

export default function DeviceCard({ device, feeds, onUpdated, onDeleted }: Props) {
  const [saving, setSaving] = useState(false)
  const [color, setColor] = useState(device.color)
  const [feedIds, setFeedIds] = useState<string[]>(device.feed_ids)

  function toggleFeed(name: string) {
    if (name === 'default') return  // always included
    setFeedIds(prev => {
      if (prev.includes(name)) return prev.filter(f => f !== name)
      if (prev.length >= 2) return prev  // already at max
      return [...prev, name]
    })
  }

  async function save() {
    setSaving(true)
    try {
      const updated = await api.updateDevice(device.device_id, { color, feed_ids: feedIds })
      onUpdated(updated)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm(`Delete device ${device.device_id}?`)) return
    await api.deleteDevice(device.device_id)
    onDeleted(device.id)
  }

  const dirty = color !== device.color || feedIds.join(',') !== device.feed_ids.join(',')

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800">{device.name}</span>
            <StatusBadge connected={device.is_connected} />
          </div>
          <span className="text-xs text-gray-400 font-mono">{device.device_id}</span>
        </div>
        <button
          onClick={remove}
          className="text-gray-300 hover:text-red-400 text-sm"
          title="Delete"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 w-14">Color</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="flex items-start gap-3">
          <span className="text-sm text-gray-500 w-14 pt-0.5">Feeds</span>
          <div className="flex flex-col gap-1">
            {feeds.map(f => {
              const isDefault = f.name === 'default'
              const checked = feedIds.includes(f.name)
              const atMax = feedIds.length >= 2 && !checked
              return (
                <label
                  key={f.name}
                  className={`flex items-center gap-2 text-sm ${isDefault || atMax ? 'opacity-50' : 'cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isDefault || (atMax && !checked)}
                    onChange={() => toggleFeed(f.name)}
                    className="accent-rose-500"
                  />
                  {f.name}
                  {isDefault && <span className="text-xs text-gray-400">(always)</span>}
                </label>
              )
            })}
          </div>
        </div>
      </div>

      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="mt-3 w-full text-sm bg-rose-500 hover:bg-rose-600 text-white rounded-lg py-1.5 font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      )}
    </div>
  )
}
