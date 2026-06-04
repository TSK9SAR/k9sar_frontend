import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiJson } from "../lib/api";

function classNames(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(" ");
}

type Affiliation = {
    affiliation_id: number;
    name: string;
    callout_line?: string | null;
    sortorder?: number | null;
    is_active?: boolean;
};

export default function AffiliationFilterBar({
    storageKey = "affiliation_id",
    fetchPath = "/public/affiliations",
    label = "Affiliation",
    showCallout = true,
}: {
    storageKey?: string;
    fetchPath?: string;
    label?: string;
    showCallout?: boolean;
}) {
    const [sp, setSp] = useSearchParams();
    const [rows, setRows] = useState<Affiliation[]>([]);
    const [err, setErr] = useState<string | null>(null);

    const selectedIdStr = sp.get(storageKey);
    const selectedId = selectedIdStr ? Number(selectedIdStr) : null;

    useEffect(() => {
        let alive = true;
        (async () => {
            setErr(null);
            try {
                const data = await apiJson(fetchPath);
                const list: Affiliation[] = Array.isArray(data) ? data : data?.items ?? [];
                if (!alive) return;
                setRows(list);
            } catch (e: any) {
                if (!alive) return;
                setErr(e?.message || "Failed to load affiliations");
            }
        })();
        return () => {
            alive = false;
            {
                showCallout && selected?.callout_line ? (
                    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/30 p-3 text-sm text-slate-200">
                        {selected.callout_line}
                    </div>
                ) : null
            }
        };
    }, [fetchPath]);

    const options = useMemo(() => {
        return (rows ?? [])
            .filter((a) => a.is_active !== false)
            .sort((a, b) => {
                const sa = a.sortorder ?? 999999;
                const sb = b.sortorder ?? 999999;
                if (sa !== sb) return sa - sb;
                return a.name.localeCompare(b.name);
            });
    }, [rows]);

    const selected = useMemo(() => {
        if (!selectedId) return null;
        return options.find((a) => a.affiliation_id === selectedId) || null;
    }, [options, selectedId]);

    function setSelected(next: number | null) {
        const n = new URLSearchParams(sp);
        if (!next) n.delete(storageKey);
        else n.set(storageKey, String(next));
        setSp(n, { replace: true });
    }

    return (
        <div className="rounded-2xl border border-slate-600 bg-slate-750/40 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="w-full md:w-[420px]">
                    <label className="block text-sm text-slate-200"></label>
                    <select
                        className="mt-1 w-full rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-slate-100"
                        value={selectedId ?? ""}
                        onChange={(e) => setSelected(e.target.value ? Number(e.target.value) : null)}
                    >
                        <option value="">All affiliations</option>
                        {options.map((a) => (
                            <option key={a.affiliation_id} value={a.affiliation_id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                    {err && <div className="mt-2 text-xs text-rose-300">{err}</div>}
                </div>

                {selectedId ? (
                    <button
                        type="button"
                        onClick={() => setSelected(null)}
                        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
                    >
                        Clear
                    </button>
                ) : null}
            </div>
            {showCallout && selected?.callout_line ? (
                <div className="mt-3 rounded-xl border border-slate-700 bg-slate-800/30 p-3 text-sm font-medium text-red-400">
                    {selected.callout_line}
                </div>
            ) : null}
        </div>
    );
}