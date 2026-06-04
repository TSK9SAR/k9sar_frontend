import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AffiliationFilterBar from "./AffiliationFilterBar";
import { useSearchParams } from "react-router-dom";
import { apiFetch, apiJson } from "../lib/api";
import PageContainer from "./PageContainer";

type MatrixStatus =
  | "active"
  | "expired"
  | "revoked"
  | "rejected"
  | "pending"
  | "incomplete"
  | "expiring"
  | "suspended"
  | "none";

interface MatrixCell {
  expires: string | null;
  status: MatrixStatus;
  certification_id?: number | null;
  standard_id?: number | null;
  date_awarded?: string | null;
  location?: string | null;
  comment?: string | null;
  supervisor_id?: number | null;
  supervisor_name?: string | null;
  last_actor_name?: string | null;
  issuer_user_id?: number | null;
  last_actor_user_id?: number | null;
  has_prior_cert_for_discipline?: boolean;

  requires_co_evaluator?: boolean;
  co_evaluator_user_id?: number | null;
  co_evaluator_name?: string | null;
  co_evaluated_at?: string | null;
  co_evaluator_note?: string | null;
  can_co_evaluate?: boolean;
  evaluation_complete?: boolean;

  can_view?: boolean;
  can_revoke?: boolean;
  can_suspend?: boolean;
  can_unsuspend?: boolean;
  is_owner?: boolean;
}

interface MatrixTeam {
  team_id: number;
  handler_first: string;
  handler_last: string;
  dog_name: string;
  certifications: Record<string, MatrixCell>;
}

interface CertificationMatrixDto {
  disciplines: string[];
  standard_ids_by_discipline?: Record<string, number | null>;
  teams: MatrixTeam[];
}

interface MatrixTableProps {
  apiBaseUrl?: string;
  authToken?: string;
}

interface CurrentUser {
  id?: number;
  user_id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  is_supervisor?: boolean;
  is_admin?: boolean;
  roles?: any[];
  user_roles?: any[];
  allowed_standard_ids?: number[];
  [key: string]: any;
}

interface CertificationEvent {
  event_id: number;
  certification_id: number;
  event_type: string;

  previous_status?: string | null;
  new_status?: string | null;

  evaluation_complete_before?: boolean | null;
  evaluation_complete_after?: boolean | null;

  requires_co_evaluator_before?: boolean | null;
  requires_co_evaluator_after?: boolean | null;

  location_before?: string | null;
  location_after?: string | null;
  comment_before?: string | null;
  comment_after?: string | null;
  date_awarded_before?: string | null;
  date_awarded_after?: string | null;
  expires_at_before?: string | null;
  expires_at_after?: string | null;

  actor_user_id: number;
  actor_name?: string | null;

  note?: string | null;
  created_at: string;
}

type CertificationHistoryRow = {
  certification_id: number;

  team_id: number;
  team_name?: string | null;

  handler_name?: string | null;
  dog_name?: string | null;

  discipline_id?: number | null;
  discipline_name?: string | null;

  standard_id?: number | null;
  standard_name?: string | null;

  status: string;

  date_awarded?: string | null;
  effective_start?: string | null;
  expires_at?: string | null;
  issued_at?: string | null;

  location?: string | null;

  supervisor_id?: number | null;
  supervisor_name?: string | null;

  co_evaluator_user_id?: number | null;
  co_evaluator_name?: string | null;
  co_evaluated_at?: string | null;
  co_evaluator_note?: string | null;

  last_actor_user_id?: number | null;
  last_actor_name?: string | null;

  supervisor_signature_updated_at?: string | null;
  co_signature_updated_at?: string | null;

  comment?: string | null;
};

type CertificationHistoryResponse = {
  selected_certification_id: number;
  lineage_key: string;

  team_id: number;
  team_name?: string | null;
  handler_name?: string | null;
  dog_name?: string | null;

  discipline_id?: number | null;
  discipline_name?: string | null;

  rows: CertificationHistoryRow[];
};

type MultipartRequirementMode = "never" | "always" | "first_cert_only";

type Standard = {
  standard_id: number;
  discipline_id: number;
  name: string;
  effective_date?: string | null;
  summary_md?: string | null;
  url?: string | null;
  incomplete_days?: number | null;
  effective_days?: number | null;
  multipart_requirement_mode?: MultipartRequirementMode | null;
  discipline_name?: string | null;
  discipline_group_id?: number | null;
  discipline_group_name?: string | null;
};

type ActionMode =
  | "view"
  | "issue"
  | "update"
  | "correct"
  | "coapprove"
  | "coreject"
  | "revoke"
  | "suspend"
  | "unsuspend";

/** ---------- helpers ---------- */

function normalizeApiBase(input?: string) {
  const raw = (input ?? "").trim().replace(/\/+$/, "");
  if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
  if (!raw) return `${window.location.origin}/api`;
  if (window.location.protocol === "https:" && raw.startsWith("http://")) {
    return raw.replace(/^http:\/\//i, "https://");
  }
  return raw;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString();
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString();
}

function eventLabel(eventType: string): string {
  switch (eventType) {
    case "issued":
      return "Issued";
    case "updated_incomplete":
      return "Progress updated";
    case "updated_pending":
      return "Pending update";
    case "finalized":
      return "Final part submitted";
    case "co_approved":
      return "Co-evaluator approved";
    case "co_rejected":
      return "Co-evaluator rejected";
    case "revoked":
      return "Revoked";
    case "suspended":
      return "Suspended";
    case "unsuspended":
      return "Suspension removed";
    case "correction":
      return "Details corrected";
    default:
      return eventType.replace(/_/g, " ");
  }
}

function fmtDate(v?: string | null) {
  return v ? v.slice(0, 10) : "—";
}

function yesNo(v: boolean | null | undefined): string {
  if (v == null) return "—";
  return v ? "Yes" : "No";
}

function changed<T>(before: T | null | undefined, after: T | null | undefined): boolean {
  return (before ?? null) !== (after ?? null);
}

function renderValue(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s ? s : "—";
}

function statusLabel(status: MatrixStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "revoked":
      return "Revoked";
    case "pending":
      return "Pending";
    case "incomplete":
      return "Incomplete";
    case "expiring":
      return "Expiring soon";
    case "suspended":
      return "Suspended";
    case "rejected":
      return "Rejected";
    case "none":
    default:
      return "No cert";
  }
}

function statusClass(status: MatrixStatus): string {
  switch (status) {
    case "active":
      return "bg-emerald-900 text-emerald-100 border border-emerald-700";
    case "expiring":
      return "bg-amber-900/60 text-amber-100 border border-amber-700";
    case "expired":
      return "bg-red-900/60 text-red-100 border border-red-700";
    case "revoked":
      return "bg-slate-700 text-gray-300 border border-gray-600 line-through";
    case "pending":
      return "bg-yellow-900/60 text-yellow-100 border border-yellow-700";
    case "incomplete":
      return "bg-blue-900/60 text-blue-100 border border-blue-700";
    case "suspended":
      return "bg-purple-900/60 text-purple-100 border border-purple-700";
    case "rejected":
      return "bg-orange-900/60 text-orange-100 border border-orange-700";
    case "none":
    default:
      return "bg-slate-700 text-gray-200 border border-gray-600";
  }
}

function addDays(dateStr: string, days: number): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeDefaultExpirationDate(
  dateAwarded: string,
  evaluationComplete: boolean,
  standard?: {
    effective_days?: number | null;
    incomplete_days?: number | null;
  } | null
): string {
  if (!dateAwarded || !standard) return "";

  if (evaluationComplete) {
    const effectiveDays = Number(standard.effective_days ?? 0);
    return effectiveDays > 0 ? addDays(dateAwarded, effectiveDays) : "";
  }

  const incompleteDays = Number(standard.incomplete_days ?? 0);
  return incompleteDays > 0 ? addDays(dateAwarded, incompleteDays) : "";
}

function useLongPress(ms = 550) {
  const timerRef = React.useRef<number | null>(null);

  const start = (cb: () => void) => {
    // ignore if already running
    if (timerRef.current) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      cb();
    }, ms);
  };

  const clear = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return { start, clear };
}

function isTouchDevice() {
  return (
    typeof window !== "undefined" &&
    ("ontouchstart" in window || (navigator as any).maxTouchPoints > 0)
  );
}

function extractRoleStrings(u: CurrentUser | null): string[] {
  const roles = new Set<string>();
  if (!u || typeof u !== "object") return [];

  if (u.role && typeof u.role === "string") roles.add(u.role);

  const userRoles = Array.isArray(u.user_roles) ? u.user_roles : [];
  const altRoles = Array.isArray(u.roles) ? u.roles : [];

  for (const collection of [userRoles, altRoles]) {
    for (const r of collection) {
      if (!r) continue;
      if (typeof r === "string") roles.add(r);
      else if (typeof r === "object") {
        for (const key of ["name", "role", "role_name", "code", "title"]) {
          const val = (r as any)[key];
          if (val && typeof val === "string") roles.add(val);
        }
      }
    }
  }

  return Array.from(roles).map((s) => s.trim()).filter(Boolean);
}

function getMfaVerifiedFromStorage() {
  const token = localStorage.getItem("token"); // <-- token defined here
  if (!token) return false;

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return false;

    const payload = JSON.parse(atob(payloadPart));
    return payload && payload.mfa_verified === true;
  } catch (e) {
    return false;
  }
}

function isUserAdmin(u: CurrentUser | null): boolean {
  if (!u) return false;
  if (u.is_admin) return true;

  const roles = extractRoleStrings(u);
  return roles.some((raw) => {
    const lc = raw.toLowerCase();
    return lc === "admin" || lc.includes("admin");
  });
}

function canEvaluateStandard(u: CurrentUser | null, standardId: number): boolean {
  if (!u) return false;
  if (isUserAdmin(u)) return true;

  const allowed = Array.isArray(u.allowed_standard_ids) ? u.allowed_standard_ids : [];
  return allowed.includes(standardId);
}


function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    if (m.addEventListener) m.addEventListener("change", onChange);
    else (m as any).addListener(onChange);
    return () => {
      if (m.removeEventListener) m.removeEventListener("change", onChange);
      else (m as any).removeListener(onChange);
    };
  }, [query]);
  return matches;
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function pillClass(active: boolean) {
  return [
    "px-3 py-1.5 rounded-full text-sm border transition-colors",
    active
      ? "bg-slate-500 text-gray-100 border-emerald-500"
      : "bg-slate-700 text-gray-100 border-gray-100 hover:border-gray-200",
  ].join(" ");
}

