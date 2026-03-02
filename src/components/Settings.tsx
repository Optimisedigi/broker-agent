import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";

interface SettingsProps {
  onLogoChange: (logo: string | null) => void;
  onProfileChange?: (profile: any) => void;
}

function Settings({ onLogoChange, onProfileChange }: SettingsProps) {
  const [logo, setLogo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Profile state
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileRole, setProfileRole] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Email templates
  const [introEmail, setIntroEmail] = useState("");
  const [proposalEmail, setProposalEmail] = useState("");
  const [followUpEmail, setFollowUpEmail] = useState("");
  const [approvalEmail, setApprovalEmail] = useState("");
  const [settlementEmail, setSettlementEmail] = useState("");
  const [templatesSaved, setTemplatesSaved] = useState(false);

  // Mic & screen test
  const [micStatus, setMicStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [screenStatus, setScreenStatus] = useState<"idle" | "testing" | "success" | "error">(
    "idle",
  );
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState("");
  const [screenError, setScreenError] = useState("");

  // Whisper model state
  const [whisperStatus, setWhisperStatus] = useState<{
    downloaded: boolean;
    model_name: string;
    size_bytes: number;
  } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // OAuth state
  interface OAuthStatus {
    connected: boolean;
    provider: string;
    account_email: string | null;
    last_sync_at: string | null;
  }
  const [googleStatus, setGoogleStatus] = useState<OAuthStatus>({
    connected: false,
    provider: "google",
    account_email: null,
    last_sync_at: null,
  });
  const [outlookStatus, setOutlookStatus] = useState<OAuthStatus>({
    connected: false,
    provider: "microsoft",
    account_email: null,
    last_sync_at: null,
  });
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("broker_logo");
    if (saved) setLogo(saved);
    loadProfile();
    loadTemplates();
    checkOAuthStatuses();
    checkWhisperStatus();

    const unlisten = listen<{ downloaded: number; total: number; percent: number }>(
      "whisper-download-progress",
      (event) => {
        setDownloadProgress(event.payload.percent);
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const checkWhisperStatus = async () => {
    try {
      const status: any = await invoke("get_whisper_model_status");
      setWhisperStatus(status);
    } catch (err) {
      console.error("Failed to check whisper status:", err);
    }
  };

  const handleDownloadModel = async () => {
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);
    try {
      await invoke("download_whisper_model");
      await checkWhisperStatus();
    } catch (err: any) {
      setDownloadError(err?.toString() || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const checkOAuthStatuses = async () => {
    try {
      const g: OAuthStatus = await invoke("check_oauth_status", { provider: "google" });
      setGoogleStatus(g);
      const m: OAuthStatus = await invoke("check_oauth_status", { provider: "microsoft" });
      setOutlookStatus(m);
    } catch (err) {
      console.error("Failed to check OAuth status:", err);
    }
  };

  const connectProvider = async (provider: string) => {
    setConnecting(provider);
    try {
      const status: OAuthStatus = await invoke("start_oauth", { provider });
      if (provider === "google") setGoogleStatus(status);
      else setOutlookStatus(status);

      // Auto-sync after connecting
      setSyncing(true);
      setSyncResult(null);
      try {
        const r: any = await invoke("sync_emails", { provider });
        setSyncResult(
          `Connected and imported ${r.imported_count} document${r.imported_count !== 1 ? "s" : ""}`,
        );
        await checkOAuthStatuses();
      } catch (syncErr: any) {
        setSyncResult("Connected successfully");
      } finally {
        setSyncing(false);
      }
    } catch (err: any) {
      console.error("OAuth failed:", err);
      setSyncResult(`Connection error: ${err}`);
    } finally {
      setConnecting(null);
    }
  };

  const disconnectProvider = async (provider: string) => {
    try {
      await invoke("disconnect_oauth", { provider });
      const empty: OAuthStatus = {
        connected: false,
        provider,
        account_email: null,
        last_sync_at: null,
      };
      if (provider === "google") setGoogleStatus(empty);
      else setOutlookStatus(empty);
    } catch (err) {
      console.error("Disconnect failed:", err);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    let total = 0;
    try {
      if (googleStatus.connected) {
        const r: any = await invoke("sync_emails", { provider: "google" });
        total += r.imported_count;
      }
      if (outlookStatus.connected) {
        const r: any = await invoke("sync_emails", { provider: "microsoft" });
        total += r.imported_count;
      }
      setSyncResult(`Imported ${total} document${total !== 1 ? "s" : ""}`);
      await checkOAuthStatuses();
    } catch (err: any) {
      setSyncResult(`Sync failed: ${err}`);
    } finally {
      setSyncing(false);
    }
  };

  const loadTemplates = () => {
    setIntroEmail(
      localStorage.getItem("tpl_intro") ||
        `Hi {{client_name}},\n\nThank you for reaching out. My name is {{broker_name}} and I'd love to help you with your property finance needs.\n\nI'd like to schedule a quick call to understand your goals and discuss how I can assist. Are you available this week for a 15-minute chat?\n\nLooking forward to hearing from you.\n\nBest regards,\n{{broker_name}}`,
    );
    setProposalEmail(
      localStorage.getItem("tpl_proposal") ||
        `Hi {{client_name}},\n\nGreat speaking with you today. As discussed, I've put together a proposal based on the property at {{property_address}}.\n\nHere's a summary of what we covered:\n- Loan amount: {{loan_amount}}\n- Recommended lender: {{lender_name}}\n- Estimated rate: {{interest_rate}}\n\nPlease review the attached proposal and let me know if you have any questions.\n\nBest regards,\n{{broker_name}}`,
    );
    setFollowUpEmail(
      localStorage.getItem("tpl_followup") ||
        `Hi {{client_name}},\n\nJust checking in to see how things are going with the property at {{property_address}}.\n\nIf you have any questions about the proposal or would like to discuss next steps, I'm happy to jump on a quick call.\n\nBest regards,\n{{broker_name}}`,
    );
    setApprovalEmail(
      localStorage.getItem("tpl_approval") ||
        `Hi {{client_name}},\n\nGreat news! Your loan has been formally approved. Here are the details:\n\n- Property: {{property_address}}\n- Loan amount: {{loan_amount}}\n- Lender: {{lender_name}}\n- Interest rate: {{interest_rate}}\n\nThe next step is loan signing, and I will be in touch shortly to coordinate the paperwork. If you have any questions in the meantime, please don't hesitate to reach out.\n\nCongratulations on reaching this milestone!\n\nBest regards,\n{{broker_name}}`,
    );
    setSettlementEmail(
      localStorage.getItem("tpl_settlement") ||
        `Hi {{client_name}},\n\nCongratulations on settling on your new property at {{property_address}}! This is a huge milestone and you should be very proud.\n\nHere is a summary of your loan:\n- Loan amount: {{loan_amount}}\n- Lender: {{lender_name}}\n- Interest rate: {{interest_rate}}\n\nI will check in with you in a few months to make sure everything is running smoothly and to review whether there are better options available as the market changes.\n\nWishing you all the best in your new home. It has been a pleasure working with you.\n\nWarm regards,\n{{broker_name}}`,
    );
  };

  const handleSaveTemplates = () => {
    localStorage.setItem("tpl_intro", introEmail);
    localStorage.setItem("tpl_proposal", proposalEmail);
    localStorage.setItem("tpl_followup", followUpEmail);
    localStorage.setItem("tpl_approval", approvalEmail);
    localStorage.setItem("tpl_settlement", settlementEmail);
    setTemplatesSaved(true);
    setTimeout(() => setTemplatesSaved(false), 2000);
  };

  const loadProfile = async () => {
    try {
      const profile: any = await invoke("get_broker_profile");
      if (profile) {
        setProfileName(profile.name || "");
        setProfileEmail(profile.email || "");
        setProfilePhone(profile.phone || "");
        setProfileRole(profile.role || "");
        setProfilePhoto(profile.photo || null);
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const saved: any = await invoke("save_broker_profile", {
        profile: {
          id: null,
          name: profileName,
          email: profileEmail,
          phone: profilePhone,
          role: profileRole,
          photo: profilePhoto,
          created_at: "",
          updated_at: "",
        },
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
      if (onProfileChange) {
        onProfileChange({ name: saved.name, photo: saved.photo || null });
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setProfileSaving(false);
    }
  };

  const testMicrophone = async () => {
    setMicStatus("testing");
    setMicError("");
    setMicLevel(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      let maxLevel = 0;
      const checkLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        if (normalized > maxLevel) maxLevel = normalized;
        setMicLevel(normalized);
      };
      const interval = setInterval(checkLevel, 100);

      setTimeout(() => {
        clearInterval(interval);
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close();
        setMicStatus(maxLevel > 5 ? "success" : "error");
        if (maxLevel <= 5)
          setMicError("No audio detected. Check your microphone is connected and not muted.");
      }, 3000);
    } catch (err: any) {
      setMicStatus("error");
      setMicError(err.message || "Microphone access denied. Check your system permissions.");
    }
  };

  const testScreenRecording = async () => {
    setScreenStatus("testing");
    setScreenError("");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      // If we got here, permission was granted
      setTimeout(() => {
        stream.getTracks().forEach((t) => t.stop());
        setScreenStatus("success");
      }, 1000);
    } catch (err: any) {
      setScreenStatus("error");
      setScreenError(
        err.message || "Screen recording access denied. Check your system permissions.",
      );
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setProfilePhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      localStorage.setItem("broker_logo", base64);
      setLogo(base64);
      onLogoChange(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    localStorage.removeItem("broker_logo");
    setLogo(null);
    onLogoChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
              <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              placeholder="04XX XXX XXX"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input
              type="text"
              value={profileRole}
              onChange={(e) => setProfileRole(e.target.value)}
              placeholder="e.g. Senior Broker"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
        </div>

        <button onClick={handleSaveProfile} disabled={profileSaving} className="btn-primary">
          {profileSaving ? "Saving..." : profileSaved ? "Saved!" : "Save Profile"}
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
          <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
            {logo ? "Change Logo" : "Upload Logo"}
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
              <svg
                className="w-5 h-5 text-gray-600"
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
              <h4 className="font-medium text-sm">Microphone</h4>
            </div>

            {micStatus === "idle" && (
              <button onClick={testMicrophone} className="btn-secondary w-full text-sm">
                Test Microphone
              </button>
            )}

            {micStatus === "testing" && (
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

            {micStatus === "success" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-sm font-medium">Microphone working</span>
                </div>
                <button
                  onClick={testMicrophone}
                  className="text-xs text-primary-600 hover:text-primary-800"
                >
                  Test again
                </button>
              </div>
            )}

            {micStatus === "error" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <span className="text-sm font-medium">Test failed</span>
                </div>
                <p className="text-xs text-red-500">{micError}</p>
                <button
                  onClick={testMicrophone}
                  className="text-xs text-primary-600 hover:text-primary-800"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* Screen Recording Test */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <h4 className="font-medium text-sm">Screen Recording</h4>
            </div>

            {screenStatus === "idle" && (
              <button onClick={testScreenRecording} className="btn-secondary w-full text-sm">
                Test Screen Recording
              </button>
            )}

            {screenStatus === "testing" && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Checking permissions...</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-primary-500 h-2 rounded-full animate-pulse w-full" />
                </div>
              </div>
            )}

            {screenStatus === "success" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-sm font-medium">Screen recording available</span>
                </div>
                <button
                  onClick={testScreenRecording}
                  className="text-xs text-primary-600 hover:text-primary-800"
                >
                  Test again
                </button>
              </div>
            )}

            {screenStatus === "error" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <span className="text-sm font-medium">Test failed</span>
                </div>
                <p className="text-xs text-red-500">{screenError}</p>
                <button
                  onClick={testScreenRecording}
                  className="text-xs text-primary-600 hover:text-primary-800"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          On macOS, you may need to grant microphone and screen recording permissions in System
          Settings &gt; Privacy &amp; Security.
        </p>
      </div>

      {/* Whisper Model */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-2">Whisper Transcription</h3>
        <p className="text-sm text-gray-500 mb-4">
          On-device meeting transcription powered by Whisper AI large-v3. All processing happens
          locally, no data leaves your computer.
        </p>
        <div className="border border-gray-200 rounded-lg p-4">
          {whisperStatus?.downloaded ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{whisperStatus.model_name}</p>
                <p className="text-xs text-gray-500">
                  Large model, highest accuracy, on-device (
                  {(whisperStatus.size_bytes / 1024 / 1024 / 1024).toFixed(1)} GB)
                </p>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-sm font-medium">Ready</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="font-medium text-sm">ggml-large-v3.bin</p>
                <p className="text-xs text-gray-500">
                  High-accuracy on-device transcription (~3.1 GB download)
                </p>
              </div>
              {downloading ? (
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">Downloading... {downloadProgress}%</p>
                </div>
              ) : (
                <div>
                  <button onClick={handleDownloadModel} className="btn-primary text-sm">
                    Download Model
                  </button>
                  {downloadError && <p className="text-xs text-red-500 mt-2">{downloadError}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Email Templates */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-2">Email Templates</h3>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <span className="text-orange-500 mt-0.5 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium text-orange-800">Coming Soon: Pipeline Stage Triggers</p>
              <p className="text-xs text-orange-700 mt-1">
                These templates will be automatically triggered when a client moves through pipeline stages. For example, when you move a client to "Discovery Call", the introduction email is created as a draft. When formal approval comes through, the approval congratulations email is drafted and ready to send.
              </p>
              <p className="text-xs text-orange-700 mt-1">
                Nothing sends automatically. All emails are pushed to your Gmail or Outlook drafts for you to review, personalise, and send when ready. Below is an example of the templates that can be configured for each stage.
              </p>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Customise your email templates. Use placeholders like{" "}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{"{{broker_name}}"}</code>,{" "}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{"{{client_name}}"}</code>,{" "}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{"{{property_address}}"}</code>{" "}
          to auto-populate fields.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Introduction Email
            </label>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Trigger: Lead Received / Discovery Call</span>
            </div>
            <p className="text-xs text-gray-400 mb-1">Drafted when first contacting a new client</p>
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
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Trigger: Client Recommendation</span>
            </div>
            <p className="text-xs text-gray-400 mb-1">
              Drafted after a meeting with loan proposal details
            </p>
            <textarea
              value={proposalEmail}
              onChange={(e) => setProposalEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm font-mono"
              rows={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Follow-Up Email</label>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Trigger: Documents Collected / Application Submitted</span>
            </div>
            <p className="text-xs text-gray-400 mb-1">Drafted to check in after sending a proposal</p>
            <textarea
              value={followUpEmail}
              onChange={(e) => setFollowUpEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm font-mono"
              rows={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Approval Congratulations</label>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Trigger: Formal Approval</span>
            </div>
            <p className="text-xs text-gray-400 mb-1">Drafted when the client's loan is formally approved</p>
            <textarea
              value={approvalEmail}
              onChange={(e) => setApprovalEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm font-mono"
              rows={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Settlement Congratulations</label>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Trigger: Settlement</span>
            </div>
            <p className="text-xs text-gray-400 mb-1">Drafted when the client settles on their property</p>
            <textarea
              value={settlementEmail}
              onChange={(e) => setSettlementEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm font-mono"
              rows={8}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={handleSaveTemplates} className="btn-primary">
            {templatesSaved ? "Saved!" : "Save Templates"}
          </button>
          <p className="text-xs text-gray-400">
            Available: {"{{broker_name}}"}, {"{{client_name}}"}, {"{{property_address}}"},{" "}
            {"{{loan_amount}}"}, {"{{lender_name}}"}, {"{{interest_rate}}"}
          </p>
        </div>
      </div>

      {/* Email Integration */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-2">Email Integration</h3>
        <p className="text-sm text-gray-500 mb-4">
          Connect your email to automatically import client attachments (PAYG summaries, bank
          statements, ID documents).
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Gmail */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
              <h4 className="font-medium text-sm">Gmail</h4>
            </div>
            {googleStatus.connected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-sm font-medium">Connected</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{googleStatus.account_email}</p>
                <button
                  onClick={() => disconnectProvider("google")}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => connectProvider("google")}
                disabled={connecting === "google"}
                className="btn-secondary w-full text-sm"
              >
                {connecting === "google" ? "Connecting..." : "Connect Gmail"}
              </button>
            )}
          </div>

          {/* Outlook */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
              <h4 className="font-medium text-sm">Outlook</h4>
            </div>
            {outlookStatus.connected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-sm font-medium">Connected</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{outlookStatus.account_email}</p>
                <button
                  onClick={() => disconnectProvider("microsoft")}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => connectProvider("microsoft")}
                disabled={connecting === "microsoft"}
                className="btn-secondary w-full text-sm"
              >
                {connecting === "microsoft" ? "Connecting..." : "Connect Outlook"}
              </button>
            )}
          </div>
        </div>

        {/* Sync controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncNow}
            disabled={syncing || (!googleStatus.connected && !outlookStatus.connected)}
            className="btn-primary text-sm"
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
          {(googleStatus.last_sync_at || outlookStatus.last_sync_at) && (
            <span className="text-xs text-gray-400">
              Last sync:{" "}
              {new Date(
                googleStatus.last_sync_at || outlookStatus.last_sync_at || "",
              ).toLocaleString()}
            </span>
          )}
        </div>
        {syncResult && <p className="text-sm text-green-600 mt-2">{syncResult}</p>}
      </div>
    </div>
  );
}

export default Settings;
