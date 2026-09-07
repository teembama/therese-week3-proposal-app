-- Paste this into Supabase SQL Editor (SQL tab in the dashboard)
-- Run it once to create the proposals table

CREATE TABLE proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Intake fields (from the discovery call form)
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  date_of_call DATE NOT NULL,
  salesperson_name TEXT NOT NULL,
  client_needs_summary TEXT NOT NULL,
  project_scope TEXT NOT NULL,
  goals_and_objectives TEXT NOT NULL,
  recommended_services TEXT NOT NULL,
  proposed_timeline TEXT NOT NULL,
  estimated_pricing TEXT NOT NULL,
  supporting_material TEXT,
  
  -- Generated proposal content: JSON with section keys
  -- { "introduction": "...", "proposed_solution": "...", "deliverables": "...", 
  --   "timeline": "...", "pricing": "...", "next_steps": "..." }
  generated_sections JSONB,
  
  -- Status: draft → pending_approval → approved → sent
  -- Can also be: rejected (from pending_approval)
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'rejected')),
  
  -- Approval tracking
  approver_name TEXT,
  approval_note TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Delivery tracking
  sent_at TIMESTAMPTZ,
  proposal_url TEXT,
  email_error TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Disable RLS for this project (single-user, no auth)
-- In production you'd add RLS policies scoped to authenticated users
ALTER TABLE proposals DISABLE ROW LEVEL SECURITY;
