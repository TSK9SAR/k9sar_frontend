// src/pages/MyProfilePage.tsx
import React, { useEffect, useState } from "react";
import PageContainer from "../components/PageContainer";
import HandlerAffiliationsCard from "../components/handler/HandlerAffiliationsCard";
import IdHeadshotModal from "../components/IdHeadshotModal";
import IdCardPrintDialog from "../components/IdCardPrintDialog";
import { PrinterIcon } from "@heroicons/react/24/outline";

function normalizeApiBase(input?: string) {
  const raw = (input ?? "").trim().replace(/\/+$/, "");
  if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
  if (!raw) return `${window.location.origin}/api`;
  if (window.location.protocol === "https:" && raw.startsWith("http://")) {
    return raw.replace(/^http:\/\//i, "https://");
  }
  return raw;
}

function cleanText(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  if (s.toLowerCase() === "string") return "";
  return s;
}

type HandlerInfo = {
  experience_level?: string | null;
  status?: string | null;
  group_affiliation?: string | null;
  notes?: string | null;
};

type Profile = {
  user_id?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;

  domicile_lat?: number | null;
  domicile_lng?: number | null;

  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  country?: string | null;

  has_handler?: boolean;
  handler_id?: number | null;
  handler?: HandlerInfo | null;
};

const EMPTY_HANDLER: HandlerInfo = { experience_level: "", status: "", group_affiliation: "", notes: "" };

export default function MyProfilePage() {
  const effectiveBaseUrl = normalizeApiBase((import.meta as any)?.env?.VITE_API_BASE_URL);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [data, setData] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [latText, setLatText] = useState("");
  const [lngText, setLngText] = useState("");

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [useLocation, setUseLocation] = useState(false);
  const [idHeadshotOpen, setIdHeadshotOpen] = useState(false);

  const [printHandlerId, setPrintHandlerId] = useState<number | null>(null);

  async function canAskForGeo(): Promise<"granted" | "prompt" | "denied" | "unknown"> {
    try {
      const p = await (navigator as any).permissions?.query?.({ name: "geolocation" });
      return p?.state ?? "unknown";
    } catch {
      return "unknown";
    }
  }


  // geolocation
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const load = async () => {
    if (!token) {
      setErr("Not authenticated.");
      return;
    }

    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const resp = await fetch(`${effectiveBaseUrl}/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.status === 401) throw new Error("Session expired. Please log in again.");
      if (!resp.ok) throw new Error(await resp.text());

      const me = (await resp.json()) as Profile;

      setData({
        ...me,
        first_name: cleanText(me.first_name),
        last_name: cleanText(me.last_name),
        email: cleanText(me.email),
        phone: cleanText(me.phone),

        address_line1: cleanText(me.address_line1),
        address_line2: cleanText(me.address_line2),
        city: cleanText(me.city),
        state_province: cleanText(me.state_province),
        postal_code: cleanText(me.postal_code),
        country: cleanText(me.country),

        handler: {
          experience_level: cleanText(me.handler?.experience_level),
          status: cleanText(me.handler?.status),
          group_affiliation: cleanText(me.handler?.group_affiliation),
          notes: cleanText(me.handler?.notes),
        },
      });

    } catch (e: any) {
      setErr(e?.message ?? "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!data) return;
    setLatText(data.domicile_lat == null ? "" : String(data.domicile_lat));
    setLngText(data.domicile_lng == null ? "" : String(data.domicile_lng));
  }, [data]);


  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveBaseUrl]);

  const updateField = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setData((prev) => (prev ? { ...prev, [k]: v } : prev));
  };

  const updateHandlerField = <K extends keyof HandlerInfo>(k: K, v: HandlerInfo[K]) => {
    setData((prev) => {
      if (!prev) return prev;
      const cur = prev.handler ?? {};
      return { ...prev, handler: { ...cur, [k]: v } };
    });
  };


  async function requestGpsLocation() {
    setGeoError(null);

    if (!("geolocation" in navigator)) {
      setGeoError("Geolocation not supported in this browser.");
      return;
    }

    const perm = await canAskForGeo();
    if (perm === "denied") {
      setGeoError("Location permission is blocked for this site. Enable it in settings, or enter it manually.");
      return;
    }

    const getPos = (opts: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, opts);
      });

    setGeoLoading(true);

    try {
      // fast iOS-friendly path
      const pos = await getPos({ enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 });

      updateField("domicile_lat", pos.coords.latitude);
      updateField("domicile_lng", pos.coords.longitude);
      setGeoLoading(false);
      return;
    } catch (err: any) {
      // optional retry
      try {
        const pos = await getPos({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });

        updateField("domicile_lat", pos.coords.latitude);
        updateField("domicile_lng", pos.coords.longitude);
        setGeoLoading(false);
        return;
      } catch (err2: any) {
        const code = err2?.code ?? err?.code;
        const msg =
          code === 1 ? "Permission denied or blocked in device settings." :
            code === 2 ? "Position unavailable (GPS/network)." :
              code === 3 ? "Location request timed out." :
                err2?.message || err?.message || "Unable to get location.";
        setGeoError(msg);
        setGeoLoading(false);
      }
    }
  }


  const save = async () => {
    if (!token || !data) return;

    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      // Send what /profile/me expects
      const payload: any = {
        first_name: data.first_name ?? "",
        last_name: data.last_name ?? "",
        phone: data.phone ?? null,

        address_line1: data.address_line1 ?? null,
        address_line2: data.address_line2 ?? null,
        city: data.city ?? null,
        state_province: data.state_province ?? null,
        postal_code: data.postal_code ?? null,
        country: data.country ?? null,

        domicile_lat: data.domicile_lat ?? null,
        domicile_lng: data.domicile_lng ?? null,
      };

      // Safer: only send handler if backend expects it / user actually has handler
      if (data.has_handler) {
        payload.handler = {
          experience_level: data.handler?.experience_level ?? null,
          status: data.handler?.status ?? null,
          group_affiliation: data.handler?.group_affiliation ?? null,
          notes: data.handler?.notes ?? null,
        };
      }

      const resp = await fetch(`${effectiveBaseUrl}/profile/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (resp.status === 401) throw new Error("Session expired. Please log in again.");
      if (!resp.ok) throw new Error(await resp.text());

      const updated = (await resp.json()) as Profile;

      // Refresh UI from server response
      setData({
        ...updated,
        handler: updated.handler ?? EMPTY_HANDLER,
      });

      setOk("Saved.");
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="p-4 text-sm text-slate-200">Loading…</div>
      </PageContainer>
    );
  }

  if (err && !data) {
    return (
      <PageContainer>
        <div className="p-4 text-sm text-red-200 bg-red-900/30 border border-red-800 rounded-xl">
          {err}
        </div>
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer>
        <div className="p-4 text-sm text-slate-200">No data.</div>
      </PageContainer>
    );
  }

  const hasHandler = (data.handler_id ?? null) !== null && (data.handler_id ?? 0) > 0;
  // or: const hasHandler = !!data.handler;  (less strict)

  return (
    <PageContainer maxWidth="2xl" className="space-y-6 py-6">
      <div className="text-left space-y-4">
        {/* Header */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h1 className="text-lg font-semibold">
            <span className="text-emerald-300">TSK9SAR</span>{" "}
            <span className="text-slate-100">My Profile</span>
          </h1>
          <div className="text-xs text-slate-300 mt-1">
            Update your account info. Handler fields are optional and only matter if you have teams.
          </div>
        </div>

        {err && (
          <div className="text-sm text-red-200 bg-red-900/30 border border-red-800 rounded-xl p-3">
            {err}
          </div>
        )}
        {ok && (
          <div className="text-sm text-emerald-200 bg-emerald-900/30 border border-emerald-800 rounded-xl p-3">
            {ok}
          </div>
        )}

        {/* Account */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-100">Account</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">First name</label>
              <input
                value={data.first_name ?? ""}
                onChange={(e) => updateField("first_name", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Last name</label>
              <input
                value={data.last_name ?? ""}
                onChange={(e) => updateField("last_name", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Email</label>
              <input
                value={data.email ?? ""}
                // readOnly
                className="w-full rounded-lg border border-slate-700 bg-slate-900/40 text-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Phone</label>
              <input
                value={data.phone ?? ""}
                onChange={(e) => updateField("phone", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Address + Location */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">Address & Location</div>
              <div className="text-xs text-slate-300">Used for distance filters and contact context.</div>
            </div>

            <button
              type="button"
              onClick={requestGpsLocation}
              disabled={geoLoading}
              className="px-3 py-1.5 rounded-full text-sm border transition-colors bg-slate-700 text-slate-100 border-slate-500 hover:border-slate-400 disabled:opacity-60"
            >
              {geoLoading ? "Locating…" : "Use my location"}
            </button>
          </div>

          {geoError && (
            <div className="text-sm text-amber-200 bg-amber-900/30 border border-amber-800 rounded-xl p-3">
              {geoError}
              <div className="text-xs text-amber-200 mt-1">Note: GPS requires HTTPS (or localhost).</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-300 mb-1">Address line 1</label>
              <input
                value={data.address_line1 ?? ""}
                onChange={(e) => updateField("address_line1", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-slate-300 mb-1">Address line 2</label>
              <input
                value={data.address_line2 ?? ""}
                onChange={(e) => updateField("address_line2", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">City</label>
              <input
                value={data.city ?? ""}
                onChange={(e) => updateField("city", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">State / Province</label>
              <input
                value={data.state_province ?? ""}
                onChange={(e) => updateField("state_province", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Postal code</label>
              <input
                value={data.postal_code ?? ""}
                onChange={(e) => updateField("postal_code", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Country</label>
              <input
                value={data.country ?? ""}
                onChange={(e) => updateField("country", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
              />
            </div>

            {data && (
              <>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Latitude</label>
                  <input
                    value={latText}
                    onChange={(e) => setLatText(e.target.value)}
                    onBlur={() => {
                      const s = latText.trim();
                      if (!s) return updateField("domicile_lat", null);
                      const n = Number(s);
                      if (Number.isFinite(n)) updateField("domicile_lat", n);
                    }}
                    inputMode="text"                 // ✅ allows minus on soft keyboard
                    pattern="-?[0-9]*[.,]?[0-9]*"     // optional hint/validation
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                    placeholder="e.g. 40.7608"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Longitude</label>
                  <input
                    value={lngText}
                    onChange={(e) => setLngText(e.target.value)}
                    onBlur={() => {
                      const s = lngText.trim();
                      if (!s) return updateField("domicile_lng", null);
                      const n = Number(s);
                      if (Number.isFinite(n)) updateField("domicile_lng", n);
                    }}
                    inputMode="text"                 // ✅ allows minus on soft keyboard
                    pattern="-?[0-9]*[.,]?[0-9]*"     // optional hint/validation
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                    placeholder="e.g. -111.8910"
                  />
                </div>
              </>
            )}


          </div>
        </div>

        {/* Handler */}
        {hasHandler && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">
                Handler profile
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIdHeadshotOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-sm border border-slate-600 bg-slate-700 text-slate-100 hover:bg-slate-600"
                >
                  Upload / Replace ID Headshot
                </button>

                <button
                  type="button"
                  onClick={() => setPrintHandlerId(data.handler_id)}
                  className="px-3 py-1.5 rounded-lg text-sm border border-blue-700 bg-blue-900/30 text-blue-200 hover:bg-blue-900/40"
                >
                  View / Print ID
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Experience level</label>
                <input
                  value={data.handler?.experience_level ?? ""}
                  onChange={(e) => updateHandlerField("experience_level", e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="handler_status" className="block text-xs text-slate-300 mb-1">
                  Handler status
                </label>
                <select
                  id="handler_status"
                  value={data.handler?.status ?? ""}
                  onChange={(e) => updateHandlerField("status", e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                >
                  <option value="">(unset)</option>
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                  <option value="retired">retired</option>
                </select>
              </div>

              {/* <div className="md:col-span-2">
                <label className="block text-xs text-slate-300 mb-1">Group Affiliation</label>
                <input
                  value={data.handler?.group_affiliation ?? ""}
                  onChange={(e) => updateHandlerField("group_affiliation", e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                />
              </div> */}

              <div className="space-y-4">
                {/* your existing profile info card(s) */}
                <HandlerAffiliationsCard />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-slate-300 mb-1">Notes</label>
                <textarea
                  value={data.handler?.notes ?? ""}
                  onChange={(e) => updateHandlerField("notes", e.target.value)}
                  className="w-full min-h-[90px] rounded-lg border border-slate-600 bg-slate-700 text-slate-100 px-3 py-2 text-sm"
                />
              </div>
              {idHeadshotOpen && data.handler_id && (
                <IdHeadshotModal
                  kind="handler"
                  entityId={data.handler_id}
                  title="Handler ID Headshot"
                  onClose={() => setIdHeadshotOpen(false)}
                />
              )}
              <IdCardPrintDialog
                open={printHandlerId !== null}
                handlerId={data.handler_id}
                title="View / Print Handler ID"
                onClose={() => setPrintHandlerId(null)}
                onPrint={(mode, slot, affiliationId) => {
                  const affiliationParam =
                    affiliationId == null ? "" : `&affiliation_id=${affiliationId}`;

                  const slotParam = mode === "sheet" ? `&slot=${slot}` : "";

                  window.open(
                    `/api/id-cards/handlers/${data.handler_id}?layout=${mode}${slotParam}${affiliationParam}`
                  );
                }}
              />
            </div>
          </div>
        )}
        {/* Save */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm border border-emerald-700 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </PageContainer>
  );
}
