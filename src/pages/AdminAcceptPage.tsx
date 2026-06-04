import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageContainer from "../components/PageContainer";

function normalizeApiBase(input?: string) {
  const raw = (input ?? "").trim().replace(/\/+$/, "");
  if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
  if (!raw) return `${window.location.origin}/api`;
  if (window.location.protocol === "https:" && raw.startsWith("http://")) return raw.replace(/^http:\/\//i, "https://");
  return raw;
}

function cleanText(v: any) {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  if (s.toLowerCase() === "string") return "";
  if (s.toLowerCase() === "user@example.com") return "";
  return s;
}

type InviteVerifyOut = {
  valid: boolean;
  reason?: string | null;
  email?: string;
  first_name?: string;
  last_name?: string;
};

type InviteAcceptIn = {
  token: string;
  username: string;
  password: string;
};

type InviteAcceptOut = {
  ok: boolean;
  user_id: number;
};

export default function InviteAcceptPage() {
  const effectiveBaseUrl = normalizeApiBase((import.meta as any)?.env?.VITE_API_BASE_URL);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const token = useMemo(() => cleanText(params.get("token")), [params]);

  const [verify, setVerify] = useState<InviteVerifyOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadVerify = async () => {
    if (!token) {
      setErr("Missing invite token.");
      return;
    }
    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const resp = await fetch(`${effectiveBaseUrl}/auth/invite/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!resp.ok) throw new Error(await resp.text());
      const out = (await resp.json()) as InviteVerifyOut;
      setVerify(out);

      if (!out.valid) {
        setErr("Invite is not valid.");
      } else {
        setUsername((out.email ?? "").split("@")[0] || "");
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to verify invite");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveBaseUrl, token]);

  const accept = async () => {
    if (!token) return;
    if (!verify?.valid) return;

    const u = cleanText(username);
    if (u.length < 3) {
      setErr("Username must be at least 3 characters.");
      return;
    }
    if (!pw1 || pw1.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (pw1 !== pw2) {
      setErr("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setErr(null);
    setOk(null);

    try {
      const payload: InviteAcceptIn = { token, username: u, password: pw1 };

      const resp = await fetch(`${effectiveBaseUrl}/auth/invite/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) throw new Error(await resp.text());
      const out = (await resp.json()) as InviteAcceptOut;

      if (!out.ok) throw new Error("Invite acceptance failed.");

      setOk("Account created. You can now log in.");
      // If you have a login page route, send them there.
      window.setTimeout(() => navigate("/login"), 800);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to accept invite");
    } finally {
      setSubmitting(false);
    }
  };

  const fullName = `${cleanText(verify?.first_name)} ${cleanText(verify?.last_name)}`.trim();

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-xl text-left space-y-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h1 className="text-lg font-semibold text-slate-100">
            <span className="text-emerald-300">TSK9SAR</span> Invitation
          </h1>
          <div className="text-xs text-slate-300 mt-1">
            Verify your invite and create your login.
          </div>
        </div>

        {loading && <div className="text-sm text-slate-200">Loading…</div>}
        {err && <div className="text-sm text-red-200 bg-red-900/30 border border-red-800 rounded-xl p-3">{err}</div>}
        {ok && <div className="text-sm text-emerald-200 bg-emerald-900/30 border border-emerald-800 rounded-xl p-3">{ok}</div>}

        {verify?.valid && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
            <div className="text-sm text-slate-100 font-medium">Invite details</div>
            <div className="text-xs text-slate-300">
              {fullName ? <div>Name: <span className="text-slate-100">{fullName}</span></div> : null}
              {verify.email ? <div>Email: <span className="text-slate-100">{verify.email}</span></div> : null}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Username</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Password</label>
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
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={accept}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-sm border border-emerald-700 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create account"}
              </button>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
