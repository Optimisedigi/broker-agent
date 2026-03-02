import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

interface TeamProps {
  profile: {
    name: string;
    photo: string | null;
  } | null;
}

interface ReferralStat {
  source: string;
  count: number;
}

const DUMMY_BROKERS = [
  { name: "Marcus Chen", deals: 7, pipeline: 3200000, conversion: 82 },
  { name: "Sarah Williams", deals: 6, pipeline: 2800000, conversion: 78 },
  { name: "David Kumar", deals: 5, pipeline: 2100000, conversion: 75 },
  { name: "Emily Brooks", deals: 3, pipeline: 1500000, conversion: 71 },
  { name: "James O'Connor", deals: 2, pipeline: 980000, conversion: 68 },
  { name: "Lisa Zhang", deals: 1, pipeline: 650000, conversion: 64 },
  { name: "Tom Richards", deals: 0, pipeline: 420000, conversion: 58 },
  { name: "Priya Patel", deals: 0, pipeline: 250000, conversion: 52 },
];

const DUMMY_ACTIVITY = [
  { actor: "Marcus Chen", action: "closed a $450K deal with CommBank" },
  { actor: "Sarah Williams", action: "added 3 new clients" },
  { actor: "You", action: "recorded a meeting with James Cooper" },
  { actor: "David Kumar", action: "submitted a proposal to ANZ" },
  { actor: "Emily Brooks", action: "uploaded documents for Sarah Miller" },
  { actor: "Marcus Chen", action: "scheduled 2 follow-up meetings" },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const INITIALS_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-teal-500",
];

function formatCurrency(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

function getRankStyle(rank: number) {
  if (rank === 1) return "text-yellow-600 bg-yellow-50 border-yellow-200";
  if (rank === 2) return "text-gray-500 bg-gray-50 border-gray-200";
  if (rank === 3) return "text-amber-700 bg-amber-50 border-amber-200";
  return "";
}

function getRankLabel(rank: number) {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

function Team({ profile }: TeamProps) {
  const profileName = profile?.name || "";
  const [referralStats, setReferralStats] = useState<ReferralStat[]>([]);

  useEffect(() => {
    invoke<ReferralStat[]>("get_referral_stats")
      .then(setReferralStats)
      .catch((err) => console.error("Failed to load referral stats:", err));
  }, []);

  // Find if the user matches any dummy broker, otherwise insert as 4th
  const isInList = DUMMY_BROKERS.some((b) => b.name.toLowerCase() === profileName.toLowerCase());

  const brokers = isInList
    ? DUMMY_BROKERS
    : DUMMY_BROKERS.map((b, i) =>
        i === 3
          ? {
              name: profileName || "You",
              deals: 3,
              pipeline: 1500000,
              conversion: 71,
            }
          : b,
      );

  const totalPipeline = brokers.reduce((sum, b) => sum + b.pipeline, 0);
  const avgConversion = Math.round(
    brokers.reduce((sum, b) => sum + b.conversion, 0) / brokers.length,
  );

  const maxReferralCount = referralStats.length > 0 ? referralStats[0]!.count : 1;

  return (
    <div className="space-y-6">
      {/* Team Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Team Size</p>
          <p className="text-2xl font-bold text-gray-900">{brokers.length}</p>
          <p className="text-xs text-gray-400 mt-1">Active brokers</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Top Referral Source</p>
          <p className="text-2xl font-bold text-gray-900">
            {referralStats.length > 0 ? referralStats[0]!.source : "N/A"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {referralStats.length > 0
              ? `${referralStats[0]!.count} client${referralStats[0]!.count !== 1 ? "s" : ""}`
              : "No data yet"}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Team Pipeline Value</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPipeline)}</p>
          <p className="text-xs text-green-600 mt-1">+8% vs last month</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Avg Conversion Rate</p>
          <p className="text-2xl font-bold text-gray-900">{avgConversion}%</p>
          <p className="text-xs text-gray-400 mt-1">Team average</p>
        </div>
      </div>

      {/* Client Referral Sources */}
      {referralStats.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Client Referral Sources</h3>
            <span className="text-sm text-gray-500">
              {referralStats.reduce((sum, s) => sum + s.count, 0)} total responses
            </span>
          </div>
          <div className="space-y-3">
            {referralStats.map((stat) => (
              <div key={stat.source} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-36 flex-shrink-0 truncate">
                  {stat.source}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-primary-500 h-full rounded-full transition-all"
                    style={{ width: `${(stat.count / maxReferralCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900 w-8 text-right">
                  {stat.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Leaderboard</h3>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 w-16">Rank</th>
                <th className="px-4 py-3">Broker</th>
                <th className="px-4 py-3 text-right">Deals This Month</th>
                <th className="px-4 py-3 text-right">Pipeline Value</th>
                <th className="px-4 py-3 text-right">Conversion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {brokers.map((broker, index) => {
                const rank = index + 1;
                const isCurrentUser =
                  profileName && broker.name.toLowerCase() === profileName.toLowerCase();
                const isYouFallback = !profileName && broker.name === "You";
                const highlighted = isCurrentUser || isYouFallback;
                const rankStyle = getRankStyle(rank);

                return (
                  <tr
                    key={broker.name}
                    className={highlighted ? "bg-primary-50" : "hover:bg-gray-50"}
                  >
                    <td className="px-4 py-3">
                      {rank <= 3 ? (
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${rankStyle}`}
                        >
                          {getRankLabel(rank)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500 pl-2">{rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {highlighted && profile?.photo ? (
                          <img
                            src={profile.photo}
                            alt={broker.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${INITIALS_COLORS[index % INITIALS_COLORS.length]}`}
                          >
                            {getInitials(broker.name)}
                          </div>
                        )}
                        <span className="font-medium text-sm text-gray-900">
                          {broker.name}
                          {highlighted && (
                            <span className="ml-2 text-xs text-primary-600 font-normal">(You)</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {broker.deals}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {formatCurrency(broker.pipeline)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {broker.conversion}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Team Activity */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Recent Team Activity</h3>
        <div className="space-y-3">
          {DUMMY_ACTIVITY.map((item, index) => {
            const isYou =
              item.actor === "You" ||
              (profileName && item.actor.toLowerCase() === profileName.toLowerCase());

            return (
              <div
                key={index}
                className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
              >
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    isYou ? "bg-primary-500" : "bg-gray-300"
                  }`}
                />
                <p className="text-sm text-gray-700">
                  <span className={`font-medium ${isYou ? "text-primary-700" : "text-gray-900"}`}>
                    {isYou && item.actor !== "You" ? "You" : item.actor}
                  </span>{" "}
                  {item.action}
                </p>
                <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                  {index === 0
                    ? "2h ago"
                    : index === 1
                      ? "3h ago"
                      : index === 2
                        ? "5h ago"
                        : index === 3
                          ? "Yesterday"
                          : index === 4
                            ? "Yesterday"
                            : "2 days ago"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Team;
