import React, { useEffect, useState } from "react";
import PageContainer from "../../components/PageContainer";
import { apiJson } from "../../lib/api";

type CleanupEntity =
    | "team"
    | "dog"
    | "orphan_dogs"
    | "handler_keep_user"
    | "user_tree"
    | "topic_survey_tree"
    | "certificate";

type CleanupMode = CleanupEntity;

type Preview = {
    entity: CleanupEntity;
    mode?: string;

    team_id?: number;
    dog_id?: number;
    handler_id?: number;
    user_id?: number;
    topic_id?: number;
    certificate_id?: number;

    label: string;
    will_delete: Record<string, number>;
    will_preserve?: Record<string, number>;
    sample_ids?: Record<string, number[]>;

    sample_rows?: {
        dogs?: {
            dog_id: number;
            name: string;
        }[];
    };

    warnings?: string[];
    expires_at: number;
    confirm_hash: string;
    confirm_text_required: string;
    blocked?: boolean;
};

function errorMessage(e: any, fallback: string) {
    return e?.data?.detail || e?.detail || e?.message || fallback;
}

function deleteUrl(preview: Preview) {
    switch (preview.entity) {
        case "team":
            return `/admin/teams/${preview.team_id}/hard-delete`;

        case "dog":
            return `/admin/dogs/${preview.dog_id}/hard-delete`;

        case "orphan_dogs":
            return `/admin/dogs/orphans/hard-delete`;

        case "handler_keep_user":
            return `/admin/handlers/${preview.handler_id}/hard-delete-keep-user`;

        case "user_tree":
            return `/admin/users/${preview.user_id}/hard-delete-tree`;

        case "topic_survey_tree":
            return `/admin/cleanup/topic-tree/${preview.topic_id}/hard-delete-tree`;

        case "certificate":
            return `/admin/certificates/${preview.certificate_id}/hard-delete`;

        default:
            throw new Error("Unsupported cleanup entity.");
    }
}

function labelizeKey(key: string) {
    return key.split("_").join(" ");
}

