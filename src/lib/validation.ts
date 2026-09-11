import { ProposalIntake } from './types';

interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

// W1 lesson: validate the actual property, not a proxy.
// "Non-empty" is not "valid email". Each field gets the check its type demands.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidDate(dateStr: string): boolean {
  // Must be YYYY-MM-DD and parse to a real date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parsed = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(parsed.getTime())) return false;
  // Guard against "2024-02-30" parsing as March 1
  const [y, m, d] = dateStr.split('-').map(Number);
  return parsed.getUTCFullYear() === y && 
         parsed.getUTCMonth() + 1 === m && 
         parsed.getUTCDate() === d;
}

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateIntake(data: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};

  // Required text fields — must be non-blank strings
  const requiredTextFields: Array<{ key: keyof ProposalIntake; label: string }> = [
    { key: 'client_name', label: 'Client name' },
    { key: 'company_name', label: 'Company name' },
    { key: 'salesperson_name', label: 'Salesperson name' },
    { key: 'client_needs_summary', label: "Summary of client's needs" },
    { key: 'project_scope', label: 'Project scope' },
    { key: 'goals_and_objectives', label: 'Goals and objectives' },
    { key: 'recommended_services', label: 'Recommended services' },
    { key: 'proposed_timeline', label: 'Proposed timeline' },
    { key: 'estimated_pricing', label: 'Estimated pricing' },
  ];

  for (const { key, label } of requiredTextFields) {
    if (!isNonBlank(data[key])) {
      errors[key] = `${label} is required`;
    }
  }

  // Email — must match email pattern, not just be non-empty
  if (!isNonBlank(data.client_email)) {
    errors.client_email = 'Client email is required';
  } else if (!EMAIL_REGEX.test(data.client_email as string)) {
    errors.client_email = 'Client email must be a valid email address';
  }

  // Date — must be a real date in YYYY-MM-DD format, not in the future
  if (!isNonBlank(data.date_of_call)) {
    errors.date_of_call = 'Date of call is required';
  } else if (!isValidDate(data.date_of_call as string)) {
    errors.date_of_call = 'Date of call must be a valid date (YYYY-MM-DD)';
  } else {
    const callDate = new Date(data.date_of_call + 'T00:00:00Z');
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999); // end of today
    if (callDate > today) {
      errors.date_of_call = 'Date of call cannot be in the future — the call must have already happened';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
