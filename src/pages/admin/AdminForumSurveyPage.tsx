import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../lib/api";
import PageContainer from "../../components/PageContainer";

type TopicSurveyReport = {
    topic_id: number;
    topic_title: string;
    total_ballots: number;
    required_ballots: number;
    participants: number;
    fully_completed: number;
    partial: number;
    survey_status: "open" | "closed";
    open_ballots: number | null;
    closed_ballots: number | null;
    ballots: BallotSummary[];
    participants_detail: ParticipantDetail[];
};

type BallotSummary = {
    ballot_id: number;
    title: string;
    is_required: boolean;
    is_test: boolean;
    status: string;
    display_order: number;
    responses: number;
};

type ParticipantDetail = {
    user_id: number;
    name: string;
    answered_ballots: number;
    required_answered: number;
    required_total: number;
    complete: boolean;
};

type BallotReport = {
    ballot_id: number;
    topic_id: number;
    title: string;
    description_md?: string | null;
    is_required: boolean;
    is_test: boolean;
    status: string;
    total_voters: number;
    choices: {
        choice_id: number;
        label: string;
        sort_order: number;
        vote_count: number;
        percent: number;
    }[];
    freeform: {
        total_responses: number;
        blank_responses: number;
        responses: {
            vote_id: number;
            user_id: number;
            name: string;
            text: string;
        }[];
    };
};

type SurveyTopicSearchResult = {
    topic_id: number;
    title: string;
};

