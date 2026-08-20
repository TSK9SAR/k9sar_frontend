import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

export default function ForumEmailEntryPage() {
    const { token } = useParams();
    const navigate = useNavigate();
    const returnPath =
        window.location.pathname + window.location.search;
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function openForumLink() {
            const authToken = localStorage.getItem("token");

            if (!authToken) {
                if (!cancelled) {
                    setError(
                        "You must sign in to TSK9SAR to open this forum link."
                    );
                }
                return;
            }

            try {
                const resp = await fetch(
                    `/api/forums/email-entry/${encodeURIComponent(token)}`,
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${authToken}`,
                        },
                    }
                );

                let data = null;

                try {
                    data = await resp.json();
                } catch {
                    data = null;
                }

                if (cancelled) return;

                if (resp.status === 401) {
                    localStorage.removeItem("token");
                    window.dispatchEvent(new Event("auth:logout"));

                    setError(
                        "Your TSK9SAR login has expired. Please sign in again."
                    );
                    return;
                }

                if (resp.status === 403) {
                    setError(
                        "This forum link was sent to a different TSK9SAR member than the member currently signed in."
                    );
                    return;
                }

                if (!resp.ok) {
                    setError(
                        data?.detail ||
                        "This forum link is invalid or has expired."
                    );
                    return;
                }

                if (!data?.topic_id) {
                    setError("The forum link did not identify a topic.");
                    return;
                }

                navigate(
                    `/forums/topics/${data.topic_id}?reply=1`,
                    { replace: true }
                );
            } catch {
                if (!cancelled) {
                    setError(
                        "Unable to open the forum discussion. Please try again."
                    );
                }
            }
        }

        openForumLink();

        return () => {
            cancelled = true;
        };
    }, [token, navigate]);

    return (
        <div className="mx-auto max-w-xl px-4 py-10">
            {error ? (
                <div className="rounded-xl border border-amber-700 bg-amber-950/40 p-5 text-amber-100">
                    <div className="font-semibold">
                        Unable to open forum link
                    </div>

                    <div className="mt-2 text-sm">
                        {error}
                    </div>

                    <div className="mt-4 flex gap-3">
                        <Link
                            to={`/login?next=${encodeURIComponent(returnPath)}`}
                            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
                        >
                            Sign In
                        </Link>

                    </div>
                </div>
            ) : (
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 text-sm text-slate-300">
                    Opening forum discussion...
                </div>
            )}
        </div>
    );
}