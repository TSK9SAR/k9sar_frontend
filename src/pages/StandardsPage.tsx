
import PageContainer from "../components/PageContainer";
import React, { useEffect, useMemo, useState } from "react";
import Seo from "../utils/Seo";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiFetch } from "../lib/api";


type AnyObj = Record<string, any>;

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function dateKey(iso?: string | null) {
  if (!iso) return Number.NEGATIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

function normalizeDocUrl(urlOrPath?: string | null) {
  if (!urlOrPath) return null;
  const s = String(urlOrPath).trim();
  if (!s) return null;

  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return s;

  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(s)) {
    return `https://${s}`;
  }

  return `/pdfs/${s.replace(/^\/+/, "")}`;
}

function getPublicSessionId() {
  let sid = sessionStorage.getItem("public_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("public_session_id", sid);
  }
  return sid;
}

function trackPublicSection(section: string) {
  const key = `tracked_public_section_${section}`;
  if (sessionStorage.getItem(key)) return;

  sessionStorage.setItem(key, "1");

  apiFetch("/public/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      section,
      session_id: getPublicSessionId(),
    }),
  });
}

function disciplineLabel(s: any): string {
  const name =
    s?.discipline_name ??
    s?.discipline ??
    s?.discipline_title ??
    s?.discipline_group_name ??
    null;

  if (name) return String(name).trim();
  return s?.discipline_id != null ? `Discipline #${s.discipline_id}` : "Discipline —";
}

