import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { invoke } from '@tauri-apps/api/core'
import { calculatePolicyMatches } from '../utils/policyMatching'
import type { Client, BankPolicy } from '../utils/policyMatching'
import { formatDuration, getFileExtension } from '../utils/formatters'

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

interface Deal {
  id?: number
  client_id: number
  property_address: string
  loan_amount?: number
  purchase_date?: string
  settlement_date?: string
  interest_rate?: number
  lender_name?: string
  loan_type?: string
  status: string
  notes?: string
  created_at: string
  updated_at: string
}

interface DealEvent {
  id?: number
  deal_id: number
  event_type: string
  event_date: string
  description?: string
  old_value?: string
  new_value?: string
  created_at: string
}

const PIPELINE_STAGES_NEW = [
  { key: 'lead_received', label: 'Lead Received' },
  { key: 'discovery_call', label: 'Discovery Call' },
  { key: 'financial_assessment', label: 'Financial Assessment' },
  { key: 'loan_strategy', label: 'Loan Strategy Prepared' },
  { key: 'client_recommendation', label: 'Client Recommendation' },
  { key: 'documents_collected', label: 'Documents Collected' },
  { key: 'application_submitted', label: 'Application Submitted' },
  { key: 'conditional_approval', label: 'Conditional Approval' },
  { key: 'formal_approval', label: 'Formal Approval' },
  { key: 'loan_signing', label: 'Loan Signing' },
  { key: 'settlement', label: 'Settlement' },
  { key: 'post_settlement_review', label: 'Post-Settlement Review' },
]

const PIPELINE_STAGES_EXISTING = [
  { key: 'review', label: 'Review' },
  { key: 'refinance_assessment', label: 'Refinance Assessment' },
  { key: 'application_submitted', label: 'Application' },
  { key: 'approval', label: 'Approval' },
  { key: 'settlement', label: 'Settlement' },
  { key: 'complete', label: 'Complete' },
]

const REFERRAL_OPTIONS = [
  'Google', 'Social Media', 'Referral', 'Website', 'Real Estate Agent',
  'Financial Planner', 'Existing Client', 'Word of Mouth', 'Advertisement', 'Other'
]

