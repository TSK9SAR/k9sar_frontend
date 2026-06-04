import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";

/** -------- helpers: canvas crop -> Blob (PNG) -------- */

function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.crossOrigin = "anonymous";
        img.src = url;
    });
}

function getRadianAngle(deg: number) {
    return (deg * Math.PI) / 180;
}

function rotateSize(width: number, height: number, rotation: number) {
    const rotRad = getRadianAngle(rotation);
    return {
        width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
        height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
    };
}

async function removePaperBackground(
    pngBlob: Blob,
    opts?: {
        bgLumaMin?: number;
        inkLumaMax?: number;
        softness?: number;
    }
): Promise<Blob> {
    const bgLumaMin = opts?.bgLumaMin ?? 200;
    const inkLumaMax = opts?.inkLumaMax ?? 170;
    const softness = opts?.softness ?? 30;

    const url = URL.createObjectURL(pngBlob);
    try {
        const img = await createImage(url);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not supported");

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;

        const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

        for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
            if (a === 0) continue;

            const y = luma(r, g, b);

            if (y <= inkLumaMax) {
                d[i + 3] = 255;
                continue;
            }

            if (y >= bgLumaMin) {
                d[i + 3] = 0;
                continue;
            }

            const t = (y - inkLumaMax) / Math.max(1, bgLumaMin - inkLumaMax);
            const alpha = Math.round(255 * (1 - t));

            const s = Math.min(1, Math.max(0, softness / 80));
            const eased = Math.round(alpha * (1 - s) + (alpha > 128 ? 255 : 0) * s);

            d[i + 3] = eased;
        }

        ctx.putImageData(imageData, 0, 0);

        return new Promise((resolve, reject) => {
            canvas.toBlob((out) => (out ? resolve(out) : reject(new Error("Failed to export PNG"))), "image/png");
        });
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function getCroppedPngBlob(
    imageSrc: string,
    crop: Area,
    rotation = 0
): Promise<Blob> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    const rotSize = rotateSize(image.width, image.height, rotation);
    canvas.width = Math.round(rotSize.width);
    canvas.height = Math.round(rotSize.height);

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(getRadianAngle(rotation));
    ctx.translate(-image.width / 2, -image.height / 2);
    ctx.drawImage(image, 0, 0);

    const out = document.createElement("canvas");
    const octx = out.getContext("2d");
    if (!octx) throw new Error("Canvas not supported");

    out.width = Math.round(crop.width);
    out.height = Math.round(crop.height);

    octx.drawImage(
        canvas,
        Math.round(crop.x),
        Math.round(crop.y),
        Math.round(crop.width),
        Math.round(crop.height),
        0,
        0,
        Math.round(crop.width),
        Math.round(crop.height)
    );

    return new Promise((resolve, reject) => {
        out.toBlob((blob) => {
            if (!blob) return reject(new Error("Failed to export PNG"));
            resolve(blob);
        }, "image/png");
    });
}

/** -------- URL + cache bust helpers -------- */

