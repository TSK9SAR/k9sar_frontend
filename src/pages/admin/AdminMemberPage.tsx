import React, { useEffect, useMemo, useState, useRef } from "react";
import { apiJson } from "../../lib/api";
import PageContainer from "../../components/PageContainer";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
// ---------------- Types ----------------
type HandlerSummary = {
  handler_id: number;
  status?: string | null;
};

type AdminUser = {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  phone?: string | null;
  roles: string[];
  role_ids: number[];
  handler?: HandlerSummary | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AdminHandler = {
  handler_id: number;
  user_id: number;
  status?: string | null; // active|suspended|inactive
  experience_level?: string | null;
  group_affiliation?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  // optional embedded user fields (depends on your serializer)
  username?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

type TeamSummary = {
  team_id: number;
  dog_id: number;
  team_name?: string | null;
  dog_name?: string | null;
  status?: string | null;
};

type DogSummary = {
  dog_id: number;
  name?: string | null;
  dog_name?: string | null;
  status?: string | null;
};

type AdminUserBundle = {
  user: AdminUser;
  handler: AdminHandler | null;
  teams: TeamSummary[];
  dogs: DogSummary[];
};

// ---------------- Styling (match your AdminUsersPage) ----------------
const inputClass =
  "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500";
const buttonClass =
  "rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100 hover:bg-slate-700 disabled:opacity-60";
const buttonPrimary =
  "rounded-lg border border-emerald-500/40 bg-emerald-600/15 px-4 py-2 text-emerald-100 hover:bg-emerald-600/25 disabled:opacity-60";
const cardClass = "rounded-xl border border-slate-600 bg-slate-700";
const subCardClass = "rounded-xl border border-slate-700 bg-slate-900/30";
const labelClass = "block text-sm font-medium text-slate-200 mb-1";
const hintClass = "text-xs text-slate-400";

// ---------------- Page ----------------
type TabKey = "member" | "handler" | "teams" | "dogs";

export default function AdminMemberPage() {
  // left-side search
  const [q, setQ] = useState("");
  const [skip, setSkip] = useState(0);
  const [limit, setLimit] = useState(25);
  const [loadingList, setLoadingList] = useState(false);
  const [errorList, setErrorList] = useState<string | null>(null);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // bundle-backed detail
  const [detail, setDetail] = useState<AdminUser | null>(null);
  const [handler, setHandler] = useState<AdminHandler | null>(null);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [dogs, setDogs] = useState<DogSummary[]>([]);

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const usersReqId = useRef(0);
  const memberReqId = useRef(0);


  // ui
  const [tab, setTab] = useState<TabKey>("member");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectedFromList = useMemo(
    () => items.find((u) => u.user_id === selectedUserId) || null,
    [items, selectedUserId]
  );



  const [sp, setSp] = useSearchParams();
  const [hydrated, setHydrated] = useState(false);
  const syncingFromUrlRef = useRef(false);

  const returnTo = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    p.set("skip", String(skip));
    p.set("limit", String(limit));
    if (selectedUserId != null) p.set("uid", String(selectedUserId));
    p.set("tab", tab);
    return `/admin/member?${p.toString()}`;
  }, [q, skip, limit, selectedUserId, tab]);

  // Build a stable returnTo from CURRENT STATE (not from sp)
  useEffect(() => {
    if (!hydrated) return;

    // skip one cycle right after we just hydrated from the URL
    if (syncingFromUrlRef.current) {
      syncingFromUrlRef.current = false;
      return;
    }

    const next = new URLSearchParams(sp);

    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");

    next.set("skip", String(skip));
    next.set("limit", String(limit));

    if (selectedUserId != null) next.set("uid", String(selectedUserId));
    else next.delete("uid");

    next.set("tab", tab);

    setSp(next, { replace: true });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, q, skip, limit, selectedUserId, tab]);


  function handlerLabel(h: AdminHandler | null, u: AdminUser | null) {
    if (!h?.handler_id) return "—";
    const name = `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim() || u?.username || u?.email || "";
    return name ? `${name} (Handler #${h.handler_id})` : `Handler #${h.handler_id}`;
  }


  function fullName(u: AdminUser | null) {
    if (!u) return "";
    return `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.username || u.email || `User ${u.user_id}`;
  }

  // ---------------- API wiring ----------------
  async function apiListUsers() {
    const params = new URLSearchParams();
    const qq = q.trim();
    if (qq) params.set("q", qq);

    params.set("skip", String(skip));
    params.set("limit", String(limit));


    return apiJson(`/admin/users?${params.toString()}`);
  }


  async function apiGetBundle(userId: number): Promise<AdminUserBundle> {
    return apiJson(`/admin/users/${userId}/bundle`);
  }

  async function apiPatchHandler(handlerId: number, patch: Partial<AdminHandler>) {
    return apiJson(`/admin/handlers/${handlerId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  // ---------------- Data loading ----------------
  async function loadUsers() {
    const req = ++usersReqId.current;

    setLoadingList(true);
    setErrorList(null);
    try {
      const data = await apiListUsers();

      // ignore stale responses
      if (req !== usersReqId.current) return;

      const list: AdminUser[] = data.items || [];
      setItems(list);
      setTotal(data.total ?? list.length);

      if (list.length) {
        setSelectedUserId((cur) => {
          if (cur == null) return list[0].user_id;
          if (list.some((u) => u.user_id === cur)) return cur;
          return list[0].user_id;
        });
      } else {
        setSelectedUserId(null);
        clearBundleState();
      }
    } catch (e: any) {
      if (req !== usersReqId.current) return;

      setErrorList(e?.message || "Failed to load members");
      setItems([]);
      setTotal(0);
      setSelectedUserId(null);
      clearBundleState();
    } finally {
      if (req === usersReqId.current) setLoadingList(false);
    }
  }


  function clearBundleState() {
    setDetail(null);
    setHandler(null);
    setTeams([]);
    setDogs([]);
  }

  function teamLabel(t: TeamSummary) {
    const dn = (t.dog_name ?? "").trim();
    if (dn) return `${dn} (Team #${t.team_id})`;
    return `Team #${t.team_id}`;
  }

  async function loadMember(userId: number) {
    const req = ++memberReqId.current;

    setLoadingDetail(true);
    setErrorDetail(null);
    setSaveError(null);
    setSaveMsg(null);

    clearBundleState();

    try {
      const bundle = await apiGetBundle(userId);

      // ignore stale responses
      if (req !== memberReqId.current) return;

      const rawTeams = Array.isArray(bundle.teams) ? bundle.teams : [];
      const rawDogs = Array.isArray(bundle.dogs) ? bundle.dogs : [];

      const hydratedTeams = rawTeams.map((t, i) => ({
        ...t,
        dog_name: t.dog_name ?? rawDogs[i]?.dog_name ?? null,
      }));

      setDetail(bundle.user || null);
      setHandler(bundle.handler || null);
      setTeams(hydratedTeams);
      setDogs(rawDogs);
    } catch (e: any) {
      if (req !== memberReqId.current) return;

      setErrorDetail(e?.message || "Failed to load member bundle");
      clearBundleState();
    } finally {
      if (req === memberReqId.current) setLoadingDetail(false);
    }
  }


  useEffect(() => {
    syncingFromUrlRef.current = true;

    const q0 = sp.get("q") ?? "";
    const skip0 = Number(sp.get("skip") ?? "0") || 0;
    const limit0 = Number(sp.get("limit") ?? "25") || 25;

    const uidRaw = sp.get("uid");
    const uidNum = uidRaw ? Number(uidRaw) : NaN;
    const uid0 = Number.isFinite(uidNum) && uidNum > 0 ? uidNum : null;

    const tab0 = (sp.get("tab") as TabKey) || "member";
    const safeTab: TabKey = (["member", "handler", "teams", "dogs"] as TabKey[]).includes(tab0)
      ? tab0
      : "member";

    setQ(q0);
    setSkip(skip0);
    setLimit(limit0);
    setSelectedUserId(uid0);
    setTab(safeTab);

    setHydrated(true);
  }, [sp]);


  useEffect(() => {
    if (!hydrated) return;
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, skip, limit]);

  useEffect(() => {
    if (!hydrated) return;
    if (selectedUserId != null) loadMember(selectedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, selectedUserId]);


  // ---------------- Actions ----------------
  async function saveHandlerEdits(next: Partial<AdminHandler>) {
    if (!handler?.handler_id) return;
    setSaving(true);
    setSaveError(null);
    setSaveMsg(null);
    try {
      await apiPatchHandler(handler.handler_id, next);
      setSaveMsg("Saved");

      // reload bundle so teams/dogs stay in sync too
      if (selectedUserId != null) await loadMember(selectedUserId);
    } catch (e: any) {
      setSaveError(e?.message || "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 1500);
    }
  }

  const mobileSelected = fullName(detail || selectedFromList);

  return (
    <PageContainer maxWidth="2xl" className="space-y-6 py-6">
      <div className="text-left space-y-4">
        {/* Header */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h1 className="text-lg font-semibold">
            <span className="text-emerald-300">TSK9SAR</span>{" "}
            <span className="text-slate-100">Member / Team / Dog Administration</span>
          </h1>
          <div className="text-xs sm:text-sm text-slate-300">
            {saving ? "Saving…" : saveMsg ? saveMsg : ""}
          </div>
        </div>

        {/* Search Card */}
        <div className={cardClass + " p-4"}>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-4">
              <label className={labelClass}>Search Members</label>
              <input
                className={inputClass}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="First/last, email, username…"
              />
              <div className={hintClass}>Searches users table (admin)</div>
            </div>

            <div className="flex gap-2 lg:flex-col lg:justify-end">
              <button type="button" className={buttonClass + " w-full"} onClick={() => { setSkip(0); loadUsers() }} disabled={loadingList}>
                {loadingList ? "Loading…" : "Search"}
              </button>
              <Link className={buttonClass + " w-full text-center"} to="/admin/invites">

                Invite New User
              </Link>
            </div>
          </div>

          {errorList && (
            <div className="mt-3 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-red-200 text-sm">
              {errorList}
            </div>
          )}
        </div>

        {/* Mobile: selected banner */}
        <div className={cardClass + " p-3 border lg:hidden"}>
          <div className="text-xs text-slate-400">Selected member</div>
          <div className="text-sm font-medium text-slate-100 truncate">{mobileSelected || "—"}</div>
          <div className="text-xs text-slate-300 truncate">{detail?.email || selectedFromList?.email || ""}</div>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left list */}
          <div className={cardClass}>
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3 gap-2">
              <div className="text-sm text-slate-200">
                <span className="font-medium">Members</span>{" "}
                <span className="text-slate-400">({total})</span>
                <span className="ml-2 text-xs text-slate-400">
                  {total > 0 ? `${skip + 1}–${Math.min(skip + items.length, total)}` : ""}
                </span>
              </div>

              <div className="flex flex-wrap items-left gap-2 w-[90px]">
                <select
                  className={inputClass + " !py-1 !px-2 text-xs"}
                  value={String(limit)}
                  onChange={(e) => {
                    setSkip(0);
                    setLimit(Number(e.target.value) || 25);
                  }}
                  disabled={loadingList}
                  title="Page size"
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>

                {/* Force these to sit below the select when space is tight */}
                <div className="flex items-center gap-2 basis-full sm:basis-auto">
                  <button
                    type="button"
                    className={buttonClass + " !py-1 !px-2 text-xs"}
                    disabled={loadingList || skip === 0}
                    onClick={() => setSkip((s) => Math.max(0, s - limit))}
                  >
                    Prev
                  </button>

                  <button
                    type="button"
                    className={buttonClass + " !py-1 !px-2 text-xs"}
                    disabled={loadingList || skip + items.length >= total}
                    onClick={() => setSkip((s) => s + limit)}
                  >
                    Next
                  </button>

                  <div className="text-xs text-slate-400 w-[72px] text-right">
                    {loadingList ? "Loading…" : ""}
                  </div>
                </div>
              </div>

            </div>


            <div className="max-h-[40vh] lg:max-h-[70vh] overflow-auto">
              {items.map((u) => {
                const activeRow = u.user_id === selectedUserId;
                const handlerBadge = u.handler?.handler_id ? (u.handler.status || "—") : "No Dog Teams";

                return (
                  <button
                    key={u.user_id}
                    type="button"
                    onClick={() => setSelectedUserId(u.user_id)}
                    className={[
                      "w-full text-left px-4 py-3 border-b bg-slate-900/30 border-slate-700 transition-colors",
                      activeRow ? "bg-slate-700" : "hover:bg-slate-600",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100 truncate">{fullName(u)}</div>
                        <div className="text-xs text-slate-300 truncate">{u.email} · {u.username}</div>
                        <div className="text-xs text-slate-400 truncate">
                          roles: {u.roles?.join(", ") || "—"}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] text-slate-200">
                        {handlerBadge}
                      </span>
                    </div>
                  </button>
                );
              })}
              {!loadingList && items.length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-300">No members found.</div>
              )}
            </div>
          </div>

          {/* Right detail */}
          <div className={cardClass + " lg:col-span-2"}>
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <div className="text-sm font-medium text-slate-200">Member Form</div>
              <div className="text-xs text-slate-400">{loadingDetail ? "Loading…" : ""}</div>
            </div>

            {(errorDetail || saveError) && (
              <div className="p-4 space-y-2">
                {errorDetail && <ErrBox msg={errorDetail} />}
                {saveError && <ErrBox msg={saveError} />}
              </div>
            )}

            <div className="p-4 space-y-4">
              {!detail && !loadingDetail && (
                <div className="text-sm text-slate-300">Select a member to view/edit.</div>
              )}

              {detail && (
                <>
                  {/* Tabs */}
                  <div className="flex flex-wrap gap-2">
                    <TabButton active={tab === "member"} onClick={() => setTab("member")}>Member</TabButton>
                    <TabButton active={tab === "handler"} onClick={() => setTab("handler")}>Handler</TabButton>
                    <TabButton active={tab === "teams"} onClick={() => setTab("teams")}>
                      Teams <span className="text-slate-300">({teams.length})</span>
                    </TabButton>
                    <TabButton active={tab === "dogs"} onClick={() => setTab("dogs")}>
                      Dogs <span className="text-slate-300">({dogs.length})</span>
                    </TabButton>
                  </div>

                  {/* Content */}
                  {tab === "member" && (
                    <div className={subCardClass + " p-4 space-y-4"}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ReadField label="First name" value={detail.first_name} />
                        <ReadField label="Last name" value={detail.last_name} />
                        <ReadField label="Username" value={detail.username} />
                        <ReadField label="Email" value={detail.email} />
                        <ReadField label="Phone" value={detail.phone || "—"} />
                        <ReadField label="Roles" value={detail.roles?.join(", ") || "—"} />
                      </div>

                      <div className="text-xs text-slate-400">
                        user_id: {detail.user_id} · created_at: {detail.created_at || "—"} · updated_at: {detail.updated_at || "—"}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Link className={buttonClass + " text-center"} to="/admin/user">
                          Back to User Admin
                        </Link>

                        {/* <Link className={buttonClass + " text-center"} to="/admin/invites">
                          Invite New User
                        </Link> */}
                      </div>
                    </div>
                  )}

                  {tab === "handler" && (
                    <div className={subCardClass + " p-4 space-y-4"}>
                      {!handler && (
                        <div className="text-sm text-slate-300">
                          This user has no dog teams.
                          <div className={hintClass}>Create-handler action can be added once the backend route exists.</div>
                        </div>
                      )}

                      {handler && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <ReadField label="Handler" value={handlerLabel(handler, detail)} />


                            <div>
                              <label className={labelClass}>Status</label>
                              <select
                                className={inputClass}
                                value={(handler.status || "").toLowerCase()}
                                onChange={(e) => setHandler((prev) => (prev ? { ...prev, status: e.target.value } : prev))}
                              >
                                <option value="">—</option>
                                <option value="active">active</option>
                                <option value="suspended">suspended</option>
                                <option value="inactive">inactive</option>
                              </select>
                            </div>

                            <div className="sm:col-span-2">
                              <label className={labelClass}>Experience level</label>
                              <input
                                className={inputClass}
                                value={handler.experience_level || ""}
                                onChange={(e) => setHandler((prev) => (prev ? { ...prev, experience_level: e.target.value } : prev))}
                                placeholder="e.g. intermediate"
                              />
                            </div>
                            {/* <div className="sm:col-span-2">
                              <label className={labelClass}>Group Affiliation</label>
                              <input
                                className={inputClass}
                                value={handler.group_affiliation || ""}
                                onChange={(e) => setHandler((prev) => (prev ? { ...prev, group_affiliation: e.target.value } : prev))}
                                placeholder="TSK9SAR group, etc."
                              />
                            </div> */}
                            <div className="sm:col-span-2">
                              <label className={labelClass}>Notes</label>
                              <textarea
                                className={inputClass + " min-h-[110px]"}
                                value={handler.notes || ""}
                                onChange={(e) => setHandler((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                                placeholder="Admin notes…"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              type="button"
                              className={buttonPrimary}
                              disabled={saving}
                              onClick={() =>
                                saveHandlerEdits({
                                  status: handler.status || null,
                                  experience_level: handler.experience_level || null,
                                  group_affiliation: handler.group_affiliation || null,
                                  notes: handler.notes || null,
                                })
                              }
                            >
                              Save handler
                            </button>


                            <Link
                              className={buttonClass + " text-center"}
                              to={`/admin/handlers/${handler.handler_id}`}
                              state={{ returnTo }}
                            >
                              Open handler page
                            </Link>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {tab === "teams" && (
                    <div className={subCardClass + " p-4 space-y-3"}>
                      <div className="text-sm text-slate-200 font-medium">Teams</div>

                      {teams.length === 0 ? (
                        <div className="text-sm text-slate-300">No teams for this member.</div>
                      ) : (
                        <div className="space-y-2">
                          {teams.map((t) => (
                            <div key={t.team_id} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
                              <div className="flex items-center justify-between">
                                <div className="text-sm text-slate-100 font-medium truncate">
                                  {teamLabel(t)}
                                </div>
                                <Link
                                  className="text-xs text-emerald-200 hover:underline"
                                  to={`/admin/teams/${t.team_id}`}
                                  state={{ returnTo }}
                                >
                                  Open
                                </Link>

                              </div>
                              <div className="text-xs text-slate-400">status: {t.status || "—"}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {tab === "dogs" && (
                    <div className={subCardClass + " p-4 space-y-3"}>
                      <div className="text-sm text-slate-200 font-medium">Dogs</div>

                      {dogs.length === 0 ? (
                        <div className="text-sm text-slate-300">No dogs for this member.</div>
                      ) : (
                        <div className="space-y-2">
                          {dogs.map((d) => (
                            <div key={d.dog_id} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
                              <div className="flex items-center justify-between">
                                <div className="text-sm text-slate-100 font-medium truncate">
                                  {d.dog_name || `Dog ${d.dog_id}`}
                                </div>
                                <Link
                                  className="text-xs text-emerald-200 hover:underline"
                                  to={`/admin/dogs/${d.dog_id}`}
                                  state={{ returnTo }}
                                >
                                  Open
                                </Link>


                              </div>
                              <div className="text-xs text-slate-400">status: {d.status || "—"}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

// ---------------- Small components ----------------
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-2 rounded-lg border text-sm transition-colors",
        active
          ? "border-emerald-500/40 bg-emerald-600/15 text-emerald-100"
          : "border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700",
      ].join(" ")}
    >
      {children}
    </button>
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
