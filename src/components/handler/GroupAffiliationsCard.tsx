import React, { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../lib/api";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type Affiliation = {
  affiliation_id: number;
  name: string;
  is_active?: boolean;
};

type Membership = {
  affiliation: { affiliation_id: number; name: string };
  started_at: string;
  ended_at?: string | null;
  note?: string | null;
};

type HandlerAffiliationsResponse = {
  current: Membership[];
  past: Membership[];
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export default function GroupAffiliationsCard({ handlerId }: { handlerId: number }) {
  const [data, setData] = useState<HandlerAffiliationsResponse | null>(null);
  const [allAffiliations, setAllAffiliations] = useState<Affiliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [addAffId, setAddAffId] = useState<number | "">("");
  const [addNote, setAddNote] = useState("");

  const [endNote, setEndNote] = useState<Record<number, string>>({});

  const currentIds = useMemo(() => {
    const s = new Set<number>();
    (data?.current ?? []).forEach((m) => s.add(m.affiliation.affiliation_id));
    return s;
  }, [data]);

  const addOptions = useMemo(() => {
    return (allAffiliations ?? [])
      .filter((a) => a.is_active !== false)
      .filter((a) => !currentIds.has(a.affiliation_id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allAffiliations, currentIds]);

  async function reload() {
    if (!handlerId) return;
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const memberships = await apiJson<HandlerAffiliationsResponse>(`/admin/handlers/${handlerId}/affiliations`, {
  authRequired: true,
  mfaRequired: false,
});
      setData(memberships);

      // active list for dropdown (if your public endpoint is filtered, admin can use it too)
      const affs = await apiJson<Affiliation[]>("/public/affiliations", {
        authRequired: true,
        mfaRequired: false,
      });
      setAllAffiliations(Array.isArray(affs) ? affs : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load affiliations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlerId]);

  async function addAffiliation() {
    setErr(null);
    setMsg(null);

    if (!addAffId) {
      setErr("Select an affiliation to add.");
      return;
    }

    setBusy(true);
    try {
      await apiJson(`/admin/handlers/${handlerId}/affiliations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliation_id: Number(addAffId),
          note: addNote.trim() ? addNote.trim() : undefined,
        }),
      });
      setAddAffId("");
      setAddNote("");
      setMsg("Affiliation added.");
      await reload();
    } catch (e: any) {
      setErr(e?.message || "Failed to add affiliation");
    } finally {
      setBusy(false);
    }
  }

  async function endAffiliation(affiliationId: number) {
    setErr(null);
    setMsg(null);

    const note = (endNote[affiliationId] || "").trim();

    if (!window.confirm("End this affiliation for the handler?")) return;

    setBusy(true);
    try {
      await apiJson(`/admin/handlers/${handlerId}/affiliations/${affiliationId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || undefined }),
      });
      setEndNote((p) => {
        const n = { ...p };
        delete n[affiliationId];
        return n;
      });
      setMsg("Affiliation ended.");
      await reload();
    } catch (e: any) {
      setErr(e?.message || "Failed to end affiliation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Affiliations</h3>
          <p className="text-sm text-slate-400">
            Admin-only direct edits. This bypasses request/approval workflow.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading || busy}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:border-slate-500 disabled:opacity-60"
        >
          Refresh
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

      {/* Add */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/30 p-3">
        <div className="text-sm font-medium text-slate-200">Add affiliation</div>

        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <select
            className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2 text-sm text-slate-100"
            value={addAffId}
            onChange={(e) => setAddAffId(e.target.value ? Number(e.target.value) : "")}
            disabled={busy}
          >
            <option value="">Select…</option>
            {addOptions.map((a) => (
              <option key={a.affiliation_id} value={a.affiliation_id}>
                {a.name}
              </option>
            ))}
          </select>

          <input
            className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2 text-sm text-slate-100"
            placeholder="Note (optional)"
            value={addNote}
            onChange={(e) => setAddNote(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={addAffiliation}
            disabled={busy || !addAffId}
            className={classNames(
              "rounded-xl border px-3 py-2 text-sm",
              addAffId && !busy
                ? "border-emerald-700 bg-emerald-950/40 text-emerald-200 hover:border-emerald-500"
                : "border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed"
            )}
          >
            {busy ? "Working…" : "Add"}
          </button>
        </div>
      </div>

      {/* Current */}
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
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{m.affiliation.name}</div>
                    <div className="text-xs text-slate-400">Since {fmtDate(m.started_at)}</div>
                    {m.note ? <div className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{m.note}</div> : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => endAffiliation(m.affiliation.affiliation_id)}
                    disabled={busy}
                    className="rounded-xl border border-rose-800 bg-rose-950/40 px-3 py-2 text-xs text-rose-200 hover:border-rose-600 disabled:opacity-60"
                  >
                    End
                  </button>
                </div>

                <div className="mt-2">
                  <input
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 p-2 text-sm text-slate-100"
                    placeholder="End note (optional)"
                    value={endNote[m.affiliation.affiliation_id] || ""}
                    onChange={(e) =>
                      setEndNote((p) => ({ ...p, [m.affiliation.affiliation_id]: e.target.value }))
                    }
                    disabled={busy}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Past */}
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
    </div>
  );
}