function toAbsoluteUrl(pathOrUrl: string): string {
    const s = String(pathOrUrl || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/")) return `${window.location.origin}${s}`;
    return `${window.location.origin}/${s}`;
}

function cacheBust(url: string, v: string) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${encodeURIComponent(v)}`;
}

/** -------- API helpers -------- */

async function apiGetJson(path: string): Promise<any> {
    const token = localStorage.getItem("token");
    const res = await fetch(path, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const text = await res.text();
    let data: any = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        // ignore
    }
    if (!res.ok) {
        const msg = data?.detail || text || `Request failed (${res.status})`;
        throw new Error(msg);
    }
    return data;
}

async function uploadSignature(blob: Blob): Promise<any> {
    const token = localStorage.getItem("token");
    const fd = new FormData();
    fd.append("file", blob, "signature.png");

    const res = await fetch("/api/me/signature", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
    });

    const text = await res.text();
    let data: any = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        // ignore
    }

    if (!res.ok) {
        const msg = data?.detail || text || `Upload failed (${res.status})`;
        throw new Error(msg);
    }
    return data;
}

/** -------- Component -------- */

export default function SignatureUpload() {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [src, setSrc] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>("");

    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<string>("");
    const [err, setErr] = useState<string>("");

    const [removeBg, setRemoveBg] = useState(true);
    const [bgLumaMin, setBgLumaMin] = useState(215);
    const [inkLumaMax, setInkLumaMax] = useState(175);

    const [currentSigUrl, setCurrentSigUrl] = useState<string | null>(null);
    const [cap, setCap] = useState<{ allowed: boolean; reason?: string | null } | null>(null);

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const previewReqRef = useRef(0);

    const [mobileStep, setMobileStep] = useState<"crop" | "cleanup">("crop");

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 767px)");
        const update = () => setIsMobile(mq.matches);
        update();

        if (mq.addEventListener) mq.addEventListener("change", update);
        else mq.addListener(update);

        return () => {
            if (mq.removeEventListener) mq.removeEventListener("change", update);
            else mq.removeListener(update);
        };
    }, []);

    useEffect(() => {
        apiGetJson("/api/me/signature/capabilities")
            .then(setCap)
            .catch(() => setCap({ allowed: false, reason: "Unable to determine permissions." }));
    }, []);

    const blocked = cap && !cap.allowed;

    const setSignatureFromApi = useCallback((data: any) => {
        const raw = data?.signature_url ? String(data.signature_url) : "";
        if (!raw) {
            setCurrentSigUrl(null);
            return;
        }
        const abs = toAbsoluteUrl(raw);

        const v =
            (data?.signature_hash && String(data.signature_hash)) ||
            (data?.signature_updated_at && String(data.signature_updated_at)) ||
            String(Date.now());

        setCurrentSigUrl(cacheBust(abs, v));
    }, []);

    const fetchMySignature = useCallback(async () => {
        const data = await apiGetJson("/api/me/signature");
        setSignatureFromApi(data);
    }, [setSignatureFromApi]);

    useEffect(() => {
        fetchMySignature().catch(() => {
            // ignore
        });
    }, [fetchMySignature]);

    const closeModal = useCallback(() => {
        setErr("");
        setMsg("");
        setMobileStep("crop");
        setRotation(0);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
        setCroppedAreaPixels(null);

        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);

        if (src) URL.revokeObjectURL(src);
        setSrc(null);
        setFileName("");

        if (fileInputRef.current) fileInputRef.current.value = "";
    }, [src, previewUrl]);

    const onCropAreaChange = useCallback((_area: Area, areaPixels: Area) => {
        setCroppedAreaPixels(areaPixels);
    }, []);

    const onPickFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setErr("");
        setMsg("");
        setMobileStep("crop");

        const f = e.target.files?.[0];
        if (!f) return;

        if (!/^image\//i.test(f.type)) {
            setErr("Please choose an image file.");
            return;
        }

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }

        const url = URL.createObjectURL(f);
        setSrc(url);
        setFileName(f.name || "image");

        setRemoveBg(true);
        setBgLumaMin(215);
        setInkLumaMax(175);
        setRotation(0);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
        setCroppedAreaPixels(null);
    }, [previewUrl]);

    const canSave = useMemo(
        () => !!src && !!croppedAreaPixels && !saving,
        [src, croppedAreaPixels, saving]
    );

    useEffect(() => {
        let cancelled = false;
        const reqId = ++previewReqRef.current;

        async function buildPreview() {
            if (!src || !croppedAreaPixels) {
                setPreviewUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return null;
                });
                return;
            }

            try {
                let blob = await getCroppedPngBlob(src, croppedAreaPixels, rotation);

                if (removeBg) {
                    blob = await removePaperBackground(blob, {
                        bgLumaMin,
                        inkLumaMax,
                        softness: 25,
                    });
                }

                if (cancelled || reqId !== previewReqRef.current) return;

                const nextUrl = URL.createObjectURL(blob);

                setPreviewUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return nextUrl;
                });
            } catch {
                // ignore preview failures
            }
        }

        const t = window.setTimeout(buildPreview, 10);

        return () => {
            cancelled = true;
            window.clearTimeout(t);
        };
    }, [src, croppedAreaPixels, zoom, rotation, removeBg, bgLumaMin, inkLumaMax]);

    const onSave = useCallback(async () => {
        if (!src || !croppedAreaPixels) return;

        setSaving(true);
        setErr("");
        setMsg("");

        try {
            let blob = await getCroppedPngBlob(src, croppedAreaPixels, rotation);

            if (removeBg) {
                blob = await removePaperBackground(blob, {
                    bgLumaMin,
                    inkLumaMax,
                    softness: 25,
                });
            }

            const data = await uploadSignature(blob);
            setSignatureFromApi(data);

            setMsg("Signature saved.");
            closeModal();
        } catch (e: any) {
            setErr(e?.message || "Failed to save signature");
        } finally {
            setSaving(false);
        }
    }, [src, croppedAreaPixels, zoom, rotation, removeBg, bgLumaMin, inkLumaMax, closeModal, setSignatureFromApi]);

    return (
        <div className="p-4 text-slate-100">
            <div className="max-w-2xl space-y-4">
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-lg font-semibold">Signature</div>
                            <div className="text-sm text-slate-300">
                                Choose or take a photo, crop it to just the signature, remove the background, then upload.
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                            <button
                                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm hover:border-slate-400 disabled:opacity-50"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!!blocked}
                                title={blocked ? (cap?.reason || "Not allowed") : "Upload / Edit"}
                            >
                                Upload / Edit
                            </button>

                            {blocked && (
                                <div className="max-w-sm rounded-lg border border-amber-700/40 bg-amber-900/20 p-3 text-left text-sm text-amber-200">
                                    {cap?.reason || "Signature upload is not available."}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                            <div className="mb-2 text-xs text-slate-400">Current signature</div>
                            {currentSigUrl ? (
                                <img
                                    src={currentSigUrl}
                                    alt="Signature"
                                    className="max-h-40 w-auto rounded bg-white p-2"
                                />
                            ) : (
                                <div className="text-sm text-slate-400">No signature uploaded yet.</div>
                            )}
                        </div>

                        <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                            <div className="mb-2 text-xs text-slate-400">Notes</div>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                                <li>Center the signature and use zoom/rotate to fit it tightly in the frame.</li>
                                <li>The pure white background preview shows transparency.</li>
                                <li>Avoid large blank borders for best printing.</li>
                            </ul>
                        </div>
                    </div>

                    {msg && <div className="mt-3 text-sm text-emerald-300">{msg}</div>}
                    {err && <div className="mt-3 text-sm text-rose-300">{err}</div>}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={onPickFile}
                        className="hidden"
                    />
                </div>
            </div>

            {src && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3">
                    <div className="flex min-h-full items-center justify-center">
                        <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
                            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                                <div className="min-w-0">
                                    <div className="font-semibold">
                                        {isMobile
                                            ? mobileStep === "crop"
                                                ? "Crop signature"
                                                : "Remove background"
                                            : "Crop signature"}
                                    </div>
                                    <div className="truncate text-xs text-slate-400">{fileName}</div>
                                </div>

                                <button
                                    className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm hover:border-slate-400"
                                    onClick={closeModal}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                            </div>

                            {/* MOBILE */}
                            {isMobile ? (
                                <>
                                    {mobileStep === "crop" ? (
                                        <>
                                            <div className="relative min-h-[280px] flex-1 bg-black">
                                                <Cropper
                                                    image={src}
                                                    crop={crop}
                                                    zoom={zoom}
                                                    rotation={rotation}
                                                    aspect={4 / 1}
                                                    onCropChange={setCrop}
                                                    onZoomChange={setZoom}
                                                    onRotationChange={setRotation}
                                                    onCropAreaChange={onCropAreaChange}
                                                />
                                            </div>

                                            <div className="space-y-4 overflow-y-auto border-t border-slate-700 px-4 py-4">
                                                <div>
                                                    <div className="mb-1 text-xs text-slate-400">Zoom</div>
                                                    <input
                                                        type="range"
                                                        min={1}
                                                        max={4}
                                                        step={0.01}
                                                        value={zoom}
                                                        onChange={(e) => setZoom(Number(e.target.value))}
                                                        className="w-full"
                                                        disabled={saving}
                                                    />
                                                </div>

                                                <div>
                                                    <div className="mb-1 text-xs text-slate-400">Rotate</div>
                                                    <input
                                                        type="range"
                                                        min={-45}
                                                        max={45}
                                                        step={1}
                                                        value={rotation}
                                                        onChange={(e) => setRotation(Number(e.target.value))}
                                                        className="w-full"
                                                        disabled={saving}
                                                    />
                                                </div>

                                                <div className="text-xs text-slate-400">
                                                    Zoom and rotate to fit the signature tightly, then tap Next.
                                                </div>

                                                <div className="flex items-center justify-end gap-2 pt-2">
                                                    <button
                                                        className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm hover:border-slate-400"
                                                        onClick={closeModal}
                                                        disabled={saving}
                                                    >
                                                        Cancel
                                                    </button>

                                                    <button
                                                        className="rounded-lg border border-blue-600 bg-blue-700/20 px-3 py-2 text-sm text-blue-200 hover:bg-blue-700/30 disabled:opacity-50"
                                                        onClick={() => setMobileStep("cleanup")}
                                                        disabled={!croppedAreaPixels || saving}
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex min-h-[280px] flex-1 items-center justify-center bg-slate-950 p-4">
                                                {/* <div className="flex h-full w-full items-center justify-center rounded border border-slate-700 bg-[linear-gradient(45deg,#334155_25%,transparent_25%,transparent_75%,#334155_75%,#334155),linear-gradient(45deg,#334155_25%,transparent_25%,transparent_75%,#334155_75%,#334155)] bg-[position:0_0,10px_10px] bg-[size:20px_20px] p-3">
                                                    {previewUrl ? (
                                                        <img
                                                            src={previewUrl}
                                                            alt="Signature preview"
                                                            className="max-h-full max-w-full object-contain"
                                                        />
                                                    ) : (
                                                        <div className="text-xs text-slate-500">
                                                            Preview will appear here.
                                                        </div>
                                                    )}
                                                </div> */}
                                                <div className="flex min-h-[120px] items-center justify-center rounded border border-slate-700 bg-white p-3">
                                                    {previewUrl ? (
                                                        <img
                                                            src={previewUrl}
                                                            alt="Signature preview"
                                                            className="max-h-32 w-auto"
                                                        />
                                                    ) : (
                                                        <div className="text-xs text-slate-500">
                                                            Preview will appear here.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-4 overflow-y-auto border-t border-slate-700 px-4 py-4">
                                                <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                                                    <label className="flex items-center gap-2 text-sm text-slate-200">
                                                        <input
                                                            type="checkbox"
                                                            checked={removeBg}
                                                            onChange={(e) => setRemoveBg(e.target.checked)}
                                                            disabled={saving}
                                                        />
                                                        Remove paper background
                                                    </label>

                                                    <div className="mt-3">
                                                        <div className="mb-1 text-xs text-slate-400">
                                                            Background sensitivity ({bgLumaMin})
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min={160}
                                                            max={255}
                                                            step={1}
                                                            value={bgLumaMin}
                                                            onChange={(e) => setBgLumaMin(Number(e.target.value))}
                                                            disabled={!removeBg || saving}
                                                            className="w-full"
                                                        />
                                                        <div className="text-[11px] text-slate-500">
                                                            Lower removes more paper/background.
                                                        </div>
                                                    </div>

                                                    <div className="mt-3">
                                                        <div className="mb-1 text-xs text-slate-400">
                                                            Ink protection ({inkLumaMax})
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min={80}
                                                            max={190}
                                                            step={1}
                                                            value={inkLumaMax}
                                                            onChange={(e) => setInkLumaMax(Number(e.target.value))}
                                                            disabled={!removeBg || saving}
                                                            className="w-full"
                                                        />
                                                        <div className="text-[11px] text-slate-500">
                                                            Higher keeps more light gray strokes.
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-xs text-slate-400">
                                                    Pure white background indicates transparency.
                                                </div>

                                                {err && <div className="text-sm text-rose-300">{err}</div>}

                                                <div className="flex items-center justify-between gap-2 pt-2">
                                                    <button
                                                        className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm hover:border-slate-400"
                                                        onClick={() => setMobileStep("crop")}
                                                        disabled={saving}
                                                    >
                                                        Back
                                                    </button>

                                                    <button
                                                        className="rounded-lg border border-emerald-600 bg-emerald-700/20 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-700/30 disabled:opacity-50"
                                                        onClick={onSave}
                                                        disabled={!canSave}
                                                    >
                                                        {saving ? "Saving..." : "Save signature"}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : (
                                /* DESKTOP / LARGE TABLET: keep your current combined layout */
                                <>
                                    <div className="relative min-h-[240px] flex-1 bg-black">
                                        <Cropper
                                            image={src}
                                            crop={crop}
                                            zoom={zoom}
                                            rotation={rotation}
                                            aspect={4 / 1}
                                            onCropChange={setCrop}
                                            onZoomChange={setZoom}
                                            onRotationChange={setRotation}
                                            onCropAreaChange={onCropAreaChange}
                                        />
                                    </div>

                                    <div className="space-y-4 overflow-y-auto border-t border-slate-700 px-4 py-4">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div>
                                                <div className="mb-1 text-xs text-slate-400">Zoom</div>
                                                <input
                                                    type="range"
                                                    min={1}
                                                    max={4}
                                                    step={0.01}
                                                    value={zoom}
                                                    onChange={(e) => setZoom(Number(e.target.value))}
                                                    className="w-full"
                                                    disabled={saving}
                                                />
                                            </div>

                                            <div>
                                                <div className="mb-1 text-xs text-slate-400">Rotate</div>
                                                <input
                                                    type="range"
                                                    min={-45}
                                                    max={45}
                                                    step={1}
                                                    value={rotation}
                                                    onChange={(e) => setRotation(Number(e.target.value))}
                                                    className="w-full"
                                                    disabled={saving}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                                                <label className="flex items-center gap-2 text-sm text-slate-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={removeBg}
                                                        onChange={(e) => setRemoveBg(e.target.checked)}
                                                        disabled={saving}
                                                    />
                                                    Remove paper background
                                                </label>

                                                <div className="mt-3">
                                                    <div className="mb-1 text-xs text-slate-400">
                                                        Background sensitivity ({bgLumaMin})
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min={100}
                                                        max={255}
                                                        step={1}
                                                        value={bgLumaMin}
                                                        onChange={(e) => setBgLumaMin(Number(e.target.value))}
                                                        disabled={!removeBg || saving}
                                                        className="w-full"
                                                    />
                                                </div>

                                                <div className="mt-3">
                                                    <div className="mb-1 text-xs text-slate-400">
                                                        Ink protection ({inkLumaMax})
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min={80}
                                                        max={220}
                                                        step={1}
                                                        value={inkLumaMax}
                                                        onChange={(e) => setInkLumaMax(Number(e.target.value))}
                                                        disabled={!removeBg || saving}
                                                        className="w-full"
                                                    />
                                                </div>
                                            </div>

                                            <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                                                <div className="mb-2 text-xs text-slate-400">Live preview</div>
                                                <div className="flex min-h-[120px] items-center justify-center rounded border border-slate-700 bg-white p-3">
                                                    {previewUrl ? (
                                                        <img
                                                            src={previewUrl}
                                                            alt="Signature preview"
                                                            className="max-h-32 w-auto"
                                                        />
                                                    ) : (
                                                        <div className="text-xs text-slate-500">
                                                            Preview will appear here.
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-2 text-[11px] text-slate-500">
                                                    Background should be pure white. Only pure white areas will become transparent and any smudges/gray areas will appear on the certificate.
                                                </div>
                                            </div>
                                        </div>

                                        {err && <div className="text-sm text-rose-300">{err}</div>}

                                        <div className="flex items-center justify-end gap-2 pt-2">
                                            <button
                                                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm hover:border-slate-400"
                                                onClick={closeModal}
                                                disabled={saving}
                                            >
                                                Cancel
                                            </button>

                                            <button
                                                className="rounded-lg border border-emerald-600 bg-emerald-700/20 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-700/30 disabled:opacity-50"
                                                onClick={onSave}
                                                disabled={!canSave}
                                            >
                                                {saving ? "Saving..." : "Save signature"}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}