import { useRef, useState } from "react";
import {
  EyeIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import ForumMarkdown from "./ForumMarkdown";

const toolButtonClass =
  "h-8 min-w-8 rounded-md border border-slate-600 bg-slate-900 px-2 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:bg-slate-800";

function insertAround(text, start, end, before, after, placeholder) {
  const selected = text.slice(start, end);

  if (!selected) {
    return {
      nextEnd: start + before.length + placeholder.length,
      nextStart: start + before.length,
      nextValue: `${text.slice(0, start)}${before}${placeholder}${after}${text.slice(end)}`,
    };
  }

  const leadingSpace = selected.match(/^\s*/)?.[0] || "";
  const trailingSpace = selected.match(/\s*$/)?.[0] || "";
  const core = selected.slice(leadingSpace.length, selected.length - trailingSpace.length);

  if (!core) {
    return {
      nextEnd: start + before.length + placeholder.length,
      nextStart: start + before.length,
      nextValue: `${text.slice(0, start)}${before}${placeholder}${after}${text.slice(end)}`,
    };
  }

  const formatted = `${leadingSpace}${before}${core}${after}${trailingSpace}`;
  const nextStart = start + leadingSpace.length + before.length;

  return {
    nextEnd: nextStart + core.length,
    nextStart,
    nextValue: `${text.slice(0, start)}${formatted}${text.slice(end)}`,
  };
}

function prefixSelectedLines(text, start, end, prefix, placeholder) {
  const hasSelection = end > start;
  const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const lineEnd = hasSelection ? end : start;
  const selected = text.slice(lineStart, lineEnd) || placeholder;
  const lines = selected.split("\n");
  const prefixed = lines
    .map((line) => {
      const cleaned = line.replace(/^(#{1,6}\s+|- |> )/, "");
      return `${prefix}${cleaned || placeholder}`;
    })
    .join("\n");

  return {
    nextEnd: lineStart + prefixed.length,
    nextStart: lineStart + prefix.length,
    nextValue: `${text.slice(0, lineStart)}${prefixed}${text.slice(lineEnd)}`,
  };
}

function insertPlain(text, start, end, insertion) {
  const nextCursor = start + insertion.length;

  return {
    nextEnd: nextCursor,
    nextStart: nextCursor,
    nextValue: `${text.slice(0, start)}${insertion}${text.slice(end)}`,
  };
}

export default function ForumComposer({
  submitColor = "blue",
  disabled = false,
  footerNote = "Markdown supported: headings, lists, links, quotes, tables, section and code.",
  minRows = 5,
  onChange,
  onSubmit,
  placeholder = "Write your message...",
  requireValue = true,
  submitClassName = "inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400",
  submitDisabled = false,
  submitLabel = "Post",
  submittingLabel = "Posting...",
  submitting = false,
  title = "Message",
  value,
}) {
  const textareaRef = useRef(null);
  const [mode, setMode] = useState("write");
  const hasRequiredValue = !requireValue || value.trim().length > 0;
  const canSubmit = hasRequiredValue && !disabled && !submitDisabled && !submitting;
  const colorMap = {
    blue: "bg-blue-600 hover:bg-blue-500",
    green: "bg-emerald-600 hover:bg-emerald-500",
    red: "bg-red-600 hover:bg-red-500",
    slate: "bg-slate-700 hover:bg-slate-600",
    amber: "bg-amber-600 hover:bg-amber-500",
  };
  const submitClasses = [
    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white",
    colorMap[submitColor] || colorMap.blue,
    "disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400",
    submitClassName || "",
  ].join(" ");
  function applyFormat(kind) {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    let nextValue = value;
    let nextStart = start;
    let nextEnd = end;

    if (kind === "bold") {
      const result = insertAround(value, start, end, "**", "**", "bold text");
      nextValue = result.nextValue;
      nextStart = result.nextStart;
      nextEnd = result.nextEnd;
    }

    if (kind === "italic") {
      const result = insertAround(value, start, end, "_", "_", "italic text");
      nextValue = result.nextValue;
      nextStart = result.nextStart;
      nextEnd = result.nextEnd;
    }

    if (kind === "heading1") {
      const result = prefixSelectedLines(value, start, end, "# ", "Heading");
      nextValue = result.nextValue;
      nextStart = result.nextStart;
      nextEnd = result.nextEnd;
    }

    if (kind === "heading2") {
      const result = prefixSelectedLines(value, start, end, "## ", "Heading");
      nextValue = result.nextValue;
      nextStart = result.nextStart;
      nextEnd = result.nextEnd;
    }

    if (kind === "heading3") {
      const result = prefixSelectedLines(value, start, end, "### ", "Heading");
      nextValue = result.nextValue;
      nextStart = result.nextStart;
      nextEnd = result.nextEnd;
    }

    if (kind === "quote") {
      const selected = value.slice(start, end) || "quoted text";
      nextValue = `${value.slice(0, start)}${selected
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}${value.slice(end)}`;
      nextStart = start + 2;
      nextEnd = nextStart + selected.length;
    }

    if (kind === "list") {
      const selected = value.slice(start, end) || "list item";
      nextValue = `${value.slice(0, start)}${selected
        .split("\n")
        .map((line) => `- ${line}`)
        .join("\n")}${value.slice(end)}`;
      nextStart = start + 2;
      nextEnd = nextStart + selected.length;
    }

    if (kind === "section") {
      const result = insertPlain(value, start, end, "\n\n---\n\n");
      nextValue = result.nextValue;
      nextStart = result.nextStart;
      nextEnd = result.nextEnd;
    }

    if (kind === "code") {
      const result = insertAround(value, start, end, "`", "`", "code");
      nextValue = result.nextValue;
      nextStart = result.nextStart;
      nextEnd = result.nextEnd;
    }

    onChange(nextValue);

    window.requestAnimationFrame(() => {
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(nextStart, nextEnd);

      window.scrollTo(scrollX, scrollY);
    });
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-3 py-2">
        <div className="text-sm font-semibold text-slate-100">{title}</div>

        <div className="flex items-center gap-2">
          <button
            className={mode === "write" ? "h-8 rounded-md bg-blue-600 px-3 text-xs text-white" : toolButtonClass}
            onClick={() => setMode("write")}
            type="button"
          >
            <PencilSquareIcon className="mr-1 inline h-4 w-4 align-text-bottom" />
            Write
          </button>
          <button
            className={mode === "preview" ? "h-8 rounded-md bg-blue-600 px-3 text-xs text-white" : toolButtonClass}
            onClick={() => setMode("preview")}
            type="button"
          >
            <EyeIcon className="mr-1 inline h-4 w-4 align-text-bottom" />
            Preview
          </button>
        </div>
      </div>

      {mode === "write" ? (
        <>
          <div className="flex flex-wrap gap-2 border-b border-slate-800 px-3 py-2">
            <button className={toolButtonClass} onClick={() => applyFormat("heading1")} title="Heading 1" type="button">
              H1
            </button>
            <button className={toolButtonClass} onClick={() => applyFormat("heading2")} title="Heading 2" type="button">
              H2
            </button>
            <button className={toolButtonClass} onClick={() => applyFormat("heading3")} title="Heading 3" type="button">
              H3
            </button>
            <button className={toolButtonClass} onClick={() => applyFormat("bold")} title="Bold" type="button">
              B
            </button>
            <button className={toolButtonClass} onClick={() => applyFormat("italic")} title="Italic" type="button">
              I
            </button>
            <button className={toolButtonClass} onClick={() => applyFormat("list")} title="Bulleted list" type="button">
              List
            </button>
            <button className={toolButtonClass} onClick={() => applyFormat("quote")} title="Quote" type="button">
              Quote
            </button>
            <button className={toolButtonClass} onClick={() => applyFormat("section")} title="Section" type="button">
              Section
            </button>
            <button className={toolButtonClass} onClick={() => applyFormat("code")} title="Inline code" type="button">
              Code
            </button>
          </div>
          <textarea
            ref={textareaRef}
            className="min-h-[140px] w-full resize-y rounded-b-lg border-0 bg-slate-950/60 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={disabled || submitting}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            rows={minRows}
            value={value}
          />
        </>
      ) : (
        <div className="min-h-[140px] px-4 py-3">
          <ForumMarkdown emptyText="Nothing to preview yet.">{value}</ForumMarkdown>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 px-3 py-3">
        <div className="text-xs text-slate-400">{footerNote}</div>
        <button
          className={submitClasses}
          disabled={!canSubmit}
          onClick={onSubmit}
          type="button"
        >
          <PaperAirplaneIcon className="h-4 w-4" />
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </div>
  );
}
