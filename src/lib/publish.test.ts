import { afterEach, describe, expect, it, vi } from "vitest";
import { publishOperation } from "./publish.ts";
import type { Application } from "../types.ts";

const application: Application = {
  id: "app-one",
  company: "Acme",
  role: "Engineer",
  status: "Ghosted",
  appliedOn: "2026-11-12",
  location: "South Jordan, UT",
  notes: "Posted pay shows $3,577–$5,700.",
  jobUrl: "https://www.linkedin.com/jobs/view/4485158770/",
  interviews: [{ id: "int-1", at: "2026-11-20T10:00", kind: "Recruiter screen" }],
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("publishOperation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the password with every upsert and delete", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      bodies.push({ url, method: init.method, body: JSON.parse(String(init.body)) });
      return jsonResponse(
        { application, commitSha: "abc123", owner: "Lee Denning", updatedAt: "2026-11-12T14:00:00Z" },
        200,
      );
    });

    const saved = await publishOperation({ password: "secret", op: "upsert", application, owner: "Lee Denning" });
    const removed = await publishOperation({ password: "secret", op: "delete", id: "app-one" });

    expect(saved).toMatchObject({
      ok: true,
      commitSha: "abc123",
      owner: "Lee Denning",
      updatedAt: "2026-11-12T14:00:00Z",
    });
    if (saved.ok) {
      expect(saved.application?.status).toBe("Ghosted");
      expect(saved.application?.notes).toContain("$3,577");
      expect(saved.application?.interviews[0]?.at).toBe("2026-11-20T10:00");
    }
    expect(removed.ok).toBe(true);
    expect(bodies).toEqual([
      {
        url: "/api/save-application",
        method: "POST",
        body: { password: "secret", op: "upsert", application, owner: "Lee Denning" },
      },
      {
        url: "/api/save-application",
        method: "POST",
        body: { password: "secret", op: "delete", id: "app-one" },
      },
    ]);
  });

  it("reports 401, not_configured, and GitHub errors from the response", async () => {
    const cases = [
      {
        status: 401,
        body: { error: "unauthorized" },
        reason: "unauthorized",
        message: "The password was rejected. (HTTP 401)",
      },
      {
        status: 503,
        body: { error: "not_configured", message: "GITHUB_TOKEN is not set on the server." },
        reason: "not_configured",
        message: "GITHUB_TOKEN is not set on the server. (HTTP 503)",
      },
      {
        status: 502,
        body: {
          error: "github",
          message: "GitHub rejected GITHUB_TOKEN. It may be expired or missing Contents write permission.",
        },
        reason: "rejected",
        message:
          "GitHub rejected GITHUB_TOKEN. It may be expired or missing Contents write permission. (HTTP 502)",
      },
    ] as const;

    for (const item of cases) {
      vi.stubGlobal("fetch", async () => jsonResponse(item.body, item.status));
      const result = await publishOperation({ password: "secret", op: "delete", id: "app-one" });
      expect(result).toMatchObject({ ok: false, reason: item.reason, message: item.message, status: item.status });
    }
  });

  it("reports a network failure without throwing", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    const result = await publishOperation({ password: "secret", op: "upsert", application });
    expect(result).toEqual({
      ok: false,
      reason: "network",
      message: "Couldn't reach the shared board (no HTTP response).",
    });
  });
});
