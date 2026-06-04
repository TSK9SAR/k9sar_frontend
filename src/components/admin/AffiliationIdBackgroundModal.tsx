import React, { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { apiJson, apiFetch } from "../../lib/api";

type Props = {
  affiliationId: number;
  title?: string;
  onClose: () => void;
  onUploaded?: () => void;
};

const ID_CARD_ASPECT_RATIO = 3.375 / 2.125;

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function cropToBlob(
  imageSrc: string,
  cropPixels: any
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = cropPixels.width;
  canvas.height = cropPixels.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    cropPixels.width,
    cropPixels.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Could not create cropped image"));
        else resolve(blob);
      },
      "image/png",
      0.95
    );
  });
}

export default function AffiliationIdBackgroundModal({
  affiliationId,
  title = "Affiliation ID Card Background",
  onClose,
  onUploaded,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<any>(null);

  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    async function loadCurrent() {
      setLoadingCurrent(true);
      setErr(null);

      try {
        const res = await apiFetch(
          `/admin/affiliations/${affiliationId}/id-card-background`,
          {
            method: "GET",
            authRequired: true,
          }
        );

        if (res.status === 404) return;
        if (!res.ok) throw new Error("Failed to load current background");

        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);

        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        setCurrentUrl(objectUrl);
        setImageUrl(objectUrl);
      } catch (e: any) {
        setErr(e?.message || "Failed to load current background.");
      } finally {
        setLoadingCurrent(false);
      }
    }

    loadCurrent();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [affiliationId]);

  function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setErr(null);

    if (!f) return;

    if (!f.type.startsWith("image/")) {
      setErr("Please choose an image file.");
      return;
    }

    const url = URL.createObjectURL(f);
    setImageUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  async function upload() {
    if (!imageUrl || !croppedPixels) {
      setErr("Please choose and position an image first.");
      return;
    }

    setUploading(true);
    setErr(null);

    try {
      const blob = await cropToBlob(imageUrl, croppedPixels);

      const fd = new FormData();
      fd.append("file", blob, "id-card-background.png");

      await apiJson(
        `/admin/affiliations/${affiliationId}/id-card-background`,
        {
          method: "POST",
          body: fd,
          authRequired: true,
        }
      );

      onUploaded?.();
    } catch (e: any) {
      setErr(e?.message || "Failed to upload background.");
    } finally {
      setUploading(false);
    }
  }

  async function removeBackground() {
    if (!window.confirm("Remove this affiliation ID card background?")) return;

    setUploading(true);
    setErr(null);

    try {
      await apiJson(
        `/admin/affiliations/${affiliationId}/id-card-background`,
        {
          method: "DELETE",
          authRequired: true,
        }
      );

      onUploaded?.();
    } catch (e: any) {
      setErr(e?.message || "Failed to remove background.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              {title}
            </h2>
            <p className="text-xs text-slate-400">
              Upload, crop, and zoom a landscape ID-card background.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-4">
          {err && (
            <div className="rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-200">
              {err}
            </div>
          )}

          <div className="relative mx-auto overflow-hidden rounded-xl border border-slate-700 bg-slate-900"
            style={{ width: "100%", maxWidth: 640, aspectRatio: ID_CARD_ASPECT_RATIO }}>
            {imageUrl ? (
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                aspect={ID_CARD_ASPECT_RATIO}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedAreaPixels) =>
                  setCroppedPixels(croppedAreaPixels)
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                {loadingCurrent ? "Loading current background…" : "No background uploaded"}
              </div>
            )}
          </div>

          {imageUrl && (
            <div className="mx-auto max-w-md">
              <label className="block text-xs text-slate-400">
                Zoom
              </label>
              <input
                type="range"
                min={1}
                max={4}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={chooseFile}
            className="hidden"
          />

          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 disabled:opacity-60"
            >
              {currentUrl ? "Replace Image" : "Choose Image"}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={removeBackground}
                disabled={uploading || !currentUrl}
                className="rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm text-rose-200 hover:bg-rose-900/50 disabled:opacity-40"
              >
                Remove
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={upload}
                disabled={uploading || !imageUrl}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-400"
              >
                {uploading ? "Saving…" : "Save Background"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}