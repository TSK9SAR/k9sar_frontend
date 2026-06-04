// src/components/AuthForm.jsx
import React, { useState } from "react";
import { useEffect } from "react";
import { replace, useNavigate } from "react-router-dom";
import App from "../App.jsx";
import { setAuthToken } from "../lib/auth.js";
import { clearAuthToken } from "../lib/auth.js";
import PageContainer from "./PageContainer.jsx";
import { Eye, EyeOff } from "lucide-react";

function normalizeApiBase(input) {
  const raw = (input || "").trim().replace(/\/+$/, "");
  if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
  if (!raw) return `${window.location.origin}/api`;
  if (window.location.protocol === "https:" && raw.startsWith("http://")) {
    return raw.replace(/^http:\/\//i, "https://");
  }
  return raw;
}

const API_BASE_URL = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);

function AuthForm() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") || "/dashboard";
  const passwordRef = React.useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate(next, { replace: true });
    }
  }, []);


  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body = new URLSearchParams();
      body.append("username", username);
      body.append("password", password);
      body.append("grant_type", "password"); // harmless

      const resp = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      const text = await resp.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!resp.ok) {
        throw new Error(`Login failed (HTTP ${resp.status}): ${text}`);
      }

      // ✅ 2FA required (check FIRST because backend also returns access_token)
      // if (data?.requires_2fa) {
      //   // store normal access token so they can still use the app (issuing blocked)
      //   if (data?.access_token) setAuthToken(data.access_token);

      //   if (data?.twofa_mode === "verify" && data?.twofa_token) {
      //     sessionStorage.setItem("twofa_token", data.twofa_token);
      //     sessionStorage.setItem("twofa_ident", username);
      //     window.dispatchEvent(new Event("auth:changed"));
      //     navigate("/twofa", { replace: true });
      //     return;
      //   }

      //   if (data?.twofa_mode === "enroll") {
      //     // send them to an enroll page (or reuse /twofa with an enroll mode)
      //     navigate("/twofa-setup", { replace: true });
      //     return;
      //   }
      // }

      if (data.requires_2fa && data.twofa_token) {
        if (data.access_token) {
          setAuthToken(data.access_token);
        }

        sessionStorage.setItem("twofa_token", data.twofa_token);
        sessionStorage.setItem("mfa_methods", JSON.stringify(data.mfa_methods || {}));

        if (data.twofa_mode === "enroll") {
          navigate(`/twofa-setup?next=${encodeURIComponent(next)}`, { replace: true });
          return;
        }

        if (data.twofa_mode === "verify") {
          navigate(`/twofa?next=${encodeURIComponent(next)}`, { replace: true });
          return;
        }
      }

      if (data.access_token) {
        setAuthToken(data.access_token);
        sessionStorage.removeItem("twofa_token");
        sessionStorage.removeItem("mfa_methods");
        navigate(next, { replace: true });
        return;
      }

      throw new Error("Login response did not contain access_token");

    } catch (err) {
      console.error("Login error:", err);
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }



  // ✅ Change this to whatever route you created for your “forgot/reset” flow.
  // If you don’t have one yet, create it first (even a placeholder page).
  const FORGOT_ROUTE = "/forgot-login";

  return (
    <PageContainer maxWidth="2xl" className="space-y-6 py-6">
      <div className="min-h-screen bg-slate-900 px-4 sm:px-6 lg:px-8 py-6">

        <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-6">
          <div className="mb-4 text-center">
            <h1 className="text-lg font-semibold text-slate-100">
              <span className="text-emerald-400">TSK9SAR</span> Admin Login
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Sign in to manage teams and certifications
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Username
              </label>
              <input
                type="text"
                className="w-full border border-slate-600 rounded px-2 py-1.5 text-sm bg-slate-900 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Password
              </label>

              <div className="relative">
                <input
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  className="w-full border border-slate-600 rounded px-2 py-1.5 pr-10 text-sm bg-slate-900 text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="
    absolute right-2 top-1/2 -translate-y-1/2
    p-1
    bg-transparent hover:bg-transparent active:bg-transparent focus:bg-transparent
    border-0 shadow-none
    text-slate-400 hover:text-slate-200
    outline-none focus:outline-none focus:ring-0
  "
                  style={{
                    WebkitAppearance: "none",
                    appearance: "none",
                    background: "transparent",
                    backgroundColor: "transparent",
                    border: "none",
                    boxShadow: "none",
                    outline: "none",
                    WebkitTapHighlightColor: "transparent",
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-300 bg-red-950/40 border border-red-500/60 rounded px-2 py-1">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-emerald-500 text-slate-900 text-sm font-semibold py-1.5 rounded hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              disabled={loading}
            >
              {loading ? "Logging in…" : "Log in"}
            </button>

            {/* ✅ Forgot button (does not rely on any component import) */}
            <div className="pt-1 flex  justify-end">
              <button
                type="button"
                onClick={() => navigate(FORGOT_ROUTE)}
                className="w-full text-xs text-slate-300 bg-slate-700 hover:text-slate-100 hover:underline"
              >
                Forgot username / password?
              </button>
            </div>
          </form>
        </div>
      </div>
    </PageContainer>
  );
}
export default AuthForm;
