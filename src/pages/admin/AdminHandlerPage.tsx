import React, { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../lib/api";
import PageContainer from "../../components/PageContainer";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import GroupAffiliationsCard from "../../components/handler/GroupAffiliationsCard";

type AdminHandler = {
  handler_id: number;
  user_id: number;
  status?: string | null;
  experience_level?: string | null;
  group_affiliation?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  // optional embedded user fields
  username?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

function errToText(e: any): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;


  if (typeof e?.detail === "string") return e.detail;

  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return String(e);
  }
}

const inputClass =
  "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500";
const buttonClass =
  "rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-800";

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

function getReturnTo(search: string, fallback: string) {
  const p = new URLSearchParams(search);
  const raw = p.get("returnTo");
  if (!raw) return fallback;

  const decoded = decodeURIComponent(raw);

  // IMPORTANT: only allow internal paths
  if (decoded.startsWith("/")) return decoded;
  return fallback;
}



export default function AdminHandlerPage() {
  const params = useParams();
  const handlerId = useMemo(() => Number(params.handlerId), [params.handlerId]);

  const [nav, setNav] = useState<{ prev_id: number | null; next_id: number | null } | null>(null);
  const [loadingNav, setLoadingNav] = useState(false);

  const [data, setData] = useState<AdminHandler | null>(null);
  const [draft, setDraft] = useState<AdminHandler | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  const returnTo = useMemo(() => {
    const st = location.state as any;
    if (st?.returnTo && typeof st.returnTo === "string" && st.returnTo.startsWith("/")) return st.returnTo;

    const p = new URLSearchParams(location.search);
    const rt = p.get("returnTo");
    if (rt && rt.startsWith("/")) return rt;

    return null;
  }, [location.state, location.search]);



  // -----------------------------
  // Members list (paginated)
  // -----------------------------
  type AdminMember = {
    user_id: number;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    username?: string | null;
  };

  const [memberQ, setMemberQ] = useState("");
  const [memberSkip, setMemberSkip] = useState(0);
  const [memberLimit, setMemberLimit] = useState(25);

  const [members, setMembers] = useState<AdminMember[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  function memberLabel(u: AdminMember) {
    const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
    return name || u.username || u.email || `User ${u.user_id}`;
  }

  function buildMembersParams() {
    const p = new URLSearchParams();
    const qq = memberQ.trim();
    if (qq) p.set("q", qq);
    p.set("skip", String(memberSkip));
    p.set("limit", String(memberLimit));
    return p;
  }

  async function loadMembers() {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const p = buildMembersParams();
      const res = await apiJson(`/admin/users?${p.toString()}`);
      const list: AdminMember[] = res?.items || [];
      setMembers(list);
      setMembersTotal(res?.total ?? list.length);
    } catch (e: any) {
      setMembersError(errToText(e) || "Failed to load members");
      setMembers([]);
      setMembersTotal(0);
    } finally {
      setMembersLoading(false);
    }
  }

  // reload members when paging changes
  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberSkip, memberLimit]);

  // reset to first page when search changes
  useEffect(() => {
    setMemberSkip(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberQ]);

  async function load() {
    if (!Number.isFinite(handlerId) || handlerId <= 0) {
      setError("Invalid handler id");
      return;
    }
    setLoading(true);
    setError(null);
    setSaveError(null);
    try {
      const res = (await apiJson(`/admin/handlers/${handlerId}`)) as AdminHandler;
      setData(res);
      setDraft(res);
    } catch (e: any) {
      setError(errToText(e) || "Failed to load handler");
      setData(null);
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }
  async function loadPrevNext() {
    if (!Number.isFinite(handlerId) || handlerId <= 0) return;
    setLoadingNav(true);
    try {
      // Backend should return { prev_id, next_id } for active handlers (or all handlers)
      const res = await apiJson(`/admin/handlers/${handlerId}/neighbors`);
      setNav({
        prev_id: res?.prev_id ?? null,
        next_id: res?.next_id ?? null,
      });
    } catch {
      // If route not implemented yet, silently ignore
      setNav(null);
    } finally {
      setLoadingNav(false);
    }
  }

  useEffect(() => {
    load();
    loadPrevNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlerId]);

  function setField<K extends keyof AdminHandler>(key: K, value: AdminHandler[K]) {
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
        experience_level: draft.experience_level ?? null,
        group_affiliation: draft.group_affiliation ?? null,
        notes: draft.notes ?? null,
      };
      await apiJson(`/admin/handlers/${handlerId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setSaveMsg("Saved");
      await load();
    } catch (e: any) {
      setSaveError(errToText(e) || "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 1500);
    }
  }

  const title = data
    ? `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || data.username || `Handler ${data.handler_id}`
    : `Handler ${handlerId || ""}`;

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-4xl text-left space-y-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h1 className="text-lg font-semibold">
            <span className="text-emerald-300">TSK9SAR</span>{" "}
            <span className="text-slate-100">Handler Admin</span>
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
              <div className="text-xs text-slate-400">Handler</div>
              <div className="text-sm sm:text-base font-semibold text-slate-100 truncate">{title}</div>
              {data?.email && <div className="text-xs text-slate-300 truncate">{data.email}</div>}
            </div>
            <div className="text-xs text-slate-400">
              {/* nav: prev={nav?.prev_id ?? "—"} next={nav?.next_id ?? "—"} */}
              {loadingNav ? " (loading…)" : ""}
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
              <ReadField label="handler_id" value={data ? String(data.handler_id) : "—"} />
              <ReadField label="user_id" value={data ? String(data.user_id) : "—"} />

              <div>
                <label className={labelClass}>Status</label>
                <select
                  className={inputClass}
                  value={(draft?.status || "").toLowerCase()}
                  onChange={(e) => setField("status", e.target.value)}
                  disabled={!draft}
                >
                  <option value="">—</option>
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Experience level</label>
                <input
                  className={inputClass}
                  value={draft?.experience_level || ""}
                  onChange={(e) => setField("experience_level", e.target.value)}
                  placeholder="e.g. intermediate"
                  disabled={!draft}
                />
              </div>
              <div className="sm:col-span-2">
                {/* <div>
                  <label className={labelClass}>Group Affiliation</label>
                  <input
                    className={inputClass}
                    value={draft?.group_affiliation || ""}
                    onChange={(e) => setField("group_affiliation", e.target.value)}
                    placeholder="SAR Group, etc."
                    disabled={!draft}
                  />
                </div> */}
                <div className="space-y-4">
                  {typeof handlerId === "number" && (
                    <GroupAffiliationsCard handlerId={handlerId} />
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Notes</label>
                <textarea
                  className={inputClass + " min-h-[140px]"}
                  value={draft?.notes || ""}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="Admin notes…"
                  disabled={!draft}
                />
              </div>
            </div>

            <div className="text-xs text-slate-400">
              created_at: {data?.created_at || "—"} · updated_at: {data?.updated_at || "—"}
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
    <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-red-200 text-sm whitespace-pre-wrap">
      {msg}
    </div>
  );
}
