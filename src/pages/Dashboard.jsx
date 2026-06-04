// export default Dashboard;
// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import { logoutUser } from "../api/auth";
import { apiJson } from "../lib/api";
import { Link } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

// Build API URLs safely, preventing duplicate "/api/api" paths.
function buildApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (API_BASE_URL.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    return API_BASE_URL + normalizedPath.replace(/^\/api/, "");
  }

  return API_BASE_URL + normalizedPath;
}

function formatDuesStatus(status) {
  if (status === "paid") return "Paid";
  if (status === "waived") return "Waived";
  return "Unpaid";
}

function duesStatusClass(status) {
  if (status === "paid") return "text-emerald-300";
  if (status === "waived") return "text-amber-300";
  return "text-rose-300";
}

function getMfaVerifiedFromStorage() {
  const token = localStorage.getItem("token");
  if (!token) return false;

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return false;

    const payload = JSON.parse(atob(payloadPart));
    return payload?.mfa_verified === true;
  } catch {
    return false;
  }
}

const USER_ME_PATH = "/users/me";
const DASHBOARD_SUMMARY_PATH = "/dashboard/summary";
const USER_INFO_PATH = "/users/info";

function extractRoleStrings(user) {
  const roles = new Set();
  if (!user || typeof user !== "object") return [];

  if (user.role && typeof user.role === "string") {
    roles.add(user.role);
  }

  if (Array.isArray(user.user_roles)) {
    for (const role of user.user_roles) {
      if (!role) continue;

      if (typeof role === "string") {
        roles.add(role);
      } else if (typeof role === "object") {
        for (const key of ["name", "role", "role_name", "code", "title"]) {
          const value = role[key];
          if (value && typeof value === "string") {
            roles.add(value);
          }
        }
      }
    }
  }

  if (Array.isArray(user.roles)) {
    for (const role of user.roles) {
      if (!role) continue;

      if (typeof role === "string") {
        roles.add(role);
      } else if (typeof role === "object") {
        for (const key of ["name", "role", "role_name", "code", "title"]) {
          const value = role[key];
          if (value && typeof value === "string") {
            roles.add(value);
          }
        }
      }
    }
  }

  return Array.from(roles)
    .map((role) => role.toString().trim())
    .filter(Boolean);
}

function isUserPrivileged(user) {
  if (!user) return false;
  if (user.is_admin || user.is_supervisor || user.is_evaluator) return true;

  const roles = extractRoleStrings(user);
  for (const raw of roles) {
    const role = raw.toLowerCase();
    if (role.includes("admin")) return true;
    if (role.includes("supervisor")) return true;
    if (role.includes("manager")) return true;
  }

  return false;
}

function buildPrivilegeLabel(user) {
  if (!user) return "Guest";

  const roles = extractRoleStrings(user).map((role) => role.toLowerCase());

  const isAdmin = roles.some((role) => role.includes("admin")) || !!user.is_admin;
  if (isAdmin) return "Administrator";

  const isSupervisor =
    roles.some((role) => role.includes("supervisor")) || !!user.is_supervisor;
  if (isSupervisor) return "Supervisor";

  if (user.is_evaluator) return "Evaluator";
  if (user.is_handler) return "Handler";
  return "Guest";
}

