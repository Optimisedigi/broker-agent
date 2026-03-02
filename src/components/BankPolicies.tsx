import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

interface BankPolicy {
  id?: number;
  bank_name: string;
  policy_name: string;
  min_income?: number;
  max_ltv?: number;
  interest_rate?: number;
  requirements: string;
  notes: string;
}

const BANKS = ["Commonwealth Bank", "Westpac", "ANZ", "NAB"] as const;

function BankPolicies() {
  const [policies, setPolicies] = useState<BankPolicy[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [newPolicy, setNewPolicy] = useState<Partial<BankPolicy>>({
    bank_name: "",
    policy_name: "",
    requirements: "",
    notes: "",
  });

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      const data = await invoke<BankPolicy[]>("get_bank_policies");
      setPolicies(data);
    } catch (error) {
      console.error("Failed to load policies:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await invoke("create_bank_policy", { policy: newPolicy });
      setShowForm(false);
      setNewPolicy({
        bank_name: selectedBank || "",
        policy_name: "",
        requirements: "",
        notes: "",
      });
      loadPolicies();
    } catch (error) {
      console.error("Failed to create policy:", error);
    }
  };

  const getPoliciesForBank = (bankName: string) => policies.filter((p) => p.bank_name === bankName);

  const getLastUpdated = (bankName: string) => {
    const bankPolicies = getPoliciesForBank(bankName);
    if (bankPolicies.length === 0) return null;
    // For now just show a static "last fetched" since we don't store timestamps on policies yet
    return "Manual entry";
  };

  // Bank detail view
  if (selectedBank) {
    const bankPolicies = getPoliciesForBank(selectedBank);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setSelectedBank(null);
              setShowForm(false);
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Banks
          </button>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">{selectedBank}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {bankPolicies.length} {bankPolicies.length === 1 ? "policy" : "policies"} stored
            </p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setNewPolicy({
                bank_name: selectedBank,
                policy_name: "",
                requirements: "",
                notes: "",
              });
            }}
            className="btn-primary"
          >
            {showForm ? "Cancel" : "Add Policy"}
          </button>
        </div>

        {showForm && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">New Policy for {selectedBank}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Policy Name</label>
                <input
                  type="text"
                  value={newPolicy.policy_name}
                  onChange={(e) => setNewPolicy({ ...newPolicy, policy_name: e.target.value })}
                  className="input"
                  placeholder="e.g., Standard Variable"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Min Income</label>
                  <input
                    type="number"
                    value={newPolicy.min_income || ""}
                    onChange={(e) =>
                      setNewPolicy({ ...newPolicy, min_income: parseFloat(e.target.value) })
                    }
                    className="input"
                    placeholder="$"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max LTV (%)</label>
                  <input
                    type="number"
                    value={newPolicy.max_ltv || ""}
                    onChange={(e) =>
                      setNewPolicy({ ...newPolicy, max_ltv: parseFloat(e.target.value) })
                    }
                    className="input"
                    placeholder="80"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPolicy.interest_rate || ""}
                    onChange={(e) =>
                      setNewPolicy({ ...newPolicy, interest_rate: parseFloat(e.target.value) })
                    }
                    className="input"
                    placeholder="5.5"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Requirements</label>
                <textarea
                  value={newPolicy.requirements}
                  onChange={(e) => setNewPolicy({ ...newPolicy, requirements: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="e.g., Min 2 years employment, good credit score..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={newPolicy.notes}
                  onChange={(e) => setNewPolicy({ ...newPolicy, notes: e.target.value })}
                  className="input"
                  rows={2}
                />
              </div>
              <button type="submit" className="btn-primary">
                Save Policy
              </button>
            </form>
          </div>
        )}

        {bankPolicies.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-500">No policies added yet for {selectedBank}.</p>
            <p className="text-sm text-gray-400 mt-2">
              Click "Add Policy" to store a lending policy
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {bankPolicies.map((policy) => (
              <div key={policy.id} className="card">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold">{policy.policy_name}</h4>
                  {policy.interest_rate != null && (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">
                      {policy.interest_rate}%
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                  {policy.min_income != null && (
                    <div>
                      <span className="text-gray-400">Min Income:</span> $
                      {policy.min_income.toLocaleString()}
                    </div>
                  )}
                  {policy.max_ltv != null && (
                    <div>
                      <span className="text-gray-400">Max LTV:</span> {policy.max_ltv}%
                    </div>
                  )}
                </div>
                {policy.requirements && (
                  <div className="pt-3 border-t">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                      Requirements
                    </p>
                    <p className="text-sm text-gray-700">{policy.requirements}</p>
                  </div>
                )}
                {policy.notes && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                      Notes
                    </p>
                    <p className="text-sm text-gray-600">{policy.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Bank overview table
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Bank Policies</h2>
          <p className="text-sm text-gray-500 mt-1">
            Store and manage lending policies for each bank
          </p>
        </div>
      </div>

      <div className="card">
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Bank</th>
                <th className="px-4 py-3 text-center">Policies Stored</th>
                <th className="px-4 py-3 text-center">Rate Range</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {BANKS.map((bank) => {
                const bankPolicies = getPoliciesForBank(bank);
                const rates = bankPolicies
                  .map((p) => p.interest_rate)
                  .filter((r): r is number => r != null);
                const minRate = rates.length > 0 ? Math.min(...rates) : null;
                const maxRate = rates.length > 0 ? Math.max(...rates) : null;
                const lastUpdated = getLastUpdated(bank);

                return (
                  <tr
                    key={bank}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedBank(bank)}
                  >
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">{bank}</p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {bankPolicies.length > 0 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-sm font-medium">
                          {bankPolicies.length}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center text-sm">
                      {minRate != null ? (
                        <span className="text-green-700 font-medium">
                          {minRate === maxRate ? `${minRate}%` : `${minRate}% - ${maxRate}%`}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {lastUpdated || <span className="text-gray-400">No data</span>}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <svg
                        className="w-5 h-5 text-gray-400 inline-block"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Coming Soon</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Automatic policy fetching from bank websites</li>
          <li>• Smart client-to-bank matching</li>
          <li>• Rate change alerts and notifications</li>
        </ul>
      </div>
    </div>
  );
}

export default BankPolicies;
