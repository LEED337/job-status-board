import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPublished } from "./load.ts";

describe("loadPublished", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("busts the cache on the shared file", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          version: 1,
          owner: "Lee Denning",
          updatedAt: "2026-11-12T00:00:00Z",
          applications: [],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const board = await loadPublished();
    expect(board.owner).toBe("Lee Denning");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/^\/data\/applications\.json\?t=\d+$/);
    expect(init.cache).toBe("no-store");
  });
});
