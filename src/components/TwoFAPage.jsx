import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function TwoFAPage() {
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [loadingDisable, setLoadingDisable] = useState(false);
  const [disableError, setDisableError] = useState(null);

  const [welcomeName, setWelcomeName] = useState("");
  const [loadingPasskey, setLoadingPasskey] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const twofaToken = sessionStorage.getItem("twofa_token");
  const [showDisableMfaModal, setShowDisableMfaModal] = useState(false);


  const mfaMethods = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("mfa_methods") || "{}");
    } catch {
      return {};
    }
  }, []);

  const hasTotp = !!mfaMethods?.totp;
  const hasPasskey = !!mfaMethods?.passkey;

  useEffect(() => {
    if (!twofaToken) {
      navigate("/login", { replace: true });
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    let alive = true;

    (async () => {
      try {
        const resp = await fetch("/api/users/info", { headers: authHeaders(false) });
        if (!resp.ok) return;

        const info = await resp.json();
        const name =
          info?.display_name ||
          [info?.first_name, info?.last_name].filter(Boolean).join(" ") ||
          info?.email ||
          "";

        if (alive) setWelcomeName(name);
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate, twofaToken]);

  function authHeaders(withJson = true) {
    const token = localStorage.getItem("token");
    const h = {};
    if (withJson) h["Content-Type"] = "application/json";
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }

  function setAuthToken(accessToken) {
    localStorage.setItem("token", accessToken);
  }

  function finishLogin(accessToken) {
    localStorage.setItem("token", accessToken);
    sessionStorage.removeItem("twofa_token");
    sessionStorage.removeItem("twofa_username");
    navigate("/dashboard", { replace: true });
  }

  async function handleDisableMfa() {
    setDisableError(null);
    setShowDisableMfaModal(true);
  }

  async function confirmDisableMfa() {
    try {
      setLoadingDisable(true);
      setDisableError(null);

      if (!disablePassword?.trim()) {
        throw new Error("Please enter your password.");
      }

      const reauthResp = await fetch("/api/auth/reauth/password", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ password: disablePassword }),
      });

      const reauthText = await reauthResp.text();
      let reauthData = null;
      try {
        reauthData = reauthText ? JSON.parse(reauthText) : null;
      } catch {
        reauthData = null;
      }

      if (!reauthResp.ok) {
        const msg =
          (reauthData && (reauthData.detail?.message || reauthData.detail)) ||
          `Re-auth failed (HTTP ${reauthResp.status})`;
        throw new Error(typeof msg === "string" ? msg : `Re-auth failed (HTTP ${reauthResp.status})`);
      }

      if (!reauthData?.access_token) {
        throw new Error("Re-auth response did not contain access_token");
      }

      const newToken = reauthData.access_token;
      setAuthToken(newToken);

      const endpoint =
        hasPasskey && !hasTotp
          ? "/api/auth/passkey/disable"
          : "/api/auth/2fa/totp/disable";

      const disableResp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`,
        },
      });

      const disableText = await disableResp.text();
      let disableData = null;
      try {
        disableData = disableText ? JSON.parse(disableText) : null;
      } catch {
        disableData = null;
      }

      if (!disableResp.ok) {
        const msg =
          (disableData && (disableData.detail?.message || disableData.detail)) ||
          `Disable failed (HTTP ${disableResp.status})`;
        throw new Error(typeof msg === "string" ? msg : `Disable failed (HTTP ${disableResp.status})`);
      }

      if (disableData?.access_token) {
        setAuthToken(disableData.access_token);
      }

      const updated = { ...mfaMethods };
      if (hasPasskey && !hasTotp) {
        updated.passkey = false;
      } else if (hasTotp && !hasPasskey) {
        updated.totp = false;
      } else {
        updated.passkey = false;
        updated.totp = false;
      }

      sessionStorage.setItem("mfa_methods", JSON.stringify(updated));
      sessionStorage.removeItem("twofa_token");
      sessionStorage.removeItem("twofa_username");

      setShowDisableMfaModal(false);
      setDisablePassword("");
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setDisableError(e?.message ?? "Failed to disable MFA");
    } finally {
      setLoadingDisable(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const twofa_token = sessionStorage.getItem("twofa_token");
      if (!twofa_token) {
        throw new Error("Missing 2FA token. Please log in again.");
      }

      const normalizedCode = String(code || "").replace(/\s+/g, "").trim();

      const resp = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twofa_token, code: normalizedCode }),
      });

      const text = await resp.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!resp.ok) {
        const msg =
          (data && (data.detail?.message || data.detail)) ||
          `2FA verify failed (HTTP ${resp.status})`;
        throw new Error(typeof msg === "string" ? msg : `2FA verify failed (HTTP ${resp.status})`);
      }

      if (!data?.access_token) {
        throw new Error("2FA verify response did not contain access_token");
      }

      finishLogin(data.access_token);
    } catch (err) {
      setError(err?.message || "2FA verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasskeyMfa() {
    try {
      setError(null);
      setLoadingPasskey(true);

      const twofaToken = sessionStorage.getItem("twofa_token");
      if (!twofaToken) {
        throw new Error("Missing 2FA token");
      }

      const token = localStorage.getItem("token");

      function b64urlToUint8Array(base64url) {
        const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
        const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(base64);
        return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
      }

      function arrayBufferToB64url(buffer) {
        if (!buffer) return null;
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        let str = "";
        bytes.forEach((b) => {
          str += String.fromCharCode(b);
        });
        return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      }

      const startResp = await fetch("/api/auth/passkey/authenticate/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          twofa_token: twofaToken,
        }),
      });

      const startText = await startResp.text();

      let options = null;
      try {
        options = startText ? JSON.parse(startText) : null;
      } catch {
        throw new Error(`authenticate/start returned non-JSON: ${startText}`);
      }

      if (!startResp.ok) {
        throw new Error(
          options?.detail
            ? typeof options.detail === "string"
              ? options.detail
              : JSON.stringify(options.detail)
            : `authenticate/start failed (${startResp.status})`
        );
      }

      options.challenge = b64urlToUint8Array(options.challenge);

      if (options.allowCredentials) {
        options.allowCredentials = options.allowCredentials.map((c) => ({
          ...c,
          id: b64urlToUint8Array(c.id),
        }));
      }

      const credential = await navigator.credentials.get({
        publicKey: options,
      });

      if (!credential) {
        throw new Error("No passkey credential returned");
      }

      const assertion = credential.response;

      const payload = {
        id: credential.id,
        rawId: arrayBufferToB64url(credential.rawId),
        type: credential.type,
        response: {
          authenticatorData: arrayBufferToB64url(assertion.authenticatorData),
          clientDataJSON: arrayBufferToB64url(assertion.clientDataJSON),
          signature: arrayBufferToB64url(assertion.signature),
          userHandle: arrayBufferToB64url(assertion.userHandle),
        },
      };

      const finishResp = await fetch("/api/auth/passkey/authenticate/finish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          twofa_token: twofaToken,
          credential: payload,
        }),
      });

      const finishText = await finishResp.text();

      let result = null;
      try {
        result = finishText ? JSON.parse(finishText) : null;
      } catch {
        throw new Error(`authenticate/finish returned non-JSON: ${finishText}`);
      }

      if (!finishResp.ok) {
        throw new Error(
          result?.detail
            ? typeof result.detail === "string"
              ? result.detail
              : JSON.stringify(result.detail)
            : `authenticate/finish failed (${finishResp.status})`
        );
      }

      if (!result?.access_token) {
        throw new Error("Passkey verification did not return access_token");
      }

      finishLogin(result.access_token);
    } catch (err) {
      console.error("Passkey MFA failed:", err);
      setError(err?.message || String(err));
    } finally {
      setLoadingPasskey(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h2 style={{ color: "#04a104" }}>
        Welcome {welcomeName || "!"}
        <br />
        you logged in successfully!
        <br />
        <br />
      </h2>

      {hasPasskey && !hasTotp && (
        <h2>Use your passkey to finish signing in.</h2>
      )}

      {hasPasskey && (
        <button
          type="button"
          onClick={handlePasskeyMfa}
          disabled={loadingPasskey}
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 16,
            backgroundColor: "#1c4d1c",
            color: "white",
          }}
        >
          {loadingPasskey ? "Waiting for passkey…" : "Use Passkey / Face ID"}
        </button>
      )}

      {hasTotp && (
        <>
          <h2>To verify Two-Factor Authentication, enter the 6-digit code from your authenticator app:</h2>

          <form onSubmit={handleVerify}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              style={{
                backgroundColor: "#313e80",
                width: "100%",
                padding: 10,
                fontSize: 18,
                marginBottom: 12,
              }}
            />

            {error && <div style={{ color: "crimson", marginTop: 10 }}>{error}</div>}

            <h2>...and click Verify</h2>
            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: "#1c4d1c",
                width: "100%",
                padding: 10,
              }}
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
          </form>
        </>
      )}

      {!hasTotp && !hasPasskey && (
        <div style={{ color: "crimson", marginTop: 10 }}>
          No verification methods are available. Please go back and set up MFA again.
        </div>
      )}

      {!hasTotp && !hasPasskey ? null : error ? (
        <div style={{ color: "crimson", marginTop: 10 }}>{error}</div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          sessionStorage.removeItem("twofa_token");
          sessionStorage.removeItem("twofa_username");
          navigate("/dashboard", { replace: true });
        }}
        style={{
          marginTop: 50,
          width: "100%",
          padding: 10,
          backgroundColor: "#821f1f",
          color: "white",
        }}
      >
        Skip for now
      </button>

      <div>
        It is OK to skip Multi Factor Authorization unless you need to issue a certification or update your signature.
        <br />
        <br />
      </div>

      <div>
        <p>
          {hasPasskey && !hasTotp
            ? "Click Disable passkey below if you want to remove your passkey and start over."
            : hasTotp && !hasPasskey
              ? "Click Disable authenticator below if you no longer want to use your authenticator app."
              : "Click Disable MFA below if you want to remove your current verification methods and start over."}
        </p>
      </div>

      {disableError && <div style={{ color: "crimson", marginTop: 10 }}>{disableError}</div>}

      <div className="pt-2">
        <button
          type="button"
          onClick={handleDisableMfa}
          disabled={loadingDisable}
          className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 text-red-200 hover:bg-red-500/15 disabled:opacity-60"
          title="Disable MFA"
        >
          {loadingDisable
            ? "Disabling…"
            : hasPasskey && !hasTotp
              ? "Disable passkey"
              : hasTotp && !hasPasskey
                ? "Disable authenticator"
                : "Disable MFA"}
        </button>
      </div>

      {showDisableMfaModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-3">
              Confirm MFA Disable
            </h2>

            <p className="text-sm text-slate-300 mb-3">
              Enter your current password to disable MFA.
            </p>

            <input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Password"
            />

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowDisableMfaModal(false);
                  setDisablePassword("");
                }}
                className="
      px-3 py-1.5 text-sm rounded-lg
      border border-slate-600
      bg-slate-700 text-slate-200
      hover:bg-slate-600
      focus:outline-none focus:ring-2 focus:ring-slate-400/50
      transition
    "
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDisableMfa}
                className="
      px-3 py-1.5 text-sm rounded-lg
      bg-red-600 text-white
      hover:bg-red-500
      focus:outline-none focus:ring-2 focus:ring-red-400/50
      disabled:opacity-50 disabled:cursor-not-allowed
      transition
    "
                disabled={loadingDisable || !disablePassword?.trim()}
              >
                {loadingDisable ? "Disabling…" : "Disable MFA"}
              </button>
            </div>
          </div>
        </div>
      )
      }
    </div>
  );
}