import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../lib/api";
import PageContainer from "../../components/PageContainer";
import ForumComposer from "../../components/forums/ForumComposer";


const emptySection = {
  title: "",
  sort_order: 0,
  is_active: true,
};

const emptyItem = {
  section_id: "",
  slug: "",
  title: "",
  description: "",
  markdown_md: "",
  sort_order: 0,
  is_active: true,
};

const emptyVideo = {
  video_key: "",
  label: "",
  sort_order: 0,
  is_active: true,
};

const toolButtonClass =
  "mt-3 w-full rounded-lg border border-slate-600 bg-slate-900 px-2 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:bg-slate-800";

export default function AdminHelpPage() {
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [selectedHelpId, setSelectedHelpId] = useState(null);

  const [sectionForm, setSectionForm] = useState(emptySection);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [videoForm, setVideoForm] = useState(emptyVideo);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadSortOrder, setUploadSortOrder] = useState(0);
  const [uploading, setUploading] = useState(false);

  const [previewVideoUrl, setPreviewVideoUrl] = useState("");
  const [previewVideoLabel, setPreviewVideoLabel] = useState("");
  const [previewLoadingId, setPreviewLoadingId] = useState(null);

  async function loadHelp() {
    setLoading(true);
    setError("");

    try {
      const data = await apiJson("/admin/help", {
        authRequired: true,
        mfaRequired: true,
      });
      setSections(data || []);

      if (!selectedSectionId && data?.length) {
        setSelectedSectionId(data[0].section_id);
      }
    } catch (err) {
      setError(err?.message || "Unable to load help content.");
    } finally {
      setLoading(false);
    }
  }

  async function previewVideo(video) {
    if (!video?.video_key) return;

    setPreviewLoadingId(video.video_id);
    setError("");

    try {
      const data = await apiJson(`/help-videos/${video.video_key}/play-url`);
      setPreviewVideoUrl(data?.url || "");
      setPreviewVideoLabel(video.label || video.video_key);
    } catch (err) {
      setPreviewVideoUrl("");
      setPreviewVideoLabel("");
      setError(err?.message || "Unable to preview video.");
    } finally {
      setPreviewLoadingId(null);
    }
  }

  async function uploadVideo() {
    if (!selectedItem) {
      setError("Select or save a help item before uploading a video.");
      return;
    }

    if (!uploadFile) {
      setError("Choose an MP4 file to upload.");
      return;
    }

    const currentHelpId = selectedItem.help_id;
    const currentSectionId = selectedItem.section_id;

    setUploading(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();

      formData.append("file", uploadFile);
      formData.append(
        "label",
        uploadLabel || uploadFile.name.replace(/\.mp4$/i, "")
      );
      formData.append("sort_order", String(uploadSortOrder || 0));
      formData.append("is_active", "true");

      await apiJson(`/admin/help/items/${currentHelpId}/videos/upload`, {
        method: "POST",
        body: formData,
      });

      const refreshed = await apiJson("/admin/help");

      setSections(refreshed || []);
      setSelectedSectionId(currentSectionId);
      setSelectedHelpId(currentHelpId);

      setUploadFile(null);
      setUploadLabel("");
      setUploadSortOrder(0);

      setMessage("Video uploaded.");
    } catch (err) {
      setError(err?.message || "Unable to upload video.");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    loadHelp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSection = useMemo(
    () =>
      (sections || []).find(
        (s) => Number(s.section_id) === Number(selectedSectionId)
      ) || null,
    [sections, selectedSectionId]
  );

  const selectedItem = useMemo(() => {
    for (const section of sections || []) {
      const found = (section.items || []).find(
        (item) => Number(item.help_id) === Number(selectedHelpId)
      );

      if (found) return found;
    }

    return null;
  }, [sections, selectedHelpId]);

  useEffect(() => {
    if (selectedSection) {
      setSectionForm({
        title: selectedSection.title || "",
        sort_order: selectedSection.sort_order || 0,
        is_active: !!selectedSection.is_active,
      });
    } else {
      setSectionForm(emptySection);
    }

    setSelectedHelpId(null);
    setItemForm({
      ...emptyItem,
      section_id: selectedSection?.section_id || "",
    });
  }, [selectedSectionId]); // intentionally selectedSectionId only

  useEffect(() => {
    if (selectedItem) {
      setItemForm({
        section_id: selectedItem.section_id || selectedSectionId || "",
        slug: selectedItem.slug || "",
        title: selectedItem.title || "",
        description: selectedItem.description || "",
        markdown_md: selectedItem.markdown_md || "",
        sort_order: selectedItem.sort_order || 0,
        is_active: !!selectedItem.is_active,
      });
    } else {
      setItemForm({
        ...emptyItem,
        section_id: selectedSectionId || "",
      });
    }

    setVideoForm(emptyVideo);
  }, [selectedHelpId, selectedSectionId, selectedItem]);

  function setSectionField(name, value) {
    setSectionForm((prev) => ({ ...prev, [name]: value }));
  }

  function setItemField(name, value) {
    setItemForm((prev) => ({ ...prev, [name]: value }));
  }

  function setVideoField(name, value) {
    setVideoForm((prev) => ({ ...prev, [name]: value }));
  }

  async function saveSection() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        ...sectionForm,
        sort_order: Number(sectionForm.sort_order || 0),
      };

      if (selectedSection) {
        await apiJson(`/admin/help/sections/${selectedSection.section_id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setMessage("Section updated.");
      } else {
        const created = await apiJson("/admin/help/sections", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSelectedSectionId(created.section_id);
        setMessage("Section created.");
      }

      await loadHelp();
    } catch (err) {
      setError(err?.message || "Unable to save section.");
    } finally {
      setSaving(false);
    }
  }

  async function saveItem() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        ...itemForm,
        section_id: Number(itemForm.section_id),
        sort_order: Number(itemForm.sort_order || 0),
      };

      if (!payload.section_id) {
        throw new Error("Section is required.");
      }

      if (selectedItem) {
        await apiJson(`/admin/help/items/${selectedItem.help_id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setMessage("Help item updated.");
      } else {
        const created = await apiJson("/admin/help/items", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSelectedHelpId(created.help_id);
        setMessage("Help item created.");
      }

      await loadHelp();
    } catch (err) {
      setError(err?.message || "Unable to save help item.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem() {
    if (!selectedItem) return;
    if (!window.confirm(`Delete "${selectedItem.title}"?`)) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiJson(`/admin/help/items/${selectedItem.help_id}`, {
        method: "DELETE",
      });
      setSelectedHelpId(null);
      setMessage("Help item deleted.");
      await loadHelp();
    } catch (err) {
      setError(err?.message || "Unable to delete help item.");
    } finally {
      setSaving(false);
    }
  }

  async function addVideo() {
    if (!selectedItem) {
      setError("Select or save a help item before adding videos.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        ...videoForm,
        sort_order: Number(videoForm.sort_order || 0),
      };

      await apiJson(`/admin/help/items/${selectedItem.help_id}/videos`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setVideoForm(emptyVideo);
      setMessage("Video added.");
      await loadHelp();
    } catch (err) {
      setError(err?.message || "Unable to add video.");
    } finally {
      setSaving(false);
    }
  }

  async function updateVideo(video) {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiJson(`/admin/help/videos/${video.video_id}`, {
        method: "PUT",
        body: JSON.stringify({
          video_key: video.video_key || "",
          label: video.label || "",
          sort_order: Number(video.sort_order || 0),
          is_active: !!video.is_active,
        }),
      });

      setMessage("Video updated.");
      await loadHelp();
    } catch (err) {
      setError(err?.message || "Unable to update video.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteVideo(video) {
    if (!window.confirm(`Delete video "${video.label || video.video_key}"?`)) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiJson(`/admin/help/videos/${video.video_id}`, {
        method: "DELETE",
      });

      setMessage("Video deleted.");
      await loadHelp();
    } catch (err) {
      setError(err?.message || "Unable to delete video.");
    } finally {
      setSaving(false);
    }
  }

  function patchVideo(videoId, field, value) {
    setSections((prev) =>
      prev.map((section) => ({
        ...section,
        items: (section.items || []).map((item) => ({
          ...item,
          videos: (item.videos || []).map((video) =>
            video.video_id === videoId ? { ...video, [field]: value } : video
          ),
        })),
      }))
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="text-slate-300">Loading help editor…</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Help Content Admin
          </h1>
          <p className="mt-2 text-slate-300">
            Manage help sections, markdown content, and related videos.
          </p>
        </div>

        {message && (
          <div className="rounded-lg border border-emerald-700 bg-emerald-900/30 p-3 text-emerald-200">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-700 bg-red-900/30 p-3 text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-1 space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-white">Sections</h2>
                <button
                  type="button"
                  className="text-xs rounded bg-slate-700 px-2 py-1 text-white hover:bg-slate-600"
                  onClick={() => {
                    setSelectedSectionId(null);
                    setSelectedHelpId(null);
                    setSectionForm(emptySection);
                    setItemForm(emptyItem);
                  }}
                >
                  New
                </button>
              </div>

              <div className="space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.section_id}
                    type="button"
                    onClick={() => setSelectedSectionId(section.section_id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 ${selectedSectionId === section.section_id
                      ? "border-emerald-500 bg-emerald-900/20"
                      : "border-slate-700 bg-slate-800 hover:bg-slate-700"
                      }`}
                  >
                    <div className="text-sm font-medium text-white">
                      {section.title}
                    </div>
                    <div className="text-xs text-slate-400">
                      order {section.sort_order} ·{" "}
                      {section.is_active ? "active" : "inactive"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <h2 className="font-semibold text-white mb-3">Help Items</h2>

              <div className="space-y-2">
                {(selectedSection?.items || []).map((item) => (
                  <button
                    key={item.help_id}
                    type="button"
                    onClick={() => setSelectedHelpId(item.help_id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 ${selectedHelpId === item.help_id
                      ? "border-emerald-500 bg-emerald-900/20"
                      : "border-slate-700 bg-slate-800 hover:bg-slate-700"
                      }`}
                  >
                    <div className="text-sm font-medium text-white">
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-400">
                      {item.slug} · order {item.sort_order}
                    </div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className={selectedHelpId === null ? "mt-3 w-full rounded-lg bg-blue-600 px-3 text-xs text-white" : toolButtonClass}
                // className="mt-3 w-full rounded-lg border border-slate-600 px-3 py-2 text-sm text-white bg-slate-900 hover:bg-slate-800"
                onClick={() => {
                  setSelectedHelpId(null);
                  setItemForm({
                    ...emptyItem,
                    section_id: selectedSectionId || "",
                  });
                }}
              >
                New Help Item
              </button>
            </div>
          </div>

          <div className="xl:col-span-3 space-y-6">
            <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <h2 className="font-semibold text-white mb-4">
                {selectedSection ? "Edit Section" : "New Section"}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <label className="md:col-span-2 text-sm text-slate-300">
                  Title
                  <input
                    value={sectionForm.title}
                    onChange={(e) => setSectionField("title", e.target.value)}
                    className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white"
                  />
                </label>

                <label className="text-sm text-slate-300">
                  Sort Order
                  <input
                    type="number"
                    value={sectionForm.sort_order}
                    onChange={(e) =>
                      setSectionField("sort_order", e.target.value)
                    }
                    className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white"
                  />
                </label>

                <label className="flex items-end gap-2 text-sm text-slate-300 pb-2">
                  <input
                    type="checkbox"
                    checked={sectionForm.is_active}
                    onChange={(e) =>
                      setSectionField("is_active", e.target.checked)
                    }
                  />
                  Active
                </label>
              </div>

              <button
                type="button"
                disabled={saving || !sectionForm.title.trim()}
                onClick={saveSection}
                className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Section"}
              </button>
            </section>

            <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-semibold text-white">
                  {selectedItem ? "Edit Help Item" : "New Help Item"}
                </h2>

                {selectedItem && (
                  <button
                    type="button"
                    onClick={deleteItem}
                    className="rounded-lg bg-red-800 px-3 py-2 text-sm text-white hover:bg-red-700"
                  >
                    Delete Item
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <label className="text-sm text-slate-300">
                  Section
                  <select
                    value={itemForm.section_id}
                    onChange={(e) =>
                      setItemField("section_id", Number(e.target.value))
                    }
                    className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white"
                  >
                    <option value="">Select section</option>
                    {sections.map((section) => (
                      <option key={section.section_id} value={section.section_id}>
                        {section.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="md:col-span-2 text-sm text-slate-300">
                  Title
                  <input
                    value={itemForm.title}
                    onChange={(e) => setItemField("title", e.target.value)}
                    className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white"
                  />
                </label>

                <label className="text-sm text-slate-300">
                  Sort Order
                  <input
                    type="number"
                    value={itemForm.sort_order}
                    onChange={(e) => setItemField("sort_order", e.target.value)}
                    className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white"
                  />
                </label>

                <label className="md:col-span-3 text-sm text-slate-300">
                  Slug
                  <input
                    value={itemForm.slug}
                    onChange={(e) => setItemField("slug", e.target.value)}
                    placeholder="enable-mfa-webauthn"
                    className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white"
                  />
                </label>

                <label className="flex items-end gap-2 text-sm text-slate-300 pb-2">
                  <input
                    type="checkbox"
                    checked={itemForm.is_active}
                    onChange={(e) =>
                      setItemField("is_active", e.target.checked)
                    }
                  />
                  Active
                </label>

                <label className="md:col-span-4 text-sm text-slate-300">
                  Description
                  <textarea
                    value={itemForm.description}
                    onChange={(e) =>
                      setItemField("description", e.target.value)
                    }
                    rows={2}
                    className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-white"
                  />
                </label>
              </div>
              {/* 
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                <label className="text-sm text-slate-300">
                  Markdown
                  <textarea
                    value={itemForm.markdown_md}
                    onChange={(e) =>
                      setItemField("markdown_md", e.target.value)
                    }
                    rows={18}
                    className="mt-1 w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 font-mono text-sm text-white"
                  />
                </label>

                <div className="text-sm text-slate-300">
                  Preview
                  <div className="mt-1 rounded border border-slate-700 bg-slate-950 p-4 min-h-[420px] overflow-auto">
                    <div className="prose prose-invert max-w-none text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {itemForm.markdown_md || "_No markdown yet._"}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div> */}

              <div className="mt-4">
                <ForumComposer submitColor="green"
                  title="Help Markdown"
                  value={itemForm.markdown_md || ""}
                  onChange={(value) => setItemField("markdown_md", value)}
                  onSubmit={saveItem}
                  submitLabel={selectedItem ? "Save Help Item" : "Create Help Item"}
                  submittingLabel="Saving..."
                  submitting={saving}
                  submitDisabled={
                    !itemForm.section_id ||
                    !itemForm.slug.trim() ||
                    !itemForm.title.trim()
                  }
                  requireValue={false}
                  minRows={18}
                  placeholder="Write the help content in Markdown..."
                  footerNote="Markdown supported. Use headings, lists, links, quotes, tables, sections, and code."
                />
              </div>

              {/* <button
                type="button"
                disabled={
                  saving ||
                  !itemForm.section_id ||
                  !itemForm.slug.trim() ||
                  !itemForm.title.trim()
                }
                onClick={saveItem}
                className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Help Item"}
              </button> */}
            </section>

            <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <h2 className="font-semibold text-white mb-4">Videos</h2>

              {!selectedItem ? (
                <p className="text-slate-400 text-sm">
                  Save or select a help item before adding videos.
                </p>
              ) : (
                <>
                  place the existing video-row JSX with this:

                  {(selectedItem.videos || []).map((video) => (
                    <div
                      key={video.video_id}
                      className="rounded-lg border border-slate-700 bg-slate-800 p-3 space-y-3"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <input
                          value={video.video_key || ""}
                          onChange={(e) =>
                            patchVideo(video.video_id, "video_key", e.target.value)
                          }
                          className="md:col-span-5 rounded bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                          placeholder="video_key"
                        />

                        <input
                          value={video.label || ""}
                          onChange={(e) =>
                            patchVideo(video.video_id, "label", e.target.value)
                          }
                          className="md:col-span-5 rounded bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                          placeholder="Label"
                        />

                        <input
                          type="number"
                          value={video.sort_order || 0}
                          onChange={(e) =>
                            patchVideo(video.video_id, "sort_order", e.target.value)
                          }
                          className="md:col-span-2 rounded bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={!!video.is_active}
                            onChange={(e) =>
                              patchVideo(video.video_id, "is_active", e.target.checked)
                            }
                          />
                          Active
                        </label>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => previewVideo(video)}
                            className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                          >
                            {previewLoadingId === video.video_id ? "Loading…" : "Play"}
                          </button>

                          <button
                            type="button"
                            onClick={() => updateVideo(video)}
                            className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                          >
                            Save
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteVideo(video)}
                            className="rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="mt-5 rounded-lg border border-slate-700 bg-slate-800 p-3">
                    <h3 className="text-sm font-semibold text-white mb-3">
                      Upload Video
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <input
                        type="file"
                        accept="video/mp4"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="md:col-span-4 rounded bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                      />

                      <input
                        value={uploadLabel}
                        onChange={(e) => setUploadLabel(e.target.value)}
                        className="md:col-span-4 rounded bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                        placeholder="Video label"
                      />

                      <input
                        type="number"
                        value={uploadSortOrder}
                        onChange={(e) => setUploadSortOrder(e.target.value)}
                        className="md:col-span-2 rounded bg-slate-900 border border-slate-700 px-3 py-2 text-white"
                        placeholder="Sort order"
                      />

                      <button
                        type="button"
                        disabled={uploading || !uploadFile}
                        onClick={uploadVideo}
                        className="md:col-span-2 rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                      >
                        {uploading ? "Uploading…" : "Upload"}
                      </button>
                    </div>

                    <p className="mt-2 text-xs text-slate-400">
                      Uploads an MP4 into private video storage and automatically creates the video record.
                    </p>
                  </div>
                  {previewVideoUrl ? (
                    <div className="mt-5 rounded-lg border border-slate-700 bg-slate-800 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-white">
                          Preview: {previewVideoLabel}
                        </h3>

                        <button
                          type="button"
                          onClick={() => {
                            setPreviewVideoUrl("");
                            setPreviewVideoLabel("");
                          }}
                          className="rounded bg-slate-700 px-3 py-1 text-xs text-white hover:bg-slate-600"
                        >
                          Close
                        </button>
                      </div>

                      <div className="aspect-video overflow-hidden rounded bg-black">
                        <video
                          key={previewVideoUrl}
                          controls
                          preload="metadata"
                          className="h-full w-full"
                          controlsList="nodownload"
                        >
                          <source src={previewVideoUrl} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    </div>
                  ) : null}               </>
              )}
            </section>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}