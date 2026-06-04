import React, { useEffect, useMemo, useState } from "react";
import ForumComposer from "../../components/forums/ForumComposer";
import PageContainer from "../../components/PageContainer";
import { apiJson } from "../../lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";


type DisciplineGroup = {
  group_id: number;
  name: string;
  sortorder?: number | null;
  show_operational?: boolean; // optional, based on your schema
  show_generic?: boolean; // optional, based on your schema
};

type Discipline = {
  discipline_id: number;
  name: string;
  group_id: number | null;
  sortorder: number;
  description?: string | null; // <-- you were using this
  show_operational?: boolean; // optional, based on your schema
  show_generic?: boolean; // optional, based on your schema

};

type Standard = {
  standard_id: number;
  discipline_id: number;
  name: string;
  url?: string | null;
  summary_md?: string | null;
  effective_date?: string | null; // ISO date
  effective_days?: number | null;
  incomplete_days?: number | null;
  multipart_requirement_mode?: MultipartRequirementMode;
};

type MultipartRequirementMode = "never" | "always" | "first_cert_only";

const inputClass =
  "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500";
const buttonClass =
  "rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-100 hover:bg-slate-700";
const dangerButtonClass =
  "rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-red-100 hover:bg-red-900/50";

const tabClass = (active: boolean) =>
  [
    "px-4 py-2 rounded-lg border transition-colors",
    active
      ? "bg-slate-700 border-slate-500 text-slate-100"
      : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800",
  ].join(" ");

type TabKey = "groups" | "disciplines" | "standards" | "dues";


// Toggle these depending on what routes you have implemented
const ENABLE_DISCIPLINE_EDIT_DELETE = true; // your pasted backend only has GET+POST
const ENABLE_STANDARD_DELETE = false;        // your pasted backend has no DELETE

