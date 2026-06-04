import { useEffect, useState } from "react";
import { apiJson } from "../lib/api";

export default function ForumSettingsPage() {
  const [emailMode, setEmailMode] = useState("category_default");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiJson("/forums/me/settings")
      .then((data) => {
        setEmailMode(data?.email_mode || "category_default");
      })
      .catch(() => {});
  }, []);

  async function saveSettings() {
    setSaving(true);
    setSaved(false);

    try {
      const data = await apiJson("/forums/me/settings", {
        method: "PATCH",
        body: JSON.stringify({
          email_mode: emailMode,
        }),
      });

      setEmailMode(data?.email_mode || emailMode);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">
        Forum Email Preferences
      </h1>

      <p className="text-sm text-slate-300 mb-6">
        Choose when K9SAR should email you about forum activity.
      </p>

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <label className="block text-sm font-semibold mb-2">
          Email notifications
        </label>

        <select
          value={emailMode}
          onChange={(e) => {
            setEmailMode(e.target.value);
            setSaved(false);
          }}
          className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm"
        >
          <option value="category_default">Use forum defaults</option>
          <option value="all">Email me for all forum posts</option>
          <option value="announcements">Email me for announcements only</option>
          <option value="none">Do not email me about forums</option>
        </select>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save preferences"}
          </button>

          {saved && (
            <span className="text-sm text-emerald-300">
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}