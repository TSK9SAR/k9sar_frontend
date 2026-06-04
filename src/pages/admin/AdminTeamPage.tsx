import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { apiJson } from "../../lib/api";
import PageContainer from "../../components/PageContainer";

type AdminTeam = {
  team_id: number;
  handler_id: number;
  dog_id: number;
  status?: string | null;

  // optional pretty fields if backend includes them later
  team_name?: string | null;
};

const inputClass =
  "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500";
const buttonClass =
  "rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100 hover:bg-slate-700 disabled:opacity-60";
const buttonPrimary =
  "rounded-lg border border-emerald-500/40 bg-emerald-600/15 px-4 py-2 text-emerald-100 hover:bg-emerald-600/25 disabled:opacity-60";
const cardClass = "rounded-xl border border-slate-600 bg-slate-700";
const subCardClass = "rounded-xl border border-slate-700 bg-slate-900/30";
const labelClass = "block text-sm font-medium text-slate-200 mb-1";

function safeReturnTo(search: string): string | null {
  const p = new URLSearchParams(search);
  const rt = p.get("returnTo"); // already decoded by URLSearchParams
  if (!rt) return null;

  // Only allow internal app paths
  if (!rt.startsWith("/")) return null;

  return rt;
}

function selfUrlWithoutReturnTo(pathname: string, search: string): string {
  const p = new URLSearchParams(search);
  p.delete("returnTo");
  const qs = p.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}


export default function AdminTeamPage() {
  const params = useParams();
  const teamId = useMemo(() => Number(params.teamId), [params.teamId]);

  const location = useLocation();
  const navigate = useNavigate();

  const returnTo = useMemo(() => {
    // preferred: query string ?returnTo=/admin/member?... (encoded)
    const rtFromQuery = safeReturnTo(location.search);
    if (rtFromQuery) return rtFromQuery;

    // optional fallback: location.state.returnTo (if you ever use navigate(..., {state}))
    const st = location.state as any;
    if (st?.returnTo && typeof st.returnTo === "string" && st.returnTo.startsWith("/")) return st.returnTo;

    return null;
  }, [location.search, location.state]);




  const [data, setData] = useState<AdminTeam | null>(null);
  const [draft, setDraft] = useState<AdminTeam | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);



  async function load() {
    if (!Number.isFinite(teamId) || teamId <= 0) {
      setError("Invalid team id");
      return;
    }
    setLoading(true);
    setError(null);
    setSaveError(null);
    try {
      const res = (await apiJson(`/admin/teams/${teamId}`)) as AdminTeam;
      setData(res);
      setDraft(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load team");
      setData(null);
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  function setField<K extends keyof AdminTeam>(key: K, value: AdminTeam[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    try {
      const patch = {
        status: draft.status ?? null,
      };
      await apiJson(`/admin/teams/${teamId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setSaveMsg("Saved");
      await load();
    } catch (e: any) {
      setSaveError(e?.message || "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 1500);
    }
  }

  const title = data?.team_name || (data ? `Team ${data.team_id}` : `Team ${teamId || ""}`);

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-4xl text-left space-y-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h1 className="text-lg font-semibold">
            <span className="text-emerald-300">TSK9SAR</span>{" "}
            <span className="text-slate-100">Team Admin</span>
          </h1>
          <div className="text-xs sm:text-sm text-slate-300">
            {saving ? "Saving…" : saveMsg ? saveMsg : loading ? "Loading…" : ""}
          </div>
        </div>

        {(error || saveError) && (
          <div className={cardClass + " p-4 space-y-2"}>
            {error && <ErrBox msg={error} />}
            {saveError && <ErrBox msg={saveError} />}
          </div>
        )}

        <div className={cardClass + " p-4 space-y-4"}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-slate-400">Team</div>
              <div className="text-sm sm:text-base font-semibold text-slate-100 truncate">{title}</div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button className={buttonPrimary} disabled={!draft || saving} onClick={save}>
                Save
              </button>
              <button className={buttonClass} disabled={saving} onClick={load}>
                Reload
              </button>

              {/* ✅ Back uses returnTo when present */}
              <button
                type="button"
                className={buttonClass}
                onClick={() => navigate(returnTo ?? "/admin/member")}
              >
                Return
              </button>


            </div>
          </div>

          <div className={subCardClass + " p-4 space-y-4"}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReadField label="team_id" value={data ? String(data.team_id) : "—"} />
              <ReadField label="handler_id" value={data ? String(data.handler_id) : "—"} />
              <ReadField label="dog_id" value={data ? String(data.dog_id) : "—"} />

              <div className="sm:col-span-2">
                <label className={labelClass}>Status</label>
                <select
                  className={inputClass}
                  value={draft?.status || "active"}
                  onChange={(e) => setField("status", e.target.value)}
                  disabled={!draft}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {data?.handler_id ? (
                <Link
                  className={buttonClass + " text-center"}
                  to={`/admin/handlers/${data.handler_id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
                >
                  Open handler
                </Link>
              ) : null}
              {data?.dog_id ? (
                <Link
                  className={buttonClass + " text-center"}
                  to={`/admin/dogs/${data.dog_id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
                >
                  Open dog
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm sm:text-base font-medium text-slate-100 break-words">{value}</div>
    </div>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-red-200 text-sm">
      {msg}
    </div>
  );
}
