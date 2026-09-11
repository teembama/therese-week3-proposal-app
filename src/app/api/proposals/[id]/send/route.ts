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
        from: 'Koya Talent <onboarding@resend.dev>',
        to: [proposal.client_email],
        subject: `Proposal for ${proposal.company_name}`,
        html: buildEmailHtml({
          client_name: proposal.client_name,
          company_name: proposal.company_name,
          salesperson_name: proposal.salesperson_name,
          date_of_call: proposal.date_of_call,
          generated_sections: proposal.generated_sections as Record<string, string>,
        }),
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
  date_of_call: string;
  generated_sections: Record<string, string>;
}

const EMAIL_SECTION_LABELS: Record<string, string> = {
  introduction: 'Introduction',
  proposed_solution: 'Proposed Solution',
  deliverables: 'Deliverables',
  timeline: 'Timeline',
  pricing: 'Pricing',
  next_steps: 'Next Steps',
};

function buildEmailHtml(proposal: ProposalEmailData): string {
  const sections = ['introduction', 'proposed_solution', 'deliverables', 'timeline', 'pricing', 'next_steps']
    .map(key => {
      const content = proposal.generated_sections[key] || '';
      const paragraphs = content.split('\n\n').map(p => `<p style="margin: 0 0 12px 0; line-height: 1.6;">${p.replace(/\n/g, '<br>')}</p>`).join('');
      return `
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 16px; color: #1a3a5c; margin: 0 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb;">${EMAIL_SECTION_LABELS[key]}</h2>
          ${paragraphs}
        </div>`;
    }).join('');

  return `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 650px; margin: 0 auto; color: #1a1a1a; font-size: 14px;">
      <p style="margin-bottom: 16px;">Hi ${proposal.client_name},</p>
      
      <p style="margin-bottom: 24px;">Thanks again for taking the time to speak with us. Based on our conversation, we have put together a customized proposal for your review.</p>
      
      <div style="border-top: 2px solid #1a3a5c; padding-top: 20px; margin-top: 20px;">
        <h1 style="font-size: 22px; color: #1a3a5c; margin: 0 0 4px 0;">Proposal for ${proposal.company_name}</h1>
        <p style="color: #6b7280; font-size: 13px; margin: 0 0 24px 0;">Prepared by ${proposal.salesperson_name} · Koya Talent · ${proposal.date_of_call}</p>
        
        ${sections}
      </div>
      
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <p style="margin-bottom: 12px;">If you have any questions or would like to make adjustments, feel free to reach out. We are happy to iterate with you.</p>
        <p style="margin-bottom: 0;">Best regards,<br>${proposal.salesperson_name}<br>Koya Talent</p>
      </div>
    </div>
  `;
}
