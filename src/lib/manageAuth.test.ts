import { afterEach, describe, expect, it, vi } from "vitest";

function installSession(throwOnAccess = false): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => {
      if (throwOnAccess) throw new Error("blocked");
      return store.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (throwOnAccess) throw new Error("blocked");
      store.set(key, value);
    },
    removeItem: (key: string) => {
      if (throwOnAccess) throw new Error("blocked");
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  });
  return store;
}

describe("manageAuth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("keeps the typed password in session storage across a reload", async () => {
    const store = installSession();
    vi.resetModules();
    const first = await import("./manageAuth.ts");
    first.unlockManage("typed-password");
    expect(first.readManagePassword()).toBe("typed-password");
    expect(first.isManageUnlocked()).toBe(true);
    expect(store.get("job-search-board:manage-password")).toBe("typed-password");

    vi.resetModules();
    const reloaded = await import("./manageAuth.ts");
    expect(reloaded.readManagePassword()).toBe("typed-password");
    expect(reloaded.isManageUnlocked()).toBe(true);

    reloaded.clearManagePassword();
    expect(reloaded.readManagePassword()).toBeNull();
    expect(reloaded.isManageUnlocked()).toBe(false);
    expect(store.has("job-search-board:manage-password")).toBe(false);
  });

  it("keeps the password in memory when session storage is blocked", async () => {
    installSession(true);
    vi.resetModules();
    const auth = await import("./manageAuth.ts");
    auth.unlockManage("typed-password");
    expect(auth.readManagePassword()).toBe("typed-password");
    expect(auth.isManageUnlocked()).toBe(true);
    auth.clearManagePassword();
    expect(auth.isManageUnlocked()).toBe(false);
  });

  it("rejects a password that does not match the committed hash", async () => {
    installSession();
    vi.resetModules();
    const auth = await import("./manageAuth.ts");
    await expect(auth.passwordMatches("not-the-real-password")).resolves.toBe(false);
    expect(auth.MANAGE_PASSWORD_SHA256).toBe("de0c3dc77173186a8e8b3f8fd813df82a20573701a7e4f4a4c01d1aca4c6307c");
  });
});