export default function AdminConfigPage() {
  const [tab, setTab] = useState<TabKey>("groups");

  const [gateLoading, setGateLoading] = useState(true);
  const [gateOk, setGateOk] = useState(false);

  const [groups, setGroups] = useState<DisciplineGroup[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters: null means "All" / "None selected"
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<number | null>(null);

  // ---- GROUP FORM ----
  const [groupForm, setGroupForm] = useState<Partial<DisciplineGroup>>({});
  const groupEditing = typeof groupForm.group_id === "number";

  // ---- DISCIPLINE FORM ----
  const [disciplineForm, setDisciplineForm] = useState<Partial<Discipline>>({});
  const disciplineEditing = typeof disciplineForm.discipline_id === "number";

  // ---- STANDARD FORM ----
  const [standardForm, setStandardForm] = useState<Partial<Standard>>({});
  const standardEditing = typeof standardForm.standard_id === "number";

  const visibleStandards = useMemo(() => {
    const did = Number(selectedDisciplineId);           // adapt name
    if (!did) return standards;                         // "All" selected
    return standards.filter((s) => Number(s.discipline_id) === did);
  }, [standards, selectedDisciplineId]);

  const [duesAmount, setDuesAmount] = useState("");
  const [duesSaving, setDuesSaving] = useState(false);
  const [duesLoading, setDuesLoading] = useState(false);


  const fileRef = React.useRef<HTMLInputElement | null>(null);

  function openPicker() {
    fileRef.current?.click();
  }

  async function loadDuesSettings() {
    setDuesLoading(true);
    try {
      const data = await apiJson("/admin/handlers/settings/dues", { authRequired: true, mfaRequired: true });
      setDuesAmount(
        data?.annual_handler_dues_amount != null
          ? String(data.annual_handler_dues_amount)
          : "20.00"
      );
    } catch (e) {
      console.error("Failed to load dues settings", e);
    } finally {
      setDuesLoading(false);
    }
  }


  async function saveDuesSettings() {
    setDuesSaving(true);
    try {
      const data = await apiJson("/admin/handlers/settings/update-dues", {
        method: "PUT",
        body: JSON.stringify({
          annual_handler_dues_amount: Number(duesAmount),
        }),
      });

      setDuesAmount(
        data?.annual_handler_dues_amount != null
          ? String(data.annual_handler_dues_amount)
          : duesAmount
      );
    } catch (e) {
      console.error("Failed to save dues settings", e);
    } finally {
      setDuesSaving(false);
    }
  }

  async function handleStandardUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!standardForm.standard_id) throw new Error("No standard selected.");

      const fd = new FormData();
      fd.append("file", file);
      fd.append("standard_id", String(standardForm.standard_id)); // critical

      const up = await apiJson("/documents/upload", { method: "POST", body: fd });

      const url = up?.download_url;
      if (!url) throw new Error("Upload did not return download_url");

      // update local form
      if (up?.download_url) setStandardForm((p) => ({ ...p, url: up.download_url }));

      // persist to backend (PUT/PATCH based on your API)
      await apiJson(`/standards/${standardForm.standard_id}`, {
        method: "PUT",
        body: JSON.stringify({ url }),
      });
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const groupMap = useMemo(() => {
    const m = new Map<number, DisciplineGroup>();
    groups.forEach((g) => m.set(g.group_id, g));
    return m;
  }, [groups]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      // Disciplines (your GET is public in pasted routes)
      const d = await apiJson("/disciplines/", { authRequired: true, mfaRequired: true });
      setDisciplines(
        (d ?? []).slice().sort((a: Discipline, b: Discipline) => {
          const ao = a.sortorder ?? 100;
          const bo = b.sortorder ?? 100;
          if (ao !== bo) return ao - bo;
          return (a.name ?? "").localeCompare(b.name ?? "");
        })
      );

      // Discipline-groups (admin-protected)
      try {
        const g = await apiJson("/discipline-groups/", { authRequired: true, mfaRequired: true });
        setGroups(
          (g ?? []).slice().sort((a: DisciplineGroup, b: DisciplineGroup) => {
            const ao = a.sortorder ?? 100;
            const bo = b.sortorder ?? 100;
            if (ao !== bo) return ao - bo;
            return (a.name ?? "").localeCompare(b.name ?? "");
          })
        );
      } catch (e: any) {
        setGroups([]);
        setError(`Discipline groups failed (admin/auth/CORS likely): ${e?.message ?? e}`);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load config");
    } finally {
      setLoading(false);
    }
  }

  async function loadStandardsForDiscipline(disciplineId: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson(`/standards/?discipline_id=${disciplineId}`, { authRequired: true, mfaRequired: true });
      const sorted = (res ?? []).slice().sort((a: Standard, b: Standard) =>
        (b.effective_date ?? "").localeCompare(a.effective_date ?? "")
      );
      setStandards(sorted);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load standards");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "dues") {
      loadDuesSettings();
    }
  }, [tab]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setGateLoading(true);
        setError(null);

        // ✅ admin + MFA gate
        await apiJson("/admin/canary", { authRequired: true, mfaRequired: true });

        if (!alive) return;
        setGateOk(true);

        // ✅ now safe to load the page data
        await loadAll();
      } catch (e: any) {
        // if (!alive) return;
        setGateOk(false);

        // show a clean error (don’t spam the table with partial admin calls)
        setError(e?.message ?? "Admin access (with MFA) is required.");
      } finally {
        if (!alive) return;
        setGateLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab !== "standards") return;
    if (selectedDisciplineId == null) {
      setStandards([]);
      return;
    }
    loadStandardsForDiscipline(selectedDisciplineId);
  }, [tab, selectedDisciplineId]);

  // ------- CRUD: Groups -------
  async function saveGroup() {
    setError(null);
    try {
      const payload: any = {
        name: groupForm.name?.trim(),
        show_operational: groupForm.show_operational ?? true,
        show_generic: groupForm.show_generic ?? false,
      };

      if (groupForm.sortorder !== undefined && groupForm.sortorder !== null) {
        payload.sortorder = groupForm.sortorder;
      }

      if (!payload.name) throw new Error("Group name is required");

      if (groupEditing) {
        await apiJson(`/discipline-groups/${groupForm.group_id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiJson(`/discipline-groups/`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setGroupForm({});
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save group");
    }
  }

  async function deleteGroup(groupId: number) {
    if (!confirm("Delete this discipline group?")) return;
    setError(null);
    try {
      await apiJson(`/discipline-groups/${groupId}`, { method: "DELETE" });
      if (selectedGroupId === groupId) setSelectedGroupId(null);
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete group");
    }
  }

  // ------- CRUD: Disciplines -------
  async function saveDiscipline() {
    setError(null);
    try {
      const payload: any = {
        name: disciplineForm.name?.trim(),
        group_id: disciplineForm.group_id ?? null,
        sortorder: disciplineForm.sortorder ?? 100,
        description: disciplineForm.description?.trim() ?? null,
        show_operational: disciplineForm.show_operational ?? true,
        show_generic: disciplineForm.show_generic ?? false,
      };
      if (!payload.name) throw new Error("Discipline name is required");

      if (disciplineEditing && ENABLE_DISCIPLINE_EDIT_DELETE) {
        await apiJson(`/disciplines/${disciplineForm.discipline_id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiJson(`/disciplines/`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setDisciplineForm({});
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save discipline");
    }
  }

  async function deleteDiscipline(disciplineId: number) {
    if (!confirm("Delete this discipline?")) return;
    setError(null);
    try {
      await apiJson(`/disciplines/${disciplineId}`, { method: "DELETE" });
      if (selectedDisciplineId === disciplineId) setSelectedDisciplineId(null);
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete discipline");
    }
  }

  // ------- CRUD: Standards -------
  async function saveStandard() {
    setError(null);
    try {
      if (!standardForm.name?.trim()) throw new Error("Standard name is required");
      if (!standardForm.standard_id && !selectedDisciplineId) throw new Error("Select a discipline first");
      const cleanedEffectiveDays = standardForm.effective_days ?? null;
      const cleanedIncompleteDays = standardForm.incomplete_days ?? null;

      // CREATE: discipline_id required
      if (!standardEditing) {
        const payload: any = {
          discipline_id: selectedDisciplineId!,
          name: standardForm.name.trim(),
          summary_md: (standardForm.summary_md ?? "").trim() || null,
          effective_days: cleanedEffectiveDays,
          incomplete_days: cleanedIncompleteDays,
          multipart_requirement_mode: standardForm.multipart_requirement_mode ?? "never",
        };

        if (standardForm.effective_date) payload.effective_date = standardForm.effective_date;

        await apiJson(`/standards/`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setStandardForm({});
        await loadStandardsForDiscipline(selectedDisciplineId!);
        return;
      }

      // EDIT: do NOT send discipline_id
      const updatePayload: any = {
        name: standardForm.name.trim(),
        summary_md: (standardForm.summary_md ?? "").trim() || null,
        effective_days: cleanedEffectiveDays,
        incomplete_days: cleanedIncompleteDays,
        multipart_requirement_mode: standardForm.multipart_requirement_mode ?? "never",
      };

      if (standardForm.effective_date) {
        updatePayload.effective_date = standardForm.effective_date;
      } else {
        updatePayload.effective_date = null;
      }

      await apiJson(`/standards/${standardForm.standard_id}`, {
        method: "PUT",
        body: JSON.stringify(updatePayload),
      });

      const did = standardForm.discipline_id ?? selectedDisciplineId;
      if (did) await loadStandardsForDiscipline(did);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save standard");
    }
  }


  async function deleteStandard(standardId: number, disciplineId: number) {
    if (!confirm("Delete this standard?")) return;
    setError(null);
    try {
      await apiJson(`/standards/${standardId}`, { method: "DELETE" });
      await loadStandardsForDiscipline(disciplineId);
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete standard");
    }
  }

  const filteredDisciplines = useMemo(() => {
    if (selectedGroupId == null) return disciplines;
    return disciplines.filter((d) => d.group_id === selectedGroupId);
  }, [disciplines, selectedGroupId]);

  return (
    <PageContainer maxWidth="2xl" className="space-y-6 py-6">
      <div className="text-left space-y-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h1 className="text-lg font-semibold">
            <span className="text-emerald-300">TSK9SAR</span>{" "}
            <span className="text-slate-100">Admin Configuration</span>
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className={tabClass(tab === "groups")} onClick={() => setTab("groups")}>
            Discipline Groups
          </button>
          <button className={tabClass(tab === "disciplines")} onClick={() => setTab("disciplines")}>
            Disciplines
          </button>
          <button className={tabClass(tab === "standards")} onClick={() => setTab("standards")}>
            Standards
          </button>
          <button className={tabClass(tab === "dues")} onClick={() => setTab("dues")}>
            Dues
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-700 bg-red-900/30 p-3 text-red-100">{error}</div>
        )}
        {loading && <div className="text-slate-300">Loading…</div>}

        {/* GROUPS TAB */}
        {tab === "groups" && (
          <section className="space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-semibold text-slate-100">
                {groupEditing ? "Edit Group" : "Create Group"}
              </h2>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-300">Name</label>
                  <input
                    className={inputClass}
                    value={groupForm.name ?? ""}
                    onChange={(e) => setGroupForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-300">Sort order</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={groupForm.sortorder ?? ""}
                    onChange={(e) =>
                      setGroupForm((p) => ({
                        ...p,
                        sortorder: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  />
                  {/* <div className="mt-1 text-xs text-slate-400">
                    Note: this only saves if your DisciplineGroupCreate/Update includes sortorder.
                  </div> */}
                </div>
                <div className="flex items-end gap-6">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={groupForm.show_operational ?? true}
                      onChange={(e) =>
                        setGroupForm((p) => ({ ...p, show_operational: e.target.checked }))
                      }
                    />
                    Show operational
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={groupForm.show_generic ?? false}
                      onChange={(e) =>
                        setGroupForm((p) => ({ ...p, show_generic: e.target.checked }))
                      }
                    />
                    Show generic
                  </label>
                </div>
                <div className="flex items-end gap-2">
                  <button className={buttonClass} onClick={saveGroup}>
                    {groupEditing ? "Save" : "Create"}
                  </button>
                  <button className={buttonClass} onClick={() => setGroupForm({})}>
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-semibold text-slate-100">Groups</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-slate-300">
                      <th className="border-b border-slate-700 p-2">Name</th>
                      <th className="border-b border-slate-700 p-2">Sort</th>
                      <th className="border-b border-slate-700 p-2">Operational</th>
                      <th className="border-b border-slate-700 p-2">Generic</th>
                      <th className="border-b border-slate-700 p-2 w-48">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.group_id} className="text-slate-100">
                        <td className="border-b border-slate-800 p-2">{g.name}</td>
                        <td className="border-b border-slate-800 p-2">{g.sortorder ?? ""}</td>
                        <td className="border-b border-slate-800 p-2">{g.show_operational ? "Yes" : "No"}</td>
                        <td className="border-b border-slate-800 p-2">{g.show_generic ? "Yes" : "No"}</td>
                        <td className="border-b border-slate-800 p-2">
                          <div className="flex gap-2">
                            <button className={buttonClass} onClick={() => setGroupForm({ ...g })}>
                              Edit
                            </button>
                            <button className={dangerButtonClass} onClick={() => deleteGroup(g.group_id)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {groups.length === 0 && (
                      <tr>
                        <td className="p-2 text-slate-400" colSpan={3}>
                          No groups available (or you are not admin / token missing).
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* DISCIPLINES TAB */}
        {tab === "disciplines" && (
          <section className="space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-semibold text-slate-100">
                {(disciplineEditing && ENABLE_DISCIPLINE_EDIT_DELETE) ? "Edit Discipline" : "Create Discipline"}
              </h2>

              <div className="grid gap-3 md:grid-cols-5">
                <div>
                  <label className="mb-1 block text-sm text-slate-300">Group</label>
                  <select
                    className={inputClass}
                    value={disciplineForm.group_id ?? ""}
                    onChange={(e) =>
                      setDisciplineForm((p) => ({
                        ...p,
                        group_id: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  >
                    <option value="">(None)</option>
                    {groups.map((g) => (
                      <option key={g.group_id} value={g.group_id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-slate-300">Name</label>
                  <input
                    className={inputClass}
                    value={disciplineForm.name ?? ""}
                    onChange={(e) => setDisciplineForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-300">Sort</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={disciplineForm.sortorder ?? 100}
                    onChange={(e) => setDisciplineForm((p) => ({ ...p, sortorder: Number(e.target.value) }))}
                  />
                </div>

                <div className="md:col-span-5">
                  <label className="mb-1 block text-sm text-slate-300">Description</label>
                  <input
                    className={inputClass}
                    value={disciplineForm.description ?? ""}
                    onChange={(e) => setDisciplineForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="flex items-end gap-6 md:col-span-5">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={disciplineForm.show_operational ?? true}
                      onChange={(e) =>
                        setDisciplineForm((p) => ({ ...p, show_operational: e.target.checked }))
                      }
                    />
                    Show operational
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={disciplineForm.show_generic ?? false}
                      onChange={(e) =>
                        setDisciplineForm((p) => ({ ...p, show_generic: e.target.checked }))
                      }
                    />
                    Show generic
                  </label>
                </div>
                <div className="flex items-end gap-2 md:col-span-5">
                  <button className={buttonClass} onClick={saveDiscipline}>
                    {(disciplineEditing && ENABLE_DISCIPLINE_EDIT_DELETE) ? "Save" : "Create"}
                  </button>
                  <button className={buttonClass} onClick={() => setDisciplineForm({})}>
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
              <div className="min-w-[220px]">
                <label className="mb-1 block text-sm text-slate-300">Filter by group</label>
                <select
                  className={inputClass}
                  value={selectedGroupId ?? ""}
                  onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">(All)</option>
                  {groups.map((g) => (
                    <option key={g.group_id} value={g.group_id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-slate-300">
                      <th className="border-b border-slate-700 p-2">Discipline</th>
                      <th className="border-b border-slate-700 p-2">Group</th>
                      <th className="border-b border-slate-700 p-2">Sort</th>
                      <th className="border-b border-slate-700 p-2">Operational</th>
                      <th className="border-b border-slate-700 p-2">Generic</th>
                      <th className="border-b border-slate-700 p-2">Description</th>
                      <th className="border-b border-slate-700 p-2 w-48">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDisciplines.map((d) => (
                      <tr key={d.discipline_id} className="text-slate-100">
                        <td className="border-b border-slate-800 p-2">{d.name}</td>
                        <td className="border-b border-slate-800 p-2">
                          {d.group_id != null ? (groupMap.get(d.group_id)?.name ?? "") : ""}
                        </td>
                        <td className="border-b border-slate-800 p-2">{d.sortorder ?? ""}</td>
                        <td className="border-b border-slate-800 p-2">{d.show_operational ? "Yes" : "No"}</td>
                        <td className="border-b border-slate-800 p-2">{d.show_generic ? "Yes" : "No"}</td>
                        <td className="border-b border-slate-800 p-2">{d.description ?? ""}</td>
                        <td className="border-b border-slate-800 p-2">
                          {ENABLE_DISCIPLINE_EDIT_DELETE ? (
                            <div className="flex gap-2">
                              <button className={buttonClass} onClick={() => setDisciplineForm({ ...d })}>
                                Edit
                              </button>
                              <button className={dangerButtonClass} onClick={() => deleteDiscipline(d.discipline_id)}>
                                Delete
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredDisciplines.length === 0 && (
                      <tr>
                        <td className="p-2 text-slate-400" colSpan={7}>
                          No disciplines match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {!ENABLE_DISCIPLINE_EDIT_DELETE && (
                <div className="text-xs text-slate-400">
                  Note: Discipline edit/delete is disabled until backend exposes PUT/DELETE /disciplines/{`{id}`}.
                </div>
              )}
            </div>
          </section>
        )}

        {/* STANDARDS TAB */}
        {tab === "standards" && (
          <section className="space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-semibold text-slate-100">
                {standardEditing ? "Edit Standard" : "Create Standard"}
              </h2>

              <div className="grid gap-3 md:grid-cols-5">
                <div>
                  <label className="mb-1 block text-sm text-slate-300">Discipline</label>
                  <select
                    className={inputClass + (standardEditing ? " opacity-60 cursor-not-allowed" : "")}
                    disabled={standardEditing}
                    value={(standardForm.discipline_id ?? selectedDisciplineId ?? "") as any}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : null;
                      setSelectedDisciplineId(id);

                      // Only set discipline_id for CREATE
                      if (!standardEditing) {
                        setStandardForm((p) => ({ ...p, discipline_id: id ?? undefined }));
                      }
                    }}
                  >
                    <option value="">(Select discipline)</option>
                    {disciplines.map((d) => (
                      <option key={d.discipline_id} value={d.discipline_id}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-300">Effective date</label>
                  <input
                    className={inputClass}
                    type="date"
                    value={standardForm.effective_date ?? ""}
                    onChange={(e) => setStandardForm((p) => ({ ...p, effective_date: e.target.value }))}
                  />
                  <div className="mt-1 text-xs text-slate-400">Leave blank to default to today.</div>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-300">Effective days</label>
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    value={standardForm.effective_days ?? ""}
                    onChange={(e) =>
                      setStandardForm((p) => ({
                        ...p,
                        effective_days: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  />
                  <div className="mt-1 text-xs text-slate-400">
                    Number of days certification remains effective.
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-300">Incomplete days</label>
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    value={standardForm.incomplete_days ?? ""}
                    onChange={(e) =>
                      setStandardForm((p) => ({
                        ...p,
                        incomplete_days: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  />
                  <div className="mt-1 text-xs text-slate-400">
                    Number of days allowed for incomplete/pending follow-up.
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-300">
                    Multipart requirement
                  </label>
                  <select
                    className={inputClass}
                    value={standardForm.multipart_requirement_mode ?? "never"}
                    onChange={(e) =>
                      setStandardForm((p) => ({
                        ...p,
                        multipart_requirement_mode: e.target.value as MultipartRequirementMode,
                      }))
                    }
                  >
                    <option value="never">Never — single part evaluation</option>
                    <option value="always">Always — multipart required</option>
                    <option value="first_cert_only">First certification only</option>
                  </select>
                  <div className="mt-1 text-xs text-slate-400">
                    Controls when the evaluation-complete checkbox is shown.
                  </div>
                </div>

                {/* second row: name + document */}
                <div className="md:col-span-4">
                  <label className="mb-1 block text-sm text-slate-300">Name</label>
                  <input
                    className={inputClass}
                    value={standardForm.name ?? ""}
                    onChange={(e) =>
                      setStandardForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-300">
                    Standard Document
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={!standardForm.url}
                      onClick={() => window.open(standardForm.url, "_blank")}
                    >
                      View
                    </button>

                    <button
                      type="button"
                      className={buttonClass}
                      onClick={openPicker}
                    >
                      Upload
                    </button>
                  </div>

                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.txt"
                    hidden
                    onChange={handleStandardUpload}
                  />
                </div>



                <div className="md:col-span-5">


                  <label className="mt-3 mb-1 block text-sm text-slate-300">
                    Summary (Markdown)
                  </label>

                  <ForumComposer
                    footerNote="Supports Markdown: headings, lists, bold, links, quotes, tables, and code."
                    minRows={8}
                    onChange={(value) =>
                      setStandardForm((p) => ({
                        ...p,
                        summary_md: value,
                      }))
                    }
                    onSubmit={saveStandard}
                    placeholder="Write the standard summary..."
                    requireValue={false}
                    submitDisabled={!standardForm.name?.trim()}
                    submitLabel={standardEditing ? "Save Standard" : "Create Standard"}
                    submittingLabel={standardEditing ? "Saving..." : "Creating..."}
                    title="Summary"
                    value={standardForm.summary_md ?? ""}
                  />

                  <div className="hidden grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Editor */}
                    <textarea
                      className={inputClass + " min-h-[160px] resize-y font-mono text-sm"}
                      value={standardForm.summary_md ?? ""}
                      onChange={(e) =>
                        setStandardForm((p) => ({
                          ...p,
                          summary_md: e.target.value,
                        }))
                      }
                      placeholder="Write Markdown..."
                    />

                    {/* Preview */}
                    <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 overflow-auto">
                      {standardForm.summary_md ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: (props) => (
                              <p className="mb-4 leading-relaxed text-slate-200">
                                {props.children}
                              </p>
                            ),
                            ul: (props) => (
                              <ul className="mb-4 ml-6 list-disc space-y-1 text-slate-200">
                                {props.children}
                              </ul>
                            ),
                            ol: (props) => (
                              <ol className="mb-4 ml-6 list-decimal space-y-1 text-slate-200">
                                {props.children}
                              </ol>
                            ),
                            h2: (props) => (
                              <h2 className="mt-6 mb-3 text-xl font-semibold text-white">
                                {props.children}
                              </h2>
                            ),
                            h3: (props) => (
                              <h3 className="mt-5 mb-2 text-lg font-semibold text-white">
                                {props.children}
                              </h3>
                            ),
                            strong: (props) => (
                              <strong className="font-semibold text-white">
                                {props.children}
                              </strong>
                            ),
                          }}
                        >
                          {standardForm.summary_md}
                        </ReactMarkdown>
                      ) : (
                        <span className="text-slate-500">Preview will appear here…</span>
                      )}
                    </div>
                  </div>

                  <div className="hidden mt-2 text-xs text-slate-400">
                    Supports Markdown: headings (#), lists (-), bold (**text**), and links.
                  </div>
                </div>


                <div className="flex items-end gap-2 md:col-span-4">
                  <button className={buttonClass} onClick={() => setStandardForm({})}>
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
              <div className="min-w-[260px]">
                <label className="mb-1 block text-sm text-slate-300">Discipline</label>
                <select
                  className={inputClass}
                  value={selectedDisciplineId ?? ""}
                  onChange={(e) => setSelectedDisciplineId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">(Select discipline)</option>
                  {disciplines.map((d) => (
                    <option key={d.discipline_id} value={d.discipline_id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedDisciplineId == null ? (
                <div className="text-slate-400">Select a discipline to view its standards.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="text-left text-slate-300">
                        <th className="border-b border-slate-700 p-2">Standard</th>
                        <th className="border-b border-slate-700 p-2">Summary</th>
                        <th className="border-b border-slate-700 p-2">Effective date</th>
                        <th className="border-b border-slate-700 p-2">Effective days</th>
                        <th className="border-b border-slate-700 p-2">Incomplete days</th>
                        <th className="border-b border-slate-700 p-2">URL</th>
                        <th className="border-b border-slate-700 p-2 w-48">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleStandards.map((s) => (
                        <tr key={s.standard_id} className="text-slate-100">
                          <td className="border-b border-slate-800 p-2">{s.name}</td>
                          <td className="border-b border-slate-800 p-2">
                            {s.summary_md ? (
                              <span className="text-slate-200">
                                {s.summary_md.length > 80 ? s.summary_md.slice(0, 80) + "…" : s.summary_md}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>

                          <td className="border-b border-slate-800 p-2 whitespace-nowrap">{s.effective_date ?? "—"}</td>
                          <td className="border-b border-slate-800 p-2">{s.effective_days ?? "—"}</td>
                          <td className="border-b border-slate-800 p-2">{s.incomplete_days ?? "—"}</td>
                          <td className="border-b border-slate-800 p-2">
                            {s.url ? (
                              <a className="text-sky-300 hover:underline" href={s.url} target="_blank" rel="noreferrer">
                                Link
                              </a>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="border-b border-slate-800 p-2">
                            <div className="flex gap-2">
                              <button className={buttonClass} onClick={() => setStandardForm({ ...s })}>
                                Edit
                              </button>
                              {ENABLE_STANDARD_DELETE ? (
                                <button
                                  className={dangerButtonClass}
                                  onClick={() => deleteStandard(s.standard_id, s.discipline_id)}
                                >
                                  Delete
                                </button>
                              ) : (
                                <span className="text-slate-500 self-center">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {visibleStandards.length === 0 && (
                        <tr>
                          <td className="p-2 text-slate-400" colSpan={5}>
                            No standards for this discipline yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {!ENABLE_STANDARD_DELETE && (
                <div className="text-xs text-slate-400">
                  Note: Standard delete is disabled until backend exposes DELETE /standards/{`{id}`}.
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "dues" && (
          <section className="rounded-lg border border-slate-700 bg-slate-800 p-4">
            <h3 className="text-sm font-semibold text-slate-100">Dues Settings</h3>

            <div className="mt-3 max-w-xs">
              <label className="mb-1 block text-sm text-slate-300">
                Annual handler dues amount
              </label>
              <input
                className={inputClass}
                type="number"
                step="0.01"
                min="0"
                value={duesAmount}
                onChange={(e) => setDuesAmount(e.target.value)}
              />
              <div className="mt-1 text-xs text-slate-400">
                Used as the default amount for newly created dues records.
              </div>
            </div>

            <div className="mt-3">
              <button
                className="rounded bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-60"
                onClick={saveDuesSettings}
                disabled={duesSaving || duesLoading}
              >
                {duesSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </section>
        )}

      </div>
    </PageContainer >
  );
}
