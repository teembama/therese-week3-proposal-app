import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateProposal } from '@/lib/claude';
import { ProposalIntake } from '@/lib/types';

// POST /api/proposals/[id]/generate — generate all sections via Claude
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the proposal's intake data
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }

    // Only generate for draft or rejected proposals (allow re-generation)
    if (!['draft', 'rejected'].includes(proposal.status)) {
      return NextResponse.json(
        { error: `Cannot generate for a proposal with status "${proposal.status}". Only draft or rejected proposals can be regenerated.` },
        { status: 400 }
      );
    }

    // Build intake object from the stored row
    const intake: ProposalIntake = {
      client_name: proposal.client_name,
      client_email: proposal.client_email,
      company_name: proposal.company_name,
      date_of_call: proposal.date_of_call,
      salesperson_name: proposal.salesperson_name,
      client_needs_summary: proposal.client_needs_summary,
      project_scope: proposal.project_scope,
      goals_and_objectives: proposal.goals_and_objectives,
      recommended_services: proposal.recommended_services,
      proposed_timeline: proposal.proposed_timeline,
      estimated_pricing: proposal.estimated_pricing,
      supporting_material: proposal.supporting_material,
    };

    // Call Claude — this is the most likely point of failure
    // Errors here: bad API key, rate limit, network, malformed response
    let sections;
    try {
      sections = await generateProposal(intake);
    } catch (claudeError) {
      // W2 lesson: failure degrades, doesn't crash.
      // The proposal still exists in Supabase with its intake data.
      // We return a clear error so the user can retry.
      return NextResponse.json(
        { 
          error: 'AI generation failed',
          detail: claudeError instanceof Error ? claudeError.message : 'Unknown Claude API error',
        },
        { status: 502 }
      );
    }

    // Save the generated sections to the proposal
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        generated_sections: sections,
        status: 'draft', // reset to draft if it was rejected
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json(
        { error: `Generated content but failed to save: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ sections });
  } catch (err) {
    return NextResponse.json(
      { error: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}
