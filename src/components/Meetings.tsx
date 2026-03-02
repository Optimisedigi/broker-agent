import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

interface Client {
  id?: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

interface Meeting {
  id?: number;
  client_id: number;
  client_name: string;
  client_email: string;
  title: string;
  recording_path?: string;
  transcript?: string;
  summary?: string;
  meeting_date: string;
  duration_seconds?: number;
  notes?: string;
}

function Meetings() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [whisperReady, setWhisperReady] = useState<boolean | null>(null);
  const [micTestActive, setMicTestActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micTestError, setMicTestError] = useState<string | null>(null);

  // Calendar event state
  const [calendarProvider, setCalendarProvider] = useState<string | null>(null);
  const [showCalendarPrompt, setShowCalendarPrompt] = useState(false);
  const [calendarCreating, setCalendarCreating] = useState(false);
  const [calendarResult, setCalendarResult] = useState<string | null>(null);
  const [savedMeetingName, setSavedMeetingName] = useState("");
  const [savedMeetingEmail, setSavedMeetingEmail] = useState("");
  const [savedMeetingDuration, setSavedMeetingDuration] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadClients();
    loadMeetings();
    checkWhisper();
    checkCalendarConnection();
    return () => {
      stopMicTest();
    };
  }, []);

  const checkCalendarConnection = async () => {
    try {
      const g: any = await invoke("check_oauth_status", { provider: "google" });
      if (g.connected) {
        setCalendarProvider("google");
        return;
      }
      const m: any = await invoke("check_oauth_status", { provider: "microsoft" });
      if (m.connected) {
        setCalendarProvider("microsoft");
        return;
      }
      setCalendarProvider(null);
    } catch {
      setCalendarProvider(null);
    }
  };

  const checkWhisper = async () => {
    try {
      const ready = await invoke<boolean>("check_whisper_model");
      setWhisperReady(ready);
    } catch {
      setWhisperReady(false);
    }
  };

  const loadClients = async () => {
    try {
      const data = await invoke<Client[]>("get_clients");
      setClients(data);
    } catch (error) {
      console.error("Failed to load clients:", error);
    }
  };

  const loadMeetings = async () => {
    try {
      const data = await invoke<Meeting[]>("get_meetings");
      setRecentMeetings(data);
    } catch (error) {
      console.error("Failed to load meetings:", error);
    }
  };

  const startRecording = async () => {
    setShowClientForm(true);
  };

  const handleClientSelect = (value: string) => {
    setSelectedClientId(value);
    if (value === "manual") {
      setIsManualEntry(true);
      setClientName("");
      setClientEmail("");
    } else if (value) {
      setIsManualEntry(false);
      const client = clients.find((c) => c.id?.toString() === value);
      if (client) {
        setClientName(`${client.first_name} ${client.last_name}`);
        setClientEmail(client.email);
      }
    } else {
      setIsManualEntry(false);
      setClientName("");
      setClientEmail("");
    }
  };

  const startMicTest = async () => {
    setMicTestError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const audioCtx = new AudioContext();
      micAudioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      setMicTestActive(true);
      micIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
      }, 80);
    } catch {
      setMicTestError("Could not access microphone. Check permissions in System Settings.");
    }
  };

  const stopMicTest = () => {
    if (micIntervalRef.current) {
      clearInterval(micIntervalRef.current);
      micIntervalRef.current = null;
    }
    if (micAudioCtxRef.current) {
      micAudioCtxRef.current.close();
      micAudioCtxRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    setMicTestActive(false);
    setMicLevel(0);
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientEmail) return;
    stopMicTest();

    setShowClientForm(false);
    setRecordingError(null);

    try {
      // Start native audio recording via Rust
      await invoke<string>("start_recording");

      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setRecordingError(
        err?.toString() ||
          "Failed to start recording. Check microphone permissions in System Settings.",
      );
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setShowSavePrompt(true);
  };

  const saveMeeting = async () => {
    setIsTranscribing(true);
    setTranscriptionResult(null);

    try {
      let transcript = "";

      // Stop native recording and get WAV data
      try {
        const wavData = await invoke<number[]>("stop_recording");

        // Try to transcribe with Whisper
        const hasModel = await invoke<boolean>("check_whisper_model");
        if (hasModel && wavData.length > 0) {
          transcript = await invoke<string>("transcribe_audio", {
            audioData: wavData,
          });
          setTranscriptionResult(transcript);
        } else if (!hasModel) {
          setTranscriptionResult("Whisper model not downloaded. Go to Settings to download it.");
        }
      } catch (err: any) {
        console.error("Recording/transcription error:", err);
        setTranscriptionResult(`Transcription: ${err}`);
      }

      const meeting = {
        id: null,
        client_id:
          selectedClientId && selectedClientId !== "manual" ? parseInt(selectedClientId) : 0,
        client_name: clientName,
        client_email: clientEmail,
        title: `Meeting with ${clientName}`,
        recording_path: null,
        transcript: transcript || null,
        summary: null,
        meeting_date: new Date().toISOString(),
        duration_seconds: recordingTime,
        notes: null,
      };

      await invoke("save_meeting", { meeting });
      await loadMeetings();
      await loadClients();

      // Check if calendar is connected and show prompt
      if (calendarProvider) {
        setSavedMeetingName(clientName);
        setSavedMeetingEmail(clientEmail);
        setSavedMeetingDuration(recordingTime);
        setShowCalendarPrompt(true);
      }

      setShowSavePrompt(false);
      setRecordingTime(0);
      setClientName("");
      setClientEmail("");
      setSelectedClientId("");
      setIsManualEntry(false);
    } catch (error) {
      console.error("Failed to save meeting:", error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const discardMeeting = async () => {
    // Stop recording and discard data
    try {
      await invoke<number[]>("stop_recording");
    } catch {
      // ignore errors on discard
    }
    setShowSavePrompt(false);
    setRecordingTime(0);
    setClientName("");
    setClientEmail("");
    setSelectedClientId("");
    setIsManualEntry(false);
    setTranscriptionResult(null);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
      .toString()
      .padStart(2, "0");
    const mins = Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleCreateCalendarEvent = async () => {
    if (!calendarProvider) return;
    setCalendarCreating(true);
    setCalendarResult(null);
    try {
      const now = new Date();
      const end = new Date(now.getTime() + (savedMeetingDuration || 3600) * 1000);
      const link: string = await invoke("create_calendar_event", {
        provider: calendarProvider,
        event: {
          title: `Meeting with ${savedMeetingName}`,
          start_time: now.toISOString(),
          end_time: end.toISOString(),
          attendee_email: savedMeetingEmail || null,
          description: `Follow-up meeting with ${savedMeetingName}`,
        },
      });
      setCalendarResult(link ? "Event created!" : "Event created!");
      setTimeout(() => {
        setShowCalendarPrompt(false);
        setCalendarResult(null);
      }, 2000);
    } catch (err: any) {
      setCalendarResult(`Failed: ${err}`);
    } finally {
      setCalendarCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Meeting Recorder</h2>
        <p className="text-sm text-gray-500 mt-1">
          Record client meetings with automatic transcription
        </p>
      </div>

      {/* Recording Error */}
      {recordingError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{recordingError}</p>
          <button
            onClick={() => setRecordingError(null)}
            className="text-xs text-red-600 underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Calendar Event Prompt */}
      {showCalendarPrompt && (
        <div className="card bg-green-50 border-green-200">
          <h3 className="text-lg font-semibold mb-2">Create Calendar Event?</h3>
          <p className="text-sm text-gray-600 mb-3">
            Add a follow-up event for <strong>{savedMeetingName}</strong> to your calendar?
          </p>
          <div className="bg-white rounded-lg border border-green-200 p-3 mb-4 text-sm space-y-1">
            <p>
              <span className="font-medium">Title:</span> Meeting with {savedMeetingName}
            </p>
            {savedMeetingEmail && (
              <p>
                <span className="font-medium">Attendee:</span> {savedMeetingEmail}
              </p>
            )}
            <p>
              <span className="font-medium">Provider:</span>{" "}
              {calendarProvider === "google" ? "Google Calendar" : "Outlook Calendar"}
            </p>
          </div>
          {calendarResult && (
            <p
              className={`text-sm mb-3 ${calendarResult.startsWith("Failed") ? "text-red-600" : "text-green-600"}`}
            >
              {calendarResult}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleCreateCalendarEvent}
              disabled={calendarCreating}
              className="btn-primary"
            >
              {calendarCreating ? "Creating..." : "Create Event"}
            </button>
            <button
              onClick={() => {
                setShowCalendarPrompt(false);
                setCalendarResult(null);
              }}
              className="btn-secondary"
              disabled={calendarCreating}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Whisper Model Warning */}
      {whisperReady === false && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800 font-medium">
            Whisper transcription model not downloaded
          </p>
          <p className="text-sm text-yellow-700 mt-1">
            Recordings will save without transcripts. Go to <strong>Settings</strong> to download
            the Whisper model for automatic transcription.
          </p>
        </div>
      )}

      {/* Client Info Form Modal */}
      {showClientForm && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Client Information</h3>
          <p className="text-sm text-gray-500 mb-4">
            Select an existing client or enter details manually before starting the recording.
          </p>
          <form onSubmit={handleClientSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Select Client</label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="input"
              >
                <option value="">-- Choose a client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id?.toString()}>
                    {c.first_name} {c.last_name} ({c.email})
                  </option>
                ))}
                <option value="manual">+ New client (manual entry)</option>
              </select>
            </div>

            {isManualEntry && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Client Name</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="input"
                    placeholder="e.g., Sarah Johnson"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Client Email</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="input"
                    placeholder="e.g., sarah@email.com"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Future emails from this address will auto-import to their profile
                  </p>
                </div>
              </>
            )}

            {selectedClientId && selectedClientId !== "manual" && clientName && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-medium">{clientName}</p>
                <p className="text-sm text-gray-500">{clientEmail}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button type="submit" className="btn-primary" disabled={!clientName || !clientEmail}>
                Start Recording
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClientForm(false);
                  setSelectedClientId("");
                  setIsManualEntry(false);
                  setClientName("");
                  setClientEmail("");
                }}
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
            Recording completed for <strong>{clientName}</strong> ({formatTime(recordingTime)})
          </p>

          {isTranscribing && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-white rounded-lg border border-blue-200">
              <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-sm text-blue-700">Transcribing with Whisper...</span>
            </div>
          )}

          {transcriptionResult && (
            <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
              <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">
                Transcript
              </h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{transcriptionResult}</p>
            </div>
          )}

          <p className="text-sm text-gray-500 mb-4">
            This client will be saved to your database. Future emails from {clientEmail} will
            automatically import to their profile.
          </p>
          <div className="flex gap-3">
            <button onClick={saveMeeting} className="btn-primary" disabled={isTranscribing}>
              {isTranscribing ? "Transcribing..." : "Save Client & Meeting"}
            </button>
            <button onClick={discardMeeting} className="btn-secondary" disabled={isTranscribing}>
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
                Recording for: <strong>{clientName}</strong>
              </div>
              <p className="text-2xl font-mono">{formatTime(recordingTime)}</p>
              <p className="text-red-600 font-medium">Recording in progress...</p>
              <p className="text-xs text-gray-400">Audio is being captured from your microphone</p>
              <button onClick={stopRecording} className="btn-secondary">
                Stop Recording
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </div>

              {/* Mic Check Panel */}
              <div className="bg-gray-50 rounded-lg p-4 max-w-sm mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Mic Check</span>
                  <button
                    onClick={micTestActive ? stopMicTest : startMicTest}
                    className={`text-xs px-3 py-1 rounded-lg font-medium ${
                      micTestActive
                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                        : "bg-primary-100 text-primary-700 hover:bg-primary-200"
                    }`}
                  >
                    {micTestActive ? "Stop" : "Test mic"}
                  </button>
                </div>
                {micTestError && <p className="text-xs text-red-600 mb-2">{micTestError}</p>}
                <div className="flex items-end justify-center gap-[3px] h-10">
                  {Array.from({ length: 20 }, (_, i) => {
                    const threshold = (i + 1) * 5;
                    const active = micTestActive && micLevel >= threshold;
                    const barHeight = 6 + i * 1.4;
                    const color =
                      i < 14
                        ? active
                          ? "bg-green-500"
                          : "bg-green-200"
                        : i < 18
                          ? active
                            ? "bg-yellow-500"
                            : "bg-yellow-200"
                          : active
                            ? "bg-red-500"
                            : "bg-red-200";
                    return (
                      <div
                        key={i}
                        className={`w-[6px] rounded-sm transition-colors duration-75 ${color}`}
                        style={{ height: `${barHeight}px` }}
                      />
                    );
                  })}
                </div>
                {micTestActive && (
                  <p className="text-xs text-gray-500 mt-2">Speak now to test your mic</p>
                )}
              </div>

              <p className="text-gray-600">Ready to record</p>
              <button onClick={startRecording} className="btn-primary">
                Start Recording
              </button>
              <p className="text-xs text-gray-400">Select a client on the next step</p>
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
              <div key={meeting.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{meeting.client_name}</p>
                    <p className="text-sm text-gray-500">{meeting.client_email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatDuration(meeting.duration_seconds)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(meeting.meeting_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {meeting.transcript && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">
                      Transcript
                    </p>
                    <p className="text-sm text-gray-600 line-clamp-3">{meeting.transcript}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Features Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Native Recording</h4>
          <p className="text-sm text-gray-600">
            Audio is captured natively through your system microphone for maximum compatibility
          </p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Whisper Transcription</h4>
          <p className="text-sm text-gray-600">
            Meetings are transcribed using on-device Whisper AI. Download the model from Settings.
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
  );
}

export default Meetings;
