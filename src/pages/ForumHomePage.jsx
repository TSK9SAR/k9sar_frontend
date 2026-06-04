import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiJson } from "../lib/api";
import PageContainer from "../components/PageContainer";

export default function ForumHomePage() {
  const [forums, setForums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  useEffect(() => {
    loadForums();
  }, []);

  async function loadForums() {
    try {
      setError("");
      const data = await apiJson("/forums/");
      setForums(data || []);
    } catch (err) {
      setError(err?.message || "Unable to load forums.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <PageContainer maxWidth="2xl" className="space-y-6 py-6">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 text-sm text-slate-300">
          Loading forums...
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="2xl" className="space-y-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            <span className="text-emerald-300">TSK9SAR</span>{" "}
            <span className="text-slate-100">Forums</span>
          </h1>
          <div className="mt-1 text-sm text-slate-400">
            Read announcements, coordinate work, and keep discussions searchable.
          </div>
        </div>

        <Link
          to="/forums/settings"
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-blue-300 hover:border-blue-400 hover:text-blue-200"
        >
          Email notification preferences
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-700 bg-red-950/50 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {forums.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
            <div className="text-lg font-semibold text-slate-100">No forums available</div>
            <div className="mt-2 text-sm text-slate-400">
              Forum categories will appear here once they are enabled.
            </div>
          </div>
        )}

        {forums.map((forum) => (
          <Link
            key={forum.category_id}
            to={`/forums/${forum.category_id}`}
            className={`block rounded-xl border p-5 transition ${forum.unread_count > 0
              ? "border-blue-400 bg-slate-800 shadow-sm shadow-blue-950/40"
              : "border-slate-700 bg-slate-800 hover:border-blue-400"
              }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {forum.unread_count > 0 && (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-400" />
                  )}

                  <div className="truncate text-lg font-semibold text-white">
                    {forum.name}
                  </div>
                </div>

                {forum.description && (
                  <div className="text-sm text-slate-300 mt-2">
                    {forum.description}
                  </div>
                )}

                {forum.last_topic_title && (
                  <div className="text-sm text-slate-400 mt-3">
                    Latest:{" "}
                    <span className="text-slate-200">
                      {forum.last_topic_title}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-right text-xs text-slate-300 shrink-0">
                <div>{forum.topic_count} topics</div>

                {forum.unread_count > 0 && (
                  <div className="mt-1 rounded-full bg-blue-900 text-blue-100 px-2 py-1">
                    {forum.unread_count} unread
                  </div>
                )}

                {forum.last_post_at && (
                  <div className="mt-2 text-slate-400">
                    {new Date(forum.last_post_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