function formatDate(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function formatDaysLeft(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return "—";
  if (daysLeft < 0) return `${Math.abs(daysLeft)}d overdue`;
  if (daysLeft === 0) return "today";
  return `${daysLeft}d`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function capitalizeFirst(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const Dashboard = () => {
  const navigate = useNavigate();
  const LE = "\u2264";
  const NBSP = "\u00A0";

  const [user, setUser] = useState(null);
  const [welcomeName, setWelcomeName] = useState("");
  const [error, setError] = useState(null);

  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [windowDays, setWindowDays] = useState(30);

  function handleUnauthorized() {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    navigate("/login", { replace: true });
  }

  const [forumSummary, setForumSummary] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setForumSummary(null);
      return;
    }

    apiJson("/forums/activity/summary", {
      authRequired: true,
      redirectOnAuthFailure: false,
    })
      .then(setForumSummary)
      .catch(() => {
        setForumSummary(null);
      });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    let isMounted = true;

    (async () => {
      try {
        const response = await fetch(buildApiUrl(USER_INFO_PATH), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) return;

        const info = await response.json();

        const name =
          info?.display_name ||
          [info?.first_name, info?.last_name].filter(Boolean).join(" ") ||
          info?.email ||
          "";

        if (isMounted) {
          setWelcomeName(name);
        }
      } catch {
        // Leave welcome text blank if user profile info is unavailable.
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    async function loadCurrentUser() {
      try {
        const response = await fetch(buildApiUrl(USER_ME_PATH), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        if (!response.ok) {
          throw new Error(`User fetch failed: HTTP ${response.status}`);
        }

        const data = await response.json();
        setUser(data);
      } catch (err) {
        console.error("User fetch error:", err);
        setError("Could not load user information.");
      }
    }

    loadCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    async function loadDashboardSummary() {
      try {
        setSummaryError(null);

        const response = await fetch(
          buildApiUrl(`${DASHBOARD_SUMMARY_PATH}?window_days=${windowDays}`),
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        if (!response.ok) {
          throw new Error(`Dashboard summary failed: HTTP ${response.status}`);
        }

        const data = await response.json();
        setSummary(data);
      } catch (err) {
        console.error("Dashboard summary error:", err);
        setSummary(null);
        setSummaryError("Could not load dashboard summary.");
      }
    }

    loadDashboardSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowDays]);

  async function handleLogout() {
    await logoutUser();
  }

  const privilege = user ? buildPrivilegeLabel(user) : "Guest";
  const isPrivileged = user ? isUserPrivileged(user) : false;
  const mfaVerified = user ? user.is_2fa_verified === true : getMfaVerifiedFromStorage();

  const kpis = summary?.kpis || {};
  const expiring = useMemo(() => summary?.queues?.expiring_certs || [], [summary]);
  const certActivity = useMemo(
    () => summary?.queues?.recent_cert_activity || [],
    [summary]
  );

  const mfaVerifiedLabel = " • 2FA Verified";
  const mfaRequiredLabel = " • 2FA Required for Certification Actions";

  return (
    <PageContainer maxWidth="full" className="space-y-6 py-6">
      <div className="w-full max-w-7xl text-left">
        <div className="w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900/40">
          <header className="flex flex-wrap items-start gap-2 border-b border-slate-700 bg-slate-800 p-3 min-w-0 sm:p-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold">
                <span className="text-emerald-400">TSK9SAR</span>{" "}
                <span className="text-slate-100">Dashboard</span>
              </h1>

              {user && (
                <>
                  <div className="truncate text-xs text-slate-200">
                    Logged in as{" "}
                    <span className="font-medium">{welcomeName}</span>
                  </div>

                  <div className="text-[11px] text-slate-300">
                    [
                    {capitalizeFirst(privilege)}
                    <span className="font-mono">
                      {isPrivileged && mfaVerified && (
                        <span className="text-emerald-400">{mfaVerifiedLabel}</span>
                      )}
                      {isPrivileged && !mfaVerified && (
                        <span className="text-amber-400">{mfaRequiredLabel}</span>
                      )}
                    </span>
                    ]
                  </div>
                </>
              )}

              {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
            </div>

            <button
              onClick={handleLogout}
              className="rounded border border-slate-500 bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
            >
              Logout
            </button>
          </header>

          <main className="overflow-x-hidden p-3 sm:p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Certification Activity Overview
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-200">
                  Window
                  <select
                    className="ml-2 rounded border border-slate-600 bg-slate-800 px-2 py-1"
                    value={windowDays}
                    onChange={(e) => setWindowDays(Number(e.target.value))}
                  >
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </label>
              </div>
            </div>

            {summaryError && (
              <div className="text-xs text-red-400">{summaryError}</div>
            )}

            {/* {isprivileged && ( */}
            <section className="mt-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {[
                  { label: "Teams", value: kpis.teams ?? 0 },
                  { label: "Handlers", value: kpis.handlers ?? 0 },
                  { label: "Dogs", value: kpis.dogs ?? 0 },
                  {
                    label: "Pending Affiliations",
                    value: kpis.pending_affiliation_requests ?? 0,
                  },
                  {
                    label: `Expiring ${LE}${NBSP}30d`,
                    value: kpis.certs_expiring_30 ?? 0,
                  },
                  {
                    label: `Expiring ${LE}${NBSP}90d`,
                    value: kpis.certs_expiring_90 ?? 0,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="min-w-0 w-full rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 sm:p-3"
                  >
                    <div className="break-words text-[11px] text-slate-300">
                      {item.label}
                    </div>
                    <div className="break-words text-xl font-semibold leading-tight sm:text-2xl">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg bg-slate-800 border border-slate-700 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">TSK9SAR Forum Activity</h3>

                  {forumSummary?.unread_count > 0 && (
                    <span className="rounded-full bg-blue-900 text-blue-100 text-xs px-2 py-1">
                      {forumSummary.unread_count} unread
                    </span>
                  )}
                </div>

                <div className="mt-3 text-sm text-slate-300">
                  {forumSummary?.active_topic_count || 0} active topics
                </div>

                <Link
                  to="/forums"
                  className="inline-block mt-3 text-sm text-blue-300 hover:text-blue-200"
                >
                  Open forums →
                </Link>
              </div>

              {summary?.dues_enabled && summary?.dues && (
                <section className="mt-3 rounded-lg border border-slate-700 bg-slate-800 p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold">Annual Membership Dues</h3>
                    <span className="text-[11px] text-slate-300">
                      YEAR: {summary.dues.dues_year}
                    </span>
                  </div>

                  <div className="mt-3 text-sm text-slate-300">
                    Your current dues status:
                    <span
                      className={`ml-2 font-medium ${duesStatusClass(
                        summary.dues.status
                      )}`}
                    >
                      {formatDuesStatus(summary.dues.status)}
                    </span>
                  </div>

                  {!summary.dues.is_self_view && (
                    <div className="mt-2 text-sm text-slate-300">
                      Scoped roster: {summary.dues.unpaid_count} unpaid,{" "}
                      {summary.dues.paid_count} paid, {summary.dues.waived_count} waived
                    </div>
                  )}
                </section>
              )}
            </section>
            {/* )} */}

            <section className="rounded-lg border border-slate-700 bg-slate-800 p-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">Expiring K9 Certifications</h3>
                <span className="text-[11px] text-slate-300">Soonest first</span>
              </div>

              {expiring.length === 0 ? (
                <div className="mt-3 text-sm text-slate-300">
                  No expiring certifications in this window.
                </div>
              ) : (
                <>
                  <div className="mt-3 space-y-3 md:hidden">
                    {expiring.map((record) => (
                      <div
                        key={record.certification_id}
                        className="rounded-xl border border-slate-700 bg-slate-700/60 p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {record.handler_name}
                            </div>
                            <div className="text-sm text-slate-300">
                              {record.dog_name}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-slate-400">Days Left</div>
                            <div className="text-sm font-semibold text-amber-300">
                              {formatDaysLeft(record.days_left)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-x-4 gap-y-2 text-sm">
                          <div>
                            <div className="text-[11px] uppercase tracking-wide text-slate-400">
                              Discipline
                            </div>
                            <div className="text-slate-100">
                              {record.discipline_name || record.standard_name || "—"}
                            </div>
                          </div>

                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                Expires
                              </div>
                              <div className="text-slate-100">
                                {formatDate(record.expires_at)}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                Team
                              </div>
                              <div className="text-slate-100">#{record.team_id}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 hidden md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-left text-[11px] text-slate-300">
                          <th className="py-2 pr-3">Handler</th>
                          <th className="py-2 pr-3">Dog</th>
                          <th className="py-2 pr-3">Discipline</th>
                          <th className="py-2 pr-3">Expires</th>
                          <th className="py-2 pr-3">Days Left</th>
                          <th className="py-2 pr-3">Team</th>
                        </tr>
                      </thead>

                      <tbody>
                        {expiring.map((record) => (
                          <tr
                            key={record.certification_id}
                            className="border-b border-slate-800 odd:bg-slate-700 even:bg-slate-600"
                          >
                            <td className="py-2 pr-3">{record.handler_name}</td>
                            <td className="py-2 pr-3">{record.dog_name}</td>
                            <td className="py-2 pr-3">
                              {record.discipline_name || record.standard_name || "—"}
                            </td>
                            <td className="py-2 pr-3">
                              {formatDate(record.expires_at)}
                            </td>
                            <td className="py-2 pr-3">
                              {formatDaysLeft(record.days_left)}
                            </td>
                            <td className="py-2 pr-3">#{record.team_id}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <section className="rounded-lg border border-slate-700 bg-slate-800 p-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">
                  Recent K9 Certification Activity
                </h3>
                <span className="text-[11px] text-slate-300">Most recent first</span>
              </div>

              <div className="mt-3 space-y-2">
                {certActivity.length === 0 ? (
                  <div className="text-xs text-slate-300">
                    No recent certification activity.
                  </div>
                ) : (
                  certActivity.map((event, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-slate-700 bg-slate-900/40 p-3"
                    >
                      <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span>
                          <span className="min-w-0 break-words text-slate-400">
                            Handler:
                          </span>{" "}
                          <span className="font-medium">{event.handler_name}</span>
                        </span>
                        <span>
                          <span className="min-w-0 break-words text-slate-400">
                            Dog:
                          </span>{" "}
                          <span className="font-medium">{event.dog_name}</span>
                        </span>
                        <span>
                          <span className="min-w-0 break-words text-slate-400">
                            Discipline:
                          </span>{" "}
                          <span className="font-medium text-emerald-300">
                            {event.discipline || event.discipline_name || "—"}
                          </span>
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-xs text-slate-300">
                        <span>
                          {(() => {
                            const action = (event.action || "").toLowerCase();
                            const issuer = (event.issuer_name || "").trim() || "Unknown";
                            const actor = (event.actor_name || "").trim() || "Unknown";
                            const samePerson =
                              issuer === actor && action === "active";

                            const actionClass =
                              action === "revoked"
                                ? "text-red-300"
                                : action === "pending"
                                  ? "text-amber-300"
                                  : action === "incomplete"
                                    ? "text-blue-300"
                                    : action === "suspended"
                                      ? "text-yellow-300"
                                      : "text-emerald-300";

                            if (samePerson) {
                              return (
                                <>
                                  <span className={actionClass}>
                                    {action.toUpperCase()}
                                  </span>{" "}
                                  issued by {issuer}
                                </>
                              );
                            }

                            return (
                              <>
                                issued by {issuer},{" "}
                                <span className={actionClass}>
                                  {action.toUpperCase()}
                                </span>{" "}
                                by {actor}
                              </>
                            );
                          })()}
                        </span>

                        <span>{formatDateTime(event.when)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </PageContainer>
  );
};

export default Dashboard;