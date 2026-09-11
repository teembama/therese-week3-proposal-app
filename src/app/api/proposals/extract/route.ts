import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-5-20250929';

const EXTRACT_PROMPT = `You are an assistant that extracts structured data from sales/discovery call transcripts. Given a meeting transcript, extract the following fields. If a field is not mentioned or unclear, leave it as an empty string — do not guess or fabricate.

Return ONLY a JSON object with these keys:
- "client_name": The client contact's name
- "client_email": The client's email address (often not in transcripts — leave empty if not found)
- "company_name": The client's company or organization
- "date_of_call": Date of the call in YYYY-MM-DD format (if mentioned)
- "salesperson_name": The salesperson or account manager's name
- "client_needs_summary": What problem or need the client described
- "project_scope": What the client wants built, delivered, or solved
- "goals_and_objectives": The outcomes the client wants to achieve
- "recommended_services": Services or deliverables discussed or proposed
- "proposed_timeline": Any timeline, deadlines, or phases mentioned
- "estimated_pricing": Any budget, pricing, or cost figures discussed
- "supporting_material": Any additional context worth noting (competitors mentioned, constraints, preferences, prior work)

Output ONLY the JSON object. No markdown fences, no preamble.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.transcript || typeof body.transcript !== 'string' || !body.transcript.trim()) {
      return NextResponse.json(
        { error: 'Please paste a transcript to extract from' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 503 }
      );
    }

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: EXTRACT_PROMPT,
      messages: [
        { role: 'user', content: `Extract the proposal intake fields from this transcript:\n\n${body.transcript}` },
      ],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'Claude returned no content' },
        { status: 502 }
      );
    }

    const raw = textBlock.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: 'Claude returned invalid JSON — try pasting a cleaner transcript' },
        { status: 502 }
      );
    }

    return NextResponse.json({ fields: parsed });
  } catch (err) {
    return NextResponse.json(
      { error: `Extraction failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
