// src/components/IdHeadshotUploader.tsx

import React, { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { apiFetch } from "../lib/api";

type IdHeadshotUploaderProps = {
  kind: "handler" | "dog";
  entityId: number;
  onUploaded?: () => void;
};

type Area = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const OUTPUT_WIDTH = 600;
const OUTPUT_HEIGHT = 900;

async function createCroppedPng(
  imageSrc: string,
  cropPixels: Area
): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load image."));
  });

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context.");

  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    OUTPUT_WIDTH,
    OUTPUT_HEIGHT
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Failed to create cropped image."));
        else resolve(blob);
      },
      "image/png",
      0.95
    );
  });
}

export default function IdHeadshotUploader({
  kind,
  entityId,
  onUploaded,
}: IdHeadshotUploaderProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedPixels(areaPixels);
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(String(reader.result));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.onerror = () => setError("Failed to read image file.");
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    if (!imageSrc || !croppedPixels) {
      setError("Please select and crop an image first.");
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const blob = await createCroppedPng(imageSrc, croppedPixels);

      const form = new FormData();
      form.append("file", blob, `${kind}-id-headshot.png`);

      const path =
        kind === "handler"
          ? `/id-headshots/handlers/${entityId}`
          : `/id-headshots/dogs/${entityId}`;

      const resp = await apiFetch(path, {
        method: "POST",
        body: form,
        authRequired: true,
        mfaRequired: true,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Upload failed: HTTP ${resp.status}: ${text}`);
      }

      onUploaded?.();
      setImageSrc(null);
    } catch (err: any) {
      setError(err?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-600 bg-slate-800 p-4 space-y-3">
      <div>
        <div className="text-sm font-semibold text-slate-100">
          ID Headshot
        </div>
        <div className="text-xs text-slate-300">
          Upload and crop a 2:3 portrait headshot for generated ID cards.
        </div>
      </div>

      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="block w-full text-sm text-slate-200"
      />

      {imageSrc && (
        <>
          <div className="relative h-[280px] sm:h-[420px] w-full overflow-hidden rounded-lg bg-slate-950">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={2 / 3}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Zoom</label>
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

          <div className="sticky bottom-0 z-20 -mx-4 flex gap-2 border-t border-slate-700 bg-slate-800 p-3">
            <button
              type="button"
              disabled={uploading}
              onClick={handleUpload}
              className="flex-1 rounded bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Save ID Headshot"}
            </button>

            <button
              type="button"
              disabled={uploading}
              onClick={() => setImageSrc(null)}
              className="flex-1 rounded border border-slate-500 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="rounded border border-red-700 bg-red-900/30 p-2 text-sm text-red-100">
          {error}
        </div>
      )}
    </div>
  );
}