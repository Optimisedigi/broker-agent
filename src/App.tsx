import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Dashboard from './components/Dashboard'
import Clients from './components/Clients'
import BankPolicies from './components/BankPolicies'
import Meetings from './components/Meetings'
import Settings from './components/Settings'

type View = 'dashboard' | 'clients' | 'policies' | 'meetings' | 'settings'

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [stats, setStats] = useState<any>(null)
  const [logo, setLogo] = useState<string | null>(null)
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)

  useEffect(() => {
    loadDashboardStats()
    const saved = localStorage.getItem('broker_logo')
    if (saved) setLogo(saved)
  }, [])

  const loadDashboardStats = async () => {
    try {
      const data = await invoke('get_dashboard_stats')
      setStats(data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard stats={stats} />
      case 'clients':
        return <Clients />
      case 'policies':
        return <BankPolicies />
      case 'meetings':
        return <Meetings />
      case 'settings':
        return <Settings onLogoChange={setLogo} />
      default:
        return <Dashboard stats={stats} />
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg flex flex-col">
        <div className="p-6 border-b">
          {logo && (
            <img
              src={logo}
              alt="Company logo"
              className="max-w-[172px] max-h-[172px] object-contain mb-2"
            />
          )}
          <h1 className="text-xs font-bold text-primary-700">Broker Agent</h1>
          <p className="text-sm text-gray-500 mt-1">Beta; MVP</p>
        </div>
        <nav className="p-4 flex-1">
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'dashboard'
                    ? 'bg-primary-100 text-primary-700'
                    : 'hover:bg-gray-100'
                }`}
              >
                Dashboard
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView('clients')}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'clients'
                    ? 'bg-primary-100 text-primary-700'
                    : 'hover:bg-gray-100'
                }`}
              >
                Clients
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView('meetings')}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'meetings'
                    ? 'bg-primary-100 text-primary-700'
                    : 'hover:bg-gray-100'
                }`}
              >
                Meetings & Recording
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView('policies')}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'policies'
                    ? 'bg-primary-100 text-primary-700'
                    : 'hover:bg-gray-100'
                }`}
              >
                Bank Policies
              </button>
            </li>
          </ul>
        </nav>

        {/* How It Works */}
        <div className="px-4 pb-2">
          <button
            onClick={() => setHowItWorksOpen(!howItWorksOpen)}
            className="w-full text-left px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-between"
          >
            <span>How It Works</span>
            <svg
              className={`w-4 h-4 transition-transform ${howItWorksOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {howItWorksOpen && (
            <ol className="mt-2 ml-4 mr-2 mb-2 space-y-2 text-xs text-gray-500 list-decimal list-outside pl-3">
              <li>Add a new client (name + email)</li>
              <li>Schedule & record a meeting</li>
              <li>Meeting auto-transcribes & summarises</li>
              <li>Documents auto-import from client emails</li>
              <li>Match client to bank policies</li>
              <li>Generate & send proposal</li>
            </ol>
          )}
        </div>

        {/* Settings */}
        <div className="p-4 border-t">
          <button
            onClick={() => setCurrentView('settings')}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors text-sm ${
              currentView === 'settings'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm px-8 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold capitalize">{currentView}</h2>
            <div className="text-sm text-gray-500">
              {new Date().toLocaleDateString('en-AU', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </header>
        <main className="p-8">{renderView()}</main>
      </div>
    </div>
  )
}

export default App