function actionButtonClass(
  active: boolean,
  intent: "neutral" | "good" | "bad" = "neutral"
) {
  const base = "px-2 py-1 text-[11px] rounded border transition-colors";

  if (active) {
    if (intent === "good") {
      return `${base} border-emerald-500 bg-emerald-900/40 text-emerald-100`;
    }
    if (intent === "bad") {
      return `${base} border-red-500 bg-red-900/40 text-red-100`;
    }
    return `${base} border-slate-400 bg-slate-600 text-gray-100`;
  }

  if (intent === "good") {
    return `${base} border-emerald-700/50 bg-slate-800 text-emerald-200 hover:bg-slate-700`;
  }
  if (intent === "bad") {
    return `${base} border-red-700/50 bg-slate-800 text-red-200 hover:bg-slate-700`;
  }
  return `${base} border-gray-600 bg-slate-800 text-gray-300 hover:bg-slate-700`;
}

function getWorkflowWarning(cell: MatrixCell | null | undefined, nextMode: ActionMode) {
  if (!cell) return null;

  const allowedForPending: ActionMode[] = ["view", "coapprove", "coreject"];
  const allowedForIncomplete: ActionMode[] = ["view", "update"];

  if (cell.status === "pending" && !allowedForPending.includes(nextMode)) {
    return {
      title: `WARNING: This certification is PENDING`,
      expected: `Cancel and press \"APPROVE\" or \"DISAPPROVE\" to handle the pending co-evaluation`,
    };
  }

  if (cell.status === "incomplete" && !allowedForIncomplete.includes(nextMode)) {
    return {
      title: `WARNING: This certification is INCOMPLETE.`,
      expected: `Cancel and press \"CONTINUE EVALUATION\" to continue the incomplete evaluation`,
    };
  }

  return null;
}

function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  return !Number.isNaN(d.getTime());
}

function normalizeISODateOrEmpty(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  if (!s) return ""; // allow empty

  // If it's already a date-input value, keep it
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // If you ever feed it an ISO timestamp, convert it safely
  // e.g. "2026-02-22T00:00:00Z" -> "2026-02-22"
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];

  return ""; // anything else is not safe for <input type="date">
}

/** ---------- component ---------- */

