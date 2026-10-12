import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageContainer from "../../components/PageContainer";
import { apiJson } from "../../lib/api";

const filters = [["all", "All invitations"], ["pending", "Pending"], ["completed", "Completed"], ["expired", "Expired"]];
const buttonClass = "rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40";
const statusStyles = {
    pending: "border-amber-700 bg-amber-950/50 text-amber-200",
    completed: "border-emerald-700 bg-emerald-950/50 text-emerald-200",
    expired: "border-slate-600 bg-slate-800 text-slate-300",
};

function DateTime({ value }) {
    if (!value) return <span className="text-slate-500">—</span>;
    const date = new Date(value);
    return <time dateTime={value} title={date.toLocaleString()} className="block whitespace-nowrap">
        <span className="block">{date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
        <span className="block text-xs text-slate-400">{date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
    </time>;
}

function StatusBadge({ status }) {
    return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>;
}

function RemainingValidity({ invitation }) {
    if (invitation.status === "completed") return <span className="text-slate-400">Already used</span>;
    if (invitation.status === "expired") return <span className="text-slate-400">No time remaining</span>;
    const seconds = invitation.remaining_seconds;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(seconds % 86400 / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    const text = days > 0 ? `${days}d ${hours}h left` : hours > 0 ? `${hours}h ${minutes}m left` : minutes > 0 ? `${minutes}m left` : "Less than a minute";
    return <span className={seconds < 86400 ? "font-medium text-amber-200" : "font-medium text-slate-100"}>{text}</span>;
}

function Recipient({ invitation }) {
    const name = [invitation.first_name, invitation.last_name].filter(Boolean).join(" ").trim();
    return <div className="min-w-0">
        {name && <div className="break-words font-semibold text-slate-100">{name}</div>}
        <div className="break-all text-sm text-slate-300">{invitation.email}</div>
        <div className="mt-1 text-xs text-slate-500">Invitation #{invitation.invite_id}</div>
    </div>;
}

export default function InvitationHistoryPage() {
    const [query, setQuery] = useState({ status: "all", q: "", page: 1 });
    const [search, setSearch] = useState("");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refresh, setRefresh] = useState(0);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            setLoading(true);
            setError("");
            try {
                const params = new URLSearchParams({ ...query, page: String(query.page), page_size: "25" });
                const result = await apiJson(`/admin/invites?${params}`, { authRequired: true, signal: controller.signal });
                if (controller.signal.aborted) return;
                if (query.page > 1 && (query.page - 1) * 25 >= result.total) {
                    setQuery(current => ({ ...current, page: Math.max(1, Math.ceil(result.total / 25)) }));
                    return;
                }
                setData(result);
            } catch (err) {
                if (controller.signal.aborted) return;
                setData(null);
                setError(typeof err?.data?.detail === "string" ? err.data.detail : err?.message || "Unable to load invitation history.");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        load();
        return () => controller.abort();
    }, [query, refresh]);

    useEffect(() => {
        const refreshVisiblePage = () => {
            if (!document.hidden) setRefresh(value => value + 1);
        };
        const timer = window.setInterval(refreshVisiblePage, 60000);
        document.addEventListener("visibilitychange", refreshVisiblePage);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", refreshVisiblePage);
        };
    }, []);

    function clearFilters() {
        setSearch("");
        setQuery({ status: "all", q: "", page: 1 });
    }

    return <PageContainer>
        <div className="space-y-6 py-6 text-slate-100">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Invitation History</h1>
                    <p className="mt-2 max-w-2xl text-sm text-slate-400">Review issued invitations, acceptance status, and remaining validity.</p>
                </div>
                <Link to="/admin/invites" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">New invitation</Link>
            </header>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Filter invitations by status">
                {filters.map(([value, label]) => <button key={value} type="button" aria-pressed={query.status === value}
                    disabled={loading} onClick={() => setQuery(current => ({ ...current, status: value, page: 1 }))}
                    className={`rounded-xl border p-4 text-left disabled:cursor-wait ${query.status === value ? "border-emerald-500 bg-emerald-950/50 text-emerald-100" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"}`}>
                    <span className="block text-sm">{label}</span>
                    <span className="mt-2 block text-2xl font-semibold">{data ? data.counts[value] : "—"}</span>
                </button>)}
            </div>

            <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setQuery(current => ({ ...current, q: search.trim(), page: 1 })); }}>
                <label className="min-w-48 flex-1 text-sm">Recipient name or email
                    <input type="search" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} placeholder="Find an invitation…"
                        className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100" />
                </label>
                <button className={buttonClass} disabled={loading}>Search</button>
                <button type="button" className={buttonClass} disabled={loading} onClick={clearFilters}>Clear filters</button>
                <button type="button" className={buttonClass} disabled={loading} onClick={() => setRefresh(value => value + 1)}>Refresh</button>
            </form>
            <div className="space-y-1 text-xs text-slate-400">
                <p>Pending: unused and still valid. Completed: accepted. Expired: unused and past its expiration.</p>
                <p>Times shown in {timeZone}. Status and remaining validity refresh every minute.</p>
                {query.q && <p>Counts reflect invitations matching “{query.q}”.</p>}
            </div>

            {error && <div role="alert" className="rounded-lg border border-red-700 bg-red-950/40 p-4 text-red-200">{error}</div>}
            {loading && <p role="status" className="text-sm text-slate-400">Loading invitation history…</p>}

            {data && <section aria-label="Issued invitations" aria-busy={loading} className={loading ? "space-y-4 opacity-60" : "space-y-4"}>
                {data.items.length ? <>
                    <div className="hidden overflow-x-auto rounded-xl border border-slate-700 lg:block">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-800 text-xs uppercase tracking-wide text-slate-300"><tr>
                                {["Recipient", "Status", "Issued", "Expires", "Completed", "Remaining validity"].map(label => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}
                            </tr></thead>
                            <tbody className="divide-y divide-slate-700">
                                {data.items.map(invitation => <tr key={invitation.invite_id} className="bg-slate-900/50 align-top">
                                    <td className="max-w-xs px-4 py-4"><Recipient invitation={invitation} /></td>
                                    <td className="px-4 py-4"><StatusBadge status={invitation.status} /></td>
                                    <td className="px-4 py-4"><DateTime value={invitation.created_at} /><p className="mt-2 max-w-48 break-words text-xs text-slate-400">By {invitation.created_by_name || "Unknown issuer"}</p></td>
                                    <td className="px-4 py-4"><DateTime value={invitation.expires_at} /></td>
                                    <td className="px-4 py-4"><DateTime value={invitation.completed_at} /></td>
                                    <td className="px-4 py-4"><RemainingValidity invitation={invitation} /></td>
                                </tr>)}
                            </tbody>
                        </table>
                    </div>
                    <div className="space-y-3 lg:hidden">
                        {data.items.map(invitation => <article key={invitation.invite_id} className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3"><Recipient invitation={invitation} /><StatusBadge status={invitation.status} /></div>
                            <dl className="grid grid-cols-2 gap-4 text-sm">
                                <div><dt className="mb-1 text-xs text-slate-400">Issued</dt><dd><DateTime value={invitation.created_at} /></dd></div>
                                <div><dt className="mb-1 text-xs text-slate-400">Expires</dt><dd><DateTime value={invitation.expires_at} /></dd></div>
                                <div><dt className="mb-1 text-xs text-slate-400">Completed</dt><dd><DateTime value={invitation.completed_at} /></dd></div>
                                <div><dt className="mb-1 text-xs text-slate-400">Remaining validity</dt><dd><RemainingValidity invitation={invitation} /></dd></div>
                                <div className="col-span-2"><dt className="mb-1 text-xs text-slate-400">Issued by</dt><dd className="break-words">{invitation.created_by_name || "Unknown issuer"}</dd></div>
                            </dl>
                        </article>)}
                    </div>
                </> : <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-8 text-center text-slate-400">
                    {query.q || query.status !== "all" ? "No invitations match these filters." : "No invitations have been issued yet."}
                </div>}
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
                    <span>{data.total ? `${(data.page - 1) * data.page_size + 1}–${Math.min(data.page * data.page_size, data.total)} of ${data.total} invitations` : "0 invitations"}</span>
                    <div className="flex gap-2">
                        <button className={buttonClass} disabled={loading || data.page <= 1} onClick={() => setQuery(current => ({ ...current, page: current.page - 1 }))}>Previous</button>
                        <button className={buttonClass} disabled={loading || data.page * data.page_size >= data.total} onClick={() => setQuery(current => ({ ...current, page: current.page + 1 }))}>Next</button>
                    </div>
                </div>
                <p className="text-xs text-slate-500">Updated {new Date(data.evaluated_at).toLocaleTimeString()}. Invitation status tracks acceptance; email delivery and opens are not recorded.</p>
            </section>}
        </div>
    </PageContainer>;
}
