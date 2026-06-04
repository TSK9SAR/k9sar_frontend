import React, { useEffect, useMemo, useState } from "react";
import PageContainer from "../../components/PageContainer";
import { apiJson } from "../../lib/api";

type RosterRow = {
    handler_id: number;
    handler_name: string;
    email: string;
    dues_year: number;
    status: "unpaid" | "paid" | "waived";
    amount_due: number;
    amount_paid?: number | null;
    paid_on?: string | null;
    payment_method?: string | null;
    reference_note?: string | null;
};

type Me = {
    roles?: string[];
};

const inputClass =
    "w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100";

export default function AdminDuesPage() {
    const nowYear = new Date().getFullYear();

    const [me, setMe] = useState<Me | null>(null);
    const [year, setYear] = useState<number>(nowYear);
    const [rows, setRows] = useState<RosterRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "paid" | "waived">("all");
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const [editing, setEditing] = useState<RosterRow | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        status: "unpaid" as "unpaid" | "paid" | "waived",
        amount_paid: "",
        paid_on: "",
        payment_method: "",
        reference_note: "",
    });

    async function loadMe() {
        const data = await apiJson("/auth/me", { authRequired: true, mfaRequired: true });
        setMe(data);
    }
    const canEdit = !!me?.roles?.includes("admin");

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();

        return rows.filter((row) => {
            const matchesSearch = !q || row.handler_name.toLowerCase().includes(q);
            const matchesStatus = statusFilter === "all" || row.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [rows, search, statusFilter]);

    const visibleIds = useMemo(() => filteredRows.map((r) => r.handler_id), [filteredRows]);

    const allVisibleSelected =
        visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    function toggleSelectAllVisible() {
        if (allVisibleSelected) {
            setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
        } else {
            setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
        }
    }

    function toggleSelectOne(handlerId: number) {
        setSelectedIds((prev) =>
            prev.includes(handlerId)
                ? prev.filter((id) => id !== handlerId)
                : [...prev, handlerId]
        );
    }

    function emailSelected() {
        const emails = rows
            .filter((row) => selectedIds.includes(row.handler_id))
            .map((row) => row.email?.trim())
            .filter((email): email is string => !!email);

        const uniqueEmails = Array.from(new Set(emails));

        if (uniqueEmails.length === 0) {
            setError("No email addresses found for the selected handlers.");
            return;
        }

        const subject =
            statusFilter === "unpaid"
                ? `TSK9SAR dues reminder for ${year}`
                : `TSK9SAR membership dues for ${year}`;

        const body =
            statusFilter === "unpaid"
                ? `Hello,\n\nThis is a reminder that your TSK9SAR annual handler dues for ${year} are currently unpaid.\n\nPlease arrange payment of $20 at your earliest convenience.\n\nThank you.`
                : `Hello,\n\nRegarding your TSK9SAR membership dues for ${year}.\n\nThank you.`;

        const href =
            `mailto:${encodeURIComponent(uniqueEmails.join(","))}` +
            `?subject=${encodeURIComponent(subject)}` +
            `&body=${encodeURIComponent(body)}`;

        window.location.href = href;
    }

    async function loadRoster(selectedYear = year) {
        setLoading(true);
        setError(null);
        try {
            const data = await apiJson(`/admin/handlers/dues/roster?year=${selectedYear}`);
            setRows(data ?? []);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load dues roster");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        setSelectedIds([]);
    }, [year, rows]);

    useEffect(() => {
        loadMe();
    }, []);

    useEffect(() => {
        loadRoster(year);
    }, [year]);

    function openEdit(row: RosterRow) {
        setEditing(row);
        setForm({
            status: row.status ?? "unpaid",
            amount_paid: row.amount_paid != null ? String(row.amount_paid) : "",
            paid_on: row.paid_on ?? "",
            payment_method: row.payment_method ?? "",
            reference_note: row.reference_note ?? "",
        });
    }

    function closeEdit() {
        setEditing(null);
        setForm({
            status: "unpaid",
            amount_paid: "",
            paid_on: "",
            payment_method: "",
            reference_note: "",
        });
    }

    async function saveEdit() {
        if (!editing) return;

        setSaving(true);
        setError(null);
        try {
            await apiJson(`/admin/handlers/${editing.handler_id}/dues`, {
                method: "POST",
                body: JSON.stringify({
                    dues_year: year,
                    status: form.status,
                    amount_paid: form.amount_paid === "" ? null : Number(form.amount_paid),
                    paid_on: form.paid_on || null,
                    payment_method: form.payment_method.trim() || null,
                    reference_note: form.reference_note.trim() || null,
                }),
            });

            closeEdit();
            await loadRoster(year);
        } catch (e: any) {
            setError(e?.message ?? "Failed to save dues record");
        } finally {
            setSaving(false);
        }
    }

    return (
        <PageContainer>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <h1 className="text-lg font-semibold">
                    <span className="text-emerald-300">TSK9SAR</span>{" "}
                    <span className="text-slate-100">Membership Dues</span>
                </h1>
            </div>
            <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[260px] flex-1">
                        <label className="mb-1 block text-sm text-slate-300">Search handler</label>
                        <input
                            className={inputClass}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by handler name..."
                        />
                    </div>

                    <div className="w-40 shrink-0">
                        <label className="mb-1 block text-sm text-slate-300">Status</label>
                        <select
                            className={inputClass}
                            value={statusFilter}
                            onChange={(e) =>
                                setStatusFilter(e.target.value as "all" | "unpaid" | "paid" | "waived")
                            }
                        >
                            <option value="all">all</option>
                            <option value="unpaid">unpaid</option>
                            <option value="paid">paid</option>
                            <option value="waived">waived</option>
                        </select>
                    </div>

                    <div className="w-32 shrink-0">
                        <label className="mb-1 block text-sm text-slate-300">Year</label>
                        <input
                            className={inputClass}
                            type="number"
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                        />
                    </div>

                    <div className="shrink-0">
                        <button
                            className="rounded bg-sky-700 px-3 py-2 text-sm text-white hover:bg-sky-600 disabled:opacity-50"
                            onClick={emailSelected}
                            disabled={selectedIds.length === 0}
                        >
                            Email selected
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900  max-h-[1000px]">
                    <table className="min-w-full text-sm bg-slate-800">
                        <thead>
                            <tr className="text-left text-slate-300">
                                <th className="border-b border-slate-700 p-2">Handler</th>
                                <th className="border-b border-slate-700 p-2">Email</th>
                                <th className="border-b border-slate-700 p-2">Year</th>
                                <th className="border-b border-slate-700 p-2">Status</th>
                                <th className="border-b border-slate-700 p-2">Amount Due</th>
                                <th className="border-b border-slate-700 p-2">Amount Paid</th>
                                <th className="border-b border-slate-700 p-2 whitespace-nowrap">Paid On</th>
                                <th className="border-b border-slate-700 p-2">Method</th>
                                <th className="border-b border-slate-700 p-2">Note</th>
                                <th className="border-b border-slate-700 p-2 w-28">Actions</th>
                                <th className="border-b border-slate-700 p-2 w-10">
                                    Select
                                    <input
                                        type="checkbox"
                                        checked={allVisibleSelected}
                                        onChange={toggleSelectAllVisible}
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td className="p-3 text-slate-300" colSpan={10}>
                                        Loading…
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td className="p-3 text-slate-400" colSpan={10}>
                                        No handlers found for this roster.
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => (
                                    <tr key={row.handler_id} className="align-top odd:bg-slate-700 even:bg-slate-650 hover:bg-slate-550">
                                        <td className="border-b border-slate-800 p-2">{row.handler_name}</td>
                                        <td className="border-b border-slate-800 p-2">{row.email ?? "—"}</td>
                                        <td className="border-b border-slate-800 p-2">{row.dues_year}</td>
                                        <td className="border-b border-slate-800 p-2">{row.status}</td>
                                        <td className="border-b border-slate-800 p-2">${row.amount_due.toFixed(2)}</td>
                                        <td className="border-b border-slate-800 p-2">
                                            {row.amount_paid != null ? `$${row.amount_paid.toFixed(2)}` : "—"}
                                        </td>
                                        <td className="border-b border-slate-800 p-2 whitespace-nowrap">
                                            {row.paid_on ?? "—"}
                                        </td>
                                        <td className="border-b border-slate-800 p-2">{row.payment_method ?? "—"}</td>
                                        <td className="border-b border-slate-800 p-2">{row.reference_note ?? "—"}</td>
                                        <td className="border-b border-slate-800 p-2">
                                            {canEdit ? (
                                                <button
                                                    className="rounded bg-sky-700 px-2 py-1 text-xs text-white hover:bg-sky-600"
                                                    onClick={() => openEdit(row)}
                                                >
                                                    Edit
                                                </button>
                                            ) : (
                                                <span className="text-slate-500">View only</span>
                                            )}
                                        </td>
                                        <td className="border-b border-slate-800 p-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(row.handler_id)}
                                                onChange={() => toggleSelectOne(row.handler_id)}
                                            />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {editing && canEdit && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                        <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl">
                            <div className="mb-4">
                                <h2 className="text-lg font-semibold text-slate-100">Edit Dues</h2>
                                <div className="text-sm text-slate-400">
                                    {editing.handler_name} — {year}
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm text-slate-300">Status</label>
                                    <select
                                        className={inputClass}
                                        value={form.status}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                status: e.target.value as "unpaid" | "paid" | "waived",
                                            }))
                                        }
                                    >
                                        <option value="unpaid">unpaid</option>
                                        <option value="paid">paid</option>
                                        <option value="waived">waived</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm text-slate-300">Amount Paid</label>
                                    <input
                                        className={inputClass}
                                        type="number"
                                        step="0.01"
                                        value={form.amount_paid}
                                        onChange={(e) => setForm((p) => ({ ...p, amount_paid: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm text-slate-300">Paid On</label>
                                    <input
                                        className={inputClass}
                                        type="date"
                                        value={form.paid_on}
                                        onChange={(e) => setForm((p) => ({ ...p, paid_on: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm text-slate-300">Payment Method</label>
                                    <input
                                        className={inputClass}
                                        value={form.payment_method}
                                        onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value }))}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-1 block text-sm text-slate-300">Reference Note</label>
                                    <textarea
                                        className={inputClass}
                                        rows={3}
                                        value={form.reference_note}
                                        onChange={(e) => setForm((p) => ({ ...p, reference_note: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                                    onClick={closeEdit}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="rounded bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-60"
                                    onClick={saveEdit}
                                    disabled={saving}
                                >
                                    {saving ? "Saving…" : "Save"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageContainer>
    );
}