function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientDocuments, setClientDocuments] = useState<Document[]>([])
  const [clientMeetings, setClientMeetings] = useState<Meeting[]>([])
  const [bankPolicies, setBankPolicies] = useState<BankPolicy[]>([])
  const [searchQuery, setSearchQuery] = useState('')
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
    goals: '',
    home_ownership: 'owned',
    client_status: 'new',
    referral_source: '',
    pipeline_stage: 'lead_received'
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadDocType, setUploadDocType] = useState('bank_statement')
  const [expandedMeetingId, setExpandedMeetingId] = useState<number | null>(null)
  const [editingSummaryId, setEditingSummaryId] = useState<number | null>(null)
  const [editedSummary, setEditedSummary] = useState('')
  const [previewDoc, setPreviewDoc] = useState<{ filename: string; fileData: string } | null>(null)
  const [policyMatchExpanded, setPolicyMatchExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing')
  const [clientDeals, setClientDeals] = useState<Deal[]>([])
  const [dealEvents, setDealEvents] = useState<Record<number, DealEvent[]>>({})
  const [expandedDealId, setExpandedDealId] = useState<number | null>(null)
  const [showAddDeal, setShowAddDeal] = useState(false)
  const [showAddEvent, setShowAddEvent] = useState<number | null>(null)
  const [newDeal, setNewDeal] = useState<Partial<Deal>>({
    property_address: '', lender_name: '', loan_type: 'variable', status: 'active', notes: ''
  })
  const [newEvent, setNewEvent] = useState<Partial<DealEvent>>({
    event_type: 'note', event_date: new Date().toISOString().split('T')[0], description: ''
  })
  const [dragOver, setDragOver] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [editingAiSummary, setEditingAiSummary] = useState(false)
  const [aiSummaryText, setAiSummaryText] = useState('')
  const [transcriptExpanded, setTranscriptExpanded] = useState<number | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Client>>({})
  const [renamingDocId, setRenamingDocId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    loadClients()
    loadBankPolicies()
  }, [])

  const loadClients = async () => {
    try {
      const data = await invoke<Client[]>('get_clients')
      console.log('Loaded clients:', data.length, data)
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

  const loadClientDeals = async (clientId: number) => {
    try {
      const deals = await invoke<Deal[]>('get_client_deals', { clientId })
      setClientDeals(deals)
    } catch (error) {
      console.error('Failed to load deals:', error)
      setClientDeals([])
    }
  }

  const loadDealEvents = async (dealId: number) => {
    try {
      const events = await invoke<DealEvent[]>('get_deal_events', { dealId })
      setDealEvents(prev => ({ ...prev, [dealId]: events }))
    } catch (error) {
      console.error('Failed to load deal events:', error)
    }
  }

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client)
    if (client.id) {
      loadClientDocuments(client.id)
      loadClientMeetings(client.id)
      loadClientDeals(client.id)
    }
  }

  const handleBack = () => {
    setSelectedClient(null)
    setClientDocuments([])
    setClientMeetings([])
    setClientDeals([])
    setDealEvents({})
    setExpandedDealId(null)
    setShowAddDeal(false)
    setShowAddEvent(null)
  }

  const handlePipelineStageClick = async (stageKey: string) => {
    if (!selectedClient?.id) return
    try {
      const updated = { ...selectedClient, pipeline_stage: stageKey }
      await invoke('update_client', { client: { ...updated, created_at: selectedClient.created_at, updated_at: selectedClient.updated_at } })
      setSelectedClient({ ...updated, updated_at: new Date().toISOString() })
      await loadClients()
    } catch (err) {
      console.error('Failed to update pipeline stage:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const result = await invoke('create_client', { client: newClient })
      console.log('Client created with id:', result)
      setActiveTab('new')
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
        goals: '',
        home_ownership: 'owned',
        client_status: 'new',
        referral_source: '',
        pipeline_stage: 'lead_received'
      })
      await loadClients()
    } catch (error: any) {
      console.error('Failed to create client:', error)
      alert('Failed to save client: ' + error)
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

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file || !selectedClient?.id) return
    const validExts = ['pdf', 'jpg', 'jpeg', 'png']
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!validExts.includes(ext)) return
    try {
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
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
      console.error('Failed to upload dropped document:', error)
    }
  }

  const handleDocumentClick = async (doc: Document) => {
    if (!doc.id) return
    try {
      // Try to open the file directly from disk using its file_path
      if (doc.file_path) {
        await invoke('open_file', { path: doc.file_path })
        return
      }
      // Fallback: try to show preview from stored data
      const fileData = await invoke<string | null>('get_document_data', { documentId: doc.id })
      if (fileData) {
        setPreviewDoc({ filename: doc.filename, fileData })
      } else {
        setPreviewDoc({ filename: doc.filename, fileData: '' })
      }
    } catch (error) {
      console.error('Failed to open document:', error)
      // Fallback to preview
      try {
        const fileData = await invoke<string | null>('get_document_data', { documentId: doc.id })
        setPreviewDoc({ filename: doc.filename, fileData: fileData || '' })
      } catch (_) {}
    }
  }

  const getDocCountByType = (type: string) => {
    return clientDocuments.filter(d => d.document_type === type).length
  }


  const renderDocumentPreview = () => {
    if (!previewDoc) return null
    const ext = getFileExtension(previewDoc.filename)
    const hasData = previewDoc.fileData && previewDoc.fileData.length > 0

    return createPortal(
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
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
      </div>,
      document.body
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
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">
                {editingProfile ? (
                  <span className="flex gap-2">
                    <input value={editForm.first_name || ''} onChange={e => setEditForm({...editForm, first_name: e.target.value})} className="input text-xl font-semibold w-40" />
                    <input value={editForm.last_name || ''} onChange={e => setEditForm({...editForm, last_name: e.target.value})} className="input text-xl font-semibold w-40" />
                  </span>
                ) : (
                  <>{selectedClient.first_name} {selectedClient.last_name}</>
                )}
              </h2>
              <button
                onClick={async () => {
                  const newStatus = selectedClient.client_status === 'new' ? 'existing' : 'new'
                  try {
                    await invoke('update_client_status', { clientId: selectedClient.id, status: newStatus })
                    setSelectedClient({...selectedClient, client_status: newStatus})
                    await loadClients()
                  } catch (err) { console.error(err) }
                }}
                className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 ${
                  selectedClient.client_status === 'existing'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
                title="Click to toggle status"
              >
                {selectedClient.client_status === 'existing' ? 'Existing Client' : 'New Client'}
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Added {new Date(selectedClient.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            {editingProfile ? (
              <>
                <button
                  onClick={async () => {
                    try {
                      await invoke('update_client', { client: { ...editForm, id: selectedClient.id, created_at: selectedClient.created_at, updated_at: selectedClient.updated_at } })
                      const updated = { ...selectedClient, ...editForm, updated_at: new Date().toISOString() }
                      setSelectedClient(updated)
                      setEditingProfile(false)
                      await loadClients()
                    } catch (err: any) {
                      console.error('Failed to update client:', err)
                      alert('Failed to save: ' + err)
                    }
                  }}
                  className="text-sm px-3 py-1.5 rounded bg-primary-600 text-white hover:bg-primary-700"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingProfile(false)}
                  className="text-sm px-3 py-1.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setEditingProfile(true); setEditForm({...selectedClient}) }}
                  className="text-sm px-3 py-1.5 rounded bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200"
                >
                  Edit Profile
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmText('') }}
                  className="text-sm px-3 py-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                >
                  Delete Client
                </button>
              </>
            )}
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="card bg-red-50 border-red-200">
            <h3 className="text-sm font-semibold text-red-800 mb-2">Confirm Deletion</h3>
            <p className="text-sm text-red-700 mb-3">
              This will permanently delete <strong>{selectedClient.first_name} {selectedClient.last_name}</strong> and all associated data (deals, documents, meetings). Type <strong>DELETE</strong> to confirm.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="input text-sm w-32"
                placeholder="Type DELETE"
              />
              <button
                onClick={async () => {
                  if (deleteConfirmText !== 'DELETE' || !selectedClient.id) return
                  try {
                    await invoke('delete_client', { clientId: selectedClient.id })
                    setShowDeleteConfirm(false)
                    setSelectedClient(null)
                    await loadClients()
                  } catch (error) {
                    console.error('Failed to delete client:', error)
                  }
                }}
                disabled={deleteConfirmText !== 'DELETE'}
                className={`text-sm px-3 py-1.5 rounded font-medium ${
                  deleteConfirmText === 'DELETE'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Delete Permanently
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-sm px-3 py-1.5 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Pipeline Stages */}
        {(() => {
          const stages = selectedClient.client_status === 'existing' ? PIPELINE_STAGES_EXISTING : PIPELINE_STAGES_NEW
          const currentStage = selectedClient.pipeline_stage || (selectedClient.client_status === 'existing' ? 'review' : 'lead_received')
          const currentIndex = stages.findIndex(s => s.key === currentStage)

          return (
            <div className="card">
              <h3 className="text-lg font-semibold mb-3">Pipeline Progress</h3>
              <div className="flex flex-wrap gap-2">
                {stages.map((stage, index) => {
                  const isCompleted = index < currentIndex
                  const isCurrent = index === currentIndex

                  return (
                    <button
                      key={stage.key}
                      onClick={() => handlePipelineStageClick(stage.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                        isCompleted
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : isCurrent
                            ? 'bg-blue-500 text-white border-blue-500 ring-2 ring-blue-200 hover:bg-blue-600'
                            : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 hover:text-gray-600'
                      }`}
                      title={`Set to: ${stage.label}`}
                    >
                      {isCompleted && (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {stage.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Contact & Address Details */}
        <div className="card">
          <div className="grid grid-cols-2 gap-6">
            {/* Left column: Contact */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Contact</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-500 w-12">Email</label>
                  {editingProfile ? (
                    <input value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} className="input text-sm flex-1" />
                  ) : (
                    <p className="text-sm">{selectedClient.email || '-'}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-500 w-12">Phone</label>
                  {editingProfile ? (
                    <input value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="input text-sm flex-1" />
                  ) : (
                    <p className="text-sm">{selectedClient.phone || '-'}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-500 w-12">Source</label>
                  {editingProfile ? (
                    <select value={editForm.referral_source || ''} onChange={e => setEditForm({...editForm, referral_source: e.target.value})} className="input text-sm flex-1">
                      <option value="">-- Select --</option>
                      {REFERRAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm">{selectedClient.referral_source || '-'}</p>
                  )}
                </div>
              </div>
              <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">Home Address</h3>
              {editingProfile ? (
                <div className="space-y-2">
                  <input value={editForm.home_address || ''} onChange={e => setEditForm({...editForm, home_address: e.target.value})} className="input text-sm" placeholder="123 Main St, Sydney NSW 2000" />
                  <select value={editForm.home_ownership || 'owned'} onChange={e => setEditForm({...editForm, home_ownership: e.target.value})} className="input text-sm">
                    <option value="owned">Owner Occupied</option>
                    <option value="joint">Joint Ownership</option>
                    <option value="renting">Renting</option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm">{selectedClient.home_address || '-'}</p>
                  {selectedClient.home_address && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      selectedClient.home_ownership === 'renting' ? 'bg-orange-100 text-orange-800'
                      : selectedClient.home_ownership === 'joint' ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedClient.home_ownership === 'renting' ? 'Renting'
                       : selectedClient.home_ownership === 'joint' ? 'Joint Ownership'
                       : 'Owner Occupied'}
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* Right column: Properties */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Investment Properties</h3>
              {editingProfile ? (
                <textarea value={editForm.investment_addresses || ''} onChange={e => setEditForm({...editForm, investment_addresses: e.target.value})} className="input text-sm" rows={3} placeholder="Address | Value (one per line)" />
              ) : selectedClient.investment_addresses ? (
                <div className="overflow-hidden rounded-lg border border-gray-200 mb-3">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th className="px-3 py-1.5">Address</th>
                        <th className="px-3 py-1.5 text-right">Est. Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedClient.investment_addresses.split('\n').filter(Boolean).map((line, i) => {
                        const parts = line.split('|').map(s => s.trim())
                        return (
                          <tr key={i}>
                            <td className="px-3 py-1.5 text-sm">{parts[0] || ''}</td>
                            <td className="px-3 py-1.5 text-sm text-right font-medium">{parts[1] || '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400 mb-3">No investment properties recorded</p>
              )}
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Viewing</h3>
              {editingProfile ? (
                <textarea value={editForm.properties_viewing || ''} onChange={e => setEditForm({...editForm, properties_viewing: e.target.value})} className="input text-sm" rows={2} placeholder="One address per line" />
              ) : selectedClient.properties_viewing ? (
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
        </div>

        {/* AI Client Summary */}
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Client Summary</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">AI Generated</span>
            </div>
            {!editingAiSummary && (
              <button
                onClick={() => {
                  setEditingAiSummary(true)
                  setAiSummaryText(aiSummaryText || `${selectedClient.first_name} ${selectedClient.last_name} is an experienced property investor with a household income of $${(selectedClient.income || 0).toLocaleString()} and current portfolio of ${selectedClient.investment_addresses ? selectedClient.investment_addresses.split('\n').filter(Boolean).length : 0} investment properties. Total estimated assets are $${(selectedClient.assets || 0).toLocaleString()} against liabilities of $${(selectedClient.liabilities || 0).toLocaleString()}, with $${(selectedClient.available_deposit || 0).toLocaleString()} available as deposit for new acquisitions.\n\nCurrent strategy focuses on building a property portfolio in Sydney's Eastern Suburbs and North Shore. ${selectedClient.first_name} is well-organised and has a strong serviceability position, with rental income from existing properties supporting further borrowing capacity. Monthly expenses are $${(selectedClient.monthly_expenses || 0).toLocaleString()}.\n\nKey action items: Review rate competitiveness on existing loans, explore equity release for next acquisition, and continue monitoring properties in target suburbs.`)
                }}
                className="text-xs text-primary-600 hover:text-primary-800 font-medium"
              >
                Edit
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Auto-generated when client data changes. Last updated: {new Date(selectedClient.updated_at).toLocaleDateString()}
          </p>
          {editingAiSummary ? (
            <div>
              <textarea
                value={aiSummaryText}
                onChange={(e) => setAiSummaryText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={6}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setEditingAiSummary(false)}
                  className="text-xs px-3 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingAiSummary(false)}
                  className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {aiSummaryText || `${selectedClient.first_name} ${selectedClient.last_name} is an experienced property investor with a household income of $${(selectedClient.income || 0).toLocaleString()} and current portfolio of ${selectedClient.investment_addresses ? selectedClient.investment_addresses.split('\n').filter(Boolean).length : 0} investment properties. Total estimated assets are $${(selectedClient.assets || 0).toLocaleString()} against liabilities of $${(selectedClient.liabilities || 0).toLocaleString()}, with $${(selectedClient.available_deposit || 0).toLocaleString()} available as deposit for new acquisitions.\n\nCurrent strategy focuses on building a property portfolio in Sydney's Eastern Suburbs and North Shore. ${selectedClient.first_name} is well-organised and has a strong serviceability position, with rental income from existing properties supporting further borrowing capacity. Monthly expenses are $${(selectedClient.monthly_expenses || 0).toLocaleString()}.\n\nKey action items: Review rate competitiveness on existing loans, explore equity release for next acquisition, and continue monitoring properties in target suburbs.`}
            </p>
          )}
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
              {editingProfile ? (
                <input type="number" value={editForm.income ?? ''} onChange={e => setEditForm({...editForm, income: e.target.value ? Number(e.target.value) : undefined})} className="input mt-1" />
              ) : (
                <p className="mt-1">${selectedClient.income?.toLocaleString() || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">PAYG</label>
              {editingProfile ? (
                <input type="number" value={editForm.payg ?? ''} onChange={e => setEditForm({...editForm, payg: e.target.value ? Number(e.target.value) : undefined})} className="input mt-1" />
              ) : (
                <p className="mt-1">${selectedClient.payg?.toLocaleString() || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Assets</label>
              {editingProfile ? (
                <input type="number" value={editForm.assets ?? ''} onChange={e => setEditForm({...editForm, assets: e.target.value ? Number(e.target.value) : undefined})} className="input mt-1" />
              ) : (
                <p className="mt-1">${selectedClient.assets?.toLocaleString() || '-'}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">Liabilities</label>
              {editingProfile ? (
                <input type="number" value={editForm.liabilities ?? ''} onChange={e => setEditForm({...editForm, liabilities: e.target.value ? Number(e.target.value) : undefined})} className="input mt-1" />
              ) : (
                <p className="mt-1">${selectedClient.liabilities?.toLocaleString() || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Available Deposit</label>
              {editingProfile ? (
                <input type="number" value={editForm.available_deposit ?? ''} onChange={e => setEditForm({...editForm, available_deposit: e.target.value ? Number(e.target.value) : undefined})} className="input mt-1" />
              ) : (
                <p className="mt-1">${selectedClient.available_deposit?.toLocaleString() || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Monthly Expenses</label>
              {editingProfile ? (
                <input type="number" value={editForm.monthly_expenses ?? ''} onChange={e => setEditForm({...editForm, monthly_expenses: e.target.value ? Number(e.target.value) : undefined})} className="input mt-1" />
              ) : (
                <p className="mt-1">${selectedClient.monthly_expenses?.toLocaleString() || '-'}</p>
              )}
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-500">Goals</label>
            {editingProfile ? (
              <textarea value={editForm.goals || ''} onChange={e => setEditForm({...editForm, goals: e.target.value})} className="input mt-1 text-sm" rows={3} placeholder="Year 2: ...&#10;Year 5: ...&#10;Year 10: ..." />
            ) : (
              <p className="mt-1 text-sm whitespace-pre-line">{selectedClient.goals || '-'}</p>
            )}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-500">Notes</label>
            {editingProfile ? (
              <textarea value={editForm.notes || ''} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="input mt-1 text-sm" rows={3} />
            ) : (
              <p className="mt-1 text-sm">{selectedClient.notes || '-'}</p>
            )}
          </div>
        </div>

        {/* Deals & Loans */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Deals & Loans</h3>
              <p className="text-sm text-gray-500">
                {clientDeals.length} deal{clientDeals.length !== 1 ? 's' : ''}
                {clientDeals.length > 0 && (
                  <span className="ml-2">
                    (${clientDeals.reduce((sum, d) => sum + (d.loan_amount || 0), 0).toLocaleString()} total brokered)
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setShowAddDeal(!showAddDeal)}
              className="text-sm px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              {showAddDeal ? 'Cancel' : '+ Add Deal'}
            </button>
          </div>

          {showAddDeal && (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!selectedClient?.id || !newDeal.property_address) return
                try {
                  await invoke('create_deal', {
                    deal: {
                      ...newDeal,
                      id: null,
                      client_id: selectedClient.id,
                      loan_amount: newDeal.loan_amount || null,
                      interest_rate: newDeal.interest_rate || null,
                      purchase_date: newDeal.purchase_date || null,
                      settlement_date: newDeal.settlement_date || null,
                      lender_name: newDeal.lender_name || null,
                      notes: newDeal.notes || null,
                      created_at: '',
                      updated_at: '',
                    }
                  })
                  setShowAddDeal(false)
                  setNewDeal({ property_address: '', lender_name: '', loan_type: 'variable', status: 'active', notes: '' })
                  loadClientDeals(selectedClient.id)
                } catch (error) {
                  console.error('Failed to create deal:', error)
                }
              }}
              className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Property Address *</label>
                  <input
                    type="text"
                    value={newDeal.property_address || ''}
                    onChange={(e) => setNewDeal({ ...newDeal, property_address: e.target.value })}
                    className="input text-sm"
                    required
                    placeholder="123 Main St, Sydney NSW 2000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Lender</label>
                  <input
                    type="text"
                    value={newDeal.lender_name || ''}
                    onChange={(e) => setNewDeal({ ...newDeal, lender_name: e.target.value })}
                    className="input text-sm"
                    placeholder="e.g., Commonwealth Bank"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Loan Amount</label>
                  <input
                    type="number"
                    value={newDeal.loan_amount || ''}
                    onChange={(e) => setNewDeal({ ...newDeal, loan_amount: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="input text-sm"
                    placeholder="$"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newDeal.interest_rate || ''}
                    onChange={(e) => setNewDeal({ ...newDeal, interest_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="input text-sm"
                    placeholder="%"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Loan Type</label>
                  <select
                    value={newDeal.loan_type || 'variable'}
                    onChange={(e) => setNewDeal({ ...newDeal, loan_type: e.target.value })}
                    className="input text-sm"
                  >
                    <option value="variable">Variable</option>
                    <option value="fixed">Fixed</option>
                    <option value="split">Split</option>
                    <option value="interest_only">Interest Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Status</label>
                  <select
                    value={newDeal.status || 'active'}
                    onChange={(e) => setNewDeal({ ...newDeal, status: e.target.value })}
                    className="input text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="settled">Settled</option>
                    <option value="refinanced">Refinanced</option>
                    <option value="discharged">Discharged</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={newDeal.purchase_date || ''}
                    onChange={(e) => setNewDeal({ ...newDeal, purchase_date: e.target.value })}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Settlement Date</label>
                  <input
                    type="date"
                    value={newDeal.settlement_date || ''}
                    onChange={(e) => setNewDeal({ ...newDeal, settlement_date: e.target.value })}
                    className="input text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Notes</label>
                <textarea
                  value={newDeal.notes || ''}
                  onChange={(e) => setNewDeal({ ...newDeal, notes: e.target.value })}
                  className="input text-sm"
                  rows={2}
                />
              </div>
              <button type="submit" className="btn-primary text-sm">Save Deal</button>
            </form>
          )}

          {clientDeals.length === 0 && !showAddDeal ? (
            <p className="text-gray-500 text-sm">No deals recorded yet for this client.</p>
          ) : (
            <div className="space-y-3">
              {clientDeals.map((deal) => {
                const isExpanded = expandedDealId === deal.id
                const events = deal.id ? dealEvents[deal.id] || [] : []
                const statusColor = deal.status === 'active' ? 'bg-green-100 text-green-800'
                  : deal.status === 'settled' ? 'bg-blue-100 text-blue-800'
                  : deal.status === 'refinanced' ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-800'

                return (
                  <div key={deal.id} className="bg-gray-50 rounded-lg overflow-hidden">
                    <button
                      onClick={() => {
                        const newId = isExpanded ? null : (deal.id ?? null)
                        setExpandedDealId(newId)
                        if (newId && deal.id && !dealEvents[deal.id]) {
                          loadDealEvents(deal.id)
                        }
                      }}
                      className="w-full p-3 text-left hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <div>
                            <p className="font-medium text-sm">{deal.property_address}</p>
                            <p className="text-xs text-gray-500">
                              {deal.lender_name || 'No lender'} · {deal.loan_type || 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor}`}>
                            {deal.status}
                          </span>
                          <div className="text-right">
                            <p className="text-sm font-semibold">${(deal.loan_amount || 0).toLocaleString()}</p>
                            {deal.interest_rate && (
                              <p className="text-xs text-gray-500">{deal.interest_rate.toFixed(2)}%</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 ml-6 space-y-3">
                        <div className="grid grid-cols-4 gap-3">
                          <div className="bg-white rounded-lg p-2 text-center border">
                            <p className="text-xs text-gray-500">Purchase Date</p>
                            <p className="text-sm font-medium">{deal.purchase_date || '-'}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2 text-center border">
                            <p className="text-xs text-gray-500">Settlement Date</p>
                            <p className="text-sm font-medium">{deal.settlement_date || '-'}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2 text-center border">
                            <p className="text-xs text-gray-500">Rate</p>
                            <p className="text-sm font-medium">{deal.interest_rate ? `${deal.interest_rate.toFixed(2)}%` : '-'}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2 text-center border">
                            <p className="text-xs text-gray-500">Loan Amount</p>
                            <p className="text-sm font-medium">${(deal.loan_amount || 0).toLocaleString()}</p>
                          </div>
                        </div>

                        {deal.notes && (
                          <p className="text-sm text-gray-600 italic">{deal.notes}</p>
                        )}

                        {/* Timeline */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Timeline</h4>
                            <button
                              onClick={() => setShowAddEvent(showAddEvent === deal.id ? null : (deal.id ?? null))}
                              className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            >
                              {showAddEvent === deal.id ? 'Cancel' : '+ Add Event'}
                            </button>
                          </div>

                          {showAddEvent === deal.id && (
                            <form
                              onSubmit={async (e) => {
                                e.preventDefault()
                                if (!deal.id) return
                                try {
                                  await invoke('create_deal_event', {
                                    event: {
                                      id: null,
                                      deal_id: deal.id,
                                      event_type: newEvent.event_type || 'note',
                                      event_date: newEvent.event_date || new Date().toISOString().split('T')[0],
                                      description: newEvent.description || null,
                                      old_value: newEvent.old_value || null,
                                      new_value: newEvent.new_value || null,
                                      created_at: '',
                                    }
                                  })
                                  setShowAddEvent(null)
                                  setNewEvent({ event_type: 'note', event_date: new Date().toISOString().split('T')[0], description: '' })
                                  loadDealEvents(deal.id)
                                } catch (error) {
                                  console.error('Failed to create event:', error)
                                }
                              }}
                              className="bg-white border rounded-lg p-3 mb-3 space-y-2"
                            >
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs font-medium mb-1">Event Type</label>
                                  <select
                                    value={newEvent.event_type || 'note'}
                                    onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
                                    className="input text-sm"
                                  >
                                    <option value="purchase">Purchase</option>
                                    <option value="settlement">Settlement</option>
                                    <option value="refinance">Refinance</option>
                                    <option value="rate_change">Rate Change</option>
                                    <option value="repayment_change">Repayment Change</option>
                                    <option value="discharge">Discharge</option>
                                    <option value="note">Note</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">Date</label>
                                  <input
                                    type="date"
                                    value={newEvent.event_date || ''}
                                    onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                                    className="input text-sm"
                                    required
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1">Description</label>
                                <input
                                  type="text"
                                  value={newEvent.description || ''}
                                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                                  className="input text-sm"
                                  placeholder="What happened?"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs font-medium mb-1">Old Value</label>
                                  <input
                                    type="text"
                                    value={newEvent.old_value || ''}
                                    onChange={(e) => setNewEvent({ ...newEvent, old_value: e.target.value })}
                                    className="input text-sm"
                                    placeholder="e.g., 5.99%"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">New Value</label>
                                  <input
                                    type="text"
                                    value={newEvent.new_value || ''}
                                    onChange={(e) => setNewEvent({ ...newEvent, new_value: e.target.value })}
                                    className="input text-sm"
                                    placeholder="e.g., 5.49%"
                                  />
                                </div>
                              </div>
                              <button type="submit" className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                                Save Event
                              </button>
                            </form>
                          )}

                          {events.length === 0 ? (
                            <p className="text-xs text-gray-400">No events recorded yet.</p>
                          ) : (
                            <div className="relative ml-2">
                              <div className="absolute left-[5px] top-2 bottom-2 w-[2px] bg-gray-200" />
                              <div className="space-y-3">
                                {events.map((ev) => {
                                  const typeColor = ev.event_type === 'purchase' || ev.event_type === 'settlement'
                                    ? 'bg-green-500' : ev.event_type === 'refinance'
                                    ? 'bg-purple-500' : ev.event_type === 'rate_change' || ev.event_type === 'repayment_change'
                                    ? 'bg-blue-500' : ev.event_type === 'discharge'
                                    ? 'bg-red-500' : 'bg-gray-400'
                                  return (
                                    <div key={ev.id} className="relative pl-5">
                                      <div className={`absolute left-0 top-1.5 w-3 h-3 rounded-full ${typeColor} border-2 border-white`} />
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-semibold capitalize">{ev.event_type.replace('_', ' ')}</span>
                                          <span className="text-xs text-gray-400">{ev.event_date}</span>
                                        </div>
                                        {ev.description && (
                                          <p className="text-sm text-gray-600">{ev.description}</p>
                                        )}
                                        {(ev.old_value || ev.new_value) && (
                                          <p className="text-xs text-gray-500">
                                            {ev.old_value && <span>{ev.old_value}</span>}
                                            {ev.old_value && ev.new_value && <span> → </span>}
                                            {ev.new_value && <span className="font-medium text-gray-700">{ev.new_value}</span>}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
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
                const isTranscriptOpen = transcriptExpanded === meeting.id

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
                      </div>
                    </button>

                    {/* AI Summary always visible (full text when collapsed) */}
                    {meeting.summary && (
                      <div className="px-3 pb-3 ml-9">
                        <div className="bg-white border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wide">AI Summary</h4>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">Auto-generated</span>
                            </div>
                            {isExpanded && !isEditingSummary && (
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
                            <p className="text-sm text-gray-700">{meeting.summary}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {isExpanded && (
                      <div className="px-3 pb-3 ml-9 space-y-3">
                        {!meeting.summary && (
                          <p className="text-sm text-gray-400 italic">No summary generated yet.</p>
                        )}

                        {/* Broker Notes */}
                        {meeting.notes && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Broker Notes</h4>
                            <p className="text-sm text-gray-600 italic">{meeting.notes}</p>
                          </div>
                        )}

                        {/* Full Transcript - collapsed by default */}
                        {meeting.transcript && (
                          <div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setTranscriptExpanded(isTranscriptOpen ? null : (meeting.id ?? null))
                              }}
                              className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700"
                            >
                              <svg
                                className={`w-3 h-3 transition-transform ${isTranscriptOpen ? 'rotate-90' : ''}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              Full Transcript
                            </button>
                            {isTranscriptOpen && (
                              <div className="bg-white border border-gray-200 rounded-lg p-3 max-h-60 overflow-y-auto mt-1">
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{meeting.transcript}</p>
                              </div>
                            )}
                          </div>
                        )}
                        {!meeting.transcript && (
                          <div className="bg-gray-100 border border-dashed border-gray-300 rounded-lg p-4 text-center">
                            <p className="text-sm text-gray-400">Transcript will appear here once the meeting is recorded and processed.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
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
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center mb-6 transition-colors ${
              dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-300'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
          >
            <svg className="w-10 h-10 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-600 mb-3">{dragOver ? 'Drop file here' : 'Drag & drop or browse to upload'}</p>
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
                    <th className="text-right py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {clientDocuments.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="py-2 text-sm">
                        {renamingDocId === doc.id ? (
                          <form onSubmit={async (e) => {
                            e.preventDefault()
                            try {
                              await invoke('rename_document', { documentId: doc.id, newName: renameValue })
                              setRenamingDocId(null)
                              if (selectedClient?.id) {
                                const docs = await invoke<any[]>('get_client_documents', { clientId: selectedClient.id })
                                setClientDocuments(docs)
                              }
                            } catch (err) { console.error(err) }
                          }} className="flex items-center gap-1">
                            <input
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              className="input text-sm py-0.5 px-1 w-48"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Escape') setRenamingDocId(null) }}
                            />
                            <button type="submit" className="text-xs text-primary-600 hover:text-primary-800 font-medium">Save</button>
                            <button type="button" onClick={() => setRenamingDocId(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                          </form>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="text-primary-600 hover:text-primary-800 cursor-pointer" onClick={() => handleDocumentClick(doc)}>{doc.filename}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setRenamingDocId(doc.id!); setRenameValue(doc.filename) }}
                              className="text-xs text-gray-400 hover:text-gray-600"
                              title="Rename"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
                          {doc.document_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 text-sm text-gray-500">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await invoke('delete_document', { documentId: doc.id })
                              if (selectedClient?.id) {
                                const docs = await invoke<any[]>('get_client_documents', { clientId: selectedClient.id })
                                setClientDocuments(docs)
                              }
                            } catch (err) { console.error('Delete failed:', err) }
                          }}
                          className="text-gray-400 hover:text-red-500"
                          title="Delete document"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
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
        <div className="flex gap-2">
          {showForm && (
            <button
              type="button"
              onClick={() => (document.getElementById('new-client-form') as HTMLFormElement)?.requestSubmit()}
              className="btn-primary"
            >
              Save Client
            </button>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            className={showForm ? "px-4 py-2 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200" : "btn-primary"}
          >
            {showForm ? 'Cancel' : 'Add New Client'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">New Client</h3>
          <form id="new-client-form" onSubmit={handleSubmit} className="space-y-4">
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
            <div>
              <label className="block text-sm font-medium mb-1">How did you hear about us?</label>
              <select
                value={newClient.referral_source || ''}
                onChange={(e) => setNewClient({...newClient, referral_source: e.target.value})}
                className="input"
              >
                <option value="">-- Select --</option>
                {REFERRAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
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
                  <select
                    value={newClient.home_ownership || 'owned'}
                    onChange={(e) => setNewClient({...newClient, home_ownership: e.target.value})}
                    className="input mt-2"
                  >
                    <option value="owned">Owner Occupied</option>
                    <option value="joint">Joint Ownership</option>
                    <option value="renting">Renting</option>
                  </select>
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
          </form>
        </div>
      )}

      <div className="card">
        {/* Search Bar */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients..."
            className="input pl-10 w-full"
          />
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('existing')}
            className={`px-4 py-2 rounded text-sm font-medium ${
              activeTab === 'existing'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Existing Clients ({clients.filter(c => c.client_status === 'existing').length})
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 rounded text-sm font-medium ${
              activeTab === 'new'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            New Clients ({clients.filter(c => c.client_status === 'new').length})
          </button>
        </div>
        {(() => {
          const filteredClients = clients
            .filter(c => c.client_status === activeTab)
            .filter(c => {
              if (!searchQuery.trim()) return true
              const q = searchQuery.toLowerCase()
              const name = `${c.first_name} ${c.last_name}`.toLowerCase()
              return name.includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q)
            })

          return filteredClients.length === 0 ? (
            <p className="text-gray-500">
              {searchQuery.trim() ? 'No clients match your search.' : (activeTab === 'existing' ? 'No existing clients yet.' : 'No new clients yet.')}
            </p>
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
                  {filteredClients.map((client) => (
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
          )
        })()}
      </div>
    </div>
  )
}

export default Clients
