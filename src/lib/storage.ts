import { applicationSignature, parseBoard } from "./board.ts";
import type { Application, BoardFile } from "../types.ts";

const KEY = "job-search-board:draft:v1";

export type DraftRecord = {
  /** Older browsers stored the board itself, with no record of which version it edited. */
  legacy: boolean;
  board: BoardFile;
  baseUpdatedAt: string;
  baseOwner: string;
  baseSignatures: Record<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function signaturesOf(board: BoardFile): Record<string, string> {
  const signatures: Record<string, string> = {};
  for (const app of board.applications) signatures[app.id] = applicationSignature(app);
  return signatures;
}

function readSignatures(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const signatures: Record<string, string> = {};
  for (const [id, signature] of Object.entries(value)) {
    if (typeof signature === "string" && id) signatures[id] = signature;
  }
  return signatures;
}

export function readDraftRecord(): DraftRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed) && parsed.version === 2 && "board" in parsed) {
      return {
        legacy: false,
        board: parseBoard(parsed.board),
        baseUpdatedAt: typeof parsed.baseUpdatedAt === "string" ? parsed.baseUpdatedAt : "",
        baseOwner: typeof parsed.baseOwner === "string" ? parsed.baseOwner : "",
        baseSignatures: readSignatures(parsed.baseSignatures),
      };
    }
    const board = parseBoard(parsed);
    return {
      legacy: true,
      board,
      baseUpdatedAt: board.updatedAt,
      baseOwner: board.owner,
      baseSignatures: {},
    };
  } catch {
    return null;
  }
}

export function hasDraft(): boolean {
  return readDraftRecord() !== null;
}

/** @deprecated Prefer readDraftRecord. Returns the working board only. */
export function readDraft(): BoardFile | null {
  return readDraftRecord()?.board ?? null;
}

export function saveDraft(board: BoardFile, base: BoardFile | null): void {
  const record = {
    version: 2 as const,
    baseUpdatedAt: base?.updatedAt ?? "",
    baseOwner: base?.owner ?? "",
    baseSignatures: base ? signaturesOf(base) : {},
    board,
  };
  localStorage.setItem(KEY, JSON.stringify(record));
}

export function clearDraft(): void {
  localStorage.removeItem(KEY);
}

/**
 * Overlay unpublished edits onto the server file.
 * A legacy snapshot from an older updatedAt is dropped so it cannot hide newer applications
 * or offer them as local deletions. Returns null when the draft should be discarded.
 */
export function reconcileDraft(server: BoardFile, record: DraftRecord): BoardFile | null {
  if (record.legacy) {
    if (record.board.updatedAt === server.updatedAt) return record.board;
    return null;
  }

  const serverById = new Map(server.applications.map((app) => [app.id, app]));
  const localById = new Map(record.board.applications.map((app) => [app.id, app]));
  const knowBase = Object.keys(record.baseSignatures).length > 0;
  const applications: Application[] = [];

  for (const serverApp of server.applications) {
    const local = localById.get(serverApp.id);
    const baseSig = record.baseSignatures[serverApp.id];
    if (!local) {
      if (baseSig !== undefined) continue;
      applications.push(serverApp);
      continue;
    }
    const localSig = applicationSignature(local);
    if (localSig === applicationSignature(serverApp)) {
      applications.push(serverApp);
      continue;
    }
    if (baseSig === undefined) {
      // No base for this id. With a known base, the server added it — don't let a stale
      // local copy hide that. Without a base, keep the offline edit.
      applications.push(knowBase ? serverApp : local);
      continue;
    }
    if (localSig === baseSig) {
      applications.push(serverApp);
      continue;
    }
    applications.push(local);
  }

  for (const local of record.board.applications) {
    if (!serverById.has(local.id)) applications.unshift(local);
  }

  const ownerEdited = record.board.owner.trim() !== record.baseOwner.trim();
  return {
    version: 1,
    owner: ownerEdited ? record.board.owner : server.owner,
    updatedAt: server.updatedAt,
    applications,
  };
}
