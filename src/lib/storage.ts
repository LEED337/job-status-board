import { parseBoard } from "./board.ts";
import type { BoardFile } from "../types.ts";

const KEY = "job-search-board:draft:v1";

export function readDraft(): BoardFile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return parseBoard(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveDraft(board: BoardFile): void {
  localStorage.setItem(KEY, JSON.stringify(board));
}

export function clearDraft(): void {
  localStorage.removeItem(KEY);
}
