const MANAGE_PASSWORD_SHA256 = "de0c3dc77173186a8e8b3f8fd813df82a20573701a7e4f4a4c01d1aca4c6307c";
const SESSION_KEY = "job-search-board:manage-unlocked";

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

export function isManageUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlockManage(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
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
