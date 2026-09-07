import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';

// POST /api/proposals/[id]/send — send the proposal email to the client
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // SERVER-SIDE GATE: only approved proposals can be sent
    if (proposal.status !== 'approved') {
      return NextResponse.json(
        { error: `Cannot send. Proposal status is "${proposal.status}" — it must be approved first. This is a server-enforced requirement, not just a UI restriction.` },
        { status: 403 }
      );
    }

    if (!proposal.generated_sections) {
      return NextResponse.json(
        { error: 'No proposal content to send' },
        { status: 400 }
      );
    }

    // Check for Resend API key
    if (!process.env.RESEND_API_KEY) {
      // Record the error so it's visible in the database too
      await supabase
        .from('proposals')
        .update({ email_error: 'Resend API key not configured' })
        .eq('id', id);

      return NextResponse.json(
        { error: 'Email delivery is not configured. Set RESEND_API_KEY in environment variables.' },
        { status: 503 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const proposalUrl = `${appUrl}/proposals/${id}`;

    try {
      const { error: sendError } = await resend.emails.send({
        from: 'Koya Talent <onboarding@resend.dev>', // Resend free tier uses their domain
        to: [proposal.client_email],
        subject: `Proposal for ${proposal.company_name}`,
        html: buildEmailHtml(proposal, proposalUrl),
      });

      if (sendError) {
        // Record failure — W2 lesson: failures must be visible, not silent
        await supabase
          .from('proposals')
          .update({ email_error: sendError.message })
          .eq('id', id);

        return NextResponse.json(
          { error: `Email delivery failed: ${sendError.message}` },
          { status: 502 }
        );
      }
    } catch (emailErr) {
      const errorMsg = emailErr instanceof Error ? emailErr.message : 'Unknown email error';
      await supabase
        .from('proposals')
        .update({ email_error: errorMsg })
        .eq('id', id);

      return NextResponse.json(
        { error: `Email delivery failed: ${errorMsg}` },
        { status: 502 }
      );
    }

    // Success — update status and record
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        proposal_url: proposalUrl,
        email_error: null, // Clear any previous error
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json(
        { error: `Email sent but failed to update status: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: `Proposal sent to ${proposal.client_email}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}

interface ProposalEmailData {
  client_name: string;
  company_name: string;
  salesperson_name: string;
}

function buildEmailHtml(proposal: ProposalEmailData, proposalUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <p>Hi ${proposal.client_name},</p>
      
      <p>Thanks again for taking the time to speak with us. Based on our conversation, we have put together a customized proposal for your review.</p>
      
      <p>You can view the proposal here: <a href="${proposalUrl}" style="color: #2563eb;">${proposalUrl}</a></p>
      
      <p>This document outlines the project scope, timeline, pricing details, and recommended approach.</p>
      
      <p>If you have any questions or would like to make adjustments, feel free to reach out. We are happy to iterate with you.</p>
      
      <p>Looking forward to hearing your thoughts.</p>
      
      <p>Best regards,<br>${proposal.salesperson_name}<br>Koya Talent</p>
    </div>
  `;
}
