import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/proposals/[id]/reject
// Body: { rejection_reason: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.rejection_reason?.trim()) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // Fetch current status
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    if (proposal.status !== 'pending_approval') {
      return NextResponse.json(
        { error: `Cannot reject a proposal with status "${proposal.status}". It must be pending approval.` },
        { status: 400 }
      );
    }

    const { data, error: updateError } = await supabase
      .from('proposals')
      .update({
        status: 'rejected',
        rejection_reason: body.rejection_reason.trim(),
        rejected_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Rejection failed: ${updateError.message}` },
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
