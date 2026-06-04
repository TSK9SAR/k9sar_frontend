import React, { useEffect, useMemo, useState } from "react";
import PageContainer from "../components/PageContainer";
import { apiJson } from "../lib/api";

type AffiliationListItem = {
  affiliation_id: number;
  name: string;
  callout_line?: string | null;
  sortorder?: number | null;
};

type AffiliationDetail = {
  affiliation_id: number;
  name: string;
  callout_line?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  url?: string | null;
  sortorder?: number | null;
  is_active?: boolean | null;
};

type AffiliationMembershipRow = {
  handler_id?: number | null;
  user_id?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;

  // backend may send any of these
  role?: string | null;
  role_name?: string | null;
  roles?: Array<string | { role_name?: string | null; name?: string | null }> | null;

  evaluator?: string | null;
  address_line1?: string | null;
  city?: string | null;
};

function FieldRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | number | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-slate-700 py-2 last:border-b-0 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-3">
      <div className="text-xs text-slate-400 sm:text-sm">{label}</div>
      <div className="break-words text-sm text-slate-100">
        {children ?? (value !== null && value !== undefined && value !== "" ? value : "—")}
      </div>
    </div>
  );
}

function CellTwoLine({
  top,
  bottom,
}: {
  top?: string | null;
  bottom?: string | null;
}) {
  return (
    <div className="min-w-0">
      <div className="break-words text-sm text-slate-100">{top || "—"}</div>
      <div className="break-words text-xs text-slate-400">{bottom || "—"}</div>
    </div>
  );
}

