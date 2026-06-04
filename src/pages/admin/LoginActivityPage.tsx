import React, { useEffect, useMemo, useState } from "react";
import PageContainer from "../../components/PageContainer";
import { apiJson } from "../../lib/api";

type LoginActivityRow = {
  user_id: number;
  first_name: string;
  last_name: string;
  email?: string | null;
  last_login_at?: string | null;
  login_count: number;
  last_mfa_verified_at?: string | null;
  mfa_verify_count: number;
  last_seen_at?: string | null;
  active_now: boolean;
};

type AuthEventRow = {
  auth_event_id: number;
  user_id: number;
  event_type: string;
  occurred_at?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  success: boolean;
  detail?: string | null;
};

type PublicPortalEventRow = {
  event_id: number;
  occurred_at?: string | null;
  section: string;
  session_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  referer?: string | null;
};

type EmailCampaignRow = {
  campaign_id: number;
  created_at?: string | null;
  sent_at?: string | null;
  sent_by_name?: string | null;
  subject?: string | null;
  body_text?: string | null;
  recipient_count?: number | null;
  status?: string | null;
  filter_json?: any;
};

type ActivityMode = "login" | "public" | "email";
type LoginSortBy = "recent" | "login" | "mfa" | "name";

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function fmtRelative(v?: string | null) {
  if (!v) return "—";
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) return "—";

  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function prettySectionName(section?: string | null) {
  const s = (section || "").trim().toLowerCase();
  if (!s) return "—";

  const map: Record<string, string> = {
    portal: "Portal",
    directory: "Directory",
    publicmatrixpage: "Directory",
    standards: "Standards",
    contact: "Contact",
    affiliations: "Affiliations",
    login: "Login",
  };

  return map[s] || s.charAt(0).toUpperCase() + s.slice(1);
}

