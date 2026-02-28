import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface Client {
  id?: number
  first_name: string
  last_name: string
  email: string
  phone: string
  income?: number
  payg?: number
  assets?: number
  liabilities?: number
  notes: string
  home_address?: string
  investment_addresses?: string
  properties_viewing?: string
  available_deposit?: number
  monthly_expenses?: number
  goals?: string
  created_at: string
  updated_at: string
}

interface Document {
  id?: number
  client_id: number
  filename: string
  document_type: string
  file_path: string
  file_data?: string
  uploaded_at: string
}

interface Meeting {
  id?: number
  client_id: number
  client_name: string
  client_email: string
  title: string
  recording_path?: string
  transcript?: string
  summary?: string
  meeting_date: string
  duration_seconds?: number
  notes?: string
}

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

interface PolicyMatch {
  policy: BankPolicy
  suitability: 'Eligible' | 'Borderline' | 'Not Eligible'
  incomePass: boolean
  lvrPass: boolean
  borrowingPower: number
  incomeReason: string
  lvrReason: string
}

function calculatePolicyMatches(client: Client, policies: BankPolicy[]): PolicyMatch[] {
  const income = client.income || 0
  const deposit = client.available_deposit || 0
  const liabilities = client.liabilities || 0
  const annualExpenses = (client.monthly_expenses || 0) * 12

  const borrowingPower = Math.max(0, (income - annualExpenses) * 6 - liabilities)

  const matches: PolicyMatch[] = policies.map(policy => {
    const minIncome = policy.min_income || 0
    const maxLtv = policy.max_ltv || 100

    const incomePass = income >= minIncome
    const incomeReason = incomePass
      ? `Income $${income.toLocaleString()} meets minimum $${minIncome.toLocaleString()}`
      : `Income $${income.toLocaleString()} below minimum $${minIncome.toLocaleString()}`

    const loanAmount = borrowingPower
    const totalProperty = deposit + loanAmount
    const lvr = totalProperty > 0 ? ((loanAmount / totalProperty) * 100) : 100
    const lvrPass = lvr <= maxLtv

    const lvrReason = lvrPass
      ? `LVR ${lvr.toFixed(1)}% within max ${maxLtv}%`
      : `LVR ${lvr.toFixed(1)}% exceeds max ${maxLtv}%`

    let suitability: PolicyMatch['suitability']
    if (incomePass && lvrPass) {
      suitability = 'Eligible'
    } else if (incomePass || lvrPass) {
      suitability = 'Borderline'
    } else {
      suitability = 'Not Eligible'
    }

    return { policy, suitability, incomePass, lvrPass, borrowingPower, incomeReason, lvrReason }
  })

  const order = { 'Eligible': 0, 'Borderline': 1, 'Not Eligible': 2 }
  matches.sort((a, b) => order[a.suitability] - order[b.suitability])

  return matches
}

