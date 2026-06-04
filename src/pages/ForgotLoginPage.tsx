import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import { normalizeApiBase } from "../utils/apiBase";

const effectiveBaseUrl = normalizeApiBase((import.meta as any)?.env?.VITE_API_BASE_URL);

export default function ForgotLoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      const resp = await fetch(`${effectiveBaseUrl}/auth/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();

      // For now, backend returns reset_url (until you add email sending)
      setOk(data.reset_url
        ? `Reset link (copy/paste): ${data.reset_url}`
        : "If that email exists, a reset link was sent. Please check your inbox and spam folder within a few minutes."
      );
    } catch (e: any) {
      setErr(e?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-md text-left space-y-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h1 className="text-lg font-semibold text-slate-100">Forgot password</h1>
          <div className="text-xs text-slate-300 mt-1">
            If an account is registered with the email address you enter, a password reset link will been sent.
          </div>
        </div>

        {err && <div className="text-sm text-red-200 bg-red-900/30 border border-red-800 rounded-xl p-3">{err}</div>}
        {ok && <div className="text-sm text-emerald-200 bg-emerald-900/30 border border-emerald-800 rounded-xl p-3 whitespace-pre-wrap">{ok}</div>}

        <form onSubmit={submit} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-xs text-slate-300 mb-1">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="px-4 py-2 rounded-lg text-sm border border-emerald-700 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-60"
          >
            {loading ? "Submitting…" : "Send reset link"}
          </button>

          <button
            type="button"
            onClick={() => nav("/")}
            className="ml-2 px-4 py-2 rounded-lg text-sm border border-slate-600 bg-slate-700 text-slate-100 hover:border-slate-400"
          >
            Back to login
          </button>
        </form>
      </div>
    </PageContainer>
  );
}
