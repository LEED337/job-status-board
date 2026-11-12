export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export const btnPrimary =
  "inline-flex h-11 min-h-11 items-center justify-center gap-1.5 rounded-full border-[3px] border-black bg-fill px-4 text-sm font-semibold text-[#ffffff] transition-colors hover:bg-[#000000] disabled:cursor-not-allowed disabled:opacity-40";

export const btnSecondary =
  "inline-flex h-11 min-h-11 items-center justify-center gap-1.5 rounded-full border-[3px] border-black bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40";

export const fieldClass =
  "h-11 w-full rounded-xl border-[3px] border-black bg-white px-3 text-sm text-ink outline-none transition focus:ring-2 focus:ring-ink/15";
