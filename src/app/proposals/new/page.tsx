"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FormErrors {
  [key: string]: string;
}

const INITIAL_FORM = {
  client_name: "",
  client_email: "",
  company_name: "",
  date_of_call: "",
  salesperson_name: "",
  client_needs_summary: "",
  project_scope: "",
  goals_and_objectives: "",
  recommended_services: "",
  proposed_timeline: "",
  estimated_pricing: "",
  supporting_material: "",
};

export default function NewProposalPage() {
  const router = useRouter();
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear field error on edit
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  function validateClient(): FormErrors {
    const errs: FormErrors = {};
    
    // Required text fields
    const required: Array<{ key: string; label: string }> = [
      { key: "client_name", label: "Client name" },
      { key: "company_name", label: "Company name" },
      { key: "salesperson_name", label: "Salesperson name" },
      { key: "client_needs_summary", label: "Client's needs" },
      { key: "project_scope", label: "Project scope" },
      { key: "goals_and_objectives", label: "Goals and objectives" },
      { key: "recommended_services", label: "Recommended services" },
      { key: "proposed_timeline", label: "Proposed timeline" },
      { key: "estimated_pricing", label: "Estimated pricing" },
    ];

    for (const { key, label } of required) {
      if (!form[key as keyof typeof form].trim()) {
        errs[key] = `${label} is required`;
      }
    }

    // Email validation — test the real property (W1 lesson)
    if (!form.client_email.trim()) {
      errs.client_email = "Client email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.client_email)) {
      errs.client_email = "Enter a valid email address";
    }

    // Date validation — must be a real date (W1 lesson)
    if (!form.date_of_call) {
      errs.date_of_call = "Date of call is required";
    }

    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const clientErrors = validateClient();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) {
          setErrors(data.details);
        } else {
          setServerError(data.error || "Failed to create proposal");
        }
        return;
      }

      // Redirect to the proposal page to generate content
      router.push(`/proposals/${data.id}`);
    } catch {
      setServerError("Network error — check your connection and try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">New Proposal</h1>
      <p className="text-sm text-[var(--muted)] mb-8">
        Enter the details from your discovery call. All fields except Supporting Material are required.
      </p>

      {serverError && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-[var(--danger)]">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client & Salesperson Info */}
        <fieldset className="card p-6 space-y-4">
          <legend className="text-sm font-semibold text-[var(--foreground)] px-1">Contact Details</legend>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Client Name"
              name="client_name"
              value={form.client_name}
              onChange={handleChange}
              error={errors.client_name}
              placeholder="e.g. Sarah Chen"
            />
            <Field
              label="Client Email"
              name="client_email"
              type="email"
              value={form.client_email}
              onChange={handleChange}
              error={errors.client_email}
              placeholder="sarah@company.com"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Company Name"
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              error={errors.company_name}
              placeholder="e.g. Acme Corp"
            />
            <Field
              label="Date of Call"
              name="date_of_call"
              type="date"
              value={form.date_of_call}
              onChange={handleChange}
              error={errors.date_of_call}
            />
          </div>

          <Field
            label="Salesperson Name"
            name="salesperson_name"
            value={form.salesperson_name}
            onChange={handleChange}
            error={errors.salesperson_name}
            placeholder="e.g. Therese"
          />
        </fieldset>

        {/* Project Details */}
        <fieldset className="card p-6 space-y-4">
          <legend className="text-sm font-semibold text-[var(--foreground)] px-1">Project Details</legend>

          <TextArea
            label="Summary of Client's Needs"
            name="client_needs_summary"
            value={form.client_needs_summary}
            onChange={handleChange}
            error={errors.client_needs_summary}
            placeholder="What problem does the client want to solve?"
            rows={3}
          />

          <TextArea
            label="Project Scope"
            name="project_scope"
            value={form.project_scope}
            onChange={handleChange}
            error={errors.project_scope}
            placeholder="What does the client want built or delivered?"
            rows={3}
          />

          <TextArea
            label="Goals and Objectives"
            name="goals_and_objectives"
            value={form.goals_and_objectives}
            onChange={handleChange}
            error={errors.goals_and_objectives}
            placeholder="Expected outcomes: revenue growth, efficiency gains, etc."
            rows={2}
          />

          <TextArea
            label="Recommended Services / Deliverables"
            name="recommended_services"
            value={form.recommended_services}
            onChange={handleChange}
            error={errors.recommended_services}
            placeholder="Proposed services, outputs, or deliverables"
            rows={2}
          />
        </fieldset>

        {/* Timeline & Pricing */}
        <fieldset className="card p-6 space-y-4">
          <legend className="text-sm font-semibold text-[var(--foreground)] px-1">Timeline & Pricing</legend>

          <TextArea
            label="Proposed Timeline"
            name="proposed_timeline"
            value={form.proposed_timeline}
            onChange={handleChange}
            error={errors.proposed_timeline}
            placeholder="Expected duration, phases, or delivery window"
            rows={2}
          />

          <TextArea
            label="Estimated Pricing"
            name="estimated_pricing"
            value={form.estimated_pricing}
            onChange={handleChange}
            error={errors.estimated_pricing}
            placeholder="Proposed price, range, or pricing notes"
            rows={2}
          />
        </fieldset>

        {/* Supporting Material (optional) */}
        <fieldset className="card p-6">
          <legend className="text-sm font-semibold text-[var(--foreground)] px-1">Supporting Material (Optional)</legend>
          <TextArea
            label=""
            name="supporting_material"
            value={form.supporting_material}
            onChange={handleChange}
            placeholder="Paste any additional context: case studies, call notes, constraints, prior proposals..."
            rows={4}
          />
          <p className="text-xs text-[var(--muted)] mt-2">
            If provided, the AI will incorporate relevant details into the proposal.
          </p>
        </fieldset>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-[var(--accent)] text-white font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating proposal..." : "Create Proposal"}
        </button>
      </form>
    </div>
  );
}

// Reusable form field components

function Field({
  label, name, value, onChange, error, type = "text", placeholder,
}: {
  label: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string; type?: string; placeholder?: string;
}) {
  return (
    <div>
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
          {label}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full px-3 py-2 text-sm rounded-lg border bg-white transition-colors
          ${error 
            ? "border-[var(--danger)] focus:ring-red-200" 
            : "border-[var(--surface-border)] focus:ring-blue-100"
          } focus:outline-none focus:ring-2`}
      />
      {error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}
    </div>
  );
}

function TextArea({
  label, name, value, onChange, error, placeholder, rows = 3,
}: {
  label: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string; placeholder?: string; rows?: number;
}) {
  return (
    <div>
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={`w-full px-3 py-2 text-sm rounded-lg border bg-white transition-colors resize-vertical
          ${error
            ? "border-[var(--danger)] focus:ring-red-200"
            : "border-[var(--surface-border)] focus:ring-blue-100"
          } focus:outline-none focus:ring-2`}
      />
      {error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}
    </div>
  );
}
