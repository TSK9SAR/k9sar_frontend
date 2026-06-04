import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, apiJson } from "../lib/api";
import { setAuthToken } from "../lib/auth";

export default function TwoFASetupPage() {
  const navigate = useNavigate();

  const [loadingBegin, setLoadingBegin] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [loadingDisable, setLoadingDisable] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [code, setCode] = useState("");

  const TWOFA_NOTE = "About Multi-Factor Authentication (MFA)";
  const TWOFA_STATEMENT = `As an Evaluator or Administrator, you’ve landed on this page to perform a one-time setup to enable Multi-Factor Authentication using the Google Authenticator application,
  which you can download from “Google Play” or “App Store”. You can also choose to use a passkey. If you plan to use a mobile device often, a passkey might be more convenient.
   You can skip this process for now, but without enabling and authorizing it, you can view everything, but you won’t be able to issue certifications or manage the system.`;
  const TWOFA_STATEMENT2 = `Multi-factor authentication is required for sensitive actions in this system. Because certifications, standards, and affiliations affect official records and public trust, an additional verification step helps ensure those actions are performed only by you.`;

  const mfaMethods = JSON.parse(sessionStorage.getItem("mfa_methods") || "{}");
  const totpEnabled = !!mfaMethods.totp;
  const passkeyEnabled = !!mfaMethods.passkey;
  const showTotpSetup = !totpEnabled;
  const showPasskeySetup = !passkeyEnabled;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/", { replace: true });
  }, [navigate]);

  function authHeaders(json = false) {
    const token = localStorage.getItem("token");
    const h = new Headers();
    if (token) h.set("Authorization", `Bearer ${token}`);
    if (json) h.set("Content-Type", "application/json");
    return h;
  }

  async function handleAddPasskey() {
    try {
      setError(null);
      setMsg(null);

      const options: any = await apiJson("/auth/passkey/register/start", {
        method: "POST",
      });

      function b64urlToUint8Array(base64url: string): Uint8Array {
        const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
        const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(base64);
        return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
      }

      function arrayBufferToB64url(buffer: ArrayBuffer | ArrayBufferLike): string {
        const bytes = new Uint8Array(buffer);
        let str = "";
        bytes.forEach((b) => {
          str += String.fromCharCode(b);
        });
        return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      }

      options.challenge = b64urlToUint8Array(options.challenge);
      options.user.id = b64urlToUint8Array(options.user.id);

      if (options.excludeCredentials) {
        options.excludeCredentials = options.excludeCredentials.map((c: any) => ({
          ...c,
          id: b64urlToUint8Array(c.id),
        }));
      }

      const credential = await navigator.credentials.create({
        publicKey: options,
      }) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error("No credential returned");
      }

      const attestation = credential.response as AuthenticatorAttestationResponse;

      const payload = {
        id: credential.id,
        rawId: arrayBufferToB64url(credential.rawId),
        type: credential.type,
        response: {
          attestationObject: arrayBufferToB64url(attestation.attestationObject),
          clientDataJSON: arrayBufferToB64url(attestation.clientDataJSON),
        },
      };

      const result: any = await apiJson("/auth/passkey/register/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: payload,
          device_name: "My Device",
        }),
      });

      if (!result?.access_token) {
        throw new Error("Passkey registered, but no access token was returned");
      }

      setAuthToken(result.access_token);

      sessionStorage.removeItem("twofa_token");
      sessionStorage.removeItem("twofa_username");

      const current = JSON.parse(sessionStorage.getItem("mfa_methods") || "{}");
      current.passkey = true;
      sessionStorage.setItem("mfa_methods", JSON.stringify(current));

      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      console.error("Passkey registration failed", err);
      setError(err?.message || "Passkey registration failed");
      setMsg(null);
    }
  }

  async function beginSetup() {
    setError(null);
    setMsg(null);
    setLoadingBegin(true);

    try {
      const resp = await fetch(`/api/auth/2fa/begin`, {
        method: "POST",
        headers: authHeaders(false),
      });

      const text = await resp.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!resp.ok) {
        throw new Error(`2FA begin failed (HTTP ${resp.status}): ${text}`);
      }

      let derivedSecret = (data?.secret_base32 || data?.secret || "").trim();

      if (!derivedSecret && data?.otpauth_uri) {
        try {
          const u = new URL(data.otpauth_uri);
          derivedSecret = (u.searchParams.get("secret") || "").trim();
        } catch {
          derivedSecret = "";
        }
      }

      let qrDataUrl = (data?.qr_png_data_url || "").trim();
      if (!qrDataUrl) {
        const b64 = (data?.qr_png_base64 || "").trim();
        if (b64) qrDataUrl = `data:image/png;base64,${b64}`;
      }

      if (!qrDataUrl || !derivedSecret) {
        throw new Error(`2FA begin missing fields. Response was: ${text}`);
      }

      setQr(qrDataUrl);
      setSecret(derivedSecret);
      setOtpauthUri(data?.otpauth_uri || "");
      setMsg("QR generated. Scan it with your authenticator app, then enter the 6-digit code.");
    } catch (e: any) {
      setError(e?.message || "Failed to begin 2FA setup");
    } finally {
      setLoadingBegin(false);
    }
  }

  async function confirmSetup(e?: React.FormEvent) {
    e?.preventDefault();

    try {
      setError(null);
      setMsg(null);

      const c = String(code || "").replace(/\s+/g, "").trim();

      const resp = await fetch("/api/auth/2fa/confirm", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ code: c }),
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
          data?.detail?.message ||
          data?.detail ||
          `2FA confirm failed (HTTP ${resp.status})`;
        throw new Error(typeof msg === "string" ? msg : `2FA confirm failed (HTTP ${resp.status})`);
      }

      if (!data?.access_token) {
        throw new Error("2FA confirm succeeded but no access_token was returned");
      }

      setAuthToken(data.access_token);

      sessionStorage.removeItem("twofa_token");
      sessionStorage.removeItem("twofa_username");

      const current = JSON.parse(sessionStorage.getItem("mfa_methods") || "{}");
      current.totp = true;
      sessionStorage.setItem("mfa_methods", JSON.stringify(current));

      navigate("/dashboard", { replace: true });
      return;
    } catch (err: any) {
      console.error("2FA confirmation failed", err);
      setError(err?.message || "2FA confirmation failed");
      setMsg(null);
    }
  }

  async function disable2FA() {
    setError(null);
    setMsg(null);
    setLoadingDisable(true);

    try {
      const resp = await fetch(`/api/auth/2fa/disable`, {
        method: "POST",
        headers: authHeaders(false),
      });

      const text = await resp.text();
      if (!resp.ok) {
        throw new Error(`2FA disable failed (HTTP ${resp.status}): ${text}`);
      }

      setQr(null);
      setSecret("");
      setOtpauthUri("");
      setCode("");
      setMsg("Authenticator app disabled.");
    } catch (e: any) {
      setError(e?.message || "Failed to disable 2FA");
    } finally {
      setLoadingDisable(false);
    }
  }

  function copyToClipboard(value: string) {
    if (!value) return;
    navigator.clipboard?.writeText(value).then(
      () => setMsg("Copied to clipboard."),
      () => setMsg("Copy failed (clipboard blocked).")
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="mx-auto w-full max-w-xl px-4 py-6 space-y-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h1 className="text-lg font-semibold">Security methods</h1>
          <div className="text-sm text-slate-300">
            Choose how you want to verify your sign-in. You can use an authenticator app, a device passkey, or both.
          </div>
        </div>

        {(error || msg) && (
          <div
            className={[
              "rounded-xl border p-3 text-sm",
              error
                ? "border-red-400/40 bg-red-500/10 text-red-200"
                : "border-emerald-500/40 bg-emerald-600/10 text-emerald-100",
            ].join(" ")}
          >
            {error || msg}
          </div>
        )}

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-100">Authenticator app</div>
          <div className="text-xs text-slate-400">
            Use Google Authenticator, Authy, or another compatible app to generate 6-digit codes.
          </div>

          {showTotpSetup ? (
            <>
              <button
                type="button"
                className="rounded-lg border border-emerald-500/40 bg-emerald-600/15 px-4 py-2 text-emerald-100 hover:bg-emerald-600/25 disabled:opacity-60"
                onClick={beginSetup}
                disabled={loadingBegin}
              >
                {loadingBegin ? "Generating…" : "Generate QR code"}
              </button>

              {qr && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                    <div className="mb-2 text-xs text-slate-400">
                      Scan this QR code with your authenticator app:
                    </div>
                    <div className="flex justify-center">
                      <img
                        src={qr}
                        alt="2FA QR code"
                        className="rounded-lg border border-slate-700 bg-white p-2"
                        style={{ width: 240, height: 240 }}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3 space-y-2">
                    <div className="text-xs text-slate-400">Manual entry (if scanning doesn’t work)</div>

                    <div className="text-sm">
                      <div className="text-slate-300">Secret</div>
                      <div className="flex items-center gap-2">
                        <code className="block w-full overflow-auto rounded bg-slate-950 px-3 py-2 text-xs">
                          {secret}
                        </code>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs hover:bg-slate-700"
                          onClick={() => copyToClipboard(secret)}
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    {otpauthUri && (
                      <div className="text-sm">
                        <div className="text-slate-300">otpauth URI</div>
                        <div className="flex items-center gap-2">
                          <code className="block w-full overflow-auto rounded bg-slate-950 px-3 py-2 text-xs">
                            {otpauthUri}
                          </code>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs hover:bg-slate-700"
                            onClick={() => copyToClipboard(otpauthUri)}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={confirmSetup} className="space-y-2">
                    <label className="block text-sm text-slate-200">Enter 6-digit code</label>
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                    <button
                      type="submit"
                      disabled={loadingConfirm}
                      className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100 hover:bg-slate-700 disabled:opacity-60"
                    >
                      {loadingConfirm ? "Confirming…" : "Confirm 2FA"}
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              Authenticator app is enabled.
            </div>
          )}

          {totpEnabled && (
            <div className="pt-2">
              <button
                type="button"
                onClick={disable2FA}
                disabled={loadingDisable}
                className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 text-red-200 hover:bg-red-500/15 disabled:opacity-60"
              >
                {loadingDisable ? "Disabling…" : "Disable authenticator app"}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-100">Device passkey</div>
          <div className="text-xs text-slate-400">
            Use Face ID, Touch ID, Windows Hello, or your device PIN.
          </div>

          {showPasskeySetup ? (
            <button
              type="button"
              onClick={handleAddPasskey}
              className="rounded-lg border border-blue-500/40 bg-blue-600/15 px-4 py-2 text-blue-100 hover:bg-blue-600/25"
            >
              Add passkey
            </button>
          ) : (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              Passkey is enabled.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/40 overflow-hidden">
          <div className="border-b border-slate-700 bg-slate-950/40 p-3 sm:p-4">
            <h2 className="text-lg font-semibold text-slate-100">{TWOFA_NOTE}</h2>
            <div className="mt-1 text-xs text-slate-400">
              {TWOFA_STATEMENT}
              <br />
              <br />
              {TWOFA_STATEMENT2}
            </div>
          </div>
        </div>

        {/* <div className="text-xs text-slate-400">
          Tip: Save your recovery method to avoid lockout.
        </div> */}
      </div>
    </div>
  );
}