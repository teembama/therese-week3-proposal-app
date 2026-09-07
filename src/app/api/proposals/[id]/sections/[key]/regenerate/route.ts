import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { regenerateSection } from '@/lib/claude';
import { ProposalIntake, GeneratedSections, SECTION_KEYS, SectionKey } from '@/lib/types';

// POST /api/proposals/[id]/sections/[key]/regenerate
// Body: { instruction?: string } — optional guidance for the regeneration
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  try {
    const { id, key } = await params;

    // Validate section key
    if (!SECTION_KEYS.includes(key as SectionKey)) {
      return NextResponse.json(
        { error: `Invalid section key "${key}". Valid keys: ${SECTION_KEYS.join(', ')}` },
        { status: 400 }
      );
    }

    const sectionKey = key as SectionKey;

    // Fetch the proposal
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    if (!proposal.generated_sections) {
      return NextResponse.json(
        { error: 'No sections to regenerate. Generate the full proposal first.' },
        { status: 400 }
      );
    }

    // Only allow regeneration for draft/rejected proposals
    if (!['draft', 'rejected'].includes(proposal.status)) {
      return NextResponse.json(
        { error: `Cannot regenerate sections on a proposal with status "${proposal.status}"` },
        { status: 400 }
      );
    }

    // Parse optional instruction
    let instruction: string | undefined;
    try {
      const body = await request.json();
      instruction = body.instruction;
    } catch {
      // No body is fine — instruction is optional
    }

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

    let newSectionText: string;
    try {
      newSectionText = await regenerateSection(
        intake,
        proposal.generated_sections as GeneratedSections,
        sectionKey,
        instruction
      );
    } catch (claudeError) {
      return NextResponse.json(
        {
          error: 'Section regeneration failed',
          detail: claudeError instanceof Error ? claudeError.message : 'Unknown Claude API error',
        },
        { status: 502 }
      );
    }

    // Update ONLY the specified section, preserve the rest
    const updatedSections = {
      ...proposal.generated_sections,
      [sectionKey]: newSectionText,
    };

    const { error: updateError } = await supabase
      .from('proposals')
      .update({ generated_sections: updatedSections })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json(
        { error: `Regenerated but failed to save: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      section: sectionKey,
      content: newSectionText,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}
