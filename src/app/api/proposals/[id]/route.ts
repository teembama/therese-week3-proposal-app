import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/proposals/[id] — fetch full proposal
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
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

// PATCH /api/proposals/[id] — update status or intake fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check current status — only draft/rejected proposals can have intake fields edited
    const { data: current, error: fetchErr } = await supabase
      .from('proposals')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    // Handle status updates
    if ('status' in body) {
      updates.status = body.status;
    }

    // Handle intake field updates (from the Edit Details panel)
    if (body.intake && typeof body.intake === 'object') {
      if (!['draft', 'rejected'].includes(current.status)) {
        return NextResponse.json(
          { error: `Cannot edit details on a proposal with status "${current.status}"` },
          { status: 400 }
        );
      }

      const intakeFields = [
        'client_name', 'client_email', 'company_name', 'date_of_call',
        'salesperson_name', 'client_needs_summary', 'project_scope',
        'goals_and_objectives', 'recommended_services', 'proposed_timeline',
        'estimated_pricing', 'supporting_material',
      ];

      for (const key of intakeFields) {
        if (key in body.intake) {
          const val = body.intake[key];
          updates[key] = typeof val === 'string' ? val.trim() || null : val;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('proposals')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Update failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Send Discord notification when submitted for approval
    if (body.status === 'pending_approval' && data) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      await sendDiscordNotification(
        `📋 **New Proposal Awaiting Approval**\n\n` +
        `**Client:** ${data.company_name} (${data.client_name})\n` +
        `**Salesperson:** ${data.salesperson_name}\n` +
        `**Review:** ${appUrl}/proposals/${id}\n\n` +
        `Please review and approve or reject.`
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

// Fire-and-forget Discord notification — never blocks or crashes the main flow
async function sendDiscordNotification(message: string) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
  } catch {
    console.error('Discord webhook failed (non-blocking)');
  }
}