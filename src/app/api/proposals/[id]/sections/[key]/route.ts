import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { SECTION_KEYS, SectionKey } from '@/lib/types';

// PATCH /api/proposals/[id]/sections/[key] — save a manual edit
// Body: { content: string }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  try {
    const { id, key } = await params;

    if (!SECTION_KEYS.includes(key as SectionKey)) {
      return NextResponse.json(
        { error: `Invalid section key "${key}"` },
        { status: 400 }
      );
    }

    const body = await request.json();
    if (typeof body.content !== 'string') {
      return NextResponse.json(
        { error: 'Request body must include "content" as a string' },
        { status: 400 }
      );
    }

    // Fetch current sections
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('generated_sections, status')
      .eq('id', id)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    if (!['draft', 'rejected'].includes(proposal.status)) {
      return NextResponse.json(
        { error: `Cannot edit sections on a proposal with status "${proposal.status}"` },
        { status: 400 }
      );
    }

    if (!proposal.generated_sections) {
      return NextResponse.json(
        { error: 'No sections exist yet. Generate the proposal first.' },
        { status: 400 }
      );
    }

    // Update only this section
    const updatedSections = {
      ...proposal.generated_sections,
      [key]: body.content.trim(),
    };

    const { error: updateError } = await supabase
      .from('proposals')
      .update({ generated_sections: updatedSections })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json(
        { error: `Save failed: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ section: key, content: body.content.trim() });
  } catch (err) {
    return NextResponse.json(
      { error: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}
