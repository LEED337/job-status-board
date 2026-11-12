import { afterEach, describe, expect, it, vi } from "vitest";
import { applicationSignature, localDrifts, parseBoard, upsertApplication } from "./board.ts";
import { readDraftRecord, reconcileDraft, saveDraft } from "./storage.ts";
import type { Application, BoardFile } from "../types.ts";

function app(id: string, notes: string, status: Application["status"] = "Applied"): Application {
  return {
    id,
    company: id,
    role: "Role",
    status,
    appliedOn: "2026-11-01",
    location: "Remote",
    notes,
    interviews: [],
  };
}

function board(updatedAt: string, applications: Application[], owner = "Lee Denning"): BoardFile {
  return { version: 1, owner, updatedAt, applications };
}

function installLocal(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  });
  return store;
}

describe("draft reconcile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("drops a legacy draft that would hide newer server applications", () => {
    const server = board("2026-11-12T00:00:00Z", [app("a", "server"), app("b", "new")]);
    const legacy = board("2026-11-01T00:00:00Z", [app("a", "old local")]);
    const next = reconcileDraft(server, {
      legacy: true,
      board: legacy,
      baseUpdatedAt: legacy.updatedAt,
      baseOwner: legacy.owner,
      baseSignatures: {},
    });
    expect(next).toBeNull();
  });

  it("keeps a real local edit and a server addition, without resurrecting a published row as a deletion", () => {
    const base = board("2026-11-01T00:00:00Z", [app("a", "base"), app("b", "base"), app("c", "gone")]);
    const local = board("2026-11-01T00:00:00Z", [app("a", "edited notes", "Ghosted"), app("b", "base")]);
    const server = board("2026-11-12T00:00:00Z", [
      app("a", "base"),
      app("b", "server changed this one"),
      app("c", "still on the server"),
      app("d", "added on the server"),
    ]);
    const next = reconcileDraft(server, {
      legacy: false,
      board: local,
      baseUpdatedAt: base.updatedAt,
      baseOwner: base.owner,
      baseSignatures: {
        a: applicationSignature(base.applications[0]!),
        b: applicationSignature(base.applications[1]!),
        c: applicationSignature(base.applications[2]!),
      },
    });
    expect(next?.applications.map((item) => item.id)).toEqual(["a", "b", "d"]);
    expect(next?.applications.find((item) => item.id === "a")).toMatchObject({ notes: "edited notes", status: "Ghosted" });
    expect(next?.applications.find((item) => item.id === "b")?.notes).toBe("server changed this one");
    expect(next?.applications.find((item) => item.id === "d")?.notes).toBe("added on the server");
  });

  it("drops a published row from the local-drift list", () => {
    const published = board("2026-11-01T00:00:00Z", [app("keep", "server")]);
    const local = board("2026-11-01T00:00:00Z", [app("keep", "server"), app("test", "Test Role", "Applied")]);
    local.applications[1]!.company = "Test";
    const saved = { ...local.applications[1]! };
    const nextPublished = upsertApplication(published, saved);
    const nextLocal = upsertApplication(local, saved);
    expect(localDrifts(nextLocal, nextPublished).map((drift) => drift.id)).not.toContain("test");
    expect(localDrifts(local, published).map((drift) => drift.id)).toContain("test");
  });

  it("round-trips a draft envelope", () => {
    installLocal();
    const published = parseBoard({
      version: 1,
      owner: "Lee Denning",
      updatedAt: "2026-11-12T00:00:00Z",
      applications: [app("a", "published")],
    });
    const edited = { ...published, applications: [app("a", "local")] };
    saveDraft(edited, published);
    const record = readDraftRecord();
    expect(record?.legacy).toBe(false);
    expect(record?.board.applications[0]?.notes).toBe("local");
    expect(record?.baseSignatures.a).toBe(applicationSignature(published.applications[0]!));
  });
});
