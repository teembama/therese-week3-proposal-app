"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Proposal,
  GeneratedSections,
  SECTION_KEYS,
  SECTION_LABELS,
  SectionKey,
  STATUS_CONFIG,
  ProposalStatus,
} from "@/lib/types";

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProposal = useCallback(async () => {
    try {
      const res = await fetch(`/api/proposals/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProposal(data.proposal);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load proposal");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProposal(); }, [fetchProposal]);

  if (loading) return <div className="text-center py-20 text-[var(--muted)]">Loading proposal...</div>;
  if (error || !proposal) {
    return (
      <div className="card p-6 text-center">
        <p className="text-[var(--danger)] font-medium">{error || "Proposal not found"}</p>
        <Link href="/" className="text-sm text-[var(--accent)] mt-2 inline-block">Back to proposals</Link>
      </div>
    );
  }

  const status = proposal.status as ProposalStatus;
  const statusConf = STATUS_CONFIG[status];
  const canEdit = ["draft", "rejected"].includes(status);
  const canSubmitForApproval = status === "draft" && proposal.generated_sections;
  const canApprove = status === "pending_approval";
  const canDeliver = status === "approved";

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--accent)] mb-1 inline-block">
            ← All Proposals
          </Link>
          <h1 className="text-2xl font-semibold">{proposal.company_name}</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {proposal.client_name} · {proposal.salesperson_name} · {proposal.date_of_call}
          </p>
        </div>
        <span
          className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-full"
          style={{ backgroundColor: statusConf.color + "18", color: statusConf.color }}
        >
          {statusConf.label}
        </span>
      </div>

      {/* Rejection notice */}
      {status === "rejected" && proposal.rejection_reason && (
        <div className="card p-4 mb-6 border-l-4 border-l-[var(--danger)]">
          <p className="text-sm font-medium text-[var(--danger)]">Rejected</p>
          <p className="text-sm text-[var(--muted)] mt-1">{proposal.rejection_reason}</p>
          <p className="text-xs text-[var(--muted)] mt-2">You can edit the sections and resubmit for approval.</p>
        </div>
      )}

      {/* Generate button — if no sections yet */}
      {!proposal.generated_sections && canEdit && (
        <GenerateButton id={id} onComplete={fetchProposal} />
      )}

      {/* Sections */}
      {proposal.generated_sections && (
        <div className="space-y-4 mb-8">
          {SECTION_KEYS.map((key) => (
            <SectionCard
              key={key}
              proposalId={id}
              sectionKey={key}
              content={(proposal.generated_sections as GeneratedSections)[key]}
              canEdit={canEdit}
              onUpdate={fetchProposal}
            />
          ))}
        </div>
      )}

      {/* Action buttons based on status */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold">Actions</h3>

        {/* Regenerate all — when sections exist and editable */}
        {proposal.generated_sections && canEdit && (
          <GenerateButton id={id} onComplete={fetchProposal} label="Regenerate Entire Proposal" />
        )}

        {/* Submit for approval */}
        {canSubmitForApproval && (
          <SubmitForApprovalButton id={id} onComplete={fetchProposal} />
        )}

        {/* Approval actions */}
        {canApprove && (
          <ApprovalActions id={id} onComplete={fetchProposal} />
        )}

        {/* Delivery actions — only when approved */}
        {canDeliver && (
          <DeliveryActions id={id} proposal={proposal} onComplete={fetchProposal} />
        )}

        {/* Post-send info */}
        {status === "sent" && (
          <div className="text-sm text-[var(--success)] font-medium">
            Sent to {proposal.client_email} on {new Date(proposal.sent_at!).toLocaleString()}
          </div>
        )}

        {/* Email error display */}
        {proposal.email_error && (
          <div className="text-sm text-[var(--danger)]">
            Last email error: {proposal.email_error}
          </div>
        )}

        {/* PDF link — available for approved/sent */}
        {["approved", "sent"].includes(status) && (
          <a
            href={`/api/proposals/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 text-sm font-medium border border-[var(--surface-border)] rounded-lg hover:bg-gray-50 transition-colors"
          >
            View Proposal as PDF
          </a>
        )}
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function GenerateButton({ id, onComplete, label = "Generate Proposal with AI" }: {
  id: string; onComplete: () => void; label?: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${id}/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mb-4">
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full py-3 bg-[var(--accent)] text-white font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
      >
        {generating ? "Generating... (this takes 10-20 seconds)" : label}
      </button>
      {error && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-[var(--danger)]">
          <p className="font-medium">AI generation failed</p>
          <p className="mt-1">{error}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Your proposal data is safe. You can try again.</p>
        </div>
      )}
    </div>
  );
}

function SectionCard({ proposalId, sectionKey, content, canEdit, onUpdate }: {
  proposalId: string; sectionKey: SectionKey; content: string;
  canEdit: boolean; onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const [regenerateNote, setRegenerateNote] = useState("");
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/sections/${sectionKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditing(false);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/sections/${sectionKey}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: regenerateNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error);
      setShowRegenerate(false);
      setRegenerateNote("");
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{SECTION_LABELS[sectionKey]}</h3>
        {canEdit && !editing && (
          <div className="flex gap-2">
            <button
              onClick={() => { setEditing(true); setEditText(content); }}
              className="text-xs px-2.5 py-1 rounded border border-[var(--surface-border)] hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => setShowRegenerate(!showRegenerate)}
              className="text-xs px-2.5 py-1 rounded border border-[var(--accent)] text-[var(--accent)] hover:bg-blue-50 transition-colors"
            >
              Regenerate
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-blue-100 resize-vertical"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Edit"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-xs border border-[var(--surface-border)] rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      )}

      {showRegenerate && canEdit && (
        <div className="mt-3 pt-3 border-t border-[var(--surface-border)]">
          <label className="text-xs text-[var(--muted)] block mb-1.5">
            Optional: tell the AI what to change
          </label>
          <textarea
            value={regenerateNote}
            onChange={(e) => setRegenerateNote(e.target.value)}
            placeholder="e.g. Make it shorter, emphasize ROI, add more detail about phases..."
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-blue-100 resize-vertical"
          />
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="mt-2 px-3 py-1.5 text-xs font-medium bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {regenerating ? "Regenerating..." : "Regenerate This Section"}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>
      )}
    </div>
  );
}

function SubmitForApprovalButton({ id, onComplete }: { id: string; onComplete: () => void }) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending_approval" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      onComplete();
    } catch {
      alert("Failed to submit for approval");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      onClick={handleSubmit}
      disabled={submitting}
      className="w-full py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
    >
      {submitting ? "Submitting..." : "Submit for Approval"}
    </button>
  );
}

