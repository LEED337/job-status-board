export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-full border-[3px] border-black bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40";

export const btnSecondary =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-ink ring-1 ring-black/10 transition-colors hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40";

export const fieldClass =
  "h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-2 focus:ring-ink/10";
