import React from "react";
import { Routes, Route, Navigate, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { apiFetch } from "./lib/api";
import { handleLogout } from "./api/auth";

/**
 * Minimal auth helpers
 */
function getToken(): string | null {
  return localStorage.getItem("token");
}

// async function handleLogout() {
//   try {
//     await apiFetch("/auth/logout", { method: "POST" });
//   } catch (err) {
//     console.error("Logout request failed", err);
//   } finally {
//     localStorage.removeItem("access_token");
//     sessionStorage.removeItem("access_token");
//     window.location.href = "/login";
//   }
// }

import { PropsWithChildren } from "react";

function RequireAuth({ children }: PropsWithChildren) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/**
 * Member layout with simple header + nav
 */
function AppLayout() {
  const navigate = useNavigate();

  const logout = () => {
    handleLogout();
    // window.dispatchEvent(new Event("auth:changed"));
    // Hard redirect is also fine, but within member app this is OK:
    // navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 grid place-items-center">
              <span className="text-emerald-200 font-semibold">K9</span>
            </div>
            <div className="leading-tight">
              <div className="font-semibold">TSK9SAR Member</div>
              <div className="text-xs text-slate-400">Operational tools</div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <TopLink to="/dashboard" label="Dashboard" />
            <TopLink to="/teams" label="Teams" />
            <TopLink to="/dogs" label="Dogs" />
            <TopLink to="/standards" label="Standards" />
            <button
              type="button"
              onClick={logout}
              className="ml-2 px-3 py-2 rounded-lg text-sm border border-slate-700 bg-slate-800 hover:border-slate-500"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function TopLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "px-3 py-2 rounded-lg text-sm border transition-colors",
          "border-slate-700 bg-slate-900 hover:border-slate-500",
          isActive && "border-emerald-500 text-emerald-200 bg-emerald-900/20",
        ]
          .filter(Boolean)
          .join(" ")
      }
    >
      {label}
    </NavLink>
  );
}

/**
 * Pages (simple placeholders; replace with your real pages)
 */
function DashboardPage() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-slate-300">
        Member tools live here. Replace this with your real dashboard page.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickCard title="Teams" desc="Browse, manage, and deploy teams." />
        <QuickCard title="Dogs" desc="Dog roster and status." />
        <QuickCard title="Standards" desc="Internal standards view." />
        <QuickCard title="Admin" desc="Admin tools (if authorized)." />
      </div>
    </div>
  );
}

function TeamsPage() {
  return <SimplePage title="Teams" />;
}
function DogsPage() {
  return <SimplePage title="Dogs" />;
}
function StandardsPage() {
  return <SimplePage title="Standards" />;
}

function SimplePage({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-300">
        Placeholder page. Swap in your existing component.
      </p>
    </div>
  );
}


function QuickCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-sm text-slate-300">{desc}</div>
    </div>
  );
}

/**
 * Login page stub: you can render your existing AuthForm here.
 * IMPORTANT: this is member app login. If you keep login in PUBLIC app,
 * you can remove this route and redirect accordingly.
 */
function LoginPage() {
  // If you already have an AuthForm component, render it here:
  // return <AuthForm />;

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
      <h1 className="text-2xl font-semibold">Member Login</h1>
      <p className="mt-2 text-slate-300">
        Render your existing <code className="text-slate-200">AuthForm</code> here.
      </p>
    </div>
  );
}

/**
 * App routes
 */
export default function App() {
  return (
    <Routes>
      {/* Public within member app */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected section */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/dogs" element={<DogsPage />} />
        <Route path="/standards" element={<StandardsPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
