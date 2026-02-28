import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface BankPolicy {
  id?: number
  bank_name: string
  policy_name: string
  min_income?: number
  max_ltv?: number
  interest_rate?: number
  requirements: string
  notes: string
}

function BankPolicies() {
  const [policies, setPolicies] = useState<BankPolicy[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newPolicy, setNewPolicy] = useState<Partial<BankPolicy>>({
    bank_name: '',
    policy_name: '',
    requirements: '',
    notes: ''
  })

  useEffect(() => {
    loadPolicies()
  }, [])

  const loadPolicies = async () => {
    try {
      const data = await invoke<BankPolicy[]>('get_bank_policies')
      setPolicies(data)
    } catch (error) {
      console.error('Failed to load policies:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await invoke('create_bank_policy', { policy: newPolicy })
      setShowForm(false)
      setNewPolicy({
        bank_name: '',
        policy_name: '',
        requirements: '',
        notes: ''
      })
      loadPolicies()
    } catch (error) {
      console.error('Failed to create policy:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Bank Policies</h2>
          <p className="text-sm text-gray-500 mt-1">
            Store and manage lending policies for each bank
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
        >
          {showForm ? 'Cancel' : 'Add Policy'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">New Bank Policy</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Bank Name</label>
                <input
                  type="text"
                  value={newPolicy.bank_name}
                  onChange={(e) => setNewPolicy({...newPolicy, bank_name: e.target.value})}
                  className="input"
                  placeholder="e.g., Commonwealth Bank"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Policy Name</label>
                <input
                  type="text"
                  value={newPolicy.policy_name}
                  onChange={(e) => setNewPolicy({...newPolicy, policy_name: e.target.value})}
                  className="input"
                  placeholder="e.g., Standard Variable"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Min Income</label>
                <input
                  type="number"
                  value={newPolicy.min_income || ''}
                  onChange={(e) => setNewPolicy({...newPolicy, min_income: parseFloat(e.target.value)})}
                  className="input"
                  placeholder="$"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Max LTV (%)</label>
                <input
                  type="number"
                  value={newPolicy.max_ltv || ''}
                  onChange={(e) => setNewPolicy({...newPolicy, max_ltv: parseFloat(e.target.value)})}
                  className="input"
                  placeholder="80"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newPolicy.interest_rate || ''}
                  onChange={(e) => setNewPolicy({...newPolicy, interest_rate: parseFloat(e.target.value)})}
                  className="input"
                  placeholder="5.5"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Requirements</label>
              <textarea
                value={newPolicy.requirements}
                onChange={(e) => setNewPolicy({...newPolicy, requirements: e.target.value})}
                className="input"
                rows={3}
                placeholder="e.g., Min 2 years employment, good credit score..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={newPolicy.notes}
                onChange={(e) => setNewPolicy({...newPolicy, notes: e.target.value})}
                className="input"
                rows={2}
              />
            </div>
            <button type="submit" className="btn-primary">Save Policy</button>
          </form>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Policy Library</h3>
        {policies.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No policies added yet.</p>
            <p className="text-sm text-gray-400 mt-2">
              Add your first bank policy to start matching clients
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {policies.map((policy) => (
              <div key={policy.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-lg">{policy.bank_name}</h4>
                  {policy.interest_rate && (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                      {policy.interest_rate}%
                    </span>
                  )}
                </div>
                <p className="text-primary-600 font-medium mb-2">{policy.policy_name}</p>
                <div className="text-sm text-gray-600 space-y-1">
                  {policy.min_income && (
                    <p>Min Income: ${policy.min_income.toLocaleString()}</p>
                  )}
                  {policy.max_ltv && (
                    <p>Max LTV: {policy.max_ltv}%</p>
                  )}
                </div>
                {policy.requirements && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-gray-700">{policy.requirements}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Coming Soon</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Automatic policy updates from bank websites</li>
          <li>• Smart client-to-bank matching</li>
          <li>• Rate change alerts</li>
        </ul>
      </div>
    </div>
  )
}

export default BankPolicies