import React, { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../lib/api";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type AffiliationMini = { affiliation_id: number; name: string };

type Membership = {
  affiliation: AffiliationMini;
  started_at: string;
  ended_at?: string | null;
  note?: string | null;
};

type AffiliationsResp = {
  current: Membership[];
  past: Membership[];
};

type Affiliation = {
  affiliation_id: number;
  name: string;
  is_active?: boolean;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export default function HandlerAffiliationsCard() {
  const [data, setData] = useState<AffiliationsResp | null>(null);
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [loading, setLoading] = useState(true);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // request modal
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<"add" | "remove">("add");
  const [affId, setAffId] = useState<number | "">("");
  const [note, setNote] = useState("");

  const currentIds = useMemo(
    () => new Set((data?.current ?? []).map((m) => m.affiliation.affiliation_id)),
    [data]
  );

  async function reload() {
    setLoading(true);
    setErr(null);
    try {
      const a = await apiJson<AffiliationsResp>("/handlers/me/affiliations");
      setData(a);

      const list = await apiJson<Affiliation[]>("/public/affiliations", {
        authRequired: true,
        mfaRequired: false,
      });
      setAffiliations(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load affiliations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const activeAffiliations = useMemo(
    () => affiliations.filter((x) => x.is_active !== false).sort((a, b) => a.name.localeCompare(b.name)),
    [affiliations]
  );

  const addOptions = useMemo(
    () => activeAffiliations.filter((a) => !currentIds.has(a.affiliation_id)),
    [activeAffiliations, currentIds]
  );

  const removeOptions = useMemo(
    () => activeAffiliations.filter((a) => currentIds.has(a.affiliation_id)),
    [activeAffiliations, currentIds]
  );

  async function submitRequest() {
    setErr(null);
    setMsg(null);

    if (!affId) {
      setErr("Select an affiliation.");
      return;
    }

    try {
      await apiJson("/handlers/me/affiliation-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliation_id: Number(affId),
          action,
          note: note.trim() ? note.trim() : undefined,
        }),
      });

      setMsg("Request sent. A supervisor will review it.");
      setOpen(false);
      setAffId("");
      setNote("");
      await reload();
    } catch (e: any) {
      setErr(e?.message || "Request failed");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Affiliations</h3>
          <p className="text-sm text-slate-400">
            Request additions/removals. Supervisors (scoped) approve or reject.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setAction("add");
            setAffId("");
            setNote("");
            setOpen(true);
          }}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:border-slate-500"
        >
          Request change
        </button>
      </div>

      {msg && (
        <div className="mt-3 rounded-xl border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200">
          {msg}
        </div>
      )}
      {err && (
        <div className="mt-3 rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">
          {err}
        </div>
      )}

      <div className="mt-4">
        <div className="text-sm font-medium text-slate-200">Current</div>

        {loading ? (
          <div className="mt-2 text-sm text-slate-400">Loading…</div>
        ) : (data?.current?.length ?? 0) === 0 ? (
          <div className="mt-2 text-sm text-slate-500">No current affiliations.</div>
        ) : (
          <ul className="mt-2 space-y-2">
            {data!.current.map((m) => (
              <li
                key={m.affiliation.affiliation_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-100">{m.affiliation.name}</div>
                  <div className="text-xs text-slate-400">Since {fmtDate(m.started_at)}</div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAction("remove");
                    setAffId(m.affiliation.affiliation_id);
                    setNote("Request removal");
                    setOpen(true);
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:border-slate-500"
                >
                  Request removal
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer select-none text-sm font-medium text-slate-200">Past</summary>
        {(data?.past?.length ?? 0) === 0 ? (
          <div className="mt-2 text-sm text-slate-500">No past affiliations.</div>
        ) : (
          <ul className="mt-2 space-y-2">
            {data!.past.map((m) => (
              <li
                key={`${m.affiliation.affiliation_id}-${m.started_at}`}
                className="rounded-xl border border-slate-800 bg-slate-900/20 p-3"
              >
                <div className="text-sm font-semibold text-slate-100">{m.affiliation.name}</div>
                <div className="text-xs text-slate-400">
                  {fmtDate(m.started_at)} → {fmtDate(m.ended_at ?? null)}
                </div>
                {m.note ? <div className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{m.note}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </details>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-100">Request affiliation change</div>
                <div className="text-sm text-slate-400">Supervisors/admins will approve or reject.</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-800 px-3 py-1 text-sm text-slate-200 hover:border-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs text-slate-400">Action</span>
                <select
                  className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-sm text-slate-100"
                  value={action}
                  onChange={(e) => {
                    const a = e.target.value as "add" | "remove";
                    setAction(a);
                    setAffId("");
                  }}
                >
                  <option value="add">Add</option>
                  <option value="remove">Remove</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-slate-400">Affiliation</span>
                <select
                  className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-sm text-slate-100"
                  value={affId}
                  onChange={(e) => setAffId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Select…</option>
                  {(action === "add" ? addOptions : removeOptions).map((a) => (
                    <option key={a.affiliation_id} value={a.affiliation_id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-slate-400">Note (optional)</span>
                <textarea
                  className="min-h-[80px] rounded-xl border border-slate-800 bg-slate-900 p-2 text-sm text-slate-100"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why are you requesting this change?"
                />
              </label>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!affId}
                  onClick={submitRequest}
                  className={classNames(
                    "rounded-xl border px-3 py-2 text-sm",
                    affId
                      ? "border-emerald-700 bg-emerald-950/40 text-emerald-200 hover:border-emerald-500"
                      : "border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed"
                  )}
                >
                  Submit request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}