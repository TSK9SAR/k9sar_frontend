import { useEffect, useMemo, useState } from "react";
import ForumComposer from "../../components/forums/ForumComposer";
import { apiJson } from "../../lib/api";
import PageContainer from "../../components/PageContainer";

const EMPTY_FILTERS = {
    q: "",
    user_ids: "",
    special_rule: "",
    discipline_group_id: "",
    discipline_id: "",
    certification_status: "",
    affiliation_id: "",
    expiring_within_days: "",
    user_type: "",
    active_handlers_only: true,
};

const DEFAULT_BODY = `Hi {first_name},

This is a message from TSK9SAR.

Please update this message before sending.

Thank you,
TSK9SAR Administration
`;

const DEFAULT_SUBJECT = "TSK9SAR Member Update";

function parseUserIds(value) {
    return String(value || "")
        .split(/[\s,;]+/)
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0);
}

function cleanFilters(filters) {
    return {
        q: filters.q?.trim() || null,

        user_ids: parseUserIds(filters.user_ids),

        special_rule: filters.special_rule || null,

        discipline_group_id: filters.discipline_group_id
            ? Number(filters.discipline_group_id)
            : null,

        discipline_id: filters.discipline_id
            ? Number(filters.discipline_id)
            : null,

        certification_status: filters.certification_status || null,

        affiliation_id: filters.affiliation_id
            ? Number(filters.affiliation_id)
            : null,

        expiring_within_days:
            filters.expiring_within_days !== ""
                ? Number(filters.expiring_within_days)
                : null,

        user_type: filters.user_type || null,

        active_handlers_only: !!filters.active_handlers_only,
    };
}

