/** TypeScript interfaces matching Rust backend structs. */

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
  created_at: string;
  updated_at: string;
}

export interface ReferralStat {
  source: string;
  count: number;
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

export interface Document {
  id?: number;
  client_id: number;
  filename: string;
  document_type: string;
  file_path: string;
  file_data?: string;
  uploaded_at: string;
}

export interface Meeting {
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

export interface BrokerProfile {
  id?: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  photo?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailImport {
  id?: number;
  client_id: number;
  sender_email: string;
  subject: string;
  document_path: string;
  imported_at: string;
  processed: boolean;
}

export interface Deal {
  id?: number;
  client_id: number;
  property_address: string;
  loan_amount?: number;
  purchase_date?: string;
  settlement_date?: string;
  interest_rate?: number;
  lender_name?: string;
  loan_type?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DealEvent {
  id?: number;
  deal_id: number;
  event_type: string;
  event_date: string;
  description?: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

export interface DashboardStats {
  total_clients: number;
  total_meetings: number;
  total_policies: number;
  conversion_rate: number;
  avg_deal_size: number;
  monthly_revenue: number;
  ytd_revenue: number;
  deals_this_month: number;
  deals_last_month: number;
  top_performing_bank: string;
  top_bank_conversion: number;
}

export interface WhisperModelStatus {
  downloaded: boolean;
  model_name: string;
  size_bytes: number;
  path: string;
}

export interface OAuthStatus {
  connected: boolean;
  account_email?: string;
  last_sync_at?: string;
}
