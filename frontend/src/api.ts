const BASE = ''  // proxied via vite to http://localhost:5000

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export const api = {
  // Devices
  listDevices: () =>
    request<Device[]>('/api/devices'),

  getDevice: (deviceId: string) =>
    request<Device>(`/api/devices/${deviceId}`),

  registerDevice: (device_id: string, name: string) =>
    request<Device>('/api/devices', { method: 'POST', body: JSON.stringify({ device_id, name }) }),

  updateDevice: (deviceId: string, patch: Partial<Device>) =>
    request<Device>(`/api/devices/${deviceId}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  deleteDevice: (deviceId: string) =>
    request('/api/devices/' + deviceId, { method: 'DELETE' }),

  // Feeds
  listFeeds: () =>
    request<Feed[]>('/api/feeds'),

  createFeed: (name: string, description: string) =>
    request<Feed>('/api/feeds', { method: 'POST', body: JSON.stringify({ name, description }) }),

  feedStatus: (feedName: string) =>
    request<FeedStatus>('/api/feeds/' + feedName + '/status'),

  // Admin
  adminStatus: () =>
    request<AdminStatus>('/api/admin/status'),

  startSimulator: (params: SimulatorParams) =>
    request('/api/admin/simulator/start', { method: 'POST', body: JSON.stringify(params) }),

  stopSimulator: () =>
    request('/api/admin/simulator/stop', { method: 'POST' }),
}

export interface Device {
  id: number
  device_id: string
  name: string
  color: string
  feed_ids: string[]
  is_connected: boolean
  last_seen: string | null
}

export interface Feed {
  id: number
  name: string
  description: string
  created_at: string
}

export interface FeedStatus {
  feed_id: string
  device_count: number
  devices: Array<{ id: string; bpm: number; color: string; feed_id: string }>
  fused_bpm: number | null
}

export interface AdminStatus {
  connected_devices: number
  devices: Array<{ id: string; bpm: number; color: string; feed_id: string }>
  feeds: Record<string, { bpm: number; device_count: number }>
  simulator_running: boolean
}

export interface SimulatorParams {
  n_devices: number
  feed_id: string
  bpm_min: number
  bpm_max: number
  ws_url: string
}
