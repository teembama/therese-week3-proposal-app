import { NextRequest, NextResponse } from 'next/server';
import { generateProposal } from '@/lib/claude';
import { validateIntake } from '@/lib/validation';
import { ProposalIntake } from '@/lib/types';

// POST /api/proposals/generate-preview
// Takes raw intake form data, generates sections via Claude, returns them
// Does NOT save anything to Supabase — the frontend saves after success
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate intake data
    const validation = validateIntake(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    const intake: ProposalIntake = {
      client_name: body.client_name.trim(),
      client_email: body.client_email.trim().toLowerCase(),
      company_name: body.company_name.trim(),
      date_of_call: body.date_of_call,
      salesperson_name: body.salesperson_name.trim(),
      client_needs_summary: body.client_needs_summary.trim(),
      project_scope: body.project_scope.trim(),
      goals_and_objectives: body.goals_and_objectives.trim(),
      recommended_services: body.recommended_services.trim(),
      proposed_timeline: body.proposed_timeline.trim(),
      estimated_pricing: body.estimated_pricing.trim(),
      supporting_material: body.supporting_material?.trim() || undefined,
    };

    let sections;
    try {
      sections = await generateProposal(intake);
    } catch (claudeError) {
      return NextResponse.json(
        {
          error: 'AI generation failed',
          detail: claudeError instanceof Error ? claudeError.message : 'Unknown Claude API error',
        },
        { status: 502 }
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
