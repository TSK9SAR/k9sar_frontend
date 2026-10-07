import { useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Link, useSearchParams } from "react-router-dom";
import { apiJson } from "../../lib/api";
import PageContainer from "../../components/PageContainer";

const fieldClass = "mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100";
const buttonClass = "rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed";
const primaryClass = "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed";
const roles = { member: "All members", evaluator: "Evaluators, supervisors, and administrators", supervisor: "Supervisors and administrators", admin: "Administrators only" };
const notifications = { none: "No emails by default", announcements: "Announcements only", all: "All new topics and replies" };
const emptyCategory = { name: "", description: "", sortorder: 0, min_role: "member", notify_default: "none", is_active: true };

function errorMessage(error) {
    const detail = error?.data?.detail;
    return typeof detail === "string" ? detail : error?.message || "Unable to complete this action.";
}

function ErrorNotice({ message }) {
    if (!message) return null;
    return <div role="alert" className="rounded-lg border border-red-700 bg-red-950/40 p-3 text-red-200">
        {message}
        {/2fa|mfa|two.factor/i.test(message) && <p className="mt-2"><Link className="underline" to="/login?next=%2Fadmin%2Fforums">Sign in with two-factor verification</Link> to continue.</p>}
    </div>;
}

function ManagementDialog({ title, busy, onClose, children }) {
    return <Dialog open onClose={() => { if (!busy) onClose(); }} className="relative z-50">
        <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
        <div className="fixed inset-0 overflow-y-auto p-4 sm:p-8">
            <div className="flex min-h-full items-center justify-center">
                <DialogPanel className="w-full max-w-xl space-y-5 rounded-xl border border-slate-600 bg-slate-900 p-5 text-slate-100 shadow-xl sm:p-6">
                    <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
                    {children}
                </DialogPanel>
            </div>
        </div>
    </Dialog>;
}

function CategoryEditor({ category, onClose, onSaved }) {
    const [draft, setDraft] = useState(() => Object.fromEntries(Object.keys(emptyCategory).map(key => [key, category?.[key] ?? emptyCategory[key]])));
    const [reviewing, setReviewing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const update = (key, value) => setDraft(current => ({ ...current, [key]: value }));

    async function save() {
        setBusy(true); setError("");
        try {
            await apiJson(`/admin/forum/categories${category ? `/${category.category_id}` : ""}`, {
                method: category ? "PUT" : "POST",
                body: JSON.stringify({ ...draft, name: draft.name.trim(), sortorder: Number(draft.sortorder), ...(category ? { expected_revision: category.revision } : {}) }),
            });
            onSaved(category ? "Category updated." : "Category created.");
        } catch (err) { setError(errorMessage(err)); }
        finally { setBusy(false); }
    }

    return <ManagementDialog title={category ? `Edit ${category.name}` : "Create category"} busy={busy} onClose={onClose}>
        <ErrorNotice message={error} />
        {reviewing ? <>
            <dl className="space-y-3 text-sm">
                <div><dt className="text-slate-400">Name</dt><dd className="break-words font-semibold">{draft.name.trim()}</dd></div>
                <div><dt className="text-slate-400">Description</dt><dd className="whitespace-pre-wrap break-words">{draft.description || "No description"}</dd></div>
                <div><dt className="text-slate-400">Access</dt><dd>{roles[draft.min_role]}</dd></div>
                <div><dt className="text-slate-400">Visibility</dt><dd>{draft.is_active ? "Visible to permitted members" : "Hidden from members"}</dd></div>
                <div><dt className="text-slate-400">Default email preference</dt><dd>{notifications[draft.notify_default]}</dd></div>
                <div><dt className="text-slate-400">Display order</dt><dd>{draft.sortorder} (lower numbers appear first)</dd></div>
            </dl>
            {category && <div className="rounded-lg border border-amber-700 bg-amber-950/30 p-3 text-sm text-amber-100">
                These settings apply to all {category.topic_count} topic{category.topic_count === 1 ? "" : "s"} in this category.
                {category.min_role !== draft.min_role && <p className="mt-2">Access changes from <strong>{roles[category.min_role]}</strong> to <strong>{roles[draft.min_role]}</strong>. Members may gain or lose access to existing discussions.</p>}
                {!draft.is_active && <p className="mt-2">Hiding preserves the discussions, but members cannot open them or reply by email. Administrators can restore the category or move its topics using these management tools.</p>}
                {!category.is_active && draft.is_active && <p className="mt-2">Showing this category makes its existing discussions available to the permitted members again.</p>}
            </div>}
            <p className="text-sm text-slate-400">Members’ personal email preferences still apply. Saving these settings does not send a notification.</p>
            <div className="flex flex-wrap justify-end gap-2">
                <button className={buttonClass} disabled={busy} onClick={onClose}>Cancel</button>
                <button className={buttonClass} disabled={busy} onClick={() => setReviewing(false)}>Back</button>
                <button className={primaryClass} disabled={busy} onClick={save}>{busy ? "Saving…" : category ? "Confirm changes" : "Create category"}</button>
            </div>
        </> : <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (draft.name.trim()) setReviewing(true); }}>
            <label className="block text-sm">Name<input autoFocus required maxLength={120} className={fieldClass} value={draft.name} onChange={event => update("name", event.target.value)} /></label>
            <label className="block text-sm">Description<textarea rows={3} maxLength={5000} className={fieldClass} value={draft.description} onChange={event => update("description", event.target.value)} /></label>
            <label className="block text-sm">Who can access this category?<select className={fieldClass} value={draft.min_role} onChange={event => update("min_role", event.target.value)}>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block text-sm">Default email preference<select className={fieldClass} value={draft.notify_default} onChange={event => update("notify_default", event.target.value)}>{Object.entries(notifications).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <p className="text-xs text-slate-400">Applies to members who use the category’s default email preference.</p>
            <label className="block text-sm">Display order<input type="number" required min={-100000} max={100000} step={1} className={fieldClass} value={draft.sortorder} onChange={event => update("sortorder", event.target.value)} /><span className="text-xs text-slate-400">Lower numbers appear first.</span></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_active} onChange={event => update("is_active", event.target.checked)} />Show this category to permitted members</label>
            <div className="flex justify-end gap-2"><button type="button" className={buttonClass} onClick={onClose}>Cancel</button><button className={primaryClass} disabled={!draft.name.trim()}>Review changes</button></div>
        </form>}
    </ManagementDialog>;
}

