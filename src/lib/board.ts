import { STATUSES, type Application, type ApplicationStatus, type BoardFile, type Interview } from "../types.ts";
import { serializeBoard } from "../../api/_lib/boardFile.ts";
import { AVATAR_COLORS } from "./status.ts";

export {
  applicationSignature,
  boardSignature,
  upsertApplication,
  removeApplication,
  localDrifts,
  serializeBoard,
  normalizeJobUrl,
  BoardChangeError,
  applySharedOperation,
  parseBoard,
} from "../../api/_lib/boardFile.ts";
export type { LocalDrift, SharedEdit, SharedEditResult } from "../../api/_lib/boardFile.ts";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
const TIME_ZONE = "America/Denver";

type Civil = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function civilParts(date: Date, timeZone: string): Civil {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const hour = Number(map.hour);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: hour === 24 ? 0 : hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function denverInstant(year: number, month: number, day: number, hour: number, minute: number): Date {
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = desired;
  for (let pass = 0; pass < 2; pass += 1) {
    const shown = civilParts(new Date(utc), TIME_ZONE);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    const offset = shownAsUtc - utc;
    utc = desired - offset;
  }
  return new Date(utc);
}

export type SortKey = "company" | "role" | "status" | "applied" | "interviews" | "next";
export type SortDir = "asc" | "desc";
export type SortState = { key: SortKey; dir: SortDir };

export type Scheduled = {
  application: Application;
  interview: Interview;
};

const STATUS_RANK: Record<ApplicationStatus, number> = {
  Interviewing: 0,
  Applied: 1,
  "Not hired": 2,
};

export function interviewDate(at: string): Date {
  const match = DATE_TIME.exec(at);
  if (!match) return new Date(NaN);
  return denverInstant(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
}

export function todayISO(now = new Date()): string {
  const parts = civilParts(now, TIME_ZONE);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function dayDistance(at: string, now: Date): number | null {
  const date = interviewDate(at);
  if (Number.isNaN(date.getTime()) || Number.isNaN(now.getTime())) return null;
  const interview = civilParts(date, TIME_ZONE);
  const today = civilParts(now, TIME_ZONE);
  const interviewDay = Date.UTC(interview.year, interview.month - 1, interview.day);
  const todayDay = Date.UTC(today.year, today.month - 1, today.day);
  return Math.round((interviewDay - todayDay) / 86_400_000);
}

export function formatApplied(iso: string, now = new Date()): string {
  const match = DATE_ONLY.exec(iso);
  if (!match) return iso;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const sameYear = Number(match[1]) === now.getFullYear();
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" as const }),
  }).format(date);
}

export function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTime(at: string): string {
  const date = interviewDate(at);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function relativeDayLabel(at: string, now: Date): string {
  const date = interviewDate(at);
  const diff = dayDistance(at, now);
  if (Number.isNaN(date.getTime()) || diff === null) return at;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) {
    return new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "long" }).format(date);
  }
  const sameYear = civilParts(date, TIME_ZONE).year === civilParts(now, TIME_ZONE).year;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" as const }),
  }).format(date);
}

export function formatConcrete(at: string): string {
  const date = interviewDate(at);
  if (Number.isNaN(date.getTime())) return at;
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
  return `${day} · ${formatTime(at)}`;
}

export function formatLong(at: string): string {
  const date = interviewDate(at);
  if (Number.isNaN(date.getTime())) return at;
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
  return `${day} · ${formatTime(at)}`;
}

export function nextInterview(app: Application, now = new Date()): Interview | null {
  const nowTime = now.getTime();
  let best: Interview | null = null;
  let bestTime = Infinity;
  for (const interview of app.interviews) {
    const time = interviewDate(interview.at).getTime();
    if (Number.isNaN(time) || time < nowTime) continue;
    if (time < bestTime) {
      best = interview;
      bestTime = time;
    }
  }
  return best;
}

export function nextUpcoming(applications: Application[], now = new Date()): Scheduled | null {
  let best: Scheduled | null = null;
  let bestTime = Infinity;
  for (const application of applications) {
    const interview = nextInterview(application, now);
    if (!interview) continue;
    const time = interviewDate(interview.at).getTime();
    if (time < bestTime) {
      best = { application, interview };
      bestTime = time;
    }
  }
  return best;
}

export function upcomingCount(applications: Application[], now = new Date()): number {
  const nowTime = now.getTime();
  let count = 0;
  for (const app of applications) {
    for (const interview of app.interviews) {
      const time = interviewDate(interview.at).getTime();
      if (!Number.isNaN(time) && time >= nowTime) count += 1;
    }
  }
  return count;
}

export function countByStatus(applications: Application[]): Record<ApplicationStatus, number> {
  const counts = {} as Record<ApplicationStatus, number>;
  for (const status of STATUSES) counts[status] = 0;
  for (const app of applications) counts[app.status] += 1;
  return counts;
}

export function matchesQuery(app: Application, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    app.company.toLowerCase().includes(needle) || app.role.toLowerCase().includes(needle)
  );
}

function defaultSort(a: Application, b: Application, now: Date): number {
  const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (rank !== 0) return rank;
  const aNext = nextInterview(a, now);
  const bNext = nextInterview(b, now);
  if (aNext && bNext) return interviewDate(aNext.at).getTime() - interviewDate(bNext.at).getTime();
  if (aNext) return -1;
  if (bNext) return 1;
  return b.appliedOn.localeCompare(a.appliedOn);
}

function directed(value: number, dir: SortDir): number {
  return dir === "asc" ? value : -value;
}

function compareApplications(a: Application, b: Application, sort: SortState | null, now: Date): number {
  if (!sort) return defaultSort(a, b, now);
  switch (sort.key) {
    case "company":
      return directed(a.company.localeCompare(b.company), sort.dir);
    case "role":
      return directed(a.role.localeCompare(b.role), sort.dir);
    case "status":
      return directed(STATUS_RANK[a.status] - STATUS_RANK[b.status], sort.dir);
    case "applied":
      return directed(a.appliedOn.localeCompare(b.appliedOn), sort.dir);
    case "interviews":
      return directed(a.interviews.length - b.interviews.length, sort.dir);
    case "next": {
      const aTime = nextInterview(a, now);
      const bTime = nextInterview(b, now);
      const aValue = aTime ? interviewDate(aTime.at).getTime() : null;
      const bValue = bTime ? interviewDate(bTime.at).getTime() : null;
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      return directed(aValue - bValue, sort.dir);
    }
    default:
      return 0;
  }
}

export function sortApplications(
  applications: Application[],
  sort: SortState | null,
  now: Date,
): Application[] {
  return [...applications].sort(
    (a, b) => compareApplications(a, b, sort, now) || a.company.localeCompare(b.company),
  );
}

export function initialDir(key: SortKey): SortDir {
  if (key === "applied" || key === "interviews") return "desc";
  return "asc";
}

export function initials(name: string): string {
  const words = name
    .trim()
    .replace(/^the\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function avatarStyle(name: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function downloadBoard(board: BoardFile): void {
  const text = serializeBoard(board);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "applications.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
