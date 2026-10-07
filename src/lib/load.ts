import { parseBoard } from "./board.ts";
import type { BoardFile } from "../types.ts";

export async function loadPublished(): Promise<BoardFile> {
  const url = `${import.meta.env.BASE_URL}data/applications.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load applications (${response.status}).`);
  }
  const json: unknown = await response.json();
  return parseBoard(json);
}

export async function readBoardFile(file: File): Promise<BoardFile> {
  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  return parseBoard(json);
}
