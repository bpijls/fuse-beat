import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DeviceStore {
  deviceId: string | null
  setDeviceId: (id: string) => void
  clearDevice: () => void
}

export const useDeviceStore = create<DeviceStore>()(
  persist(
    (set) => ({
      deviceId: null,
      setDeviceId: (id) => set({ deviceId: id.toUpperCase() }),
      clearDevice: () => set({ deviceId: null }),
    }),
    { name: 'fusebeat-device' },
  ),
)