function DeleteCategory({ category, onClose, onSaved }) {
    const [preview, setPreview] = useState(null);
    const [confirmText, setConfirmText] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        apiJson(`/admin/forum/categories/${category.category_id}/delete-preview`, { method: "POST" })
            .then(data => { if (active) setPreview(data); }).catch(err => { if (active) setError(errorMessage(err)); });
        return () => { active = false; };
    }, [category.category_id]);
    async function remove() {
        setBusy(true); setError("");
        try {
            await apiJson(`/admin/forum/categories/${category.category_id}/delete-confirm`, { method: "POST", body: JSON.stringify({ confirmation_token: preview.confirmation_token, confirm_text: confirmText }) });
            onSaved("Empty category deleted.");
        } catch (err) { setError(errorMessage(err)); setPreview(null); }
        finally { setBusy(false); }
    }
    return <ManagementDialog title="Delete empty category" busy={busy} onClose={onClose}>
        <ErrorNotice message={error} />
        {preview ? <>
            <p>Permanently delete <strong>{preview.category.name}</strong>? It contains no topics. This cannot be undone.</p>
            <label className="block text-sm">Type <strong>{preview.confirm_text}</strong> to confirm.<input className={fieldClass} autoComplete="off" value={confirmText} onChange={event => setConfirmText(event.target.value)} /></label>
        </> : !error && <p role="status">Checking category…</p>}
        <div className="flex justify-end gap-2"><button className={buttonClass} disabled={busy} onClick={onClose}>{error ? "Close" : "Cancel"}</button><button className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold disabled:opacity-40" disabled={busy || !preview || confirmText !== preview.confirm_text} onClick={remove}>{busy ? "Deleting…" : "Delete category"}</button></div>
    </ManagementDialog>;
}

