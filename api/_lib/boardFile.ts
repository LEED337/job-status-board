export const STATUSES = [
  "Applied",
  "Haven't heard back",
  "Interviewing",
  "Not hired",
] as const;

export type ApplicationStatus = (typeof STATUSES)[number];

export type Interview = {
  id: string;
  at: string;
  kind: string;
};

export type Application = {
  id: string;
  company: string;
  role: string;
  jobUrl?: string;
  status: ApplicationStatus;
  appliedOn: string;
  location: string;
  notes?: string;
  interviews: Interview[];
};

export type BoardFile = {
  version: 1;
  owner: string;
  updatedAt: string;
  applications: Application[];
};

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

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
