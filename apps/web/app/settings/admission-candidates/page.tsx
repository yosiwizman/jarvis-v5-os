"use client";

/**
 * Control-Plane Admission Candidates — M-CP-10 SUPPLY-CHAIN-ADMISSION-GATE
 *
 * Founder-facing admission-review surface. Reuses SubpageHeader. Admin-guarded
 * routes under /api/control-plane/admission-candidates. No install, no activate,
 * no runtime promotion — pure control-plane review.
 */

import React, { useState, useEffect, useCallback } from "react";
import { SubpageHeader } from "../channels/shared";

// ---------------------------------------------------------------------------
// Types (mirror storage/admissionCandidateStore.ts)
// ---------------------------------------------------------------------------

type CandidateType = "skill" | "repo" | "runtime" | "package" | "other";
type SourceKind =
  | "local_openclaw"
  | "macmini_reference"
  | "community"
  | "current_akior"
  | "other";
type ProvenanceStatus = "unknown" | "documented" | "verified";
type InstallCountStatus = "unknown" | "insufficient" | "acceptable";
type SecurityReviewStatus =
  | "not_started"
  | "in_progress"
  | "acceptable"
  | "rejected";
type OwnershipMapStatus = "unknown" | "partial" | "complete";
type ReviewState = "draft" | "pending_review" | "approved" | "rejected";
type FinalVerdict =
  | "READY_FOR_THIN_INTEGRATION"
  | "READY_AFTER_CONTROL_PLANE_GAP_CLOSE"
  | "READY_AFTER_UI_STATUS_GAP_CLOSE"
  | "READY_AFTER_AUTH_POLICY_GAP_CLOSE"
  | "NOT_READY"
  | "DEFERRED"
  | null;