export default function EmailAudiencePage() {
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [recipients, setRecipients] = useState([]);
    const [excludedUserIds, setExcludedUserIds] = useState([]);
    const [subject, setSubject] = useState(DEFAULT_SUBJECT);
    const [bodyText, setBodyText] = useState(DEFAULT_BODY);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState("");
    const [groups, setGroups] = useState([]);
    const [affiliations, setAffiliations] = useState([]);
    const [disciplines, setDisciplines] = useState([]);
    const [enableReply, setEnableReply] = useState(false);
    const [me, setMe] = useState(null);
    const [audienceQuery, setAudienceQuery] = useState("");
    const [interpreting, setInterpreting] = useState(false);

    const activeRecipients = useMemo(
        () => recipients.filter((r) => !excludedUserIds.includes(r.user_id)),
        [recipients, excludedUserIds]
    );

    function updateFilter(name, value) {
        setFilters((prev) => ({ ...prev, [name]: value }));
    }

    async function interpretAudienceQuery(queryOverride = null) {
        const queryText = queryOverride || audienceQuery;

        setMessage("");

        if (!queryText.trim()) {
            setMessage("Enter an audience description first.");
            return;
        }

        setInterpreting(true);

        try {
            const data = await apiJson("/admin/email-audience/interpret", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: queryText }),
            });

            if (data.filters) {
                const nextFilters = {
                    ...filters,
                    ...data.filters,
                    special_rule: data.filters.special_rule || "",
                    discipline_group_id: data.filters.discipline_group_id
                        ? String(data.filters.discipline_group_id)
                        : "",
                    discipline_id: data.filters.discipline_id
                        ? String(data.filters.discipline_id)
                        : "",
                    affiliation_id: data.filters.affiliation_id
                        ? String(data.filters.affiliation_id)
                        : "",
                    expiring_within_days:
                        data.filters.expiring_within_days != null
                            ? String(data.filters.expiring_within_days)
                            : "",
                    certification_status: data.filters.certification_status || "",
                    q: data.filters.q || "",
                    user_ids: Array.isArray(data.filters.user_ids)
                        ? data.filters.user_ids.join(", ")
                        : "",
                    active_handlers_only: data.filters.active_handlers_only !== false,
                };

                setFilters(nextFilters);
                setMessage(data.explanation || "Audience query interpreted.");

                await previewRecipients(nextFilters);
                return;
            }

            setMessage(data.explanation || "Audience query interpreted.");
        } catch (err) {
            console.error("Audience interpretation failed:", err);
            setMessage(err?.message || "Could not interpret audience query.");
        } finally {
            setInterpreting(false);
        }
    }
    async function previewRecipients(filtersOverride = null) {
        console.log("Preview button clicked");

        const payload = {
            filters: cleanFilters(filtersOverride || filters),
            excluded_user_ids: excludedUserIds,
        };

        setMessage("");
        setLoadingPreview(true);

        try {
            const data = await apiJson("/admin/email-audience/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            setRecipients(data.recipients || []);
            setMessage(`Preview found ${data.total || 0} recipient(s).`);
        } catch (err) {
            console.error("Preview failed:", err);
            setMessage(err?.message || "Preview failed.");
        } finally {
            setLoadingPreview(false);
        }
    }

    function excludeUser(userId) {
        setExcludedUserIds((prev) =>
            prev.includes(userId) ? prev : [...prev, userId]
        );
    }

    function restoreUser(userId) {
        setExcludedUserIds((prev) => prev.filter((id) => id !== userId));
    }

    function clearAll() {
        setFilters(EMPTY_FILTERS);
        setRecipients([]);
        setExcludedUserIds([]);
        setSubject(DEFAULT_SUBJECT);
        setBodyText(DEFAULT_BODY);
        setMessage("");
    }

    async function sendEmail() {
        setMessage("");

        if (!subject.trim()) {
            setMessage("Subject is required.");
            return;
        }

        if (!bodyText.trim()) {
            setMessage("Message body is required.");
            return;
        }

        if (activeRecipients.length === 0) {
            setMessage("No active recipients selected.");
            return;
        }

        const ok = window.confirm(
            `Send this email individually to ${activeRecipients.length} recipient(s)?`
        );

        if (!ok) return;

        setSending(true);

        try {
            const data = await apiJson("/admin/email-audience/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filters: cleanFilters(filters),
                    excluded_user_ids: excludedUserIds,
                    subject,
                    body_text: bodyText,
                    enable_reply: enableReply,
                }),
            });

            setMessage(
                `Campaign ${data.campaign_id} complete. Sent: ${data.sent_count}. Failed: ${data.failed_count}. Status: ${data.status}.`
            );
        } catch (err) {
            console.error(err);
            setMessage(err?.message || "Send failed.");
        } finally {
            setSending(false);
        }
    }

    useEffect(() => {
        async function loadLookups() {
            try {
                const meData = await apiJson("/auth/me", { authRequired: true });
                setMe(meData);

                const isAdmin =
                    meData?.is_admin ||
                    (Array.isArray(meData?.roles) &&
                        meData.roles.some((r) =>
                            String(r?.role_name || r?.name || r).toLowerCase() === "admin"
                        ));

                const [groupData, disciplineData, affiliationData] = await Promise.all([
                    apiJson("/discipline-groups/"),
                    apiJson("/disciplines/"),
                    apiJson(isAdmin ? "/public/affiliations" : "/handlers/me/affiliations"),
                ]);

                setGroups(Array.isArray(groupData) ? groupData : []);
                setDisciplines(Array.isArray(disciplineData) ? disciplineData : []);

                if (isAdmin) {
                    setAffiliations(Array.isArray(affiliationData) ? affiliationData : []);
                } else {
                    setAffiliations(
                        Array.isArray(affiliationData?.current)
                            ? affiliationData.current
                                .map((row) => row.affiliation)
                                .filter(Boolean)
                            : []
                    );
                }
            } catch (err) {
                console.error("Failed loading email audience lookups:", err);
                setMessage(err?.message || "Failed loading filter options.");
            }
        }

        loadLookups();
    }, []);

    const filteredDisciplines = useMemo(() => {
        if (!filters.discipline_group_id) return disciplines;

        return disciplines.filter(
            (d) => String(d.group_id) === String(filters.discipline_group_id)
        );
    }, [disciplines, filters.discipline_group_id]);

    return (
        <PageContainer maxWidth="full" className="space-y-6 py-6">
            <div className=" mx-auto p-6 text-slate-100">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold">Email Selected Members</h1>
                    <p className="text-sm text-slate-300 mt-1">
                        Preview members from directory-style filters, exclude individuals, then send individual emails.
                    </p>
                </div>

                {message && (
                    <div className="mb-4 rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-sm">
                        {message}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <section className="rounded-xl border border-slate-700 bg-slate-800 p-5">
                        <h2 className="text-lg font-semibold mb-4">Audience Filters</h2>

                        <Field label="Search Name / Dog Name">
                            <input
                                value={filters.q}
                                onChange={(e) => updateFilter("q", e.target.value)}
                                className="input"
                                placeholder="Handler name, email, or dog name"
                            />
                        </Field>

                        {/* <Field label="Audience Assistant">
                        <textarea
                            value={audienceQuery}
                            onChange={(e) => setAudienceQuery(e.target.value)}
                            className="input min-h-[80px]"
                            placeholder="Example: active handlers with expired trailing certifications"
                        />

                        <div className="mt-2 flex gap-2">
                            <button
                                type="button"
                                onClick={interpretAudienceQuery}
                                disabled={interpreting}
                                className="btn-primary"
                            >
                                {interpreting ? "Interpreting…" : "Generate Filters"}
                            </button>
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                            This fills the filters below. Preview before sending.
                        </div>
                    </Field> */}
                        {/* <Field label="Special Filter">
                        <select
                            value={filters.special_rule}
                            onChange={(e) => updateFilter("special_rule", e.target.value)}
                            className="input"
                        >
                            <option value="">None</option>
                            <option value="evaluators_missing_signature">Evaluators missing signatures</option>
                            <option value="handlers_no_active_certifications">
                                Handlers with no active certifications
                            </option>
                        </select>
                    </Field> */}
                        <Field label="Special Audience">
                            <select
                                value=""
                                onChange={async (e) => {
                                    const query = e.target.value;
                                    if (!query) return;

                                    setAudienceQuery(query);
                                    await interpretAudienceQuery(query);
                                }}
                                className="input"
                            >
                                <option value="">Choose a special audience…</option>
                                <option value="evaluators missing signatures">
                                    Evaluators missing signatures
                                </option>
                                <option value="handlers with no active certifications">
                                    Handlers with no active certifications
                                </option>
                            </select>
                        </Field>

                        <Field label="Explicit User IDs">
                            <textarea
                                value={filters.user_ids}
                                onChange={(e) => updateFilter("user_ids", e.target.value)}
                                className="input min-h-[90px]"
                                placeholder={"Example:\n12, 18, 41\n55\n103"}
                            />
                            <div className="mt-1 text-xs text-slate-400">
                                Optional. Paste user IDs separated by commas, spaces, semicolons, or new lines.
                            </div>
                        </Field>

                        <Field label="User Type">
                            <select
                                value={filters.user_type}
                                onChange={(e) => updateFilter("user_type", e.target.value)}
                                className="input"
                            >
                                <option value="">Any user</option>
                                <option value="users">Users</option>
                                <option value="handlers">Handlers</option>
                                <option value="evaluators">Evaluators</option>
                                <option value="supervisors">Supervisors</option>
                                <option value="administrators">Administrators</option>
                            </select>
                        </Field>

                        <Field label="Discipline Group">
                            <select
                                value={filters.discipline_group_id}
                                onChange={(e) => {
                                    updateFilter("discipline_group_id", e.target.value);
                                    updateFilter("discipline_id", "");
                                }}
                                className="input"
                            >
                                <option value="">Any group</option>
                                {groups.map((g) => (
                                    <option key={g.group_id} value={g.group_id}>
                                        {g.name}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Discipline">
                            <select
                                value={filters.discipline_id}
                                onChange={(e) => updateFilter("discipline_id", e.target.value)}
                                className="input"
                            >
                                <option value="">Any discipline</option>
                                {filteredDisciplines.map((d) => (
                                    <option key={d.discipline_id} value={d.discipline_id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Certification Status">
                            <select
                                value={filters.certification_status}
                                onChange={(e) => updateFilter("certification_status", e.target.value)}
                                className="input"
                            >
                                <option value="">Any status</option>
                                <option value="active">Active</option>
                                <option value="pending">Pending</option>
                                <option value="expired">Expired</option>
                                <option value="revoked">Revoked</option>
                                <option value="rejected">Rejected</option>
                                <option value="suspended">Suspended</option>
                            </select>
                        </Field>

                        <Field label="Affiliation">
                            <select
                                value={filters.affiliation_id}
                                onChange={(e) => updateFilter("affiliation_id", e.target.value)}
                                className="input"
                            >
                                <option value="">Any affiliation</option>
                                {affiliations.map((a) => (
                                    <option key={a.affiliation_id} value={a.affiliation_id}>
                                        {a.name}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Expiring Within Days">
                            <input
                                type="number"
                                min="0"
                                value={filters.expiring_within_days}
                                onChange={(e) => updateFilter("expiring_within_days", e.target.value)}
                                className="input"
                                placeholder="Example: 90"
                            />
                        </Field>
                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => previewRecipients()}
                                disabled={loadingPreview}
                                className="btn-primary"
                            >
                                {loadingPreview ? "Previewing…" : "Preview Recipients"}
                            </button>

                            <button onClick={clearAll} className="btn-secondary">
                                Clear
                            </button>
                        </div>
                    </section>

                    <section className="rounded-xl border border-slate-700 bg-slate-800 p-5">
                        <div className="flex items-baseline justify-between mb-4">
                            <h2 className="text-lg font-semibold">Recipient Preview </h2>
                            <span className="text-sm text-slate-300">
                                {activeRecipients.length} active / {recipients.length} matched
                            </span>
                        </div>

                        <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                            {recipients.length === 0 ? (
                                <div className="text-sm text-slate-400">
                                    No preview loaded yet.
                                </div>
                            ) : (
                                recipients.map((r) => {
                                    const excluded = excludedUserIds.includes(r.user_id);

                                    return (
                                        <div
                                            key={r.user_id}
                                            className={`rounded-lg border p-3 ${excluded
                                                ? "border-slate-700 bg-slate-900 opacity-60"
                                                : "border-slate-600 bg-slate-700"
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="font-semibold">{r.name}</div>
                                                    <div className="text-sm text-slate-300">{r.email}</div>
                                                    <div className="text-xs text-slate-400 mt-1">
                                                        {r.is_evaluator ? "Evaluator" : "Member"}
                                                        {r.affiliation ? ` • Affiliation ${r.affiliation}` : ""}
                                                    </div>
                                                </div>

                                                {excluded ? (
                                                    <button
                                                        onClick={() => restoreUser(r.user_id)}
                                                        className="text-xs rounded-md border border-slate-500 px-2 py-1 hover:bg-slate-700"
                                                    >
                                                        Restore
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => excludeUser(r.user_id)}
                                                        className="text-xs rounded-md border border-red-400 text-red-200 px-2 py-1 hover:bg-red-900/30"
                                                    >
                                                        Exclude
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </section>
                </div>

                <section className="mt-6 rounded-xl border border-slate-700 bg-slate-800 p-5">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold">Compose Email</h2>
                            <div className="mt-1 text-sm text-slate-400">
                                Write once and send individually to the selected members.
                            </div>
                        </div>

                        <div className="text-sm text-slate-300">
                            <span className="font-semibold">{activeRecipients.length}</span> recipient(s) ready
                        </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-100">
                        <input
                            type="checkbox"
                            checked={enableReply}
                            onChange={(e) => setEnableReply(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-500 bg-slate-700"
                        />
                        Allow recipients to reply directly to me
                    </label>
                    <div className="mt-3 rounded-lg border border-slate-600 bg-slate-800 p-3 text-xs text-slate-200 whitespace-pre-wrap">
                        <div className="mb-1 font-semibold text-slate-100">Automatic footer preview</div>
                        {`—
Sent by ${me?.first_name || ""} ${me?.last_name || ""} via TSK9SAR Member Communication
${enableReply
                                ? `Reply directly to this email to respond to ${me?.first_name || ""} ${me?.last_name || ""} (${me?.email || ""}).`
                                : "This mailbox is not monitored for replies."
                            }`}
                    </div>

                    <Field label="Subject">
                        <input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="input"
                            placeholder="Email subject"
                        />
                    </Field>

                    <div className="mt-4">
                        <ForumComposer
                            footerNote="Supported placeholders: {first_name}, {last_name}, {name}"
                            minRows={10}
                            onChange={setBodyText}
                            onSubmit={sendEmail}
                            placeholder={"Hello {first_name},\n\nYour message here...\n\nThank you."}
                            submitClassName="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                            submitDisabled={!subject.trim() || activeRecipients.length === 0}
                            submitLabel={`Send To ${activeRecipients.length} Members`}
                            submittingLabel="Sending..."
                            submitting={sending}
                            title="Message"
                            value={bodyText}
                        />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4">
                        <div className="text-sm text-slate-300">
                            Ready to send to <span className="font-semibold">{activeRecipients.length}</span> recipient(s).
                        </div>

                        {/* Send action is handled by ForumComposer.
                    <button
                        onClick={sendEmail}
                        disabled={sending || activeRecipients.length === 0}
                        className="btn-danger"
                    >
                        {sending ? "Sending…" : `Send To ${activeRecipients.length} Members`}
                    </button>
                    */}
                    </div>
                </section>

                <style>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(71 85 105);
          background: rgb(15 23 42);
          color: rgb(241 245 249);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }

        .input:focus {
          border-color: rgb(59 130 246);
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35);
        }

        .btn-primary {
          border-radius: 0.5rem;
          background: rgb(37 99 235);
          border: 1px solid rgb(100 116 139);
          color: white;
          padding: 0.5rem 0.9rem;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          border-radius: 0.5rem;
          background: rgb(2, 20, 59);
          border: 1px solid rgb(100 116 139);
          color: rgb(226 232 240);
          padding: 0.5rem 0.9rem;
          font-size: 0.875rem;
        }

        .btn-danger {
          border-radius: 0.5rem;
          background: rgb(185 28 28);
          color: white;
          padding: 0.6rem 1rem;
          font-size: 0.875rem;
          font-weight: 700;
        }

        .btn-danger:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
            </div>
        </PageContainer>
    );
}

function Field({ label, children }) {
    return (
        <label className="block">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                {label}
            </div>
            {children}
        </label>
    );
}
