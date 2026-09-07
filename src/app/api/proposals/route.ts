import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateIntake } from '@/lib/validation';

// GET /api/proposals — list all proposals, newest first
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('proposals')
      .select('id, client_name, company_name, salesperson_name, status, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ proposals: data });
  } catch (err) {
    return NextResponse.json(
      { error: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}

// POST /api/proposals — create a new proposal from intake form
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Server-side validation — never trust the client (W1 lesson)
    const validation = validateIntake(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('proposals')
      .insert({
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
        supporting_material: body.supporting_material?.trim() || null,
        status: 'draft',
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Failed to create proposal: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}
