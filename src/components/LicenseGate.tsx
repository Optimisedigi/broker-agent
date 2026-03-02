import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

interface LicenseGateProps {
  onActivated: () => void;
}

export default function LicenseGate({ onActivated }: LicenseGateProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    const trimmed = key.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      await invoke("activate_license", { key: trimmed });
      onActivated();
    } catch (err: any) {
      setError(typeof err === "string" ? err : err?.message || "Invalid license key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">License Required</h2>
          <p className="text-sm text-gray-500 mt-2">
            Your trial period has ended. Enter a license key to continue using Broker Agent.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="license-key" className="block text-sm font-medium text-gray-700 mb-1">
              License Key
            </label>
            <input
              id="license-key"
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleActivate()}
              placeholder="BA-v1.xxxxx.xxxxx"
              className="input"
              autoFocus
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            onClick={handleActivate}
            disabled={loading || !key.trim()}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Activating..." : "Activate License"}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Contact your administrator for a license key.
        </p>
      </div>
    </div>
  );
}