export default function AdminCleanupPage() {
    const [mode, setMode] = useState<CleanupMode>("certificate");
    const [targetId, setTargetId] = useState("");

    const [preview, setPreview] = useState<Preview | null>(null);
    const [loading, setLoading] = useState(false);
    const [running, setRunning] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);
    const [confirmText, setConfirmText] = useState("");


    async function checkAccess() {
        await apiJson("/admin/canary", {
            authRequired: true,
            mfaRequired: true,
        });
    }


    async function loadPreview() {
        setLoading(true);
        setErr(null);
        setMsg(null);
        setPreview(null);
        setConfirmText("");

        try {
            await checkAccess();

            let url = "";

            if (mode === "orphan_dogs") {
                url = "/admin/dogs/orphans/delete-preview";
            } else {
                const id = Number(targetId);

                if (!Number.isInteger(id) || id <= 0) {
                    const idLabel =
                        mode === "team"
                            ? "team_id"
                            : mode === "dog"
                                ? "dog_id"
                                : mode === "handler_keep_user"
                                    ? "handler_id"
                                    : mode === "topic_survey_tree"
                                        ? "topic_id"
                                        : mode === "certificate"
                                            ? "certification_id"
                                            : "user_id";

                    setErr(`Enter a valid ${idLabel}.`);
                    setLoading(false);
                    return;
                }

                url =
                    mode === "team"
                        ? `/admin/teams/${id}/delete-preview`
                        : mode === "dog"
                            ? `/admin/dogs/${id}/delete-preview`
                            : mode === "handler_keep_user"
                                ? `/admin/handlers/${id}/delete-preview`
                                : mode === "topic_survey_tree"
                                    ? `/admin/topic-tree/${id}/preview`
                                    : mode === "certificate"
                                        ? `/admin/certificates/${id}/preview`
                                        : `/admin/users/${id}/delete-preview`;
            }

            const p = await apiJson<Preview>(url, {
                authRequired: true,
                mfaRequired: true,
            });

            setPreview(p);
        } catch (e: any) {
            setPreview(null);
            setErr(errorMessage(e, "Failed to load cleanup preview."));
        } finally {
            setLoading(false);
        }
    }

    async function runDelete() {
        if (!preview) return;

        setRunning(true);
        setErr(null);
        setMsg(null);

        try {
            const res = await apiJson(deleteUrl(preview), {
                method: "POST",
                authRequired: true,
                mfaRequired: true,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    confirm_text: confirmText,
                    expires_at: preview.expires_at,
                    confirm_hash: preview.confirm_hash,
                }),
            });

            setMsg(
                `Deleted ${preview.entity}: ` +
                Object.entries(res || {})
                    .filter(([key]) => key !== "status")
                    .map(([key, value]) => `${key}=${value}`)
                    .join(", ")
            );

            setPreview(null);
            setConfirmText("");
        } catch (e: any) {
            setErr(errorMessage(e, "Cleanup delete failed."));
        } finally {
            setRunning(false);
        }
    }

    useEffect(() => {
        checkAccess().catch((e: any) => {
            setErr(errorMessage(e, "Administrator MFA access is required."));
        });
    }, []);

    const canRun =
        !!preview &&
        !preview.blocked &&
        confirmText === preview.confirm_text_required &&
        !running;

    return (
        <PageContainer maxWidth="full" className="space-y-6 py-6">
            <div className="mx-auto w-full max-w-4xl text-left space-y-6">
                <div>
                    <h1 className="text-lg font-semibold text-slate-100">
                        Admin · Cleanup
                    </h1>
                    <p className="text-xs text-slate-300">
                        Destructive maintenance tasks. Admin MFA required.
                    </p>
                </div>

                <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end">
                        <div>
                            <label className="block text-xs font-medium text-slate-300">
                                Cleanup type
                            </label>
                            <select
                                value={mode}
                                onChange={(e) => {
                                    setMode(e.target.value as CleanupMode);
                                    setPreview(null);
                                    setConfirmText("");
                                    setMsg(null);
                                    setErr(null);
                                }}
                                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                            >
                                <option value="certificate">Delete certificate</option>
                                <option value="team">Delete team</option>
                                <option value="dog">Delete dog</option>
                                <option value="orphan_dogs">Delete orphan dogs</option>
                                <option value="handler_keep_user">Delete handler, keep user</option>
                                <option value="user_tree">Delete user and all related data</option>
                                <option value="topic_survey_tree">Delete topic and all survey data</option>
                            </select>
                        </div>

                        {mode !== "orphan_dogs" && (
                            <div>
                                <label className="block text-xs font-medium text-slate-300">
                                    {mode === "team"
                                        ? "Team ID"
                                        : mode === "dog"
                                            ? "Dog ID"
                                            : mode === "handler_keep_user"
                                                ? "Handler ID"
                                                : mode === "topic_survey_tree"
                                                    ? "Topic ID"
                                                    : mode === "certificate"
                                                        ? "Certification ID"
                                                        : "User ID"}
                                </label>
                                <input
                                    value={targetId}
                                    onChange={(e) => {
                                        setTargetId(e.target.value);
                                        setPreview(null);
                                        setConfirmText("");
                                        setMsg(null);
                                    }}
                                    placeholder={
                                        mode === "team"
                                            ? "Example: 2"
                                            : mode === "dog"
                                                ? "Example: 3"
                                                : mode === "topic_survey_tree"
                                                    ? "Example: 12"
                                                    : "Example: 4"
                                    }
                                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                                />
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={loadPreview}
                            disabled={loading || running}
                            className="rounded-lg border border-slate-500 bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600 disabled:opacity-60"
                        >
                            {loading ? "Loading…" : "Preview"}
                        </button>
                    </div>

                    {mode === "dog" && (
                        <div className="rounded-lg border border-amber-700 bg-amber-950/30 p-3 text-xs text-amber-100">
                            Deleting a dog also deletes every team using that dog, plus
                            certifications and certification events attached to those teams.
                        </div>
                    )}
                </section>

                {err && (
                    <div className="rounded-lg border border-red-700 bg-red-900/30 p-3 text-sm text-red-200">
                        {err}
                    </div>
                )}

                {msg && (
                    <div className="rounded-lg border border-emerald-700 bg-emerald-900/30 p-3 text-sm text-emerald-100">
                        {msg}
                    </div>
                )}

                {preview && (
                    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-4">
                        <div>
                            <div className="text-sm font-semibold text-slate-100">
                                {preview.label}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                                Entity: {preview.entity}
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Will delete
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                                {Object.entries(preview.will_delete || {}).map(
                                    ([key, value]) => (
                                        <div
                                            key={key}
                                            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                                        >
                                            <div className="text-[11px] text-slate-400">
                                                {labelizeKey(key)}
                                            </div>
                                            <div className="text-lg font-semibold text-slate-100">
                                                {value}
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        {!!preview.will_preserve &&
                            Object.keys(preview.will_preserve).length > 0 && (
                                <div className="rounded-xl border border-emerald-700 bg-emerald-950/20 p-3">
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                                        Will preserve
                                    </div>

                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {Object.entries(preview.will_preserve).map(([key, value]) => (
                                            <div
                                                key={key}
                                                className="rounded-lg border border-emerald-800 bg-slate-900 px-3 py-2"
                                            >
                                                <div className="text-[11px] text-emerald-300">
                                                    {labelizeKey(key)}
                                                </div>
                                                <div className="text-lg font-semibold text-slate-100">
                                                    {value}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        {!!preview.sample_ids &&
                            Object.keys(preview.sample_ids).length > 0 && (
                                <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300 space-y-1">
                                    {Object.entries(preview.sample_ids).map(
                                        ([key, ids]) =>
                                            ids?.length ? (
                                                <div className="text-[11px] text-slate-400">
                                                    {labelizeKey(key)}: {ids.join(", ")}
                                                </div>
                                            ) : null
                                    )}
                                </div>
                            )}

                        {!!preview.sample_rows?.dogs?.length && (
                            <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Dogs found
                                </div>

                                <div className="max-h-80 overflow-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-xs text-slate-400">
                                            <tr>
                                                <th className="py-1 pr-3 text-left">Dog ID</th>
                                                <th className="py-1 text-left">Name</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.sample_rows.dogs.map((dog: any) => (
                                                <tr key={dog.dog_id} className="border-t border-slate-800">
                                                    <td className="py-1 pr-3 text-slate-300">{dog.dog_id}</td>
                                                    <td className="py-1 text-slate-100">{dog.name}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {!!preview.warnings?.length && (
                            <div className="rounded-xl border border-amber-700 bg-amber-950/30 p-3 text-xs text-amber-100">
                                <ul className="list-disc space-y-1 pl-5">
                                    {preview.warnings.map((w, i) => (
                                        <li key={i}>{w}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="border-t border-slate-700 pt-4 space-y-3">
                            <div className="text-xs text-slate-300">
                                Type{" "}
                                <span className="font-mono text-slate-100">
                                    {preview.confirm_text_required}
                                </span>{" "}
                                to enable delete.
                            </div>

                            <input
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder={preview.confirm_text_required}
                                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                            />

                            <button
                                type="button"
                                onClick={runDelete}
                                disabled={!canRun}
                                className="rounded-lg border border-red-600 bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                            >
                                {running ? "Deleting…" : "Hard delete"}
                            </button>

                            <div className="text-[11px] text-slate-400">
                                Preview expires automatically. Refresh preview if the
                                delete confirmation expires.
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </PageContainer>
    );
}