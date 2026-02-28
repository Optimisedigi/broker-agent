import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface SettingsProps {
  onLogoChange: (logo: string | null) => void
  onProfileChange?: (profile: any) => void
}

function Settings({ onLogoChange, onProfileChange }: SettingsProps) {
  const [logo, setLogo] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Profile state
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileRole, setProfileRole] = useState('')
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Email templates
  const [introEmail, setIntroEmail] = useState('')
  const [proposalEmail, setProposalEmail] = useState('')
  const [followUpEmail, setFollowUpEmail] = useState('')
  const [templatesSaved, setTemplatesSaved] = useState(false)

  // Mic & screen test
  const [micStatus, setMicStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [screenStatus, setScreenStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [micLevel, setMicLevel] = useState(0)
  const [micError, setMicError] = useState('')
  const [screenError, setScreenError] = useState('')


  useEffect(() => {
    const saved = localStorage.getItem('broker_logo')
    if (saved) setLogo(saved)
    loadProfile()
    loadTemplates()
  }, [])

  const loadTemplates = () => {
    setIntroEmail(localStorage.getItem('tpl_intro') || `Hi {{client_name}},\n\nThank you for reaching out. My name is {{broker_name}} and I'd love to help you with your property finance needs.\n\nI'd like to schedule a quick call to understand your goals and discuss how I can assist. Are you available this week for a 15-minute chat?\n\nLooking forward to hearing from you.\n\nBest regards,\n{{broker_name}}`)
    setProposalEmail(localStorage.getItem('tpl_proposal') || `Hi {{client_name}},\n\nGreat speaking with you today. As discussed, I've put together a proposal based on the property at {{property_address}}.\n\nHere's a summary of what we covered:\n- Loan amount: {{loan_amount}}\n- Recommended lender: {{lender_name}}\n- Estimated rate: {{interest_rate}}\n\nPlease review the attached proposal and let me know if you have any questions.\n\nBest regards,\n{{broker_name}}`)
    setFollowUpEmail(localStorage.getItem('tpl_followup') || `Hi {{client_name}},\n\nJust checking in to see how things are going with the property at {{property_address}}.\n\nIf you have any questions about the proposal or would like to discuss next steps, I'm happy to jump on a quick call.\n\nBest regards,\n{{broker_name}}`)
  }

  const handleSaveTemplates = () => {
    localStorage.setItem('tpl_intro', introEmail)
    localStorage.setItem('tpl_proposal', proposalEmail)
    localStorage.setItem('tpl_followup', followUpEmail)
    setTemplatesSaved(true)
    setTimeout(() => setTemplatesSaved(false), 2000)
  }

  const loadProfile = async () => {
    try {
      const profile: any = await invoke('get_broker_profile')
      if (profile) {
        setProfileName(profile.name || '')
        setProfileEmail(profile.email || '')
        setProfilePhone(profile.phone || '')
        setProfileRole(profile.role || '')
        setProfilePhoto(profile.photo || null)
      }
    } catch (error) {
      console.error('Failed to load profile:', error)
    }
  }

  const handleSaveProfile = async () => {
    setProfileSaving(true)
    try {
      const saved: any = await invoke('save_broker_profile', {
        profile: {
          id: null,
          name: profileName,
          email: profileEmail,
          phone: profilePhone,
          role: profileRole,
          photo: profilePhoto,
          created_at: '',
          updated_at: '',
        },
      })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
      if (onProfileChange) {
        onProfileChange({ name: saved.name, photo: saved.photo || null })
      }
    } catch (error) {
      console.error('Failed to save profile:', error)
    } finally {
      setProfileSaving(false)
    }
  }

  const testMicrophone = async () => {
    setMicStatus('testing')
    setMicError('')
    setMicLevel(0)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      let maxLevel = 0
      const checkLevel = () => {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        const normalized = Math.min(100, Math.round((avg / 128) * 100))
        if (normalized > maxLevel) maxLevel = normalized
        setMicLevel(normalized)
      }
      const interval = setInterval(checkLevel, 100)

      setTimeout(() => {
        clearInterval(interval)
        stream.getTracks().forEach((t) => t.stop())
        audioCtx.close()
        setMicStatus(maxLevel > 5 ? 'success' : 'error')
        if (maxLevel <= 5) setMicError('No audio detected. Check your microphone is connected and not muted.')
      }, 3000)
    } catch (err: any) {
      setMicStatus('error')
      setMicError(err.message || 'Microphone access denied. Check your system permissions.')
    }
  }

  const testScreenRecording = async () => {
    setScreenStatus('testing')
    setScreenError('')
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      // If we got here, permission was granted
      setTimeout(() => {
        stream.getTracks().forEach((t) => t.stop())
        setScreenStatus('success')
      }, 1000)
    } catch (err: any) {
      setScreenStatus('error')
      setScreenError(err.message || 'Screen recording access denied. Check your system permissions.')
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setProfilePhoto(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

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
      {/* Your Profile */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Your Profile</h3>
        <p className="text-sm text-gray-500 mb-4">
          Set your name, photo, and details. Your photo will appear on the team leaderboard.
        </p>

        {/* Photo Upload */}
        <div className="flex items-center gap-4 mb-5">
          <button
            onClick={() => photoInputRef.current?.click()}
            className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 hover:border-primary-400 transition-colors flex items-center justify-center group flex-shrink-0"
          >
            {profilePhoto ? (
              <img
                src={profilePhoto}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <svg
                className="w-8 h-8 text-gray-400 group-hover:text-primary-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            )}
          </button>
          <div>
            <p className="text-sm font-medium text-gray-700">Profile Photo</p>
            <p className="text-xs text-gray-400">Click the circle to upload</p>
            {profilePhoto && (
              <button
                onClick={() => setProfilePhoto(null)}
                className="text-xs text-red-500 hover:text-red-700 mt-1"
              >
                Remove photo
              </button>
            )}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>

        {/* Profile Fields */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              placeholder="04XX XXX XXX"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <input
              type="text"
              value={profileRole}
              onChange={(e) => setProfileRole(e.target.value)}
              placeholder="e.g. Senior Broker"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={profileSaving}
          className="btn-primary"
        >
          {profileSaving
            ? 'Saving...'
            : profileSaved
              ? 'Saved!'
              : 'Save Profile'}
        </button>
      </div>

      {/* Company Logo */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Company Logo</h3>
        <p className="text-sm text-gray-500 mb-4">
          Upload your company logo to display in the sidebar above "Broker Agent".
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
      {/* Recording Test */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-2">Recording Setup</h3>
        <p className="text-sm text-gray-500 mb-4">
          Test your microphone and screen recording before starting a meeting.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {/* Microphone Test */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <h4 className="font-medium text-sm">Microphone</h4>
            </div>

            {micStatus === 'idle' && (
              <button onClick={testMicrophone} className="btn-secondary w-full text-sm">
                Test Microphone
              </button>
            )}

            {micStatus === 'testing' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Listening... speak now</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all duration-100"
                    style={{ width: `${micLevel}%` }}
                  />
                </div>
              </div>
            )}

            {micStatus === 'success' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium">Microphone working</span>
                </div>
                <button onClick={testMicrophone} className="text-xs text-primary-600 hover:text-primary-800">
                  Test again
                </button>
              </div>
            )}

            {micStatus === 'error' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm font-medium">Test failed</span>
                </div>
                <p className="text-xs text-red-500">{micError}</p>
                <button onClick={testMicrophone} className="text-xs text-primary-600 hover:text-primary-800">
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* Screen Recording Test */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h4 className="font-medium text-sm">Screen Recording</h4>
            </div>

            {screenStatus === 'idle' && (
              <button onClick={testScreenRecording} className="btn-secondary w-full text-sm">
                Test Screen Recording
              </button>
            )}

            {screenStatus === 'testing' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Checking permissions...</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-primary-500 h-2 rounded-full animate-pulse w-full" />
                </div>
              </div>
            )}

            {screenStatus === 'success' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium">Screen recording available</span>
                </div>
                <button onClick={testScreenRecording} className="text-xs text-primary-600 hover:text-primary-800">
                  Test again
                </button>
              </div>
            )}

            {screenStatus === 'error' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm font-medium">Test failed</span>
                </div>
                <p className="text-xs text-red-500">{screenError}</p>
                <button onClick={testScreenRecording} className="text-xs text-primary-600 hover:text-primary-800">
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          On macOS, you may need to grant microphone and screen recording permissions in System Settings &gt; Privacy &amp; Security.
        </p>
      </div>

      {/* Whisper Model */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-2">Whisper Transcription</h3>
        <p className="text-sm text-gray-500 mb-4">
          On-device meeting transcription powered by Whisper AI. The model is bundled with the app, so no data leaves your computer.
        </p>
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">ggml-base.bin</p>
              <p className="text-xs text-gray-500">Bundled, English optimised, good balance of speed and accuracy</p>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium">Bundled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Email Templates */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-2">Email Templates</h3>
        <p className="text-sm text-gray-500 mb-4">
          Customise your email templates. Use placeholders like <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{broker_name}}'}</code>, <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{client_name}}'}</code>, <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{{property_address}}'}</code> to auto-populate fields.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Introduction Email
            </label>
            <p className="text-xs text-gray-400 mb-1">Sent when first contacting a new client</p>
            <textarea
              value={introEmail}
              onChange={(e) => setIntroEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm font-mono"
              rows={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Post-Meeting Proposal Email
            </label>
            <p className="text-xs text-gray-400 mb-1">Sent after a meeting with loan proposal details</p>
            <textarea
              value={proposalEmail}
              onChange={(e) => setProposalEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm font-mono"
              rows={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Follow-Up Email
            </label>
            <p className="text-xs text-gray-400 mb-1">Sent to check in after sending a proposal</p>
            <textarea
              value={followUpEmail}
              onChange={(e) => setFollowUpEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm font-mono"
              rows={6}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={handleSaveTemplates} className="btn-primary">
            {templatesSaved ? 'Saved!' : 'Save Templates'}
          </button>
          <p className="text-xs text-gray-400">
            Available: {'{{broker_name}}'}, {'{{client_name}}'}, {'{{property_address}}'}, {'{{loan_amount}}'}, {'{{lender_name}}'}, {'{{interest_rate}}'}
          </p>
        </div>
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
                Once connected, Broker Agent will monitor your inbox for emails from your clients and auto-import attached documents.
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
