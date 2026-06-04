import React, { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../lib/api";
import PageContainer from "../../components/PageContainer";
import { Link } from "react-router-dom";

type HandlerSummary = {
  handler_id: number;
  status?: string | null; // active|suspended|inactive
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
  is_active: boolean;
};

type Role = {
  role_id: number;
  role_name: string;
};

const inputClass =
  "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500";
const buttonClass =
  "rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100 hover:bg-slate-700 disabled:opacity-60";
const cardClass = "rounded-xl border border-slate-600 bg-slate-700";

type CurrentUser = {
  user_id: number;
  roles: string[];
};

export default function AdminUsersPage() {
  // filters
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("");
  const [handlerStatus, setHandlerStatus] = useState<string>("");

  // list
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loadingList, setLoadingList] = useState(false);
  const [errorList, setErrorList] = useState<string | null>(null);


  const [me, setMe] = useState<CurrentUser | null>(null);
  const [meError, setMeError] = useState<string | null>(null);

  // selection + detail
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminUser | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // save
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  // roles (optional)
  const [rolesCatalog, setRolesCatalog] = useState<Role[] | null>(null);
  const [rolesCatalogError, setRolesCatalogError] = useState<string | null>(null);

  const selectedFromList = useMemo(
    () => items.find((u) => u.user_id === selectedUserId) || null,
    [items, selectedUserId]
  );

  const [isActive, setIsActive] = useState<boolean>(true);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!detail) return;
    setIsActive(detail.is_active ?? true);
    setEmail(detail.email ?? "");
  }, [detail?.user_id]);

  // pagination
  const [skip, setSkip] = useState(0);
  const [limit, setLimit] = useState(50); // 25/50/100 are good

  function normRoles(list?: string[] | null): string[] {
    return (list || []).map((r) => String(r).trim().toLowerCase());
  }

  const editorRoleNames = useMemo(() => normRoles(me?.roles), [me]);
  const editorIsAdmin = editorRoleNames.includes("admin");
  const editorIsSupervisor = editorRoleNames.includes("supervisor");

  const targetRoleNames = useMemo(() => normRoles(detail?.roles), [detail]);
  const targetIsAdmin = targetRoleNames.includes("admin");

  const canEditTargetRoles =
    !!detail &&
    (
      editorIsAdmin ||
      (editorIsSupervisor && !targetIsAdmin)
    );

  const roleEditBlockedReason =
    !detail
      ? null
      : editorIsAdmin
        ? null
        : editorIsSupervisor
          ? targetIsAdmin
            ? "Supervisors cannot modify an admin user."
            : null
          : "You are not allowed to modify roles.";

  const visibleRolesCatalog = useMemo(() => {
    if (!rolesCatalog) return null;
    if (editorIsAdmin) return rolesCatalog;

    if (editorIsSupervisor) {
      return rolesCatalog.filter((r) => {
        const name = (r.role_name || "").trim().toLowerCase();
        return name === "member" || name === "supervisor";
      });
    }

    return [];
  }, [rolesCatalog, editorIsAdmin, editorIsSupervisor]);

  function buildListParams() {
    const params = new URLSearchParams();
    const qq = q.trim();
    if (qq) params.set("q", qq);
    if (role) params.set("role", role);
    if (handlerStatus) params.set("handler_status", handlerStatus);

    params.set("skip", String(skip));
    params.set("limit", String(limit));
    return params;
  }

  async function loadMe() {
    setMeError(null);
    try {
      const data = await apiJson("/auth/me", { authRequired: true });
      setMe({
        user_id: data.user_id,
        roles: Array.isArray(data.roles) ? data.roles : [],
      });
    } catch (e: any) {
      setMe(null);
      setMeError(e?.message || "Failed to load current user");
    }
  }

  async function loadUsers() {
    setLoadingList(true);
    setErrorList(null);
    try {
      const params = buildListParams();
      const data = await apiJson(`/admin/users?${params.toString()}`);
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
        setDetail(null);
      }


    } catch (e: any) {
      const msg =
        typeof e?.message === "string"
          ? e.message
          : typeof e === "string"
            ? e
            : JSON.stringify(e, null, 2);
      setErrorList(msg || "Failed to load users");

      setItems([]);
      setTotal(0);
      setSelectedUserId(null);
      setDetail(null);
    } finally {
      setLoadingList(false);
    }
  }

  async function loadUserDetail(userId: number) {
    setLoadingDetail(true);
    setErrorDetail(null);
    try {
      const data = await apiJson(`/admin/users/${userId}`);
      setDetail(data as AdminUser);
    } catch (e: any) {
      setErrorDetail(e?.message || "Failed to load user");
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function readApiError(resp: Response, fallback: string) {
    let detail = "";

    try {
      const data = await resp.json();
      detail =
        typeof data?.detail === "string"
          ? data.detail
          : JSON.stringify(data?.detail ?? "");
    } catch {
      detail = await resp.text().catch(() => "");
    }

    return detail || fallback;
  }

  async function loadRolesCatalogIfAvailable() {
    setRolesCatalogError(null);
    try {
      const data = await apiJson(`/admin/roles`);
      const list: Role[] = Array.isArray(data) ? data : data.items;
      if (Array.isArray(list)) setRolesCatalog(list);
    } catch (e: any) {
      const status = (e as any)?.status;
      if (status === 404) {
        setRolesCatalog(null);
        return;
      }
      setRolesCatalog(null);
      setRolesCatalogError(e?.message || "Failed to load roles catalog");
    }
  }

  useEffect(() => {
    loadUsers();
    loadRolesCatalogIfAvailable();
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, limit]);

  useEffect(() => {
    if (selectedUserId != null) loadUserDetail(selectedUserId);
  }, [selectedUserId])

  async function saveUser(role_ids: number[], is_active: boolean, email: string) {
    if (selectedUserId == null || !detail) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setSaveError("Email is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setSaveError("Please enter a valid email address.");
      return;
    }

    if (!editorIsAdmin) {
      if (!editorIsSupervisor) {
        setSaveError("You are not allowed to modify this user.");
        return;
      }

      if (targetIsAdmin) {
        setSaveError("Supervisors cannot modify an admin user.");
        return;
      }

      const allowedRoleIds = new Set(
        (visibleRolesCatalog || []).map((r) => r.role_id)
      );

      if (role_ids.some((id) => !allowedRoleIds.has(id))) {
        setSaveError("Supervisors may assign only Member or Supervisor roles.");
        return;
      }
      if (Number(selectedUserId) === Number(me?.user_id) && !is_active) {
        setSaveError("You cannot deactivate your own account.");
        return;
      }
    }

    setSaving(true);
    setSaveError(null);
    setSaveOk(null);

    try {
      await apiJson(`/admin/users/${selectedUserId}`, {
        method: "PATCH",
        body: JSON.stringify({
          role_ids,
          is_active,
          email: trimmedEmail,
        }),
      });

      setSaveOk("Saved");
      await loadUsers();
      await loadUserDetail(selectedUserId);
    } catch (e: any) {
      setSaveError(e?.message || "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveOk(null), 1500);
    }
  }

  function fullName(u: AdminUser | null) {
    if (!u) return "";
    return `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.username || u.email || `User ${u.user_id}`;
  }

  const mobileSelectedLabel = fullName(detail || selectedFromList);

  return (
    <PageContainer maxWidth="2xl" className="space-y-6 py-6">
      <div className="text-left space-y-4">
        {/* Header */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h1 className="text-lg font-semibold">
            <span className="text-emerald-300">TSK9SAR</span>{" "}
            <span className="text-slate-100">User Administration</span>
          </h1>
          <div className="text-xs sm:text-sm text-slate-300">
            {saving ? "Saving…" : saveOk ? "Saved" : ""}
          </div>
        </div>

        {/* Filters */}
        <div className={cardClass + " p-4"}>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-slate-200 mb-1">Search</label>
              <input
                className={inputClass}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="First/last, email, username…"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Role</label>
              <input
                className={inputClass}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder='e.g. admin'
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Handler status</label>
              <select className={inputClass} value={handlerStatus} onChange={(e) => setHandlerStatus(e.target.value)}>
                <option value="">All</option>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="inactive">inactive</option>
              </select>
            </div>

            <div className="flex gap-2 lg:flex-col lg:justify-end">
              <button type="button" className={buttonClass + " w-full"} onClick={() => { setSkip(0); loadUsers(); }} disabled={loadingList}>
                {loadingList ? "Loading…" : "Search"}
              </button>
              <Link className={buttonClass + " w-full text-center"} to="/admin/invites">
                Invite New User
              </Link>

            </div>
          </div>

          {errorList && (
            <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-red-200 text-sm">
              {errorList}
            </pre>
          )}

        </div>

        {/* Mobile: selected banner */}
        <div className={cardClass + " p-3 border lg:hidden"}>
          <div className="text-xs text-slate-400">Selected user</div>
          <div className="text-sm font-medium text-slate-100 truncate">{mobileSelectedLabel || "—"}</div>
          <div className="text-xs text-slate-300 truncate">
            {detail?.email || selectedFromList?.email || ""}
          </div>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Results */}
          <div className={cardClass}>
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3 gap-2">
              <div className="text-sm text-slate-200">
                <span className="font-medium">Users</span>{" "}
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

            {/* Shorter on mobile */}
            <div className="max-h-[40vh] lg:max-h-[70vh] overflow-auto">
              {items.map((u) => {
                const activeRow = u.user_id === selectedUserId;
                const h = u.handler;
                const handlerBadge = h?.handler_id ? (h.status || "—") : "No Dog Teams";

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
                        <div className="text-xs text-slate-300 truncate">
                          {u.email} · {u.username}
                        </div>
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
                <div className="px-4 py-3 text-sm text-slate-300">No users found.</div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className={cardClass + " lg:col-span-2"}>
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <div className="text-sm font-medium text-slate-200">User details</div>
              <div className="text-xs text-slate-400">
                {saving ? "Saving…" : saveOk ? "Saved" : ""}
              </div>
            </div>

            {errorDetail && (
              <div className="m-4 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-red-200 text-sm">
                {errorDetail}
              </div>
            )}
            {saveError && (
              <div className="m-4 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-red-200 text-sm">
                {saveError}
              </div>
            )}
            {rolesCatalogError && (
              <div className="m-4 rounded-lg border border-yellow-400/40 bg-yellow-500/10 p-3 text-yellow-100 text-sm">
                {rolesCatalogError}
              </div>
            )}

            <div className="p-4 space-y-4">
              {loadingDetail && <div className="text-sm text-slate-300">Loading…</div>}

              {!loadingDetail && !detail && (
                <div className="text-sm text-slate-300">Select a user to view details.</div>
              )}

              {detail && (
                <>
                  {/* Identity */}
                  <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-3">
                    <div className="text-xs text-slate-400 mb-1">Email</div>
                    <input
                      type="email"
                      className={inputClass}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={saving}
                      placeholder="user@example.com"
                      autoComplete="off"
                    />
                  </div>

                  {/* Handler */}
                  <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-4">
                    <div className="text-sm font-medium text-slate-200 mb-2">Handler</div>
                    {detail.handler?.handler_id ? (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="text-sm text-slate-200">
                          <div>
                            ID: <span className="font-semibold">{detail.handler.handler_id}</span>
                          </div>
                          <div>
                            Status:{" "}
                            <span className="font-semibold">
                              {detail.handler.status || "—"}
                            </span>
                          </div>
                        </div>
                        <Link
                          className={buttonClass + " text-center"}
                          to={`/admin/handlers/${detail.handler.handler_id}`}
                        >
                          Open handler
                        </Link>

                      </div>
                    ) : (
                      <div className="text-sm text-slate-300">This user has no dog teams.</div>
                    )}
                  </div>

                  {/* Roles */}
                  <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-200">Roles</div>
                      <div className="text-xs text-slate-400">user_id: {detail.user_id}</div>
                    </div>

                    <div className="text-sm text-slate-200">
                      Current: <span className="font-semibold">{detail.roles?.join(", ") || "—"}</span>
                    </div>

                    {roleEditBlockedReason && (
                      <div className="rounded-lg border border-yellow-400/40 bg-yellow-500/10 p-3 text-yellow-100 text-sm">
                        {roleEditBlockedReason}
                      </div>
                    )}

                    {visibleRolesCatalog && visibleRolesCatalog.length > 0 ? (
                      <RolesCheckboxEditor
                        catalog={visibleRolesCatalog}
                        currentRoleIds={detail.role_ids || []}
                        disabled={saving || !canEditTargetRoles}
                        isActive={isActive}
                        setIsActive={setIsActive}
                        onSave={(ids) => saveUser(ids, isActive, email)}
                      />
                    ) : (
                      <RoleIdsEditor
                        currentRoleIds={detail.role_ids || []}
                        disabled={saving || !canEditTargetRoles}
                        onSave={(ids) => saveUser(ids, isActive, email)}
                      />
                    )}
                  </div>

                  <div className="text-xs text-slate-400">
                    created_at: {detail.created_at || "—"} · updated_at: {detail.updated_at || "—"}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm sm:text-base font-medium text-slate-100 break-words">{value}</div>
    </div>
  );
}

function RoleIdsEditor({
  currentRoleIds,
  disabled,
  onSave,
}: {
  currentRoleIds: number[];
  disabled: boolean;
  onSave: (ids: number[]) => void;
}) {
  const [text, setText] = useState(currentRoleIds.join(","));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setText((currentRoleIds || []).join(",")), [currentRoleIds]);

  function parseIds(value: string): number[] {
    const parts = value.split(",").map((s) => s.trim()).filter(Boolean);
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => !Number.isFinite(n) || n <= 0 || !Number.isInteger(n))) {
      throw new Error("Role IDs must be a comma-separated list of positive integers.");
    }
    return Array.from(new Set(nums)).sort((a, b) => a - b);
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-400">
        Roles catalog not available yet. Edit by role_id list:
      </div>
      <input
        className={inputClass}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        placeholder="e.g. 1,2,3"
        disabled={disabled}
      />
      {error && <div className="text-sm text-red-200">{error}</div>}
      <button
        type="button"
        className={buttonClass}
        disabled={disabled}
        onClick={() => {
          try {
            onSave(parseIds(text));
          } catch (e: any) {
            setError(e?.message || "Invalid role_ids");
          }
        }}
      >
        Save roles
      </button>
    </div>
  );
}

function RolesCheckboxEditor({
  catalog,
  currentRoleIds,
  disabled,
  onSave,
  isActive,
  setIsActive,
}: {
  catalog: Role[];
  currentRoleIds: number[];
  disabled: boolean;
  onSave: (ids: number[]) => void;
  isActive: boolean;
  setIsActive: (v: boolean) => void;
}) {
  const [selected, setSelected] = useState<number[]>(currentRoleIds);

  useEffect(() => {
    const allowedIds = new Set(catalog.map((r) => r.role_id));
    setSelected((currentRoleIds || []).filter((id) => allowedIds.has(id)));
  }, [currentRoleIds, catalog]);

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-3">
      {/* Account status toggle */}
      <div className="border border-slate-700 bg-slate-800 rounded-lg p-3">
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={!!isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={disabled}
          />
          <span className="break-words">
            Active <span className="text-xs text-slate-400">(users.is_active)</span>
          </span>
        </label>
        <div className="text-xs text-slate-400 mt-1">
          If unchecked, the user will be unable to log in.
        </div>
      </div>

      {/* Roles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {catalog.map((r) => (
          <label key={r.role_id} className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={selected.includes(r.role_id)}
              onChange={() => toggle(r.role_id)}
              disabled={disabled}
            />
            <span className="break-words">
              {r.role_name} <span className="text-xs text-slate-400">({r.role_id})</span>
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        className={buttonClass}
        disabled={disabled}
        onClick={() => onSave(Array.from(new Set(selected)).sort((a, b) => a - b))}
      >
        Save
      </button>
    </div>
  );
}

