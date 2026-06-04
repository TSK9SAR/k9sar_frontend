import React, { useEffect, useState } from "react";
import PageContainer from "../../components/PageContainer";
import { apiJson } from "../../lib/api";

type CleanupAuditRow = {
    cleanup_event_id: number;
    created_at: string;
    actor_user_id: number;
    actor_email?: string | null;
    actor_name?: string | null;
    action: string;
    entity_type: string;
    entity_id?: number | null;
    entity_label?: string | null;
    deleted_counts?: Record<string, number>;
    affected_ids?: Record<string, number[]>;
    warnings?: string[];
    confirmation_text?: string | null;
};

function formatDateTime(value?: string | null) {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function labelizeKey(key: string) {
    return key.split("_").join(" ");
}

function JsonBlock({ data }: { data: any }) {
    return (
        <pre className="max-h-80 overflow-auto rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-200">
            {JSON.stringify(data ?? {}, null, 2)}
        </pre>
    );
}

export default function AdminCleanupAuditPage() {
    const [rows, setRows] = useState<CleanupAuditRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [openId, setOpenId] = useState<number | null>(null);

    async function loadAudit() {
        setLoading(true);
        setErr(null);

        try {
            const data = await apiJson<CleanupAuditRow[]>("/admin/cleanup/audit", {
                authRequired: true,
                mfaRequired: true,
            });
            setRows(Array.isArray(data) ? data : []);
        } catch (e: any) {
            setErr(e?.data?.detail || e?.message || "Failed to load cleanup audit.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadAudit();
    }, []);

    return (
        <PageContainer maxWidth="full" className="space-y-6 py-6">
            <div className="mx-auto w-full max-w-7xl text-left space-y-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-lg font-semibold text-slate-100">
                            Admin · Cleanup Audit
                        </h1>
                        <p className="text-xs text-slate-300">
                            Review destructive cleanup actions.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={loadAudit}
                        disabled={loading}
                        className="rounded-lg border border-slate-500 bg-slate-700 px-3 py-2 text-sm text-slate-100 hover:bg-slate-600 disabled:opacity-60"
                    >
                        {loading ? "Refreshing…" : "Refresh"}
                    </button>
                </div>

                {err && (
                    <div className="rounded-lg border border-red-700 bg-red-900/30 p-3 text-sm text-red-200">
                        {err}
                    </div>
                )}

                <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-800 text-xs uppercase tracking-wide text-slate-400">
                                <tr>
                                    <th className="px-3 py-2 text-left">When</th>
                                    <th className="px-3 py-2 text-left">Actor</th>
                                    <th className="px-3 py-2 text-left">Action</th>
                                    <th className="px-3 py-2 text-left">Entity</th>
                                    <th className="px-3 py-2 text-left">Deleted</th>
                                    <th className="px-3 py-2 text-right">Details</th>
                                </tr>
                            </thead>

                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-3 py-8 text-center text-slate-400"
                                        >
                                            {loading ? "Loading cleanup audit…" : "No cleanup audit events found."}
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row) => {
                                        const open = openId === row.cleanup_event_id;

                                        return (
                                            <React.Fragment key={row.cleanup_event_id}>
                                                <tr className="border-t border-slate-800 odd:bg-slate-900 even:bg-slate-800/60">
                                                    <td className="px-3 py-2 text-slate-200">
                                                        {formatDateTime(row.created_at)}
                                                    </td>

                                                    <td className="px-3 py-2 text-slate-200">
                                                        {row.actor_name ||
                                                            row.actor_email ||
                                                            `User #${row.actor_user_id}`}
                                                    </td>

                                                    <td className="px-3 py-2">
                                                        <span className="rounded-full border border-red-700 bg-red-950/40 px-2 py-1 text-xs text-red-200">
                                                            {labelizeKey(row.action)}
                                                        </span>
                                                    </td>

                                                    <td className="px-3 py-2 text-slate-200">
                                                        <div>{row.entity_label || row.entity_type}</div>
                                                        {row.entity_id != null && (
                                                            <div className="text-xs text-slate-400">
                                                                #{row.entity_id}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="px-3 py-2 text-slate-300">
                                                        {Object.entries(row.deleted_counts || {}).length === 0
                                                            ? "—"
                                                            : Object.entries(row.deleted_counts || {})
                                                                  .map(([k, v]) => `${labelizeKey(k)}: ${v}`)
                                                                  .join(", ")}
                                                    </td>

                                                    <td className="px-3 py-2 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setOpenId(open ? null : row.cleanup_event_id)
                                                            }
                                                            className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600"
                                                        >
                                                            {open ? "Hide" : "View"}
                                                        </button>
                                                    </td>
                                                </tr>

                                                {open && (
                                                    <tr className="border-t border-slate-800 bg-slate-950">
                                                        <td colSpan={6} className="px-3 py-3">
                                                            <div className="grid gap-3 md:grid-cols-2">
                                                                <div>
                                                                    <div className="mb-1 text-xs font-semibold text-slate-400">
                                                                        Affected IDs
                                                                    </div>
                                                                    <JsonBlock data={row.affected_ids} />
                                                                </div>

                                                                <div>
                                                                    <div className="mb-1 text-xs font-semibold text-slate-400">
                                                                        Warnings
                                                                    </div>
                                                                    <JsonBlock data={row.warnings} />
                                                                </div>
                                                            </div>

                                                            <div className="mt-3 text-xs text-slate-400">
                                                                Confirmation:{" "}
                                                                <span className="font-mono text-slate-200">
                                                                    {row.confirmation_text || "—"}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </PageContainer>
    );
}