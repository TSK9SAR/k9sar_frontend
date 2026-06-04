// src/components/IdHeadshotModal.tsx

import { useState } from "react";
import IdHeadshotUploader from "./IdHeadshotUploader";

type Props = {
  kind: "handler" | "dog";
  entityId: number;
  title: string;
  onClose: () => void;
  onUploaded?: () => void;
};

export default function IdHeadshotModal({
  kind,
  entityId,
  title,
  onClose,
  onUploaded,
}: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-600 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            <p className="text-xs text-slate-400">
              Crop a portrait 2:3 image for generated ID cards.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-500 bg-slate-800 px-3 py-2 text-sm text-slate-100 shadow-none appearance-none"
          >
            Close
          </button>
        </div>
        <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800 p-3">
          <div className="mb-2 text-xs font-semibold text-slate-300">
            Current ID headshot
          </div>

          <img
            src={`/api/id-headshots/${kind === "handler" ? "handlers" : "dogs"}/${entityId}?v=${Date.now()}`}
            alt="Current ID headshot"
            className="h-48 w-32 rounded-lg border border-slate-600 object-cover bg-slate-950"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        <div className="p-4">
          <IdHeadshotUploader
            kind={kind}
            entityId={entityId}
            onUploaded={() => {
              setRefreshKey((x) => x + 1);
              onUploaded?.();
            }}
          />
        </div>
      </div>
    </div>
  );
}