// Status flow: draft → pending_approval → approved → sent
// Branching: pending_approval → rejected → (edit) → pending_approval
export type ProposalStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'rejected';

// The 6 sections matching the proposal template
export const SECTION_KEYS = [
  'introduction',
  'proposed_solution',
  'deliverables',
  'timeline',
  'pricing',
  'next_steps',
] as const;

export type SectionKey = typeof SECTION_KEYS[number];

// Human-readable labels for each section
export const SECTION_LABELS: Record<SectionKey, string> = {
  introduction: 'Introduction',
  proposed_solution: 'Proposed Solution',
  deliverables: 'Deliverables',
  timeline: 'Timeline',
  pricing: 'Pricing',
  next_steps: 'Next Steps',
};

export type GeneratedSections = Record<SectionKey, string>;

// Intake form data (what the salesperson fills in)
export interface ProposalIntake {
  client_name: string;
  client_email: string;
  company_name: string;
  date_of_call: string; // YYYY-MM-DD
  salesperson_name: string;
  client_needs_summary: string;
  project_scope: string;
  goals_and_objectives: string;
  recommended_services: string;
  proposed_timeline: string;
  estimated_pricing: string;
  supporting_material?: string;
}

// Full proposal record from Supabase
export interface Proposal extends ProposalIntake {
  id: string;
  generated_sections: GeneratedSections | null;
  status: ProposalStatus;
  approver_name: string | null;
  approval_note: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  sent_at: string | null;
  proposal_url: string | null;
  email_error: string | null;
  created_at: string;
  updated_at: string;
}

// Status display metadata
export const STATUS_CONFIG: Record<ProposalStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#7a7668' },
  pending_approval: { label: 'Pending Approval', color: '#b08d23' },
  approved: { label: 'Approved', color: '#2d6a4f' },
  sent: { label: 'Sent to Client', color: '#1a5276' },
  rejected: { label: 'Rejected', color: '#b33a3a' },
};
