import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiJson } from "../lib/api";
import { QRCodeCanvas } from "qrcode.react";


type CertificateView = {
    certification_id: number;
    handler_name?: string | null;
    dog_name?: string | null;
    team_name?: string | null;

    discipline_name: string;
    standard_name: string;

    date_awarded?: string | null;
    effective_start?: string | null;
    expires_at?: string | null;

    location?: string | null;
    supervisor_name?: string | null;
    issued_at?: string | null;
    status?: string | null;

    seal_short_code?: string | null;
    seal_hash?: string | null;
    verify_url?: string | null;

    supervisor_signature_url?: string | null;
    supervisor_signature_hash?: string | null;

    requires_co_evaluator?: boolean;
    co_evaluator_name?: string | null;
    co_signature_url?: string | null;
    co_signature_hash?: string | null;
    co_evaluated_at?: string | null;
};

function fmtDate(d?: string | null) {
    if (!d) return "—";
    // d may be "YYYY-MM-DD" or ISO
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString();
}

function appBase(): string {
    // Vite sets BASE_URL to "/" in dev, and usually "/app/" (or similar) in prod if configured.
    const b = (import.meta as any).env?.BASE_URL || "/";
    return b.endsWith("/") ? b : b + "/";
}

function makeVerifyUrl(certId: number) {
    return `${window.location.origin}/verify/cert/${certId}`;
}

export default function CertificatePrintPage() {
    const { certificationId } = useParams();
    const nav = useNavigate();
    const [data, setData] = useState<CertificateView | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setErr(null);
                const res = await apiJson(`/certifications/${certificationId}/certificate`);
                if (!cancelled) setData(res);
            } catch (e: any) {
                if (!cancelled) setErr(e?.message || "Failed to load certificate");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [certificationId]);

    const subjectLine = useMemo(() => {
        if (data?.handler_name && data?.dog_name) {
            return `${data.handler_name} and K9 ${data.dog_name}`;
        }
        if (data?.handler_name) return data.handler_name;
        if (data?.dog_name) return `K9 ${data.dog_name}`;
        return data?.team_name || "Team";
    }, [data]);

    const verifyUrl = useMemo(() => {
        if (!data?.certification_id) return "";
        return makeVerifyUrl(data.certification_id);
    }, [data?.certification_id]);

    const showCoSignature = useMemo(() => {
        return !!(
            data?.requires_co_evaluator &&
            data?.status === "active" &&
            data?.co_signature_url
        );
    }, [data]);

    if (err) {
        return (
            <div className="p-6">
                <div className="mb-4 text-red-600">{err}</div>
                <button className="px-3 py-2 rounded border" onClick={() => nav(-1)}>
                    Back
                </button>
            </div>
        );
    }

    if (!data) return <div className="p-6">Loading…</div>;

    return (
        <div className="min-h-screen bg-slate-300 print:bg-white">
            {/* Top controls (hidden in print) */}
            <div className="mx-auto max-w-4xl p-4 print:hidden flex gap-2">
                <button className="px-3 py-2 rounded border bg-slate-700" onClick={() => nav(-1)}>
                    Back
                </button>
                <button className="px-3 py-2 rounded border bg-slate-700" onClick={() => window.print()}>
                    Print
                </button>
            </div>

            {/* Certificate */}

            <div id="certificate" className="mx-auto max-w-4xl px-4 pb-10 print:px-0 print:pb-0">
                {/* Frame */}
                <div className="bg-[#fdfbf7] border-[10px] border-double border-slate-400 p-2 print:p-2">
                    {/* Paper (this is the box the background should fill) */}
                    <div className="relative bg-white overflow-hidden">
                        {/* Background layer */}
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundImage: "url('/assets/certbg9.jpg')",
                                backgroundRepeat: "no-repeat",
                                backgroundPosition: "center",
                                backgroundSize: "cover", // fills the whole paper area
                                opacity: 0.8,          // tune this
                            }}
                        />

                        {/* Content layer (IMPORTANT: wrap ALL content in here) */}
                        <div className="relative z-10 p-10">
                            <div className="text-center">
                                <div className="tracking-widest font-semibold text-2xl text-green-800">TRI-STATE-K9</div>
                                <div className="mt-2 text-3xl text-amber-800 font-bold">Certificate of Certification</div>
                                <div className="mt-3 text-slate-800">
                                    This documnent certifies that{" "}
                                    <span className="font-bold text-slate-900">{subjectLine}</span>{" "}
                                    met the requirements for the following<br />K-9 Search & Rescue standard:
                                </div>
                            </div>

                            <div className="mt-10 grid grid-cols-1 gap-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <StandardField label="Discipline" value={data.discipline_name} />
                                    <StandardField label="Standard" value={data.standard_name} />
                                </div>

                                <div className="grid grid-cols-3 gap-6">
                                    <Field label="Date Awarded" value={fmtDate(data.date_awarded)} />
                                    <Field label="Valid From" value={fmtDate(data.effective_start)} />
                                    <Field label="Valid To" value={fmtDate(data.expires_at)} />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <Field label="Location" value={data.location || "—"} />
                                    <Field
                                        label={showCoSignature ? "Primary Evaluator" : "Evaluated and Issued By"}
                                        value={data.supervisor_name || "—"}
                                    />
                                </div>
                            </div>

                            <div className="mt-14 space-y-8">
                                <div className={`${showCoSignature ? "grid grid-cols-2 gap-10 items-end" : "grid grid-cols-2 gap-10 items-end"}`}>
                                    <SigBlock
                                        label={showCoSignature ? "Primary Evaluator Signature" : "Evaluator Signature"} 
                                        name={data.supervisor_name || "—"}
                                        signatureUrl={data.supervisor_signature_url}
                                        signatureHash={data.supervisor_signature_hash}
                                    />
                                    <SigLine label="Date" value={fmtDate(data.issued_at || new Date().toISOString())} />
                                </div>

                                {showCoSignature && (
                                    <div className="grid grid-cols-2 gap-10 items-end">
                                        <SigBlock
                                            label="Co-Evaluator Signature"
                                            name={data.co_evaluator_name || "—"}
                                            signatureUrl={data.co_signature_url}
                                            signatureHash={data.co_signature_hash}
                                        />
                                        <SigLine
                                            label="Date"
                                            value={fmtDate(
                                                data.co_evaluated_at ||
                                                data.issued_at ||
                                                new Date().toISOString()
                                            )}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Footer row: ID + seal + QR */}
                            <div className="mt-10 text-xs text-slate-700 grid grid-cols-3 items-end gap-6">
                                <div>
                                    <div>TSK9SAR</div>
                                    <div>Certificate ID: {data.certification_id}</div>
                                    <div>Issued: {fmtDate(data.issued_at || "—")}</div>
                                </div>

                                <div className="text-center">
                                    <div className="uppercase tracking-wider text-[10px] text-slate-600">Validation ID</div>
                                    <div className="mt-1 font-semibold text-slate-800">
                                        {data.seal_short_code || "—"}
                                    </div>
                                    <div className="mt-1 text-[10px] text-slate-600">
                                        Scan QR to verify authenticity
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    {verifyUrl ? (
                                        <div className="flex flex-col items-center">
                                            <div className="bg-white/80 p-1 rounded inline-block">
                                                {verifyUrl ? (
                                                    <QRCodeCanvas value={verifyUrl} size={84} />
                                                ) : null}
                                            </div>
                                            <div className="mt-1 text-[10px] text-slate-600 max-w-[90px] text-center break-words">
                                                Scan to verify
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Print tweaks */}
            <style>{`
@media print {
  /* Force white page/background */
  html, body {
    background: #fff !important;
    color: #000 !important;
  }

  /* Hide site chrome */
  header, nav, footer,
  .site-header, .app-sidebar, .topbar {
    display: none !important;
  }

  /* Show only the certificate area */
  body * {
    visibility: hidden;
  }
  #certificate, #certificate * {
    visibility: visible;
  }

  /* Position certificate nicely on the page */
  #certificate {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }
}

      `}</style>
        </div>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-xs uppercase tracking-wider text-slate-600">{label}</div>
            <div className="mt-1 text-lg text-slate-900">{value}</div>
        </div>
    );
}

