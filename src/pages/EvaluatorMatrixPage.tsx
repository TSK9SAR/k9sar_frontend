import React, { useEffect, useMemo, useState } from "react";
import PageContainer from "../components/PageContainer";

/** ---------- helpers ---------- */

function normalizeApiBase(input?: string) {
  const raw = (input ?? "").trim().replace(/\/+$/, "");
  if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
  if (!raw) return `${window.location.origin}/api`;
  if (window.location.protocol === "https:" && raw.startsWith("http://")) {
    return raw.replace(/^http:\/\//i, "https://");
  }
  return raw;
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    if (m.addEventListener) m.addEventListener("change", onChange);
    else (m as any).addListener(onChange);
    return () => {
      if (m.removeEventListener) m.removeEventListener("change", onChange);
      else (m as any).removeListener(onChange);
    };
  }, [query]);
  return matches;
}

function extractRoleStrings(u: any): string[] {
  const roles = new Set<string>();
  if (!u || typeof u !== "object") return [];
  if (typeof u.role === "string") roles.add(u.role);

  const userRoles = Array.isArray(u.user_roles) ? u.user_roles : [];
  const altRoles = Array.isArray(u.roles) ? u.roles : [];

  for (const collection of [userRoles, altRoles]) {
    for (const r of collection) {
      if (!r) continue;
      if (typeof r === "string") roles.add(r);
      else if (typeof r === "object") {
        for (const key of ["name", "role", "role_name", "code", "title"]) {
          const val = r?.[key];
          if (typeof val === "string") roles.add(val);
        }
      }
    }
  }
  return Array.from(roles)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isUserAdmin(u: any): boolean {
  if (!u) return false;
  if (u.is_admin) return true;
  const roles = extractRoleStrings(u);
  return roles.some((r) => r.toLowerCase() === "admin" || r.toLowerCase().includes("admin"));
}

/** ---------- types ---------- */

type Group = { group_id: number; name: string; sortorder: number };

type EvaluatorCell = {
  is_evaluator: boolean;
  is_candidate: boolean;
  candidate_source?: string | null;
};

type UserRow = {
  user_id: number;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  phone?: string | null;
  distance_mi?: number | null;
  evaluator_missing_signature?: boolean;
  memberships: Record<number, EvaluatorCell>;
};

type MatrixDto = { groups: Group[]; users: UserRow[] };

/** ---------- component ---------- */

export default function EvaluatorMatrixPage() {
  const isMobile = useMediaQuery("(max-width: 767px)");

  const effectiveBaseUrl = normalizeApiBase((import.meta as any)?.env?.VITE_API_BASE_URL);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [me, setMe] = useState<any>(null);
  const [data, setData] = useState<MatrixDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // directory-style filters
  const [q, setQ] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

  const [useLocation, setUseLocation] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radiusMi, setRadiusMi] = useState<number>(50);

  const [onlyEvaluators, setOnlyEvaluators] = useState(true);

  const isAdmin = isUserAdmin(me);
  const mfaVerified = !!me?.mfa_verified;
  const canToggle = isAdmin && mfaVerified;

  const toggleDisabledReason = !isAdmin
    ? "View only (admin required)"
    : !mfaVerified
      ? "Admin but 2FA verification is required to toggle"
      : "";

  function toggleGroup(groupId: number) {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((x) => x !== groupId) : [...prev, groupId]
    );
  }

  function clearLocation() {
    setUseLocation(false);
    setLat(null);
    setLng(null);
    setGeoError(null);
  }

  function requestGpsLocation() {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError("Geolocation not supported.");
      return;
    }
    setGeoLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setUseLocation(true);
        setGeoLoading(false);
      },
      (err) => {
        setUseLocation(false);
        setLat(null);
        setLng(null);
        setGeoError(err.message || "Unable to get location.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  const longPressRef = React.useRef<number | null>(null);

  function clearLongPress() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function startLongPress(action: () => void) {
    clearLongPress();

    longPressRef.current = window.setTimeout(() => {
      longPressRef.current = null;
      action();
    }, 650);
  }

  // --- Desktop left-drag scrolling ---
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef({ down: false, startX: 0, startLeft: 0 });

  function onDragStart(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const el = scrollRef.current;
    if (!el) return;

    dragRef.current.down = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startLeft = el.scrollLeft;

    e.preventDefault();
  }

  function onDragMove(e: React.MouseEvent) {
    const el = scrollRef.current;
    if (!el || !dragRef.current.down) return;

    const dx = e.clientX - dragRef.current.startX;
    el.scrollLeft = dragRef.current.startLeft - dx;
  }

  function onDragEnd() {
    dragRef.current.down = false;
  }

  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = async () => {
    if (!token) {
      setErr("Not authenticated.");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const meResp = await fetch(`${effectiveBaseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meResp.ok) setMe(await meResp.json());

      const url = new URL(`${effectiveBaseUrl}/evaluators/matrix`);

      if (debouncedQ.trim()) url.searchParams.set("q", debouncedQ.trim());
      for (const gid of selectedGroupIds) url.searchParams.append("group_ids", String(gid));

      const hasLocation = useLocation && lat != null && lng != null;
      if (hasLocation) {
        url.searchParams.set("lat", String(lat));
        url.searchParams.set("lng", String(lng));
        url.searchParams.set("radius_mi", String(radiusMi));
      }

      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) throw new Error(await resp.text());
      setData(await resp.json());
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load evaluator matrix");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveBaseUrl, debouncedQ, selectedGroupIds, useLocation, lat, lng, radiusMi]);

  const visibleGroups = useMemo(() => {
    const groups = data?.groups ?? [];
    const selected = new Set(selectedGroupIds);

    const arr = [...groups];
    arr.sort((a, b) => {
      const aSel = selected.has(a.group_id) ? 0 : 1;
      const bSel = selected.has(b.group_id) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;

      const ao = a.sortorder ?? 1000;
      const bo = b.sortorder ?? 1000;
      if (ao !== bo) return ao - bo;

      return a.name.localeCompare(b.name);
    });

    return arr;
  }, [data?.groups, selectedGroupIds]);

  const tableGroups = useMemo(() => {
    if (selectedGroupIds.length) {
      const byId = new Map((data?.groups ?? []).map((g) => [g.group_id, g] as const));
      return selectedGroupIds.map((id) => byId.get(id)).filter(Boolean) as Group[];
    }
    return visibleGroups;
  }, [selectedGroupIds, visibleGroups, data?.groups]);

  const toggle = async (user_id: number, group_id: number, nextEnabled: boolean) => {
    if (!token || !canToggle) return;

    // optimistic update: toggle evaluator only, preserve candidate flag
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        users: prev.users.map((u) => {
          if (u.user_id !== user_id) return u;
          const currentCell = u.memberships?.[group_id] ?? {
            is_evaluator: false,
            is_candidate: false,
          };
          return {
            ...u,
            memberships: {
              ...u.memberships,
              [group_id]: {
                ...currentCell,
                is_evaluator: nextEnabled,
              },
            },
          };
        }),
      };
    });

    try {
      const url = new URL(`${effectiveBaseUrl}/evaluators/matrix/toggle`);
      url.searchParams.set("user_id", String(user_id));
      url.searchParams.set("group_id", String(group_id));
      url.searchParams.set("enabled", String(nextEnabled));

      const resp = await fetch(url.toString(), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) throw new Error(await resp.text());
    } catch (e: any) {
      await load();
      alert(e?.message ?? "Toggle failed");
    }
  };

  const usersRaw = data?.users ?? [];

  const groupIdsForFilter = useMemo(() => {
    return tableGroups.map((g) => g.group_id);
  }, [tableGroups]);

  const users = useMemo(() => {
    if (!onlyEvaluators) return usersRaw;

    // show evaluators OR candidates in current selection
    return usersRaw.filter((u) =>
      groupIdsForFilter.some((gid) => {
        const cell = u.memberships?.[gid];
        return !!cell?.is_evaluator;
      })
    );
  }, [usersRaw, onlyEvaluators, groupIdsForFilter]);

  {
    loading && (
      <div className="text-xs text-slate-300">
        Loading…
      </div>
    )
  }

  if (err) {
    return (
      <PageContainer>
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded">{err}</div>
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer>
        <div className="p-4 text-sm text-slate-600">No data.</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto width-full text-left space-y-6">
        <h1 className="text-lg font-semibold">
          <span className="text-emerald-400">TSK9SAR</span>{" "}
          <span className="text-slate-100">Evaluator Matrix</span>
        </h1>

        <p className="text-xs text-gray-500">
          Search users and filter by discipline groups. Admins can toggle evaluator membership.
        </p>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

          {/* Search with clear */}
          <div className="relative w-full md:w-80">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search user (name/email)…"
              className="w-full rounded-lg border border-slate-100 px-3 py-2 pr-10 text-sm bg-slate-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-600 hover:bg-slate-500 rounded px-2 py-0.5 text-xs"
                title="Clear search"
              >
                Clear
              </button>
            )}
          </div>

          {loading && (
            <div className="text-xs text-slate-300 px-1">
              Loading…
            </div>
          )}

          <div className="text-xs">
            {isAdmin ? (
              mfaVerified ? (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-300 bg-emerald-900 text-emerald-100">
                  Admin: toggles enabled
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-400 bg-amber-900 text-amber-100">
                  Admin: 2FA verification required
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-500 bg-slate-700 text-gray-100">
                View only
              </span>
            )}
          </div>

        </div>

        <button
          type="button"
          onClick={() => setOnlyEvaluators((v) => !v)}
          className={classNames(
            "px-3 py-1.5 rounded-full text-sm border transition-colors",
            onlyEvaluators
              ? "bg-green-900 text-slate-100 border-slate-300"
              : "bg-slate-700 text-slate-100 border-slate-300 hover:border-slate-100"
          )}
          aria-pressed={onlyEvaluators}
          title="When enabled, shows evaluators and candidates only. When disabled, shows everyone."
        >
          Only Evaluators
        </button>

        <div className="flex flex-wrap gap-2">
          {visibleGroups.map((g) => {
            const active = selectedGroupIds.includes(g.group_id);
            return (
              <button
                key={g.group_id}
                type="button"
                onClick={() => toggleGroup(g.group_id)}
                className={classNames(
                  "px-3 py-1.5 rounded-full text-sm border transition-colors",
                  !active && "bg-slate-700 text-gray-100 border-gray-100 hover:border-gray-200",
                  active && "bg-slate-500 text-gray-100 border-green-500"
                )}
              >
                {g.name}
              </button>
            );
          })}

          {selectedGroupIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedGroupIds([])}
              className="px-3 py-1.5 rounded-full text-sm border transition-colors bg-slate-700 text-gray-100 border-gray-100 hover:border-gray-200"
            >
              Clear groups
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={requestGpsLocation}
              disabled={geoLoading}
              className="px-3 py-1.5 rounded-full text-sm border transition-colors bg-slate-700 text-gray-100 border-gray-100 hover:border-gray-200 disabled:opacity-60"
            >
              {geoLoading ? "Locating…" : "Use my location"}
            </button>

            {useLocation && lat != null && lng != null && (
              <button
                type="button"
                onClick={clearLocation}
                className="px-3 py-1.5 rounded-full text-sm border transition-colors bg-slate-700 text-gray-100 border-gray-100 hover:border-gray-200"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="radius" className="text-sm text-gray-100">
              Radius
            </label>
            <select
              id="radius"
              value={radiusMi}
              onChange={(e) => setRadiusMi(parseInt(e.target.value, 10))}
              disabled={!useLocation || lat == null || lng == null}
              className="px-3 py-1.5 rounded-full text-sm border transition-colors bg-slate-700 text-gray-100 border-gray-100 hover:border-gray-200 disabled:opacity-50"
            >
              <option value={10}>10 mi</option>
              <option value={25}>25 mi</option>
              <option value={50}>50 mi</option>
              <option value={100}>100 mi</option>
              <option value={200}>200 mi</option>
              <option value={500}>500 mi</option>
            </select>

            {useLocation && (
              <span className="text-xs text-gray-100">Filtering by distance</span>
            )}
          </div>
        </div>

        {geoError && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            {geoError}
            <div className="text-xs text-amber-700 mt-1">Note: GPS requires HTTPS (or localhost).</div>
          </div>
        )}

        {isMobile && (
          <div className="space-y-3">
            {users.length === 0 && (
              <div className="text-sm text-gray-200 bg-slate-600 border border-gray-800 rounded-xl p-4 text-center">
                No users match the current filters.
              </div>
            )}

            {users.map((u) => {
              const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "(No name)";
              return (
                <div key={u.user_id} className="bg-slate-700 border border-gray-500 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-100 truncate">{full}</div>
                      <div className="text-sm text-gray-100 truncate">
                        <a className="text-blue-300 hover:underline break-all" href={`mailto:${u.email}`}>
                          {u.email}
                        </a>
                      </div>
                      {u.phone && (
                        <div className="mt-1">
                          <a className="text-blue-300 hover:underline" href={`tel:${u.phone}`}>
                            {u.phone}
                          </a>
                        </div>
                      )}
                    </div>

                    {typeof u.distance_mi === "number" && (
                      <div className="text-xs px-2 py-1 rounded-full bg-slate-700 border border-gray-500 text-gray-100 whitespace-nowrap">
                        {u.distance_mi} mi
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {tableGroups.map((g) => {
                      const cell = u.memberships?.[g.group_id];
                      const isEvaluator = !!cell?.is_evaluator;
                      const isMissingSignature = !!u.evaluator_missing_signature && isEvaluator;
                      const isCandidate = !!cell?.is_candidate && !onlyEvaluators;

                      return (
                        <button
                          key={g.group_id}
                          type="button"
                          onClick={() => toggle(u.user_id, g.group_id, !isEvaluator)}
                          disabled={!canToggle}
                          className={classNames(
                            "px-3 py-1 rounded-full text-xs border transition-colors",
                            isMissingSignature
                              ? "bg-purple-900 text-purple-100 border-purple-500"
                              : isEvaluator
                                ? "bg-emerald-900 text-emerald-100 border-emerald-700"
                                : isCandidate
                                  ? "bg-orange-900 text-orange-100 border-orange-700"
                                  : "bg-slate-700 text-gray-100 border-gray-500",
                                  
                            canToggle ? "hover:border-gray-200" : "opacity-70 cursor-default"
                          )}
                          title={
                            canToggle
                              ? g.name
                              : `${g.name} — ${toggleDisabledReason}`
                          }
                        >
                          {g.name}
                        </button>
                      );
                    })}
                    {tableGroups.length === 0 && (
                      <div className="text-xs text-gray-300">No groups available.</div>
                    )}
                  </div>

                  {!canToggle && (
                    <div className="mt-3 text-[11px] text-gray-300">
                      View only (admins can toggle).
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isMobile && (
          <div
            ref={scrollRef}
            className="overflow-auto border border-gray-200 rounded-xl bg-slate-700 cursor-grab active:cursor-grabbing select-none min-h-0 max-h-[800px] overflow-y-auto"
            onMouseDown={onDragStart}
            onMouseMove={onDragMove}
            onMouseUp={onDragEnd}
            onMouseLeave={onDragEnd}
          >
            <table className="w-max border-collapse text-xs md:text-sm bg-slate-700">
              <thead className="bg-slate-850 sticky border-b top-0 z-20">
                <tr>
                  <th className="sticky left-0 top-0 z-30 bg-slate-800 px-3 py-2 text-left font-medium text-gray-100 whitespace-nowrap">
                    User
                  </th>
                  {tableGroups.map((g) => (
                    <th
                      key={g.group_id}
                      className="sticky top-0 px-2 py-2 z-20 bg-slate-800 text-center font-medium text-gray-100 whitespace-nowrap w-[140px]"
                      title={g.name}
                    >
                      <span className="inline-block max-w-[180px] truncate">{g.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {users.map((u) => {
                  const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "(No name)";
                  return (
                    <tr key={u.user_id} className="odd:bg-slate-650 even:bg-slate-600 hover:bg-slate-550">
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-2 border-t border-gray-500 bg-slate-800 align-top whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-100">{full}</div>
                        <div className="text-xs text-gray-100 break-all">
                          <a className="text-blue-300 hover:underline" href={`mailto:${u.email}`}>
                            {u.email}
                          </a>
                        </div>
                        {u.phone && (
                          <div className="text-xs">
                            <a className="text-blue-300 hover:underline" href={`tel:${u.phone}`}>
                              {u.phone}
                            </a>
                          </div>
                        )}
                        {typeof u.distance_mi === "number" && (
                          <div className="mt-1 inline-flex text-[10px] px-2 py-0.5 rounded-full bg-slate-700 border border-gray-500 text-gray-100">
                            {u.distance_mi} mi
                          </div>
                        )}
                      </td>

                      {tableGroups.map((g) => {
                        const cell = u.memberships?.[g.group_id];
                        const isEvaluator = !!cell?.is_evaluator;
                        const isMissingSignature = !!u.evaluator_missing_signature && isEvaluator;
                        const isCandidate = !!cell?.is_candidate && !onlyEvaluators;

                        return (
                          <td key={g.group_id} className="px-2 py-2 border-t border-gray-500 text-center w-[140px]">
                            <button
                              type="button"
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggle(u.user_id, g.group_id, !isEvaluator);
                              }}
                              onPointerDown={(e) => {
                                e.stopPropagation();

                                // Touch or pen long-press for iPad/tablets
                                if (e.pointerType === "touch" || e.pointerType === "pen") {
                                  startLongPress(() => {
                                    if (canToggle) {
                                      toggle(u.user_id, g.group_id, !isEvaluator);
                                    }
                                  });
                                }
                              }}
                              onPointerUp={clearLongPress}
                              onPointerCancel={clearLongPress}
                              onPointerLeave={clearLongPress}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              disabled={!canToggle}
                              className={classNames(
                                "px-3 py-1 rounded-full text-[11px] border transition-colors cursor-context-menu touch-none select-none",
                            isMissingSignature
                              ? "bg-purple-900 text-purple-100 border-purple-500"
                              : isEvaluator
                                ? "bg-emerald-900 text-emerald-100 border-emerald-700"
                                : isCandidate
                                  ? "bg-orange-900 text-orange-100 border-orange-700"
                                  : "bg-slate-700 text-gray-100 border-gray-500",
                                canToggle ? "hover:border-gray-200" : "opacity-70 cursor-default"
                              )}
                              title={
                                canToggle
                                  ? isMissingSignature
                                    ? "Evaluator missing signature — right-click or long-press to remove evaluator membership"
                                    : isEvaluator
                                      ? "Right-click or long-press to remove evaluator membership"
                                      : isCandidate
                                        ? "Candidate — right-click or long-press to add evaluator membership"
                                        : "Right-click or long-press to add evaluator membership"
                                  : isMissingSignature
                                    ? "Evaluator missing signature"
                                    : isEvaluator
                                      ? "Evaluator"
                                      : isCandidate
                                        ? "Candidate"
                                        : "Not evaluator"
                              }
                            >
                              {isMissingSignature
                                ? "Needs Sig"
                                : isEvaluator
                                  ? "Evaluator"
                                  : isCandidate
                                    ? "Candidate"
                                    : "—"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {users.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-center text-sm text-gray-200" colSpan={1 + tableGroups.length}>
                      No users match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  );
}