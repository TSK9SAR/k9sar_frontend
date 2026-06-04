
import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiJson } from "../lib/api";
import { logoutUser } from "../api/auth";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function linkClass(isActive: boolean) {
  return classNames(
    "w-full px-3 py-2 rounded-lg text-sm border transition-colors text-left",
    "border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-400 hover:bg-slate-800/60",
    isActive && "border-emerald-500 text-emerald-200 bg-emerald-900/20"
  );
}

const PUBLIC_PATHS = [
  "/", // portal
  "/directory",
  "/standards",
  "/contact",
  "/login",
  "/accept-invite",
  "/forgot-login",
  "/reset-password",
];

function isPublicPath(pathname: string) {
  // exact match or "startsWith" for nested public paths (if any)
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function useAuthRevalidation() {
  useEffect(() => {
    let running = false;

    async function revalidate() {
      const token = localStorage.getItem("token");
      if (!token || running) return;

      running = true;

      try {
        await apiJson("/admin/canary_no_mfa");
      } catch {
        // apiJson handles clearing auth and redirecting
      } finally {
        running = false;
      }
    }

    function onVisibilityChange() {
      if (!document.hidden) {
        revalidate();
      }
    }

    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const isPublic = isPublicPath(location.pathname);

  // const [token, setToken] = useState<string | null>(() =>
  //   typeof window !== "undefined" ? localStorage.getItem("token") : null
  // );
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));

  const [supervisor, setSupervisor] = useState(false);
  const [administrator, setAdministrator] = useState(false);
  const [privileged, setPrivileged] = useState(false);
  const [dues_enabled, setdues_enabled] = useState(false);

  // ✅ THIS MUST EXIST (your error says it doesn't)
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);

  useAuthRevalidation();

  // 1) keep token in sync
  useEffect(() => {
    const sync = () => {
      const nextToken = localStorage.getItem("token");
      setToken(nextToken);

      if (!nextToken) {
        setPrivileged(false);
        setSupervisor(false);
        setAdministrator(false);
        setMobileNavOpen(false);
      }
    };

    // Run once on mount so header matches current auth state
    sync();

    // Same-tab auth updates (login, logout, MFA completion, etc.)
    window.addEventListener("auth:changed", sync);
    window.addEventListener("auth:logout", sync);

    // Cross-tab updates (another browser tab logs in/out)
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener("auth:changed", sync);
      window.removeEventListener("auth:logout", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // 2) compute privileged by calling an admin+MFA-locked endpoint
  useEffect(() => {
    let alive = true;

    function clearPrivilegeState() {
      setPrivileged(false);
      setSupervisor(false);
      setAdministrator(false);
    }

    (async () => {
      if (!token) {
        if (alive) clearPrivilegeState();
        return;
      }

      try {
        await apiJson("/admin/canary_admin_no_mfa");

        if (alive) {
          setPrivileged(true);
          setSupervisor(false);
          setAdministrator(true);
        }
        return;

      } catch (err: any) {
        if (err?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("twofa_token");
          window.dispatchEvent(new Event("auth:logout"));

          if (alive) clearPrivilegeState();
          return;
        }
      }

      try {
        await apiJson("/admin/canary_no_mfa");

        if (alive) {
          setPrivileged(true);
          setSupervisor(true);
          setAdministrator(false);
        }
        return;

      } catch (err: any) {
        if (err?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("twofa_token");
          window.dispatchEvent(new Event("auth:logout"));
        }

        if (alive) clearPrivilegeState();
      }
    })();

    return () => {
      alive = false;
    };
  }, [token, location.pathname]);


  const logout = async () => {
    setMobileNavOpen(false);
    await logoutUser();
  };



  const [forumSummary, setForumSummary] = useState(null);
  const [affiliationRequestCount, setAffiliationRequestCount] = useState(0);

  useEffect(() => {
    if (!token || !privileged) {
      setAffiliationRequestCount(0);
      return;
    }

    apiJson("/supervisor/kpis")
    apiJson("/supervisor/kpis")
      .then((r) => r.json())
      .then((data) => {
        setAffiliationRequestCount(data?.pending_affiliations ?? 0);
      })
      .catch(() => {
        setAffiliationRequestCount(0);
      });

    apiJson("/dashboard/settings")
      .then((r) => r.json())
      .then((data) => {
        setdues_enabled(
          String(data?.dues_enabled ?? "0") === "1"
        );
      })
      .catch(() => {
        setdues_enabled(false);
      });

  }, [token, privileged]);

  useEffect(() => {
    if (!token) return;

    apiJson("/forums/activity/summary", {
      authRequired: true,
      redirectOnAuthFailure: false,
    })
      .then(setForumSummary)
      .catch(() => { });
  }, [token]);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, location.search]);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close when clicking outside the panel
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = panelRef.current;
      if (el && !el.contains(e.target as Node)) setMobileNavOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [mobileNavOpen]);


  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* =========================================================
          TOP DECORATION BAND (always visible)
          Put your common visual/branding here
         ========================================================= */}
      <div className="sticky top-0 z-50">
        <div className="border-b border-slate-700 bg-slate-950">
          <div className="w-full px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate(token ? "/dashboard" : "/")}
              className="flex items-center bg-slate-900 gap-2 min-w-0"
              title="Go to dashboard / portal"
            >
              <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 grid place-items-center shrink-0">
                <span className="text-emerald-200 font-bold">TS</span>
              </div>

              <div className="min-w-0">
                <div className="font-semibold leading-tight truncate">
                  <span className="text-emerald-300">TSK9SAR</span>{" "}
                  <span className="text-slate-100">
                    {isPublic ? "Portal" : "Dashboard"}
                  </span>
                </div>
              </div>
            </button>

            <div className="hidden sm:flex flex-col items-center px-4">
              <div className="text-emerald-300 text-lg font-semibold tracking-wide leading-tight">
                TSK9SAR | Tri-State K9 Search & Rescue
              </div>
              <div className="text-xs text-slate-400 tracking-widest uppercase">
                Standards, Certification & Registry
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Mobile nav toggle */}
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen((v) => {
                    if (!v) {
                      window.scrollTo({
                        top: 0,
                        behavior: "smooth",
                      });
                    }
                    return !v;
                  });
                }}
                className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800"
                aria-label="Open navigation"
                aria-expanded={mobileNavOpen}
              >
                <div className="flex flex-col justify-center gap-1">
                  <div className="h-0.5 w-5 bg-slate-100 rounded" />
                  <div className="h-0.5 w-5 bg-slate-100 rounded" />
                  <div className="h-0.5 w-5 bg-slate-100 rounded" />
                </div>
              </button>

              {/* Desktop auth button */}
              {token ? (
                <button
                  type="button"
                  onClick={logout}
                  className="hidden lg:inline-flex px-3 py-2 rounded-lg text-sm border border-red-800 bg-red-900/20 text-red-200 hover:bg-red-900/30"
                >
                  Logout
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="hidden lg:inline-flex px-3 py-2 rounded-lg text-sm border border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-400"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          BODY: sidebar + content
         ========================================================= */}
      <div className="w-full px-2 sm:px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[13rem_1fr] gap-4 min-w-0">
          {/* Sidebar (desktop) */}
          <aside className="hidden lg:block">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <NavSection title="Public">
                <NavLink to="/" className={({ isActive }) => linkClass(isActive)}>
                  Portal
                </NavLink>
                <NavLink to="/directory" className={({ isActive }) => linkClass(isActive)}>
                  Directory
                </NavLink>
                <NavLink to="/standards" className={({ isActive }) => linkClass(isActive)}>
                  Standards
                </NavLink>
                <NavLink to="/contact" className={({ isActive }) => linkClass(isActive)}>
                  Contact
                </NavLink>
              </NavSection>

              {/* Member-only nav hidden on public pages */}
              {!isPublic && token && (
                <NavSection title="Member">
                  <NavLink to="/profile" className={({ isActive }) => linkClass(isActive)}>
                    Profile
                  </NavLink>
                  <NavLink to="/my-teams" className={({ isActive }) => linkClass(isActive)}>
                    Teams
                  </NavLink>
                  <NavLink to="/dogs" className={({ isActive }) => linkClass(isActive)}>
                    Dogs
                  </NavLink>
                  <NavLink to="/matrix" className={({ isActive }) => linkClass(isActive)}>
                    Certifications
                  </NavLink>
                  <NavLink to="/matrix/evaluators" className={({ isActive }) => linkClass(isActive)}>
                    Evaluators
                  </NavLink>
                  <NavLink to="/signature" className={({ isActive }) => linkClass(isActive)}>
                    Signature
                  </NavLink>
                  <NavLink to="/affiliations" className={({ isActive }) => linkClass(isActive)}>
                    View Affiliations
                  </NavLink>
                  <NavLink
                    to="/forums"
                    className={({ isActive }) => linkClass(isActive)}
                  >
                    <div className="flex items-center gap-2">
                      <span>Forums</span>

                      {forumSummary?.unread_count > 0 && (
                        <span className="rounded-full bg-blue-600 text-white text-[11px] px-2 py-0.5 min-w-[22px] text-center">
                          {forumSummary.unread_count}
                        </span>
                      )}
                    </div>
                  </NavLink>
                  <NavLink to="/help" className={({ isActive }) => linkClass(isActive)}>
                    Help Videos
                  </NavLink>

                  {privileged && (
                    <>
                      <div className="h-px bg-slate-800 my-2" />
                      <NavSection title="Supervisor">

                        <NavLink to="/admin/user" className={({ isActive }) => linkClass(isActive)}>
                          Users
                        </NavLink>
                        <NavLink to="/admin/member" className={({ isActive }) => linkClass(isActive)}>
                          Handlers
                        </NavLink>
                        <NavLink to="/admin/email-users" className={({ isActive }) => linkClass(isActive)}>
                          Email Selected Members
                        </NavLink>
                        {dues_enabled && (
                          <NavLink to="/admin/dues" className={({ isActive }) => linkClass(isActive)}>
                            Membership Dues
                          </NavLink>
                        )}
                        <NavLink to="/admin/affiliations" className={({ isActive }) => linkClass(isActive)}>
                          Manage Affiliations
                        </NavLink>
                        <NavLink
                          to="/admin/supervisor/affiliation-requests"
                          className={({ isActive }) => linkClass(isActive)}
                        >
                          <div className="flex items-center gap-2">
                            <span>Affiliation Requests</span>

                            {affiliationRequestCount > 0 && (
                              <span className="rounded-full bg-blue-600 text-white text-[11px] px-2 py-0.5 min-w-[22px] text-center">
                                {affiliationRequestCount}
                              </span>
                            )}
                          </div>
                        </NavLink>
                        <NavLink to="/admin/invites" className={({ isActive }) => linkClass(isActive)}>
                          New Member Invition
                        </NavLink>

                      </NavSection>
                    </>
                  )}

                  {administrator && (
                    <>
                      <div className="h-px bg-slate-800 my-2" />
                      <NavSection title="Administrator">

                        <NavLink to="/admin/help" className={({ isActive }) => linkClass(isActive)}>
                          Create Help Content
                        </NavLink>
                        <NavLink to="/admin/login-activity" className={({ isActive }) => linkClass(isActive)}>
                          Site Activity
                        </NavLink>
                        <NavLink to="/admin/forum-surveys" className={({ isActive }) => linkClass(isActive)}>
                          Manage Forums & Surveys
                        </NavLink>
                        <NavLink to="/admin/config" className={({ isActive }) => linkClass(isActive)}>
                          Configure Standards
                        </NavLink>
                        <NavLink to="/admin/cleanup" className={({ isActive }) => linkClass(isActive)}>
                          Cleanup Database
                        </NavLink>
                        <NavLink to="/admin/cleanup-audit" className={({ isActive }) => linkClass(isActive)}>
                          Cleanup Audit
                        </NavLink>

                      </NavSection>
                    </>
                  )}

                </NavSection>
              )}

              <div className="pt-2">
                <div className="h-px bg-slate-800 my-2" />
                {token ? (
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm border border-red-800 bg-red-900/20 text-red-200 hover:bg-red-900/30"
                  >
                    Logout
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-400 hover:bg-slate-800/60"
                  >
                    Login
                  </button>
                )}
              </div>
              <div className="text-[10px] text-slate-500">
                build {import.meta.env.VITE_BUILD_ID || "dev"}
              </div>
            </div>
          </aside>

          {/* Mobile nav drawer */}
          {mobileNavOpen && (
            <div className="lg:hidden" ref={panelRef}>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 mb-4">
                <NavSection title="Public">
                  <NavLink to="/" className={({ isActive }) => linkClass(isActive)}>
                    Portal
                  </NavLink>
                  <NavLink to="/directory" className={({ isActive }) => linkClass(isActive)}>
                    Directory
                  </NavLink>
                  <NavLink to="/standards" className={({ isActive }) => linkClass(isActive)}>
                    Standards
                  </NavLink>
                  <NavLink to="/contact" className={({ isActive }) => linkClass(isActive)}>
                    Contact
                  </NavLink>
                </NavSection>

                {/* Member-only nav hidden on public pages */}
                {!isPublic && token && (
                  <NavSection title="Member">
                    <NavLink to="/profile" className={({ isActive }) => linkClass(isActive)}>
                      Profile
                    </NavLink>
                    <NavLink to="/my-teams" className={({ isActive }) => linkClass(isActive)}>
                      Teams
                    </NavLink>
                    <NavLink to="/dogs" className={({ isActive }) => linkClass(isActive)}>
                      Dogs
                    </NavLink>
                    <NavLink to="/matrix" className={({ isActive }) => linkClass(isActive)}>
                      Certifications
                    </NavLink>
                    <NavLink to="/matrix/evaluators" className={({ isActive }) => linkClass(isActive)}>
                      Evaluators
                    </NavLink>
                    <NavLink to="/signature" className={({ isActive }) => linkClass(isActive)}>
                      Signature
                    </NavLink>
                    <NavLink to="/affiliations" className={({ isActive }) => linkClass(isActive)}>
                      View Affiliations
                    </NavLink>
                    <NavLink
                      to="/forums"
                      className={({ isActive }) => linkClass(isActive)}
                    >
                      <div className="flex items-center gap-2">
                        <span>Forums</span>

                        {forumSummary?.unread_count > 0 && (
                          <span className="rounded-full bg-blue-600 text-white text-[11px] px-2 py-0.5 min-w-[22px] text-center">
                            {forumSummary.unread_count}
                          </span>
                        )}
                      </div>
                    </NavLink>
                    <NavLink to="/help" className={({ isActive }) => linkClass(isActive)}>
                      Help Videos
                    </NavLink>

                    {privileged && (
                      <>
                        <div className="h-px bg-slate-800 my-2" />
                        <NavSection title="Supervisor">

                          <NavLink to="/admin/user" className={({ isActive }) => linkClass(isActive)}>
                            Users
                          </NavLink>
                          <NavLink to="/admin/member" className={({ isActive }) => linkClass(isActive)}>
                            Handlers
                          </NavLink>
                          <NavLink to="/admin/email-users" className={({ isActive }) => linkClass(isActive)}>
                            Email Selected Members
                          </NavLink>
                          {dues_enabled && (
                            <NavLink to="/admin/dues" className={({ isActive }) => linkClass(isActive)}>
                              Membership Dues
                            </NavLink>
                          )}
                          <NavLink to="/admin/affiliations" className={({ isActive }) => linkClass(isActive)}>
                            Manage Affiliations
                          </NavLink>
                          <NavLink
                            to="/admin/supervisor/affiliation-requests"
                            className={({ isActive }) => linkClass(isActive)}
                          >
                            <div className="flex items-center gap-2">
                              <span>Affiliation Requests</span>

                              {affiliationRequestCount > 0 && (
                                <span className="rounded-full bg-blue-600 text-white text-[11px] px-2 py-0.5 min-w-[22px] text-center">
                                  {affiliationRequestCount}
                                </span>
                              )}
                            </div>
                          </NavLink>
                          <NavLink to="/admin/invites" className={({ isActive }) => linkClass(isActive)}>
                            New Member Invition
                          </NavLink>

                        </NavSection>
                      </>
                    )}

                    {administrator && (
                      <>
                        <div className="h-px bg-slate-800 my-2" />
                        <NavSection title="Administrator">

                          <NavLink to="/admin/help" className={({ isActive }) => linkClass(isActive)}>
                            Create Help Content
                          </NavLink>
                          <NavLink to="/admin/login-activity" className={({ isActive }) => linkClass(isActive)}>
                            Site Activity
                          </NavLink>
                          <NavLink to="/admin/forum-surveys" className={({ isActive }) => linkClass(isActive)}>
                            Manage Forums & Surveys
                          </NavLink>
                          <NavLink to="/admin/config" className={({ isActive }) => linkClass(isActive)}>
                            Configure Standards
                          </NavLink>
                          <NavLink to="/admin/cleanup" className={({ isActive }) => linkClass(isActive)}>
                            Cleanup Database
                          </NavLink>
                          <NavLink to="/admin/cleanup-audit" className={({ isActive }) => linkClass(isActive)}>
                            Cleanup Audit
                          </NavLink>

                        </NavSection>
                      </>
                    )}

                  </NavSection>
                )}

                <div className="pt-2">
                  <div className="h-px bg-slate-800 my-2" />
                  {token ? (
                    <button
                      type="button"
                      onClick={logout}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm border border-red-800 bg-red-900/20 text-red-200 hover:bg-red-900/30"
                    >
                      Logout
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate("/login")}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-400 hover:bg-slate-800/60"
                    >
                      Login
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-slate-500">
                  build {import.meta.env.VITE_BUILD_ID || "dev"}
                </div>
              </div>
            </div>
          )}

          {/* Main content column */}
          <section className="min-w-0">
            {/* extra mobile spacing so content never feels edge-to-edge */}
            <div className="px-1 sm:px-0 min-w-0">
              <Outlet />
            </div>
          </section>
        </div>
      </div >
    </div >
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-400 px-1 mb-2">
        {title}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
