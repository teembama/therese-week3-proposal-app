"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Proposal, STATUS_CONFIG, ProposalStatus } from "@/lib/types";

type ProposalSummary = Pick<Proposal, "id" | "client_name" | "company_name" | "salesperson_name" | "status" | "created_at" | "updated_at">;

export default function HomePage() {
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProposals() {
      try {
        const res = await fetch("/api/proposals");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load proposals");
        setProposals(data.proposals);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load proposals");
      } finally {
        setLoading(false);
      }
    }
    fetchProposals();
  }, []);

  if (loading) {
    return <div className="text-center py-20 text-[var(--muted)]">Loading proposals...</div>;
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-[var(--danger)] mb-2 font-medium">Error loading proposals</p>
        <p className="text-sm text-[var(--muted)]">{error}</p>
      </div>
    );
  }

  // Count proposals by status
  const counts = proposals.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const stats = [
    { label: "Total", count: proposals.length, color: "var(--foreground)" },
    { label: "Draft", count: counts.draft || 0, color: STATUS_CONFIG.draft.color },
    { label: "Pending", count: counts.pending_approval || 0, color: STATUS_CONFIG.pending_approval.color },
    { label: "Approved", count: counts.approved || 0, color: STATUS_CONFIG.approved.color },
    { label: "Sent", count: counts.sent || 0, color: STATUS_CONFIG.sent.color },
    { label: "Rejected", count: counts.rejected || 0, color: STATUS_CONFIG.rejected.color },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">All Proposals</h1>
      </div>

      {/* Stats row */}
      {proposals.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="card p-3 text-center">
              <div className="text-xl font-semibold" style={{ color: s.color }}>{s.count}</div>
              <div className="text-xs text-[var(--muted)] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {proposals.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-[var(--muted)] mb-4">No proposals yet</p>
          <Link
            href="/proposals/new"
            className="inline-block px-5 py-2.5 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            Create your first proposal
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => {
            const statusConf = STATUS_CONFIG[p.status as ProposalStatus];
            return (
              <Link key={p.id} href={`/proposals/${p.id}`} className="card block p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-medium text-[var(--foreground)] truncate">{p.company_name}</h2>
                    <p className="text-sm text-[var(--muted)] mt-0.5">{p.client_name} · {p.salesperson_name}</p>
                  </div>
                  <span
                    className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-full"
                    style={{ 
                      backgroundColor: statusConf.color + '18',
                      color: statusConf.color,
                    }}
                  >
                    {statusConf.label}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-3">
                  Created {new Date(p.created_at).toLocaleDateString()}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
