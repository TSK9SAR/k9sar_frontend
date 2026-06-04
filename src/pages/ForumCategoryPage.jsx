import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ForumComposer from "../components/forums/ForumComposer";
import { apiJson } from "../lib/api";
import PageContainer from "../components/PageContainer";

export default function ForumCategoryPage() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [title, setTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadTopics();
  }, [categoryId]);

  function surveyStatusBadge(topic) {
    const s = topic.survey_completion;

    if (!s) return null;

    const requiredTotal = Number(s.required_total ?? s.requiredTotal ?? 0);
    const requiredAnswered = Number(s.required_answered ?? s.requiredAnswered ?? 0);
    const requiredMissing = Number(s.required_missing ?? s.requiredMissing ?? 0);
    const complete = Boolean(s.complete);


    if (requiredTotal <= 0) return null;

    if (requiredAnswered === 0) {
      return {
        label: "Not Started",
        className: "bg-sky-900 text-sky-100",
      };
    }

    if (complete || requiredMissing === 0) {
      return {
        label: "Completed",
        className: "bg-emerald-900 text-emerald-100",
      };
    }

    return {
      label: "Incomplete",
      className: "bg-amber-900 text-amber-100",
    };
  }

  function surveyOpenClosedBadge(topic) {
    if (!topic.survey_completion) return null;

    const status = String(topic.survey_status || "").toLowerCase();

    if (status === "closed") {
      return {
        label: "Closed",
        className: "bg-red-900 text-red-100",
      };
    }

    if (status === "open") {
      return {
        label: "Open",
        className: "bg-emerald-900 text-emerald-100",
      };
    }

    return null;
  }

  async function loadTopics() {
    setLoading(true);
    setError("");

    try {
      const data = await apiJson(`/forums/${categoryId}/topics`);
      setTopics(data || []);

    } catch (err) {
      setError(err?.message || "Unable to load topics.");
    } finally {
      setLoading(false);
    }
  }

  async function createTopic() {
    if (!title.trim() || !bodyMd.trim()) return;

    setPosting(true);
    setError("");

    try {
      const created = await apiJson(`/forums/${categoryId}/topics`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          body_md: bodyMd.trim(),
          topic_type: "general",
        }),
      });

      setTitle("");
      setBodyMd("");

      const createdTopicId = created?.topic_id || created?.topic?.topic_id || created?.id;

      if (createdTopicId) {
        navigate(`/forums/topics/${createdTopicId}`);
        return;
      }

      await loadTopics();
    } catch (err) {
      setError(err?.message || "Unable to create topic.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <PageContainer maxWidth="2xl" className="space-y-6 py-6">
      <div className="mx-auto  space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link className="text-sm text-blue-300 hover:text-blue-200" to="/forums">
              Back to forums
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-slate-100">Topics</h1>
          </div>

          <div className="text-sm text-slate-400">
            {topics.length} {topics.length === 1 ? "topic" : "topics"}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-700 bg-red-950/50 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <div className="mb-4">
            <div className="text-lg font-semibold text-slate-100">Create New Topic</div>
            <div className="mt-1 text-sm text-slate-400">
              Start a focused discussion with a clear title and a markdown-formatted first post.
            </div>
          </div>

          <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="forum-topic-title">
            Topic title
          </label>
          <input
            id="forum-topic-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Topic title"
            className="mb-4 w-full rounded-lg border border-slate-600 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <ForumComposer
            value={bodyMd}
            onChange={setBodyMd}
            onSubmit={createTopic}
            placeholder="Write the opening post..."
            submitDisabled={!title.trim()}
            submitLabel="Post Topic"
            submitting={posting}
            title="Opening post"
          />
        </div>

        <div className="space-y-3">
          {loading && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 text-sm text-slate-300">
              Loading topics...
            </div>
          )}

          {!loading && topics.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
              <div className="text-lg font-semibold text-slate-100">No topics yet</div>
              <div className="mt-2 text-sm text-slate-400">
                Create the first topic for this forum when there is something to discuss.
              </div>
            </div>
          )}

          {!loading && topics.map((topic) => {
            const status = surveyStatusBadge(topic);
            const openClosedStatus = surveyOpenClosedBadge(topic);

            return (
              <Link
                key={topic.topic_id}
                to={`/forums/topics/${topic.topic_id}`}
                className={`block rounded-xl border p-4 transition hover:border-blue-400 ${topic.is_unread
                  ? "border-blue-400 bg-slate-800 shadow-sm shadow-blue-950/40"
                  : "border-slate-700 bg-slate-800"
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {topic.is_unread && (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-400" />
                      )}

                      <div className="truncate font-semibold text-white">
                        {topic.title}
                      </div>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
                      <span>{topic.reply_count || 0} replies</span>
                      {topic.last_post_at && (
                        <span>Last post {new Date(topic.last_post_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-2 text-xs">
                    {topic.is_pinned && (
                      <span className="rounded-full bg-amber-900 text-amber-100 px-2 py-1">
                        Pinned
                      </span>
                    )}

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {topic.is_locked && (
                        <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-200">
                          Locked
                        </span>
                      )}

                      <div className="flex flex-wrap justify-end gap-2">
                        {status && (
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                        )}

                        {openClosedStatus && (
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${openClosedStatus.className}`}>
                            {openClosedStatus.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {topic.topic_type !== "general" && (
                      <span className="rounded-full bg-blue-900 text-blue-100 px-2 py-1">
                        {topic.topic_type}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}
