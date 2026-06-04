// src/components/FileUploader.tsx
import React, { useState } from "react";

export default function FileUploader(props: { teamId?: number; dogId?: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function upload() {
    if (!file) return;

    const MAX = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX) {
      setErr(`File is too large (${Math.round(file.size / 1024 / 1024)} MB). Max is 25 MB.`);
      return;
    }

    setBusy(true);
    setErr(null);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);

    const qs = new URLSearchParams();
    if (props.teamId) qs.set("team_id", String(props.teamId));
    if (props.dogId) qs.set("dog_id", String(props.dogId));

    const token = localStorage.getItem("token");
    const api = (path: string) => `/api${path.startsWith("/") ? "" : "/"}${path}`;
    const url = api(`/documents/upload${qs.toString() ? `?${qs}` : ""}`);

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });

      const text = await resp.text();
      const ct = resp.headers.get("content-type") || "";

      console.log("UPLOAD", resp.status, ct, url);

      let data: any = null;
      if (ct.includes("application/json")) {
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = null;
        }
      }

      if (!resp.ok) {
        throw new Error(
          data?.detail ||
            `Upload failed (HTTP ${resp.status}): ${text.slice(0, 200)}`
        );
      }

      const downloadUrl = data?.download_url;
      if (!downloadUrl) {
        throw new Error(`Upload response missing download_url: ${text.slice(0, 200)}`);
      }

      setResult(data);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
      <div className="text-slate-100 font-semibold">Upload a file</div>

      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-slate-200"
      />

      <button
        type="button"
        onClick={upload}
        disabled={!file || busy}
        className="px-4 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-100 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Upload"}
      </button>

      {err && <div className="text-red-300 text-sm">{err}</div>}

      {result && (
        <div className="text-slate-200 text-sm">
          <div>Saved: {result.original_filename}</div>
          <a className="text-emerald-300 underline" href={result.download_url} target="_blank" rel="noreferrer">
            Open downloaded file
          </a>
        </div>
      )}
    </div>
  );
}
