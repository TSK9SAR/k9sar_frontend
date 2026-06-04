import React, { useEffect, useMemo, useState } from "react";
import PageContainer from "../../components/PageContainer";
import { apiJson } from "../../lib/api";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type AffiliationMini = { affiliation_id: number; name: string };

type ReqRow = {
  request_id: number;
  handler_id: number;
  handler_name: string;
  affiliation: AffiliationMini;
  action: "add" | "remove";
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  request_note?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function SupervisorAffiliationRequestsPage() {
  const [rows, setRows] = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [reviewNote, setReviewNote] = useState<Record<number, string>>({}); // per-row

  async function load() {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const data = await apiJson(`/supervisor/affiliation-requests?status_filter=${status}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function approve(id: number) {
    setErr(null);
    setMsg(null);
    try {
      const note = (reviewNote[id] || "").trim();
      await apiJson(`/supervisor/affiliation-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: note ? JSON.stringify({ review_note: note }) : JSON.stringify({}),
      });
      setMsg("Approved.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Approve failed");
    }
  }

  async function reject(id: number) {
    setErr(null);
    setMsg(null);
    try {
      const note = (reviewNote[id] || "").trim();
      await apiJson(`/supervisor/affiliation-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: note ? JSON.stringify({ review_note: note }) : JSON.stringify({}),
      });
      setMsg("Rejected.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Reject failed");
    }
  }

  const pendingCount = useMemo(() => rows.length, [rows]);

  return (
    <PageContainer>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Affiliation Requests</h1>
          <p className="text-sm text-slate-400">Approve or reject handler affiliation add/remove requests.</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-sm text-slate-100"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:border-slate-500"
          >
            Refresh
          </button>
        </div>
      </div>

      {msg && <div className="mt-3 rounded-xl border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200">{msg}</div>}
      {err && <div className="mt-3 rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{err}</div>}

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-200">
            {status === "pending" ? `Pending (${pendingCount})` : `Requests (${rows.length})`}
          </div>
        </div>

        {loading ? (
          <div className="mt-3 text-sm text-slate-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="mt-3 text-sm text-slate-500">No requests.</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-slate-300">
                  <th className="border-b border-slate-800 p-2">Requested</th>
                  <th className="border-b border-slate-800 p-2">Handler</th>
                  <th className="border-b border-slate-800 p-2">Action</th>
                  <th className="border-b border-slate-800 p-2">Affiliation</th>
                  <th className="border-b border-slate-800 p-2">Note</th>
                  <th className="border-b border-slate-800 p-2">Review</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.request_id} className="text-slate-100">
                    <td className="border-b border-slate-900 p-2 text-slate-300 whitespace-nowrap">
                      {fmtDateTime(r.requested_at)}
                    </td>
                    <td className="border-b border-slate-900 p-2">
                      <div className="font-semibold">{r.handler_name}</div>
                      <div className="text-xs text-slate-500">#{r.handler_id}</div>
                    </td>
                    <td className="border-b border-slate-900 p-2">
                      <span
                        className={classNames(
                          "inline-flex items-center rounded-full border px-2 py-1 text-xs",
                          r.action === "add"
                            ? "border-emerald-800 bg-emerald-950/40 text-emerald-200"
                            : "border-amber-800 bg-amber-950/40 text-amber-200"
                        )}
                      >
                        {r.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="border-b border-slate-900 p-2">{r.affiliation.name}</td>
                    <td className="border-b border-slate-900 p-2 text-slate-300">
                      {r.request_note ? <span className="whitespace-pre-wrap">{r.request_note}</span> : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="border-b border-slate-900 p-2">
                      {status !== "pending" ? (
                        <div className="text-xs text-slate-400">
                          {r.reviewed_at ? `Reviewed ${fmtDateTime(r.reviewed_at)}` : "—"}
                          {r.review_note ? <div className="mt-1 whitespace-pre-wrap text-slate-500">{r.review_note}</div> : null}
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          <input
                            className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2 text-xs text-slate-100"
                            value={reviewNote[r.request_id] || ""}
                            onChange={(e) => setReviewNote((m) => ({ ...m, [r.request_id]: e.target.value }))}
                            placeholder="Optional note…"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => approve(r.request_id)}
                              className="rounded-xl border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200 hover:border-emerald-600"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => reject(r.request_id)}
                              className="rounded-xl border border-rose-800 bg-rose-950/40 px-3 py-2 text-xs text-rose-200 hover:border-rose-600"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  );
}