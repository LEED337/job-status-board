import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import handler from "./save-application.ts";

const realFetch = globalThis.fetch;

const TOKEN = "ghp_test_token_should_not_leak";
const PASSWORD = "manage-test";
const PASSWORD_HASH = createHash("sha256").update(PASSWORD, "utf8").digest("hex");

type BoardApp = {
  id: string;
  company: string;
  role: string;
  status: string;
  appliedOn: string;
  location: string;
  notes?: string;
  jobUrl?: string;
  interviews: { id: string; at: string; kind: string }[];
};

function boardText(): string {
  return `${JSON.stringify(
    {
      version: 1,
      owner: "Lee Denning",
      updatedAt: "2026-11-01T00:00:00.000Z",
      applications: [
        {
          id: "app-one",
          company: "Acme",
          role: "Engineer",
          status: "Applied",
          appliedOn: "2026-10-01",
          location: "Remote · USA",
          notes: "Pay $10–$20",
          interviews: [{ id: "int-1", at: "2026-10-02T09:00", kind: "Recruiter screen" }],
        },
        {
          id: "app-two",
          company: "Beta",
          role: "TAM",
          jobUrl: "https://example.com/jobs/1",
          status: "Interviewing",
          appliedOn: "2026-10-03",
          location: "Lehi, UT",
          interviews: [],
        },
      ],
    },
    null,
    2,
  )}\n`;
}

