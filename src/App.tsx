import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useEffect, useRef, useState } from "react";
import BankPolicies from "./components/BankPolicies";
import Clients from "./components/Clients";
import Dashboard from "./components/Dashboard";
import IndustryNews from "./components/IndustryNews";
import LicenseGate from "./components/LicenseGate";
import Meetings from "./components/Meetings";
import Settings from "./components/Settings";
import Team from "./components/Team";

type View = "dashboard" | "team" | "clients" | "policies" | "meetings" | "settings" | "news";

function App() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [stats, setStats] = useState<any>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [profile, setProfile] = useState<{ name: string; photo: string | null } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string; body: string } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [licenseState, setLicenseState] = useState<string>("loading");
  const [trialDays, setTrialDays] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(() => {
    const saved = localStorage.getItem("content_zoom");
    return saved ? parseFloat(saved) : 80;
  });

  const handleZoomIn = () => {
    setZoom((prev) => {
      const next = Math.min(150, prev + 5);
      localStorage.setItem("content_zoom", String(next));
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(60, prev - 5);
      localStorage.setItem("content_zoom", String(next));
      return next;
    });
  };

  const checkLicense = async () => {
    try {
      const status: any = await invoke("get_license_status");
      setLicenseState(status.state);
      setTrialDays(status.days_remaining);
    } catch {
      setLicenseState("trial");
    }
  };

  useEffect(() => {
    checkLicense();
    loadDashboardStats();
    loadProfile();
    checkForUpdates();
    const saved = localStorage.getItem("broker_logo");
    if (saved) setLogo(saved);
  }, []);

  const checkForUpdates = async () => {
    try {
      const update = await check();
      if (update) {
        setUpdateAvailable({ version: update.version, body: update.body || "" });
      }
    } catch {
      // No update available or not in production build
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch (err) {
      console.error("Update failed:", err);
      setUpdating(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [currentView]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      let totalEmails = 0;
      let totalDocs = 0;
      for (const provider of ["google", "microsoft"]) {
        try {
          const status: any = await invoke("check_oauth_status", { provider });
          if (status.connected) {
            const r: any = await invoke("sync_emails", { provider });
            totalEmails += r.email_count || 0;
            totalDocs += r.document_count || 0;
          }
        } catch (_) {}
      }
      if (totalEmails > 0 || totalDocs > 0) {
        const parts = [];
        if (totalEmails > 0) parts.push(`${totalEmails} email${totalEmails !== 1 ? "s" : ""}`);
        if (totalDocs > 0) parts.push(`${totalDocs} document${totalDocs !== 1 ? "s" : ""}`);
        setSyncResult(`Synced ${parts.join(", ")}`);
      } else {
        setSyncResult("Sync complete, no new items");
      }
    } catch (err: any) {
      setSyncResult(`Sync failed: ${err}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 4000);
    }
  };

  const loadDashboardStats = async () => {
    try {
      const data = await invoke("get_dashboard_stats");
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const loadProfile = async () => {
    try {
      const data: any = await invoke("get_broker_profile");
      if (data) {
        setProfile({ name: data.name, photo: data.photo || null });
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <Dashboard stats={stats} onNavigate={setCurrentView} />;
      case "team":
        return <Team profile={profile} />;
      case "clients":
        return <Clients />;
      case "policies":
        return <BankPolicies />;
      case "news":
        return <IndustryNews />;
      case "meetings":
        return <Meetings />;
      case "settings":
        return <Settings onLogoChange={setLogo} onProfileChange={setProfile} />;
      default:
        return <Dashboard stats={stats} />;
    }
  };

  if (licenseState === "loading") {
    return <div className="flex items-center justify-center h-screen bg-gray-100"><div className="text-gray-400">Loading...</div></div>;
  }

  if (licenseState === "expired_trial" || licenseState === "expired_license") {
    return <LicenseGate onActivated={checkLicense} />;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg flex flex-col">
        <div className="p-6 border-b">
          {logo && (
            <img
              src={logo}
              alt="Company logo"
              className="-ml-[10px] max-w-[146px] max-h-[146px] object-contain mb-2"
            />
          )}
          <h1 className="text-xs font-bold text-primary-700">Broker Agent (Beta)</h1>
        </div>
        <nav className="p-4 flex-1">
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => setCurrentView("dashboard")}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentView === "dashboard"
                    ? "bg-primary-100 text-primary-700"
                    : "hover:bg-gray-100"
                }`}
              >
                Client Dashboard
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView("team")}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentView === "team" ? "bg-primary-100 text-primary-700" : "hover:bg-gray-100"
                }`}
              >
                Team Dashboard
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView("clients")}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentView === "clients"
                    ? "bg-primary-100 text-primary-700"
                    : "hover:bg-gray-100"
                }`}
              >
                Clients
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView("meetings")}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentView === "meetings"
                    ? "bg-primary-100 text-primary-700"
                    : "hover:bg-gray-100"
                }`}
              >
                Meetings & Recording
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView("policies")}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentView === "policies"
                    ? "bg-primary-100 text-primary-700"
                    : "hover:bg-gray-100"
                }`}
              >
                Bank Policies
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView("news")}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentView === "news"
                    ? "bg-primary-100 text-primary-700"
                    : "hover:bg-gray-100"
                }`}
              >
                Industry News
              </button>
            </li>
          </ul>
        </nav>

        {/* How It Works */}
        <div className="px-4 pb-2">
          <button
            onClick={() => setHowItWorksOpen(!howItWorksOpen)}
            className="w-full text-left px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-between"
          >
            <span>How It Works</span>
            <svg
              className={`w-4 h-4 transition-transform ${howItWorksOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {howItWorksOpen && (
            <ol className="mt-2 ml-4 mr-2 mb-2 space-y-2 text-xs text-gray-500 list-decimal list-outside pl-3">
              <li>Add a new client (name + email)</li>
              <li>Schedule & record a meeting</li>
              <li>Meeting auto-transcribes & summarises</li>
              <li>Documents auto-import from client emails</li>
              <li>Match client to bank policies</li>
              <li>Generate & send proposal</li>
            </ol>
          )}
        </div>

        {/* Settings */}
        <div className="p-4 border-t">
          <button
            onClick={() => setCurrentView("settings")}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors text-sm ${
              currentView === "settings"
                ? "bg-primary-100 text-primary-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        <header className="bg-white shadow-sm px-8 py-4 flex-shrink-0 z-10">
          <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left", width: `${10000 / zoom}%` }}>
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">
                {
                  {
                    dashboard: "Client Dashboard",
                    team: "Team Dashboard",
                    clients: "Clients",
                    policies: "Bank Policies",
                    news: "Industry News",
                    meetings: "Meetings & Recording",
                    settings: "Settings",
                  }[currentView]
                }
              </h2>
              <div className="flex items-center gap-3">
                {licenseState === "trial" && (
                  <div className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                    Trial: {trialDays} day{trialDays !== 1 ? "s" : ""} remaining
                  </div>
                )}
                <div className="text-sm text-gray-500">
                  {new Date().toLocaleDateString("en-AU", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
                <div className="relative">
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                    title="Sync emails & documents"
                  >
                    <svg className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {syncing ? "Syncing..." : "Sync"}
                  </button>
                  {syncResult && (
                    <div className="absolute top-full right-0 mt-1 text-xs text-gray-600 bg-white border rounded-lg px-2 py-1 shadow-sm whitespace-nowrap z-10">
                      {syncResult}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setCurrentView("settings")}
                  className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center hover:bg-primary-200 transition-colors overflow-hidden flex-shrink-0"
                  title="Settings"
                >
                  {profile?.photo ? (
                    <img src={profile.photo} alt="" className="w-full h-full object-cover" />
                  ) : profile?.name ? (
                    <span className="text-sm font-semibold">
                      {profile.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </span>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>
        {updateAvailable && (
          <div className="bg-primary-50 border-b border-primary-200 px-8 py-2 flex items-center justify-between flex-shrink-0">
            <span className="text-sm text-primary-700">
              A new version ({updateAvailable.version}) is available.
            </span>
            <button
              onClick={handleUpdate}
              disabled={updating}
              className="text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              {updating ? "Updating..." : "Update & Restart"}
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <div
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top left",
              width: `${10000 / zoom}%`,
            }}
          >
            <main className="p-8">{renderView()}</main>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="fixed bottom-4 right-4 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-md px-1 py-1 z-50 opacity-50 hover:opacity-100 transition-opacity">
          <button
            onClick={handleZoomOut}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 text-lg font-medium"
            title="Zoom out"
          >
            -
          </button>
          <span className="text-xs text-gray-500 w-10 text-center select-none">{zoom}%</span>
          <button
            onClick={handleZoomIn}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 text-lg font-medium"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