function fullName(m: AffiliationMembershipRow) {
  return `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "—";
}

function normalizeRoleDisplay(m: AffiliationMembershipRow): string {
  if (typeof m.role === "string" && m.role.trim()) return m.role.trim();
  if (typeof m.role_name === "string" && m.role_name.trim()) return m.role_name.trim();

  if (Array.isArray(m.roles)) {
    const names = m.roles
      .map((r) => {
        if (typeof r === "string") return r.trim();
        if (r && typeof r.role_name === "string") return r.role_name.trim();
        if (r && typeof r.name === "string") return r.name.trim();
        return "";
      })
      .filter(Boolean);

    if (names.length) return names.join(", ");
  }

  return "—";
}

export default function AffiliationsPage() {
  const [rows, setRows] = useState<AffiliationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [selected, setSelected] = useState<AffiliationDetail | null>(null);
  const [memberships, setMemberships] = useState<AffiliationMembershipRow[]>([]);
  const [viewMode, setViewMode] = useState<"details" | "memberships">("details");

  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingMemberships, setLoadingMemberships] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadList() {
      setLoadingList(true);
      setError("");

      try {
        const data = await apiJson("/public/affiliations");
        const list = Array.isArray(data) ? data : [];

        if (!cancelled) {
          setRows(list);
          setSelectedId((prev) => {
            if (prev && list.some((a: AffiliationListItem) => a.affiliation_id === prev)) {
              return prev;
            }
            return list.length ? list[0].affiliation_id : "";
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load affiliations.");
          setRows([]);
          setSelectedId("");
        }
      } finally {
        if (!cancelled) {
          setLoadingList(false);
        }
      }
    }

    loadList();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      if (!selectedId) {
        setSelected(null);
        return;
      }

      setLoadingDetail(true);
      setError("");

      try {
        const data = await apiJson<AffiliationDetail>(`/affiliations/${selectedId}`);
        if (!cancelled) {
          setSelected(data as AffiliationDetail);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load affiliation details.");
          setSelected(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;

    async function loadMemberships() {
      if (!selectedId) {
        setMemberships([]);
        return;
      }

      setLoadingMemberships(true);
      setError("");

      try {
        const data = await apiJson(`/affiliations/${selectedId}/memberships`);
        if (!cancelled) {
          setMemberships(Array.isArray(data) ? data : []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load affiliation memberships.");
          setMemberships([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMemberships(false);
        }
      }
    }

    loadMemberships();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const membershipCountLabel = useMemo(
    () => `${memberships.length} member${memberships.length === 1 ? "" : "s"}`,
    [memberships]
  );

  return (
    <PageContainer>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-100">Affiliations</h1>
        <p className="text-sm text-slate-400">Read-only affiliation directory</p>
      </div>

      <div className="space-y-4">
        <section className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Select affiliation
              </label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                disabled={loadingList || rows.length === 0}
              >
                {rows.length === 0 ? (
                  <option value="">No affiliations available</option>
                ) : (
                  rows.map((a) => (
                    <option key={a.affiliation_id} value={a.affiliation_id}>
                      {a.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex overflow-hidden rounded-lg gap-2 border border-slate-800 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setViewMode("details")}
                className={`px-4 py-2 text-sm ${viewMode === "details"
                    ? "bg-sky-700 text-white"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-700"
                  }`}
              >
                Details
              </button>

              <button
                type="button"
                onClick={() => setViewMode("memberships")}
                className={`border-l border-slate-600 px-4 py-2 text-sm ${viewMode === "memberships"
                    ? "bg-sky-700 text-white"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-700"
                  }`}
              >
                Members
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {loadingList ? "Loading..." : `${rows.length} affiliation${rows.length === 1 ? "" : "s"}`}
          </div>
        </section>

        {error ? (
          <section className="rounded-xl border border-rose-700 bg-rose-950/40 p-4 text-sm text-rose-200">
            {error}
          </section>
        ) : null}

        {loadingDetail ? (
          <section className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm text-slate-300">
            Loading affiliation details...
          </section>
        ) : null}

        {selected ? (
          <section className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-100">{selected.name}</h2>
              <p className="mt-1 text-sm text-sky-300">{selected.callout_line || "—"}</p>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
              <FieldRow label="Affiliation ID" value={selected.affiliation_id} />
              <FieldRow label="Name" value={selected.name} />
              <FieldRow label="Callout line" value={selected.callout_line} />
              <FieldRow label="Contact name" value={selected.contact_name} />
              <FieldRow label="Phone" value={selected.phone} />
              <FieldRow label="Email" value={selected.email} />
              <FieldRow label="Location" value={selected.location} />
              <FieldRow label="Website">
                {selected.url ? (
                  <a
                    href={selected.url.startsWith("http") ? selected.url : `https://${selected.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-sky-400 hover:underline"
                  >
                    {selected.url}
                  </a>
                ) : (
                  "—"
                )}
              </FieldRow>
            </div>
          </section>
        ) : null}

        {viewMode === "details" && selected ? (
          <section className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm text-slate-300">
            Use the Members tab to view affiliated members for this organization.
          </section>
        ) : null}

        {viewMode === "memberships" && loadingMemberships ? (
          <section className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm text-slate-300">
            Loading members...
          </section>
        ) : null}

        {viewMode === "memberships" && !loadingMemberships && memberships.length === 0 ? (
          <section className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm text-slate-300">
            No members found for this affiliation.
          </section>
        ) : null}

        {viewMode === "memberships" && memberships.length > 0 ? (
          <section className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-100">Memberships</h2>
              <span className="text-xs text-slate-400">{membershipCountLabel}</span>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {memberships.map((m, idx) => (
                <div
                  key={`${m.handler_id ?? m.user_id ?? idx}`}
                  className="rounded-xl border border-slate-700 bg-slate-900/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="break-words text-sm font-semibold text-slate-100">
                        {fullName(m)}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        handler_id: {m.handler_id ?? "—"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 text-sm">
                    <div>
                      <div className="text-xs text-slate-400">Contact</div>
                      <div className="text-slate-100">{m.phone || "—"}</div>
                      <div className="break-words text-xs text-slate-400">{m.email || "—"}</div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400">Role</div>
                      <div className="text-slate-100">{normalizeRoleDisplay(m)}</div>
                      <div className="text-xs text-slate-400">{m.evaluator || "—"}</div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400">Address</div>
                      <div className="text-slate-100">{m.address_line1 || "—"}</div>
                      <div className="text-xs text-slate-400">{m.city || "—"}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-auto rounded-lg border border-slate-700 md:block">
              <table className="min-w-[980px] w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-900">
                  <tr className="border-b border-slate-700">
                    <th className="sticky left-0 z-20 min-w-[180px] border-r border-slate-700 bg-slate-900 px-3 py-3 text-left text-xs font-semibold text-slate-300">
                      Full Name
                    </th>
                    <th className="min-w-[220px] px-3 py-3 text-left text-xs font-semibold text-slate-300">
                      Contact
                    </th>
                    <th className="min-w-[180px] px-3 py-3 text-left text-xs font-semibold text-slate-300">
                      Role
                    </th>
                    <th className="min-w-[220px] px-3 py-3 text-left text-xs font-semibold text-slate-300">
                      Address
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {memberships.map((m, idx) => (
                    <tr
                      key={`${m.handler_id ?? m.user_id ?? idx}`}
                      className="border-b border-slate-700/70 hover:bg-slate-900/40"
                    >
                      <td className="sticky left-0 z-10 border-r border-slate-700 bg-slate-800 px-3 py-3 align-top">
                        <CellTwoLine top={m.first_name} bottom={m.last_name} />
                      </td>

                      <td className="px-3 py-3 align-top">
                        <CellTwoLine top={m.phone} bottom={m.email} />
                      </td>

                      <td className="px-3 py-3 align-top">
                        <CellTwoLine top={normalizeRoleDisplay(m)} bottom={m.evaluator} />
                      </td>

                      <td className="px-3 py-3 align-top">
                        <CellTwoLine top={m.address_line1} bottom={m.city} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </PageContainer>
  );
}