function MoveTopic({ topic, categories, onClose, onSaved }) {
    const [destination, setDestination] = useState("");
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const choices = categories.filter(category => category.is_active && category.category_id !== topic.category_id);
    async function submit(confirm) {
        setBusy(true); setError("");
        try {
            const result = await apiJson(`/admin/forum/topics/${topic.topic_id}/move-${confirm ? "confirm" : "preview"}`, {
                method: "POST", body: JSON.stringify({ destination_category_id: Number(destination), ...(confirm ? { confirmation_token: preview.confirmation_token } : {}) }),
            });
            if (confirm) onSaved(`Topic moved to ${result.category_name}.`);
            else setPreview(result);
        } catch (err) { setError(errorMessage(err)); setPreview(null); }
        finally { setBusy(false); }
    }
    return <ManagementDialog title="Move topic" busy={busy} onClose={onClose}>
        <ErrorNotice message={error} />
        <p className="break-words font-semibold">{topic.title}</p>
        {preview ? <>
            <p>Move from <strong>{preview.source.name}</strong> to <strong>{preview.destination.name}</strong>.</p>
            <div className="rounded-lg border border-amber-700 bg-amber-950/30 p-3 text-sm text-amber-100">
                <p>Current access: <strong>{preview.source.is_active ? roles[preview.source.min_role] : "Hidden from members"}</strong></p>
                <p className="mt-2">Destination access: <strong>{roles[preview.destination.min_role]}</strong></p>
                {(preview.source.min_role !== preview.destination.min_role || !preview.source.is_active) && <p className="mt-2">Members may gain or lose access to the entire discussion, including its existing posts and attachments.</p>}
            </div>
            <p className="text-sm">All {preview.post_count} posts, {preview.poll_count} polls, and {preview.attachment_count} attachments stay with the topic. Existing links continue to work for members with access.</p>
            <p className="text-sm text-slate-400">Moving sends no email. Future notifications use the destination’s settings ({notifications[preview.destination.notify_default].toLowerCase()}) and members’ personal preferences. Email replies follow the destination’s access rules.</p>
        </> : <>
            <p className="text-sm text-slate-400">Currently in {topic.category_name}{!topic.category_active && " (hidden)"}.</p>
            <label className="block text-sm">Destination category<select className={fieldClass} value={destination} onChange={event => setDestination(event.target.value)}><option value="">Choose a category</option>{choices.map(category => <option key={category.category_id} value={category.category_id}>{category.name}</option>)}</select></label>
            {!choices.length && <p className="text-sm text-amber-200">Create or show another category before moving this topic.</p>}
        </>}
        <div className="flex flex-wrap justify-end gap-2">
            <button className={buttonClass} disabled={busy} onClick={onClose}>Cancel</button>
            {preview && <button className={buttonClass} disabled={busy} onClick={() => setPreview(null)}>Back</button>}
            <button className={primaryClass} disabled={busy || !destination} onClick={() => submit(Boolean(preview))}>{busy ? "Working…" : preview ? "Confirm move" : "Review move"}</button>
        </div>
    </ManagementDialog>;
}

