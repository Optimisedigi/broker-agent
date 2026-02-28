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
  created_at: string
  updated_at: string
}

interface Document {
  id?: number
  client_id: number
  filename: string
  document_type: string
  file_path: string
  uploaded_at: string
}

function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientDocuments, setClientDocuments] = useState<Document[]>([])
  const [newClient, setNewClient] = useState<Partial<Client>>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    income: undefined,
    payg: undefined,
    assets: undefined,
    liabilities: undefined,
    notes: ''
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadDocType, setUploadDocType] = useState('payslip')

  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    try {
      const data = await invoke<Client[]>('get_clients')
      setClients(data)
    } catch (error) {
      console.error('Failed to load clients:', error)
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

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client)
    if (client.id) {
      loadClientDocuments(client.id)
    }
  }

  const handleBack = () => {
    setSelectedClient(null)
    setClientDocuments([])
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
        notes: ''
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
      await invoke('upload_client_document', {
        clientId: selectedClient.id,
        filename: file.name,
        documentType: uploadDocType,
        filePath: file.name,
      })
      loadClientDocuments(selectedClient.id)
    } catch (error) {
      console.error('Failed to upload document:', error)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const getDocCountByType = (type: string) => {
    return clientDocuments.filter(d => d.document_type === type).length
  }

  // Client Detail View
  if (selectedClient) {
    return (
      <div className="space-y-6">
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

        {/* Financial Details */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-1">Financial Details</h3>
          <p className="text-sm text-gray-500 mb-4">
            Auto-populated from meeting transcriptions and email imports. You can also enter or edit these manually.
          </p>
          <div className="grid grid-cols-4 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-gray-500">Liabilities</label>
              <p className="mt-1">${selectedClient.liabilities?.toLocaleString() || '-'}</p>
            </div>
          </div>
          {selectedClient.notes && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-500">Notes</label>
              <p className="mt-1 text-sm">{selectedClient.notes}</p>
            </div>
          )}
        </div>

        {/* Document Categories */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 mx-auto bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="font-medium text-sm">Payslips</h4>
              <p className="text-sm text-gray-500">{getDocCountByType('payslip')} files</p>
            </div>

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
              <div className="w-10 h-10 mx-auto bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h4 className="font-medium text-sm">Property Docs</h4>
              <p className="text-sm text-gray-500">{getDocCountByType('property')} files</p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 mx-auto bg-orange-100 rounded-lg flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
              </div>
              <h4 className="font-medium text-sm">ID Documents</h4>
              <p className="text-sm text-gray-500">{getDocCountByType('id_document')} files</p>
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
                <option value="payslip">Payslip</option>
                <option value="bank_statement">Bank Statement</option>
                <option value="property">Property Doc</option>
                <option value="id_document">ID Document</option>
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
                    <tr key={doc.id} className="border-b">
                      <td className="py-2 text-sm">{doc.filename}</td>
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

            {/* Financial Details Section */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-1">Financial Details</h4>
              <p className="text-xs text-gray-500 mb-3">
                Auto-populated from meeting transcriptions and email imports. You can also enter or edit these manually.
              </p>
              <div className="grid grid-cols-4 gap-4">
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
              </div>
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