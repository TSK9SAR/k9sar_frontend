import React, { useEffect, useMemo, useState } from "react";
import PageContainer from "../../components/PageContainer";
import { apiJson, apiFetch } from "../../lib/api";
import AffiliationIdBackgroundModal from "../../components/admin/AffiliationIdBackgroundModal";

type Affiliation = {
    affiliation_id: number;
    name: string;

    callout_line?: string | null;

    contact_name?: string | null;
    phone?: string | null;
    location?: string | null;
    url?: string | null;

    public_slug?: string | null;
    allow_public_embed?: boolean;
    embed_title?: string | null;
    id_card_text_theme?: "light" | "dark";
    sortorder?: number | null;
    is_active?: boolean;
};

type AffiliationCreate = Omit<Affiliation, "affiliation_id">;
type AffiliationUpdate = Partial<AffiliationCreate>;

type CurrentUser = {
    user_id: number;
    roles: string[];
};

function classNames(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(" ");
}

function normalizeBool(v: any): boolean {
    return v === true || v === 1 || v === "1" || v === "true";
}

function cleanSlug(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function emptyNew(): AffiliationCreate {
    return {
        name: "",
        callout_line: "",
        contact_name: "",
        phone: "",
        location: "",
        url: "",
        public_slug: "",
        allow_public_embed: false,
        embed_title: "",
        sortorder: null,
        is_active: true,
        id_card_text_theme: "light",
    };
}

function cleanPayload<T extends Record<string, any>>(obj: T): Partial<T> {
    // Trim strings; turn "" into null for nullable fields (except name).
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string") {
            const t = v.trim();
            if (k === "name") out[k] = t; // name must stay string
            else out[k] = t === "" ? null : t;
        } else {
            out[k] = v;
        }
    }
    return out;
}