function EmailCampaignActivity() {
  const [rows, setRows] = useState<EmailCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      try {
        const data = await apiJson<EmailCampaignRow[]>(
          "/admin/email-audience/activity/email-campaigns",
          {
            authRequired: true,
            mfaRequired: false,
          }
        );

        if (!alive) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load email campaign history", err);
        if (!alive) return;
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-slate-300">
        Loading email campaign history…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-sm text-slate-300">
        No email campaigns found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const isOpen = openId === row.campaign_id;

        return (
          <div
            key={row.campaign_id}
            className="rounded-xl border border-slate-700 bg-slate-900 p-4"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  {row.subject || "(No subject)"}
                </div>

                <div className="mt-1 text-xs text-slate-400">
                  Sent:{" "}
                  {row.sent_at
                    ? new Date(row.sent_at).toLocaleString()
                    : "Not sent"}
                  {" · "}
                  By: {row.sent_by_name || "Unknown"}
                  {" · "}
                  Recipients: {row.recipient_count ?? 0}
                  {" · "}
                  Status: {row.status || "—"}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setOpenId(isOpen ? null : row.campaign_id)
                }
                className="rounded-md border border-slate-500 bg-slate-700 px-3 py-1 text-xs text-slate-100 hover:bg-slate-600"
              >
                {isOpen ? "Hide Details" : "View Details"}
              </button>
            </div>

            {isOpen && (
              <div className="mt-4 border-t border-slate-700 pt-4 space-y-4">
                {row.filter_json && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                      Audience / Filter
                    </div>

                    <pre className="whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-slate-200 overflow-x-auto">
                      {typeof row.filter_json === "string"
                        ? row.filter_json
                        : JSON.stringify(row.filter_json, null, 2)}
                    </pre>
                  </div>
                )}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                    Message Subject
                  </div>

                  <div className="whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-sm text-slate-100">
                    {row.subject || "(No subject saved)"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                    Message Body
                  </div>

                  <div className="whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-sm text-slate-100">
                    {row.body_text || "(No body saved)"}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminLoginActivityPage() {
  const [mode, setMode] = useState<ActivityMode>("login");

  const [rows, setRows] = useState<LoginActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [sortBy, setSortBy] = useState<LoginSortBy>("recent");
  const [accessDenied, setAccessDenied] = useState(false);

  const [selectedUser, setSelectedUser] = useState<LoginActivityRow | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<AuthEventRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [publicRows, setPublicRows] = useState<PublicPortalEventRow[]>([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicDays, setPublicDays] = useState(30);
  const [publicSection, setPublicSection] = useState("");
  const [publicDetailOpen, setPublicDetailOpen] = useState(false);
  const [selectedPublicEvent, setSelectedPublicEvent] =
    useState<PublicPortalEventRow | null>(null);

  async function openHistory(row: LoginActivityRow) {
    setSelectedUser(row);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryRows([]);

    try {
      const data = await apiJson(`/admin/users/${row.user_id}/login-history`, {
        authRequired: true,
        mfaRequired: false,
      });
      setHistoryRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load login history", err);
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function closeHistory() {
    setHistoryOpen(false);
    setSelectedUser(null);
    setHistoryRows([]);
  }

  function openPublicDetail(row: PublicPortalEventRow) {
    setSelectedPublicEvent(row);
    setPublicDetailOpen(true);
  }

  function closePublicDetail() {
    setSelectedPublicEvent(null);
    setPublicDetailOpen(false);
  }

  useEffect(() => {
    let alive = true;

    async function loadLoginActivity() {
      setLoading(true);
      try {
const data = await apiJson<LoginActivityRow[]>("/admin/users/login-activity", {
  authRequired: true,
  mfaRequired: false,
});
        if (!alive) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error("Failed to load login activity", err);
        if (!alive) return;

        if (err?.status === 403 || err?.response?.status === 403) {
          setAccessDenied(true);
        }

        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadLoginActivity();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (mode !== "public") return;

    let alive = true;

    async function loadPublicActivity() {
      setPublicLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("days", String(publicDays));
        if (publicSection) params.set("section", publicSection);

        const data = await apiJson(
          `/admin/users/activity/public?${params.toString()}`
        );
        if (!alive) return;
        setPublicRows(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load public portal activity", err);
        if (!alive) return;
        setPublicRows([]);
      } finally {
        if (alive) setPublicLoading(false);
      }
    }

    loadPublicActivity();
    return () => {
      alive = false;
    };
  }, [mode, publicDays, publicSection]);

  const filteredLoginRows = useMemo(() => {
    const needle = q.trim().toLowerCase();

    let result = rows.filter((r) => {
      if (!needle) return true;
      const name = `${r.first_name || ""} ${r.last_name || ""}`.toLowerCase();
      const email = (r.email || "").toLowerCase();
      return name.includes(needle) || email.includes(needle);
    });

    if (showActiveOnly) result = result.filter((r) => r.active_now);

    const toTs = (v?: string | null) => {
      if (!v) return 0;
      const t = new Date(v).getTime();
      return Number.isFinite(t) ? t : 0;
    };

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "recent":
          return toTs(b.last_seen_at) - toTs(a.last_seen_at);
        case "login":
          return toTs(b.last_login_at) - toTs(a.last_login_at);
        case "mfa":
          return toTs(b.last_mfa_verified_at) - toTs(a.last_mfa_verified_at);
        case "name":
        default:
          return `${a.last_name} ${a.first_name}`.localeCompare(
            `${b.last_name} ${b.first_name}`
          );
      }
    });
  }, [rows, q, showActiveOnly, sortBy]);

  const filteredPublicRows = useMemo(() => {
    const needle = q.trim().toLowerCase();

    let result = publicRows.filter((r) => {
      if (!needle) return true;

      return (
        (r.section || "").toLowerCase().includes(needle) ||
        (r.session_id || "").toLowerCase().includes(needle) ||
        (r.ip_address || "").toLowerCase().includes(needle) ||
        (r.referer || "").toLowerCase().includes(needle) ||
        (r.user_agent || "").toLowerCase().includes(needle)
      );
    });

    return [...result].sort((a, b) => {
      const ta = new Date(a.occurred_at || "").getTime();
      const tb = new Date(b.occurred_at || "").getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
  }, [publicRows, q]);

  if (accessDenied) {
    return (
      <PageContainer>
        <div className="rounded-xl border border-amber-700 bg-amber-950/40 p-4">
          <h1 className="text-lg font-semibold text-amber-200">
            Admin privileges required
          </h1>
          <p className="mt-2 text-sm text-amber-100">
            Site Activity is restricted to administrators. Your account can see the
            menu option, but this activity report requires admin access.
          </p>
        </div>
      </PageContainer>
    );
  }
  return (
    <PageContainer>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h1 className="text-lg font-semibold">
            <span className="text-emerald-300">TSK9SAR</span>{" "}
            <span className="text-slate-100">
              {mode === "login"
                ? "Login Activity"
                : mode === "public"
                  ? "Public Portal Activity"
                  : "Email Campaign History"}
            </span>
          </h1>
        </div>

        <section className="rounded-lg border border-slate-700 bg-slate-800 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex rounded-lg border border-slate-600 bg-slate-900 p-1">
              {(["login", "public", "email"] as ActivityMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1.5 text-sm ${mode === m
                    ? "bg-slate-700 text-white"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                >
                  {m === "login"
                    ? "Login Activity"
                    : m === "public"
                      ? "Public Portal Activity"
                      : "Email Campaigns"}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-slate-300">
              {mode === "login"
                ? "Active Now = recent authenticated activity"
                : mode === "public"
                  ? "Public activity is shown in local time"
                  : "Email campaign history includes saved subject, body, and audience details"}
            </span>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-700 bg-slate-800 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={
                  mode === "login"
                    ? "Search user (name/email)…"
                    : mode === "public"
                      ? "Search section, IP, referrer, session…"
                      : "Search email campaigns…"
                }
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 lg:w-80"
              />

              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
                >
                  Clear
                </button>
              )}
            </div>

            {mode === "login" && (
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={showActiveOnly}
                    onChange={(e) => setShowActiveOnly(e.target.checked)}
                  />
                  Active only
                </label>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as LoginSortBy)}
                  className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="recent">Most Recent Activity</option>
                  <option value="login">Last Login</option>
                  <option value="mfa">Last MFA</option>
                  <option value="name">Name</option>
                </select>
              </div>
            )}

            {mode === "public" && (
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={publicDays}
                  onChange={(e) => setPublicDays(Number(e.target.value))}
                  className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={60}>Last 60 days</option>
                  <option value={90}>Last 90 days</option>
                </select>

                <select
                  value={publicSection}
                  onChange={(e) => setPublicSection(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">All sections</option>
                  <option value="directory">Directory</option>
                  <option value="standards">Standards</option>
                  <option value="contact">Contact</option>
                </select>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400">
            {mode === "login" && (
              <>Total: {rows.length} · Showing: {filteredLoginRows.length}</>
            )}
            {mode === "public" && (
              <>Total: {publicRows.length} · Showing: {filteredPublicRows.length}</>
            )}
            {mode === "email" && <>Email campaign history</>}
          </div>

          {mode === "login" && (
            <>
              {loading ? (
                <div className="text-sm text-slate-300">Loading…</div>
              ) : filteredLoginRows.length === 0 ? (
                <div className="text-sm text-slate-300">No users found.</div>
              ) : (
                <div className="max-h-[900px] overflow-x-auto overflow-y-auto">
                  <table className="min-w-[980px] w-full text-sm">
                    <thead>
                      <tr className="sticky top-0 z-40 border-b border-slate-700 bg-slate-900 text-left text-[11px] uppercase tracking-wide text-slate-300">
                        <th className="px-3 py-2">Active</th>
                        <th className="px-3 py-2">User</th>
                        <th className="px-3 py-2">History</th>
                        <th className="px-3 py-2">Last Login</th>
                        <th className="px-3 py-2 text-right">Count</th>
                        <th className="px-3 py-2">Last MFA</th>
                        <th className="px-3 py-2 text-right">Count</th>
                        <th className="px-3 py-2">Last Seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLoginRows.map((row, idx) => (
                        <tr
                          key={row.user_id}
                          className={`border-b border-slate-700 ${row.active_now
                            ? "bg-emerald-900/20"
                            : idx % 2 === 0
                              ? "bg-slate-800"
                              : "bg-slate-800/60"
                            }`}
                        >
                          <td className="px-3 py-2 text-center">
                            {row.active_now ? (
                              <span className="inline-block h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]" />
                            ) : (
                              <span className="inline-block h-3 w-3 rounded-full border border-slate-500" />
                            )}
                          </td>

                          <td className="px-3 py-2 w-[160px]">
                            <div className="truncate">
                              {row.first_name} {row.last_name}
                            </div>
                          </td>

                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => openHistory(row)}
                              className="rounded-md border border-slate-500 bg-slate-700 px-3 py-1 text-[10px] text-slate-100 hover:bg-slate-600"
                            >
                              View
                            </button>
                          </td>

                          <td className="px-3 py-2 text-slate-200">
                            {fmtRelative(row.last_login_at)}
                            <div className="text-[10px] text-slate-400">
                              {fmtDateTime(row.last_login_at)}
                            </div>
                          </td>

                          <td className="px-3 py-2 text-right text-slate-100">
                            {row.login_count ?? 0}
                          </td>

                          <td className="px-3 py-2 text-slate-200">
                            {fmtRelative(row.last_mfa_verified_at)}
                            <div className="text-[10px] text-slate-400">
                              {fmtDateTime(row.last_mfa_verified_at)}
                            </div>
                          </td>

                          <td className="px-3 py-2 text-right text-slate-100">
                            {row.mfa_verify_count ?? 0}
                          </td>

                          <td className="px-3 py-2 text-slate-300">
                            {fmtRelative(row.last_seen_at)}
                            <div className="text-[10px] text-slate-400">
                              {fmtDateTime(row.last_seen_at)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {mode === "public" && (
            <>
              {publicLoading ? (
                <div className="text-sm text-slate-300">Loading…</div>
              ) : filteredPublicRows.length === 0 ? (
                <div className="text-sm text-slate-300">
                  No public portal activity found.
                </div>
              ) : (
                <div className="max-h-[900px] overflow-x-auto overflow-y-auto">
                  <table className="min-w-[1120px] w-full text-sm">
                    <thead>
                      <tr className="sticky top-0 z-40 border-b border-slate-700 bg-slate-900 text-left text-[11px] uppercase tracking-wide text-slate-300">
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2">Section</th>
                        <th className="px-3 py-2">IP Address</th>
                        <th className="px-3 py-2">Details</th>
                        <th className="px-3 py-2">Referrer</th>
                        <th className="px-3 py-2">Session ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPublicRows.map((row, idx) => (
                        <tr
                          key={row.event_id}
                          className={`border-b border-slate-700 ${idx % 2 === 0 ? "bg-slate-800" : "bg-slate-800/60"
                            }`}
                        >
                          <td className="px-3 py-2 text-slate-200">
                            {fmtRelative(row.occurred_at)}
                            <div className="text-[10px] text-slate-400">
                              {fmtDateTime(row.occurred_at)}
                            </div>
                          </td>

                          <td className="px-3 py-2 text-slate-100">
                            {prettySectionName(row.section)}
                          </td>

                          <td className="px-3 py-2 text-slate-300">
                            {row.ip_address || "—"}
                          </td>

                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => openPublicDetail(row)}
                              className="rounded-md border border-slate-500 bg-slate-700 px-3 py-1 text-[10px] text-slate-100 hover:bg-slate-600"
                            >
                              View
                            </button>
                          </td>

                          <td className="px-3 py-2 text-slate-300 max-w-[360px]">
                            <div className="truncate" title={row.referer || ""}>
                              {row.referer || "—"}
                            </div>
                          </td>

                          <td className="px-3 py-2 text-slate-300 max-w-[240px]">
                            <div
                              className="truncate font-mono text-[12px]"
                              title={row.session_id || ""}
                            >
                              {row.session_id || "—"}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {mode === "email" && <EmailCampaignActivity />}

          {historyOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-4xl rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      Login History
                    </h3>
                    <div className="text-xs text-slate-400">
                      {selectedUser
                        ? `${selectedUser.first_name} ${selectedUser.last_name} (${selectedUser.email || "no email"})`
                        : ""}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closeHistory}
                    className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-700"
                  >
                    Close
                  </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto p-4">
                  {historyLoading ? (
                    <div className="text-sm text-slate-300">Loading…</div>
                  ) : historyRows.length === 0 ? (
                    <div className="text-sm text-slate-300">
                      No login history found.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {historyRows.map((ev) => (
                        <div
                          key={ev.auth_event_id}
                          className="rounded-lg border border-slate-700 bg-slate-800 p-3"
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="text-sm font-medium text-slate-100">
                              {ev.event_type === "mfa_verify"
                                ? "MFA Verification"
                                : ev.event_type === "login"
                                  ? "Login"
                                  : ev.event_type}
                            </div>

                            <div className="text-xs text-slate-400">
                              {fmtDateTime(ev.occurred_at)}
                            </div>
                          </div>

                          <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-300 md:grid-cols-3">
                            <div>
                              <span className="text-slate-400">Success:</span>{" "}
                              {ev.success ? "Yes" : "No"}
                            </div>
                            <div>
                              <span className="text-slate-400">IP:</span>{" "}
                              {ev.ip_address || "—"}
                            </div>
                            <div>
                              <span className="text-slate-400">Detail:</span>{" "}
                              {ev.detail || "—"}
                            </div>
                          </div>

                          <div className="mt-2 break-all text-xs text-slate-300">
                            <span className="text-slate-400">User Agent:</span>{" "}
                            {ev.user_agent || "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {publicDetailOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      Public Portal Event
                    </h3>
                    <div className="text-xs text-slate-400">
                      {selectedPublicEvent
                        ? `${prettySectionName(selectedPublicEvent.section)} · ${fmtDateTime(selectedPublicEvent.occurred_at)}`
                        : ""}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closePublicDetail}
                    className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-700"
                  >
                    Close
                  </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto p-4">
                  {!selectedPublicEvent ? (
                    <div className="text-sm text-slate-300">No event selected.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                        <div className="grid grid-cols-1 gap-2 text-sm text-slate-300 md:grid-cols-2">
                          <div>
                            <span className="text-slate-400">Time:</span>{" "}
                            {fmtDateTime(selectedPublicEvent.occurred_at)}
                          </div>
                          <div>
                            <span className="text-slate-400">Section:</span>{" "}
                            {prettySectionName(selectedPublicEvent.section)}
                          </div>
                          <div>
                            <span className="text-slate-400">IP Address:</span>{" "}
                            {selectedPublicEvent.ip_address || "—"}
                          </div>
                          <div>
                            <span className="text-slate-400">Session ID:</span>{" "}
                            <span className="font-mono text-[12px]">
                              {selectedPublicEvent.session_id || "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                        <div className="text-xs text-slate-400">Referrer</div>
                        <div className="mt-1 break-all text-sm text-slate-200">
                          {selectedPublicEvent.referer || "—"}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                        <div className="text-xs text-slate-400">User Agent</div>
                        <div className="mt-1 break-all text-sm text-slate-200">
                          {selectedPublicEvent.user_agent || "—"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}