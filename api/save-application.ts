import { createHash, timingSafeEqual } from "node:crypto";
import { applySharedOperation, BoardChangeError, type SharedEdit } from "../src/lib/board.ts";
import { MANAGE_PASSWORD_SHA256 } from "../src/lib/manageAuth.ts";

const FILE_PATH = "public/data/applications.json";
const MAX_ATTEMPTS = 4;

type GitHubFile = {
  text: string;
  sha: string;
};

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

function expectedPasswordHash(): string {
  const configured = process.env.MANAGE_PASSWORD_SHA256?.trim().toLowerCase();
  return configured || MANAGE_PASSWORD_SHA256;
}

function hashesEqual(actualHex: string, expectedHex: string): boolean {
  const actual = Buffer.from(actualHex);
  const expected = Buffer.from(expectedHex);
  if (actual.length !== expected.length) {
    timingSafeEqual(actual, actual);
    return false;
  }
  return timingSafeEqual(actual, expected);
}

function passwordAccepted(password: string): boolean {
  const digest = createHash("sha256").update(password, "utf8").digest("hex");
  return hashesEqual(digest, expectedPasswordHash());
}

function githubTarget(): { repo: string; branch: string } | Response {
  const repo = (process.env.GITHUB_REPO || "LEED337/job-status-board").trim();
  const branch = (process.env.GITHUB_BRANCH || "main").trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    return json({ error: "not_configured" }, 503);
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes("..") || branch.startsWith("/") || branch.endsWith("/")) {
    return json({ error: "not_configured" }, 503);
  }
  return { repo, branch };
}

function githubHeaders(token: string): Headers {
  const headers = new Headers();
  headers.set("Accept", "application/vnd.github+json");
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("User-Agent", "job-status-board");
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  return headers;
}

function contentsUrl(repo: string, branch?: string): string {
  const url = `https://api.github.com/repos/${repo}/contents/${FILE_PATH}`;
  if (!branch) return url;
  return `${url}?ref=${encodeURIComponent(branch)}`;
}

async function readApplications(token: string, repo: string, branch: string): Promise<GitHubFile> {
  const response = await fetch(contentsUrl(repo, branch), {
    headers: githubHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`GitHub read failed (${response.status}).`);
  }
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object") throw new Error("GitHub read returned an unreadable file.");
  const record = payload as Record<string, unknown>;
  if (typeof record.sha !== "string" || !record.sha) throw new Error("GitHub read did not return a sha.");
  let text = "";
  if (typeof record.content === "string" && record.content.trim()) {
    text = Buffer.from(record.content.replace(/\s/g, ""), "base64").toString("utf8");
  } else if (typeof record.download_url === "string" && record.download_url) {
    const downloaded = await fetch(record.download_url, { headers: githubHeaders(token), cache: "no-store" });
    if (!downloaded.ok) throw new Error(`GitHub download failed (${downloaded.status}).`);
    text = await downloaded.text();
  } else {
    throw new Error("GitHub read did not return file content.");
  }
  return { text, sha: record.sha };
}

async function writeApplications(
  token: string,
  repo: string,
  branch: string,
  text: string,
  sha: string,
  message: string,
): Promise<{ ok: true; commitSha: string } | { ok: false; status: number }> {
  const headers = githubHeaders(token);
  headers.set("Content-Type", "application/json");
  const response = await fetch(contentsUrl(repo), {
    method: "PUT",
    headers,
    cache: "no-store",
    body: JSON.stringify({
      message,
      content: Buffer.from(text, "utf8").toString("base64"),
      sha,
      branch,
    }),
  });
  if (response.status === 409) return { ok: false, status: 409 };
  if (!response.ok) return { ok: false, status: response.status };
  const payload: unknown = await response.json();
  const commitSha =
    payload &&
    typeof payload === "object" &&
    "commit" in payload &&
    payload.commit &&
    typeof payload.commit === "object" &&
    "sha" in payload.commit &&
    typeof payload.commit.sha === "string"
      ? payload.commit.sha
      : "";
  if (!commitSha) return { ok: false, status: 502 };
  return { ok: true, commitSha };
}

function readEdit(body: Record<string, unknown>): SharedEdit | Response {
  let owner: string | undefined;
  if ("owner" in body && body.owner !== undefined && body.owner !== null) {
    if (typeof body.owner !== "string") return json({ error: "invalid_request", message: "Owner must be a string." }, 400);
    owner = body.owner;
  }
  if (body.op === "upsert") {
    if (!body.application || typeof body.application !== "object" || Array.isArray(body.application)) {
      return json({ error: "invalid_request", message: "Upsert needs an application." }, 400);
    }
    return { op: "upsert", application: body.application, ...(owner !== undefined ? { owner } : {}) };
  }
  if (body.op === "delete") {
    if (typeof body.id !== "string" || !body.id.trim()) {
      return json({ error: "invalid_request", message: "Delete needs an application id." }, 400);
    }
    return { op: "delete", id: body.id.trim(), ...(owner !== undefined ? { owner } : {}) };
  }
  return json({ error: "invalid_request", message: "Op must be upsert or delete." }, 400);
}

function commitMessage(edit: SharedEdit, company: string, id: string): string {
  const label = company.replace(/[\r\n\t]+/g, " ").trim().slice(0, 80) || "application";
  const verb = edit.op === "delete" ? "delete" : "update";
  return `Manage: ${verb} ${label} (${id})`;
}

async function publishEdit(token: string, repo: string, branch: string, edit: SharedEdit): Promise<Response> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let current: GitHubFile;
    try {
      current = await readApplications(token, repo, branch);
    } catch (error) {
      console.error(error instanceof Error ? error.message : "GitHub read failed.");
      return json({ error: "github", message: "Couldn't read the shared board." }, 502);
    }

    let merged;
    try {
      merged = applySharedOperation(current.text, edit, new Date().toISOString());
    } catch (error) {
      if (error instanceof BoardChangeError && error.code === "not_found") {
        return json({ error: "not_found", message: error.message }, 404);
      }
      const message = error instanceof Error ? error.message : "Couldn't apply that change.";
      return json({ error: "invalid_application", message }, 400);
    }

    let written;
    try {
      written = await writeApplications(
        token,
        repo,
        branch,
        merged.text,
        current.sha,
        commitMessage(edit, merged.company, merged.id),
      );
    } catch (error) {
      console.error(error instanceof Error ? error.message : "GitHub write failed.");
      return json({ error: "github", message: "Couldn't update the shared board." }, 502);
    }

    if (!written.ok && written.status === 409 && attempt < MAX_ATTEMPTS - 1) continue;
    if (!written.ok && written.status === 409) return json({ error: "conflict" }, 409);
    if (!written.ok) {
      console.error(`GitHub write failed (${written.status}).`);
      return json({ error: "github", message: "Couldn't update the shared board." }, 502);
    }

    return json(
      {
        application: merged.application,
        commitSha: written.commitSha,
        owner: merged.owner,
        updatedAt: merged.updatedAt,
      },
      200,
    );
  }
  return json({ error: "conflict" }, 409);
}

async function saveApplication(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "invalid_request" }, 400);
  }
  const record = body as Record<string, unknown>;
  if (typeof record.password !== "string") return json({ error: "invalid_request" }, 400);
  if (!passwordAccepted(record.password)) return json({ error: "unauthorized" }, 401);

  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return json({ error: "not_configured" }, 503);

  const target = githubTarget();
  if (target instanceof Response) return target;
  const edit = readEdit(record);
  if (edit instanceof Response) return edit;
  return publishEdit(token, target.repo, target.branch, edit);
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    return saveApplication(request);
  },
};