export default function AdminForumManagementPage() {
    const [searchParams] = useSearchParams();
    const [categories, setCategories] = useState([]);
    const [topics, setTopics] = useState({ items: [], total: 0 });
    const [query, setQuery] = useState(() => ({ q: "", category_id: "", topic_id: searchParams.get("topic") || "", offset: 0 }));
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [refresh, setRefresh] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [dialog, setDialog] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let active = true;
        async function load() {
            setLoading(true); setError("");
            try {
                const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== "").map(([key, value]) => [key, String(value)]));
                const [categoryData, topicData] = await Promise.all([apiJson("/admin/forum/categories"), apiJson(`/admin/forum/topics?${params}`)]);
                if (active) {
                    setCategories(categoryData); setTopics(topicData); setReady(true);
                    if (query.offset > 0 && query.offset >= topicData.total) {
                        setQuery(current => ({ ...current, offset: Math.max(0, Math.floor((topicData.total - 1) / 25) * 25) }));
                    }
                }
            } catch (err) { if (active) { setError(errorMessage(err)); setReady(false); } }
            finally { if (active) setLoading(false); }
        }
        load();
        return () => { active = false; };
    }, [query, refresh]);

    function saved(text) { setDialog(null); setMessage(text); setRefresh(value => value + 1); }
    const dialogProps = { onClose: () => setDialog(null), onSaved: saved };

    return <PageContainer>
        <div className="space-y-7 py-6 text-slate-100">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div><h1 className="text-2xl font-semibold">Manage Forums &amp; Surveys</h1><p className="mt-2 text-sm text-slate-400">Organize categories and move discussions. Changes require an administrator with two-factor verification.</p></div>
                <div className="flex flex-wrap gap-2"><Link className={buttonClass} to="/forums">View forums</Link><Link className={buttonClass} to="/admin/forum-surveys">Survey reports</Link></div>
            </header>
            <ErrorNotice message={error} />
            {message && <p role="status" className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-3 text-emerald-200">{message}</p>}
            {loading && <p role="status" className="text-slate-400">Loading forum management…</p>}
            {!loading && error && <button className={buttonClass} onClick={() => setRefresh(value => value + 1)}>Reload</button>}
            {ready && <>
                <section aria-labelledby="categories-title" className="space-y-4">
                    <div className="flex items-center justify-between gap-3"><h2 id="categories-title" className="text-xl font-semibold">Categories</h2><button disabled={loading} className={primaryClass} onClick={() => setDialog({ type: "edit", category: null })}>Create category</button></div>
                    <p className="text-sm text-slate-400">Hide a category to preserve its discussions while removing member access. Only empty categories can be deleted.</p>
                    {!categories.length && <p>No categories yet. Create one to get started.</p>}
                    <div className="grid gap-3 lg:grid-cols-2">
                        {categories.map(category => <article key={category.category_id} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 break-words font-semibold">{category.name}</h3><span className={`rounded px-2 py-1 text-xs ${category.is_active ? "bg-emerald-950 text-emerald-200" : "bg-amber-950 text-amber-200"}`}>{category.is_active ? "Visible" : "Hidden"}</span></div>
                            {category.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{category.description}</p>}
                            <p className="mt-3 text-sm text-slate-400">{category.topic_count} topics · Order {category.sortorder}</p>
                            <p className="mt-1 text-xs text-slate-400">{roles[category.min_role]} · {notifications[category.notify_default]}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button className={buttonClass} disabled={loading} onClick={() => { setCategoryFilter(String(category.category_id)); setSearch(""); setQuery({ q: "", category_id: String(category.category_id), topic_id: "", offset: 0 }); }}>View topics</button>
                                <button className={buttonClass} disabled={loading} aria-label={`Edit ${category.name}`} onClick={() => setDialog({ type: "edit", category })}>Edit</button>
                                <button className={buttonClass} disabled={loading || category.topic_count > 0} title={category.topic_count ? "Move all topics out before deleting this category." : "Delete this empty category"} aria-label={`Delete ${category.name}`} onClick={() => setDialog({ type: "delete", category })}>Delete</button>
                            </div>
                        </article>)}
                    </div>
                </section>
                <section aria-labelledby="topics-title" className="space-y-4">
                    <h2 id="topics-title" className="text-xl font-semibold">Move topics</h2>
                    <p className="text-sm text-slate-400">Find discussions in any category, including hidden categories.</p>
                    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setQuery({ q: search, category_id: categoryFilter, topic_id: "", offset: 0 }); }}>
                        <label className="min-w-48 flex-1 text-sm">Topic title<input className={fieldClass} maxLength={200} value={search} onChange={event => setSearch(event.target.value)} /></label>
                        <label className="min-w-48 flex-1 text-sm">Category<select className={fieldClass} value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="">All categories</option>{categories.map(category => <option key={category.category_id} value={category.category_id}>{category.name}{!category.is_active && " (hidden)"}</option>)}</select></label>
                        <button className={buttonClass} disabled={loading}>Search</button>
                        <button type="button" className={buttonClass} disabled={loading} onClick={() => { setSearch(""); setCategoryFilter(""); setQuery({ q: "", category_id: "", topic_id: "", offset: 0 }); }}>Clear filters</button>
                    </form>
                    {query.topic_id && <p className="text-sm text-slate-400">Showing topic #{query.topic_id}. Clear filters to see all topics.</p>}
                    <div className="divide-y divide-slate-700 rounded-xl border border-slate-700">
                        {topics.items.map(topic => <div key={topic.topic_id} className="flex items-center justify-between gap-4 p-4">
                            <div className="min-w-0"><p className="break-words font-medium">{topic.category_active ? <Link className="text-emerald-300 hover:underline" to={`/forums/topics/${topic.topic_id}`}>{topic.title}</Link> : topic.title}</p><p className="mt-1 text-sm text-slate-400">{topic.category_name}{!topic.category_active && " (hidden)"} · #{topic.topic_id}{topic.is_locked && " · Locked"}{topic.is_pinned && " · Pinned"}</p></div>
                            <button className={buttonClass} disabled={loading} aria-label={`Move ${topic.title}`} onClick={() => setDialog({ type: "move", topic })}>Move</button>
                        </div>)}
                        {!topics.items.length && <p className="p-4 text-slate-400">No matching topics.</p>}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400"><span>{topics.total ? `${query.offset + 1}–${Math.min(query.offset + 25, topics.total)} of ${topics.total} topics` : "0 topics"}</span><div className="flex gap-2"><button className={buttonClass} disabled={loading || query.offset === 0} onClick={() => setQuery(current => ({ ...current, offset: Math.max(0, current.offset - 25) }))}>Previous</button><button className={buttonClass} disabled={loading || query.offset + 25 >= topics.total} onClick={() => setQuery(current => ({ ...current, offset: current.offset + 25 }))}>Next</button></div></div>
                </section>
            </>}
        </div>
        {dialog?.type === "edit" && <CategoryEditor category={dialog.category} {...dialogProps} />}
        {dialog?.type === "delete" && <DeleteCategory category={dialog.category} {...dialogProps} />}
        {dialog?.type === "move" && <MoveTopic topic={dialog.topic} categories={categories} {...dialogProps} />}
    </PageContainer>;
}
