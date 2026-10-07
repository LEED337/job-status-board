import { parseBoard } from "./board.ts";
import type { Application } from "../types.ts";

export type PublishReason = "not_configured" | "network" | "unauthorized" | "not_found" | "rejected";

export type PublishResult =
  | {
      ok: true;
      application: Application | null;
      commitSha: string;
      owner: string;
      updatedAt: string;
    }
  | { ok: false; reason: PublishReason; message: string };

function endpoint(): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}api/save-application`.replace(/([^:]\/)\/+/g, "$1");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function publishOperation(input: {
  password: string;
  op: "upsert" | "delete";
  application?: Application;
  id?: string;
  owner?: string;
}): Promise<PublishResult> {
  const body: Record<string, unknown> = { password: input.password, op: input.op };
  if (input.op === "upsert") body.application = input.application;
  if (input.op === "delete") body.id = input.id;
  if (input.owner !== undefined) body.owner = input.owner;

  let response: Response;
  try {
    response = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, reason: "network", message: "Couldn't reach the shared board." };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const record = asRecord(payload);

  if (!response.ok) {
    if (response.status === 503 && record?.error === "not_configured") {
      return {
        ok: false,
        reason: "not_configured",
        message: "Shared saving isn't configured on the server yet.",
      };
    }
    if (response.status === 401) {
      return { ok: false, reason: "unauthorized", message: "The password was rejected." };
    }
    if (response.status === 404 && record?.error === "not_found") {
      return { ok: false, reason: "not_found", message: "That application is not on the shared board." };
    }
    const message = typeof record?.message === "string" ? record.message : "The shared board was not updated.";
    return { ok: false, reason: "rejected", message };
  }

  const commitSha = typeof record?.commitSha === "string" ? record.commitSha : "";
  if (!commitSha) {
    return { ok: false, reason: "rejected", message: "The shared board did not confirm the save." };
  }

  let application: Application | null = null;
  if (record?.application != null) {
    try {
      const parsed = parseBoard({ version: 1, owner: "Owner", applications: [record.application] });
      application = parsed.applications[0] ?? null;
    } catch {
      return { ok: false, reason: "rejected", message: "The shared board returned an unreadable application." };
    }
  }

  return {
    ok: true,
    application,
    commitSha,
    owner: typeof record?.owner === "string" ? record.owner : "",
    updatedAt: typeof record?.updatedAt === "string" ? record.updatedAt : "",
  };
}
