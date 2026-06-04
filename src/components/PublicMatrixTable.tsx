import React, { useEffect, useMemo, useRef, useState } from "react";

import { fetchPublicMatrix } from "../api/public";
import type { PublicMatrixResponse, PublicTeamRow } from "../types/publicMatrix";
import { buildPublicCellMap } from "../utils/publicMatrixMap";
import PageContainer from "./PageContainer";
import AffiliationFilterBar from "../components/AffiliationFilterBar";
import { useSearchParams } from "react-router-dom";

type CellStatus = "active" | "none";

function cellClass(status: CellStatus) {
  return status === "active"
    ? "bg-emerald-900 text-emerald-100 border border-emerald-700"
    : "bg-gray-700 text-gray-100 border border-gray-800";
}

function parseMmYyToSortable(mmYy: string): number {
  const [mm, yy] = mmYy.split("/").map((x) => parseInt(x, 10));
  const year = 2000 + (yy || 0);
  return year * 100 + (mm || 0);
}

function getVisibleCertsForTeam(team: PublicTeamRow, selectedDisciplines: string[]) {
  const certs = team.active_certs ?? [];

  const filtered = selectedDisciplines.length
    ? certs.filter((c) => selectedDisciplines.includes(c.discipline))
    : certs;

  const bestByDisc = new Map<string, (typeof filtered)[number]>();
  for (const c of filtered) {
    const prev = bestByDisc.get(c.discipline);
    if (!prev) {
      bestByDisc.set(c.discipline, c);
      continue;
    }
    if (parseMmYyToSortable(c.expires_mm_yy) >= parseMmYyToSortable(prev.expires_mm_yy)) {
      bestByDisc.set(c.discipline, c);
    }
  }

  return Array.from(bestByDisc.values());
}

function pillClass(active: boolean) {
  return [
    "px-3 py-1.5 rounded-full text-sm border transition-colors",
    active
      ? "bg-slate-500 text-gray-100 border-green-500"
      : "bg-slate-700 text-gray-100 border-gray-100 hover:border-gray-200",
  ].join(" ");
}


