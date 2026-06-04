import { useEffect, useState } from "react";
import { apiJson } from "../lib/api"; // adjust path if needed

type PrintSlot = number | "all";

type Props = {
    open: boolean;
    handlerId: number | null;
    title?: string;
    onClose: () => void;
    onPrint: (
        mode: PrintMode,
        slot: PrintSlot,
        affiliationId: number | null
    ) => void;
};

type IdCardAffiliationOption = {
    affiliation_id: number | null;
    name: string;
    is_default?: boolean;
};

type PrintMode = "view" | "sheet";

export default function IdCardPrintDialog({
    open,
    handlerId,
    title = "Print ID on card stock",
    onClose,
    onPrint,
}: Props) {
    const [slot, setSlot] = useState<PrintSlot>(1);
    const [mode, setMode] = useState<PrintMode>("view");

    const [affiliationOptions, setAffiliationOptions] = useState<IdCardAffiliationOption[]>([
        { affiliation_id: null, name: "Tri-State K9 SAR", is_default: true },
    ]);
    const [selectedAffiliationId, setSelectedAffiliationId] = useState<number | null>(null);

    useEffect(() => {
        if (!open || !handlerId) return;

        apiJson<IdCardAffiliationOption[]>(
            `/id-cards/handlers/${handlerId}/id-card-affiliations`,
            { authRequired: true }
        )
            .then((rows) => {
                console.log("Branding rows returned:", rows);

                const safeRows =
                    Array.isArray(rows) && rows.length > 0
                        ? rows
                        : [{ affiliation_id: null, name: "Tri-State K9 SAR", is_default: true }];

                setAffiliationOptions(safeRows);
                setSelectedAffiliationId(null);
            })
            .catch((e) => {
                console.error("Branding options failed:", e);

                setAffiliationOptions([
                    {
                        affiliation_id: null,
                        name: "Tri-State K9 SAR",
                        is_default: true,
                    },
                ]);
                setSelectedAffiliationId(null);
            });
    }, [open, handlerId]);

    if (!open) return null;

    return (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="relative w-full max-w-md rounded-xl border-slate-600 bg-slate-900 p-4 shadow-xl space-y-4">
                <div>
                    <div className="text-sm font-semibold text-slate-100">
                        {title}
                    </div>
                    <div className="text-xs text-slate-400">
                        Choose the business-card sheet slot to use.
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-slate-200">
                        ID card branding
                    </label>
                    <select
                        value={selectedAffiliationId == null ? "" : String(selectedAffiliationId)}
                        onChange={(e) =>
                            setSelectedAffiliationId(
                                e.target.value === "" ? null : Number(e.target.value)
                            )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-slate-100"
                    >
                        {affiliationOptions.map((a) => (
                            <option
                                key={a.affiliation_id == null ? "default" : String(a.affiliation_id)}
                                value={a.affiliation_id == null ? "" : String(a.affiliation_id)}
                            >
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>
                {/* <div className="text-xs text-slate-400">
                    Loaded branding options: {affiliationOptions.length}
                </div> */}

                <label className="block text-sm text-slate-200">Output</label>
                <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as PrintMode)}
                    className="mt-1 w-full rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-slate-100"
                >
                    <option value="view">View / Print single card</option>
                    <option value="sheet">Print on card stock</option>
                </select>

                {mode === "sheet" && (
                    <>
                        <select
                            value={slot}
                            onChange={(e) =>
                                setSlot(e.target.value === "all" ? "all" : Number(e.target.value))
                            }
                            className="
    w-full
    rounded-lg
    border border-slate-500
    bg-slate-800
    text-slate-100
    px-3 py-2
    appearance-none
    shadow-none
  "
                            style={{
                                WebkitAppearance: "none",
                                appearance: "none",
                            }}
                        >
                            <option value="all">Fill Entire Sheet (10 cards)</option>

                            {Array.from({ length: 10 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>
                                    Slot {i + 1}
                                </option>
                            ))}
                        </select>

                        <div className="grid grid-cols-2 gap-2 text-center text-xs text-slate-400">
                            <div>1</div><div>6</div>
                            <div>2</div><div>7</div>
                            <div>3</div><div>8</div>
                            <div>4</div><div>9</div>
                            <div>5</div><div>10</div>
                        </div>
                    </>
                )}
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-2 rounded-lg text-sm border border-slate-600 bg-slate-700 text-slate-100"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={() => onPrint(mode, slot, selectedAffiliationId)}
                        className="px-3 py-2 rounded-lg text-sm border border-emerald-700 bg-emerald-900/30 text-emerald-200"
                    >
                        Print
                    </button>
                </div>
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-900 p-3 text-sm text-amber-100">
                    For best alignment on Avery 8879 card stock, print from desktop Chrome or Edge at 100% scale.
                    iOS Safari may change scaling and vertical placement.
                </div>
                <div className="mt-2 text-xs text-slate-500">
                    Tested settings: Chrome & Edge, custom margins — left/right 0.75", top/bottom 0.5", scale 100%, no header/footer, highest quality. Results may vary with different printers and settings.
                </div>
            </div>
        </div>
    );
}