function post(body: unknown, headers?: HeadersInit): Promise<Response> {
  return handler.fetch(
    new Request("http://local/api/save-application", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

type PutCall = { url: string; body: { message: string; content: string; sha: string; branch: string } };

function installGithub(options?: {
  reads?: { text: string; sha: string; download?: boolean }[];
  writes?: { status: number; sha?: string }[];
}) {
  const reads = options?.reads ?? [{ text: boardText(), sha: "sha-1" }];
  const writes = options?.writes ?? [{ status: 200, sha: "commit-1" }];
  const gets: { url: string; authorization: string | null }[] = [];
  const puts: PutCall[] = [];
  const downloads: { url: string; authorization: string | null }[] = [];
  let readIndex = 0;
  let writeIndex = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (url.startsWith("https://raw.githubusercontent.com/")) {
      downloads.push({ url, authorization: headers.get("authorization") });
      return new Response(reads[0]?.text ?? boardText(), { status: 200 });
    }
    if (!url.startsWith("https://api.github.com/")) return original(input, init);
    if (method === "GET") {
      gets.push({ url, authorization: headers.get("authorization") });
      const current = reads[Math.min(readIndex, reads.length - 1)] ?? { text: boardText(), sha: "sha-1" };
      readIndex += 1;
      if (current.download) {
        return new Response(
          JSON.stringify({
            sha: current.sha,
            content: "",
            encoding: "none",
            download_url: "https://raw.githubusercontent.com/local/job-status-board/main/public/data/applications.json",
          }),
          { status: 200 },
        );
      }
      const wrapped = Buffer.from(current.text, "utf8").toString("base64").replace(/.{60}/g, "$&\n");
      return new Response(JSON.stringify({ sha: current.sha, content: wrapped, encoding: "base64" }), { status: 200 });
    }
    const body = JSON.parse(String(init?.body)) as PutCall["body"];
    puts.push({ url, body });
    const planned = writes[writeIndex] ?? { status: 500 };
    writeIndex += 1;
    if (planned.status !== 200) return new Response("nope", { status: planned.status });
    return new Response(JSON.stringify({ commit: { sha: planned.sha ?? "commit-1" } }), { status: 200 });
  };
  return {
    gets,
    puts,
    downloads,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function savedApps(call: PutCall): BoardApp[] {
  const text = Buffer.from(call.body.content, "base64").toString("utf8");
  const parsed = JSON.parse(text) as { applications: BoardApp[] };
  return parsed.applications;
}

describe("save-application", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of ["MANAGE_PASSWORD_SHA256", "GITHUB_TOKEN", "GITHUB_REPO", "GITHUB_BRANCH"] as const) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    globalThis.fetch = realFetch;
  });

  function allow(): void {
    process.env.MANAGE_PASSWORD_SHA256 = PASSWORD_HASH;
    process.env.GITHUB_TOKEN = TOKEN;
    process.env.GITHUB_REPO = "local/job-status-board";
    process.env.GITHUB_BRANCH = "main";
  }

  it("rejects GET and an empty POST", async () => {
    const get = await handler.fetch(new Request("http://local/api/save-application"));
    expect(get.status).toBe(405);
    expect(await get.json()).toEqual({ error: "method_not_allowed" });
    const empty = await post("");
    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({ error: "invalid_json" });
  });

  it("returns 401 for a bad password and does not call GitHub", async () => {
    allow();
    const github = installGithub();
    const response = await post({ password: "nope", op: "delete", id: "app-one" });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "unauthorized" });
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    expect(github.gets).toHaveLength(0);
    expect(github.puts).toHaveLength(0);
    github.restore();
  });

  it("returns 503 not_configured when GITHUB_TOKEN is missing", async () => {
    allow();
    delete process.env.GITHUB_TOKEN;
    const github = installGithub();
    const response = await post({ password: PASSWORD, op: "delete", id: "app-one" });
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string; message: string };
    expect(body.error).toBe("not_configured");
    expect(body.message).toContain("GITHUB_TOKEN");
    expect(github.gets).toHaveLength(0);
    github.restore();
  });

  it("upserts an existing application and leaves the other one unchanged", async () => {
    allow();
    const github = installGithub();
    const response = await post({
      password: PASSWORD,
      op: "upsert",
      application: {
        id: "app-one",
        company: " Acme ",
        role: "Engineer",
        status: "Ghosted",
        appliedOn: "2026-10-01",
        location: " Remote · USA ",
        notes: "  Pay $10–$20 and a note  ",
        jobUrl: "",
        interviews: [
          { id: "int-1", at: "2026-10-02T09:00:00", kind: " Recruiter screen " },
          { id: "int-2", at: "2026-11-20T15:30", kind: "Hiring manager" },
        ],
      },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { commitSha: string; application: BoardApp; owner: string };
    expect(body.commitSha).toBe("commit-1");
    expect(body.owner).toBe("Lee Denning");
    expect(body.application.status).toBe("Ghosted");
    expect(body.application.notes).toContain("Pay $10–$20");
    expect(body.application.location).toBe("Remote · USA");
    expect(body.application.appliedOn).toBe("2026-10-01");
    expect(body.application.interviews.map((item) => item.at)).toEqual(["2026-10-02T09:00", "2026-11-20T15:30"]);
    expect(JSON.stringify(body)).not.toContain(TOKEN);

    expect(github.gets[0]?.url).toContain("ref=main");
    expect(github.gets[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    expect(github.puts).toHaveLength(1);
    expect(github.puts[0]?.body.branch).toBe("main");
    expect(github.puts[0]?.body.sha).toBe("sha-1");
    const apps = savedApps(github.puts[0]!);
    expect(apps).toHaveLength(2);
    expect(apps[1]).toMatchObject({ id: "app-two", company: "Beta", jobUrl: "https://example.com/jobs/1" });
    const saved = apps.find((app) => app.id === "app-one");
    expect(saved?.status).toBe("Ghosted");
    expect(saved?.notes).toBe("Pay $10–$20 and a note");
    expect(saved?.interviews).toHaveLength(2);
    github.restore();
  });

  it("adds a new application with a unique id", async () => {
    allow();
    const github = installGithub();
    const response = await post({
      password: PASSWORD,
      op: "upsert",
      application: {
        company: "Movate",
        role: "Technical Support Specialist",
        status: "Applied",
        appliedOn: "2026-11-11",
        location: "South Jordan, UT",
        notes: "Posted pay shows $3,577–$5,700.",
        jobUrl: "https://www.linkedin.com/jobs/view/4485158770/",
        interviews: [],
      },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { application: BoardApp };
    expect(body.application.id).toBeTruthy();
    expect(body.application.id).not.toBe("app-one");
    expect(body.application.id).not.toBe("app-two");
    const apps = savedApps(github.puts[0]!);
    expect(apps).toHaveLength(3);
    expect(apps[0]?.company).toBe("Movate");
    expect(apps[0]?.jobUrl).toContain("4485158770");
    expect(apps.map((app) => app.id).filter((id) => id === "app-one" || id === "app-two")).toEqual(["app-one", "app-two"]);
    github.restore();
  });

  it("deletes one application", async () => {
    allow();
    const github = installGithub();
    const response = await post({ password: PASSWORD, op: "delete", id: "app-two" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { application: null; commitSha: string };
    expect(body.application).toBeNull();
    expect(body.commitSha).toBe("commit-1");
    const apps = savedApps(github.puts[0]!);
    expect(apps.map((app) => app.id)).toEqual(["app-one"]);
    github.restore();
  });

  it("retries a 409 with the new sha", async () => {
    allow();
    const github = installGithub({
      reads: [
        { text: boardText(), sha: "sha-old" },
        { text: boardText(), sha: "sha-new" },
      ],
      writes: [{ status: 409 }, { status: 200, sha: "commit-after-retry" }],
    });
    const response = await post({
      password: PASSWORD,
      op: "upsert",
      application: {
        id: "app-two",
        company: "Beta",
        role: "TAM",
        status: "Not hired",
        appliedOn: "2026-10-03",
        location: "Lehi, UT",
        jobUrl: "https://example.com/jobs/1",
        interviews: [],
      },
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { commitSha: string }).commitSha).toBe("commit-after-retry");
    expect(github.puts.map((call) => call.body.sha)).toEqual(["sha-old", "sha-new"]);
    expect(github.gets).toHaveLength(2);
    github.restore();
  });

  it("does not send the token to a raw download host", async () => {
    allow();
    const github = installGithub({ reads: [{ text: boardText(), sha: "sha-1", download: true }] });
    const response = await post({ password: PASSWORD, op: "delete", id: "app-two" });
    expect(response.status).toBe(200);
    expect(github.downloads[0]?.authorization).toBeNull();
    github.restore();
  });

  it("maps a GitHub 403 to a token message without the token", async () => {
    allow();
    const github = installGithub({ writes: [{ status: 403 }] });
    const response = await post({ password: PASSWORD, op: "delete", id: "app-two" });
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string; message: string };
    expect(body.error).toBe("github");
    expect(body.message).toContain("GITHUB_TOKEN");
    expect(body.message).toContain("Contents");
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    github.restore();
  });
});
