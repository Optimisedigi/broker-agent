import { useState } from 'react'
// TODO: Uncomment when connecting to Rust backend
// import { invoke } from '@tauri-apps/api/core'

interface ClientInfo {
  name: string
  email: string
}

interface Meeting {
  id: number
  client_name: string
  client_email: string
  duration: number
  recording_path: string
  transcript?: string
  created_at: string
}

function Meetings() {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [showClientForm, setShowClientForm] = useState(false)
  const [clientInfo, setClientInfo] = useState<ClientInfo>({ name: '', email: '' })
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([])
  const [currentMeeting, setCurrentMeeting] = useState<Partial<Meeting> | null>(null)

  const startRecording = async () => {
    setShowClientForm(true)
  }

  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientInfo.name || !clientInfo.email) return

    setShowClientForm(false)
    setIsRecording(true)

    // Start timer
    const interval = setInterval(() => {
      setRecordingTime(prev => prev + 1)
    }, 1000)
    ;(window as any).recordingInterval = interval

    // TODO: Call Rust backend to start actual recording
    // invoke('start_recording', { clientEmail: clientInfo.email })
  }

  const stopRecording = () => {
    setIsRecording(false)
    if ((window as any).recordingInterval) {
      clearInterval((window as any).recordingInterval)
    }

    // Show save prompt
    setCurrentMeeting({
      client_name: clientInfo.name,
      client_email: clientInfo.email,
      duration: recordingTime,
      created_at: new Date().toISOString()
    })
    setShowSavePrompt(true)
  }

  const saveMeeting = async () => {
    try {
      // TODO: Call Rust backend to save meeting
      // const meeting = await invoke<Meeting>('save_meeting', {
      //   meeting: currentMeeting
      // })

      // For now, just add to local state
      const newMeeting: Meeting = {
        id: Date.now(),
        client_name: currentMeeting?.client_name || '',
        client_email: currentMeeting?.client_email || '',
        duration: recordingTime,
        recording_path: `/recordings/${Date.now()}.wav`,
        created_at: new Date().toISOString()
      }

      setRecentMeetings(prev => [newMeeting, ...prev])

      // Reset state
      setShowSavePrompt(false)
      setRecordingTime(0)
      setClientInfo({ name: '', email: '' })
      setCurrentMeeting(null)
    } catch (error) {
      console.error('Failed to save meeting:', error)
    }
  }

  const discardMeeting = () => {
    setShowSavePrompt(false)
    setRecordingTime(0)
    setClientInfo({ name: '', email: '' })
    setCurrentMeeting(null)
    // TODO: Call Rust to delete recording file
  }

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const secs = (seconds % 60).toString().padStart(2, '0')
    return `${hrs}:${mins}:${secs}`
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Meeting Recorder</h2>
        <p className="text-sm text-gray-500 mt-1">
          Record client meetings with automatic transcription
        </p>
      </div>

      {/* Client Info Form Modal */}
      {showClientForm && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Client Information</h3>
          <p className="text-sm text-gray-500 mb-4">
            Enter the client details before starting the recording. This helps auto-import their emails later.
          </p>
          <form onSubmit={handleClientSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Client Name</label>
              <input
                type="text"
                value={clientInfo.name}
                onChange={(e) => setClientInfo({...clientInfo, name: e.target.value})}
                className="input"
                placeholder="e.g., Sarah Johnson"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Client Email</label>
              <input
                type="email"
                value={clientInfo.email}
                onChange={(e) => setClientInfo({...clientInfo, email: e.target.value})}
                className="input"
                placeholder="e.g., sarah@email.com"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Future emails from this address will auto-import to their profile
              </p>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary">
                Start Recording
              </button>
              <button
                type="button"
                onClick={() => setShowClientForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Save Prompt Modal */}
      {showSavePrompt && (
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold mb-2">Save Meeting?</h3>
          <p className="text-sm text-gray-600 mb-4">
            Recording completed for <strong>{currentMeeting?.client_name}</strong> ({formatTime(recordingTime)})
          </p>
          <p className="text-sm text-gray-500 mb-4">
            This client will be saved to your database. Future emails from {currentMeeting?.client_email} will automatically import to their profile.
          </p>
          <div className="flex gap-3">
            <button onClick={saveMeeting} className="btn-primary">
              Save Client & Meeting
            </button>
            <button onClick={discardMeeting} className="btn-secondary">
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Recording Interface */}
      {!showClientForm && !showSavePrompt && (
        <div className="card text-center py-12">
          {isRecording ? (
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                <div className="w-8 h-8 bg-red-500 rounded-full"></div>
              </div>
              <div className="text-sm text-gray-500">
                Recording for: <strong>{clientInfo.name}</strong>
              </div>
              <p className="text-2xl font-mono">{formatTime(recordingTime)}</p>
              <p className="text-red-600 font-medium">Recording in progress...</p>
              <button onClick={stopRecording} className="btn-secondary">
                Stop Recording
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <p className="text-gray-600">Ready to record</p>
              <button onClick={startRecording} className="btn-primary">
                Start Recording
              </button>
              <p className="text-xs text-gray-400">
                You'll enter client details on the next step
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recent Meetings */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Recent Meetings</h3>
        {recentMeetings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No recorded meetings yet.</p>
            <p className="text-sm mt-2">Your meetings will appear here after recording.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentMeetings.map((meeting) => (
              <div key={meeting.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{meeting.client_name}</p>
                  <p className="text-sm text-gray-500">{meeting.client_email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatDuration(meeting.duration)}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(meeting.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Features Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Local Recording</h4>
          <p className="text-sm text-gray-600">
            All recordings are stored locally on your computer for maximum security
          </p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Auto Transcription</h4>
          <p className="text-sm text-gray-600">
            Meetings are automatically transcribed using on-device AI
          </p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Email Auto-Import</h4>
          <p className="text-sm text-gray-600">
            Documents from saved clients auto-import to their profile
          </p>
        </div>
      </div>
    </div>
  )
}

export default Meetings
