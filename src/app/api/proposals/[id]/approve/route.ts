import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/proposals/[id]/approve
// Body: { approver_name: string, approval_note?: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.approver_name?.trim()) {
      return NextResponse.json(
        { error: 'Approver name is required' },
        { status: 400 }
      );
    }

    // Fetch current status
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('status, generated_sections')
      .eq('id', id)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Server-side gate: only pending_approval proposals can be approved
    if (proposal.status !== 'pending_approval') {
      return NextResponse.json(
        { error: `Cannot approve a proposal with status "${proposal.status}". It must be submitted for approval first.` },
        { status: 400 }
      );
    }

    // Sanity check: don't approve a proposal with no content
    if (!proposal.generated_sections) {
      return NextResponse.json(
        { error: 'Cannot approve a proposal with no generated content' },
        { status: 400 }
      );
    }

    // Approver must be different from the salesperson
    if (body.approver_name.trim().toLowerCase() === proposal.salesperson_name.trim().toLowerCase()) {
      return NextResponse.json(
        { error: 'The approver cannot be the same person as the salesperson. A different team member must review and approve.' },
        { status: 400 }
      );
    }

    const { data, error: updateError } = await supabase
      .from('proposals')
      .update({
        status: 'approved',
        approver_name: body.approver_name.trim(),
        approval_note: body.approval_note?.trim() || null,
        approved_at: new Date().toISOString(),
        // Clear any previous rejection
        rejected_at: null,
        rejection_reason: null,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Approval failed: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ proposal: data });
  } catch (err) {
    return NextResponse.json(
      { error: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}
