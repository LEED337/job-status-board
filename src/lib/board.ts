import { STATUSES, type Application, type ApplicationStatus, type BoardFile, type Interview } from "../types.ts";
import { AVATAR_COLORS } from "./status.ts";

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
  "Haven't heard back": 1,
  Applied: 2,
  "Not hired": 3,
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
  const counts: Record<ApplicationStatus, number> = {
    Applied: 0,
    "Haven't heard back": 0,
    Interviewing: 0,
    "Not hired": 0,
  };
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

function applicationSnapshot(app: Application) {
  return {
    id: app.id,
    company: app.company.trim(),
    role: app.role.trim(),
    jobUrl: app.jobUrl?.trim() ?? "",
    status: app.status,
    appliedOn: app.appliedOn,
    location: app.location.trim(),
    notes: app.notes?.trim() ?? "",
    interviews: app.interviews.map((interview) => ({
      id: interview.id,
      at: interview.at.slice(0, 16),
      kind: interview.kind.trim(),
    })),
  };
}

export function applicationSignature(app: Application): string {
  return JSON.stringify(applicationSnapshot(app));
}

export function boardSignature(board: BoardFile): string {
  const applications = board.applications
    .map((app) => applicationSnapshot(app))
    .sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify({ owner: board.owner.trim(), applications });
}

export function upsertApplication(board: BoardFile, application: Application, owner?: string): BoardFile {
  const index = board.applications.findIndex((item) => item.id === application.id);
  const applications =
    index === -1
      ? [application, ...board.applications]
      : board.applications.map((item) => (item.id === application.id ? application : item));
  return {
    version: 1,
    owner: owner === undefined ? board.owner : owner,
    updatedAt: board.updatedAt,
    applications,
  };
}

export function removeApplication(board: BoardFile, id: string, owner?: string): BoardFile {
  return {
    version: 1,
    owner: owner === undefined ? board.owner : owner,
    updatedAt: board.updatedAt,
    applications: board.applications.filter((item) => item.id !== id),
  };
}

export type LocalDrift = {
  id: string;
  kind: "added" | "changed" | "removed";
  application: Application;
};

export function localDrifts(draft: BoardFile, published: BoardFile): LocalDrift[] {
  const publishedById = new Map(published.applications.map((app) => [app.id, app]));
  const draftById = new Map(draft.applications.map((app) => [app.id, app]));
  const drifts: LocalDrift[] = [];
  for (const app of draft.applications) {
    const current = publishedById.get(app.id);
    if (!current) drifts.push({ id: app.id, kind: "added", application: app });
    else if (applicationSignature(app) !== applicationSignature(current)) {
      drifts.push({ id: app.id, kind: "changed", application: app });
    }
  }
  for (const app of published.applications) {
    if (!draftById.has(app.id)) drifts.push({ id: app.id, kind: "removed", application: app });
  }
  return drifts;
}

export function serializeBoard(board: BoardFile, updatedAt = new Date().toISOString()): string {
  const file = {
    version: 1 as const,
    owner: board.owner.trim(),
    updatedAt,
    applications: board.applications.map((app) => {
      const row: Record<string, unknown> = {
        id: app.id,
        company: app.company.trim(),
        role: app.role.trim(),
        status: app.status,
        appliedOn: app.appliedOn,
        location: app.location.trim(),
      };
      const jobUrl = app.jobUrl?.trim();
      if (jobUrl) row.jobUrl = jobUrl;
      if (app.notes?.trim()) row.notes = app.notes.trim();
      row.interviews = [...app.interviews]
        .map((interview) => ({
          id: interview.id,
          at: interview.at.slice(0, 16),
          kind: interview.kind.trim(),
        }))
        .sort((a, b) => a.at.localeCompare(b.at));
      return row;
    }),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function normalizeJobUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") return trimmed;
  } catch {
    // Reject anything that is not an absolute http(s) URL.
  }
  return null;
}

function optionalJobUrl(value: unknown, where: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error(`${where}: jobUrl must be a string.`);
  const jobUrl = normalizeJobUrl(value);
  if (jobUrl === null) throw new Error(`${where}: jobUrl must be an http(s) URL.`);
  return jobUrl || undefined;
}

function parseInterview(input: unknown, where: string, index: number): Interview {
  if (!isRecord(input)) throw new Error(`${where}: interview ${index + 1} is not an object.`);
  const kind = typeof input.kind === "string" ? input.kind.trim() : "";
  if (!kind) throw new Error(`${where}: interview ${index + 1} needs a kind.`);
  if (typeof input.at !== "string" || !DATE_TIME.test(input.at)) {
    throw new Error(`${where}: interview ${index + 1} needs a date and time (YYYY-MM-DDTHH:MM).`);
  }
  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : crypto.randomUUID(),
    at: input.at.slice(0, 16),
    kind,
  };
}

