import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDeviceStore } from '../store/device'

export default function DeviceEntryPage() {
  const navigate = useNavigate()
  const setDeviceId = useDeviceStore(s => s.setDeviceId)
  const [input, setInput] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const id = input.trim().toUpperCase()
    if (!id) return
    setDeviceId(id)
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="text-center mb-6">
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
            <span className="text-xs text-gray-400">Visible via <code>status</code> command in serial monitor</span>
          </label>
          <button
            type="submit"
            className="bg-rose-500 hover:bg-rose-600 text-white rounded-lg py-2 text-sm font-semibold transition-colors mt-1"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  )
}