export default function AdminAffiliationsPage() {
    const [rows, setRows] = useState<Affiliation[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [query, setQuery] = useState("");
    const [showInactive, setShowInactive] = useState(false);

    // create form
    const [creating, setCreating] = useState(false);
    const [newRow, setNewRow] = useState<AffiliationCreate>(emptyNew());

    // edit state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [draft, setDraft] = useState<AffiliationUpdate>({});
    const [saving, setSaving] = useState(false);

    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [form, setForm] = useState<AffiliationCreate>(emptyNew());
    const [savingForm, setSavingForm] = useState(false);

    const [me, setMe] = useState<CurrentUser | null>(null);
    const [meError, setMeError] = useState<string | null>(null);

    const [idCardBackgroundOpen, setIdCardBackgroundOpen] = useState(false);
    const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string | null>(null);

    async function loadBackgroundPreview(affiliationId: number) {
        try {
            const res = await apiFetch(
                `/admin/affiliations/${affiliationId}/id-card-background`,
                { authRequired: true }
            );

            if (res.status === 404) {
                setBackgroundPreviewUrl(null);
                return;
            }

            if (!res.ok) throw new Error();

            const blob = await res.blob();
            setBackgroundPreviewUrl(URL.createObjectURL(blob));
        } catch {
            setBackgroundPreviewUrl(null);
        }
    }

    async function loadMe() {
        setMeError(null);
        try {
            const data = await apiJson("/auth/me", { authRequired: true });
            setMe({
                user_id: data.user_id,
                roles: Array.isArray(data.roles)
                    ? data.roles.map((r: any) =>
                        typeof r === "string" ? r : (r?.role_name ?? "")
                    )
                    : [],
            });
        } catch (e: any) {
            setMe(null);
            setMeError(e?.message || "Failed to load current user");
        }
    }

    function normRoles(list?: string[] | null): string[] {
        return (list || []).map((r) => String(r).trim().toLowerCase());
    }

    const editorRoleNames = useMemo(() => normRoles(me?.roles), [me]);
    const editorIsAdmin = editorRoleNames.includes("admin");
    const editorIsSupervisor = editorRoleNames.includes("supervisor");

    const canCreate = editorIsAdmin;
    const canDelete = editorIsAdmin;
    const canEditAffiliations = editorIsAdmin || editorIsSupervisor;

    const formReadOnly =
        !canEditAffiliations || (!canCreate && selectedId == null);

    const embedOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const formPublicSlug = form.public_slug?.trim() || "";
    const embedUrl = formPublicSlug
        ? `${embedOrigin}/api/embed/affiliations/${formPublicSlug}/directory`
        : "";
    const embedAllUrl = formPublicSlug
        ? `${embedOrigin}/api/embed/affiliations/${formPublicSlug}/directory?all=true`
        : "";
    const iframeCode = embedUrl
        ? `<iframe src="${embedUrl}" width="100%" height="650" style="border:0;"></iframe>`
        : "";
    const iframeAllCode = embedAllUrl
        ? `<iframe src="${embedAllUrl}" width="100%" height="650" style="border:0;"></iframe>`
        : "";

    function toForm(a: Affiliation): AffiliationCreate {
        return {
            name: a.name ?? "",
            callout_line: a.callout_line ?? "",
            contact_name: a.contact_name ?? "",
            phone: a.phone ?? "",
            location: a.location ?? "",
            url: a.url ?? "",
            public_slug: a.public_slug ?? "",
            allow_public_embed: !!a.allow_public_embed,
            embed_title: a.embed_title ?? "",
            sortorder: a.sortorder ?? null,
            is_active: a.is_active !== false,
            id_card_text_theme: a.id_card_text_theme ?? "light",
        };
    }

    function startEdit(a: Affiliation) {
        setSelectedId(a.affiliation_id);
        setForm(toForm(a));
        loadBackgroundPreview(a.affiliation_id);
    }

    function startNew() {
        setSelectedId(null);
        setForm(emptyNew());
        setBackgroundPreviewUrl(null);
    }

    async function load() {
        setLoading(true);
        setErr(null);

        try {
            const data = await apiJson("/admin/affiliations", {
                authRequired: true,
            });

            const list: Affiliation[] = Array.isArray(data) ? data : data?.items ?? [];

            setRows(
                list.map((a) => ({
                    ...a,
                    is_active: a.is_active == null ? true : normalizeBool(a.is_active),
                }))
            );
        } catch (e: any) {
            setErr(e?.message || "Failed to load affiliations");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        loadMe();
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows
            .filter((r) => (showInactive ? true : r.is_active !== false))
            .filter((r) => {
                if (!q) return true;
                const hay = [
                    r.name,
                    r.callout_line,
                    r.contact_name,
                    r.phone,
                    r.location,
                    r.url,
                    r.public_slug,
                    r.embed_title,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                return hay.includes(q);
            })
            .sort((a, b) => {
                const sa = a.sortorder ?? 999999;
                const sb = b.sortorder ?? 999999;
                if (sa !== sb) return sa - sb;
                return a.name.localeCompare(b.name);
            });
    }, [rows, query, showInactive]);

    function cancelEdit() {
        setEditingId(null);
        setDraft({});
    }

    async function save() {
        setErr(null);

        const payload = cleanPayload(form as any);
        if (!payload.name || String(payload.name).trim() === "") {
            setErr("Name is required.");
            return;
        }

        setSavingForm(true);
        try {
            if (selectedId == null) {
                const created = await apiJson("/admin/affiliations", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                const item: Affiliation = created?.affiliation_id ? created : created?.item ?? created;
                setRows((prev) => [item, ...prev]);
                startNew();
            } else {
                const updated = await apiJson(`/admin/affiliations/${selectedId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
                const item: Affiliation = updated?.affiliation_id ? updated : updated?.item ?? updated;

                setRows((prev) =>
                    prev.map((r) =>
                        r.affiliation_id === selectedId ? { ...r, ...item } : r
                    )
                );

                setForm(toForm(item));
            }
        } catch (e: any) {
            setErr(e?.message || "Failed to save affiliation");
        } finally {
            setSavingForm(false);
        }
    }
    async function remove(id: number) {
        setErr(null);
        const a = rows.find((r) => r.affiliation_id === id);
        const label = a?.name ? `“${a.name}”` : `#${id}`;
        if (!window.confirm(`Delete affiliation ${label}? This will NOT delete handlers; their affiliation will become empty.`)) {
            return;
        }
        try {
            await apiJson(`/admin/affiliations/${id}`, { method: "DELETE" });
            setRows((prev) => prev.filter((r) => r.affiliation_id !== id));
            if (editingId === id) cancelEdit();
        } catch (e: any) {
            setErr(e?.message || "Failed to delete affiliation");
        }
    }

    return (
        <PageContainer>
            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-semibold text-slate-100 mb-4">
                        Affiliations
                    </h1>
                    <span className="text-xs text-slate-400">
                        {editorIsAdmin
                            ? "Admin: full access"
                            : editorIsSupervisor
                                ? "Supervisor: scoped edit access"
                                : "Read only"}
                    </span>
                </div>
                {/* Controls */}
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="w-full md:w-1/2">
                        <label className="block text-sm text-slate-200">Search</label>
                        <input
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder-slate-500"
                            placeholder="Name, callout, contact, phone…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                            className="h-4 w-4 accent-sky-500"
                        />
                        Show inactive
                    </label>
                </div>

                {err && (
                    <div className="rounded-xl border border-rose-700 bg-rose-950/40 p-3 text-rose-200">
                        {err}
                    </div>
                )}

                {/* Create */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-100">
                            {selectedId == null ? "Add affiliation" : "Edit affiliation"}
                        </h2>

                        <div className="flex gap-2">
                            {canCreate && selectedId != null && (
                                <button
                                    type="button"
                                    onClick={startNew}
                                    disabled={savingForm}
                                    className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-60"
                                >
                                    New
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={save}
                                disabled={
                                    savingForm ||
                                    !canEditAffiliations ||
                                    (!canCreate && selectedId == null)
                                }
                                className={classNames(
                                    "rounded-lg px-3 py-2 text-sm font-medium",
                                    savingForm || !canEditAffiliations || (!canCreate && selectedId == null)
                                        ? "bg-slate-800 text-slate-300"
                                        : "bg-sky-600 text-white hover:bg-sky-500"
                                )}
                            >
                                {savingForm ? "Saving…" : selectedId == null ? "Create" : "Save"}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <label className="block text-sm text-slate-200">Name *</label>
                            <input
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                disabled={formReadOnly || savingForm}
                            />
                        </div>

                        {editorIsSupervisor && !editorIsAdmin && (
                            <div className="mb-3 rounded-lg border border-yellow-400/40 bg-yellow-500/10 p-3 text-sm text-yellow-100">
                                Supervisors may edit only affiliations they are members of.<br />Creating and deleting is restricted to admins.
                            </div>
                        )}

                        <div>
                            <label className="block text-sm text-slate-200">Sort order</label>
                            <input
                                type="number"
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                                value={form.sortorder}
                                onChange={(e) => setForm((p) => ({ ...p, sortorder: e.target.value }))}
                                disabled={formReadOnly || savingForm}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm text-slate-200">
                                Callout line (shown above matrix when filtered)
                            </label>
                            <input
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                                placeholder="e.g., Contact: Jane Doe • (801) 555-1212 • info@example.org"
                                value={form.callout_line}
                                onChange={(e) => setForm((p) => ({ ...p, callout_line: e.target.value }))}
                                disabled={formReadOnly || savingForm}
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-slate-200">Contact name</label>
                            <input
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                                value={form.contact_name}
                                onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))}
                                disabled={formReadOnly || savingForm}
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-slate-200">Phone</label>
                            <input
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                                value={form.phone}
                                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                                disabled={formReadOnly || savingForm}
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-slate-200">Location</label>
                            <input
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                                value={form.location}
                                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                                disabled={formReadOnly || savingForm}
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-slate-200">URL</label>
                            <input
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"

                                value={form.url}
                                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                                disabled={formReadOnly || savingForm}
                            />
                        </div>

                        <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-slate-100">
                                        Public embed
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        Enables an iframe-safe public directory for this affiliation.
                                    </div>
                                </div>

                                <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                                    <input
                                        type="checkbox"
                                        checked={!!form.allow_public_embed}
                                        onChange={(e) =>
                                            setForm((p) => ({ ...p, allow_public_embed: e.target.checked }))
                                        }
                                        className="h-4 w-4 accent-sky-500"
                                        disabled={formReadOnly || savingForm}
                                    />
                                    Enabled
                                </label>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div>
                                    <label className="block text-sm text-slate-200">Public slug</label>
                                    <input
                                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                                        placeholder="e.g. jhsearchdogs"
                                        value={form.public_slug ?? ""}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                public_slug: cleanSlug(e.target.value),
                                            }))
                                        }
                                        disabled={formReadOnly || savingForm}
                                    />
                                    <div className="mt-1 text-xs text-slate-500">
                                        Lowercase letters, numbers, and hyphens only.
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm text-slate-200">Embed title</label>
                                    <input
                                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                                        placeholder="Optional title shown above the directory"
                                        value={form.embed_title ?? ""}
                                        onChange={(e) =>
                                            setForm((p) => ({ ...p, embed_title: e.target.value }))
                                        }
                                        disabled={formReadOnly || savingForm}
                                    />
                                </div>
                            </div>

                            {formPublicSlug && (
                                <div className="mt-3 space-y-2">
                                    <div>
                                        <div className="mb-1 text-xs font-medium text-slate-300">
                                            Certified teams only
                                        </div>
                                        <input
                                            readOnly
                                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-300"
                                            value={iframeCode}
                                            onFocus={(e) => e.currentTarget.select()}
                                        />
                                    </div>

                                    <div>
                                        <div className="mb-1 text-xs font-medium text-slate-300">
                                            All active teams
                                        </div>
                                        <input
                                            readOnly
                                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-300"
                                            value={iframeAllCode}
                                            onFocus={(e) => e.currentTarget.select()}
                                        />
                                    </div>

                                    <div className="text-xs text-slate-500">
                                        Preview: <a href={embedUrl} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200">{embedUrl}</a>
                                    </div>
                                </div>
                            )}
                            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">

                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-100">
                                            ID Card Background
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            Optional background used when this affiliation is selected for an ID card.
                                        </p>
                                    </div>
                                    {backgroundPreviewUrl ? (
                                        <div
                                            className="mt-3 overflow-hidden rounded-lg border border-slate-700 bg-slate-950"
                                            style={{ width: 220, aspectRatio: 3.375 / 2.125 }}
                                        >
                                            <img
                                                src={backgroundPreviewUrl}
                                                alt="Current ID card background"
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="mt-3 text-xs text-slate-500">
                                            No background uploaded.
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        disabled={selectedId == null}
                                        onClick={() => setIdCardBackgroundOpen(true)}
                                        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-60"
                                    >
                                        Upload / Crop / Remove
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-200">ID card text color</label>
                                    <select
                                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                                        value={form.id_card_text_theme ?? "light"}
                                        onChange={(e) =>
                                            setForm((p) => ({ ...p, id_card_text_theme: e.target.value }))
                                        }
                                        disabled={formReadOnly || savingForm}
                                    >
                                        <option value="light">Light text</option>
                                        <option value="dark">Dark text</option>
                                    </select>
                                </div>
                                {selectedId == null && (
                                    <p className="mt-2 text-xs text-amber-300">
                                        Save the affiliation before uploading a background image.
                                    </p>
                                )}
                            </div>

                        </div>

                        <div className="md:col-span-2">
                            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                                <input
                                    type="checkbox"
                                    checked={form.is_active !== false}
                                    onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                                    className="h-4 w-4 accent-sky-500"
                                    disabled={formReadOnly || savingForm}
                                />
                                Active
                            </label>
                        </div>
                    </div>
                </div>

                {idCardBackgroundOpen && selectedId != null && (
                    <AffiliationIdBackgroundModal
                        affiliationId={selectedId}
                        title="Affiliation ID Card Background"
                        onClose={() => setIdCardBackgroundOpen(false)}
                        onUploaded={() => {
                            setIdCardBackgroundOpen(false);
                            if (selectedId != null) loadBackgroundPreview(selectedId);
                            load();
                        }}
                    />
                )}

                {/* {selectedId != null && (
                    <AffiliationSupervisorsCard affiliationId={selectedId} />
                )} */}

                {/* List */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40">
                    <div className="flex items-center justify-between border-b border-slate-800 p-4">
                        <h2 className="text-lg font-semibold text-slate-100">
                            Existing affiliations
                        </h2>
                        <button
                            onClick={load}
                            disabled={loading}
                            className={classNames(
                                "rounded-lg px-3 py-2 text-sm font-medium",
                                loading
                                    ? "bg-slate-800 text-slate-300"
                                    : "bg-slate-800 text-slate-100 hover:bg-slate-700"
                            )}
                        >
                            {loading ? "Loading…" : "Refresh"}
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="text-slate-300">
                                <tr className="border-b border-slate-800">
                                    <th className="p-3">Name</th>
                                    <th className="p-3">Callout line</th>
                                    <th className="p-3">Contact</th>
                                    <th className="p-3">Phone</th>
                                    <th className="p-3">Active</th>
                                    <th className="p-3">Embed</th>
                                    <th className="p-3">Sort</th>
                                    <th className="p-3 w-[180px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td className="p-4 text-slate-400" colSpan={8}>
                                            No affiliations found.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((a) => {
                                        const isEditing = editingId === a.affiliation_id;
                                        const v = isEditing ? draft : a;

                                        return (
                                            <tr
                                                key={a.affiliation_id}
                                                onClick={() => startEdit(a)}
                                                className="border-b border-slate-900 hover:bg-slate-900/40 cursor-pointer"
                                            >
                                                <td className="p-3 align-top">
                                                    {isEditing ? (
                                                        <input
                                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                                                            value={(v.name as any) ?? ""}
                                                            onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                                                        />
                                                    ) : (
                                                        <div className="font-medium text-slate-100">{a.name}</div>
                                                    )}
                                                </td>

                                                <td className="p-3 align-top">
                                                    {isEditing ? (
                                                        <input
                                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                                                            value={(v.callout_line as any) ?? ""}
                                                            onChange={(e) =>
                                                                setDraft((p) => ({ ...p, callout_line: e.target.value }))
                                                            }
                                                        />
                                                    ) : (
                                                        <div className="text-slate-200">{a.callout_line || "—"}</div>
                                                    )}
                                                </td>

                                                <td className="p-3 align-top">
                                                    {isEditing ? (
                                                        <input
                                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                                                            value={(v.contact_name as any) ?? ""}
                                                            onChange={(e) =>
                                                                setDraft((p) => ({ ...p, contact_name: e.target.value }))
                                                            }
                                                        />
                                                    ) : (
                                                        <div className="text-slate-200">{a.contact_name || "—"}</div>
                                                    )}
                                                </td>

                                                <td className="p-3 align-top">
                                                    {isEditing ? (
                                                        <input
                                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                                                            value={(v.phone as any) ?? ""}
                                                            onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                                                        />
                                                    ) : (
                                                        <div className="text-slate-200">{a.phone || "—"}</div>
                                                    )}
                                                </td>

                                                <td className="p-3 align-top">
                                                    {isEditing ? (
                                                        <label className="inline-flex items-center gap-2 text-slate-200">
                                                            <input
                                                                type="checkbox"
                                                                checked={(v.is_active as any) !== false}
                                                                onChange={(e) =>
                                                                    setDraft((p) => ({ ...p, is_active: e.target.checked }))
                                                                }
                                                                className="h-4 w-4 accent-sky-500"
                                                            />
                                                            {(v.is_active as any) !== false ? "Yes" : "No"}
                                                        </label>
                                                    ) : (
                                                        <span
                                                            className={classNames(
                                                                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                                                                a.is_active !== false
                                                                    ? "border-emerald-700 bg-emerald-950/40 text-emerald-200"
                                                                    : "border-slate-700 bg-slate-900 text-slate-300"
                                                            )}
                                                        >
                                                            {a.is_active !== false ? "Active" : "Inactive"}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="p-3 align-top">
                                                    {a.allow_public_embed && a.public_slug ? (
                                                        <div className="space-y-1">
                                                            <span className="inline-flex items-center rounded-full border border-sky-700 bg-sky-950/40 px-2 py-0.5 text-xs text-sky-200">
                                                                Enabled
                                                            </span>
                                                            <div className="font-mono text-xs text-slate-400">
                                                                {a.public_slug}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-500">—</span>
                                                    )}
                                                </td>

                                                <td className="p-3 align-top">
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                                                            value={(v.sortorder as any) ?? ""}
                                                            onChange={(e) =>
                                                                setDraft((p) => ({
                                                                    ...p,
                                                                    sortorder: e.target.value === "" ? null : Number(e.target.value),
                                                                }))
                                                            }
                                                        />
                                                    ) : (
                                                        <div className="text-slate-200">{a.sortorder ?? "—"}</div>
                                                    )}
                                                </td>

                                                <td className="p-3 align-top">
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => startEdit(a)}
                                                            disabled={!canEditAffiliations}
                                                            className={classNames(
                                                                "rounded-lg px-3 py-1.5 text-sm font-medium",
                                                                canEditAffiliations
                                                                    ? "bg-slate-800 text-slate-100 hover:bg-slate-700"
                                                                    : "bg-slate-900 text-slate-500 cursor-not-allowed"
                                                            )}
                                                        >
                                                            Edit
                                                        </button>

                                                        {canDelete && (
                                                            <button
                                                                type="button"
                                                                onClick={() => remove(a.affiliation_id)}
                                                                className="rounded-lg bg-rose-700/80 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
                                                            >
                                                                Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>

                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="text-xs text-slate-400">
                    Tip: “Inactive” items won’t appear in the public dropdown if your public endpoint filters on <code>is_active</code>.
                </div>
            </div>
        </PageContainer>
    );
}