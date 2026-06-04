import React, { useMemo, useState } from "react";

function PublicContactForm() {
    const [form, setForm] = useState({
        name: "",
        organization: "",
        email: "",
        topic: "General inquiry",
        message: "",
    });

    function updateField(key, value) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    const mailtoHref = useMemo(() => {
        const to = "info@tsk9sar.org";
        const cc = form.email?.trim() ? form.email.trim() : "";

        const subject = `[TSK9SAR] ${form.topic || "General inquiry"}${form.name?.trim() ? ` - ${form.name.trim()}` : ""
            }`;

        const bodyLines = [
            "TSK9SAR Contact Request",
            "---------------------",
            `Name: ${form.name || ""}`,
            `Agency / Organization: ${form.organization || ""}`,
            `Reply Email: ${form.email || ""}`,
            `Topic: ${form.topic || ""}`,
            "",
            "Message:",
            form.message || "",
            "",
            "Submitted from the public TSK9SAR contact page.",
        ];

        const encodedSubject = encodeURIComponent(subject);
        const encodedBody = encodeURIComponent(bodyLines.join("\n"));
        const encodedCc = cc ? `&cc=${encodeURIComponent(cc)}` : "";

        return `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}${encodedCc}`;
    }, [form]);

    function handleOpenEmailClient(e) {
        e.preventDefault();
        window.location.href = mailtoHref;
    }

    function handleClear() {
        setForm({
            name: "",
            organization: "",
            email: "",
            topic: "General inquiry",
            message: "",
        });
    }

    return (
        <div className="rounded-xl border border-slate-700 bg-slate-900/40 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-slate-700 bg-slate-950/40">
                <h2 className="text-xl font-semibold text-slate-100">Contact TSK9SAR</h2>
                <p className="mt-2 text-sm text-slate-300">
                    Use this form to prepare an email for membership inquiries, standards
                    questions, evaluator questions, or general support.
                </p>
            </div>

            <div className="p-6 sm:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4">
                        <div className="text-xs uppercase tracking-wider text-slate-400">
                            Organization
                        </div>
                        <div className="mt-3 space-y-4 text-sm text-slate-300">
                            <div>
                                <div className="text-slate-400">Name</div>
                                <div className="text-slate-100 font-medium">TSK9SAR</div>
                                <div className="text-slate-400 mt-1">Tri-State K9</div>
                            </div>

                            <div>
                                <div className="text-slate-400">General email</div>
                                <div className="text-emerald-400">info@tsk9sar.org</div>
                            </div>

                            <div>
                                <div className="text-slate-400">Administrative email</div>
                                <div className="text-slate-100">admin@tsk9sar.org</div>
                            </div>

                            <div>
                                <div className="text-slate-400">Membership note</div>
                                <p className="mt-1 leading-6">
                                    Membership is granted by invitation. Please include your role,
                                    organization, location, and why you want to participate.
                                </p>
                            </div>
                        </div>
                    </div>

                    <form
                        className="rounded-lg border border-slate-700 bg-slate-950/40 p-4 space-y-3"
                        onSubmit={handleOpenEmailClient}
                    >
                        <div className="text-xs uppercase tracking-wider text-slate-400">
                            Prepare Email
                        </div>

                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => updateField("name", e.target.value)}
                            placeholder="Your name"
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />

                        <input
                            type="text"
                            value={form.organization}
                            onChange={(e) => updateField("organization", e.target.value)}
                            placeholder="Agency / organization"
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />

                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) => updateField("email", e.target.value)}
                            placeholder="Your email"
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />

                        <select
                            value={form.topic}
                            onChange={(e) => updateField("topic", e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option>General inquiry</option>
                            <option>Membership request</option>
                            <option>Certification standards question</option>
                            <option>Evaluator program question</option>
                            <option>Technical/site issue</option>
                        </select>

                        <textarea
                            value={form.message}
                            onChange={(e) => updateField("message", e.target.value)}
                            placeholder="Message"
                            rows={7}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
                        />

                        <div className="flex flex-wrap gap-3 pt-1">
                            <button
                                type="submit"
                                className="px-4 py-2 rounded-lg text-sm font-medium border border-emerald-600 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50"
                            >
                                Open Email Client
                            </button>

                            <button
                                type="button"
                                onClick={handleClear}
                                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-400"
                            >
                                Clear
                            </button>
                        </div>

                        <p className="text-xs text-slate-400 leading-5">
                            This uses your device’s email client and does not store the message
                            on the server.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default PublicContactForm;