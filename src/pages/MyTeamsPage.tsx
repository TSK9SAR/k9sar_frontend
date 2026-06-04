import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import { apiJson } from "../lib/api";
import IdCardPrintDialog from "../components/IdCardPrintDialog";
import {
  IdentificationIcon,
  PrinterIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";

function isInactive(status: string | null | undefined) {
  return (status ?? "").toLowerCase() === "inactive";
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type MyTeamsDto = {
  handler_id: number | null;
  handler_status: string | null;
  teams: Array<{
    team_id: number;
    status: string | null;
    dog: { dog_id: number; name: string; breed?: string | null; photo_url?: string | null };
  }>;
};

type DogLite = {
  dog_id: number;
  name: string;
  breed?: string | null;
  photo_url?: string | null;
};

type TeamRow = MyTeamsDto["teams"][number];

type TeamStatus = "active" | "suspended" | "retired";
const TEAM_STATUSES: TeamStatus[] = ["active", "suspended", "retired"];

const DOG_PAGE_PATH = "/dogs";
const DOG_CREATE_PATH = "/dogs?create=1";

export default function MyTeamsPage() {
  const navigate = useNavigate();

  const [data, setData] = useState<MyTeamsDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Create team panel
  const [addOpen, setAddOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<TeamStatus>("active");
  const [adding, setAdding] = useState(false);

  // Dog search/select
  const [dogQuery, setDogQuery] = useState("");
  const [dogResults, setDogResults] = useState<DogLite[]>([]);
  const [dogSearching, setDogSearching] = useState(false);
  const [selectedDog, setSelectedDog] = useState<DogLite | null>(null);

  // Row ops
  const [deletingTeamIds, setDeletingTeamIds] = useState<number[]>([]);
  const [updatingTeamIds, setUpdatingTeamIds] = useState<number[]>([]);

  const [printTeamId, setPrintTeamId] = useState<number | null>(null);

  const goAddDog = () => navigate(DOG_CREATE_PATH);

  const load = async () => {
    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const dto = (await apiJson<MyTeamsDto>("/teams/mine?include_inactive=true")) as MyTeamsDto;
      setData(dto);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load my teams");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleStatus = (s: string) => {
    setSelectedStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const teams = useMemo(() => {
    const all = data?.teams ?? [];
    const query = q.trim().toLowerCase();

    return all.filter((t) => {
      const matchesQ =
        !query ||
        `${t.team_id}`.includes(query) ||
        (t.dog?.name ?? "").toLowerCase().includes(query) ||
        (t.dog?.breed ?? "").toLowerCase().includes(query);

      const st = (t.status ?? "").toLowerCase();
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.some((x) => st === x);

      return matchesQ && matchesStatus;
    });
  }, [data, q, selectedStatuses]);

  const pillStatuses = ["active", "suspended", "inactive", "retired", "(unset)"];

  const openDogForTeam = (t: TeamRow) => {
    const params = new URLSearchParams();
    params.set("team_id", String(t.team_id));
    if (t.dog?.dog_id) params.set("dog_id", String(t.dog.dog_id));
    navigate(`${DOG_PAGE_PATH}?${params.toString()}`);
  };

  // ---------- Dog search ----------
  const searchDogs = async (queryRaw: string) => {
    const query = queryRaw.trim();
    if (!query) {
      setDogResults([]);
      return;
    }

    setDogSearching(true);
    setErr(null);

    try {
      const rows = (await apiJson<DogLite[]>(`/dogs/search?q=${encodeURIComponent(query)}`)) as DogLite[];
      setDogResults((rows ?? []).slice(0, 20));
    } catch (e: any) {
      setErr(e?.message ?? "Dog search failed");
      setDogResults([]);
    } finally {
      setDogSearching(false);
    }
  };

  useEffect(() => {
    if (!addOpen) return;
    const t = window.setTimeout(() => searchDogs(dogQuery), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dogQuery, addOpen]);

  const resetCreatePanel = () => {
    setAddOpen(false);
    setNewStatus("active");
    setDogQuery("");
    setDogResults([]);
    setSelectedDog(null);
  };

  async function ensureHandlerId(): Promise<number> {
    // POST /api/handlers/ensure -> { handler_id: number }
    const r: any = await apiJson("/handlers/ensure", { method: "POST" });
    const id = r?.handler_id ?? r?.handler?.handler_id;
    if (!id) throw new Error("Handler ensure did not return handler_id");
    return id;
  }

  const createTeam = async () => {
    if (!selectedDog) {
      setErr("Please search and select a dog first.");
      return;
    }

    setAdding(true);
    setErr(null);
    setOk(null);

    try {
      // Ensure handler exists (idempotent)
      const handler_id = data?.handler_id ?? (await ensureHandlerId());

      // Make UI immediately reflect handler existence
      setData((prev) =>
        prev ? { ...prev, handler_id, handler_status: prev.handler_status ?? "active" } : prev
      );

      const payload = { handler_id, dog_id: selectedDog.dog_id, status: newStatus };

      await apiJson("/teams/", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      setOk("Team created.");
      resetCreatePanel();
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create team");
    } finally {
      setAdding(false);
    }
  };

  const toggleTeamActive = async (t: TeamRow) => {
    const inactive = isInactive(t.status);

    if (!inactive) {
      const yes = window.confirm(`Deactivate team #${t.team_id}?`);
      if (!yes) return;

      setErr(null);
      setOk(null);

      const prev = data;
      setDeletingTeamIds((p) => [...p, t.team_id]);
      setData((d) => {
        if (!d) return d;
        return {
          ...d,
          teams: d.teams.map((x) => (x.team_id === t.team_id ? { ...x, status: "inactive" } : x)),
        };
      });

      try {
        await apiJson(`/teams/${t.team_id}`, { method: "DELETE" });
        setOk(`Team #${t.team_id} deactivated.`);
      } catch (e: any) {
        setData(prev ?? null);
        setErr(e?.message ?? "Failed to deactivate team");
      } finally {
        setDeletingTeamIds((p) => p.filter((x) => x !== t.team_id));
      }
      return;
    }

    const yes = window.confirm(`Activate team #${t.team_id}?`);
    if (!yes) return;

    setErr(null);
    setOk(null);

    // If for any reason handler_id is missing, ensure it
    let handler_id = data?.handler_id ?? null;
    if (!handler_id) {
      try {
        handler_id = await ensureHandlerId();
        setData((prev) => (prev ? { ...prev, handler_id } : prev));
      } catch (e: any) {
        setErr(e?.message ?? "Could not ensure handler.");
        return;
      }
    }

    const prev = data;
    setUpdatingTeamIds((p) => [...p, t.team_id]);
    setData((d) => {
      if (!d) return d;
      return {
        ...d,
        teams: d.teams.map((x) => (x.team_id === t.team_id ? { ...x, status: "active" } : x)),
      };
    });

    try {
      const payload = { handler_id, dog_id: t.dog.dog_id, status: "active", team_id: t.team_id };

      await apiJson(`/teams/${t.team_id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      setOk(`Team #${t.team_id} activated.`);
    } catch (e: any) {
      setData(prev ?? null);
      setErr(e?.message ?? "Failed to activate team");
    } finally {
      setUpdatingTeamIds((p) => p.filter((x) => x !== t.team_id));
    }
  };

  const updateTeamStatus = async (t: TeamRow, nextStatus: TeamStatus) => {
    setErr(null);
    setOk(null);

    let handler_id = data?.handler_id ?? null;
    if (!handler_id) {
      // In practice this page won’t show teams without a handler,
      // but keep it safe.
      try {
        handler_id = await ensureHandlerId();
        setData((prev) => (prev ? { ...prev, handler_id } : prev));
      } catch (e: any) {
        setErr(e?.message ?? "Could not ensure handler.");
        return;
      }
    }

    const prev = data;
    setUpdatingTeamIds((p) => [...p, t.team_id]);
    setData((d) => {
      if (!d) return d;
      return {
        ...d,
        teams: d.teams.map((x) => (x.team_id === t.team_id ? { ...x, status: nextStatus } : x)),
      };
    });

    try {
      const payload = { handler_id, dog_id: t.dog.dog_id, status: nextStatus, team_id: t.team_id };

      await apiJson(`/teams/${t.team_id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      setOk(`Team #${t.team_id} updated.`);
    } catch (e: any) {
      setData(prev ?? null);
      setErr(e?.message ?? "Failed to update team");
    } finally {
      setUpdatingTeamIds((p) => p.filter((x) => x !== t.team_id));
    }
  };

  const ActionButtons = ({
    t,
    compact = false,
  }: {
    t: TeamRow;
    compact?: boolean;
  }) => {

    const deleting = deletingTeamIds.includes(t.team_id);
    const updating = updatingTeamIds.includes(t.team_id);
    const inactive = isInactive(t.status);

    return (
      <div
        className={classNames(
          "flex flex-wrap items-center gap-2",
          !compact && "mt-4"
        )}
      >
        <button
          type="button"
          onClick={() => openDogForTeam(t)}
          className="px-3 py-1.5 rounded-full text-sm border transition-colors bg-slate-700 text-slate-100 border-slate-500 hover:border-slate-400"
        >
          Open dog
        </button>

        <select
          value={(t.status ?? "") as any}
          onChange={(e) => updateTeamStatus(t, e.target.value as TeamStatus)}
          disabled={updating || inactive}
          className={classNames(
            "px-3 py-1.5 rounded-full text-sm border transition-colors",
            "bg-slate-700 text-slate-100 border-slate-500 hover:border-slate-400",
            (updating || inactive) && "opacity-60 cursor-not-allowed"
          )}
          title={inactive ? "Activate team to edit status" : "Update team status"}
        >
          {!t.status && <option value="">(unset)</option>}
          {TEAM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => toggleTeamActive(t)}
          disabled={deleting || updating}
          className={classNames(
            "px-3 py-1.5 rounded-full text-sm border transition-colors",
            inactive
              ? "bg-emerald-900/30 text-emerald-200 border-emerald-800 hover:bg-emerald-900/40"
              : "bg-red-900/30 text-red-200 border-red-800 hover:bg-red-900/40",
            (deleting || updating) && "opacity-60 cursor-not-allowed"
          )}
        >
          {inactive ? "Activate" : deleting ? "Deactivating…" : "Deactivate"}
        </button>
        <button
          type="button"
          onClick={() => setPrintTeamId(t.team_id)}
          className="px-3 py-1.5 rounded-lg text-sm border border-blue-700 bg-blue-900/30 text-blue-200 hover:bg-blue-900/40"
        >
          View / Print ID
        </button>
      </div>
    );
  };

  const canCreate = !!selectedDog && !adding;

  return (
    <PageContainer maxWidth="2xl" className="space-y-6 py-6">
      <div className="mx-auto w-full  text-left space-y-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">
                <span className="text-emerald-300">TSK9SAR</span>{" "}
                <span className="text-slate-100">My Teams</span>
              </h1>
              <div className="text-xs text-slate-300 mt-1">
                Dogs are managed through teams. Your handler status applies across all teams.
              </div>

              {data?.handler_status && (
                <div className="mt-2 text-xs">
                  <span className="text-slate-300">Handler status:</span>{" "}
                  <span className="text-emerald-200 font-medium">{data.handler_status}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setErr(null);
                setOk(null);
                setAddOpen((v) => !v);
              }}
              className="px-3 py-1.5 rounded-full text-sm border transition-colors bg-slate-700 text-slate-100 border-emerald-600 hover:border-emerald-400"
            >
              {addOpen ? "Close" : "Add team"}
            </button>
          </div>

          {addOpen && (
            <div className="mt-4 bg-slate-900/30 border border-slate-700 rounded-xl p-3 space-y-3">
              <div>
                <div className="text-sm text-slate-100 font-medium">Create team</div>
                <div className="text-xs text-slate-300 mt-1">
                  Search for a dog and select it, then create a team. If you don’t have a handler yet, one will be created automatically.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={goAddDog}
                  className="px-4 py-2 rounded-lg text-sm border border-sky-700 bg-sky-900/30 text-sky-200 hover:bg-sky-900/40"
                >
                  Add a new Dog
                </button>
                <button
                  type="button"
                  onClick={load}
                  className="px-4 py-2 rounded-lg text-sm border border-slate-600 bg-slate-700 text-slate-100 hover:border-slate-400"
                  title="Refresh teams"
                >
                  Refresh
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-slate-300">Search dog</label>
                <input
                  value={dogQuery}
                  onChange={(e) => {
                    setDogQuery(e.target.value);
                    setSelectedDog(null);
                  }}
                  placeholder="Type dog name or breed…"
                  className="w-full md:w-[28rem] rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                />

                {dogSearching && <div className="text-xs text-slate-300">Searching…</div>}

                {selectedDog && (
                  <div className="flex items-center justify-between gap-2 bg-slate-900/30 border border-slate-700 rounded-lg p-2">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-100 font-medium truncate">
                        Selected: {selectedDog.name}{" "}
                        <span className="text-slate-400">#{selectedDog.dog_id}</span>
                      </div>
                      <div className="text-xs text-slate-300 truncate">{selectedDog.breed ?? ""}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDog(null)}
                      className="px-3 py-1.5 rounded-full text-xs border bg-slate-700 text-slate-100 border-slate-500 hover:border-slate-400"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {!selectedDog && dogResults.length > 0 && (
                  <div className="max-h-56 overflow-auto border border-slate-700 rounded-lg">
                    {dogResults.map((d) => (
                      <button
                        key={d.dog_id}
                        type="button"
                        onClick={() => setSelectedDog(d)}
                        className="w-full text-left px-3 py-2 border-b border-slate-700 hover:bg-slate-700/40"
                        title="Select dog"
                      >
                        <div className="text-sm text-slate-100 font-medium">
                          {d.name} <span className="text-slate-400">#{d.dog_id}</span>
                        </div>
                        <div className="text-xs text-slate-300">{d.breed ?? "—"}</div>
                      </button>
                    ))}
                  </div>
                )}

                {!selectedDog && dogQuery.trim() && !dogSearching && dogResults.length === 0 && (
                  <div className="text-xs text-slate-300">No dogs found.</div>
                )}
              </div>

              <div className="flex flex-col md:flex-row gap-2 md:items-center">
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as TeamStatus)}
                  className="w-full md:w-48 rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                  title="Team status"
                >
                  {TEAM_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={createTeam}
                  disabled={!canCreate}
                  className={classNames(
                    "px-4 py-2 rounded-lg text-sm border",
                    "border-emerald-700 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/40",
                    !canCreate && "opacity-60 cursor-not-allowed"
                  )}
                  title={!selectedDog ? "Select a dog first." : undefined}
                >
                  {adding ? "Creating…" : "Create"}
                </button>

                <button
                  type="button"
                  onClick={resetCreatePanel}
                  className="px-4 py-2 rounded-lg text-sm border border-slate-600 bg-slate-700 text-slate-100 hover:border-slate-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {loading && <div className="text-sm text-slate-200">Loading…</div>}
        {err && (
          <div className="text-sm text-red-200 bg-red-900/30 border border-red-800 rounded-xl p-3">
            {err}
          </div>
        )}
        {ok && (
          <div className="text-sm text-emerald-200 bg-emerald-900/30 border border-emerald-800 rounded-xl p-3">
            {ok}
          </div>
        )}

        {/* Teams list/table */}
        {!loading && !err && data && (
          <>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search dog / breed / team id…"
                  className="w-full md:w-96 rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                />

                <button
                  type="button"
                  onClick={load}
                  className="px-3 py-1.5 rounded-full text-sm border transition-colors bg-slate-700 text-slate-100 border-slate-500 hover:border-slate-400"
                >
                  Refresh
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {pillStatuses.map((s) => {
                  const key = s === "(unset)" ? "" : s;
                  const active = selectedStatuses.includes(key);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStatus(key)}
                      className={classNames(
                        "px-3 py-1.5 rounded-full text-sm border transition-colors",
                        !active && "bg-slate-700 text-slate-100 border-slate-500 hover:border-slate-400",
                        active && "bg-slate-500 text-slate-100 border-emerald-400"
                      )}
                    >
                      {s}
                    </button>
                  );
                })}

                {selectedStatuses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedStatuses([])}
                    className="px-3 py-1.5 rounded-full text-sm border transition-colors bg-slate-700 text-slate-100 border-slate-500 hover:border-slate-400"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Mobile cards */}
            <div className="block md:hidden space-y-3">
              {teams.length === 0 && (
                <div className="text-sm text-slate-200 bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                  No teams match the current filters.
                </div>
              )}

              {teams.map((t) => (
                <div key={t.team_id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => openDogForTeam(t)}
                        className="font-semibold bg-slate-800 text-slate-100 truncate text-left hover:underline"
                        title="Open dog profile"
                      >
                        {t.dog.name}
                      </button>
                      <div className="text-sm text-slate-300 truncate">{t.dog.breed ?? ""}</div>
                      <div className="text-xs text-slate-400 mt-1">Team #{t.team_id}</div>
                    </div>

                    <span className="text-xs px-2 py-1 rounded-full bg-slate-700 border border-slate-600 text-slate-100 whitespace-nowrap">
                      {t.status ?? "unset"}
                    </span>
                  </div>

                  {t.dog.photo_url && (
                    <div className="mt-3">
                      <img
                        src={t.dog.photo_url}
                        alt={t.dog.name}
                        className="w-full max-h-48 object-cover rounded-lg border border-slate-700"
                      />
                    </div>
                  )}

                  <div className="mt-3">
                    <ActionButtons t={t} />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-auto border border-slate-700 rounded-xl bg-slate-800">
              <table className="min-w-full border-collapse text-sm bg-slate-800">
                <thead className="bg-slate-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 border-b border-slate-700 text-center font-medium text-slate-100 whitespace-nowrap align-middle">
                      Dog
                    </th>
                    <th className="px-3 py-2 border-b border-slate-700 text-center font-medium text-slate-100 whitespace-nowrap align-middle">
                      Breed
                    </th>
                    <th className="px-3 py-2 border-b border-slate-700 text-center font-medium text-slate-100 whitespace-nowrap align-middle">
                      Team
                    </th>
                    <th className="px-3 py-2 border-b border-slate-700 text-center font-medium text-slate-100 whitespace-nowrap align-middle">
                      Team status
                    </th>
                    <th className="px-3 py-2 border-b border-slate-700 text-center font-medium text-slate-100 whitespace-nowrap align-middle">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {teams.map((t) => (
                    <tr key={t.team_id} className="hover:bg-slate-700/60">
                      <td className="px-3 py-2 border-t border-slate-700 text-slate-100 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openDogForTeam(t)}
                          className="hover:underline bg-transparent text-left"
                        >
                          {t.dog.name}
                        </button>
                      </td>
                      <td className="px-3 py-2 border-t border-slate-700 text-slate-200 whitespace-nowrap">
                        {t.dog.breed ?? "—"}
                      </td>
                      <td className="px-3 py-2 border-t border-slate-700 text-slate-200 whitespace-nowrap">
                        #{t.team_id}
                      </td>
                      <td className="px-3 py-2 border-t border-slate-700 text-slate-100 whitespace-nowrap align-middle">
                        <span className="px-2 py-1 rounded-full bg-slate-700 border border-slate-600 text-xs">
                          {t.status ?? "unset"}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-t border-slate-700 text-slate-100 whitespace-nowrap align-middle">
                        <ActionButtons t={t} compact />
                      </td>
                    </tr>
                  ))}

                  {teams.length === 0 && (
                    <tr>
                      <td className="px-3 py-8 text-center text-sm text-slate-300" colSpan={5}>
                        No teams match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <IdCardPrintDialog
              open={printTeamId !== null}
              handlerId={data.handler_id}
              title="View / Print K9 ID"
              onClose={() => setPrintTeamId(null)}
              onPrint={(mode, slot, affiliationId) => {
                if (printTeamId == null) return;

                const affiliationParam =
                  affiliationId == null ? "" : `&affiliation_id=${affiliationId}`;

                const slotParam = mode === "sheet" ? `&slot=${slot}` : "";

                window.open(
                  `/api/id-cards/teams/${printTeamId}?layout=${mode}${slotParam}${affiliationParam}`
                );
              }}
            />
          </>
        )}
      </div>
    </PageContainer>
  );
}