export default function PublicMatrixTable() {
  const [data, setData] = useState<PublicMatrixResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [filter, setFilter] = useState("");
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [allDisciplines, setAllDisciplines] = useState<string[]>([]);

  const [useLocation, setUseLocation] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radiusMi, setRadiusMi] = useState<number>(50);

  const [sp] = useSearchParams();
  const affiliationId = sp.get("affiliation_id"); // string | null

  // ✅ Mobile consistency: select a team, then render a compact “matrix-style” grid
  const [mobileSelectedTeamId, setMobileSelectedTeamId] = useState<number | null>(null);

  const [expandedTeamIds, setExpandedTeamIds] = useState<number[]>([]);

  function toggleExpanded(teamId: number) {
    setExpandedTeamIds((prev) => (prev.includes(teamId) ? [] : [teamId]));
  }

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef({ down: false, startX: 0, startLeft: 0 });

  function onDragStart(e: React.MouseEvent) {
    if (e.button !== 0) return; // left button only
    const el = scrollRef.current;
    if (!el) return;

    dragRef.current.down = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startLeft = el.scrollLeft;

    e.preventDefault(); // prevents text selection while dragging
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

  function toggleDiscipline(d: string) {
    setSelectedDisciplines((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function clearDisciplines() {
    setSelectedDisciplines([]);
  }

  function clearLocation() {
    setUseLocation(false);
    setLat(null);
    setLng(null);
    setGeoError(null);
  }


  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const hasLocation = useLocation && lat != null && lng != null;

        const res = await fetchPublicMatrix({
          q: filter || undefined,
          disciplines: selectedDisciplines.length ? selectedDisciplines : undefined,
          affiliation_id: affiliationId ? Number(affiliationId) : undefined,
          lat: hasLocation ? lat : undefined,
          lng: hasLocation ? lng : undefined,
          radius_mi: hasLocation ? radiusMi : undefined,
        });

        if (!alive) return;

        setData(res);

        const incoming = res.disciplines ?? [];
        if (incoming.length > 0 && (allDisciplines.length === 0 || selectedDisciplines.length === 0)) {
          setAllDisciplines(incoming);
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load public directory");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [filter, selectedDisciplines, affiliationId, useLocation, lat, lng, radiusMi]);

  const responseDisciplines = data?.disciplines ?? [];
  const teams = data?.teams ?? [];

  const pillSource = allDisciplines.length ? allDisciplines : responseDisciplines;

  const pillDisciplines = useMemo(() => {
    const selectedSet = new Set(selectedDisciplines);

    const selected: string[] = [];
    const unselected: string[] = [];

    for (const d of pillSource) {
      if (selectedSet.has(d)) selected.push(d);
      else unselected.push(d);
    }

    return [...selected, ...unselected];
  }, [pillSource, selectedDisciplines]);

  const tableDisciplines = useMemo(() => {
    const allForTable = allDisciplines.length ? allDisciplines : responseDisciplines;
    return selectedDisciplines.length ? selectedDisciplines : allForTable;
  }, [selectedDisciplines, allDisciplines, responseDisciplines]);

  // ✅ Keep a valid mobile selection when the list changes (filters/location)
  useEffect(() => {
    if (!teams.length) {
      setMobileSelectedTeamId(null);
      return;
    }
    if (mobileSelectedTeamId == null) {
      setMobileSelectedTeamId(teams[0].team_id);
      return;
    }
    const stillThere = teams.some((t) => t.team_id === mobileSelectedTeamId);
    if (!stillThere) setMobileSelectedTeamId(teams[0].team_id);
  }, [teams, mobileSelectedTeamId]);

  const mobileSelectedTeam = useMemo(
    () => teams.find((t) => t.team_id === mobileSelectedTeamId) ?? null,
    [teams, mobileSelectedTeamId]
  );

  return (
    <PageContainer maxWidth="full" className="space-y-6 py-6">
      <div className="text-left space-y-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">
            <span className="text-emerald-400">TSK9SAR</span>{" "}
            <span className="text-slate-100">Browse Certified K-9 Teams</span>
          </h1>
          <p className="text-xs text-slate-300 mb-4">
            This directory lists certified and operational K9 Search and Rescue (SAR) teams,
            including handlers, canine partners, and their active certifications across
            multiple search disciplines.
          </p>
          <p className="text-xs text-slate-300">
            Use filters to narrow results.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search handler or dog…"
            className="w-full rounded-lg border border-slate-100 px-3 py-2 pr-10 text-sm bg-slate-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-600 hover:bg-slate-500 rounded px-2 py-0.5 text-xs"
              title="Clear search"
            >
              Clear
            </button>
          )}
        </div>

        {/* Discipline filter pills */}
        <div className="flex  max-w flex-wrap gap-2">
          {pillDisciplines.map((d) => {
            const active = selectedDisciplines.includes(d);
            return (
              <button key={d} type="button" onClick={() => toggleDiscipline(d)} className={pillClass(active)}>
                {d}
              </button>
            );
          })}

          {selectedDisciplines.length > 0 && (
            <button type="button" onClick={clearDisciplines} className={pillClass(false)}>
              Clear disciplines
            </button>
          )}
        </div>

        {/* Location + radius */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={requestGpsLocation} disabled={geoLoading} className={pillClass(false)}>
              {geoLoading ? "Locating…" : "Use my location"}
            </button>

            {useLocation && lat != null && lng != null && (
              <button type="button" onClick={clearLocation} className={pillClass(false)}>
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

            {useLocation && teams.length >= 0 && <span className="text-xs text-gray-100">Filtering by distance</span>}
          </div>
        </div>

        {geoError && (
          <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded p-2">
            {geoError}
            <div className="text-xs text-amber-800 mt-1">Note: GPS requires HTTPS (or localhost).</div>
          </div>
        )}

        <AffiliationFilterBar fetchPath="/public/affiliations" />

        {loading && <div className="text-sm text-gray-200">Loading…</div>}
        {error && (
          <div className="text-sm text-red-200 bg-red-900/30 border border-red-700 rounded p-2">
            {error}
          </div>
        )}

        {/* MOBILE VIEW: Collapsible cards (no duplicate cert rendering) */}
        <div className="block md:hidden space-y-3 w-full max-w-md">
          {!loading && !error && teams.length === 0 && (
            <div className="text-sm text-gray-200 bg-slate-700 border border-gray-600 rounded-xl p-4 text-center">
              No teams match the current filters.
            </div>
          )}

          {teams.map((t) => {
            const expanded = expandedTeamIds.includes(t.team_id);
            const visibleCerts = getVisibleCertsForTeam(t, selectedDisciplines); // deduped + sorted
            const preview = visibleCerts.slice(0, 3);
            const extraCount = Math.max(0, visibleCerts.length - preview.length);

            return (
              <div key={t.team_id} className="bg-slate-700 border border-gray-600 rounded-xl overflow-hidden">
                {/* Header (always visible) */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(t.team_id)}
                  className="w-full text-left bg-slate-700 p-4 hover:bg-slate-600/40 transition-colors"
                  aria-expanded={expanded}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-100 truncate">{t.handler_full_name}</div>
                      <div className="text-sm text-gray-100 truncate">{t.dog_name}</div>

                      {/* Collapsed preview chips */}
                      {!expanded && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {preview.length === 0 ? (
                            <span className="text-xs text-gray-300">
                              No active certifications{selectedDisciplines.length ? " (for selected disciplines)" : ""}.
                            </span>
                          ) : (
                            <>
                              {preview.map((c) => (
                                <span
                                  key={`${t.team_id}-${c.discipline}`}
                                  className="text-xs px-2 py-1 rounded-full bg-emerald-700 border border-emerald-600 text-emerald-100"
                                  title={`${c.discipline} expires ${c.expires_mm_yy}`}
                                >
                                  {c.discipline} · {c.expires_mm_yy}
                                </span>
                              ))}
                              {extraCount > 0 && (
                                <span className="text-xs px-2 py-1 rounded-full bg-slate-600 border border-gray-500 text-gray-100">
                                  +{extraCount}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {typeof t.distance_mi === "number" && (
                        <span className="text-xs px-2 py-1 rounded-full bg-slate-700 border border-gray-600 text-gray-100 whitespace-nowrap">
                          {t.distance_mi} mi
                        </span>
                      )}

                      <span className="text-xs px-2 py-1 rounded-full bg-slate-700 border border-gray-600 text-gray-100">
                        {expanded ? "Hide" : "Details"}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded content */}
                {expanded && (
                  <div className="px-4 pb-4">
                    {/* Contact */}
                    <div className="text-sm border-t border-gray-600 pt-3">
                      <a className="text-blue-300 hover:underline break-all" href={`mailto:${t.email}`}>
                        {t.email}
                      </a>
                      {t.phone && (
                        <div className="mt-1">
                          <a className="text-blue-300 hover:underline" href={`tel:${t.phone}`}>
                            {t.phone}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Certifications (single source of truth; no duplicates) */}
                    <div className="mt-3">
                      {visibleCerts.length === 0 ? (
                        <div className="text-xs text-gray-300">
                          No active certifications{selectedDisciplines.length ? " for selected disciplines" : ""}.
                        </div>
                      ) : (
                        <div className="bg-slate-800/40 border border-gray-600 rounded-xl overflow-hidden">
                          <div className="grid grid-cols-2 gap-0 text-xs">
                            <div className="px-3 py-2 text-gray-200 font-medium border-b border-gray-600 bg-slate-800/40">
                              Discipline
                            </div>
                            <div className="px-3 py-2 text-gray-200 font-medium border-b border-gray-600 bg-slate-800/40">
                              Expires
                            </div>

                            {visibleCerts.map((c) => (
                              <React.Fragment key={`${t.team_id}-row-${c.discipline}`}>
                                <div className="px-3 py-2 border-b border-gray-700 text-gray-100 truncate">
                                  {c.discipline}
                                </div>
                                <div className="px-3 py-2 border-b border-gray-700 text-emerald-100">
                                  {c.expires_mm_yy}
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* DESKTOP VIEW: Single table (Evaluator-style) so rows never misalign */}
        <div className="hidden md:block">
          <div className="text-xs text-slate-400 mb-2">Tip: drag the table left/right to scroll.</div>

          <div
            ref={scrollRef}
            className="overflow-auto w-full rounded-xl border border-slate-700 max-h-[800px] bg-slate-900 cursor-grab active:cursor-grabbing select-none overflow-y-auto"
            onMouseDown={onDragStart}
            onMouseMove={onDragMove}
            onMouseUp={onDragEnd}            onMouseLeave={onDragEnd}
          >
            <table className="min-w-max border-collapse text-sm">
              <thead className="bg-slate-700 sticky top-0 z-40">
                <tr>
                  <th
                    className="sticky top-0 left-0 z-40 w-[170px] min-w-[170px] max-w-[170px] bg-slate-700 px-3 py-2 text-left font-medium text-slate-100 border-b border-gray-600"
                    style={{ transform: "translateZ(0)" }}
                  >
                    Certified K-9 Team
                  </th>

                  <th
                    className="sticky top-0 left-[170px] z-50 w-[170px] min-w-[170px] max-w-[170px] bg-slate-700 px-3 py-2 text-left font-medium text-slate-100 whitespace-nowrap border-b border-r border-slate-600"
                    style={{ transform: "translateZ(0)" }}
                  >
                    Contact
                  </th>

                  {tableDisciplines.map((disc) => (
                    <th
                      key={`H-${disc}`}
                      className="w-[97px] min-w-[97px] max-w-[97px] px-2 py-2 border-b border-slate-600 bg-slate-700 text-center align-bottom font-medium text-slate-100"
                      title={disc}
                    >
                      <div className="whitespace-normal break-words leading-tight text-[11px]">
                        {disc}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {teams.map((t) => {
                  const map = buildPublicCellMap(t);

                  return (
                    <tr
                      key={`ROW-${t.team_id}`}
                      className="odd:bg-slate-800/50 even:bg-slate-800/20 hover:bg-slate-700/50"
                    >
                      <td
                        className="sticky left-0 z-20 w-[170px] min-w-[170px] max-w-[170px] bg-slate-800 px-3 py-2 border-t border-slate-700 align-middle"
                        style={{ transform: "translateZ(0)" }}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-100">
                            {t.handler_full_name}
                          </div>
                          {t.dog_name && (
                            <div className="truncate text-xs text-slate-300">
                              Dog: <span className="text-slate-200">{t.dog_name}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td
                        className="sticky left-[170px] z-20 w-[170px] min-w-[170px] max-w-[170px] bg-slate-800 px-3 py-2 border-t border-r border-slate-700 align-middle shadow-[6px_0_8px_-4px_rgba(0,0,0,0.45)]"
                        style={{ transform: "translateZ(0)" }}
                      >
                        <div className="min-w-0">
                          {t.email ? (
                            <a
                              className="block w-[150px] truncate text-blue-300 hover:underline"
                              href={`mailto:${t.email}`}
                              title={t.email}
                            >
                              {t.email}
                            </a>
                          ) : (
                            <span className="block text-slate-300">—</span>
                          )}

                          {t.phone && (
                            <a
                              className="block truncate text-blue-300 hover:underline"
                              href={`tel:${t.phone}`}
                              title={t.phone}
                            >
                              {t.phone}
                            </a>
                          )}

                          {typeof t.distance_mi === "number" && (
                            <div className="mt-1 inline-flex whitespace-nowrap rounded-full border border-gray-600 bg-slate-800 px-2 py-0.5 text-[10px] text-gray-100">
                              {t.distance_mi} mi
                            </div>
                          )}
                        </div>
                      </td>

                      {tableDisciplines.map((disc) => {
                        const cell = (map as any)[disc] ?? { status: "none" as const };

                        return (
                          <td
                            key={`${t.team_id}-${disc}`}
                            className=" min-w-[92px] px-2 py-2 border-t border-slate-700 text-center align-middle"
                          >
                            <div
                              className={`rounded-md px-2 py-1 leading-tight ${cellClass(cell.status)}`}
                              title={
                                cell.status === "active"
                                  ? `Expires: ${cell.expires_mm_yy}`
                                  : "No active certification"
                              }
                            >
                              {cell.status === "active" ? cell.expires_mm_yy : "—"}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {!loading && !error && teams.length === 0 && (
                  <tr>
                    <td
                      className="px-3 py-8 text-center text-sm text-slate-200"
                      colSpan={2 + tableDisciplines.length}
                    >
                      No teams match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>          </div>
        </div>

      </div>
    </PageContainer >
  );
}
