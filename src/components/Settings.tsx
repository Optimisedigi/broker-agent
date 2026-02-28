import { useState, useEffect, useRef } from 'react'

interface SettingsProps {
  onLogoChange: (logo: string | null) => void
}

function Settings({ onLogoChange }: SettingsProps) {
  const [logo, setLogo] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('broker_logo')
    if (saved) setLogo(saved)
  }, [])

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      localStorage.setItem('broker_logo', base64)
      setLogo(base64)
      onLogoChange(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleRemove = () => {
    localStorage.removeItem('broker_logo')
    setLogo(null)
    onLogoChange(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Company Logo</h3>
        <p className="text-sm text-gray-500 mb-4">
          Upload your company logo to display in the sidebar above "Broker Bot".
        </p>

        {logo && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg inline-block">
            <img
              src={logo}
              alt="Company logo"
              className="max-w-[120px] max-h-[120px] object-contain"
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            className="btn-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            {logo ? 'Change Logo' : 'Upload Logo'}
          </button>
          {logo && (
            <button className="btn-secondary" onClick={handleRemove}>
              Remove Logo
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
        />
      </div>
      {/* Email Integration */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Email Integration</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 mb-1">Connect your Outlook account</h4>
              <p className="text-sm text-blue-800 mb-3">
                Automatically scan for client emails with attachments (PAYG summaries, bank statements, ID documents).
              </p>
              <p className="text-sm text-blue-700 mb-4">
                Once connected, Broker Bot will monitor your inbox for emails from your clients and auto-import attached documents.
              </p>
              <div className="flex items-center gap-3">
                <button
                  disabled
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg opacity-50 cursor-not-allowed text-sm font-medium"
                >
                  Connect Outlook
                </button>
                <span className="text-xs font-medium bg-blue-200 text-blue-800 px-2 py-1 rounded-full">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