function parseApplication(input: unknown, index: number): Application {
  if (!isRecord(input)) throw new Error(`Application ${index + 1} is not an object.`);
  const company = typeof input.company === "string" ? input.company.trim() : "";
  const where = company || `Application ${index + 1}`;
  if (!company) throw new Error(`${where}: company is required.`);
  const role = typeof input.role === "string" ? input.role.trim() : "";
  if (!role) throw new Error(`${where}: role is required.`);
  if (!isStatus(input.status)) {
    throw new Error(
      `${where}: status must be Applied, Haven't heard back, Interviewing, or Not hired.`,
    );
  }
  if (typeof input.appliedOn !== "string" || !DATE_ONLY.test(input.appliedOn)) {
    throw new Error(`${where}: appliedOn must be YYYY-MM-DD.`);
  }
  if (!Array.isArray(input.interviews)) throw new Error(`${where}: interviews must be a list.`);
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const jobUrl = optionalJobUrl(input.jobUrl, where);
  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : crypto.randomUUID(),
    company,
    role,
    ...(jobUrl ? { jobUrl } : {}),
    status: input.status,
    appliedOn: input.appliedOn,
    location: typeof input.location === "string" ? input.location.trim() : "",
    ...(notes ? { notes } : {}),
    interviews: input.interviews.map((item, interviewIndex) =>
      parseInterview(item, where, interviewIndex),
    ),
  };
}

export class BoardChangeError extends Error {
  readonly code: "not_found" | "invalid";

  constructor(code: "not_found" | "invalid", message: string) {
    super(message);
    this.name = "BoardChangeError";
    this.code = code;
  }
}

export type SharedEdit =
  | { op: "upsert"; application: unknown; owner?: string }
  | { op: "delete"; id: string; owner?: string };

export type SharedEditResult = {
  text: string;
  application: Application | null;
  owner: string;
  updatedAt: string;
  id: string;
  company: string;
};

function canonicalApplicationJson(application: Application, owner: string, updatedAt: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(
    serializeBoard({ version: 1, owner, updatedAt, applications: [application] }),
  );
  if (!isRecord(parsed) || !Array.isArray(parsed.applications) || !isRecord(parsed.applications[0])) {
    throw new BoardChangeError("invalid", "Couldn't prepare that application.");
  }
  return parsed.applications[0];
}

function parseOneApplication(input: unknown): Application {
  const board = parseBoard({ version: 1, owner: "Owner", applications: [input] });
  const application = board.applications[0];
  if (!application) throw new BoardChangeError("invalid", "Application is required.");
  return application;
}

function rawId(item: unknown): string | null {
  if (!isRecord(item) || typeof item.id !== "string") return null;
  const id = item.id.trim();
  return id || null;
}

export function applySharedOperation(rawText: string, edit: SharedEdit, updatedAt: string): SharedEditResult {
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    throw new BoardChangeError("invalid", "The shared file is not valid JSON.");
  }
  const before = parseBoard(raw);
  if (!isRecord(raw) || !Array.isArray(raw.applications)) {
    throw new BoardChangeError("invalid", "The shared file is not a board.");
  }

  const originalApps = raw.applications;
  let touchedId = "";
  let company = "";
  let saved: Application | null = null;
  let nextApps: unknown[];

  if (edit.op === "delete") {
    const id = edit.id.trim();
    if (!id) throw new BoardChangeError("invalid", "Delete needs an application id.");
    const existing = before.applications.find((app) => app.id === id);
    if (!existing) throw new BoardChangeError("not_found", "That application is not on the shared board.");
    touchedId = id;
    company = existing.company;
    nextApps = originalApps.filter((item) => rawId(item) !== id);
  } else {
    const application = parseOneApplication(edit.application);
    saved = application;
    touchedId = application.id;
    company = application.company;
    const replacement = canonicalApplicationJson(application, before.owner, updatedAt);
    const index = originalApps.findIndex((item) => rawId(item) === application.id);
    nextApps = [...originalApps];
    if (index === -1) nextApps.unshift(replacement);
    else nextApps[index] = replacement;
  }

  for (const item of originalApps) {
    const id = rawId(item);
    if (!id || id === touchedId) continue;
    if (!nextApps.includes(item)) {
      throw new BoardChangeError("invalid", "Refusing to change other applications.");
    }
  }

  raw.applications = nextApps;
  if (edit.owner !== undefined) {
    if (!edit.owner.trim()) throw new BoardChangeError("invalid", "Add an owner name.");
    raw.owner = edit.owner.trim();
  }
  raw.updatedAt = updatedAt;

  for (const item of originalApps) {
    const id = rawId(item);
    if (!id || id === touchedId) continue;
    const after = nextApps.find((candidate) => rawId(candidate) === id);
    if (after !== item) throw new BoardChangeError("invalid", "Refusing to change other applications.");
  }

  const board = parseBoard(raw);
  if (saved) saved = board.applications.find((app) => app.id === touchedId) ?? saved;

  return {
    text: `${JSON.stringify(raw, null, 2)}\n`,
    application: saved,
    owner: board.owner,
    updatedAt: board.updatedAt,
    id: touchedId,
    company,
  };
}

export function parseBoard(input: unknown): BoardFile {
  if (!isRecord(input)) throw new Error("File must be a JSON object.");
  if (input.version !== undefined && input.version !== 1) {
    throw new Error("Unsupported file version. Expected version 1.");
  }
  if (typeof input.owner !== "string" || !input.owner.trim()) {
    throw new Error("Add an owner name.");
  }
  if (!Array.isArray(input.applications)) throw new Error("applications must be a list.");
  return {
    version: 1,
    owner: input.owner.trim(),
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString(),
    applications: input.applications.map((item, index) => parseApplication(item, index)),
  };
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
