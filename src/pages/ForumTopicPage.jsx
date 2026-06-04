import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ForumComposer from "../components/forums/ForumComposer";
import ForumMarkdown from "../components/forums/ForumMarkdown";
import { apiJson } from "../lib/api";
import PageContainer from "../components/PageContainer";

export default function ForumTopicPage() {
  const { topicId } = useParams();

  const [topic, setTopic] = useState(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [savingPostId, setSavingPostId] = useState(null);
  const [error, setError] = useState("");

  const [editingPostId, setEditingPostId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [me, setMe] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);

  const [ballots, setBallots] = useState([]);
  const [ballotLoading, setBallotLoading] = useState(false);
  const [selectedChoices, setSelectedChoices] = useState({});
  const [votingBallotId, setVotingBallotId] = useState(null);

  const [creatingPollPostId, setCreatingPollPostId] = useState(null);

  const [newPollTitle, setNewPollTitle] = useState("");
  const [newPollDescription, setNewPollDescription] = useState("");

  const [newPollChoices, setNewPollChoices] = useState([
    { label: "Yes", allows_free_text: false, free_text_label: "" },
    { label: "No", allows_free_text: false, free_text_label: "" },
  ]);

  const [newPollShowResultsBeforeVote, setNewPollShowResultsBeforeVote] = useState(true);
  const [newPollAllowVoteChanges, setNewPollAllowVoteChanges] = useState(true);
  const [newPollMaxChoices, setNewPollMaxChoices] = useState(1);
  const [newPollSortOrder, setNewPollSortOrder] = useState("");

  const [creatingPoll, setCreatingPoll] = useState(false);
  const [feedbackTextByChoice, setFeedbackTextByChoice] = useState({});

  const [pollFormMode, setPollFormMode] = useState("create");
  const [editingBallotId, setEditingBallotId] = useState(null);
  const [isRequired, setIsRequired] = useState(true);

  const currentUserId = me?.user_id;

  const isAdmin = Array.isArray(me?.roles)
    ? me.roles.some((r) =>
      String(typeof r === "string" ? r : r.role_name || r.name)
        .toLowerCase() === "admin"
    )
    : false;

  const isSupervisor = Array.isArray(me?.roles)
    ? me.roles.some((r) =>
      String(typeof r === "string" ? r : r.role_name || r.name)
        .toLowerCase() === "supervisor"
    )
    : false;

  const canCreatePollRole = isAdmin || isSupervisor;

  const surveyClosed =
    ballots.length > 0 && ballots.every((b) => b.status === "closed");

  function postAuthorId(post) {
    return (
      post.created_by_user_id ??
      post.author_user_id ??
      post.user_id ??
      post.author_id
    );
  }

  function updatePollChoice(index, patch) {
    setNewPollChoices((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    );
  }

  function addPollChoice() {
    setNewPollChoices((prev) => [
      ...prev,
      { label: "", allows_free_text: false, free_text_label: "" },
    ]);
  }

  function removePollChoice(index) {
    setNewPollChoices((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setNewPollMaxChoices((current) =>
        Math.min(Number(current || 1), Math.max(1, next.length))
      );
      return next;
    });
  }

  function getSurveyStatus(ballots) {
    const required = ballots.filter((b) => b.is_required);

    const missing = required.filter(
      (b) => !b.user_has_answered
    );

    return {
      requiredTotal: required.length,
      requiredAnswered: required.length - missing.length,
      requiredMissing: missing.length,
      complete:
        required.length > 0 &&
        missing.length === 0,
    };
  }

  function resetPollForm() {
    setCreatingPollPostId(null);
    setNewPollTitle("");
    setNewPollDescription("");
    setNewPollChoices([
      { label: "Yes", allows_free_text: false, free_text_label: "" },
      { label: "No", allows_free_text: false, free_text_label: "" },
    ]);
    setNewPollShowResultsBeforeVote(false);
    setNewPollAllowVoteChanges(false);
    setNewPollMaxChoices(1);
    setNewPollSortOrder("");
    setPollFormMode("create");
    setEditingBallotId(null);
    setNewPollSortOrder("");
  }

  function canEditPost(post) {
    const authorId = postAuthorId(post);

    return (
      currentUserId != null &&
      authorId != null &&
      Number(authorId) === Number(currentUserId)
    );
  }

  function canDeletePost(post) {
    return canEditPost(post) || isAdmin;
  }


  useEffect(() => {
    async function loadMe() {
      try {
        const data = await apiJson("/auth/me", { authRequired: true });
        setMe(data);
        setAuthExpired(false);
      } catch {
        setMe(null);
        setAuthExpired(true);

        localStorage.removeItem("token");
        localStorage.removeItem("access_token");
        localStorage.removeItem("twofa_token");
        window.dispatchEvent(new Event("auth:logout"));
      } finally {
        setAuthChecked(true);
      }
    }

    loadMe();
  }, []);

  async function toggleTopicLock() {
    if (!topic) return;

    setError("");

    try {
      await apiJson(`/forums/topics/${topic.topic_id}/lock`, {
        method: "PATCH",
        body: JSON.stringify({
          is_locked: !topic.is_locked,
        }),
      });

      await loadTopic();
    } catch (err) {
      setError(err?.message || "Unable to update topic lock status.");
    }
  }

  async function loadBallots() {
    if (!topicId) return;

    setBallotLoading(true);

    try {
      const data = await apiJson(`/forums/topics/${topicId}/ballots`);
      const list = Array.isArray(data) ? data : [];

      setBallots(list);

      const choices = {};

      for (const b of list) {
        if (Array.isArray(b.user_choice_ids)) {
          choices[b.ballot_id] = b.user_choice_ids;
        } else if (b.user_choice_id) {
          choices[b.ballot_id] = [b.user_choice_id];
        }
      }

      setSelectedChoices(choices);

      const feedback = {};

      for (const b of list) {
        for (const c of b.choices || []) {
          if (c.user_feedback_text) {
            feedback[c.choice_id] = c.user_feedback_text;
          }
        }
      }

      setFeedbackTextByChoice(feedback);

    } catch {
      setBallots([]);
    } finally {
      setBallotLoading(false);
    }
  }

  useEffect(() => {
    loadTopic();
    loadBallots();
  }, [topicId]);

  async function submitVote(ballotId) {
    const raw = selectedChoices[ballotId];

    const choiceIds = Array.isArray(raw)
      ? raw
      : raw
        ? [raw]
        : [];

    if (!ballotId || choiceIds.length === 0) return;

    setVotingBallotId(ballotId);
    setError("");

    try {
      const updated = await apiJson(`/forums/ballots/${ballotId}/vote`, {
        method: "POST",
        body: JSON.stringify({
          choice_ids: choiceIds.map(Number),
        }),
      });

      setBallots((prev) =>
        prev.map((b) =>
          Number(b.ballot_id) === Number(ballotId) ? updated : b
        )
      );

      setSelectedChoices((prev) => ({
        ...prev,
        [ballotId]: updated.user_choice_ids || [],
      }));

      const selectedIds = choiceIds.map(Number);

      const selectedFreeTextChoices = (updated.choices || []).filter(
        (choice) =>
          choice.allows_free_text &&
          selectedIds.includes(Number(choice.choice_id)) &&
          (feedbackTextByChoice[choice.choice_id] || "").trim()
      );

      for (const choice of selectedFreeTextChoices) {
        await apiJson(`/forums/ballots/${ballotId}/feedback`, {
          method: "POST",
          body: JSON.stringify({
            choice_id: choice.choice_id,
            feedback_text: feedbackTextByChoice[choice.choice_id].trim(),
          }),
        });
      }

    } catch (err) {
      setError(err?.message || "Unable to submit vote.");
    } finally {
      setVotingBallotId(null);
    }
  }

  async function loadTopic() {
    setLoading(true);
    setError("");

    try {
      const data = await apiJson(`/forums/topics/${topicId}`);
      setTopic(data);
    } catch (err) {
      setError(err?.message || "Unable to load topic.");
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(postId) {
    if (!editBody.trim()) return;

    setSavingPostId(postId);
    setError("");

    try {
      await apiJson(`/forums/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify({
          body_md: editBody.trim(),
        }),
      });

      setEditingPostId(null);
      setEditBody("");
      await loadTopic();
    } catch (err) {
      setError(err?.message || "Unable to save edit.");
    } finally {
      setSavingPostId(null);
    }
  }

  async function deletePost(post) {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;

    setSavingPostId(post.post_id);
    setError("");

    try {
      await apiJson(`/forums/posts/${post.post_id}`, {
        method: "DELETE",
      });

      await loadTopic();
    } catch (err) {
      setError(err?.message || "Unable to delete post.");
    } finally {
      setSavingPostId(null);
    }
  }

  async function submitReply() {
    if (!reply.trim()) return;

    setPosting(true);
    setError("");

    try {
      await apiJson(`/forums/topics/${topicId}/posts`, {
        method: "POST",
        body: JSON.stringify({
          body_md: reply.trim(),
        }),
      });

      setReply("");
      await loadTopic();
    } catch (err) {
      setError(err?.message || "Unable to post reply.");
    } finally {
      setPosting(false);
    }
  }


  function renderPollForm(postId = null) {
    return (
      <div className="mt-4 rounded-xl border border-indigo-700 bg-slate-900 p-4">
        <div className="text-sm font-semibold text-slate-100">
          {pollFormMode === "edit" ? "Edit Poll" : "Create Poll"}
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-1 text-xs text-slate-400">
              Poll Question
            </div>

            <input
              type="text"
              value={newPollTitle}
              onChange={(e) => setNewPollTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              placeholder="Enter poll question..."
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-slate-400">
              Description (optional)
            </div>

            <textarea
              value={newPollDescription}
              onChange={(e) => setNewPollDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              rows={3}
              placeholder="Additional context..."
            />
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900"
            />
            Required response
          </label>

          <div className="mt-1 text-xs text-slate-500">
            Required polls count toward survey completion. Optional polls do not.
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={newPollShowResultsBeforeVote}
              onChange={(e) => setNewPollShowResultsBeforeVote(e.target.checked)}
            />
            Show results before voting
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={newPollAllowVoteChanges}
              onChange={(e) => setNewPollAllowVoteChanges(e.target.checked)}
            />
            Allow voters to change their vote
          </label>

          <div>
            <div className="mb-1 text-xs text-slate-400">
              Maximum selections per voter
            </div>
            <input
              type="number"
              min="1"
              max={newPollChoices.length}
              value={newPollMaxChoices}
              onChange={(e) => setNewPollMaxChoices(Number(e.target.value))}
              className="w-28 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-slate-400">
              Display order
            </div>
            <input
              type="number"
              value={newPollSortOrder}
              onChange={(e) => setNewPollSortOrder(e.target.value)}
              className="w-32 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              placeholder="Auto"
            />
            <div className="mt-1 text-xs text-slate-500">
              Lower numbers appear earlier. Keep Auto to add at the end.
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs text-slate-400">
              Choices
            </div>

            <div className="space-y-2">
              {newPollChoices.map((choice, index) => (
                <div key={index} className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={choice.label}
                      onChange={(e) =>
                        updatePollChoice(index, { label: e.target.value })
                      }
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      placeholder={`Choice ${index + 1}`}
                    />

                    {newPollChoices.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePollChoice(index)}
                        className="rounded-lg bg-red-900 px-3 py-2 text-xs text-red-100 hover:bg-red-800"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={choice.allows_free_text}
                      onChange={(e) =>
                        updatePollChoice(index, {
                          allows_free_text: e.target.checked,
                          free_text_label: e.target.checked
                            ? choice.free_text_label || "Please explain"
                            : "",
                        })
                      }
                    />
                    Allow private free-text response for this choice
                  </label>

                  {choice.allows_free_text && (
                    <input
                      type="text"
                      value={choice.free_text_label}
                      onChange={(e) =>
                        updatePollChoice(index, { free_text_label: e.target.value })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      placeholder="Free-text prompt, e.g. Please explain"
                    />
                  )}
                </div>))}
            </div>

            <button
              type="button"
              onClick={addPollChoice}
              className="mt-3 rounded-lg bg-slate-700 px-3 py-2 text-xs text-slate-100 hover:bg-slate-600"
            >
              Add Choice
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              disabled={creatingPoll}
              onClick={async () => {
                const cleanChoices = newPollChoices
                  .map((c) => ({
                    label: c.label.trim(),
                    allows_free_text: !!c.allows_free_text,
                    free_text_label: c.free_text_label?.trim() || null,
                  }))
                  .filter((c) => c.label);

                if (!newPollTitle.trim()) {
                  setError("Poll question is required.");
                  return;
                }
                const hasFreeTextChoice = cleanChoices.some((c) => c.allows_free_text);

                if (cleanChoices.length < 2 && !hasFreeTextChoice) {
                  setError("At least two choices are required unless this is a free-form question.");
                  return;
                }

                setCreatingPoll(true);
                setError("");

                try {
                  const url =
                    pollFormMode === "edit"
                      ? `/forums/ballots/${editingBallotId}`
                      : postId
                        ? `/forums/posts/${postId}/ballot`
                        : `/forums/topics/${topicId}/poll-question`;

                  const method =
                    pollFormMode === "edit"
                      ? "PATCH"
                      : "POST";

                  const updated = await apiJson(url, {
                    method,
                    body: JSON.stringify({
                      title: newPollTitle.trim(),
                      description_md: newPollDescription.trim(),
                      choices: cleanChoices,
                      is_required: isRequired,
                      sort_order:
                        newPollSortOrder === ""
                          ? null
                          : Number(newPollSortOrder),

                      max_choices_per_vote: Number(newPollMaxChoices),

                      show_results_before_vote: newPollShowResultsBeforeVote,
                      allow_vote_changes: newPollAllowVoteChanges,
                      show_live_results: true,
                    }),
                  });

                  setBallots((prev) =>
                    pollFormMode === "edit"
                      ? prev.map((b) =>
                        Number(b.ballot_id) === Number(updated.ballot_id)
                          ? updated
                          : b
                      )
                      : [...prev, updated]
                  );

                  await loadTopic();
                  await loadBallots();
                  resetPollForm();
                } catch (err) {
                  setError(
                    err?.message ||
                    (pollFormMode === "edit"
                      ? "Unable to save poll."
                      : "Unable to create poll.")
                  );
                } finally {
                  setCreatingPoll(false);
                }
              }}
              className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {creatingPoll
                ? pollFormMode === "edit"
                  ? "Saving..."
                  : "Creating..."
                : pollFormMode === "edit"
                  ? "Save Poll"
                  : "Create Poll"}
            </button>

            <button
              type="button"
              onClick={resetPollForm}
              className="rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  function getSurveyStatus(ballots) {
    const required = ballots.filter((b) => b.is_required);

    const missing = required.filter(
      (b) => !b.user_has_answered
    );

    return {
      requiredTotal: required.length,
      requiredAnswered: required.length - missing.length,
      requiredMissing: missing.length,
      complete:
        required.length > 0 &&
        missing.length === 0,
      notstarted: required.length > 0 && missing.length === required.length,
    };
  }

  const surveyStatus = getSurveyStatus(ballots);
  const orderedPosts = [...(topic?.posts || [])].sort((a, b) => {
    const aOrder = Number(a.sort_order ?? a.post_id);
    const bOrder = Number(b.sort_order ?? b.post_id);
    const surveyStatus = getSurveyStatus(ballots);

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return Number(a.post_id) - Number(b.post_id);
  });

  if (loading && !topic) {
    return (
      <PageContainer maxWidth="2xl" className="space-y-6 py-6">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 text-sm text-slate-300">
          Loading topic...
        </div>
      </PageContainer>
    );
    if (authChecked && authExpired) {
      return (
        <PageContainer maxWidth="2xl" className="space-y-6 py-6">
          <div className="rounded-xl border border-amber-700 bg-amber-950/40 p-5 text-amber-100">
            Your login has expired. Please sign in again to reply, edit, or delete forum posts.
          </div>
        </PageContainer>
      );
    }
  }

  return (
    <PageContainer maxWidth="2xl" className="space-y-6 py-6">
      <div>
        <Link className="text-sm text-blue-300 hover:text-blue-200" to="/forums">
          Back to forums
        </Link>

        {topic ? (
          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-semibold text-slate-100">
                  {topic.title}
                </h1>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                  <span>{topic.posts?.length || 0} posts</span>
                  {topic.category_name && <span>{topic.category_name}</span>}
                  {topic.created_at && (
                    <span>Started {new Date(topic.created_at).toLocaleString()}</span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 text-xs">
                {topic.is_pinned && (
                  <span className="rounded-full bg-amber-900 px-2 py-1 text-amber-100">
                    Pinned
                  </span>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    onClick={toggleTopicLock}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${topic.is_locked
                      ? "bg-emerald-800 text-emerald-100 hover:bg-emerald-700"
                      : "bg-red-900 text-red-100 hover:bg-red-800"
                      }`}
                  >
                    {topic.is_locked ? "Unlock Topic" : "Lock Topic"}
                  </button>
                )}

                {canCreatePollRole && (
                  <button
                    type="button"
                    onClick={() => {
                      resetPollForm();
                      setPollFormMode("create");
                      setCreatingPollPostId("topic");
                      setEditingBallotId(null);
                    }}
                    className="rounded-full bg-indigo-800 px-3 py-1 text-xs font-semibold text-indigo-100 hover:bg-indigo-700"
                  >
                    Add Poll Question
                  </button>
                )}

                {topic.topic_type && topic.topic_type !== "general" && (
                  <span className="rounded-full bg-blue-900 px-2 py-1 text-blue-100">
                    {topic.topic_type}
                  </span>
                )}
              </div>
            </div>

            {surveyStatus.requiredTotal > 0 && (
              <div
                className={
                  surveyStatus.complete
                    ? "mt-4 w-fit rounded-xl border border-emerald-700 bg-emerald-950/60 px-4 py-3 text-sm font-semibold text-emerald-200"
                    : surveyStatus.notstarted
                      ? "mt-4 w-fit rounded-xl border border-sky-700 bg-sky-900/60 px-4 py-3 text-sm font-semibold text-sky-300"
                      : "mt-4 w-fit rounded-xl border border-amber-700 bg-amber-950/60 px-4 py-3 text-sm font-semibold text-amber-200"
                }
              >
                {surveyStatus.complete
                  ? `SURVEY COMPLETE — all ${surveyStatus.requiredTotal} required questions answered - Thank you for your feedback!`
                  : surveyStatus.notstarted
                    ? `SURVEY NOT STARTED — Please answer ${surveyStatus.requiredTotal} required questions to complete the survey.`
                    : `SURVEY INCOMPLETE — ${surveyStatus.requiredMissing} required questions unanswered (${surveyStatus.requiredAnswered}/${surveyStatus.requiredTotal})`}
              </div>
            )}
            {surveyClosed && (
              <div className="mt-4 rounded-xl border border-red-700 bg-red-950/60 px-4 py-3 text-sm font-semibold text-red-100">
                This survey is closed. Votes can no longer be submitted or changed.
              </div>
            )}
          </div>
        ) : null}
      </div>

      {creatingPollPostId === "topic" && renderPollForm(null)}

      {error && (
        <div className="rounded-lg border border-red-700 bg-red-950/50 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {!topic && !loading ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-8 text-center">
          <div className="text-lg font-semibold text-slate-100">Topic unavailable</div>
          <div className="mt-2 text-sm text-slate-400">
            The topic could not be loaded. It may have moved or you may not have access.
          </div>
        </div>
      ) : null}


      {topic ? (
        <div className="space-y-4">
          {orderedPosts.map((post, index) => (
            <div
              key={post.post_id}
              className="rounded-xl border border-slate-700 bg-slate-800 p-5"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100">
                    {post.author_name || "Unknown user"}
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                    {index === 0 && (
                      <span className="rounded-full bg-slate-700 px-2 py-0.5 text-slate-200">
                        Original post
                      </span>
                    )}

                    {post.created_at && (
                      <span>{new Date(post.created_at).toLocaleString()}</span>
                    )}

                    {post.edited_at && (
                      <span>edited {new Date(post.edited_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                {/* <button
                  className="shrink-0 rounded-md px-2 py-1 text-xs bg-slate-700 text-blue-300 hover:bg-slate-600 hover:text-blue-200"
                  onClick={() => {
                    setEditingPostId(post.post_id);
                    setEditBody(post.body_md || "");
                  }}
                  type="button"
                >
                  Edit
                </button> */}
                <div className="flex shrink-0 gap-2">
                  {canEditPost(post) && (
                    <button
                      className="rounded-md bg-slate-700 px-2 py-1 text-xs text-blue-300 hover:bg-slate-600 hover:text-blue-200"
                      onClick={() => {
                        setEditingPostId(post.post_id);
                        setEditBody(post.body_md || "");
                      }}
                      type="button"
                    >
                      Edit
                    </button>
                  )}

                  {canDeletePost(post) && (
                    <button
                      className="rounded-md bg-red-900 px-2 py-1 text-xs text-red-100 hover:bg-red-800"
                      onClick={() => deletePost(post)}
                      type="button"
                    >
                      Delete
                    </button>
                  )}
                  {canCreatePollRole &&
                    canEditPost(post) &&
                    !ballots.some((b) => Number(b.post_id) === Number(post.post_id)) && (
                      <button
                        className="rounded-md bg-indigo-800 px-2 py-1 text-xs text-indigo-100 hover:bg-indigo-700"
                        onClick={() => {
                          resetPollForm();
                          setCreatingPollPostId(post.post_id);
                        }}
                        type="button"
                      >
                        Create Poll
                      </button>
                    )}
                </div>
              </div>

              {creatingPollPostId === post.post_id && renderPollForm(post.post_id)}

              {editingPostId === post.post_id ? (
                <div className="space-y-3">
                  <ForumComposer
                    value={editBody}
                    onChange={setEditBody}
                    onSubmit={() => saveEdit(post.post_id)}
                    placeholder="Update this post..."
                    submitLabel="Save Edit"
                    submitting={savingPostId === post.post_id}
                    submitDisabled={!canEditPost(post)}
                    title="Edit post"
                  />

                  <button
                    className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600"
                    onClick={() => {
                      setEditingPostId(null);
                      setEditBody("");
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              ) : post.post_type !== "poll" ? (
                <ForumMarkdown>{post.body_md}</ForumMarkdown>
              ) : null}

              {(() => {
                const postBallot = ballots.find(
                  (b) => Number(b.post_id) === Number(post.post_id)
                );

                if (!postBallot) return null;
                const userChoiceIds = Array.isArray(postBallot.user_choice_ids)
                  ? postBallot.user_choice_ids
                  : postBallot.user_choice_id
                    ? [postBallot.user_choice_id]
                    : [];

                const hasVoted = userChoiceIds.length > 0;
                const pollHasVotes = Number(postBallot.total_votes || 0) > 0;
                const maxChoices = postBallot.max_choices_per_vote || 1;

                const isMultiChoice = maxChoices > 1;

                const canSeeResults =
                  postBallot.show_live_results &&
                  (postBallot.show_results_before_vote || hasVoted);

                const voteLocked =
                  hasVoted && !postBallot.allow_vote_changes


                return (
                  <div className="mt-5 rounded-xl border border-slate-700 bg-slate-900 p-4">
                    <div className="flex items-center gap-2">
                      <div className="rounded bg-slate-700 px-2 py-0.5 text-xs font-mono text-slate-200">
                        #{post.sort_order ?? post.post_id}
                      </div>
                      <span
                        className={
                          postBallot.is_required
                            ? "rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs  text-amber-300"
                            : "rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs  text-slate-300"
                        }
                      >
                        {postBallot.is_required ? "Required" : "Optional"}
                      </span>
                      <div className="text-base font-semibold text-slate-100">
                        {postBallot.title}
                      </div>
                      {postBallot.status === "closed" && (
                        <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs text-red-300">
                          Closed
                        </span>
                      )}
                    </div>

                    {(isAdmin || Number(postBallot.created_by_user_id) === Number(me?.user_id)) &&
                      !pollHasVotes && (
                        <button
                          type="button"
                          onClick={() => {
                            setPollFormMode("edit");
                            setEditingBallotId(postBallot.ballot_id);
                            setCreatingPollPostId(post.post_id);

                            setNewPollTitle(postBallot.title || "");
                            setNewPollDescription(postBallot.description_md || "");

                            setNewPollMaxChoices(
                              postBallot.max_choices_per_vote || 1
                            );
                            setNewPollSortOrder(postBallot.sort_order ?? "");
                            setNewPollSortOrder(
                              postBallot.sort_order ?? ""
                            );

                            setNewPollShowResultsBeforeVote(
                              !!postBallot.show_results_before_vote
                            );

                            setNewPollAllowVoteChanges(
                              !!postBallot.allow_vote_changes
                            );

                            setNewPollChoices(
                              (postBallot.choices || []).map((c) => ({
                                choice_id: c.choice_id,
                                label: c.label,
                                allows_free_text: !!c.allows_free_text,
                                free_text_label: c.free_text_label || "",
                              }))
                            );
                          }}
                          className="mt-2 rounded-lg bg-slate-700 px-3 py-1 text-xs text-slate-100 hover:bg-slate-600"
                        >
                          Edit Poll
                        </button>
                      )}

                    {postBallot.description_md && (
                      <div className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                        {postBallot.description_md}
                      </div>
                    )}

                    {voteLocked && (
                      <div className="mt-3 rounded-lg border border-amber-700 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
                        Your vote has been recorded and cannot be changed.
                      </div>
                    )}
                    {isMultiChoice && (
                      <div className="mt-3 text-xs text-slate-400">
                        Select up to {maxChoices} choices.
                      </div>
                    )}
                    <div className="mt-4 space-y-3">
                      {(postBallot.choices || []).map((choice) => {
                        const percent =
                          postBallot.total_votes > 0
                            ? Math.round((choice.vote_count / postBallot.total_votes) * 100)
                            : 0;

                        const rawSelectedChoiceIds = selectedChoices[postBallot.ballot_id];

                        const selectedChoiceIds = Array.isArray(rawSelectedChoiceIds)
                          ? rawSelectedChoiceIds
                          : rawSelectedChoiceIds
                            ? [rawSelectedChoiceIds]
                            : [];

                        const isChecked = selectedChoiceIds.some(
                          (id) => Number(id) === Number(choice.choice_id)
                        );

                        return (
                          <label
                            key={choice.choice_id}
                            className="block cursor-pointer rounded-lg border border-slate-700 bg-slate-800 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type={isMultiChoice ? "checkbox" : "radio"}
                                disabled={voteLocked}
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedChoices((prev) => {
                                    const current = prev[postBallot.ballot_id] || [];

                                    if (!isMultiChoice) {
                                      return {
                                        ...prev,
                                        [postBallot.ballot_id]: [choice.choice_id],
                                      };
                                    }

                                    const alreadySelected = current.some(
                                      (id) => Number(id) === Number(choice.choice_id)
                                    );

                                    if (alreadySelected) {
                                      return {
                                        ...prev,
                                        [postBallot.ballot_id]: current.filter(
                                          (id) => Number(id) !== Number(choice.choice_id)
                                        ),
                                      };
                                    }

                                    if (current.length >= maxChoices) {
                                      setError(`You may select up to ${maxChoices} choices.`);
                                      return prev;
                                    }

                                    return {
                                      ...prev,
                                      [postBallot.ballot_id]: [...current, choice.choice_id],
                                    };
                                  });
                                }}
                              />

                              <span className="text-slate-100">{choice.label}</span>
                            </div>
                            {isChecked && choice.allows_free_text && (
                              <div className="mt-3">
                                <div className="mb-1 text-xs text-slate-400">
                                  {choice.free_text_label || "Please explain"}
                                </div>

                                <textarea
                                  value={feedbackTextByChoice[choice.choice_id] || ""}
                                  onChange={(e) =>
                                    setFeedbackTextByChoice((prev) => ({
                                      ...prev,
                                      [choice.choice_id]: e.target.value,
                                    }))
                                  }
                                  rows={3}
                                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                                  placeholder="This response is private."
                                />
                              </div>
                            )}
                            {canSeeResults && (
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-xs text-slate-400">
                                  <div>
                                    {choice.vote_count} votes · {percent}%
                                  </div>

                                  {userChoiceIds.some((id) => Number(id) === Number(choice.choice_id)) && (
                                    <span className="font-semibold text-emerald-400">
                                      Your vote
                                    </span>
                                  )}
                                </div>

                                <div className="mt-1 h-2 overflow-hidden rounded bg-slate-700">
                                  <div
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => submitVote(postBallot.ballot_id)}
                      disabled={
                        voteLocked ||
                        !selectedChoices[postBallot.ballot_id] ||
                        Number(votingBallotId) === Number(postBallot.ballot_id)
                      }

                      className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {Number(votingBallotId) === Number(postBallot.ballot_id)
                        ? "Saving..."
                        : postBallot.user_choice_id
                          ? "Update vote"
                          : "Submit vote"}
                    </button>

                    {canSeeResults && (
                      <div className="mt-3 text-xs text-slate-400">
                        Total votes: {postBallot.total_votes}
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>
          ))}
        </div>
      ) : null}

      {topic && topic.is_locked ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 text-sm text-slate-300">
          This topic is locked, so new replies are closed.
        </div>
      ) : topic && me ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <ForumComposer
            value={reply}
            onChange={setReply}
            onSubmit={submitReply}
            placeholder="Write a reply..."
            submitLabel="Post Reply"
            submitting={posting}
            title="Reply"
          />
        </div>
      ) : null}
    </PageContainer>
  );
}
