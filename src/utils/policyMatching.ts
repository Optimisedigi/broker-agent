export interface Client {
  id?: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  income?: number;
  payg?: number;
  assets?: number;
  liabilities?: number;
  notes: string;
  home_address?: string;
  investment_addresses?: string;
  properties_viewing?: string;
  available_deposit?: number;
  monthly_expenses?: number;
  goals?: string;
  home_ownership?: string;
  client_status: string;
  referral_source?: string;
  pipeline_stage?: string;
  current_lender?: string;
  current_loan_balance?: number;
  current_interest_rate?: number;
  current_loan_type?: string;
  ai_summary?: string;
  created_at: string;
  updated_at: string;
}

export interface BankPolicy {
  id?: number;
  bank_name: string;
  policy_name: string;
  min_income?: number;
  max_ltv?: number;
  interest_rate?: number;
  requirements: string;
  notes: string;
}

export interface PolicyMatch {
  policy: BankPolicy;
  suitability: "Eligible" | "Borderline" | "Not Eligible";
  incomePass: boolean;
  lvrPass: boolean;
  borrowingPower: number;
  incomeReason: string;
  lvrReason: string;
}

export function calculatePolicyMatches(client: Client, policies: BankPolicy[]): PolicyMatch[] {
  const income = client.income || 0;
  const deposit = client.available_deposit || 0;
  const liabilities = client.liabilities || 0;
  const annualExpenses = (client.monthly_expenses || 0) * 12;

  const borrowingPower = Math.max(0, (income - annualExpenses) * 6 - liabilities);

  const matches: PolicyMatch[] = policies.map((policy) => {
    const minIncome = policy.min_income || 0;
    const maxLtv = policy.max_ltv || 100;

    const incomePass = income >= minIncome;
    const incomeReason = incomePass
      ? `Income $${income.toLocaleString()} meets minimum $${minIncome.toLocaleString()}`
      : `Income $${income.toLocaleString()} below minimum $${minIncome.toLocaleString()}`;

    const loanAmount = borrowingPower;
    const totalProperty = deposit + loanAmount;
    const lvr = totalProperty > 0 ? (loanAmount / totalProperty) * 100 : 100;
    const lvrPass = lvr <= maxLtv;

    const lvrReason = lvrPass
      ? `LVR ${lvr.toFixed(1)}% within max ${maxLtv}%`
      : `LVR ${lvr.toFixed(1)}% exceeds max ${maxLtv}%`;

    let suitability: PolicyMatch["suitability"];
    if (incomePass && lvrPass) {
      suitability = "Eligible";
    } else if (incomePass || lvrPass) {
      suitability = "Borderline";
    } else {
      suitability = "Not Eligible";
    }

    return { policy, suitability, incomePass, lvrPass, borrowingPower, incomeReason, lvrReason };
  });

  const order = { Eligible: 0, Borderline: 1, "Not Eligible": 2 };
  matches.sort((a, b) => order[a.suitability] - order[b.suitability]);

  return matches;
}
