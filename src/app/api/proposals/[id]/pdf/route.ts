import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GeneratedSections, SECTION_KEYS, SECTION_LABELS, SectionKey } from '@/lib/types';
// jsPDF is a client-side library — for server-side PDF generation we'll use a simpler approach
// We'll generate a clean HTML→PDF using the built-in approach

// POST /api/proposals/[id]/pdf — generate PDF for download
// Server-side gate: only approved or sent proposals can be exported
export async function GET(
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

    // SERVER-SIDE GATE: Only approved/sent proposals can be exported
    // This is not just a UI check — even a direct API call is blocked
    if (!['approved', 'sent'].includes(proposal.status)) {
      return NextResponse.json(
        { error: `Cannot export PDF. Proposal status is "${proposal.status}" — it must be approved first.` },
        { status: 403 }
      );
    }

    if (!proposal.generated_sections) {
      return NextResponse.json(
        { error: 'No proposal content to export' },
        { status: 400 }
      );
    }

    const sections = proposal.generated_sections as GeneratedSections;

    // Generate clean HTML for PDF
    const html = buildProposalHtml(proposal, sections);

    // Return as HTML that can be printed to PDF by the browser
    // This is more reliable than server-side PDF libs in a serverless environment
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="Proposal-${proposal.company_name.replace(/[^a-zA-Z0-9]/g, '_')}.html"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}

interface ProposalRecord {
  client_name: string;
  company_name: string;
  salesperson_name: string;
  date_of_call: string;
  client_needs_summary: string;
}

function buildProposalHtml(proposal: ProposalRecord, sections: GeneratedSections): string {
  const sectionHtml = SECTION_KEYS.map((key: SectionKey) => {
    const label = SECTION_LABELS[key];
    const content = sections[key] || '';
    // Convert newlines to paragraphs
    const paragraphs = content.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    return `<div class="section"><h2>${label}</h2>${paragraphs}</div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Proposal for ${proposal.company_name}</title>
  <style>
    @media print { body { margin: 0; } }
    body { 
      font-family: 'Georgia', 'Times New Roman', serif; 
      max-width: 800px; 
      margin: 40px auto; 
      padding: 0 40px;
      color: #1a1a1a; 
      line-height: 1.7;
      font-size: 14px;
    }
    .header { 
      border-bottom: 2px solid #2563eb; 
      padding-bottom: 24px; 
      margin-bottom: 32px; 
    }
    .header h1 { 
      font-size: 26px; 
      color: #1e3a5f; 
      margin: 0 0 8px 0; 
    }
    .header .meta { 
      color: #6b7280; 
      font-size: 13px; 
    }
    .section { margin-bottom: 28px; }
    .section h2 { 
      font-size: 18px; 
      color: #1e3a5f; 
      margin-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 6px;
    }
    .section p { margin: 0 0 12px 0; }
    .footer { 
      margin-top: 40px; 
      padding-top: 20px; 
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 13px;
    }
    @media print {
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background:#f0f4ff;padding:12px 20px;margin-bottom:24px;border-radius:6px;font-family:sans-serif;font-size:13px;">
    <strong>Print this page to save as PDF</strong> — use Ctrl/Cmd+P, then select "Save as PDF"
  </div>
  <div class="header">
    <h1>Proposal for ${proposal.client_name}</h1>
    <div class="meta">
      Prepared by ${proposal.salesperson_name} · Koya Talent<br>
      Date: ${proposal.date_of_call}
    </div>
  </div>
  ${sectionHtml}
  <div class="footer">
    <p>Warm regards,<br>${proposal.salesperson_name}<br>Koya Talent</p>
  </div>
</body>
</html>`;
}