export default function AdminForumSurveyPage() {
    const [topicId, setTopicId] = useState("");
    const [report, setReport] = useState<TopicSurveyReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [openBallotId, setOpenBallotId] = useState<number | null>(null);
    const [ballotReports, setBallotReports] = useState<Record<number, BallotReport>>({});
    const [ballotLoading, setBallotLoading] = useState<Record<number, boolean>>({});

    const [topicSearch, setTopicSearch] = useState("");
    const [topicResults, setTopicResults] = useState<SurveyTopicSearchResult[]>([]);
    const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

    async function searchTopics() {
        try {
            setLoading(true);
            setError("");
            setTopicResults([]);

            const data = await apiJson<SurveyTopicSearchResult[]>(
                `/admin/forum/survey-topics?q=${encodeURIComponent(topicSearch)}`
            );

            setTopicResults(data);
        } catch (err: any) {
            console.error("survey topic search failed", err);

            const detail =
                err?.data?.detail ||
                err?.message ||
                "Unable to search forum topics.";

            setError(detail);
            setTopicResults([]);
        } finally {
            setLoading(false);
        }
    }

    async function closeSurvey() {
        if (!report?.topic_id) return;

        if (!window.confirm("Close this survey? Members will no longer be able to vote.")) {
            return;
        }

        await apiJson(`/admin/forum/topics/${report.topic_id}/close-survey`, {
            method: "POST",
        });

        await loadTopicReport(report.topic_id);
    }

    async function reopenSurvey() {
        if (!report?.topic_id) return;

        await apiJson(`/admin/forum/topics/${report.topic_id}/reopen-survey`, {
            method: "POST",
        });

        await loadTopicReport(report.topic_id);
    }

    async function loadTopicReport(topicId: number) {
        try {
            setLoading(true);
            setError("");

            const data = await apiJson<TopicSurveyReport>(
                `/admin/forum/topics/${topicId}/survey-report`
            );

            setSelectedTopicId(topicId);
            setReport(data);
        } catch (err: any) {
            setError(err?.message || "Unable to load survey report.");
            setReport(null);
        } finally {
            setLoading(false);
        }
    }

    async function toggleBallot(ballotId: number) {
        if (openBallotId === ballotId) {
            setOpenBallotId(null);
            return;
        }

        setOpenBallotId(ballotId);
        setError("");

        if (ballotReports[ballotId]) return;

        try {
            setBallotLoading((prev) => ({ ...prev, [ballotId]: true }));

            const data = await apiJson<BallotReport>(
                `/admin/forum/ballots/${ballotId}/report`
            );

            setBallotReports((prev) => ({ ...prev, [ballotId]: data }));
        } catch (err: any) {
            setError(err?.message || "Unable to load ballot report.");
        } finally {
            setBallotLoading((prev) => ({ ...prev, [ballotId]: false }));
        }
    }

    const completionPercent = useMemo(() => {
        if (!report || !report.participants) return 0;
        return Math.round((report.fully_completed / report.participants) * 100);
    }, [report]);

    const [allowed, setAllowed] = useState<boolean | null>(null);

    useEffect(() => {
        let alive = true;

        (async () => {
            try {
                setError("");

                // admin+mfa gate
                await apiJson("/admin/canary_no_mfa", {
                    authRequired: true,
                    mfaRequired: false,
                });

                if (alive) setAllowed(true);
            } catch (err: any) {
                if (!alive) return;

                setAllowed(false);

                setError(
                    err?.data?.detail ||
                    err?.message ||
                    "You do not have permission to access this page."
                );
            }
        })();

        return () => {
            alive = false;
        };
    }, []);

    return (
        <PageContainer maxWidth="full" className="space-y-6 py-6">
            <div className="mx-auto p-4 sm:p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold text-slate-100">
                        Forum Survey Reports
                    </h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Review topic-level poll collections, completion status, choice totals,
                        and free-form responses.
                    </p>
                </div>

                <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-900 p-4">
                    <label className="block text-sm font-medium text-slate-300">
                        Search Forum Topic
                    </label>

                    <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                        <input
                            value={topicSearch}
                            onChange={(e) => setTopicSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") searchTopics();
                            }}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
                            placeholder="Search topic title..."
                        />

                        <button
                            onClick={searchTopics}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                        >
                            Search
                        </button>
                    </div>

                    {topicResults.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {topicResults.map((topic) => (
                                <button
                                    key={topic.topic_id}
                                    onClick={() => loadTopicReport(topic.topic_id)}
                                    className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-left hover:bg-slate-800"
                                >
                                    <div className="font-semibold text-slate-100">
                                        {topic.title}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                        Topic #{topic.topic_id}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    {error && (
                        <div className="mt-3 rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-200">
                            {error}
                        </div>
                    )}
                </div>

                {report && (
                    <>
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <h2 className="text-xl font-semibold text-slate-100">
                                    {report.topic_title}
                                </h2>

                                <div className="mt-1 text-sm text-slate-400">
                                    Topic #{report.topic_id}
                                </div>
                            </div>
                            <span
                                className={
                                    report.survey_status === "closed"
                                        ? "rounded-full bg-red-900 px-3 py-1 text-xs font-semibold text-red-100"
                                        : "rounded-full bg-emerald-900 px-3 py-1 text-xs font-semibold text-emerald-100"
                                }
                            >
                                {report.survey_status === "closed"
                                    ? "Survey Closed"
                                    : "Survey Open"}
                            </span>
                            <div className="flex shrink-0 flex-wrap gap-2">
                                {report.survey_status !== "closed" && (
                                    <button
                                        type="button"
                                        onClick={closeSurvey}
                                        className="rounded-lg bg-red-900 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-800"
                                    >
                                        Close Survey
                                    </button>
                                )}

                                {report.survey_status === "closed" && (
                                    <button
                                        type="button"
                                        onClick={reopenSurvey}
                                        className="rounded-lg bg-emerald-900 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-800"
                                    >
                                        Reopen Survey
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
                            <SummaryCard label="Participants" value={report.participants} />
                            <SummaryCard label="Completed" value={report.fully_completed} />
                            <SummaryCard label="Partial" value={report.partial} />
                            <SummaryCard label="Ballots" value={report.total_ballots} />
                            <SummaryCard label="Required" value={report.required_ballots} />
                        </div>

                        <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-900 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="font-semibold text-slate-100">
                                        Completion
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        {completionPercent}% completed all required polls.
                                    </p>
                                </div>
                                <div className="text-2xl font-semibold text-slate-100">
                                    {completionPercent}%
                                </div>
                            </div>

                            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                                <div
                                    className="h-full bg-blue-600"
                                    style={{ width: `${completionPercent}%` }}
                                />
                            </div>
                        </div>

                        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                            <h3 className="mb-3 text-lg font-semibold text-slate-100">
                                Participants
                            </h3>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="text-slate-400">
                                        <tr>
                                            <th className="py-2 pr-4">Name</th>
                                            <th className="py-2 pr-4">Required</th>
                                            <th className="py-2 pr-4">Answered</th>
                                            <th className="py-2 pr-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.participants_detail.map((p) => (
                                            <tr key={p.user_id} className="border-t border-slate-800">
                                                <td className="py-2 pr-4 text-slate-100">{p.name}</td>
                                                <td className="py-2 pr-4 text-slate-300">
                                                    {p.required_answered} / {p.required_total}
                                                </td>
                                                <td className="py-2 pr-4 text-slate-300">
                                                    {p.answered_ballots}
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <span
                                                        className={
                                                            p.complete
                                                                ? "text-emerald-400"
                                                                : "text-amber-400"
                                                        }
                                                    >
                                                        {p.complete ? "Complete" : "Partial"}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section className="mt-6 mb-6">
                            <h3 className="mb-3 text-lg font-semibold text-slate-100">
                                Ballots
                            </h3>

                            <div className="space-y-3 bg-slate-900 p-4 rounded-2xl border border-slate-700">
                                {report.ballots.map((ballot) => (
                                    <div
                                        key={ballot.ballot_id}
                                        className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900"
                                    >
                                        <button
                                            onClick={() => toggleBallot(ballot.ballot_id)}
                                            className="flex w-full items-start justify-between gap-4 p-4 bg-slate-800 text-left hover:bg-slate-700"
                                        >
                                            <div>
                                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    Ballot #{ballot.ballot_id}
                                                </div>

                                                <div className="mt-1 font-semibold text-slate-100">
                                                    {ballot.title}
                                                </div>

                                                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                                    <Badge>{ballot.responses} responses</Badge>
                                                    <Badge>{ballot.is_required ? "Required" : "Optional"}</Badge>
                                                    <Badge>{ballot.status}</Badge>
                                                    {ballot.is_test && <Badge>Test</Badge>}
                                                </div>
                                            </div>

                                            <div className="text-sm text-slate-400">
                                                {openBallotId === ballot.ballot_id ? "Hide" : "View"}
                                            </div>
                                        </button>

                                        {openBallotId === ballot.ballot_id && (
                                            <div className="border-t border-slate-700 p-4">
                                                {ballotLoading[ballot.ballot_id] ? (
                                                    <div className="text-sm text-slate-400">
                                                        Loading ballot report...
                                                    </div>
                                                ) : ballotReports[ballot.ballot_id] ? (
                                                    <BallotReportView report={ballotReports[ballot.ballot_id]} />
                                                ) : (
                                                    <div className="text-sm text-slate-400">
                                                        No report loaded.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </PageContainer>
    );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
                {label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-100">
                {value}
            </div>
        </div>
    );
}

function Badge({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-slate-300">
            {children}
        </span>
    );
}

function BallotReportView({ report }: { report: BallotReport }) {
    return (
        <div className="space-y-5">
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
                <span className="font-semibold text-slate-100">
                    Ballot #{report.ballot_id}
                </span>
                {" · "}
                {report.total_voters} voters
            </div>
            {report.description_md && (
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
                    {report.description_md}
                </div>
            )}

            <div>
                <h4 className="mb-2 font-semibold text-slate-100">
                    Choice Results
                </h4>

                <div className="space-y-2">
                    {report.choices.map((choice) => (
                        <div key={choice.choice_id}>
                            <div className="mb-1 flex justify-between gap-3 text-sm">
                                <span className="text-slate-200">{choice.label}</span>
                                <span className="text-slate-400">
                                    {choice.vote_count} ({choice.percent}%)
                                </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                                <div
                                    className="h-full bg-blue-600"
                                    style={{ width: `${choice.percent}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h4 className="mb-2 font-semibold text-slate-100">
                    Free-form Responses
                </h4>

                <div className="mb-3 text-sm text-slate-400">
                    {report.freeform.total_responses} written responses
                    {report.freeform.blank_responses > 0
                        ? `, ${report.freeform.blank_responses} blank`
                        : ""}
                </div>

                {report.freeform.responses.length === 0 ? (
                    <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-400">
                        No free-form responses.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {report.freeform.responses.map((r) => (
                            <div
                                key={r.vote_id}
                                className="rounded-xl border border-slate-700 bg-slate-950 p-3"
                            >
                                <div className="mb-2 text-sm font-semibold text-slate-200">
                                    {r.name}
                                </div>
                                <div className="whitespace-pre-wrap text-sm text-slate-300">
                                    {r.text}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}