export default function MatrixTable({ apiBaseUrl, authToken }: MatrixTableProps) {

  const timerRef = React.useRef<number | null>(null);

  function startLongPress(cb: () => void, ms = 550) {
    if (timerRef.current) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      cb();
    }, ms);
  }

  function clearLongPress() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }
  function getCellBaseClass(cell: MatrixCell) {
    switch (cell.status) {
      case "active":
        return "bg-green-800/70";
      case "expired":
        return "bg-red-800/40";
      case "pending":
        return "bg-yellow-700/40";
      case "incomplete":
        return "bg-blue-900/40 text-blue-200";
      case "rejected":
        return "bg-orange-800/40";
      case "revoked":
        return "bg-slate-700/40";
      case "suspended":
        return "bg-purple-800/40";
      case "expiring":
        return "bg-amber-800/40";
      default:
        return "bg-slate-800/40";
    }
  }

  function getCellFillClass(cell: MatrixCell) {
    switch (cell.status) {
      case "active":
        return "bg-green-900/20";
      case "expired":
        return "bg-red-900/20";
      case "pending":
        return "bg-yellow-800/20";
      case "incomplete":
        return "bg-blue-900/20";
      case "revoked":
        return "bg-slate-700/20";
      default:
        return "bg-transparent";
    }
  }

  function isTouchDevice() {
    return (
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0)
    );
  }

  // function requestActionMode(nextMode: ActionMode) {
  //   const warning = getWorkflowWarning(selectedCell?.cell, nextMode);

  //   if (warning) {
  //     const ok = window.confirm(
  //       `WARNING: Workflow Conflict!\n\n` +
  //       `${warning.title}\n\n` +
  //       `Expected next step: ${warning.expected}.\n\n` +
  //       `Continuing with the \"Issue new\" action will create a\nduplicate or incorrect certification record.\n\n` +
  //       `Press OK to override, or Cancel to stop.`
  //     );

  //     if (!ok) return false;
  //   }

  //   setActionMode(nextMode);
  //   setActionError(null);
  //   return true;
  // }

  const isMobile = useMediaQuery("(max-width: 767px)");

  const [data, setData] = useState<CertificationMatrixDto | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCell, setSelectedCell] = useState<{
    team: MatrixTeam;
    discipline: string;
    cell: MatrixCell;
  } | null>(null);

  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const hint = isTouchDevice()
    ? "Press and hold to open"
    : "Right-click or press and hold";
  const [actionMode, setActionMode] = useState<ActionMode>("view");

  const [issueExpiresError, setIssueExpiresError] = useState<string | null>(null)
  const [issueAwardedError, setIssueAwardedError] = useState<string | null>(null);
  const canPrint = !["revoked", "expired", "rejected"].includes(selectedCell?.cell?.status ?? "");

  // Issue form
  const [issueRequiresCoEvaluator, setIssueRequiresCoEvaluator] = useState(false);
  const [coEvaluateNote, setCoEvaluateNote] = useState("");
  const [issueDateAwarded, setIssueDateAwarded] = useState<string>("");
  const [issueExpiresAt, setIssueExpiresAt] = useState<string>("");
  const [issueDocumentUrl, setIssueDocumentUrl] = useState<string>("");
  const [issueLocation, setIssueLocation] = useState<string>("");
  const [issueComment, setIssueComment] = useState<string>("");

  const [issueStandard, setIssueStandard] = useState<Standard | null>(null);
  const [issueExpirationTouched, setIssueExpirationTouched] = useState(false);
  const [evaluationComplete, setEvaluationComplete] = useState(true);

  const [sp] = useSearchParams();
  const affiliationId = sp.get("affiliation_id"); // string | null
  const lp = useLongPress(550);
  const [returnToHistoryOnClose, setReturnToHistoryOnClose] = useState(false);

  const [workflowWarning, setWorkflowWarning] = useState<{
    title: string;
    expected: string;
    nextMode: ActionMode;
  } | null>(null);

  // Search + expand
  const [query, setQuery] = useState("");
  const [expandedTeams, setExpandedTeams] = useState<Record<number, boolean>>({});

  // Discipline multi-select (like PublicMatrixTable)
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [allDisciplines, setAllDisciplines] = useState<string[]>([]);

  const effectiveBaseUrl = normalizeApiBase(apiBaseUrl ?? (import.meta as any)?.env?.VITE_API_BASE_URL);
  if (!effectiveBaseUrl) {
    throw new Error("MatrixTable: apiBaseUrl is missing. Check MatrixPage and VITE_API_BASE_URL.");
  }

  const token = authToken ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);
  const nav = useNavigate();
  const isAdmin = isUserAdmin(currentUser);

  const canEvaluateSelectedCell = useMemo(() => {
    if (!selectedCell) return false;
    const standardId = selectedCell.cell.standard_id;
    if (!standardId) return false;
    return canEvaluateStandard(currentUser, standardId);
  }, [currentUser, selectedCell]);

  const mfaVerified = getMfaVerifiedFromStorage();

  const isOwnerOfSelectedCell = !!selectedCell?.cell?.is_owner;
  const canRevoke = !!selectedCell?.cell?.can_revoke && (mfaVerified || isOwnerOfSelectedCell) && canPrint;
  const canSuspend = !!selectedCell?.cell?.can_suspend && (mfaVerified || isOwnerOfSelectedCell) && canPrint;
  const canUnsuspend = !!selectedCell?.cell?.can_unsuspend && (mfaVerified || isOwnerOfSelectedCell) && canPrint;
  const canModifyPending = (canEvaluateSelectedCell || isAdmin) && !isOwnerOfSelectedCell && mfaVerified;
  const canIssue = (canEvaluateSelectedCell || isAdmin) && !isOwnerOfSelectedCell && mfaVerified;

  const isEvaluator =
    !isAdmin &&
    Array.isArray(currentUser?.allowed_standard_ids) &&
    currentUser.allowed_standard_ids.length > 0 && mfaVerified;

  const isAdminMFA = isAdmin && mfaVerified;

  const currentUserId = currentUser?.user_id ?? currentUser?.id ?? null;
  const incompleteDays = Number(issueStandard?.incomplete_days ?? 0);
  const multipartMode = issueStandard?.multipart_requirement_mode ?? "never";

  const multipartApplies =
    incompleteDays > 0 &&
    (
      multipartMode === "always" ||
      (
        multipartMode === "first_cert_only" &&
        !selectedCell?.cell?.has_prior_cert_for_discipline
      )
    );

  const allowIncomplete = multipartApplies;

  const isCurrentIssuer =
    !!selectedCell?.cell?.supervisor_id &&
    !!selectedCell?.cell?.last_actor_user_id &&
    !!currentUserId &&
    Number(selectedCell.cell.supervisor_id) === Number(currentUserId) &&
    Number(selectedCell.cell.last_actor_user_id) === Number(currentUserId);

  const isExpiredOrRevoked =
    selectedCell?.cell?.status === "expired" ||
    selectedCell?.cell?.status === "revoked" ||
    selectedCell?.cell?.status === "rejected";

  const canCorrect =
    !!selectedCell?.cell?.certification_id &&
    !isExpiredOrRevoked &&
    (isAdminMFA || isCurrentIssuer);

  const [returnToHistoryOnAuditClose, setReturnToHistoryOnAuditClose] = useState(false);

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<CertificationEvent[]>([]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<CertificationHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);


  async function openHistory(certId: number) {
    try {
      setHistoryLoading(true);
      setHistoryError(null);

      const data = await apiJson(`/certifications/${certId}/history`);
      // console.log("history certId", certId);
      // console.log("history payload top", data);
      // console.log("history first row", data?.rows?.[0]);

      setHistoryData(data);
      setHistoryOpen(true);
    } catch (err: any) {
      console.error("openHistory error", err);
      setHistoryError(err?.message || "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  }

  function closeAuditModal() {
    setAuditOpen(false);
    setAuditError(null);
    setAuditEvents([]);

    if (returnToHistoryOnAuditClose) {
      setReturnToHistoryOnAuditClose(false);
      setHistoryOpen(true);
      return;
    }
  }


  async function openAuditFromHistory(row: CertificationHistoryRow) {
    if (!selectedCell) return;

    setSelectedCell((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        discipline: row.discipline_name ?? prev.discipline,
        cell: {
          ...prev.cell,
          certification_id: row.certification_id ?? null,
          standard_id: row.standard_id ?? null,
          status: (row.status ?? "none") as MatrixStatus,
          expires: row.expires_at ?? null,
          date_awarded: row.date_awarded ?? null,
          location: row.location ?? null,
          comment: row.comment ?? null,
          supervisor_id: row.supervisor_id ?? null,
          supervisor_name: row.supervisor_name ?? null,
          last_actor_name: row.last_actor_name ?? null,
          requires_co_evaluator:
            !!row.co_evaluator_user_id || !!row.co_evaluated_at || !!row.co_evaluator_note,
          co_evaluator_user_id: row.co_evaluator_user_id ?? null,
          co_evaluator_name: row.co_evaluator_name ?? null,
          co_evaluated_at: row.co_evaluated_at ?? null,
          co_evaluator_note: row.co_evaluator_note ?? null,

          can_view: true,
          can_revoke: false,
          can_suspend: false,
          can_unsuspend: false,
          can_co_evaluate: false,
          evaluation_complete: true,
        },
      };
    });

    setReturnToHistoryOnClose(true);
    setHistoryOpen(false);
    setAuditError(null);
    setAuditEvents([]);
    setAuditOpen(true);

    await loadAuditTrail(row.certification_id);
  }

  const isCoEvaluatorPending =
    selectedCell?.cell?.status === "pending" &&
    !!selectedCell?.cell?.requires_co_evaluator;

  const canCoEvaluateSelectedCell =
    !!selectedCell?.cell?.certification_id &&
    !!selectedCell?.cell?.can_co_evaluate &&
    isCoEvaluatorPending &&
    mfaVerified;

  const triggerReload = () => setReloadToken((x) => x + 1);

  const LONG_PRESS_MS = 150;
  const MOVE_THRESHOLD = 6;

  const pressTimerRef = React.useRef<number | null>(null);
  const pressStartRef = React.useRef<{ x: number; y: number; moved: boolean }>({
    x: 0,
    y: 0,
    moved: false,
  });

  function startPressTimer(cb: () => void, x: number, y: number) {
    clearPressTimer();
    pressStartRef.current = { x, y, moved: false };

    pressTimerRef.current = window.setTimeout(() => {
      pressTimerRef.current = null;
      if (!pressStartRef.current.moved) cb();
    }, LONG_PRESS_MS);
  }

  function clearPressTimer() {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  function updatePressMovement(x: number, y: number) {
    const dx = Math.abs(x - pressStartRef.current.x);
    const dy = Math.abs(y - pressStartRef.current.y);

    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      pressStartRef.current.moved = true;
      clearPressTimer();
    }
  }

  function toggleDiscipline(d: string) {
    setSelectedDisciplines((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function incompleteNeedsComment(evaluationComplete: boolean, comment: string) {
    if (evaluationComplete) return false;
    return !comment || comment.trim().length === 0;
  }

  function normalizeRequiredText(v: string | null | undefined): string {
    return (v ?? "").trim();
  }

  function openCellFromRightClick(
    e: React.MouseEvent,
    team: MatrixTeam,
    disc: string,
    cell: MatrixCell
  ) {
    e.preventDefault();   // block browser context menu
    e.stopPropagation();  // don't bubble into scroll handlers
    openCellModal(team, disc, cell);
  }

  useEffect(() => {
    if (actionMode !== "issue" && actionMode !== "update" && actionMode !== "correct") return;

    const standardId = selectedCell?.cell?.standard_id;

    if (!standardId) {
      setIssueStandard(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const data = await apiJson(`/standards/${standardId}`);

        if (cancelled) return;

        setIssueStandard(data ?? null);

        const incompleteDays = Number(data?.incomplete_days ?? 0);
        const multipartMode = data?.multipart_requirement_mode ?? "never";

        const hasPrior =
          selectedCell?.cell?.has_prior_cert_for_discipline === true;

        const multipartApplies =
          incompleteDays > 0 &&
          (
            multipartMode === "always" ||
            (
              multipartMode === "first_cert_only" &&
              !hasPrior
            )
          );

        if (!multipartApplies) {
          setEvaluationComplete(true);
        } else if (actionMode === "issue") {
          setEvaluationComplete(false);
        } else if (actionMode === "update" || actionMode === "correct") {
          // leave existing value alone, unless you explicitly want a default here
        }
      } catch {
        if (!cancelled) {
          setIssueStandard(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [actionMode, selectedCell?.cell?.standard_id]);


  useEffect(() => {
    if (actionMode !== "issue" && actionMode !== "update") return;
    if (!issueDateAwarded) return;
    if (issueExpirationTouched) return;

    const nextExpiration = computeDefaultExpirationDate(
      issueDateAwarded,
      !!evaluationComplete,
      issueStandard
    );

    setIssueExpiresAt(nextExpiration || "");
  }, [actionMode, issueDateAwarded, evaluationComplete, issueStandard, issueExpirationTouched]);

  /** Load current user */
  useEffect(() => {
    if (!token || !effectiveBaseUrl) {
      setUserLoaded(true);
      return;
    }

    const fetchMe = async () => {
      try {
        const resp = await fetch(`${effectiveBaseUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) {
          setUserLoaded(true);
          return;
        }
        const json = (await resp.json()) as CurrentUser;
        setCurrentUser(json);
      } catch {
        // ignore
      } finally {
        setUserLoaded(true);
      }
    };

    fetchMe();
  }, [effectiveBaseUrl, token]);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef({ down: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });

  function onDragStart(e: React.MouseEvent) {
    if (e.button !== 0) return; // left button only
    const el = scrollRef.current;
    if (!el) return;

    dragRef.current.down = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.startLeft = el.scrollLeft;
    dragRef.current.startTop = el.scrollTop;

    // prevent text selection while dragging
    e.preventDefault();
  }

  function onDragMove(e: React.MouseEvent) {
    const el = scrollRef.current;
    if (!el) return;
    if (!dragRef.current.down) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    el.scrollLeft = dragRef.current.startLeft - dx;
    el.scrollTop = dragRef.current.startTop - dy;
  }

  function onDragEnd() {
    dragRef.current.down = false;
  }

  /** Load matrix */
  useEffect(() => {
    if (!token || !effectiveBaseUrl) {
      setError("No auth token or API base URL available. Please log in first.");
      return;
    }

    let alive = true;

    const fetchMatrix = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(`${effectiveBaseUrl}/certifications/matrix`);
        if (affiliationId) url.searchParams.set("affiliation_id", String(affiliationId));

        const resp = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${text}`);
        }

        const json = (await resp.json()) as CertificationMatrixDto;
        if (!alive) return;

        setData(json);

        // Capture master disciplines once (or when empty)
        if (allDisciplines.length === 0 && (json.disciplines?.length ?? 0) > 0) {
          setAllDisciplines(json.disciplines);
        }
      } catch (err: any) {
        console.error("Failed to load matrix:", err);
        if (!alive) return;
        setError(err?.message ?? "Failed to load matrix");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    fetchMatrix();

    return () => {
      alive = false;
    };
  }, [effectiveBaseUrl, token, affiliationId, reloadToken, allDisciplines.length]);

  /** Open modal and initialize forms */
  const openCellModal = (team: MatrixTeam, discipline: string, cell: MatrixCell) => {
    setSelectedCell({ team, discipline, cell });
    setActionError(null);
    setActionMode("view");
    setAuditOpen(false);
    setAuditLoading(false);
    setAuditError(null);
    setAuditEvents([]);
    setHistoryOpen(false);
    setHistoryError(null);
    setHistoryData(null);
    setReturnToHistoryOnClose(false);
    setAuditLoading(false);
    setAuditError(null);
    setAuditEvents([]);
    setIssueStandard(null);
    setIssueExpirationTouched(false);


    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);

    const cellAwarded = normalizeISODateOrEmpty(cell.date_awarded ?? "");
    const cellExpires = normalizeISODateOrEmpty(cell.expires ?? "");

    setIssueDateAwarded(cellAwarded || todayISO);
    setIssueExpiresAt(cellExpires || "");
    setIssueLocation(cell.location ?? "");
    setIssueComment(cell.comment ?? "");
    setIssueDocumentUrl("");
    setIssueRequiresCoEvaluator(!!cell.requires_co_evaluator);
    setCoEvaluateNote("");

    setEvaluationComplete(
      cell.evaluation_complete ?? (cell.status !== "incomplete")
    );

    setIssueAwardedError(null);
    setIssueExpiresError(null);
  };


  /** ---------- Actions ---------- */
  const handleIssue = async () => {
    if (!selectedCell) return;
    if (!token || !effectiveBaseUrl) {
      setActionError("Not authenticated or API base URL missing.");
      return;
    }

    const { team, cell } = selectedCell;
    const standardId = cell.standard_id;

    if (!standardId) {
      setActionError("Cannot issue: matrix cell has no standard_id.");
      return;
    }
    if (!issueDateAwarded) {
      setActionError("Please select a 'Date awarded'.");
      return;
    }
    if (!isValidISODate(issueDateAwarded)) {
      setActionError("Date awarded is invalid.");
      return;
    }
    if (!issueExpiresAt) {
      setActionError("Please select an 'Expiration Date'.");
      return;
    }
    if (!isValidISODate(issueExpiresAt)) {
      setActionError("Expiration Date is invalid.");
      return;
    }

    if (incompleteNeedsComment(evaluationComplete, issueComment)) {
      setActionError("Incomplete evaluations require a comment describing what remains to be completed.");
      return;
    }

    const normalizedLocation = normalizeRequiredText(issueLocation);

    if (!normalizedLocation) {
      setActionError("Location is required.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      const derivedStatus =
        issueRequiresCoEvaluator
          ? "pending"
          : (evaluationComplete ? "active" : "incomplete");

      const payload: any = {
        team_id: team.team_id,
        standard_id: standardId,
        date_awarded: issueDateAwarded,
        expires_at: issueExpiresAt,
        status: derivedStatus,
        requires_co_evaluator: issueRequiresCoEvaluator,
        evaluation_complete: evaluationComplete,
      };

      if (issueDocumentUrl) payload.document_url = issueDocumentUrl;
      payload.location = normalizedLocation;
      if (issueComment) payload.comment = issueComment;

      const resp = await fetch(`${effectiveBaseUrl}/certifications/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Issue failed: HTTP ${resp.status}: ${text}`);
      }

      triggerReload();
      setSelectedCell(null);
    } catch (err: any) {
      console.error("Issue certification failed:", err);
      setActionError(err?.message ?? "Issue certification failed");
    } finally {
      setActionLoading(false);
    }
  };
  const handleCoEvaluate = async (action: "approve" | "reject") => {
    if (!selectedCell?.cell?.certification_id) {
      setActionError("No pending certification selected.");
      return;
    }
    if (selectedCell.cell.status !== "pending") {
      setActionError("Only pending certifications can be co-evaluated.");
      return;
    }
    if (!token || !effectiveBaseUrl) {
      setActionError("Not authenticated or API base URL missing.");
      return;
    }
    if (action === "reject" && !coEvaluateNote.trim()) {
      setActionError("A note is required when rejecting.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      const resp = await fetch(
        `${effectiveBaseUrl}/certifications/${selectedCell.cell.certification_id}/co-evaluate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action,
            note: coEvaluateNote.trim() || null,
          }),
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Co-evaluate failed: HTTP ${resp.status}: ${text}`);
      }

      triggerReload();
      setSelectedCell(null);
    } catch (err: any) {
      console.error("Co-evaluate failed:", err);
      setActionError(err?.message ?? "Co-evaluate failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateWorkInProgress = async () => {
    if (!selectedCell?.cell?.certification_id) {
      setActionError("No certification selected.");
      return;
    }

    if (!["pending", "incomplete"].includes(selectedCell.cell.status)) {
      setActionError("Only pending or incomplete certifications can be updated.");
      return;
    }

    if (!token || !effectiveBaseUrl) {
      setActionError("Not authenticated or API base URL missing.");
      return;
    }

    if (!issueDateAwarded) return setActionError("Please select a 'Date awarded'.");
    if (!isValidISODate(issueDateAwarded)) return setActionError("Date awarded is invalid.");

    if (!issueExpiresAt) return setActionError("Please select an 'Expiration Date'.");
    if (!isValidISODate(issueExpiresAt)) return setActionError("Expiration Date is invalid.");

    if (incompleteNeedsComment(evaluationComplete, issueComment)) {
      setActionError("Incomplete evaluations require a comment describing what remains to be completed.");
      return;
    }

    const normalizedLocation = normalizeRequiredText(issueLocation);

    if (!normalizedLocation) {
      setActionError("Location is required.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      const derivedStatus =
        issueRequiresCoEvaluator
          ? "pending"
          : (evaluationComplete ? "active" : "incomplete");

      const payload: any = {
        status: derivedStatus,
        date_awarded: issueDateAwarded,
        expires_at: issueExpiresAt,
        location: normalizedLocation,
        comment: issueComment || null,
        evaluation_complete: evaluationComplete,
        requires_co_evaluator: issueRequiresCoEvaluator,
      };

      const url = `${effectiveBaseUrl}/certifications/${selectedCell.cell.certification_id}`;
      const resp = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Update failed: HTTP ${resp.status}: ${text}`);
      }

      triggerReload();
      setSelectedCell(null);
    } catch (err: any) {
      console.error("Update failed:", err);
      setActionError(err?.message ?? "Update failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedCell || !selectedCell.cell.certification_id) {
      setActionError("No certification to revoke: missing certification_id.");
      return;
    }
    if (!token || !effectiveBaseUrl) {
      setActionError("Not authenticated or API base URL missing.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      const resp = await fetch(`${effectiveBaseUrl}/certifications/${selectedCell.cell.certification_id}/revoke`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "revoked" }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Revoke failed: HTTP ${resp.status}: ${text}`);
      }

      triggerReload();
      setSelectedCell(null);
    } catch (err: any) {
      console.error("Revoke failed:", err);
      setActionError(err?.message ?? "Revoke failed");
    } finally {
      setActionLoading(false);
    }
  };

  const loadAuditTrail = async (certificationId: number) => {
    if (!token || !effectiveBaseUrl) {
      setAuditError("Not authenticated or API base URL missing.");
      return;
    }

    try {
      setAuditLoading(true);
      setAuditError(null);

      const resp = await fetch(
        `${effectiveBaseUrl}/certifications/${certificationId}/events`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Audit load failed: HTTP ${resp.status}: ${text}`);
      }

      const data = (await resp.json()) as CertificationEvent[];
      setAuditEvents(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Audit load failed:", err);
      setAuditError(err?.message ?? "Audit load failed");
      setAuditEvents([]);
    } finally {
      setAuditLoading(false);
    }
  };

  /** ---------- Derived + filters ---------- */

  const [onlyCertified, setOnlyCertified] = useState(true);


  const filteredTeams = useMemo(() => {
    if (!data?.teams) return [];

    // 1) Text search
    const q = query.trim().toLowerCase();
    let teams = !q
      ? data.teams
      : data.teams.filter((t) => {
        const name = `${t.handler_first} ${t.handler_last}`.toLowerCase();
        const dog = (t.dog_name || "").toLowerCase();
        return name.includes(q) || dog.includes(q) || `${t.team_id}`.includes(q);
      });

    // 2) Determine which disciplines count as "selected criteria"
    const disciplinesForFilter =
      selectedDisciplines.length
        ? selectedDisciplines
        : allDisciplines.length
          ? allDisciplines
          : data.disciplines ?? [];

    // 3) OnlyCertified toggle:
    // keep team if ANY discipline cell has a real cert (status != "none")
    // if (onlyCertified) {
    //   teams = teams.filter((t) =>
    //     disciplinesForFilter.some((disc) => {
    //       const cell = t.certifications?.[disc];
    //       return !!cell && cell.status !== "none";
    //     })
    //   );
    // }

    if (onlyCertified) {
      teams = teams.filter((t) =>
        disciplinesForFilter.some((disc) => {
          const cell = t.certifications?.[disc];
          return !!cell?.certification_id;
        })
      );
    }

    return teams;
  }, [data, query, onlyCertified, selectedDisciplines, allDisciplines]);


  const handleSuspend = async () => {
    if (!selectedCell?.cell?.certification_id) {
      setActionError("No certification selected to suspend.");
      return;
    }
    if (!token || !effectiveBaseUrl) {
      setActionError("Not authenticated or API base URL missing.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      const resp = await fetch(
        `${effectiveBaseUrl}/certifications/${selectedCell.cell.certification_id}/suspend`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Suspend failed: HTTP ${resp.status}: ${text}`);
      }

      triggerReload();
      setSelectedCell(null);
    } catch (err: any) {
      console.error("Suspend failed:", err);
      setActionError(err?.message ?? "Suspend failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspend = async () => {
    if (!selectedCell?.cell?.certification_id) {
      setActionError("No certification selected to reactivate.");
      return;
    }
    if (!token || !effectiveBaseUrl) {
      setActionError("Not authenticated or API base URL missing.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      const resp = await fetch(
        `${effectiveBaseUrl}/certifications/${selectedCell.cell.certification_id}/unsuspend`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Reactivate failed: HTTP ${resp.status}: ${text}`);
      }

      triggerReload();
      setSelectedCell(null);
    } catch (err: any) {
      console.error("Reactivate failed:", err);
      setActionError(err?.message ?? "Reactivate failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCorrectCertification = async () => {
    if (!selectedCell?.cell?.certification_id) {
      setActionError("No certification selected.");
      return;
    }

    if (!token || !effectiveBaseUrl) {
      setActionError("Not authenticated or API base URL missing.");
      return;
    }

    if (!issueDateAwarded) return setActionError("Please select a 'Date awarded'.");
    if (!isValidISODate(issueDateAwarded)) return setActionError("Date awarded is invalid.");

    if (!issueExpiresAt) return setActionError("Please select an 'Expiration Date'.");
    if (!isValidISODate(issueExpiresAt)) return setActionError("Expiration Date is invalid.");

    const normalizedLocation = normalizeRequiredText(issueLocation);
    if (!normalizedLocation) {
      setActionError("Location is required.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);

      const originalAwarded = normalizeISODateOrEmpty(
        selectedCell.cell.date_awarded ?? ""
      );

      const originalExpires = normalizeISODateOrEmpty(
        selectedCell.cell.expires ?? ""
      );

      const payload: any = {
        location: normalizedLocation,
        comment: issueComment || null,
        evaluation_complete: evaluationComplete,
        requires_co_evaluator: issueRequiresCoEvaluator,
      };

      if (issueDateAwarded !== originalAwarded) {
        payload.date_awarded = issueDateAwarded;
      }

      if (issueExpiresAt !== originalExpires) {
        payload.expires_at = issueExpiresAt;
      }

      const resp = await fetch(
        `${effectiveBaseUrl}/certifications/${selectedCell.cell.certification_id}/correction`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Correction failed: HTTP ${resp.status}: ${text}`);
      }

      triggerReload();
      setSelectedCell(null);
    } catch (err: any) {
      console.error("Correction failed:", err);
      setActionError(err?.message ?? "Correction failed");
    } finally {
      setActionLoading(false);
    }
  };

  const pillSource = allDisciplines.length ? allDisciplines : data?.disciplines ?? [];

  const pillDisciplines = useMemo(() => {
    const selectedSet = new Set(selectedDisciplines);

    const selected: string[] = [];
    const unselected: string[] = [];

    for (const d of pillSource) {
      if (selectedSet.has(d)) selected.push(d);
      else unselected.push(d);
    }

    return [...selected, ...unselected];
  }, [pillSource, selectedDisciplines]);

  const tableDisciplines = useMemo(() => {
    const base = allDisciplines.length ? allDisciplines : data?.disciplines ?? [];
    return selectedDisciplines.length ? selectedDisciplines : base;
  }, [selectedDisciplines, allDisciplines, data?.disciplines]);


  const allExpanded = useMemo(() => {
    if (!filteredTeams.length) return false;
    return filteredTeams.every((t) => expandedTeams[t.team_id]);
  }, [filteredTeams, expandedTeams]);

  const toggleAllExpanded = () => {
    const next: Record<number, boolean> = {};
    for (const t of filteredTeams) next[t.team_id] = !allExpanded;
    setExpandedTeams(next);
  };

  function HistoryCard({
    row,
    onView,
    onAudit,
  }: {
    row: CertificationHistoryRow;
    onView: (certId: number) => void;
    onAudit: (row: CertificationHistoryRow) => void;
  }) {
    function fmtDate(v?: string | null) {
      return v ? v.slice(0, 10) : "—";
    }

    const status = (row.status || "none").trim().toLowerCase();

    const statusClass =
      status === "active"
        ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"
        : ["pending", "incomplete", "expiring"].includes(status)
          ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25"
          : ["revoked", "rejected"].includes(status)
            ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25"
            : status === "expired"
              ? "bg-zinc-500/20 text-red-200 ring-1 ring-zinc-400/30"
              : status === "suspended"
                ? "bg-slate-500/15 text-blue-300 ring-1 ring-slate-400/25"
                : "bg-slate-700/40 text-slate-200 ring-1 ring-slate-600/30";

    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/90 p-3 shadow-sm">
        {/* top row */}
        <div className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-start gap-x-3 gap-y-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-100">
              {row.discipline_name || "—"}
            </div>
            <div className="truncate text-xs text-slate-400">
              {row.standard_name || "—"}
            </div>
          </div>

          <div className="flex justify-center">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${statusClass}`}
            >
              {row.status || "—"}
            </span>
          </div>

          <div className="flex justify-end gap-1">
            <button
              type="button"
              className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-100 bg-slate-800 hover:bg-slate-700"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onView(row.certification_id);
              }}
            >
              View
            </button>

            <button
              type="button"
              className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-100 bg-slate-800 hover:bg-slate-700"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAudit(row);
              }}
            >
              Audit
            </button>
          </div>
        </div>

        {/* second row */}
        <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
          <div className="text-slate-300">
            <span className="text-slate-400">Evaluator:</span>{" "}
            <span className="text-slate-100">{row.supervisor_name || "—"}</span>
          </div>

          <div className="text-slate-300">
            <span className="text-slate-400">Awarded:</span>{" "}
            <span className="text-slate-100">{fmtDate(row.date_awarded)}</span>
          </div>

          <div className="text-slate-300 ">
            <span className="text-slate-400">Expires:</span>{" "}
            <span className="text-slate-100">{fmtDate(row.expires_at)}</span>
          </div>

          <div className="col-span-3 text-slate-300">
            <span className="text-slate-400">Location:</span>{" "}
            <span className="text-slate-100 break-words">{row.location ?? "—"}</span>
          </div>

          {(row.co_evaluator_name || row.co_evaluated_at) && (
            <div className="col-span-3 text-slate-300">
              <span className="text-slate-400">Co-evaluator:</span>{" "}
              <span className="text-slate-100">{row.co_evaluator_name || "—"}</span>
              {row.co_evaluated_at && (
                <>
                  <span className="text-slate-500"> · </span>
                  <span className="text-slate-300">{fmtDate(row.co_evaluated_at)}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /** ---------- UI states ---------- */

  if (loading) {
    return <div className="p-4 text-sm text-gray-200">Loading certification matrix…</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-200 bg-red-900/30 border border-red-700 rounded">
        Error loading matrix: {error}
      </div>
    );
  }

  if (!data || !data.teams?.length || !data.disciplines?.length) {
    return (
      <div className="p-4 text-sm text-gray-200 border border-gray-600 rounded bg-slate-700">
        No certification data available yet.
      </div>
    );
  }

  const certId = selectedCell?.cell?.certification_id ?? null;

  const canView =
    !!selectedCell?.cell?.certification_id && !!selectedCell?.cell?.can_view;



  /** ---------- Render ---------- */

  return (
    <>
      {/* <PageContainer maxWidth="full"> */}
      <div className="w-full text-left space-y-6">
        {/* Title + permissions */}
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">
            <span className="text-emerald-400">TSK9SAR</span>{" "}
            <span className="text-slate-100">Certification Matrix</span>
          </h1>

          {userLoaded && (
            <div className="text-xs text-gray-300">
              Permissions:{" "}
              {isAdmin ? (
                <span className={isAdminMFA ? "text-emerald-200 font-medium" : "text-gray-300"}>
                  {isAdminMFA ? "Admin - can manage all certifications" : "View only"}
                </span>
              ) : (
                <span className={isEvaluator ? "text-emerald-200 font-medium" : "text-gray-300"}>
                  {isEvaluator ? "Evaluator - can manage certifications" : "View only"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Search + expand/collapse */}
        {/* Search + controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* LEFT cluster */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search handler / dog / team id…"
              className="w-max md:w-80 rounded-lg border border-slate-100 px-3 py-2 text-sm bg-slate-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {query && (
              <button type="button" className={pillClass(false)} onClick={() => setQuery("")}>
                Clear
              </button>
            )}

            {/* Desktop placement */}
            {!isMobile && (
              <button
                type="button"
                onClick={() => setOnlyCertified((v) => !v)}
                className={[
                  "px-3 py-1.5 rounded-full text-sm border transition-colors",
                  onlyCertified
                    ? "bg-green-900 text-slate-100 border-slate-300 hover:border-slate-100"
                    : "bg-slate-700 text-slate-100 border-slate-300",
                ].join(" ")}
                aria-pressed={onlyCertified}
                title="Hide handlers with no matching certifications"
              >
                Only certified
              </button>
            )}
          </div>

          {/* RIGHT cluster (mobile) */}
          <div className="flex items-center gap-2">
            {isMobile && (
              <button
                type="button"
                onClick={() => setOnlyCertified((v) => !v)}
                className={[
                  "px-3 py-1.5 rounded-full text-sm border transition-colors",
                  onlyCertified
                    ? "bg-slate-400 text-slate-100 border-green-700 hover:border-slate-100"
                    : "bg-slate-700 text-slate-100 border-slate-300",
                ].join(" ")}
                aria-pressed={onlyCertified}
              >
                Only certified
              </button>
            )}

            {isMobile && (
              <button type="button" className={pillClass(false)} onClick={toggleAllExpanded}>
                {allExpanded ? "Collapse all" : "Expand all"}
              </button>
            )}
          </div>
        </div>


        {/* Discipline filter pills (multi-select) */}
        <div className="flex max-w flex-wrap gap-2">
          {pillDisciplines.map((d) => {
            const active = selectedDisciplines.includes(d);
            return (
              <button key={d} type="button" onClick={() => toggleDiscipline(d)} className={pillClass(active)}>
                {d}
              </button>
            );
          })}
        </div>

        {selectedDisciplines.length > 0 && (
          <div>
            <button type="button" className={pillClass(false)} onClick={() => setSelectedDisciplines([])}>
              Clear disciplines
            </button>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-[11px] text-gray-200">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded border border-emerald-700 bg-emerald-900" /> Active
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded border border-yellow-700 bg-yellow-900/60" /> Pending
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded border border-blue-700 bg-blue-900/60" /> Incomplete
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded border border-amber-700 bg-amber-900/60" /> Expiring
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded border border-red-700 bg-red-900/60" /> Expired
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded border border-purple-700 bg-purple-900/60" /> Suspended
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded border border-orange-700 bg-orange-900/60" /> Rejected
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded border border-gray-600 bg-slate-700" /> Revoked
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded border border-gray-600 bg-slate-700" /> None
          </span>
        </div>

        <AffiliationFilterBar fetchPath="/public/affiliations" showCallout={false} />

        {/* Main content */}
        {!isMobile ? (
          <div
            ref={scrollRef}
            className="overflow-auto border border-gray-700 rounded-xl bg-slate-850 cursor-grab active:cursor-grabbing select-none  max-h-[800px] overflow-y-auto"
            onMouseDown={onDragStart}
            onMouseMove={onDragMove}
            onMouseUp={onDragEnd}
            onMouseLeave={onDragEnd}
          >
            <table className="border-collapse table-fixed text-[11px] text-gray-100 bg-slate-700">
              <colgroup>
                <col className="w-[240px]" />
                {tableDisciplines.map((disc) => (
                  <col key={disc} className="w-[120px]" />
                ))}
              </colgroup>

              <thead className="bg-slate-700">
                <tr>
                  <th
                    className="sticky top-0 left-0 z-40 bg-slate-800 px-3 py-2 text-[11px] font-semibold text-left border-b border-r border-gray-600"
                    style={{ transform: "translateZ(0)" }}
                  >
                    Team
                  </th>

                  {tableDisciplines.map((disc) => (
                    <th
                      key={disc}
                      className="sticky top-0 z-20 bg-slate-800 px-3 py-2 text-[11px] font-semibold text-center border-b border-gray-600 whitespace-nowrap"
                      style={{ transform: "translateZ(0)" }}
                    >
                      {disc}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredTeams.map((team) => (
                  <tr key={team.team_id} className="odd:bg-slate-800 even:bg-slate-700 hover:bg-slate-600">
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2 border-b border-r border-gray-600 align-top"
                      style={{ transform: "translateZ(0)" }}>
                      <div className="font-medium text-xs text-gray-100">
                        {team.handler_first} {team.handler_last}
                      </div>
                      <div className="text-[11px] text-gray-200">{team.dog_name}</div>
                    </td>

                    {tableDisciplines.map((disc) => {
                      const fallbackStandardId = data.standard_ids_by_discipline?.[disc] ?? null;
                      const rawCell = team.certifications[disc];

                      const cell: MatrixCell = rawCell
                        ? { ...rawCell, standard_id: rawCell.standard_id ?? fallbackStandardId }
                        : { status: "none", expires: null, standard_id: fallbackStandardId };

                      const label = statusLabel(cell.status);
                      const dayStr = formatDate(cell.expires);

                      return (
                        <td
                          key={disc}
                          className="
                            px-2 py-1 text-center border-b border-gray-600
                            align-middle cursor-context-menu
                          "
                          onContextMenu={(e) => openCellFromRightClick(e, team, disc, cell)}
                          onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            startPressTimer(() => openCellModal(team, disc, cell), e.clientX, e.clientY);
                          }}
                          onMouseMove={(e) => {
                            updatePressMovement(e.clientX, e.clientY);
                          }}
                          onMouseUp={() => {
                            clearPressTimer();
                          }}
                          onMouseLeave={() => {
                            clearPressTimer();
                          }}
                          onTouchStart={(e) => {
                            const t = e.touches?.[0];
                            if (!t) return;
                            startPressTimer(() => openCellModal(team, disc, cell), t.clientX, t.clientY);
                          }}
                          onTouchMove={(e) => {
                            const t = e.touches?.[0];
                            if (!t) return;
                            updatePressMovement(t.clientX, t.clientY);
                          }}
                          onTouchEnd={() => {
                            clearPressTimer();
                          }}
                          onTouchCancel={() => {
                            clearPressTimer();
                          }}
                        >
                          <div
                            className={classNames(
                              "min-h-[44px] w-full rounded-md px-2 py-2",
                              "flex flex-col items-center justify-center",
                              "transition-all duration-100",
                              getCellBaseClass(cell),
                              "hover:brightness-125 hover:ring-1 hover:ring-slate-300/70"
                            )}
                            title={`${hint} • ${label}${dayStr ? ` • Expires ${dayStr}` : ""}`}
                          >
                            <span className="leading-tight">{label}</span>
                            {dayStr && (
                              <span className="leading-tight text-[10px] opacity-80">
                                {dayStr}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {filteredTeams.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-center text-sm text-gray-200" colSpan={1 + tableDisciplines.length}>
                      No teams matched your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTeams.map((team) => {
              const open = !!expandedTeams[team.team_id];

              return (
                <div key={team.team_id} className="bg-slate-700 border border-gray-500 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left px-4 py-4 flex items-start justify-between gap-3 bg-slate-700 hover:bg-slate-600 transition-colors"
                    onClick={() =>
                      setExpandedTeams((prev) => ({
                        ...prev,
                        [team.team_id]: !prev[team.team_id],
                      }))
                    }
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-100 truncate">
                        {team.handler_first} {team.handler_last}
                      </div>
                      <div className="text-xs text-gray-200 truncate">{team.dog_name}</div>
                    </div>

                    <div className="shrink-0 text-xs text-gray-200">{open ? "▲" : "▼"}</div>
                  </button>

                  {open && (
                    <div className="border-t border-gray-600 bg-slate-700">
                      {tableDisciplines.map((disc) => {
                        const fallbackStandardId = data.standard_ids_by_discipline?.[disc] ?? null;
                        const rawCell = team.certifications[disc];

                        const cell: MatrixCell = rawCell
                          ? { ...rawCell, standard_id: rawCell.standard_id ?? fallbackStandardId }
                          : { status: "none", expires: null, standard_id: fallbackStandardId };

                        const label = statusLabel(cell.status);
                        const dayStr = formatDate(cell.expires);

                        return (
                          <button
                            key={disc}
                            type="button"
                            className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left bg-slate-600 hover:bg-slate-500 transition-colors"
                            onClick={() => openCellModal(team, disc, cell)}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-gray-100 truncate">{disc}</div>
                              {dayStr ? (
                                <div className="text-[11px] text-gray-300">Expires {dayStr}</div>
                              ) : (
                                <div className="text-[11px] text-gray-400">—</div>
                              )}
                            </div>

                            <div
                              className={classNames(
                                "shrink-0 inline-flex items-center px-2 py-1 rounded-md text-[11px]",
                                statusClass(cell.status)
                              )}
                              title={label}
                            >
                              {label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredTeams.length === 0 && (
              <div className="text-sm text-gray-200 bg-slate-700 border border-gray-600 rounded-xl p-4 text-center">
                No teams matched your search.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------- Modal ---------- */}
      {workflowWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setWorkflowWarning(null)}
          />

          <div className="relative bg-purple-700 rounded-lg p-4 w-full max-w-sm">
            <h3 className="font-semibold">{workflowWarning.title}</h3>

            <p className="mt-2 text-sm">
              Expected next step:
              <p><strong> {workflowWarning.expected}</strong></p>
            </p>

            <p className="mt-2 text-sm">
              Choosing to Override will break the normal workflow and create a duplicate certification.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setWorkflowWarning(null)}
                className="px-3 py-2 rounded border border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  setActionMode(workflowWarning.nextMode);
                  setWorkflowWarning(null);
                }}
                className="px-3 py-2 bg-amber-600 text-white rounded"
              >
                Override
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (returnToHistoryOnClose) {
                setAuditOpen(false);
                setAuditError(null);
                setAuditEvents([]);
                setReturnToHistoryOnClose(false);
                setHistoryOpen(true);
                return;
              }

              setSelectedCell(null);
              setActionError(null);
              setActionMode("view");
            }}
          />

          <div
            className="relative bg-white text-slate-900 rounded-lg shadow-lg border border-gray-300 w-[95vw] max-w-md mx-4 p-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-emerald-700 truncate">{selectedCell.discipline}</div>
                <div className="text-xs text-slate-800">
                  Handler: {selectedCell.team.handler_first} {selectedCell.team.handler_last}
                  <br />
                  Dog: {selectedCell.team.dog_name}
                </div>
              </div>
              <button
                type="button"
                className="text-xs text-slate-500 bg-white hover:text-slate-900"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  if (returnToHistoryOnClose) {
                    setAuditOpen(false);
                    setAuditError(null);
                    setAuditEvents([]);
                    setReturnToHistoryOnClose(false);
                    setHistoryOpen(true);
                    return;
                  }

                  setSelectedCell(null);
                  setActionError(null);
                  setActionMode("view");
                }}
              >
                ✕
              </button>

            </div>

            <div className="text-xs space-y-1 mb-3">
              <div>
                Status: <strong>{statusLabel(selectedCell.cell.status)}</strong>
              </div>
              {selectedCell.cell.location && <div>Location: {selectedCell.cell.location}</div>}
              {selectedCell.cell.comment && <div>Comment: {selectedCell.cell.comment}</div>}
              {selectedCell.cell.supervisor_name && (
                <div>Primary evaluator: {selectedCell.cell.supervisor_name}</div>
              )}

              {selectedCell.cell.requires_co_evaluator && (
                <div>Co-evaluator required: Yes</div>
              )}

              {selectedCell.cell.co_evaluator_name && (
                <div>Co-evaluator: {selectedCell.cell.co_evaluator_name}</div>
              )}

              {selectedCell.cell.co_evaluator_note && (
                <div>Co-evaluator note: {selectedCell.cell.co_evaluator_note}</div>
              )}

              {selectedCell.cell.last_actor_name &&
                selectedCell.cell.last_actor_name !== selectedCell.cell.supervisor_name && (
                  <div>Last action by: {selectedCell.cell.last_actor_name}</div>
                )}

              {selectedCell.cell.date_awarded && <div>Awarded: {formatDate(selectedCell.cell.date_awarded)}</div>}
              {selectedCell.cell.expires && <div>Expires: {formatDate(selectedCell.cell.expires)}</div>}
              {!selectedCell.cell.expires && selectedCell.cell.status !== "none" && <div>Expires: not set</div>}
            </div>

            {actionError && (
              <div className="mb-2 text-xs text-red-700 bg-red-50 border border-red-300 rounded px-2 py-1">
                {actionError}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mb-3 items-center">


              {canModifyPending &&
                selectedCell.cell.status === "incomplete" &&
                selectedCell.cell.certification_id && (
                  <button
                    type="button"
                    className={actionButtonClass(actionMode === "update", "good")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActionMode("update");
                      setActionError(null);
                      setEvaluationComplete(true);
                    }}
                  >
                    Continue evaluation
                  </button>
                )}

              {canCoEvaluateSelectedCell && (
                <>
                  <button
                    type="button"
                    className={actionButtonClass(actionMode === "coapprove", "good")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActionMode("coapprove");
                      setActionError(null);
                      setCoEvaluateNote("");
                    }}
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    className={actionButtonClass(actionMode === "coreject", "bad")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActionMode("coreject");
                      setActionError(null);
                      setCoEvaluateNote("");
                    }}
                  >
                    Disapprove
                  </button>
                </>
              )}

              {canIssue && (
                <button
                  type="button"
                  className={actionButtonClass(actionMode === "issue", "good")}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const warning = getWorkflowWarning(selectedCell?.cell, "issue");

                    if (warning) {
                      setWorkflowWarning({ ...warning, nextMode: "issue" });
                    } else {
                      setActionMode("issue");
                    }

                    const today = new Date();
                    const todayISO = today.toISOString().slice(0, 10);

                    setIssueDateAwarded(todayISO);
                    setIssueExpiresAt("");
                    setIssueExpirationTouched(false);
                    setIssueAwardedError(null);
                    setIssueExpiresError(null);
                    setIssueRequiresCoEvaluator(false);
                    setEvaluationComplete(true);
                    setIssueLocation("");
                    setIssueComment("");
                    setIssueDocumentUrl("");
                    setCoEvaluateNote("");
                  }}
                >
                  Issue new
                </button>
              )}

              {canSuspend && (
                <button
                  type="button"
                  className={actionButtonClass(actionMode === "suspend", "bad")}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActionMode("suspend");
                    setActionError(null);
                  }}
                >
                  Suspend
                </button>
              )}

              {canUnsuspend && (
                <button
                  type="button"
                  className={actionButtonClass(actionMode === "unsuspend", "good")}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActionMode("unsuspend");
                    setActionError(null);
                  }}
                >
                  Reactivate
                </button>
              )}

              {canRevoke && (
                <button
                  type="button"
                  className={actionButtonClass(actionMode === "revoke", "bad")}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActionMode("revoke");
                    setActionError(null);
                  }}
                >
                  Revoke
                </button>
              )}

              {certId && canPrint && canView && (
                <>
                  {/* <button
                    type="button"
                    className={actionButtonClass(false, "neutral")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      nav(`/certificates/${certId}`);
                    }}
                  >
                    View
                  </button> */}

                  <button
                    type="button"
                    className={actionButtonClass(false, "neutral")}
                    // disabled={!canPrint}
                    // title={!canPrint ? "Printing is not available for this certification status." : ""}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (canPrint) nav(`/certificates/${certId}`);
                    }}
                  >
                    View / Print
                  </button>
                </>
              )}

              {canCorrect &&
                selectedCell.cell.status !== "none" &&
                selectedCell.cell.certification_id && (
                  <button
                    type="button"
                    className={actionButtonClass(actionMode === "correct", "good")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActionMode("correct");
                      setActionError(null);
                      setIssueExpirationTouched(false);
                      setIssueAwardedError(null);
                      setIssueExpiresError(null);
                    }}
                  >
                    Edit details
                  </button>
                )}

              {certId && canView && (
                <>
                  <button
                    type="button"
                    className={actionButtonClass(false, "neutral")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openHistory(certId);
                    }}
                  >
                    History
                  </button>
                </>
              )}

              {!canIssue &&
                !canModifyPending &&
                !canCorrect &&
                !canCoEvaluateSelectedCell &&
                !canSuspend &&
                !canUnsuspend &&
                !canRevoke &&
                !canPrint && (
                  <div className="text-[11px] text-slate-600">
                    View only – no certification changes permitted.
                  </div>
                )}
            </div>
            {/* Issue form */}
            {canCoEvaluateSelectedCell &&
              actionMode === "coapprove" &&
              selectedCell.cell.status === "pending" &&
              !!selectedCell.cell.certification_id && (
                <div className="space-y-2 text-xs mb-3">
                  <div className="font-semibold text-emerald-700">Approve as second evaluator</div>

                  <div>
                    <label className="block text-[11px] mb-0.5">Note (optional)</label>
                    <textarea
                      className="w-full rounded bg-white border border-gray-300 px-2 py-1 text-xs"
                      value={coEvaluateNote}
                      onChange={(e) => setCoEvaluateNote(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      className="px-3 py-1 text-xs rounded border border-emerald-600 text-emerald-100 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60"
                      onClick={() => handleCoEvaluate("approve")}
                      disabled={actionLoading}
                    >
                      {actionLoading ? "Approving…" : "Confirm approval"}
                    </button>
                  </div>
                </div>
              )}

            {canCoEvaluateSelectedCell &&
              actionMode === "coreject" &&
              selectedCell.cell.status === "pending" &&
              !!selectedCell.cell.certification_id && (
                <div className="space-y-2 text-xs mb-3">
                  <div className="font-semibold text-red-700">Disapprove as second evaluator</div>

                  <div>
                    <label className="block text-[11px] mb-0.5">Reason (required)</label>
                    <textarea
                      className="w-full rounded bg-white border border-gray-300 px-2 py-1 text-xs"
                      value={coEvaluateNote}
                      onChange={(e) => setCoEvaluateNote(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      className="px-3 py-1 text-xs rounded border border-red-600 text-red-100 bg-red-700 hover:bg-red-600 disabled:opacity-60"
                      onClick={() => handleCoEvaluate("reject")}
                      disabled={actionLoading}
                    >
                      {actionLoading ? "Disapproving…" : "Confirm disapproval"}
                    </button>
                  </div>
                </div>
              )}
            {canIssue && actionMode === "issue" && (
              <div className="space-y-2 text-xs">
                <div className="font-semibold text-slate-900">Issue new certification</div>

                {allowIncomplete && (
                  <div className="rounded border border-gray-300 p-2">
                    <label className="flex items-start gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        checked={evaluationComplete}
                        onChange={(e) => { setIssueExpirationTouched(false); setEvaluationComplete(e.target.checked) }}
                        className="mt-0.5"
                      />
                      <span>
                        Evaluation complete
                        <div className="text-slate-600">
                          Uncheck for multipart evaluations that are still in progress.
                        </div>
                      </span>
                    </label>
                  </div>
                )}

                <div className="rounded border border-gray-300 p-2">
                  <label className="flex items-start gap-2 text-[11px]">
                    <input
                      type="checkbox"
                      checked={issueRequiresCoEvaluator}
                      onChange={(e) => setIssueRequiresCoEvaluator(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Require co-evaluator approval
                      <div className="text-slate-600">
                        The certification will be created as pending and must be approved or rejected by a second evaluator.
                      </div>
                    </span>
                  </label>
                </div>

                <label className="block text-[11px] mb-0.5">Date awarded</label>
                <input
                  type="date"
                  className="w-full rounded bg-white border border-gray-300 px-2 py-1 text-xs"
                  value={issueDateAwarded}
                  onChange={(e) => {
                    const next = normalizeISODateOrEmpty(e.target.value);
                    setIssueDateAwarded(next);

                    // Only error if they entered something and it's invalid
                    setIssueAwardedError(next === "" ? null : (isValidISODate(next) ? null : "Invalid date"));
                  }}
                  onBlur={() => {
                    if (issueDateAwarded && !isValidISODate(issueDateAwarded)) {
                      setIssueAwardedError("Invalid date");
                    }
                  }}
                />
                {issueAwardedError && <div className="text-[11px] text-red-700">{issueAwardedError}</div>}

                <label className="block text-[11px] mb-0.5">Expires at</label>
                <input
                  type="date"
                  className="w-full rounded bg-white border border-gray-300 px-2 py-1 text-xs"
                  value={issueExpiresAt}
                  onChange={(e) => {
                    const next = normalizeISODateOrEmpty(e.target.value);
                    setIssueExpirationTouched(true);
                    setIssueExpiresAt(next);

                    setIssueExpiresError(
                      next === "" ? null : (isValidISODate(next) ? null : "Invalid date")
                    );
                  }}
                  onBlur={() => {
                    if (issueExpiresAt && !isValidISODate(issueExpiresAt)) {
                      setIssueExpiresError("Invalid date");
                    }
                  }}
                />
                {issueExpiresError && <div className="text-[11px] text-red-700">{issueExpiresError}</div>}


                <div>
                  <label className="block text-[11px] mb-0.5">
                    Location <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded bg-white border border-gray-300 px-2 py-1 text-xs"
                    value={issueLocation}
                    onChange={(e) => setIssueLocation(e.target.value)}
                    placeholder="Location of certification"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] mb-0.5">Comment</label>
                  <textarea
                    className="w-full rounded bg-white border border-gray-300 px-2 py-1 text-xs"
                    value={issueComment}
                    onChange={(e) => setIssueComment(e.target.value)}
                    placeholder="Required if evaluation is not yet complete"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-[11px] mb-0.5">Document URL (optional)</label>
                  <input
                    type="url"
                    className="w-full rounded bg-white border border-gray-300 px-2 py-1 text-xs"
                    value={issueDocumentUrl}
                    onChange={(e) => setIssueDocumentUrl(e.target.value)}
                    placeholder="https://example.com/cert/..."
                  />
                </div>

                <div className="flex justify-end mt-2">
                  <button
                    className="px-3 py-1 text-xs rounded border border-emerald-600 text-emerald-100 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60"
                    onClick={handleIssue}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Issuing…" : "Issue certification"}
                  </button>
                </div>
              </div>
            )}

            {canCorrect &&
              actionMode === "correct" &&
              !!selectedCell.cell.certification_id && (
                <div className="space-y-2 text-xs">
                  <div className="font-semibold text-slate-900">Edit certification details</div>
                  {/* <p className="text-[11px] text-slate-700">
                    Only location, comment, date awarded, and expiration may be changed.
                  </p> */}

                  {allowIncomplete && (
                    <div className="rounded border border-gray-300 p-2">
                      <label className="flex items-start gap-2 text-[11px]">
                        <input
                          type="checkbox"
                          checked={evaluationComplete}
                          onChange={(e) => { setIssueExpirationTouched(false); setEvaluationComplete(e.target.checked) }}
                          className="mt-0.5"
                        />
                        <span>
                          Evaluation complete
                          <div className="text-slate-600">
                            Uncheck for multipart evaluations that are still in progress.
                          </div>
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="rounded border border-gray-300 p-2">
                    <label className="flex items-start gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        checked={issueRequiresCoEvaluator}
                        onChange={(e) => setIssueRequiresCoEvaluator(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        Require co-evaluator approval
                        <div className="text-slate-600">
                          The certification will be created as pending and must be approved or rejected by a second evaluator.
                        </div>
                      </span>
                    </label>
                  </div>

                  <label className="block text-[11px] mb-0.5">Date awarded</label>
                  <input
                    type="date"
                    className="w-full rounded bg-white border border-gray-300 px-2 py-1 text-xs"
                    value={issueDateAwarded}
                    onChange={(e) => {
                      const next = normalizeISODateOrEmpty(e.target.value);
                      setIssueDateAwarded(next);
                      setIssueAwardedError(next === "" ? null : (isValidISODate(next) ? null : "Invalid date"));
                    }}
                  />
                  {issueAwardedError && <div className="text-[11px] text-red-700">{issueAwardedError}</div>}

                  <label className="block text-[11px] mb-0.5">Expires at</label>
                  <input
                    type="date"
                    className="w-full rounded bg-white border border-gray-300 px-2 py-1 text-xs"
                    value={issueExpiresAt}
                    onChange={(e) => {
                      const next = normalizeISODateOrEmpty(e.target.value);
                      setIssueExpiresAt(next);
                      setIssueExpiresError(
                        next === "" ? null : (isValidISODate(next) ? null : "Invalid date")
                      );
                    }}
                  />
                  {issueExpiresError && <div className="text-[11px] text-red-700">{issueExpiresError}</div>}

                  <div>
                    <label className="block text-[11px] mb-0.5">
                      Location <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full rounded bg-white border border-gray-300 px-2 py-1 text-xs"
                      value={issueLocation}
                      onChange={(e) => setIssueLocation(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] mb-0.5">Comment</label>
                    <textarea
                      className="w-full rounded bg-white border border-gray-300 px-2 py-1 text-xs"
                      value={issueComment}
                      onChange={(e) => setIssueComment(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      className="px-3 py-1 text-xs rounded border border-emerald-600 text-emerald-100 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60"
                      onClick={handleCorrectCertification}
                      disabled={actionLoading}
                    >
                      {actionLoading ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>
              )}
            {/* Renew form */}
            {/* Continue / update work-in-progress form */}
            {canModifyPending &&
              actionMode === "update" &&
              ["pending", "incomplete"].includes(selectedCell.cell.status) &&
              !!selectedCell.cell.certification_id && (
                <div className="space-y-2 text-xs">
                  <div className="font-semibold text-slate-900">Continue evaluation</div>

                  <div className="rounded border border-gray-300 p-2">
                    <label className="flex items-start gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        checked={issueRequiresCoEvaluator}
                        onChange={(e) => setIssueRequiresCoEvaluator(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        Require co-evaluator approval
                        <div className="text-slate-600">
                          The certification will be created as pending and must be approved or rejected by a second evaluator.
                        </div>
                      </span>
                    </label>
                  </div>

                  {allowIncomplete && (
                    <div className="rounded border border-gray-300 p-2">
                      <label className="flex items-start gap-2 text-[11px]">
                        <input
                          type="checkbox"
                          checked={evaluationComplete}
                          onChange={(e) => { setIssueExpirationTouched(false); setEvaluationComplete(e.target.checked) }}
                          className="mt-0.5"
                        />
                        <span>
                          Evaluation complete
                          <div className="text-slate-600">
                            Uncheck for multipart evaluations that are still in progress.
                          </div>
                        </span>
                      </label>
                    </div>
                  )}

                  <label className="block text-[11px] mb-0.5">Date awarded</label>
                  <input
                    type="date"
                    className="w-full rounded bg-white border border-gray-300 px-2 py-1 text-xs"
                    value={issueDateAwarded}
                    onChange={(e) => {
                      const next = normalizeISODateOrEmpty(e.target.value);
                      setIssueExpirationTouched(false);
                      setIssueDateAwarded(next);
                      setIssueAwardedError(next === "" ? null : (isValidISODate(next) ? null : "Invalid date"));
                    }}
                  />
                  {issueAwardedError && <div className="text-[11px] text-red-700">{issueAwardedError}</div>}

                  <label className="block text-[11px] mb-0.5">Expires at</label>
                  <input
                    type="date"
                    className="w-full rounded bg-white border border-gray-300 px-2 py-1 text-xs"
                    value={issueExpiresAt}
                    onChange={(e) => {
                      const next = normalizeISODateOrEmpty(e.target.value);
                      setIssueExpirationTouched(true);
                      setIssueExpiresAt(next);
                      setIssueExpiresError(
                        next === "" ? null : (isValidISODate(next) ? null : "Invalid date")
                      );
                    }}
                  />
                  {issueExpiresError && <div className="text-[11px] text-red-700">{issueExpiresError}</div>}

                  <label className="block text-[11px] mb-0.5">
                    Location <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded bg-white border border-gray-300 px-2 py-1 text-xs"
                    value={issueLocation}
                    onChange={(e) => setIssueLocation(e.target.value)}
                    required
                  />

                  <div>
                    <label className="block text-[11px] mb-0.5">Comment</label>
                    <textarea
                      className="w-full rounded bg-white border border-gray-300 px-2 py-1 text-xs"
                      value={issueComment}
                      onChange={(e) => setIssueComment(e.target.value)}
                      placeholder="Required if evaluation is not yet complete"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      className="px-3 py-1 text-xs rounded border border-emerald-600 text-emerald-100 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60"
                      onClick={handleUpdateWorkInProgress}
                      disabled={actionLoading}
                    >
                      {actionLoading
                        ? "Saving…"
                        : (evaluationComplete ? "Finalize certification" : "Save progress")}
                    </button>
                  </div>
                </div>
              )}
            {canSuspend && actionMode === "suspend" && !!selectedCell.cell.certification_id && (
              <div className="space-y-2 text-xs">
                <div className="font-semibold text-yellow-700">Suspend certification</div>
                <p className="text-[11px] text-slate-800">
                  This will temporarily mark the certification as suspended.
                </p>
                <div className="flex justify-end mt-2">
                  <button
                    className="px-3 py-1 text-xs rounded border border-yellow-600 text-yellow-100 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-60"
                    onClick={handleSuspend}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Suspending…" : "Confirm suspend"}
                  </button>
                </div>
              </div>
            )}

            {canUnsuspend && actionMode === "unsuspend" && !!selectedCell.cell.certification_id && (
              <div className="space-y-2 text-xs">
                <div className="font-semibold text-emerald-700">Reactivate certification</div>
                <p className="text-[11px] text-slate-800">
                  This will restore the certification to active status.
                </p>
                <div className="flex justify-end mt-2">
                  <button
                    className="px-3 py-1 text-xs rounded border border-emerald-600 text-emerald-100 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60"
                    onClick={handleUnsuspend}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Reactivating…" : "Confirm reactivate"}
                  </button>
                </div>
              </div>
            )}

            {/* Revoke form (admin only) */}
            {canRevoke && actionMode === "revoke" && !!selectedCell.cell.certification_id && (
              <div className="space-y-2 text-xs">
                <div className="font-semibold text-red-700">Revoke certification</div>
                <p className="text-[11px] text-slate-800">This will mark the certification as revoked.</p>
                <div className="flex justify-end mt-2">
                  <button
                    className="px-3 py-1 text-xs rounded border border-red-600 text-red-100 bg-red-700 hover:bg-red-600 disabled:opacity-60"
                    onClick={handleRevoke}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Revoking…" : "Confirm revoke"}
                  </button>
                </div>
              </div>
            )}

            {!!selectedCell?.cell?.certification_id && canView && (
              <div className="mt-3 rounded border border-slate-600 bg-slate-900/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-100">Audit trail (most recent first)</div>
                  <button
                    type="button"
                    className={actionButtonClass(auditOpen, "neutral")}
                    onClick={async () => {
                      const nextOpen = !auditOpen;

                      if (!nextOpen && returnToHistoryOnClose) {
                        setAuditOpen(false);
                        setAuditError(null);
                        setAuditEvents([]);
                        setReturnToHistoryOnClose(false);
                        setHistoryOpen(true);
                        return;
                      }

                      setAuditOpen(nextOpen);

                      if (
                        nextOpen &&
                        selectedCell.cell.certification_id &&
                        auditEvents.length === 0 &&
                        !auditLoading
                      ) {
                        await loadAuditTrail(selectedCell.cell.certification_id);
                      }
                    }}
                  >
                    {auditOpen ? "Hide audit" : "Show audit"}
                  </button>
                </div>

                {auditOpen && (
                  <div className="mt-3 space-y-3">
                    {auditLoading && (
                      <div className="text-xs text-slate-300">Loading audit trail…</div>
                    )}

                    {auditError && (
                      <div className="text-xs text-red-300">{auditError}</div>
                    )}

                    {!auditLoading && !auditError && auditEvents.length === 0 && (
                      <div className="text-xs text-slate-300">No audit entries found.</div>
                    )}

                    {!auditLoading && !auditError && auditEvents.length > 0 && (
                      <div className="space-y-2">
                        {auditEvents.map((ev) => (
                          <div
                            key={ev.event_id}
                            className={
                              ev.event_type === "correction"
                                ? "rounded border border-amber-700 bg-amber-950/30 p-2 text-xs text-slate-100"
                                : "rounded border border-slate-700 bg-slate-800/60 p-2 text-xs text-slate-100"
                            }
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-semibold">{eventLabel(ev.event_type)}</div>
                              <div className="text-slate-300">{formatDateTime(ev.created_at)}</div>
                            </div>

                            <div className="mt-1 text-slate-300">
                              By: <span className="text-slate-100">{ev.actor_name || `User ${ev.actor_user_id}`}</span>
                            </div>

                            {(ev.previous_status || ev.new_status) && (
                              <div className="mt-1">
                                Status:{" "}
                                <span className="text-slate-300">{ev.previous_status || "—"}</span>
                                {" → "}
                                <span className="text-slate-100">{ev.new_status || "—"}</span>
                              </div>
                            )}

                            {changed(ev.evaluation_complete_before, ev.evaluation_complete_after) && (
                              <div className="mt-1">
                                Evaluation complete:{" "}
                                <span className="text-slate-300">{yesNo(ev.evaluation_complete_before)}</span>
                                {" → "}
                                <span className="text-slate-100">{yesNo(ev.evaluation_complete_after)}</span>
                              </div>
                            )}

                            {changed(ev.requires_co_evaluator_before, ev.requires_co_evaluator_after) && (
                              <div className="mt-1">
                                Requires co-evaluator:{" "}
                                <span className="text-slate-300">{yesNo(ev.requires_co_evaluator_before)}</span>
                                {" → "}
                                <span className="text-slate-100">{yesNo(ev.requires_co_evaluator_after)}</span>
                              </div>
                            )}

                            {changed(ev.location_before, ev.location_after) && (
                              <div className="mt-1">
                                Location:{" "}
                                <span className="text-slate-300">{renderValue(ev.location_before)}</span>
                                {" → "}
                                <span className="text-slate-100">{renderValue(ev.location_after)}</span>
                              </div>
                            )}

                            {changed(ev.comment_before, ev.comment_after) && (
                              <div className="mt-1">
                                Comment:{" "}
                                <span className="text-slate-300">{renderValue(ev.comment_before)}</span>
                                {" → "}
                                <span className="text-slate-100">{renderValue(ev.comment_after)}</span>
                              </div>
                            )}

                            {changed(ev.date_awarded_before, ev.date_awarded_after) && (
                              <div className="mt-1">
                                Awarded:{" "}
                                <span className="text-slate-300">{fmtDate(ev.date_awarded_before)}</span>
                                {" → "}
                                <span className="text-slate-100">{fmtDate(ev.date_awarded_after)}</span>
                              </div>
                            )}

                            {changed(ev.expires_at_before, ev.expires_at_after) && (
                              <div className="mt-1">
                                Expires:{" "}
                                <span className="text-slate-300">{fmtDate(ev.expires_at_before)}</span>
                                {" → "}
                                <span className="text-slate-100">{fmtDate(ev.expires_at_after)}</span>
                              </div>
                            )}

                            {ev.note && ev.note.trim() && (
                              <div className="mt-2 rounded border border-slate-700 bg-slate-900/60 p-2 text-slate-200">
                                <span className="font-semibold">Note:</span> {ev.note}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {historyOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75">
                    <div className="w-[900px] max-h-[80vh] overflow-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <div className="text-lg font-semibold">Certification History</div>
                          <div className="text-xs text-slate-300">
                            {historyData?.handler_name} / {historyData?.dog_name}
                          </div>
                        </div>

                        <button
                          type="button"
                          className={actionButtonClass(false, "neutral")}
                          onClick={() => setHistoryOpen(false)}
                        >
                          Close
                        </button>
                      </div>

                      {historyLoading && (
                        <div className="text-sm text-slate-300">Loading history...</div>
                      )}

                      {historyError && (
                        <div className="text-sm text-red-300">{historyError}</div>
                      )}


                      {!historyLoading && historyData?.rows?.length > 0 && (
                        <div className="space-y-3">
                          {historyData.rows.map((row: CertificationHistoryRow) => (
                            <HistoryCard
                              key={row.certification_id}
                              row={row}
                              onView={(certId) => nav(`/certificates/${certId}`)}
                              onAudit={(row) => openAuditFromHistory(row)}
                            />
                          ))}
                        </div>
                      )}

                      {!historyLoading && !historyError && (!historyData?.rows || historyData.rows.length === 0) && (
                        <div className="text-sm text-slate-300">No certification history found.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}
      {/* </PageContainer> */}
    </>
  );
};

// 