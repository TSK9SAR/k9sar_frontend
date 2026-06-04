import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import IdHeadshotModal from "../components/IdHeadshotModal";

function normalizeApiBase(input?: string) {
  const raw = (input ?? "").trim().replace(/\/+$/, "");
  if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
  if (!raw) return `${window.location.origin}/api`;
  if (window.location.protocol === "https:" && raw.startsWith("http://"))
    return raw.replace(/^http:\/\//i, "https://");
  return raw;
}

const api = (path: string) => `/api${path.startsWith("/") ? "" : "/"}${path}`;

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function cleanText(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  if (s.toLowerCase() === "string") return "";
  return s;
}

function parseNumberOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type TeamMineDto = {
  handler_id: number | null;
  handler_status: string | null;
  teams: Array<{
    team_id: number;
    status: string | null;
    dog: {
      dog_id: number;
      name: string;
      breed?: string | null;
      photo_url?: string | null;
      sex?: string | null;
      dob?: string | null;
    };
  }>;
};

type Dog = {
  dog_id?: number;
  name?: string;
  breed?: string | null;
  dob?: string | null;
  photo_url?: string | null;
  sex?: string | null;
};

type SexValue = "" | "Male" | "Male/Neutered" | "Female" | "Female/Spayed" | "Unknown";
const SEX_OPTIONS: Array<{ value: SexValue; label: string }> = [
  { value: "", label: "(unset)" },
  { value: "Male", label: "Male" },
  { value: "Male/Neutered", label: "Male/Neutered" },
  { value: "Female", label: "Female" },
  { value: "Female/Spayed", label: "Female/Spayed" },
  { value: "Unknown", label: "Unknown" },
];

async function readErrorText(resp: Response): Promise<string> {
  const text = await resp.text();
  // try JSON detail first
  try {
    const j = text ? JSON.parse(text) : null;
    if (j?.detail) return typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    if (j?.message) return String(j.message);
    return text || JSON.stringify(j);
  } catch {
    return text;
  }
}


export default function DogsPage() {
  const effectiveBaseUrl = normalizeApiBase((import.meta as any)?.env?.VITE_API_BASE_URL);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const navigate = useNavigate();
  const location = useLocation();

  // list of my teams/dogs
  const [mine, setMine] = useState<TeamMineDto | null>(null);
  const [loadingMine, setLoadingMine] = useState(false);

  // selected dog + form state
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedDogId, setSelectedDogId] = useState<number | null>(null);

  const [dog, setDog] = useState<Dog | null>(null);
  const [loadingDog, setLoadingDog] = useState(false);

  // create mode
  const [mode, setMode] = useState<"edit" | "create">("edit");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // UI
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // list search
  // list search + pagination (client-side)
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [idHeadshotOpen, setIdHeadshotOpen] = useState(false);

  const photoRef = React.useRef<HTMLInputElement | null>(null);

  const openPhotoPicker = () => photoRef.current?.click();

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || !selectedDogId) return;

    const MAX = 25 * 1024 * 1024;
    if (file.size > MAX) {
      setErr(`Photo is too large (${Math.round(file.size / 1024 / 1024)} MB). Max is 25 MB.`);
      return;
    }
    setErr(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("dog_id", String(selectedDogId)); // optional, useful if backend wants context

      const up = await fetch(api(`/documents/upload`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }, // IMPORTANT: no Content-Type
        body: fd,
      });

      const text = await up.text();

      // ✅ Only parse JSON if possible; don't crash on HTML
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!up.ok) {
        throw new Error(
          data?.detail || `Upload failed (HTTP ${up.status}): ${text.slice(0, 200)}`
        );
      }

      const url = data?.download_url;
      if (!url) throw new Error("Upload did not return download_url");

      // update local state so saveDog will persist it
      setDog((p) => (p ? { ...p, photo_url: url } : p));

      // optional: immediately save to DB
      // await saveDog();
    } catch (err: any) {
      setErr(err?.message ?? "Upload failed");
    } finally {
      if (photoRef.current) photoRef.current.value = "";
    }
  };


  const loadMine = async () => {
    if (!token) {
      setErr("Not authenticated.");
      return;
    }
    setLoadingMine(true);
    setErr(null);
    setOk(null);

    try {
      const resp = await fetch(api("/teams/mine?include_inactive=true"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.status === 401) throw new Error("Session expired. Please log in again.");
      if (!resp.ok) throw new Error(await readErrorText(resp));


      const data = (await resp.json()) as TeamMineDto;
      setMine(data);
      setPage(0);

    } catch (e: any) {
      setErr(e?.message ?? "Failed to load my dogs");
    } finally {
      setLoadingMine(false);
    }
  };

  // initial load
  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveBaseUrl]);

  // query params:
  // - /dogs?team_id=..&dog_id=..
  // - /dogs?create=1
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const create = params.get("create");
    if (create === "1" || create === "true") {
      startCreate();
      return;
    }

    const dogId = parseNumberOrNull(params.get("dog_id") ?? "");
    const teamId = parseNumberOrNull(params.get("team_id") ?? "");
    if (dogId && dogId > 0) setSelectedDogId(dogId);
    if (teamId && teamId > 0) setSelectedTeamId(teamId);
    if (dogId && dogId > 0) setMode("edit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    setPage(0);
  }, [q]);


  const myDogRows = useMemo(() => {
    const teams = mine?.teams ?? [];
    const query = q.trim().toLowerCase();

    const rows = teams.map((t) => ({
      team_id: t.team_id,
      team_status: t.status ?? "",
      dog_id: t.dog.dog_id,
      dog_name: t.dog.name ?? "",
      breed: t.dog.breed ?? "",
      photo_url: t.dog.photo_url ?? "",
      sex: t.dog.sex ?? "",
      dob: t.dog.dob ?? null,
    }));

    const filtered = rows.filter((r) => {
      if (!query) return true;
      return (
        String(r.team_id).includes(query) ||
        String(r.dog_id).includes(query) ||
        r.dog_name.toLowerCase().includes(query) ||
        (r.breed ?? "").toLowerCase().includes(query)
      );
    });

    return filtered.sort((a, b) => a.dog_name.localeCompare(b.dog_name));
  }, [mine, q]);

  // client-side pagination
  const totalRows = myDogRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const clampedPage = Math.min(page, totalPages - 1);

  const pagedDogRows = useMemo(() => {
    const start = clampedPage * pageSize;
    return myDogRows.slice(start, start + pageSize);
  }, [myDogRows, clampedPage, pageSize]);

  // keep page in range when filtering shrinks results
  useEffect(() => {
    if (page !== clampedPage) setPage(clampedPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedPage]);


  const loadDog = async (dog_id: number) => {
    if (!token) return;
    if (!dog_id) return;

    setLoadingDog(true);
    setErr(null);
    setOk(null);

    try {
      const resp = await fetch(api(`/dogs/${dog_id}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.status === 401) throw new Error("Session expired. Please log in again.");
      if (!resp.ok) throw new Error(await readErrorText(resp));

      const d = (await resp.json()) as Dog;

      setDog({
        ...d,
        name: cleanText(d.name),
        breed: cleanText(d.breed),
        photo_url: cleanText(d.photo_url),
        sex: (cleanText(d.sex) as any) || "",
        dob: cleanText(d.dob),
      });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load dog");
      setDog(null);
    } finally {
      setLoadingDog(false);
    }
  };

  useEffect(() => {
    if (mode !== "edit") return;
    if (!selectedDogId) return;
    loadDog(selectedDogId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDogId, mode, effectiveBaseUrl]);

  const startCreate = () => {
    setErr(null);
    setOk(null);
    setMode("create");
    setSelectedDogId(null);
    setSelectedTeamId(null);
    setDog({
      name: "",
      breed: "",
      photo_url: "",
      sex: "",
      dob: null,
    });
    navigate("/dogs?create=1", { replace: true });
  };

  const startEdit = (team_id: number, dog_id: number) => {
    setErr(null);
    setOk(null);
    setMode("edit");
    setSelectedTeamId(team_id);
    setSelectedDogId(dog_id);

    const params = new URLSearchParams();
    params.set("team_id", String(team_id));
    params.set("dog_id", String(dog_id));
    navigate(`/dogs?${params.toString()}`, { replace: true });
  };

  const updateField = <K extends keyof Dog>(k: K, v: Dog[K]) => {
    setDog((prev) => (prev ? { ...prev, [k]: v } : prev));
  };

  const saveDog = async () => {
    if (!token || !dog || !selectedDogId) return;

    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      const payload = {
        name: dog.name ?? "",
        breed: dog.breed ?? null,
        photo_url: dog.photo_url ?? null,
        sex: dog.sex ?? null,
        dob: dog.dob ?? null,
      };

      const resp = await fetch(api(`/dogs/${selectedDogId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (resp.status === 401) throw new Error("Session expired. Please log in again.");
      if (!resp.ok) throw new Error(await readErrorText(resp));

      const updated = (await resp.json()) as Dog;
      setDog({
        ...updated,
        name: cleanText(updated.name),
        breed: cleanText(updated.breed),
        photo_url: cleanText(updated.photo_url),
        sex: (cleanText(updated.sex) as any) || "",
        dob: cleanText(updated.dob),
      });

      setOk("Dog updated.");
      await loadMine();
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  async function postTeamAttach(
    apiBase: string,
    token: string,
    payload: { dog_id: number; status: string; handler_id?: number }
  ) {
    const resp = await fetch(`${apiBase}/teams/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    // success
    if (resp.ok) return { ok: true, resp };

    const text = await resp.text();

    // If backend says "team already exists" (often 409 or 400), treat as success
    if (
      resp.status === 409 ||
      /already exists/i.test(text) ||
      /team already exists/i.test(text)
    ) {
      return { ok: true, resp, already: true, text };
    }

    return { ok: false, resp, text };
  }

  // ✅ New: create dog, then ALWAYS try POST /teams.
  // If backend Option B is correct, /teams will auto-create handler.
  // If /teams still requires handler_id, you'll see that exact backend error.
  const createDogAndAttachToMe = async () => {
    if (!token || !dog) return;

    if (!cleanText(dog.name)) {
      setErr("Dog name is required.");
      return;
    }

    setCreating(true);
    setErr(null);
    setOk(null);

    try {
      // 1) Create dog
      const createPayload = {
        name: dog.name ?? "",
        breed: dog.breed ?? null,
        photo_url: dog.photo_url ?? null,
        sex: dog.sex ?? null,
        dob: dog.dob ?? null,
      };

      const respDog = await fetch(api("/dogs/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createPayload),
      });

      if (respDog.status === 401) throw new Error("Session expired. Please log in again.");
      if (!respDog.ok) throw new Error(await readErrorText(respDog));


      const created = (await respDog.json()) as Dog;
      const newDogId = created.dog_id;
      if (!newDogId) throw new Error("Create dog succeeded but response did not include dog_id.");


      // 2) Attach via team (idempotent)
      const attach = await postTeamAttach(effectiveBaseUrl, token, {
        dog_id: newDogId,
        status: "active",
      });


      if (!attach.ok) {
        if (attach.resp.status === 401) throw new Error("Session expired. Please log in again.");
        throw new Error(attach.text || "Failed to create/attach team");
      }

      setOk("Dog created and added to your teams.");

      // 3) Reload mine
      await loadMine();

      // Re-fetch mine to get handler_id (backend may auto-create it now, but schema still requires it)
      const mineNow = await (async () => {
        const r = await fetch(`${effectiveBaseUrl}/teams/mine?include_inactive=true`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.status === 401) throw new Error("Session expired. Please log in again.");
        if (!r.ok) throw new Error(await readErrorText(r));

        return (await r.json()) as TeamMineDto;
      })();

      const handler_id = mineNow?.handler_id ?? null;
      if (!handler_id) {
        throw new Error(
          "Dog created, but handler_id is still missing. Backend must either: (1) provide handler self-create, or (2) ensure teams/mine returns handler_id after auto-create."
        );
      }

      // 2) Attach dog to me (create team)
      // NOTE: backend may reply "Team already exists for this dog" (treat as success)
      const respTeam = await fetch(`${effectiveBaseUrl}/teams/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dog_id: newDogId,
          handler_id: mine?.handler_id ?? undefined, // if backend requires it, send when present
          status: "active",
        }),
      });

      if (respTeam.status === 401) throw new Error("Session expired. Please log in again.");

      // If backend says team already exists, treat it as OK and continue.
      if (!respTeam.ok) {
        const text = await readErrorText(respTeam);

        const alreadyExists =
          text.includes("Team already exists for this dog") ||
          text.includes("team already exists") ||
          text.includes("already exists");

        if (!alreadyExists) {
          throw new Error(text);
        }
      }


      const row = mineNow?.teams?.find((t) => t.dog?.dog_id === newDogId);
      const newTeamId = row?.team_id ?? null;

      setMode("edit");
      setSelectedDogId(newDogId);
      setSelectedTeamId(newTeamId);

      const params = new URLSearchParams();
      if (newTeamId) params.set("team_id", String(newTeamId));
      params.set("dog_id", String(newDogId));
      navigate(`/dogs?${params.toString()}`, { replace: true });

      await loadDog(newDogId);
    } catch (e: any) {
      setErr(e?.message ?? "Create dog failed");
    } finally {
      setCreating(false);
    }
  };

  const headerTitle = mode === "create" ? "Create Dog" : "Dog Profile";

  return (
    <PageContainer maxWidth="full" className="space-y-6 py-6">
      <div className="mx-auto w-full text-left space-y-4">
        {/* Header */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">
                <span className="text-emerald-300">TSK9SAR</span>{" "}
                <span className="text-slate-100">My Dogs</span>
              </h1>
              <div className="text-xs text-slate-300 mt-1">
                Manage dogs connected to you via teams, or create a new dog and add it to your teams.
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={loadMine}
                className="px-3 py-1.5 rounded-full text-sm border transition-colors bg-slate-700 text-slate-100 border-slate-500 hover:border-slate-400"
              >
                Refresh
              </button>

              <button
                type="button"
                onClick={startCreate}
                className="px-3 py-1.5 rounded-full text-sm border transition-colors bg-slate-700 text-slate-100 border-emerald-600 hover:border-emerald-400"
              >
                New dog
              </button>
            </div>
          </div>
        </div>

        {err && (
          <div className="text-sm text-red-200 bg-red-900/30 border border-red-800 rounded-xl p-3 whitespace-pre-wrap">
            {err}
          </div>
        )}
        {ok && (
          <div className="text-sm text-emerald-200 bg-emerald-900/30 border border-emerald-800 rounded-xl p-3">
            {ok}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left: My dogs list */}
          <div className="md:col-span-1 bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">My dogs</div>
              {loadingMine && <div className="text-xs text-slate-300">Loading…</div>}
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search dog / breed / id…"
              className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
            />

            {totalRows === 0 && !loadingMine && (
              <div className="text-sm text-slate-300">
                No dogs found. Click <span className="text-slate-100 font-medium">New dog</span> to add one.
              </div>
            )}

            <div className="max-h-[28rem] overflow-auto border border-slate-700 rounded-lg">
              {pagedDogRows.map((r) => {
                const active = mode === "edit" && selectedDogId === r.dog_id;
                const inactive = (r.team_status ?? "").toLowerCase() === "inactive";
                return (
                  <button
                    key={`${r.team_id}-${r.dog_id}`}
                    type="button"
                    onClick={() => startEdit(r.team_id, r.dog_id)}
                    className={classNames(
                      "w-full text-left px-3 py-2 border-b bg-slate-800 border-slate-700 hover:bg-slate-700/40",
                      active && "bg-slate-700/60"
                    )}
                    title={`Team #${r.team_id} • Dog #${r.dog_id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm text-slate-100 font-medium truncate">
                          {r.dog_name} <span className="text-slate-400">#{r.dog_id}</span>
                        </div>
                        <div className="text-xs text-slate-300 truncate">
                          {r.breed ? r.breed : "—"}
                          {r.sex ? ` • ${r.sex}` : ""}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Team #{r.team_id}
                          {r.team_status ? ` • ${r.team_status}` : ""}
                          {inactive ? " (inactive)" : ""}
                        </div>
                      </div>

                      {r.photo_url ? (
                        <img
                          src={r.photo_url}
                          alt={r.dog_name}
                          className="w-10 h-10 rounded-md object-cover border border-slate-700"
                        />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Dog form */}
          <div className="md:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-100">
                {headerTitle}
              </div>

              {mode === "edit" && selectedDogId && (
                <div className="flex items-center gap-2">
                  <div className="text-xs text-slate-300">
                    Dog #{selectedDogId}
                    {selectedTeamId ? ` • Team #${selectedTeamId}` : ""}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIdHeadshotOpen(true)}
                    className="px-3 py-1.5 rounded-lg text-sm border border-slate-600 bg-slate-700 text-slate-100 hover:bg-slate-600"
                  >
                    Upload ID Headshot
                  </button>
                </div>
              )}
            </div>

            {loadingDog && <div className="text-sm text-slate-200">Loading dog…</div>}

            {!dog && mode === "edit" && !loadingDog && (
              <div className="text-sm text-slate-300">
                Select a dog from the left list (or click <span className="text-slate-100 font-medium">New dog</span>).
              </div>
            )}

            {dog && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Name</label>
                    <input
                      value={dog.name ?? ""}
                      onChange={(e) => updateField("name", e.target.value)}
                      className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Date of Birth</label>
                    <input
                      value={dog.dob ?? ""}
                      onChange={(e) => updateField("dob", e.target.value)}
                      className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Breed</label>
                    <input
                      value={dog.breed ?? ""}
                      onChange={(e) => updateField("breed", e.target.value)}
                      className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Sex</label>
                    <select
                      value={(dog.sex ?? "") as SexValue}
                      onChange={(e) => updateField("sex", e.target.value)}
                      className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                    >
                      {SEX_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button type="button" onClick={openPhotoPicker}
                    className="px-4 py-2 rounded-lg text-sm border border-slate-600 bg-slate-700 text-slate-100 hover:bg-slate-700/40"
                  >
                    Upload photo
                  </button>

                  <input
                    ref={photoRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handlePhoto}
                  />

                </div>

                {dog.photo_url ? (
                  <div className="pt-2">
                    <img
                      src={dog.photo_url}
                      alt={dog.name ?? "Dog"}
                      className="w-full max-h-64 object-cover rounded-xl border border-slate-700"
                    />
                  </div>
                ) : null}

                <div className="flex justify-end gap-2 pt-2">
                  {mode === "create" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setErr(null);
                          setOk(null);
                          setMode("edit");
                          setDog(null);
                          navigate("/dogs", { replace: true });
                        }}
                        className="px-4 py-2 rounded-lg text-sm border border-slate-600 bg-slate-700 text-slate-100 hover:border-slate-400"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={createDogAndAttachToMe}
                        disabled={creating}
                        className={classNames(
                          "px-4 py-2 rounded-lg text-sm border",
                          "border-emerald-700 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/40",
                          creating && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        {creating ? "Creating…" : "Create & add to my teams"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={saveDog}
                      disabled={saving || !selectedDogId}
                      className={classNames(
                        "px-4 py-2 rounded-lg text-sm border",
                        "border-emerald-700 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/40",
                        (saving || !selectedDogId) && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  )}
                  {idHeadshotOpen && selectedDogId && (
                    <IdHeadshotModal
                      kind="dog"
                      entityId={selectedDogId}
                      title="Dog ID Headshot"
                      onClose={() => setIdHeadshotOpen(false)}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {!token && (
          <div className="text-sm text-slate-200 bg-slate-800 border border-slate-700 rounded-xl p-4">
            Not authenticated.
          </div>
        )}
      </div>
    </PageContainer>
  );
}
