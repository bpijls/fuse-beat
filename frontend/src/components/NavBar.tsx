import { Link, useLocation } from 'react-router-dom'
import { useDeviceStore } from '../store/device'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/feed', label: 'Global Feed' },
  { to: '/raw', label: 'Raw Signal' },
  { to: '/provision', label: 'Provision' },
]

export default function NavBar() {
  const location = useLocation()
  const deviceId = useDeviceStore(s => s.deviceId)

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 max-w-5xl flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <span className="font-bold text-rose-500 mr-4 text-lg">♥ FuseBeat</span>
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                location.pathname === to
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        {deviceId && (
          <span className="text-xs text-gray-400 font-mono">{deviceId}</span>
        )}
      </div>
    </nav>
  )
}
