import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import GlobalFeedPage from './pages/GlobalFeedPage'
import RawSignalPage from './pages/RawSignalPage'
import AdminPage from './pages/AdminPage'
import ProvisionPage from './pages/ProvisionPage'
import DeviceEntryPage from './pages/DeviceEntryPage'
import { useDeviceStore } from './store/device'

function DeviceGuard({ children }: { children: React.ReactNode }) {
  const deviceId = useDeviceStore(s => s.deviceId)
  return deviceId ? <>{children}</> : <Navigate to="/enter" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/enter" element={<DeviceEntryPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route
          path="/"
          element={
            <DeviceGuard>
              <Layout />
            </DeviceGuard>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="feed" element={<GlobalFeedPage />} />
          <Route path="raw" element={<RawSignalPage />} />
          <Route path="provision" element={<ProvisionPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
