import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

interface DashboardProps {
  stats: any;
  onNavigate?: (
    view: "dashboard" | "team" | "clients" | "policies" | "meetings" | "settings",
  ) => void;
  onSync?: () => void;
  syncing?: boolean;
  syncResult?: string | null;
}

interface UpcomingMeeting {
  title: string;
  start_time: string;
  end_time: string;
  attendee_email: string | null;
  client_name: string | null;
  provider: string;
}

const awaitingResponse = ["Mark Thompson", "Priya Sharma", "David Chen"];

function Dashboard({ stats, onNavigate, onSync, syncing, syncResult }: DashboardProps) {
  const [upcomingMeetings, setUpcomingMeetings] = useState<UpcomingMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);

  useEffect(() => {
    loadUpcomingMeetings();
  }, []);

  const loadUpcomingMeetings = async () => {
    setLoadingMeetings(true);
    try {
      const meetings: UpcomingMeeting[] = await invoke("get_upcoming_meetings");
      setUpcomingMeetings(meetings);
    } catch {
      // No calendar connected or error fetching
      setUpcomingMeetings([]);
    } finally {
      setLoadingMeetings(false);
    }
  };

  const formatMeetingTime = (isoString: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

      if (date.toDateString() === now.toDateString()) {
        return `Today, ${timeStr}`;
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return `Tomorrow, ${timeStr}`;
      } else {
        return `${date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}, ${timeStr}`;
      }
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="card md:col-span-4">
          <p className="text-xs text-gray-500">Meetings Coming Up</p>
          <p className="text-3xl font-bold text-primary-600">{upcomingMeetings.length}</p>
          <ul className="mt-3 space-y-1">
            {loadingMeetings ? (
              <li className="text-xs text-gray-400">Loading...</li>
            ) : upcomingMeetings.length === 0 ? (
              <li className="text-xs text-gray-400">
                No upcoming meetings. Connect your calendar in Settings.
              </li>
            ) : (
              upcomingMeetings.slice(0, 5).map((meeting, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate min-w-0">
                    {meeting.client_name ? (
                      <>
                        <span className="font-medium text-gray-700">{meeting.client_name}</span>
                        {meeting.title && <span className="text-gray-400 ml-1">| {meeting.title}</span>}
                      </>
                    ) : meeting.attendee_email ? (
                      <>
                        <span className="font-medium text-gray-700">{meeting.attendee_email}</span>
                        {meeting.title && <span className="text-gray-400 ml-1">| {meeting.title}</span>}
                      </>
                    ) : (
                      <span className="font-medium text-gray-700">{meeting.title}</span>
                    )}
                  </span>
                  <span className="text-gray-400 whitespace-nowrap flex-shrink-0">{formatMeetingTime(meeting.start_time)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="card md:col-span-4">
          <p className="text-xs text-gray-500">Clients Awaiting Response</p>
          <p className="text-3xl font-bold text-amber-600">8</p>
          <ul className="mt-3 space-y-1">
            {awaitingResponse.map((name) => (
              <li key={name} className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">{name}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card md:col-span-2">
          <p className="text-xs text-gray-500">Clients In Progress</p>
          <p className="text-3xl font-bold text-primary-600">12</p>
          <p className="text-xs text-gray-400 mt-3">Active pipeline</p>
        </div>
        <div className="card md:col-span-2">
          <p className="text-xs text-gray-500">Clients Converted</p>
          <p className="text-3xl font-bold text-green-600">34</p>
          <p className="text-xs text-gray-400 mt-3">Successful deals</p>
        </div>
      </div>

      {/* Analytics Section */}
      {stats && (
        <>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Performance Analytics (Demo Data)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Average Deal Size</p>
                <p className="text-2xl font-bold">${stats.avg_deal_size.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Monthly Revenue</p>
                <p className="text-2xl font-bold">${stats.monthly_revenue.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">YTD Revenue</p>
                <p className="text-2xl font-bold">${stats.ytd_revenue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Deal Activity (Demo)</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Deals This Month</span>
                  <span className="font-semibold">{stats.deals_this_month}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Deals Last Month</span>
                  <span className="font-semibold">{stats.deals_last_month}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Top Performing Bank (Demo)</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Bank</span>
                  <span className="font-semibold">{stats.top_performing_bank}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Conversion Rate</span>
                  <span className="font-semibold text-green-600">{stats.top_bank_conversion}%</span>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-4">
                * Analytics will be populated with real data as you use the system
              </p>
            </div>
          </div>
        </>
      )}

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="flex gap-4">
          <button className="btn-primary" onClick={() => onNavigate?.("clients")}>
            Add New Client
          </button>
          <button className="btn-secondary" onClick={() => onNavigate?.("meetings")}>
            Start Recording
          </button>
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => onSync?.()}
            disabled={syncing}
          >
            {syncing ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync
              </>
            )}
          </button>
        </div>
        {syncResult && (
          <p className="text-sm text-green-600 mt-2">{syncResult}</p>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