export default function StandardsPage() {
  const OPERATIONAL_STANDARDS_PATH = "/api/standards/?section=operational";
  const GENERIC_STANDARDS_PATH = "/api/standards/?section=generic";


  const [items, setItems] = useState<AnyObj[]>([]);
  const [genericItems, setGenericItems] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedGenericId, setSelectedGenericId] = useState<number | null>(null);


  function toggleDiscipline(label: string) {
    setSelectedDisciplines((prev) =>
      prev.includes(label) ? prev.filter((d) => d !== label) : [...prev, label]
    );
  }

  useEffect(() => {
    trackPublicSection("standards");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

        const headers: Record<string, string> = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const [operationalResp, genericResp] = await Promise.all([
          fetch(OPERATIONAL_STANDARDS_PATH, { headers }),
          fetch(GENERIC_STANDARDS_PATH, { headers }),
        ]);


        if (!operationalResp.ok) {
          const text = await operationalResp.text().catch(() => "");
          throw new Error(
            `Operational standards fetch failed (HTTP ${operationalResp.status}): ${text.slice(0, 200)}`
          );
        }

        if (!genericResp.ok) {
          const text = await genericResp.text().catch(() => "");
          throw new Error(
            `Foundational standards fetch failed (HTTP ${genericResp.status}): ${text.slice(0, 200)}`
          );
        }

        const operationalData = await operationalResp.json();
        const genericData = await genericResp.json();

        if (!cancelled) {
          setItems(Array.isArray(operationalData) ? operationalData : []);
          setGenericItems(Array.isArray(genericData) ? genericData : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setItems([]);
          setGenericItems([]);
          setErr(e?.message || "Failed to load standards.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);



  // Keep only the newest effective operational standard per discipline_id
  const latestByDiscipline = useMemo(() => {
    const best = new Map<string, AnyObj>();

    for (const s of items || []) {
      const key = String(s?.discipline_id ?? "none");
      const existing = best.get(key);

      if (!existing) {
        best.set(key, s);
      } else {
        const a = dateKey(existing?.effective_date);
        const b = dateKey(s?.effective_date);
        if (b > a) best.set(key, s);
      }
    }

    return Array.from(best.values()).sort((a, b) => {
      const groupOrderA = Number(a?.discipline_group_sortorder ?? 9999);
      const groupOrderB = Number(b?.discipline_group_sortorder ?? 9999);
      if (groupOrderA !== groupOrderB) return groupOrderA - groupOrderB;

      const discOrderA = Number(a?.discipline_sortorder ?? 9999);
      const discOrderB = Number(b?.discipline_sortorder ?? 9999);
      if (discOrderA !== discOrderB) return discOrderA - discOrderB;

      return String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
    });
  }, [items]);

  const allDisciplineLabels = useMemo(() => {
    const groups = new Map<string, number>();

    for (const s of latestByDiscipline) {
      const label = String(s?.discipline_group_name ?? "").trim();
      if (!label) continue;

      const sortorder = Number(s?.discipline_group_sortorder ?? 9999);
      if (!groups.has(label)) {
        groups.set(label, sortorder);
      }
    }

    return Array.from(groups.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([label]) => label);
  }, [latestByDiscipline]);

  const filtered = useMemo(() => {
    let base = latestByDiscipline.slice();

    if (selectedDisciplines.length) {
      const selectedSet = new Set(selectedDisciplines);
      base = base.filter((s) =>
        selectedSet.has(String(s?.discipline_group_name ?? disciplineLabel(s)))
      );
    }

    return base;
  }, [latestByDiscipline, selectedDisciplines]);

  const genericFiltered = useMemo(() => {
    return genericItems.slice().sort((a, b) => {
      const groupOrderA = Number(a?.discipline_group_sortorder ?? 9999);
      const groupOrderB = Number(b?.discipline_group_sortorder ?? 9999);
      if (groupOrderA !== groupOrderB) return groupOrderA - groupOrderB;

      const discOrderA = Number(a?.discipline_sortorder ?? 9999);
      const discOrderB = Number(b?.discipline_sortorder ?? 9999);
      if (discOrderA !== discOrderB) return discOrderA - discOrderB;

      return String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
    });
  }, [genericItems]);

  const selectedGeneric = useMemo(() => {
    if (selectedGenericId == null) return null;
    return genericFiltered.find((x) => Number(x?.standard_id) === selectedGenericId) || null;
  }, [genericFiltered, selectedGenericId]);

  useEffect(() => {
    if (genericFiltered.length === 0) {
      setSelectedGenericId(null);
      return;
    }

    const stillThere =
      selectedGenericId != null &&
      genericFiltered.some((s) => Number(s?.standard_id) === selectedGenericId);

    if (!stillThere) {
      setSelectedGenericId(Number(genericFiltered[0].standard_id));
    }
  }, [genericFiltered, selectedGenericId]);

  const selected = useMemo(() => {
    if (selectedId == null) return null;
    return filtered.find((x) => Number(x?.standard_id) === selectedId) || null;
  }, [filtered, selectedId]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }

    const stillThere =
      selectedId != null && filtered.some((s) => Number(s?.standard_id) === selectedId);

    if (!stillThere) {
      setSelectedId(Number(filtered[0].standard_id));
    }
  }, [filtered, selectedId]);

  return (
    <>
      <Seo
        title="TSK9SAR Certification Standards"
        description="Browse TSK9SAR operational and foundational search and rescue certification standards by discipline group. View effective dates, summaries, and printable standards documents."
      />

      <PageContainer maxWidth="full" className="space-y-6 py-6">
        <div className="mx-auto w-full overflow-x-hidden space-y-8">
          <section className="rounded-xl border border-slate-700 bg-slate-900/40 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-700 bg-slate-950/40">
              <div className="">
                <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">
                  K9 Search & Rescue Operational Certification Standards
                </h1>

                <p className="text-sm text-slate-300 mt-3 leading-6">
                  TSK9SAR certification standards define operational requirements for search and
                  rescue dog teams across multiple disciplines, including trailing, wilderness
                  search, cadaver and human remains detection, water search, and related mission
                  profiles.
                </p>

                <h2 className="text-base sm:text-lg font-semibold text-slate-100 mt-5">
                  How certification standards work
                </h2>

                <p className="text-sm text-slate-300 mt-2 leading-6">
                  Each certification standard defines evaluation criteria, required skills, and
                  operational readiness expectations. Certifications are time-limited and must be
                  maintained through periodic re-evaluation. This page shows the newest effective
                  operational standard for each discipline.
                </p>

                <p className="text-xs text-slate-400 mt-3">
                  Filter by discipline group to narrow the standards shown below.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {allDisciplineLabels.map((label) => {
                  const active = selectedDisciplines.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDiscipline(label)}
                      aria-pressed={active}
                      className={[
                        "px-3 py-1.5 rounded-full text-sm border transition-colors",
                        active
                          ? "bg-emerald-900/30 text-slate-100 border-emerald-500"
                          : "bg-slate-700 text-slate-100 border-slate-500 hover:border-slate-300",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}

                {selectedDisciplines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDisciplines([])}
                    className="px-3 py-1.5 rounded-full text-sm border bg-slate-700 text-slate-100 border-slate-500 hover:border-slate-300"
                  >
                    Clear discipline groups
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,420px)_1fr]">
              <div className="border-b lg:border-b-0 lg:border-r border-slate-800">
                {loading ? (
                  <div className="p-4 text-sm text-slate-300">Loading…</div>
                ) : err ? (
                  <div className="p-4 text-sm text-red-300">Could not load standards. {err}</div>
                ) : filtered.length === 0 ? (
                  <div className="p-4 text-sm text-slate-300">
                    No operational standards found for the selected filters.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-800 lg:max-h-[48rem] lg:overflow-auto">
                    {filtered.map((s) => {
                      const id = Number(s.standard_id);
                      const name = s.name || `Standard ${id}`;
                      const discipline = disciplineLabel(s);
                      const active = id === selectedId;

                      return (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(id)}
                            className={[
                              "w-full text-left px-4 py-3 hover:bg-slate-900/60 transition-colors",
                              active ? "bg-emerald-900/10" : "bg-transparent",
                            ].join(" ")}
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-slate-100 truncate">{name}</div>
                              <div className="text-xs text-slate-400 truncate mt-1">
                                {discipline} • Effective: {fmtDate(s.effective_date)}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="p-4 sm:p-5">
                {!selected ? (
                  <div className="text-sm text-slate-300">
                    Select a standard to view details.
                  </div>
                ) : (
                  <article className="space-y-4">
                    <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold text-slate-100">
                          {selected.name || `Standard #${selected.standard_id}`}
                        </h2>
                        <div className="text-xs text-slate-400 mt-2">
                          Discipline:{" "}
                          <span className="text-slate-200">{disciplineLabel(selected)}</span>
                          {" • "}
                          Effective:{" "}
                          <span className="text-slate-200">{fmtDate(selected.effective_date)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {normalizeDocUrl(selected.url) ? (
                          <a
                            href={normalizeDocUrl(selected.url)!}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 rounded-lg text-sm border border-slate-700 bg-slate-800 hover:border-slate-400"
                          >
                            View / Print Document
                          </a>
                        ) : (
                          <span className="px-3 py-2 rounded-lg text-sm border border-slate-800 bg-slate-950/40 text-slate-400">
                            No printable standard document available
                          </span>
                        )}
                      </div>
                    </header>

                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                      <div className="text-xs text-amber-300 uppercase tracking-wider">Summary only - use view/print for full standard text</div>
                      
                      <div className="mt-3 w-full overflow-x-auto">
                        {selected.summary_md ? (
                          <div className="prose prose-invert max-w-none text-sm">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: (props) => (
                                  <p className="mb-4 leading-relaxed text-slate-200">
                                    {props.children}
                                  </p>
                                ),
                                ul: (props) => (
                                  <ul className="mb-4 ml-6 list-disc space-y-1 text-slate-200">
                                    {props.children}
                                  </ul>
                                ),
                                ol: (props) => (
                                  <ol className="mb-4 ml-6 list-decimal space-y-1 text-slate-200">
                                    {props.children}
                                  </ol>
                                ),
                                h2: (props) => (
                                  <h2 className="mt-6 mb-3 text-xl font-semibold text-white">
                                    {props.children}
                                  </h2>
                                ),
                                h3: (props) => (
                                  <h3 className="mt-5 mb-2 text-lg font-semibold text-white">
                                    {props.children}
                                  </h3>
                                ),
                                strong: (props) => (
                                  <strong className="font-semibold text-white">
                                    {props.children}
                                  </strong>
                                ),
                              }}
                            >
                              {selected.summary_md}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400">No summary available.</div>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Showing the newest effective operational standard for each discipline.
                    </div>
                  </article>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-700 bg-slate-900/40 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-700 bg-slate-950/40">
              <h2 className="text-lg font-semibold text-slate-100">
                K9 Search & Rescue Foundational Standards
              </h2>
              <p className="text-sm text-slate-400 mt-2">
                Core program documents and framework standards that apply across disciplines.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,420px)_1fr]">
              <div className="border-b lg:border-b-0 lg:border-r border-slate-800">
                {loading ? (
                  <div className="p-4 text-sm text-slate-300">Loading…</div>
                ) : err ? (
                  <div className="p-4 text-sm text-red-300">
                    Could not load foundational standards. {err}
                  </div>
                ) : genericFiltered.length === 0 ? (
                  <div className="p-4 text-sm text-slate-300">No foundational standards found.</div>
                ) : (
                  <ul className="divide-y divide-slate-800 lg:max-h-[48rem] lg:overflow-auto">
                    {genericFiltered.map((s) => {
                      const id = Number(s.standard_id);
                      const active = id === selectedGenericId;

                      return (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => setSelectedGenericId(id)}
                            className={[
                              "w-full text-left px-4 py-3 hover:bg-slate-900/60 transition-colors",
                              active ? "bg-emerald-900/10" : "bg-transparent",
                            ].join(" ")}
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-slate-100 truncate">
                                {s.name || `Standard #${s.standard_id}`}
                              </div>
                              <div className="text-xs text-slate-400 truncate mt-1">
                                Discipline:{" "}
                                <span className="text-slate-200">{disciplineLabel(s)}</span>
                                {" • "}
                                Effective:{" "}
                                <span className="text-slate-200">{fmtDate(s.effective_date)}</span>
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="p-4 sm:p-5">
                {!selectedGeneric ? (
                  <div className="text-sm text-slate-300">
                    Select a foundational standard to view details.
                  </div>
                ) : (
                  <article className="space-y-4">
                    <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold text-slate-100">
                          {selectedGeneric.name || `Standard #${selectedGeneric.standard_id}`}
                        </h2>
                        <div className="text-xs text-slate-400 mt-2">
                          Discipline:{" "}
                          <span className="text-slate-200">{disciplineLabel(selectedGeneric)}</span>
                          {" • "}
                          Effective:{" "}
                          <span className="text-slate-200">{fmtDate(selectedGeneric.effective_date)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {normalizeDocUrl(selectedGeneric.url) ? (
                          <a
                            href={normalizeDocUrl(selectedGeneric.url)!}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 rounded-lg text-sm border border-slate-700 bg-slate-800 hover:border-slate-400"
                          >
                            View / Print Document
                          </a>
                        ) : (
                          <span className="px-3 py-2 rounded-lg text-sm border border-slate-800 bg-slate-950/40 text-slate-400">
                            No document available
                          </span>
                        )}
                      </div>
                    </header>

                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                      <div className="text-xs uppercase tracking-wider text-slate-400">Summary</div>

                      <div className="mt-3 w-full overflow-x-auto">
                        {selectedGeneric.summary_md ? (
                          <div className="prose prose-invert max-w-none text-sm">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: (props) => (
                                  <p className="mb-4 leading-relaxed text-slate-200">
                                    {props.children}
                                  </p>
                                ),
                                ul: (props) => (
                                  <ul className="mb-4 ml-6 list-disc space-y-1 text-slate-200">
                                    {props.children}
                                  </ul>
                                ),
                                ol: (props) => (
                                  <ol className="mb-4 ml-6 list-decimal space-y-1 text-slate-200">
                                    {props.children}
                                  </ol>
                                ),
                                h2: (props) => (
                                  <h2 className="mt-6 mb-3 text-xl font-semibold text-white">
                                    {props.children}
                                  </h2>
                                ),
                                h3: (props) => (
                                  <h3 className="mt-5 mb-2 text-lg font-semibold text-white">
                                    {props.children}
                                  </h3>
                                ),
                                strong: (props) => (
                                  <strong className="font-semibold text-white">
                                    {props.children}
                                  </strong>
                                ),
                              }}
                            >
                              {selectedGeneric.summary_md}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400">No summary available.</div>
                        )}
                      </div>
                    </div>
                  </article>
                )}
              </div>
            </div>
          </section>        </div>
      </PageContainer>
    </>
  );
}