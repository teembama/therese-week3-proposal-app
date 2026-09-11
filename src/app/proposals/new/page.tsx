"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

type Mode = "choose" | "manual" | "transcript";

export default function NewProposalPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Transcript extraction state
  const [transcript, setTranscript] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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

    if (!form.client_email.trim()) {
      errs.client_email = "Client email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.client_email)) {
      errs.client_email = "Enter a valid email address";
    }

    if (!form.date_of_call) {
      errs.date_of_call = "Date of call is required";
    } else if (new Date(form.date_of_call + "T23:59:59") < new Date("2020-01-01")) {
      errs.date_of_call = "Date of call seems too far in the past";
    } else if (new Date(form.date_of_call + "T00:00:00") > new Date()) {
      errs.date_of_call = "Date of call cannot be in the future";
    }

    return errs;
  }

  function handleCancel() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setSubmitting(false);
    setGenerationStatus(null);
  }

  async function handleExtract() {
    if (!transcript.trim()) {
      setExtractError("Paste a transcript first");
      return;
    }
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await fetch("/api/proposals/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Pre-fill the form with extracted fields
      // Keep manually entered date_of_call and salesperson_name (they were set before extraction)
      const fields = data.fields;
      setForm((prev) => ({
        ...prev,
        client_name: fields.client_name || prev.client_name,
        client_email: fields.client_email || prev.client_email,
        company_name: fields.company_name || prev.company_name,
        date_of_call: prev.date_of_call || fields.date_of_call || "",
        salesperson_name: prev.salesperson_name || fields.salesperson_name || "",
        client_needs_summary: fields.client_needs_summary || prev.client_needs_summary,
        project_scope: fields.project_scope || prev.project_scope,
        goals_and_objectives: fields.goals_and_objectives || prev.goals_and_objectives,
        recommended_services: fields.recommended_services || prev.recommended_services,
        proposed_timeline: fields.proposed_timeline || prev.proposed_timeline,
        estimated_pricing: fields.estimated_pricing || prev.estimated_pricing,
        supporting_material: fields.supporting_material || prev.supporting_material,
      }));

      // Switch to manual mode so they can review and edit
      setMode("manual");
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
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
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Step 1: Generate with Claude FIRST — nothing saved yet, cancel is clean
      setGenerationStatus("Generating proposal with AI — this takes 10-20 seconds...");
      const genRes = await fetch("/api/proposals/generate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        signal: controller.signal,
      });

      const genData = await genRes.json();

      if (!genRes.ok) {
        if (genData.details) {
          setErrors(genData.details);
        } else {
          setServerError(genData.detail || genData.error || "AI generation failed");
        }
        return;
      }

      // Step 2: Save to Supabase — intake data + generated sections in one write
      setGenerationStatus("Saving proposal...");
      const createRes = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          generated_sections: genData.sections,
        }),
        signal: controller.signal,
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        setServerError(createData.error || "Generated but failed to save — try again");
        return;
      }

      router.push(`/proposals/${createData.id}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setServerError("Network error — check your connection and try again");
    } finally {
      setSubmitting(false);
      setGenerationStatus(null);
      abortRef.current = null;
    }
  }

  // ---- Mode: Choose ----
  if (mode === "choose") {
    return (
      <div className="max-w-4xl">
        <Link href="/" className="text-sm font-semibold text-[var(--accent)] hover:underline mb-4 inline-block">
        ← All Proposals
        </Link>
        <h1 className="text-2xl font-semibold mb-2">New Proposal</h1>
        <p className="text-sm text-[var(--muted)] mb-8">
          How would you like to start?
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setMode("manual")}
            className="card p-6 text-left hover:shadow-md transition-shadow group"
          >
            <div className="text-lg font-medium mb-2 group-hover:text-[var(--accent)]">Fill Manually</div>
            <p className="text-sm text-[var(--muted)]">
              Enter the client details and project information from your notes.
            </p>
          </button>

          <button
            onClick={() => setMode("transcript")}
            className="card p-6 text-left hover:shadow-md transition-shadow group"
          >
            <div className="text-lg font-medium mb-2 group-hover:text-[var(--accent)]">Extract from Transcript</div>
            <p className="text-sm text-[var(--muted)]">
              Paste a meeting transcript (Fireflies, Gemini, Otter, etc.) and let AI extract the details.
            </p>
          </button>
        </div>
      </div>
    );
  }

  // ---- Mode: Transcript ----
  if (mode === "transcript") {
    return (
      <div className="max-w-4xl">
        <button onClick={() => setMode("choose")} className="text-sm text-[var(--muted)] hover:text-[var(--accent)] mb-4 inline-block">
          ← Back
        </button>
        <h1 className="text-2xl font-semibold mb-2">Extract from Transcript</h1>
        <p className="text-sm text-[var(--muted)] mb-6">
          Paste your meeting transcript below. Works with Fireflies, Google Gemini, Otter.ai, or any plain-text transcript from a discovery or sales call.
        </p>

        <div className="card p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Date of Call</label>
              <input
                type="date"
                value={form.date_of_call}
                onChange={(e) => setForm((prev) => ({ ...prev, date_of_call: e.target.value }))}
                max={new Date().toISOString().split("T")[0]}
                disabled={extracting}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Salesperson Name</label>
              <input
                type="text"
                value={form.salesperson_name}
                onChange={(e) => setForm((prev) => ({ ...prev, salesperson_name: e.target.value }))}
                placeholder="e.g. Therese"
                disabled={extracting}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Meeting Transcript</label>
            <textarea
            value={transcript}
            onChange={(e) => { setTranscript(e.target.value); setExtractError(null); }}
            placeholder={"Paste your full meeting transcript here...\n\nExample sources:\n• Fireflies.ai transcript\n• Google Meet / Gemini notes\n• Otter.ai transcript\n• Manual call notes"}
            rows={12}
            disabled={extracting}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-blue-100 resize-vertical disabled:opacity-50"
          />

          {extractError && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-[var(--danger)]">
              {extractError}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            {extracting ? (
              <div className="flex-1 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Extracting details from transcript...
                </div>
              </div>
            ) : (
              <button
                onClick={handleExtract}
                className="flex-1 py-3 bg-[var(--accent)] text-white font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
              >
                Extract Details
              </button>
            )}
          </div>

          <p className="text-xs text-[var(--muted)] mt-3">
            After extraction, you'll review and edit the fields before generating the proposal.
          </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- Mode: Manual (also shown after transcript extraction for review) ----
  return (
    <div className="max-w-4xl">
      <button onClick={() => setMode("choose")} className="text-sm text-[var(--muted)] hover:text-[var(--accent)] mb-4 inline-block">
        ← Back
      </button>
      <h1 className="text-2xl font-semibold mb-2">New Proposal</h1>
      <p className="text-sm text-[var(--muted)] mb-8">
        {form.client_name
          ? "Review the extracted details below. Edit anything that needs fixing, then generate."
          : "Enter the details from your discovery call. All fields except Supporting Material are required."}
      </p>

      {serverError && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-[var(--danger)]">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="card p-6 space-y-4">
          <legend className="text-sm font-semibold text-[var(--foreground)] px-1">Contact Details</legend>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Client Name" name="client_name" value={form.client_name} onChange={handleChange} error={errors.client_name} placeholder="e.g. Sarah Chen" disabled={submitting} />
            <Field label="Client Email" name="client_email" type="email" value={form.client_email} onChange={handleChange} error={errors.client_email} placeholder="sarah@company.com" disabled={submitting} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company Name" name="company_name" value={form.company_name} onChange={handleChange} error={errors.company_name} placeholder="e.g. Acme Corp" disabled={submitting} />
            <Field label="Date of Call" name="date_of_call" type="date" value={form.date_of_call} onChange={handleChange} error={errors.date_of_call} max={new Date().toISOString().split("T")[0]} disabled={submitting} />
          </div>
          <Field label="Salesperson Name" name="salesperson_name" value={form.salesperson_name} onChange={handleChange} error={errors.salesperson_name} placeholder="e.g. Therese" disabled={submitting} />
        </fieldset>

        <fieldset className="card p-6 space-y-4">
          <legend className="text-sm font-semibold text-[var(--foreground)] px-1">Project Details</legend>
          <TextArea label="Summary of Client's Needs" name="client_needs_summary" value={form.client_needs_summary} onChange={handleChange} error={errors.client_needs_summary} placeholder="What problem does the client want to solve?" rows={3} disabled={submitting} />
          <TextArea label="Project Scope" name="project_scope" value={form.project_scope} onChange={handleChange} error={errors.project_scope} placeholder="What does the client want built or delivered?" rows={3} disabled={submitting} />
          <TextArea label="Goals and Objectives" name="goals_and_objectives" value={form.goals_and_objectives} onChange={handleChange} error={errors.goals_and_objectives} placeholder="Expected outcomes: revenue growth, efficiency gains, etc." rows={2} disabled={submitting} />
          <TextArea label="Recommended Services / Deliverables" name="recommended_services" value={form.recommended_services} onChange={handleChange} error={errors.recommended_services} placeholder="Proposed services, outputs, or deliverables" rows={2} disabled={submitting} />
        </fieldset>

        <fieldset className="card p-6 space-y-4">
          <legend className="text-sm font-semibold text-[var(--foreground)] px-1">Timeline & Pricing</legend>
          <TextArea label="Proposed Timeline" name="proposed_timeline" value={form.proposed_timeline} onChange={handleChange} error={errors.proposed_timeline} placeholder="Expected duration, phases, or delivery window" rows={2} disabled={submitting} />
          <TextArea label="Estimated Pricing" name="estimated_pricing" value={form.estimated_pricing} onChange={handleChange} error={errors.estimated_pricing} placeholder="Proposed price, range, or pricing notes" rows={2} disabled={submitting} />
        </fieldset>

        <fieldset className="card p-6">
          <legend className="text-sm font-semibold text-[var(--foreground)] px-1">Supporting Material (Optional)</legend>
          <TextArea label="" name="supporting_material" value={form.supporting_material} onChange={handleChange} placeholder="Paste any additional context: case studies, call notes, constraints, prior proposals..." rows={4} disabled={submitting} />
          <p className="text-xs text-[var(--muted)] mt-2">If provided, the AI will incorporate relevant details into the proposal.</p>
        </fieldset>

        {generationStatus && (
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {generationStatus}
              </div>
              <button type="button" onClick={handleCancel} className="px-3 py-1 text-xs font-medium border border-blue-300 rounded hover:bg-blue-100 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {!submitting && (
          <button type="submit" className="w-full py-3 bg-[var(--accent)] text-white font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors">
            Generate Proposal with AI
          </button>
        )}
      </form>
    </div>
  );
}

function Field({ label, name, value, onChange, error, type = "text", placeholder, max, disabled }: {
  label: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string; type?: string; placeholder?: string; max?: string; disabled?: boolean;
}) {
  return (
    <div>
      {label && <label htmlFor={name} className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{label}</label>}
      <input id={name} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} max={max} disabled={disabled}
        className={`w-full px-3 py-2 text-sm rounded-lg border bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${error ? "border-[var(--danger)] focus:ring-red-200" : "border-[var(--surface-border)] focus:ring-blue-100"} focus:outline-none focus:ring-2`} />
      {error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}
    </div>
  );
}

function TextArea({ label, name, value, onChange, error, placeholder, rows = 3, disabled }: {
  label: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string; placeholder?: string; rows?: number; disabled?: boolean;
}) {
  return (
    <div>
      {label && <label htmlFor={name} className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{label}</label>}
      <textarea id={name} name={name} value={value} onChange={onChange} placeholder={placeholder} rows={rows} disabled={disabled}
        className={`w-full px-3 py-2 text-sm rounded-lg border bg-white transition-colors resize-vertical disabled:opacity-50 disabled:cursor-not-allowed ${error ? "border-[var(--danger)] focus:ring-red-200" : "border-[var(--surface-border)] focus:ring-blue-100"} focus:outline-none focus:ring-2`} />
      {error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}
    </div>
  );
}