function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientDocuments, setClientDocuments] = useState<Document[]>([])
  const [clientMeetings, setClientMeetings] = useState<Meeting[]>([])
  const [bankPolicies, setBankPolicies] = useState<BankPolicy[]>([])
  const [newClient, setNewClient] = useState<Partial<Client>>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    income: undefined,
    payg: undefined,
    assets: undefined,
    liabilities: undefined,
    notes: '',
    home_address: '',
    investment_addresses: '',
    properties_viewing: '',
    available_deposit: undefined,
    monthly_expenses: undefined,
    goals: ''
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadDocType, setUploadDocType] = useState('bank_statement')
  const [expandedMeetingId, setExpandedMeetingId] = useState<number | null>(null)
  const [editingSummaryId, setEditingSummaryId] = useState<number | null>(null)
  const [editedSummary, setEditedSummary] = useState('')
  const [previewDoc, setPreviewDoc] = useState<{ filename: string; fileData: string } | null>(null)
  const [policyMatchExpanded, setPolicyMatchExpanded] = useState(false)

  useEffect(() => {
    loadClients()
    loadBankPolicies()
  }, [])

  const loadClients = async () => {
    try {
      const data = await invoke<Client[]>('get_clients')
      setClients(data)
    } catch (error) {
      console.error('Failed to load clients:', error)
    }
  }

  const loadBankPolicies = async () => {
    try {
      const data = await invoke<BankPolicy[]>('get_bank_policies')
      setBankPolicies(data)
    } catch (error) {
      console.error('Failed to load bank policies:', error)
    }
  }

  const loadClientDocuments = async (clientId: number) => {
    try {
      const docs = await invoke<Document[]>('get_client_documents', { clientId })
      setClientDocuments(docs)
    } catch (error) {
      console.error('Failed to load documents:', error)
      setClientDocuments([])
    }
  }

  const loadClientMeetings = async (clientId: number) => {
    try {
      const meetings = await invoke<Meeting[]>('get_client_meetings', { clientId })
      setClientMeetings(meetings)
    } catch (error) {
      console.error('Failed to load meetings:', error)
      setClientMeetings([])
    }
  }

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client)
    if (client.id) {
      loadClientDocuments(client.id)
      loadClientMeetings(client.id)
    }
  }

  const handleBack = () => {
    setSelectedClient(null)
    setClientDocuments([])
    setClientMeetings([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await invoke('create_client', { client: newClient })
      setShowForm(false)
      setNewClient({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        income: undefined,
        payg: undefined,
        assets: undefined,
        liabilities: undefined,
        notes: '',
        home_address: '',
        investment_addresses: '',
        properties_viewing: '',
        available_deposit: undefined,
        monthly_expenses: undefined,
        goals: ''
      })
      loadClients()
    } catch (error) {
      console.error('Failed to create client:', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedClient?.id) return

    try {
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      await invoke('upload_client_document', {
        clientId: selectedClient.id,
        filename: file.name,
        documentType: uploadDocType,
        filePath: file.name,
        fileData,
      })
      loadClientDocuments(selectedClient.id)
    } catch (error) {
      console.error('Failed to upload document:', error)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDocumentClick = async (doc: Document) => {
    if (!doc.id) return
    try {
      const fileData = await invoke<string | null>('get_document_data', { documentId: doc.id })
      if (fileData) {
        setPreviewDoc({ filename: doc.filename, fileData })
      } else {
        setPreviewDoc({ filename: doc.filename, fileData: '' })
      }
    } catch (error) {
      console.error('Failed to load document data:', error)
    }
  }

  const getDocCountByType = (type: string) => {
    return clientDocuments.filter(d => d.document_type === type).length
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || ''
  }

  const renderDocumentPreview = () => {
    if (!previewDoc) return null
    const ext = getFileExtension(previewDoc.filename)
    const hasData = previewDoc.fileData && previewDoc.fileData.length > 0

    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={() => setPreviewDoc(null)}
      >
        <div
          className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">{previewDoc.filename}</h3>
            <button
              onClick={() => setPreviewDoc(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px]">
            {!hasData ? (
              <div className="text-center text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>No preview available for this document.</p>
                <p className="text-sm mt-1">This document was imported before preview support was added.</p>
              </div>
            ) : ext === 'pdf' ? (
              <embed
                src={previewDoc.fileData}
                type="application/pdf"
                className="w-full h-[70vh]"
              />
            ) : ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? (
              <img
                src={previewDoc.fileData}
                alt={previewDoc.filename}
                className="max-w-full max-h-[70vh] object-contain"
              />
            ) : (
              <div className="text-center text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>Preview not supported for this file type (.{ext})</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Client Detail View
  if (selectedClient) {
    const policyMatches = calculatePolicyMatches(selectedClient, bankPolicies)
    const hasMissingFields = !selectedClient.income || !selectedClient.available_deposit || !selectedClient.liabilities || !selectedClient.monthly_expenses

    return (
      <div className="space-y-6">
        {renderDocumentPreview()}

        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Clients
          </button>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold">
              {selectedClient.first_name} {selectedClient.last_name}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Added {new Date(selectedClient.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Client Info */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Contact Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">Email</label>
              <p className="mt-1">{selectedClient.email || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Phone</label>
              <p className="mt-1">{selectedClient.phone || '-'}</p>
            </div>
          </div>
        </div>

        {/* Address Details */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Address Details</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-500">Home Address</label>
            <p className="mt-1">{selectedClient.home_address || '-'}</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-500 mb-2">Investment Properties</label>
            {selectedClient.investment_addresses ? (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-2">Address</th>
                      <th className="px-4 py-2 text-right">Est. Current Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedClient.investment_addresses.split('\n').filter(Boolean).map((line, i) => {
                      const parts = line.split('|').map(s => s.trim())
                      const addr = parts[0] || ''
                      const value = parts[1] || '-'
                      return (
                        <tr key={i}>
                          <td className="px-4 py-2 text-sm">{addr}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium">{value}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No investment properties recorded</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-2">Properties Currently Being Viewed</label>
            {selectedClient.properties_viewing ? (
              <ul className="space-y-1">
                {selectedClient.properties_viewing.split('\n').filter(Boolean).map((addr, i) => (
                  <li key={i} className="text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                    {addr}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No properties currently being viewed</p>
            )}
          </div>
        </div>

        {/* Financial Details */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-1">Financial Details</h3>
          <p className="text-sm text-gray-500 mb-4">
            Auto-populated from meeting transcriptions and email imports. You can also enter or edit these manually.
          </p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">Annual Income</label>
              <p className="mt-1">${selectedClient.income?.toLocaleString() || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">PAYG</label>
              <p className="mt-1">${selectedClient.payg?.toLocaleString() || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Assets</label>
              <p className="mt-1">${selectedClient.assets?.toLocaleString() || '-'}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">Liabilities</label>
              <p className="mt-1">${selectedClient.liabilities?.toLocaleString() || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Available Deposit</label>
              <p className="mt-1">${selectedClient.available_deposit?.toLocaleString() || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Monthly Expenses</label>
              <p className="mt-1">${selectedClient.monthly_expenses?.toLocaleString() || '-'}</p>
            </div>
          </div>
          {selectedClient.goals && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-500">Goals</label>
              <p className="mt-1 text-sm whitespace-pre-line">{selectedClient.goals}</p>
            </div>
          )}
          {selectedClient.notes && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-500">Notes</label>
              <p className="mt-1 text-sm">{selectedClient.notes}</p>
            </div>
          )}
        </div>

        {/* Policy Matching - Collapsible */}
        <div className="card">
          <button
            onClick={() => setPolicyMatchExpanded(!policyMatchExpanded)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h3 className="text-lg font-semibold">Policy Matching</h3>
              <p className="text-sm text-gray-500">
                {policyMatches.length} policies compared
                {policyMatches.length > 0 && (
                  <span className="ml-2">
                    ({policyMatches.filter(m => m.suitability === 'Eligible').length} eligible,{' '}
                    {policyMatches.filter(m => m.suitability === 'Borderline').length} borderline)
                  </span>
                )}
              </p>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${policyMatchExpanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {policyMatchExpanded && (
            <div className="mt-4">
              {/* Financial snapshot */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Income</p>
                  <p className="font-semibold text-sm">${(selectedClient.income || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Deposit</p>
                  <p className="font-semibold text-sm">${(selectedClient.available_deposit || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Liabilities</p>
                  <p className="font-semibold text-sm">${(selectedClient.liabilities || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Expenses/mo</p>
                  <p className="font-semibold text-sm">${(selectedClient.monthly_expenses || 0).toLocaleString()}</p>
                </div>
              </div>

              {hasMissingFields && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-amber-800">
                    Add income, deposit, liabilities, and monthly expenses for accurate matching.
                  </p>
                </div>
              )}

              {policyMatches.length === 0 ? (
                <p className="text-gray-500 text-sm">No bank policies available.</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {policyMatches.map((match) => {
                    const borderColor = match.suitability === 'Eligible'
                      ? 'border-green-300 bg-green-50'
                      : match.suitability === 'Borderline'
                        ? 'border-yellow-300 bg-yellow-50'
                        : 'border-red-200 bg-red-50'

                    const badgeColor = match.suitability === 'Eligible'
                      ? 'bg-green-100 text-green-800'
                      : match.suitability === 'Borderline'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'

                    return (
                      <div key={match.policy.id} className={`border rounded-lg p-3 ${borderColor}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-gray-700">{match.policy.bank_name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeColor}`}>
                            {match.suitability}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 mb-1 truncate" title={match.policy.policy_name}>
                          {match.policy.policy_name}
                        </p>
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                          <span className="font-semibold text-blue-700">{match.policy.interest_rate?.toFixed(2)}%</span>
                          <span>Borrow: ${(match.borrowingPower / 1000).toFixed(0)}K</span>
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-xs">
                            {match.incomePass ? (
                              <svg className="w-3 h-3 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                            <span className="text-gray-500 truncate">Income min ${((match.policy.min_income || 0) / 1000).toFixed(0)}K</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            {match.lvrPass ? (
                              <svg className="w-3 h-3 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                            <span className="text-gray-500 truncate">Max LVR {match.policy.max_ltv}%</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Meetings Section */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">
            Meetings ({clientMeetings.length})
          </h3>
          {clientMeetings.length === 0 ? (
            <p className="text-gray-500 text-sm">No meetings recorded yet for this client.</p>
          ) : (
            <div className="space-y-3">
              {clientMeetings.map((meeting) => {
                const isExpanded = expandedMeetingId === meeting.id
                const isEditingSummary = editingSummaryId === meeting.id

                return (
                  <div key={meeting.id} className="bg-gray-50 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedMeetingId(isExpanded ? null : (meeting.id ?? null))}
                      className="w-full p-3 text-left hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <p className="font-medium text-sm">{meeting.title}</p>
                        </div>
                        <p className="text-xs text-gray-400">
                          {new Date(meeting.meeting_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="ml-6">
                        <p className="text-xs text-gray-500">
                          Duration: {formatDuration(meeting.duration_seconds)}
                        </p>
                        {!isExpanded && meeting.summary && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{meeting.summary}</p>
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 ml-6 space-y-3">
                        {/* AI Summary */}
                        <div className="bg-white border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wide">AI Summary</h4>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">Auto-generated</span>
                            </div>
                            {!isEditingSummary && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingSummaryId(meeting.id ?? null)
                                  setEditedSummary(meeting.summary || '')
                                }}
                                className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                          {isEditingSummary ? (
                            <div>
                              <textarea
                                value={editedSummary}
                                onChange={(e) => setEditedSummary(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                rows={4}
                              />
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => {
                                    setClientMeetings(prev =>
                                      prev.map(m => m.id === meeting.id ? { ...m, summary: editedSummary } : m)
                                    )
                                    setEditingSummaryId(null)
                                  }}
                                  className="text-xs px-3 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingSummaryId(null)}
                                  className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-700">{meeting.summary || 'No summary generated yet.'}</p>
                          )}
                        </div>

                        {/* Broker Notes */}
                        {meeting.notes && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Broker Notes</h4>
                            <p className="text-sm text-gray-600 italic">{meeting.notes}</p>
                          </div>
                        )}

                        {/* Full Transcript */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Full Transcript</h4>
                          {meeting.transcript ? (
                            <div className="bg-white border border-gray-200 rounded-lg p-3 max-h-60 overflow-y-auto">
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{meeting.transcript}</p>
                            </div>
                          ) : (
                            <div className="bg-gray-100 border border-dashed border-gray-300 rounded-lg p-4 text-center">
                              <p className="text-sm text-gray-400">Transcript will appear here once the meeting is recorded and processed.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* AI Summary Placeholder */}
        <div className="border-2 border-dashed border-purple-300 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-purple-700">AI Client Summary</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
              Coming Soon
            </span>
          </div>
          <p className="text-sm text-gray-500">
            An AI-generated summary of this client will appear here, combining insights from meeting transcriptions, uploaded documents, and financial data to give you a complete picture at a glance.
          </p>
        </div>

        {/* Document Categories */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 mx-auto bg-green-100 rounded-lg flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h4 className="font-medium text-sm">Bank Statements</h4>
              <p className="text-sm text-gray-500">{getDocCountByType('bank_statement')} files</p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 mx-auto bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="font-medium text-sm">PAYG Statements</h4>
              <p className="text-sm text-gray-500">{getDocCountByType('payg_statement')} files</p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 mx-auto bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              </div>
              <h4 className="font-medium text-sm">Tax Statements</h4>
              <p className="text-sm text-gray-500">{getDocCountByType('tax_statement')} files</p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 mx-auto bg-orange-100 rounded-lg flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="font-medium text-sm">Contracts</h4>
              <p className="text-sm text-gray-500">{getDocCountByType('contract')} files</p>
            </div>
          </div>

          {/* Upload Area */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-6">
            <svg className="w-10 h-10 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-600 mb-3">Upload a document for this client</p>
            <div className="flex items-center justify-center gap-3">
              <select
                value={uploadDocType}
                onChange={(e) => setUploadDocType(e.target.value)}
                className="input w-auto"
              >
                <option value="bank_statement">Bank Statement</option>
                <option value="payg_statement">PAYG Statement</option>
                <option value="tax_statement">Tax Statement</option>
                <option value="contract">Contract</option>
                <option value="other">Other</option>
              </select>
              <button
                className="btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse Files
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Supported: PDF, JPG, PNG (max 10MB per file)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Document List */}
          {clientDocuments.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p>No documents uploaded yet for this client.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Filename</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-left py-2">Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {clientDocuments.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleDocumentClick(doc)}
                    >
                      <td className="py-2 text-sm text-primary-600 hover:text-primary-800">{doc.filename}</td>
                      <td className="py-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
                          {doc.document_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 text-sm text-gray-500">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Client List View
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Client Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
        >
          {showForm ? 'Cancel' : 'Add New Client'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">New Client</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">First Name</label>
                <input
                  type="text"
                  value={newClient.first_name}
                  onChange={(e) => setNewClient({...newClient, first_name: e.target.value})}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <input
                  type="text"
                  value={newClient.last_name}
                  onChange={(e) => setNewClient({...newClient, last_name: e.target.value})}
                  className="input"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                  className="input"
                />
              </div>
            </div>

            {/* Address Details Section */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Address Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Home Address</label>
                  <input
                    type="text"
                    value={newClient.home_address || ''}
                    onChange={(e) => setNewClient({...newClient, home_address: e.target.value})}
                    className="input"
                    placeholder="123 Main St, Sydney NSW 2000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Investment Properties</label>
                  <textarea
                    value={newClient.investment_addresses || ''}
                    onChange={(e) => setNewClient({...newClient, investment_addresses: e.target.value})}
                    className="input"
                    rows={3}
                    placeholder={"Address | Est. Value\ne.g. 10 George St, Sydney | $1,200,000"}
                  />
                  <p className="text-xs text-gray-400 mt-1">One property per line: Address | Estimated Value</p>
                </div>
              </div>
              <div className="mt-2">
                <label className="block text-sm font-medium mb-1">Properties Currently Being Viewed</label>
                <textarea
                  value={newClient.properties_viewing || ''}
                  onChange={(e) => setNewClient({...newClient, properties_viewing: e.target.value})}
                  className="input"
                  rows={2}
                  placeholder="One address per line"
                />
              </div>
            </div>

            {/* Financial Details Section */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-1">Financial Details</h4>
              <p className="text-xs text-gray-500 mb-3">
                Auto-populated from meeting transcriptions and email imports. You can also enter or edit these manually.
              </p>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Annual Income</label>
                  <input
                    type="number"
                    value={newClient.income || ''}
                    onChange={(e) => setNewClient({...newClient, income: e.target.value ? parseFloat(e.target.value) : undefined})}
                    className="input"
                    placeholder="$"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">PAYG</label>
                  <input
                    type="number"
                    value={newClient.payg || ''}
                    onChange={(e) => setNewClient({...newClient, payg: e.target.value ? parseFloat(e.target.value) : undefined})}
                    className="input"
                    placeholder="$"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Assets</label>
                  <input
                    type="number"
                    value={newClient.assets || ''}
                    onChange={(e) => setNewClient({...newClient, assets: e.target.value ? parseFloat(e.target.value) : undefined})}
                    className="input"
                    placeholder="$"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Liabilities</label>
                  <input
                    type="number"
                    value={newClient.liabilities || ''}
                    onChange={(e) => setNewClient({...newClient, liabilities: e.target.value ? parseFloat(e.target.value) : undefined})}
                    className="input"
                    placeholder="$"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Available Deposit</label>
                  <input
                    type="number"
                    value={newClient.available_deposit || ''}
                    onChange={(e) => setNewClient({...newClient, available_deposit: e.target.value ? parseFloat(e.target.value) : undefined})}
                    className="input"
                    placeholder="$"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Monthly Expenses</label>
                  <input
                    type="number"
                    value={newClient.monthly_expenses || ''}
                    onChange={(e) => setNewClient({...newClient, monthly_expenses: e.target.value ? parseFloat(e.target.value) : undefined})}
                    className="input"
                    placeholder="$"
                  />
                </div>
              </div>
            </div>

            {/* Goals */}
            <div>
              <label className="block text-sm font-medium mb-1">Goals</label>
              <textarea
                value={newClient.goals || ''}
                onChange={(e) => setNewClient({...newClient, goals: e.target.value})}
                className="input"
                rows={3}
                placeholder="Year 2: ...&#10;Year 5: ...&#10;Year 10: ..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={newClient.notes}
                onChange={(e) => setNewClient({...newClient, notes: e.target.value})}
                className="input"
                rows={3}
              />
            </div>
            <button type="submit" className="btn-primary">Save Client</button>
          </form>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Client List</h3>
        {clients.length === 0 ? (
          <p className="text-gray-500">No clients yet. Add your first client above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Contact</th>
                  <th className="text-left py-2">Income</th>
                  <th className="text-left py-2">Assets</th>
                  <th className="text-left py-2">Added</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleSelectClient(client)}
                  >
                    <td className="py-3">{client.first_name} {client.last_name}</td>
                    <td className="py-3">
                      <div className="text-sm">{client.email}</div>
                      <div className="text-sm text-gray-500">{client.phone}</div>
                    </td>
                    <td className="py-3">${client.income?.toLocaleString() || '-'}</td>
                    <td className="py-3">${client.assets?.toLocaleString() || '-'}</td>
                    <td className="py-3 text-sm text-gray-500">
                      {new Date(client.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Clients
