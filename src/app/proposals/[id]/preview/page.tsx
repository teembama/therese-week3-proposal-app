"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Proposal,
  GeneratedSections,
  SECTION_KEYS,
  SECTION_LABELS,
  SectionKey,
} from "@/lib/types";

export default function ProposalPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProposal = useCallback(async () => {
    try {
      const res = await fetch(`/api/proposals/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProposal(data.proposal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load proposal");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProposal(); }, [fetchProposal]);

  // Set page title for PDF filename
   useEffect(() => {
    if (proposal?.company_name) {
      document.title = `${proposal.company_name} Proposal`;
      return () => { document.title = "Koya Proposals"; };
    }
  }, [proposal?.company_name]);

  if (loading) return <div className="text-center py-20 text-[var(--muted)]">Loading preview...</div>;
  if (error || !proposal) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--danger)] font-medium">{error || "Proposal not found"}</p>
        <button onClick={() => router.back()} className="text-sm text-[var(--accent)] mt-3 underline">Go back</button>
      </div>
    );
  }

  if (!["approved", "sent"].includes(proposal.status)) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--danger)] font-medium">Proposal must be approved before previewing</p>
        <button onClick={() => router.back()} className="text-sm text-[var(--accent)] mt-3 underline">Go back</button>
      </div>
    );
  }

  const sections = proposal.generated_sections as GeneratedSections;

  return (
    <div>
      {/* Toolbar — hidden when printing */}
      <div className="print-hide flex items-center justify-between mb-8 pb-4 border-b border-[var(--surface-border)]">
        <button
          onClick={() => router.push(`/proposals/${id}`)}
          className="text-sm font-semibold text-[var(--accent)] hover:underline transition-colors"
        >
          ← Back to proposal
        </button>
        <button
          onClick={() => window.print()}
          className="px-5 py-2.5 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
        >
          Save as PDF
        </button>
      </div>

      {/* Proposal document */}
      <div className="max-w-3xl mx-auto proposal-document">
        <div className="mb-10 pb-6 border-b-2 border-[var(--foreground)]">
          <h1 className="text-3xl font-semibold mb-2">Proposal for {proposal.company_name}</h1>
          <p className="text-[var(--muted)]">
            Prepared by {proposal.salesperson_name} · Koya Talent
          </p>
          <p className="text-[var(--muted)] text-sm mt-1">
            Date: {proposal.date_of_call}
          </p>
        </div>

        {SECTION_KEYS.map((key: SectionKey) => (
          <div key={key} className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-[var(--foreground)]">
              {SECTION_LABELS[key]}
            </h2>
            <div className="text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
              {sections[key]}
            </div>
          </div>
        ))}

        <div className="mt-12 pt-6 border-t border-[var(--surface-border)] text-[var(--muted)]">
          <p>Warm regards,</p>
          <p className="mt-1 font-medium text-[var(--foreground)]">{proposal.salesperson_name}</p>
          <p>Koya Talent</p>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .print-hide { display: none !important; }
          nav { display: none !important; }
          main { padding: 0 !important; }
          body { background: white !important; }
          .proposal-document { max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
