import { MANAGE_PASSWORD_SHA256 } from "../../api/_lib/password.ts";

export { MANAGE_PASSWORD_SHA256 };
const SESSION_KEY = "job-search-board:manage-unlocked";
const PASSWORD_KEY = "job-search-board:manage-password";

let memoryPassword: string | null = null;

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

function hexEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export function readManagePassword(): string | null {
  try {
    const stored = sessionStorage.getItem(PASSWORD_KEY);
    if (stored) return stored;
  } catch {
    // Fall through to the in-memory copy when storage is blocked.
  }
  return memoryPassword;
}

export function clearManagePassword(): void {
  memoryPassword = null;
  try {
    sessionStorage.removeItem(PASSWORD_KEY);
  } catch {
    // Nothing else to clear.
  }
}

export function isManageUnlocked(): boolean {
  if (!readManagePassword()) return false;
  try {
    if (sessionStorage.getItem(SESSION_KEY) === "1") return true;
  } catch {
    // Storage is blocked; the in-memory password still counts.
  }
  return memoryPassword !== null;
}

export function unlockManage(password: string): void {
  memoryPassword = password;
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
    sessionStorage.setItem(PASSWORD_KEY, password);
  } catch {
    // The page still unlocks in memory when storage is blocked.
  }
}

export async function passwordMatches(password: string): Promise<boolean> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto is unavailable.");
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(password));
  return hexEqual(toHex(digest), MANAGE_PASSWORD_SHA256);
}
