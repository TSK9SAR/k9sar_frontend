import React, { useEffect, useMemo, useState } from "react";
import PageContainer from "../components/PageContainer";
import { apiJson } from "../lib/api";

function normalizeApiBase(input?: string) {
  const raw = (input ?? "").trim().replace(/\/+$/, "");
  if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
  if (!raw) return `${window.location.origin}/api`;
  if (window.location.protocol === "https:" && raw.startsWith("http://")) return raw.replace(/^http:\/\//i, "https://");
  return raw;
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function cleanText(v: any) {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  // avoid swagger placeholder strings leaking into UI
  if (s.toLowerCase() === "string") return "";
  if (s.toLowerCase() === "user@example.com") return "";
  return s;
}

type RoleDto = { role_id: number; role_name: string };

type InviteCreateIn = {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  role_ids: number[];
};

type InviteCreateOut = {
  ok?: boolean;
  invite_url?: string;
  token?: string;
  expires_at?: string;
  email_sent?: boolean;
  email_queued?: boolean;
};


function buildMailto(toEmail: string, subject: string, body: string) {
  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", body);
  return `mailto:${encodeURIComponent(toEmail)}?${params.toString()}`;
}

export default function AdminInvitesPage() {
  const effectiveBaseUrl = normalizeApiBase((import.meta as any)?.env?.VITE_API_BASE_URL);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // form fields
  const [email, setEmail] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");

  // roles
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);

  // ui status
  const [busy, setBusy] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // invite result
  const [inviteUrl, setInviteUrl] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  // ✅ change this ONE line if your roles endpoint path differs
  const [emailSent, setEmailSent] = useState(false);

  const loadRoles = async () => {
    if (!token) return;

    setRoleLoading(true);
    setErr(null);

    try {
      const rows = await apiJson<RoleDto[]>("/admin/roles", {
        authRequired: true,
        mfaRequired: false,
      });

      const normalized = (rows ?? [])
        .filter((r) => Number.isFinite(r.role_id) && !!cleanText(r.role_name))
        .sort((a, b) =>
          cleanText(a.role_name).localeCompare(cleanText(b.role_name))
        );

      setRoles(normalized);

      if (selectedRoleIds.length === 0 && normalized.length) {
        const member = normalized.find(
          (r) => r.role_name.toLowerCase() === "member"
        );
        setSelectedRoleIds([member?.role_id ?? normalized[0].role_id]);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load roles");
    } finally {
      setRoleLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveBaseUrl]);

  const toggleRole = (role_id: number) => {
    setSelectedRoleIds((prev) => (prev.includes(role_id) ? prev.filter((x) => x !== role_id) : [...prev, role_id]));
  };

  const selectedRoleNames = useMemo(() => {
    const map = new Map(roles.map((r) => [r.role_id, r.role_name] as const));
    return selectedRoleIds
      .map((id) => map.get(id))
      .filter(Boolean)
      .map((s) => String(s));
  }, [roles, selectedRoleIds]);

  const submit = async () => {
    if (!token) {
      setErr("Not authenticated.");
      return;
    }

    const payload: InviteCreateIn = {
      email: cleanText(email),
      first_name: cleanText(first),
      last_name: cleanText(last),
      phone: cleanText(phone) || null,
      role_ids: selectedRoleIds,
    };

    if (!payload.email || !payload.first_name || !payload.last_name) {
      setErr("Email, first name, and last name are required.");
      return;
    }
    if (!payload.role_ids.length) {
      setErr("Please select at least one role.");
      return;
    }

    setBusy(true);
    setErr(null);
    setOk(null);
    setInviteUrl("");
    setExpiresAt("");
    setEmailSent(false);

    if (!token || token === "null" || token === "undefined") {
      throw new Error("Session expired. Please log in again.");
    }

    try {
      const out = await apiJson<InviteCreateOut>("/admin/invites", {
        method: "POST",
        body: JSON.stringify(payload),
        authRequired: true,
        mfaRequired: false,
      });

      const url =
        cleanText(out.invite_url) ||
        (cleanText(out.token)
          ? `${window.location.origin}/invite?token=${encodeURIComponent(cleanText(out.token))}`
          : "");

      if (!url) throw new Error("Invite created, but server did not return invite_url or token.");

      const sent = !!(out.email_sent ?? out.email_queued);
      setEmailSent(sent);

      setInviteUrl(url);
      setExpiresAt(cleanText(out.expires_at));
      setOk(sent ? "Invite created and email sent." : "Invite created.");

    } catch (e: any) {
      setErr(e?.message ?? "Failed to create invite");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setOk("Copied invite link.");
    } catch {
      setErr("Clipboard copy failed (browser permissions).");
    }
  };

  const emailSubject = useMemo(() => {
    return "TSK9SAR Invitation – Create your account";
  }, []);

  const emailBody = useMemo(() => {
    const name = [cleanText(first), cleanText(last)].filter(Boolean).join(" ");
    const rolesLine = selectedRoleNames.length ? `Roles: ${selectedRoleNames.join(", ")}\n\n` : "";
    const expiryLine = expiresAt ? `This link expires: ${expiresAt}\n\n` : "";

    return (
      `Hi${name ? " " + name : ""},\n\n` +
      `You have been invited to join TSK9SAR.\n\n` +
      rolesLine +
      `To create your login, click this secure link:\n${inviteUrl}\n\n` +
      expiryLine +
      `If you did not request this invite, you can ignore this email.\n\n` +
      `— TSK9SAR Admin`
    );
  }, [first, last, selectedRoleNames, inviteUrl, expiresAt]);

  const mailtoHref = useMemo(() => {
    if (!inviteUrl || !cleanText(email)) return "";
    return buildMailto(cleanText(email), emailSubject, emailBody);
  }, [inviteUrl, email, emailSubject, emailBody]);

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-3xl space-y-4 text-left">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h1 className="text-lg font-semibold text-slate-100">
            <span className="text-emerald-300">TSK9SAR</span> Admin · Invite user
          </h1>
          <div className="text-xs text-slate-300 mt-1">
            Create an invitation link for a new user. Pick roles by name, copy link, or compose an email.
          </div>
        </div>

        {err && <div className="text-sm text-red-200 bg-red-900/30 border border-red-800 rounded-xl p-3">{err}</div>}
        {ok && <div className="text-sm text-emerald-200 bg-emerald-900/30 border border-emerald-800 rounded-xl p-3">{ok}</div>}

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-300 mb-1">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">First name</label>
              <input
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Last name</label>
              <input
                value={last}
                onChange={(e) => setLast(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Phone (optional)</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                placeholder="+1..."
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs text-slate-300 mb-1">Roles</label>
                <button
                  type="button"
                  onClick={loadRoles}
                  disabled={roleLoading}
                  className="px-3 py-1.5 rounded-full text-xs border bg-slate-700 text-slate-100 border-slate-500 hover:border-slate-400 disabled:opacity-60"
                >
                  {roleLoading ? "Loading…" : "Reload roles"}
                </button>
              </div>

              {roles.length === 0 ? (
                <div className="text-xs text-slate-300">
                  No roles loaded. Confirm your roles endpoint returns: <code className="text-slate-200">{`[{ role_id, name }]`}</code>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {roles.map((r) => {
                    const active = selectedRoleIds.includes(r.role_id);
                    return (
                      <button
                        key={r.role_id}
                        type="button"
                        onClick={() => toggleRole(r.role_id)}
                        className={classNames(
                          "px-3 py-1.5 rounded-full text-sm border transition-colors",
                          !active && "bg-slate-700 text-slate-100 border-slate-500 hover:border-slate-400",
                          active && "bg-slate-500 text-slate-100 border-emerald-400"
                        )}
                        title={`role_id=${r.role_id}`}
                      >
                        {r.role_name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm border border-emerald-700 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create invite"}
            </button>
          </div>

          {inviteUrl && emailSent && (
            <div className="bg-slate-900/30 border border-slate-700 rounded-xl p-3 space-y-2">
              <div className="text-sm text-slate-100 font-medium">Invite emailed</div>
              <div className="text-xs text-slate-300">
                The invitation email was sent to <span className="text-slate-200">{cleanText(email)}</span>.
                {expiresAt ? <span className="ml-2 text-slate-400">Expires: {expiresAt}</span> : null}
              </div>
            </div>
          )}

          {inviteUrl && !emailSent && (
            <div className="bg-slate-900/30 border border-slate-700 rounded-xl p-3 space-y-2">
              <div className="text-sm text-slate-100 font-medium">Invite created</div>

              <div className="text-xs text-slate-300">
                Share the link, or compose an email.
                {expiresAt ? <span className="ml-2 text-slate-400">Expires: {expiresAt}</span> : null}
              </div>

              <div className="flex flex-col md:flex-row gap-2 md:items-center">
                <input
                  readOnly
                  value={inviteUrl}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/40 text-slate-200 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={copy}
                  className="px-4 py-2 rounded-lg text-sm border border-slate-600 bg-slate-700 text-slate-100 hover:border-slate-400"
                >
                  Copy link
                </button>

                <a
                  href={mailtoHref || undefined}
                  className={classNames(
                    "px-4 py-2 rounded-lg text-sm border text-center",
                    mailtoHref
                      ? "border-emerald-700 bg-emerald-900/20 text-emerald-200 hover:bg-emerald-900/30"
                      : "border-slate-600 bg-slate-700 text-slate-400 cursor-not-allowed"
                  )}
                  onClick={(e) => {
                    if (!mailtoHref) e.preventDefault();
                  }}
                  title={mailtoHref ? "Open your email client with a draft" : "Enter an email address to enable"}
                >
                  Compose email
                </a>
              </div>

              <details className="mt-2">
                <summary className="text-xs text-slate-300 cursor-pointer hover:underline">
                  Preview email content
                </summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-200 bg-slate-900/40 border border-slate-700 rounded-lg p-3">
                  {`To: ${cleanText(email)}\nSubject: ${emailSubject}\n\n${emailBody}`}
                </pre>
              </details>
            </div>
          )}

        </div>
      </div>
    </PageContainer>
  );
}
