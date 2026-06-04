import { useEffect, useMemo, useState } from "react";
import PageContainer from "../components/PageContainer";
import ForumMarkdown from "../components/forums/ForumMarkdown";
import { apiJson } from "../lib/api";

function normalizeSections(sections) {
  return (sections || []).map((section) => ({
    ...section,
    items: (section.items || []).map((item) => ({
      ...item,
      section: section.title,
      id: item.slug,
      videos: item.videos || [],
    })),
  }));
}

function flattenHelpItems(sections) {
  return sections.flatMap((section) => section.items || []);
}

export default function HelpPageV2() {
  const [sections, setSections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);

  const [videoUrl, setVideoUrl] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const normalizedSections = useMemo(
    () => normalizeSections(sections),
    [sections]
  );

  const allItems = useMemo(
    () => flattenHelpItems(normalizedSections),
    [normalizedSections]
  );

  const currentClip = selected?.videos?.[selectedClipIndex] || null;

  const videoKey =
    currentClip?.video_key ||
    selected?.videos?.[0]?.video_key ||
    selected?.slug ||
    null;

  useEffect(() => {
    let alive = true;

    async function loadHelp() {
      setLoading(true);
      setError("");

      try {
        const data = await apiJson("/help");
        if (!alive) return;

        setSections(data || []);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Unable to load help content.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadHelp();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selected && allItems.length > 0) {
      setSelected(allItems[0]);
      setSelectedClipIndex(0);
    }
  }, [allItems, selected]);

  useEffect(() => {
    let cancelled = false;

    async function loadVideoUrl() {
      if (!videoKey) {
        setVideoUrl(null);
        setVideoError("");
        setVideoLoading(false);
        return;
      }

      setVideoLoading(true);
      setVideoError("");

      try {
        const data = await apiJson(`/help-videos/${videoKey}/play-url`);

        if (!cancelled) {
          setVideoUrl(data?.url || null);

          if (!data?.url) {
            setVideoError("No playable video URL was returned.");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setVideoUrl(null);
          setVideoError(
            err?.message || "Unable to load this help video right now."
          );
        }
      } finally {
        if (!cancelled) {
          setVideoLoading(false);
        }
      }
    }

    loadVideoUrl();

    return () => {
      cancelled = true;
    };
  }, [videoKey]);

  if (loading) {
    return (
      <PageContainer maxWidth="2xl" className="space-y-6 py-6">
        <div className="text-slate-300">
          Loading help content…
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="2xl" className="space-y-6 py-6">
          <h1 className="text-2xl font-semibold text-white">Help</h1>
          <div className="mt-4 rounded-lg border border-red-700 bg-red-900/30 p-4 text-red-200">
            {error}
          </div>
      </PageContainer>
    );
  }

  if (!selected) {
    return (
      <PageContainer maxWidth="2xl" className="space-y-6 py-6">
          <h1 className="text-2xl font-semibold text-white">Help</h1>
          <p className="mt-3 text-slate-300">
            No help content has been configured yet.
          </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="2xl" className="space-y-6 py-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Help & Training
          </h1>
          <p className="mt-2 text-slate-300">
            Select a topic to learn about it and watch related help videos.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1">
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-5">
              {normalizedSections.map((group) => (
                <div key={group.section_id} className="space-y-2">
                  <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    {group.title}
                  </div>

                  <div className="space-y-2">
                    {(group.items || []).map((item) => {
                      const active = selected?.help_id === item.help_id;

                      return (
                        <button
                          key={item.help_id}
                          type="button"
                          onClick={() => {
                            setSelected(item);
                            setSelectedClipIndex(0);
                          }}
                          className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                            active
                              ? "border-emerald-500 bg-emerald-900/20 ring-1 ring-emerald-500/40"
                              : "border-slate-700 bg-slate-800 hover:bg-slate-700/80"
                          }`}
                        >
                          <div className="text-sm font-medium text-white">
                            {item.title}
                          </div>

                          {item.description ? (
                            <div className="mt-1 text-xs text-slate-300">
                              {item.description}
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="xl:col-span-2 space-y-4">
            <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
              {selected?.videos?.length > 1 && (
                <div className="border-b border-slate-700 p-3 flex flex-wrap gap-2">
                  {selected.videos.map((clip, idx) => (
                    <button
                      key={clip.video_id || clip.video_key}
                      type="button"
                      onClick={() => setSelectedClipIndex(idx)}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${
                        idx === selectedClipIndex
                          ? "border-emerald-500 bg-emerald-900/30 text-white"
                          : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      {clip.label || clip.video_key || `Video ${idx + 1}`}
                    </button>
                  ))}
                </div>
              )}

              <div className="aspect-video bg-black">
                {videoUrl ? (
                  <video
                    key={videoUrl}
                    controls
                    preload="metadata"
                    className="w-full h-full"
                    controlsList="nodownload"
                  >
                    <source src={videoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm">
                    {videoLoading
                      ? "Loading video…"
                      : videoError || "Video unavailable."}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                {selected.section}
              </div>

              <div className="mt-1 text-xl font-semibold text-white">
                {selected.title}
              </div>

              {currentClip?.label ? (
                <div className="mt-1 text-sm text-emerald-300">
                  Clip: {currentClip.label}
                </div>
              ) : null}

              {selected.description ? (
                <p className="mt-2 text-slate-300">{selected.description}</p>
              ) : null}

              <div className="mt-4 pt-4 border-t border-slate-700 w-full overflow-x-auto">
                <ForumMarkdown emptyText="No help text has been entered yet.">
                  {selected.markdown_md}
                </ForumMarkdown>
              </div>
            </div>
          </div>
        </div>
    </PageContainer>
  );
}