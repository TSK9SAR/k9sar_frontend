
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import { normalizeApiBase } from "../utils/apiBase";

const API_BASE_URL = normalizeApiBase((import.meta as any)?.env?.VITE_API_BASE_URL);

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [valid, setValid] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");


  useEffect(() => {
    let alive = true;

    if (!token || token.trim().length < 10) {
      setValid(false);
      setReason("bad_token_format");
      return;
    }
    (async () => {
      try {
        const resp = await fetch("/api/auth/reset/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const data = await resp.json().catch(() => ({}));
        if (!alive) return;



        // Your backend returns { ok: true/false } (or possibly { valid: ... })
        const isValid = data.ok ?? data.valid ?? false;

        setValid(!!isValid);
        setReason(data.reason ?? data.detail ?? null);
      } catch {
        if (!alive) return;
        setValid(false);
        setReason("verify_failed");
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);

    const u = username.trim();

    if (pw1.length < 8) return setErr("Password must be at least 8 characters.");
    if (pw1 !== pw2) return setErr("Passwords do not match.");

    // Optional username validation
    if (u) {
      if (u.length < 3) return setErr("Username must be at least 3 characters.");
      if (u.length > 32) return setErr("Username must be 32 characters or less.");
      if (!/^[a-zA-Z0-9._-]+$/.test(u)) {
        return setErr("Username may contain letters, numbers, dot, underscore, or dash.");
      }
    }

    const payload: any = { token, new_password: pw1 };
    if (u) payload.username = u;

    setLoading(true);
    try {
      const resp = await fetch("/api/auth/reset/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await resp.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!resp.ok) {
        const msg =
          data?.detail ||
          data?.reason ||
          (text ? text.slice(0, 200) : `HTTP ${resp.status}`);
        throw new Error(msg);
      }

      if (data && data.ok === false) {
        throw new Error(data.detail || "Reset failed");
      }

      setOk("Password updated. You can now log in.");
      setTimeout(() => nav("/login"), 800);
    } catch (e: any) {
      setErr(e?.message ?? "Reset failed");
    } finally {
      setLoading(false);
    }
  };


  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-md text-left space-y-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h1 className="text-lg font-semibold text-slate-100">Reset password</h1>
          <div className="text-xs text-slate-300 mt-1">Set a new password for your account.</div>
        </div>

        {valid === false && (
          <div className="text-sm text-red-200 bg-red-900/30 border border-red-800 rounded-xl p-3">
            Invalid reset link{reason ? ` (${reason})` : ""}.
          </div>
        )}

        {err && <div className="text-sm text-red-200 bg-red-900/30 border border-red-800 rounded-xl p-3">{err}</div>}
        {ok && <div className="text-sm text-emerald-200 bg-emerald-900/30 border border-emerald-800 rounded-xl p-3">{ok}</div>}

        {valid === true && (
          <form onSubmit={submit} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Username (optional)</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Create or update your username"
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
              />
              <div className="text-[11px] text-slate-400 mt-1">
                Leave blank to keep your current username.
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">New password</label>
              <input
                type="password"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Confirm password</label>
              <input
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm border border-emerald-700 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-60"
            >
              {loading ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}
      </div>
    </PageContainer>
  );
}
