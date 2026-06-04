import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { apiJson } from "../../lib/api";
import PageContainer from "../../components/PageContainer";

type AdminDog = {
  dog_id: number;
  name?: string | null;
  breed?: string | null;
  sex?: string | null;
  dob?: string | null;
  photo_url?: string | null;
  created_at?: string | null;
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

function getReturnTo(search: string, fallback: string) {
  const p = new URLSearchParams(search);
  const raw = p.get("returnTo");
  if (!raw) return fallback;

  const decoded = decodeURIComponent(raw);

  // IMPORTANT: only allow internal paths
  if (decoded.startsWith("/")) return decoded;
  return fallback;
}


function selfUrlWithoutReturnTo(pathname: string, search: string): string {
  const p = new URLSearchParams(search);
  p.delete("returnTo");
  const qs = p.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}


export default function AdminDogPage() {
  const params = useParams();
  const dogId = useMemo(() => Number(params.dogId), [params.dogId]);

  const location = useLocation();
  const navigate = useNavigate();

  const returnTo = useMemo(() => {
    // Prefer router state (new way)
    const st = location.state as any;
    if (st?.returnTo && typeof st.returnTo === "string" && st.returnTo.startsWith("/")) return st.returnTo;

    // Back-compat: allow ?returnTo=... (old way)
    const p = new URLSearchParams(location.search);
    const rt = p.get("returnTo");
    if (rt && rt.startsWith("/")) return rt;

    return null;
  }, [location.state, location.search]);


  const [data, setData] = useState<AdminDog | null>(null);
  const [draft, setDraft] = useState<AdminDog | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function load() {
    if (!Number.isFinite(dogId) || dogId <= 0) {
      setError("Invalid dog id");
      return;
    }
    setLoading(true);
    setError(null);
    setSaveError(null);
    try {
      const res = (await apiJson(`/admin/dogs/${dogId}`)) as AdminDog;
      setData(res);
      setDraft(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load dog");
      setData(null);
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dogId]);

  function setField<K extends keyof AdminDog>(key: K, value: AdminDog[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    try {
      const patch = {
        name: draft.name ?? null,
        breed: draft.breed ?? null,
        sex: draft.sex ?? null,
        dob: draft.dob ?? null,
        photo_url: draft.photo_url ?? null,
      };
      await apiJson(`/admin/dogs/${dogId}`, {
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

  const title = data?.name || (data ? `Dog ${data.dog_id}` : `Dog ${dogId || ""}`);

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-4xl text-left space-y-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h1 className="text-lg font-semibold">
            <span className="text-emerald-300">TSK9SAR</span>{" "}
            <span className="text-slate-100">Dog Admin</span>
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
              <div className="text-xs text-slate-400">Dog</div>
              <div className="text-sm sm:text-base font-semibold text-slate-100 truncate">{title}</div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button className={buttonPrimary} disabled={!draft || saving} onClick={save}>
                Save
              </button>
              <button className={buttonClass} disabled={saving} onClick={load}>
                Reload
              </button>

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
              <ReadField label="dog_id" value={data ? String(data.dog_id) : "—"} />

              <div className="sm:col-span-1">
                <label className={labelClass}>Name</label>
                <input
                  className={inputClass}
                  value={draft?.name || ""}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Dog name"
                  disabled={!draft}
                />
              </div>

              <div>
                <label className={labelClass}>Breed</label>
                <input
                  className={inputClass}
                  value={draft?.breed || ""}
                  onChange={(e) => setField("breed", e.target.value)}
                  placeholder="Breed"
                  disabled={!draft}
                />
              </div>

              <div>
                <label className={labelClass}>Sex</label>
                <input
                  className={inputClass}
                  value={draft?.sex || ""}
                  onChange={(e) => setField("sex", e.target.value)}
                  placeholder="M/F"
                  disabled={!draft}
                />
              </div>

              <div>
                <label className={labelClass}>DOB</label>
                <input
                  className={inputClass}
                  value={draft?.dob || ""}
                  onChange={(e) => setField("dob", e.target.value)}
                  placeholder="YYYY-MM-DD"
                  disabled={!draft}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass}>Photo URL</label>
                <input
                  className={inputClass}
                  value={draft?.photo_url || ""}
                  onChange={(e) => setField("photo_url", e.target.value)}
                  placeholder="https://…"
                  disabled={!draft}
                />
                {draft?.photo_url ? (
                  <div className="mt-2">
                    <a className="text-xs text-emerald-200 hover:underline" href={draft.photo_url} target="_blank" rel="noreferrer">
                      Open photo
                    </a>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="text-xs text-slate-400">created_at: {data?.created_at || "—"}</div>
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