function StandardField({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-xs uppercase tracking-wider text-slate-600">{label}</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
        </div>
    );
}

function SigLine({ label, value }: { label: string; value?: string }) {
    return (
        <div>
            <div className="h-10 border-b border-slate-700 flex items-end justify-end pb-1 text-sm text-black">
                {value || ""}
            </div>
            <div className="mt-2 text-sm uppercase tracking-wider text-black">{label}</div>
        </div>
    );
}

type SigBlockProps = {
    label: string;
    name: string;
    signatureUrl?: string | null;
    signatureHash?: string | null; // optional
};

function absUrl(u?: string | null) {
    const s = (u ?? "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/")) return `${window.location.origin}${s}`;
    return `${window.location.origin}/${s}`;
}

function withV(u: string, v?: string | null) {
    if (!u) return u;
    if (!v) return u;
    const sep = u.includes("?") ? "&" : "?";
    return `${u}${sep}v=${encodeURIComponent(v)}`;
}

function SigBlock({ label, name, signatureUrl, signatureHash }: SigBlockProps) {
    const src = withV(absUrl(signatureUrl), signatureHash || "");

    return (
        <div className="min-w-0">
            <div className="inline-block  px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-800">
                {label}
            </div>

            <div className="mt-2 h-[70px] flex items-end">
                {src ? (
                    <img
                        src={src}
                        alt="Signature"
                        className="w-auto max-h-[70px] object-contain"
                        style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))" }}
                    />
                ) : (
                    <div className="h-[70px] w-full border-b-2 border-black" />
                )}
            </div>

            <div className="mt-2 text-sm text-black">{name}</div>
            <div className="mt-1 h-[1px] w-full bg-slate-700" />
        </div>
    );
}