function ApprovalActions({ id, onComplete }: { id: string; onComplete: () => void }) {
  const [approverName, setApproverName] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    if (!approverName.trim()) {
      setError("Approver name is required");
      return;
    }
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approver_name: approverName, approval_note: approvalNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    if (!rejectionReason.trim()) {
      setError("Rejection reason is required");
      return;
    }
    setActing(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-amber-600">This proposal is awaiting your review</p>
      
      <div>
        <label className="text-xs text-[var(--muted)] block mb-1">Your name (approver)</label>
        <input
          value={approverName}
          onChange={(e) => setApproverName(e.target.value)}
          placeholder="Enter your name"
          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div>
        <label className="text-xs text-[var(--muted)] block mb-1">Note (optional)</label>
        <textarea
          value={approvalNote}
          onChange={(e) => setApprovalNote(e.target.value)}
          placeholder="Any notes about the approval..."
          rows={2}
          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--surface-border)] focus:outline-none focus:ring-2 focus:ring-blue-100 resize-vertical"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={acting}
          className="flex-1 py-2.5 bg-[var(--success)] text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {acting ? "..." : "Approve"}
        </button>
        <button
          onClick={() => setShowReject(!showReject)}
          className="flex-1 py-2.5 border border-[var(--danger)] text-[var(--danger)] font-medium rounded-lg hover:bg-red-50"
        >
          Reject
        </button>
      </div>

      {showReject && (
        <div className="pt-2">
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Reason for rejection (required)..."
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100 resize-vertical"
          />
          <button
            onClick={handleReject}
            disabled={acting || !rejectionReason.trim()}
            className="mt-2 px-4 py-2 text-sm bg-[var(--danger)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            Confirm Rejection
          </button>
        </div>
      )}

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}

function DeliveryActions({ id, proposal, onComplete }: {
  id: string; proposal: Proposal; onComplete: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success?: boolean; error?: string } | null>(null);

  async function handleSend() {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/proposals/${id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSendResult({ success: true });
      onComplete();
    } catch (err) {
      setSendResult({ error: err instanceof Error ? err.message : "Send failed" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--success)] font-medium">
        Approved{proposal.approver_name ? ` by ${proposal.approver_name}` : ""}
        {proposal.approved_at ? ` on ${new Date(proposal.approved_at).toLocaleDateString()}` : ""}
      </p>

      <div className="flex gap-3">
        <a
          href={`/api/proposals/${id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2.5 text-center border border-[var(--surface-border)] font-medium rounded-lg hover:bg-gray-50 text-sm"
        >
          Export PDF
        </a>
        <button
          onClick={handleSend}
          disabled={sending}
          className="flex-1 py-2.5 bg-[var(--accent)] text-white font-medium rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 text-sm"
        >
          {sending ? "Sending..." : `Email to ${proposal.client_email}`}
        </button>
      </div>

      {sendResult?.success && (
        <p className="text-sm text-[var(--success)]">Email sent successfully</p>
      )}
      {sendResult?.error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-[var(--danger)]">
          <p className="font-medium">Email delivery failed</p>
          <p className="mt-1">{sendResult.error}</p>
        </div>
      )}
    </div>
  );
}
