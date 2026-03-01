import { describe, it, expect } from 'vitest'
import {
  calculatePolicyMatches,
  Client,
  BankPolicy,
} from '../utils/policyMatching'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid client with all financials undefined. */
function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    first_name: 'Test',
    last_name: 'User',
    email: 'test@example.com',
    phone: '0400000000',
    notes: '',
    client_status: 'new',
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
    ...overrides,
  }
}

function makePolicy(overrides: Partial<BankPolicy> = {}): BankPolicy {
  return {
    bank_name: 'Test Bank',
    policy_name: 'Standard',
    requirements: '',
    notes: '',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Borrowing power formula:
//   Math.max(0, (income - annualExpenses) * 6 - liabilities)
//   where annualExpenses = (monthly_expenses || 0) * 12
//
// LVR formula:
//   loanAmount = borrowingPower
//   totalProperty = deposit + loanAmount
//   lvr = totalProperty > 0 ? (loanAmount / totalProperty) * 100 : 100
// ---------------------------------------------------------------------------

describe('calculatePolicyMatches', () => {
  // -----------------------------------------------------------------------
  // Income eligibility
  // -----------------------------------------------------------------------

  describe('income eligibility', () => {
    it('client with income above all policy minimums is eligible for all (income dimension)', () => {
      const client = makeClient({ income: 200_000, available_deposit: 100_000 })
      const policies = [
        makePolicy({ min_income: 50_000, max_ltv: 95 }),
        makePolicy({ min_income: 80_000, max_ltv: 95 }),
        makePolicy({ min_income: 150_000, max_ltv: 95 }),
      ]

      const results = calculatePolicyMatches(client, policies)

      results.forEach(r => {
        expect(r.incomePass).toBe(true)
      })
    })

    it('client with income below all policy minimums fails income for all', () => {
      const client = makeClient({ income: 30_000, available_deposit: 100_000 })
      const policies = [
        makePolicy({ min_income: 50_000, max_ltv: 100 }),
        makePolicy({ min_income: 80_000, max_ltv: 100 }),
      ]

      const results = calculatePolicyMatches(client, policies)

      results.forEach(r => {
        expect(r.incomePass).toBe(false)
      })
    })

    it('client at exact income threshold is eligible (boundary)', () => {
      const client = makeClient({ income: 80_000, available_deposit: 100_000 })
      const policy = makePolicy({ min_income: 80_000, max_ltv: 100 })

      const [result] = calculatePolicyMatches(client, [policy])

      expect(result.incomePass).toBe(true)
      expect(result.incomeReason).toContain('meets minimum')
    })
  })

  // -----------------------------------------------------------------------
  // LVR eligibility
  // -----------------------------------------------------------------------

  describe('LVR eligibility', () => {
    it('client with zero deposit has high LVR (100%) - most policies not eligible', () => {
      // income=100k, no expenses, no liabilities => borrowingPower = 600k
      // deposit=0 => totalProperty = 600k, lvr = (600k/600k)*100 = 100%
      const client = makeClient({ income: 100_000, available_deposit: 0 })
      const policy80 = makePolicy({ min_income: 0, max_ltv: 80 })
      const policy95 = makePolicy({ min_income: 0, max_ltv: 95 })
      const policy100 = makePolicy({ min_income: 0, max_ltv: 100 })

      const results = calculatePolicyMatches(client, [policy80, policy95, policy100])

      // LVR is 100%, so only max_ltv=100 passes
      const byLtv = results.map(r => r.lvrPass)
      expect(byLtv).toContain(false) // 80% policy
      expect(byLtv).toContain(true)  // 100% policy
    })

    it('client with high deposit has low LVR - eligible', () => {
      // income=100k, no expenses, no liabilities => borrowingPower = 600k
      // deposit=400k => totalProperty = 1M, lvr = (600k/1M)*100 = 60%
      const client = makeClient({ income: 100_000, available_deposit: 400_000 })
      const policy = makePolicy({ min_income: 0, max_ltv: 80 })

      const [result] = calculatePolicyMatches(client, [policy])

      expect(result.lvrPass).toBe(true)
      expect(result.lvrReason).toContain('within max')
    })

    it('LVR exactly at max_ltv threshold passes', () => {
      // We need lvr == max_ltv exactly. lvr = (loan / (deposit + loan)) * 100
      // If deposit = 100k and loan = 400k => lvr = (400k/500k)*100 = 80%
      // So we need borrowingPower = 400k => (income - 0) * 6 - 0 = 400k => income = 66666.67
      const income = 400_000 / 6
      const client = makeClient({ income, available_deposit: 100_000 })
      const policy = makePolicy({ min_income: 0, max_ltv: 80 })

      const [result] = calculatePolicyMatches(client, [policy])

      // lvr should be exactly 80.0%
      expect(result.lvrPass).toBe(true)
      expect(result.lvrReason).toContain('80.0%')
      expect(result.lvrReason).toContain('within max 80%')
    })
  })

  // -----------------------------------------------------------------------
  // Borrowing power calculation
  // -----------------------------------------------------------------------

  describe('borrowing power', () => {
    it('basic calculation: (income - annualExpenses) * 6 - liabilities', () => {
      // income=120k, monthly_expenses=2k (annual=24k), liabilities=50k
      // bp = (120k - 24k) * 6 - 50k = 576k - 50k = 526k
      const client = makeClient({
        income: 120_000,
        monthly_expenses: 2_000,
        liabilities: 50_000,
        available_deposit: 100_000,
      })
      const policy = makePolicy({ min_income: 0, max_ltv: 100 })

      const [result] = calculatePolicyMatches(client, [policy])

      expect(result.borrowingPower).toBe(526_000)
    })

    it('borrowing power with zero expenses', () => {
      // income=100k, expenses=0, liabilities=0 => bp = 100k * 6 = 600k
      const client = makeClient({ income: 100_000, monthly_expenses: 0 })
      const policy = makePolicy({ max_ltv: 100 })

      const [result] = calculatePolicyMatches(client, [policy])

      expect(result.borrowingPower).toBe(600_000)
    })

    it('borrowing power with expenses exceeding income floors to 0', () => {
      // income=50k, monthly_expenses=5k (annual=60k), liabilities=0
      // raw = (50k - 60k) * 6 - 0 = -60k => Math.max(0, -60k) = 0
      const client = makeClient({
        income: 50_000,
        monthly_expenses: 5_000,
        available_deposit: 100_000,
      })
      const policy = makePolicy({ max_ltv: 100 })

      const [result] = calculatePolicyMatches(client, [policy])

      expect(result.borrowingPower).toBe(0)
    })

    it('borrowing power with large liabilities that would make it negative floors to 0', () => {
      // income=80k, expenses=0, liabilities=600k
      // raw = 80k * 6 - 600k = 480k - 600k = -120k => 0
      const client = makeClient({ income: 80_000, liabilities: 600_000 })
      const policy = makePolicy({ max_ltv: 100 })

      const [result] = calculatePolicyMatches(client, [policy])

      expect(result.borrowingPower).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // LVR when borrowingPower is zero
  // -----------------------------------------------------------------------

  describe('LVR edge cases', () => {
    it('zero borrowingPower with deposit => LVR is 0% (loan=0, totalProperty=deposit)', () => {
      // borrowingPower=0, deposit=100k => totalProperty=100k, lvr = (0/100k)*100 = 0%
      const client = makeClient({
        income: 50_000,
        monthly_expenses: 5_000, // annualExpenses=60k > income => bp=0
        available_deposit: 100_000,
      })
      const policy = makePolicy({ min_income: 0, max_ltv: 80 })

      const [result] = calculatePolicyMatches(client, [policy])

      expect(result.lvrPass).toBe(true)
      expect(result.lvrReason).toContain('0.0%')
    })

    it('zero borrowingPower with zero deposit => LVR defaults to 100%', () => {
      // totalProperty = 0 + 0 = 0 => lvr = 100 (branch: totalProperty > 0 is false)
      const client = makeClient({
        income: 0,
        available_deposit: 0,
      })
      const policy = makePolicy({ min_income: 0, max_ltv: 80 })

      const [result] = calculatePolicyMatches(client, [policy])

      expect(result.lvrPass).toBe(false)
      expect(result.lvrReason).toContain('100.0%')
    })
  })

  // -----------------------------------------------------------------------
  // Suitability classification
  // -----------------------------------------------------------------------

  describe('suitability classification', () => {
    it('both incomePass and lvrPass => Eligible', () => {
      const client = makeClient({ income: 200_000, available_deposit: 200_000 })
      const policy = makePolicy({ min_income: 50_000, max_ltv: 95 })

      const [result] = calculatePolicyMatches(client, [policy])

      expect(result.incomePass).toBe(true)
      expect(result.lvrPass).toBe(true)
      expect(result.suitability).toBe('Eligible')
    })

    it('incomePass only (lvrPass false) => Borderline', () => {
      // income=100k => bp=600k, deposit=0 => lvr=100%, max_ltv=80 => lvrPass=false
      const client = makeClient({ income: 100_000, available_deposit: 0 })
      const policy = makePolicy({ min_income: 50_000, max_ltv: 80 })

      const [result] = calculatePolicyMatches(client, [policy])

      expect(result.incomePass).toBe(true)
      expect(result.lvrPass).toBe(false)
      expect(result.suitability).toBe('Borderline')
    })

    it('lvrPass only (incomePass false) => Borderline', () => {
      // income=30k, min_income=50k => incomePass=false
      // bp=(30k)*6=180k, deposit=200k => totalProp=380k, lvr=(180k/380k)*100~47.4% => lvrPass=true
      const client = makeClient({ income: 30_000, available_deposit: 200_000 })
      const policy = makePolicy({ min_income: 50_000, max_ltv: 80 })

      const [result] = calculatePolicyMatches(client, [policy])

      expect(result.incomePass).toBe(false)
      expect(result.lvrPass).toBe(true)
      expect(result.suitability).toBe('Borderline')
    })

    it('neither pass => Not Eligible', () => {
      // income=0 => bp=0, deposit=0 => lvr=100%, max_ltv=80 => lvrPass=false
      // income=0 < min_income=50k => incomePass=false
      const client = makeClient({ income: 0, available_deposit: 0 })
      const policy = makePolicy({ min_income: 50_000, max_ltv: 80 })

      const [result] = calculatePolicyMatches(client, [policy])

      expect(result.incomePass).toBe(false)
      expect(result.lvrPass).toBe(false)
      expect(result.suitability).toBe('Not Eligible')
    })
  })

  // -----------------------------------------------------------------------
  // Sort order
  // -----------------------------------------------------------------------

  describe('sort order', () => {
    it('results sorted: Eligible first, then Borderline, then Not Eligible', () => {
      const client = makeClient({ income: 100_000, available_deposit: 0 })
      // Policy A: min_income=0, max_ltv=100 => both pass => Eligible
      // Policy B: min_income=0, max_ltv=80 => income pass, lvr fail => Borderline
      // Policy C: min_income=200_000, max_ltv=80 => neither => Not Eligible
      const policies = [
        makePolicy({ policy_name: 'C', min_income: 200_000, max_ltv: 80 }),
        makePolicy({ policy_name: 'A', min_income: 0, max_ltv: 100 }),
        makePolicy({ policy_name: 'B', min_income: 0, max_ltv: 80 }),
      ]

      const results = calculatePolicyMatches(client, policies)

      expect(results[0].suitability).toBe('Eligible')
      expect(results[0].policy.policy_name).toBe('A')
      expect(results[1].suitability).toBe('Borderline')
      expect(results[1].policy.policy_name).toBe('B')
      expect(results[2].suitability).toBe('Not Eligible')
      expect(results[2].policy.policy_name).toBe('C')
    })

    it('stable order within same suitability tier (preserves original order)', () => {
      const client = makeClient({ income: 200_000, available_deposit: 200_000 })
      const policies = [
        makePolicy({ policy_name: 'First', min_income: 0, max_ltv: 100 }),
        makePolicy({ policy_name: 'Second', min_income: 0, max_ltv: 100 }),
        makePolicy({ policy_name: 'Third', min_income: 0, max_ltv: 100 }),
      ]

      const results = calculatePolicyMatches(client, policies)

      // All Eligible, original order should be preserved (sort is stable in modern JS)
      expect(results.map(r => r.policy.policy_name)).toEqual(['First', 'Second', 'Third'])
    })
  })

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('empty policies array returns empty array', () => {
      const client = makeClient({ income: 100_000 })

      const results = calculatePolicyMatches(client, [])

      expect(results).toEqual([])
    })

    it('client with all undefined financial fields uses defaults (0)', () => {
      // income=0, deposit=0, liabilities=0, monthly_expenses=0
      // bp = Math.max(0, (0-0)*6 - 0) = 0
      // lvr = totalProperty=0 => 100%
      const client = makeClient({
        income: undefined,
        available_deposit: undefined,
        liabilities: undefined,
        monthly_expenses: undefined,
      })
      const policy = makePolicy({ min_income: 50_000, max_ltv: 80 })

      const [result] = calculatePolicyMatches(client, [policy])

      expect(result.borrowingPower).toBe(0)
      expect(result.incomePass).toBe(false)
      expect(result.lvrPass).toBe(false)
      expect(result.suitability).toBe('Not Eligible')
    })

    it('policy with undefined min_income defaults to 0 (everyone passes)', () => {
      const client = makeClient({ income: 0 })
      const policy = makePolicy({ min_income: undefined, max_ltv: 100 })

      const [result] = calculatePolicyMatches(client, [policy])

      // income 0 >= 0 is true
      expect(result.incomePass).toBe(true)
    })

    it('policy with undefined max_ltv defaults to 100 (most permissive)', () => {
      const client = makeClient({ income: 100_000, available_deposit: 0 })
      const policy = makePolicy({ max_ltv: undefined })

      const [result] = calculatePolicyMatches(client, [policy])

      // LVR is 100%, max_ltv defaults to 100, so 100 <= 100 passes
      expect(result.lvrPass).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // Reason strings
  // -----------------------------------------------------------------------

  describe('reason strings', () => {
    it('income reason contains formatted amounts', () => {
      const client = makeClient({ income: 150_000, available_deposit: 100_000 })
      const policy = makePolicy({ min_income: 80_000, max_ltv: 100 })

      const [result] = calculatePolicyMatches(client, [policy])

      expect(result.incomeReason).toContain('150,000')
      expect(result.incomeReason).toContain('80,000')
      expect(result.incomeReason).toContain('meets minimum')
    })

    it('failing income reason says "below minimum"', () => {
      const client = makeClient({ income: 50_000, available_deposit: 100_000 })
      const policy = makePolicy({ min_income: 80_000, max_ltv: 100 })

      const [result] = calculatePolicyMatches(client, [policy])

      expect(result.incomeReason).toContain('below minimum')
    })

    it('LVR reason contains percentage with one decimal place', () => {
      const client = makeClient({ income: 100_000, available_deposit: 100_000 })
      const policy = makePolicy({ max_ltv: 95 })

      const [result] = calculatePolicyMatches(client, [policy])

      // bp=600k, deposit=100k, totalProp=700k, lvr=(600k/700k)*100=85.714...%
      expect(result.lvrReason).toMatch(/85\.7%/)
      expect(result.lvrReason).toContain('within max 95%')
    })
  })
})