interface AdmissionCandidate {
  id: string;
  candidateName: string;
  candidateType: CandidateType;
  sourceKind: SourceKind;
  sourceUrlOrPath: string;
  sourceSlugOrRepo: string;
  purposeMapping: string;
  provenanceStatus: ProvenanceStatus;
  installPathKnown: boolean;
  installCountStatus: InstallCountStatus;
  securityReviewStatus: SecurityReviewStatus;
  ownershipMapStatus: OwnershipMapStatus;
  readinessGaps: string;
  readinessGapsReviewed: boolean;
  curatedSource: boolean;
  vettedSource: boolean;
  founderSafeAuthApproved: boolean;
  reviewState: ReviewState;
  decisionReason: string;
  finalVerdict: FinalVerdict;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ActivityEntry {
  id: string;
  candidateId: string;
  actor: string;
  action: "created" | "submitted" | "approved" | "rejected" | "updated";
  result: string;
  reasonDelta: string;
  at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reviewStateBadge(s: ReviewState) {
  const map: Record<ReviewState, string> = {
    draft: "bg-white/10 text-white/60 border border-white/10",
    pending_review: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    approved: "bg-green-500/20 text-green-300 border border-green-500/30",
    rejected: "bg-red-500/20 text-red-300 border border-red-500/30",
  };
  return (
    <span
      data-testid="admission-review-state"
      className={`text-xs px-2 py-0.5 rounded font-mono ${map[s]}`}
    >
      {s}
    </span>
  );
}

const CANDIDATE_TYPES: CandidateType[] = ["skill", "repo", "runtime", "package", "other"];
const SOURCE_KINDS: SourceKind[] = [
  "local_openclaw",
  "macmini_reference",
  "community",
  "current_akior",
  "other",
];
const PROVENANCE_STATUSES: ProvenanceStatus[] = ["unknown", "documented", "verified"];
const INSTALL_COUNT_STATUSES: InstallCountStatus[] = [
  "unknown",
  "insufficient",
  "acceptable",
];
const SECURITY_REVIEW_STATUSES: SecurityReviewStatus[] = [
  "not_started",
  "in_progress",
  "acceptable",
  "rejected",
];
const OWNERSHIP_MAP_STATUSES: OwnershipMapStatus[] = ["unknown", "partial", "complete"];
const FINAL_VERDICTS: Exclude<FinalVerdict, null>[] = [
  "READY_FOR_THIN_INTEGRATION",
  "READY_AFTER_CONTROL_PLANE_GAP_CLOSE",
  "READY_AFTER_UI_STATUS_GAP_CLOSE",
  "READY_AFTER_AUTH_POLICY_GAP_CLOSE",
  "NOT_READY",
  "DEFERRED",
];

interface GateEvaluation {
  ok: boolean;
  blockingReasons: string[];
}

function evaluateGate(c: AdmissionCandidate): GateEvaluation {
  const r: string[] = [];
  if (!c.founderSafeAuthApproved) r.push("founder-safe auth approval is required");
  if (!c.curatedSource) r.push("curated source must be true");
  if (!c.vettedSource) r.push("vetted source must be true");
  if (c.provenanceStatus !== "documented" && c.provenanceStatus !== "verified")
    r.push("provenance must be documented or verified");
  if (!c.installPathKnown) r.push("install path must be known");
  if (c.installCountStatus !== "acceptable") r.push("install count must be acceptable");
  if (c.securityReviewStatus !== "acceptable")
    r.push("security review must be acceptable");
  if (c.ownershipMapStatus !== "complete") r.push("ownership map must be complete");
  if (!c.readinessGapsReviewed)
    r.push("readiness gaps must be reviewed by the reviewer");
  return { ok: r.length === 0, blockingReasons: r };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdmissionCandidatesSubpage() {
  const [candidates, setCandidates] = useState<AdmissionCandidate[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [blockedReasons, setBlockedReasons] = useState<string[] | null>(null);

  // Create form state
  const [cName, setCName] = useState("");
  const [cType, setCType] = useState<CandidateType>("skill");
  const [cSourceKind, setCSourceKind] = useState<SourceKind>("community");
  const [cSourceUrl, setCSourceUrl] = useState("");
  const [cSourceSlug, setCSourceSlug] = useState("");
  const [cPurpose, setCPurpose] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;
  const gate = selected ? evaluateGate(selected) : null;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, aRes] = await Promise.all([
        fetch("/api/control-plane/admission-candidates"),
        fetch("/api/control-plane/admission-activity"),
      ]);
      if (!cRes.ok || !aRes.ok) {
        throw new Error(
          `Fetch failed: candidates=${cRes.status} activity=${aRes.status}`,
        );
      }
      const cJson = await cRes.json();
      const aJson = await aRes.json();
      setCandidates(cJson.candidates ?? []);
      setActivity(aJson.activity ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim() || !cSourceUrl.trim() || !cPurpose.trim()) return;
    setCreating(true);
    setBlockedReasons(null);
    try {
      const res = await fetch("/api/control-plane/admission-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: cName,
          candidateType: cType,
          sourceKind: cSourceKind,
          sourceUrlOrPath: cSourceUrl,
          sourceSlugOrRepo: cSourceSlug,
          purposeMapping: cPurpose,
        }),
      });
      if (!res.ok) throw new Error(`Create failed: ${res.status}`);
      const json = await res.json();
      setCName("");
      setCSourceUrl("");
      setCSourceSlug("");
      setCPurpose("");
      await fetchAll();
      setSelectedId(json?.candidate?.id ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const patchSelected = async (fields: Record<string, unknown>) => {
    if (!selected) return;
    setBlockedReasons(null);
    try {
      const res = await fetch(
        `/api/control-plane/admission-candidates/${selected.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        },
      );
      if (!res.ok) throw new Error(`Patch failed: ${res.status}`);
      await fetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSubmitForReview = async () => {
    if (!selected) return;
    setBlockedReasons(null);
    try {
      const res = await fetch(
        `/api/control-plane/admission-candidates/${selected.id}/submit`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
      await fetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    setBlockedReasons(null);
    try {
      const res = await fetch(
        `/api/control-plane/admission-candidates/${selected.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            finalVerdict: selected.finalVerdict ?? "READY_FOR_THIN_INTEGRATION",
            decisionReason: selected.decisionReason || "Approved via control plane UI.",
          }),
        },
      );
      if (res.status === 409) {
        const json = await res.json();
        setBlockedReasons(json.blockingReasons ?? ["approval blocked"]);
        return;
      }
      if (!res.ok) throw new Error(`Approve failed: ${res.status}`);
      await fetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    const reason =
      selected.decisionReason.trim() ||
      window.prompt("Rejection reason (required):") ||
      "";
    if (!reason.trim()) {
      setError("Rejection reason is required");
      return;
    }
    setBlockedReasons(null);
    try {
      const res = await fetch(
        `/api/control-plane/admission-candidates/${selected.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decisionReason: reason }),
        },
      );
      if (!res.ok) throw new Error(`Reject failed: ${res.status}`);
      await fetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6" data-testid="admission-candidates-subpage">
      <SubpageHeader
        backHref="/settings"
        backLabel="Back to Settings"
        title="Supply-Chain Admission Gate"
        description="Control-plane review of candidate skills, repos, runtimes, and packages. Nothing is installed or activated here — approval is a control-plane decision only."
      />

      {error && (
        <div
          data-testid="admission-error"
          className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2"
        >
          {error}
        </div>
      )}

      {/* Create candidate form */}
      <section className="card p-6 border border-white/10 rounded-lg bg-white/5 space-y-4">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
          New Admission Candidate
        </h2>
        <form
          onSubmit={handleCreate}
          data-testid="admission-create-form"
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <input
            data-testid="admission-create-name"
            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
            placeholder="Candidate name"
            value={cName}
            onChange={(e) => setCName(e.target.value)}
            required
          />
          <select
            data-testid="admission-create-type"
            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
            value={cType}
            onChange={(e) => setCType(e.target.value as CandidateType)}
          >
            {CANDIDATE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            data-testid="admission-create-source-kind"
            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
            value={cSourceKind}
            onChange={(e) => setCSourceKind(e.target.value as SourceKind)}
          >
            {SOURCE_KINDS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            data-testid="admission-create-source-url"
            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
            placeholder="Source URL or path"
            value={cSourceUrl}
            onChange={(e) => setCSourceUrl(e.target.value)}
            required
          />
          <input
            data-testid="admission-create-source-slug"
            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm"
            placeholder="Slug / repo (optional)"
            value={cSourceSlug}
            onChange={(e) => setCSourceSlug(e.target.value)}
          />
          <input
            data-testid="admission-create-purpose"
            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm md:col-span-2"
            placeholder="Purpose mapping — why AKIOR needs this"
            value={cPurpose}
            onChange={(e) => setCPurpose(e.target.value)}
            required
          />
          <button
            type="submit"
            data-testid="admission-create-submit"
            disabled={creating}
            className="md:col-span-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium disabled:opacity-40"
          >
            {creating ? "Creating…" : "Create candidate (draft)"}
          </button>
        </form>
      </section>

      {/* Candidate list */}
      <section className="card p-6 border border-white/10 rounded-lg bg-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
            Candidates
          </h2>
          <button
            data-testid="admission-refresh"
            onClick={() => void fetchAll()}
            disabled={loading}
            className="text-xs text-white/60 hover:text-white"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {candidates.length === 0 ? (
          <div data-testid="admission-list-empty" className="text-sm text-white/40">
            No candidates yet.
          </div>
        ) : (
          <ul data-testid="admission-list" className="space-y-2">
            {candidates.map((c) => (
              <li
                key={c.id}
                data-testid="admission-row"
                data-candidate-id={c.id}
                data-review-state={c.reviewState}
                onClick={() => {
                  setSelectedId(c.id);
                  setBlockedReasons(null);
                }}
                className={`cursor-pointer flex flex-col gap-1 border rounded-lg p-3 bg-white/5 ${
                  selectedId === c.id ? "border-white/30" : "border-white/10"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-white/90">{c.candidateName}</span>
                  <span className="text-xs text-white/40 font-mono">{c.candidateType}</span>
                  {reviewStateBadge(c.reviewState)}
                </div>
                <p className="text-xs text-white/40">{c.purposeMapping}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Detail / review panel */}
      {selected && gate && (
        <section
          className="card p-6 border border-white/10 rounded-lg bg-white/5 space-y-4"
          data-testid="admission-detail"
          data-candidate-id={selected.id}
          data-review-state={selected.reviewState}
          data-gate-ok={String(gate.ok)}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
              Review: {selected.candidateName}
            </h2>
            {reviewStateBadge(selected.reviewState)}
          </div>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-white/70">
            <div>source kind: <span className="text-white/90 font-mono">{selected.sourceKind}</span></div>
            <div>source: <span className="text-white/90 font-mono break-all">{selected.sourceUrlOrPath}</span></div>
            <div>slug/repo: <span className="text-white/90 font-mono">{selected.sourceSlugOrRepo || "—"}</span></div>
            <div>type: <span className="text-white/90 font-mono">{selected.candidateType}</span></div>
          </dl>

          {/* Gate fields editor — only when draft or pending_review */}
          {(selected.reviewState === "draft" ||
            selected.reviewState === "pending_review") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-white/70">
              <label className="flex items-center gap-2" data-testid="admission-field-curated">
                <input
                  type="checkbox"
                  checked={selected.curatedSource}
                  onChange={(e) => void patchSelected({ curatedSource: e.target.checked })}
                />
                curated source
              </label>
              <label className="flex items-center gap-2" data-testid="admission-field-vetted">
                <input
                  type="checkbox"
                  checked={selected.vettedSource}
                  onChange={(e) => void patchSelected({ vettedSource: e.target.checked })}
                />
                vetted source
              </label>
              <label className="flex items-center gap-2" data-testid="admission-field-founder-auth">
                <input
                  type="checkbox"
                  checked={selected.founderSafeAuthApproved}
                  onChange={(e) =>
                    void patchSelected({ founderSafeAuthApproved: e.target.checked })
                  }
                />
                founder-safe auth approved
              </label>
              <label className="flex items-center gap-2" data-testid="admission-field-install-path">
                <input
                  type="checkbox"
                  checked={selected.installPathKnown}
                  onChange={(e) =>
                    void patchSelected({ installPathKnown: e.target.checked })
                  }
                />
                install path known
              </label>
              <label className="flex flex-col gap-1">
                <span>provenance status</span>
                <select
                  data-testid="admission-field-provenance"
                  className="bg-white/5 border border-white/10 rounded px-2 py-1"
                  value={selected.provenanceStatus}
                  onChange={(e) =>
                    void patchSelected({ provenanceStatus: e.target.value })
                  }
                >
                  {PROVENANCE_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span>install count status</span>
                <select
                  data-testid="admission-field-install-count"
                  className="bg-white/5 border border-white/10 rounded px-2 py-1"
                  value={selected.installCountStatus}
                  onChange={(e) =>
                    void patchSelected({ installCountStatus: e.target.value })
                  }
                >
                  {INSTALL_COUNT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span>security review status</span>
                <select
                  data-testid="admission-field-security-review"
                  className="bg-white/5 border border-white/10 rounded px-2 py-1"
                  value={selected.securityReviewStatus}
                  onChange={(e) =>
                    void patchSelected({ securityReviewStatus: e.target.value })
                  }
                >
                  {SECURITY_REVIEW_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span>ownership map status</span>
                <select
                  data-testid="admission-field-ownership-map"
                  className="bg-white/5 border border-white/10 rounded px-2 py-1"
                  value={selected.ownershipMapStatus}
                  onChange={(e) =>
                    void patchSelected({ ownershipMapStatus: e.target.value })
                  }
                >
                  {OWNERSHIP_MAP_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span>readiness gaps (blank = none; still must mark reviewed)</span>
                <textarea
                  data-testid="admission-field-readiness-gaps"
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                  value={selected.readinessGaps}
                  onChange={(e) =>
                    void patchSelected({ readinessGaps: e.target.value })
                  }
                />
              </label>
              <label className="flex items-center gap-2 md:col-span-2" data-testid="admission-field-gaps-reviewed">
                <input
                  type="checkbox"
                  checked={selected.readinessGapsReviewed}
                  onChange={(e) =>
                    void patchSelected({ readinessGapsReviewed: e.target.checked })
                  }
                />
                readiness gaps reviewed
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span>final verdict (selected at approval)</span>
                <select
                  data-testid="admission-field-final-verdict"
                  className="bg-white/5 border border-white/10 rounded px-2 py-1"
                  value={selected.finalVerdict ?? ""}
                  onChange={(e) =>
                    void patchSelected({ finalVerdict: e.target.value || null })
                  }
                >
                  <option value="">(none)</option>
                  {FINAL_VERDICTS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span>decision reason</span>
                <textarea
                  data-testid="admission-field-decision-reason"
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                  value={selected.decisionReason}
                  onChange={(e) =>
                    void patchSelected({ decisionReason: e.target.value })
                  }
                />
              </label>
            </div>
          )}

          {/* Gate status */}
          <div
            data-testid="admission-gate-status"
            data-gate-ok={String(gate.ok)}
            className={`text-xs rounded px-3 py-2 ${
              gate.ok
                ? "bg-green-500/10 border border-green-500/20 text-green-300"
                : "bg-amber-500/10 border border-amber-500/20 text-amber-300"
            }`}
          >
            {gate.ok ? (
              <span>Gate: all conditions satisfied.</span>
            ) : (
              <div>
                <div className="font-semibold">Gate: approval blocked.</div>
                <ul className="list-disc pl-5" data-testid="admission-gate-reasons">
                  {gate.blockingReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {blockedReasons && (
            <div
              data-testid="admission-blocked-banner"
              className="text-xs rounded px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-300"
            >
              <div className="font-semibold">Server blocked approval:</div>
              <ul className="list-disc pl-5">
                {blockedReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {selected.reviewState === "draft" && (
              <button
                data-testid="admission-submit-for-review"
                onClick={() => void handleSubmitForReview()}
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-xs"
              >
                Submit for review
              </button>
            )}
            {(selected.reviewState === "draft" ||
              selected.reviewState === "pending_review") && (
              <>
                <button
                  data-testid="admission-approve-btn"
                  onClick={() => void handleApprove()}
                  disabled={!gate.ok}
                  className="px-3 py-1 rounded bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  title={gate.ok ? "Approve" : gate.blockingReasons.join("; ")}
                >
                  Approve
                </button>
                <button
                  data-testid="admission-reject-btn"
                  onClick={() => void handleReject()}
                  className="px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs"
                >
                  Reject
                </button>
              </>
            )}
            {(selected.reviewState === "approved" ||
              selected.reviewState === "rejected") && (
              <span
                data-testid="admission-final-verdict"
                className="text-xs text-white/60"
              >
                Final: {selected.finalVerdict ?? "—"} ·{" "}
                {selected.reviewedBy ?? "—"} ·{" "}
                {selected.decisionReason || "(no reason)"}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Activity log */}
      <section className="card p-6 border border-white/10 rounded-lg bg-white/5 space-y-3">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
          Admission Activity
        </h2>
        {activity.length === 0 ? (
          <div
            data-testid="admission-activity-empty"
            className="text-sm text-white/40"
          >
            No activity yet.
          </div>
        ) : (
          <ul data-testid="admission-activity-list" className="space-y-1 text-xs">
            {activity.map((a) => (
              <li
                key={a.id}
                data-testid="admission-activity-row"
                data-action={a.action}
                className="flex flex-col gap-0.5 border border-white/10 rounded p-2 bg-white/5"
              >
                <div className="flex flex-wrap gap-2 text-white/70">
                  <span className="font-mono">{a.action}</span>
                  <span className="text-white/40">{a.candidateId}</span>
                  <span className="text-white/40">{a.actor}</span>
                  <span className="text-white/30">
                    {new Date(a.at).toLocaleString()}
                  </span>
                </div>
                <div className="text-white/50">{a.reasonDelta}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
