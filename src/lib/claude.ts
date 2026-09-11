import Anthropic from '@anthropic-ai/sdk';
import { ProposalIntake, GeneratedSections, SECTION_KEYS, SECTION_LABELS, SectionKey } from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY environment variable');
}

const MODEL = 'claude-sonnet-4-5-20250929';

// System prompt: sets role, output format, and grounding rules
const SYSTEM_PROMPT = `You are a professional proposal writer at Koya Talent, a consultancy that helps clients with talent and organizational challenges. You write clear, client-ready proposals that are specific to each client's needs.

Your output must be a JSON object with exactly these 6 keys:
- "introduction": Opening paragraph thanking the client, referencing their company and summarizing their needs
- "proposed_solution": Project scope, recommended approach, and why this approach fits their goals
- "deliverables": Specific list of deliverables the client can expect
- "timeline": Project timeline with phases or milestones
- "pricing": Pricing details with any relevant notes about scope adjustments
- "next_steps": How to proceed, invitation to discuss, and closing

Rules:
- CRITICAL: If any intake field contains nonsensical text, random characters, or gibberish (e.g. "asdfghjkl", "xxxyyy", keyboard mashing), DO NOT attempt to write a polished proposal around it. Instead, in each affected section, clearly state: "[This section cannot be completed — the input for [field name] appears to contain placeholder or invalid text. Please provide real details.]" Only write substantive proposal content for fields that contain meaningful information.
- Use ONLY the information provided in the intake data. Do not fabricate details, statistics, case studies, or claims not present in the inputs.
- If a field has sparse but meaningful information, work with what's there. Do not invent specifics to fill gaps — instead, keep the section appropriately brief or note that details will be discussed further.
- If supporting material is provided, incorporate relevant details from it naturally into the appropriate sections.
- Write in a professional but warm tone. Use "we" for Koya Talent, "you" for the client.
- Each section should be 2-4 paragraphs of prose. For deliverables, use a clear list format within the prose.
- Output ONLY the JSON object. No markdown fences, no preamble, no explanation outside the JSON.`;

function buildGenerationPrompt(intake: ProposalIntake): string {
  let prompt = `Generate a proposal for the following client:

Client Name: ${intake.client_name}
Company: ${intake.company_name}
Date of Call: ${intake.date_of_call}
Salesperson: ${intake.salesperson_name}

Client's Needs: ${intake.client_needs_summary}

Project Scope: ${intake.project_scope}

Goals and Objectives: ${intake.goals_and_objectives}

Recommended Services/Deliverables: ${intake.recommended_services}

Proposed Timeline: ${intake.proposed_timeline}

Estimated Pricing: ${intake.estimated_pricing}`;

  if (intake.supporting_material?.trim()) {
    prompt += `\n\nAdditional Context / Supporting Material:\n${intake.supporting_material}`;
  }

  return prompt;
}

/**
 * Validate that Claude's response has all 6 required section keys
 * and each value is a non-empty string.
 * W1 lesson: check actual structure, not just "it parsed"
 */
function validateSections(parsed: unknown): parsed is GeneratedSections {
  if (typeof parsed !== 'object' || parsed === null) return false;
  
  for (const key of SECTION_KEYS) {
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      return false;
    }
  }
  return true;
}

/**
 * Generate all 6 proposal sections from intake data.
 * Returns the sections or throws with a descriptive error.
 */
export async function generateProposal(intake: ProposalIntake): Promise<GeneratedSections> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: buildGenerationPrompt(intake) },
    ],
  });

  // Extract text from response
  const textBlock = message.content.find(block => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content');
  }

  // Parse JSON — strip any markdown fences the model might add despite instructions
  const raw = textBlock.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Claude returned invalid JSON. Raw response starts with: "${raw.slice(0, 100)}..."`);
  }

  if (!validateSections(parsed)) {
    const keys = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : [];
    throw new Error(
      `Claude response missing required sections. Got keys: [${keys.join(', ')}], need: [${SECTION_KEYS.join(', ')}]`
    );
  }

  return parsed;
}

/**
 * Regenerate a single section while preserving the others.
 * Takes the full intake data + current sections for context + optional instruction.
 */
export async function regenerateSection(
  intake: ProposalIntake,
  currentSections: GeneratedSections,
  sectionKey: SectionKey,
  instruction?: string
): Promise<string> {
  const sectionLabel = SECTION_LABELS[sectionKey];

  // Build context: show other sections so the regenerated one is coherent
  const otherSections = SECTION_KEYS
    .filter(k => k !== sectionKey)
    .map(k => `## ${SECTION_LABELS[k]}\n${currentSections[k]}`)
    .join('\n\n');

  let userPrompt = `I need you to regenerate ONLY the "${sectionLabel}" section of this proposal.

Here is the client intake data:
${buildGenerationPrompt(intake)}

Here are the other sections (for context — do NOT repeat or modify these):
${otherSections}

Regenerate the "${sectionLabel}" section. Output ONLY the new section text as plain text (not JSON, not markdown-fenced). Write 2-4 paragraphs of professional prose.`;

  if (instruction?.trim()) {
    userPrompt += `\n\nAdditional instruction for this section: ${instruction}`;
  }

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: 'You are a professional proposal writer at Koya Talent. You write clear, client-ready proposals. Use ONLY the information provided — do not fabricate details. Output ONLY the section text, no preamble or labels.',
    messages: [
      { role: 'user', content: userPrompt },
    ],
  });

  const textBlock = message.content.find(block => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text' || !textBlock.text.trim()) {
    throw new Error(`Claude returned no content for section "${sectionLabel}"`);
  }

  return textBlock.text.trim();
}
