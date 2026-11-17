import type { ApplicationStatus } from "../types.ts";
import { STATUS_META } from "../lib/status.ts";

export function StatusPill({ status }: { status: ApplicationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold${
        status === "Offer accepted" ? " border-2 border-[var(--chip-offer-border)] font-bold" : ""
      }`}
      style={{ background: meta.chip, color: meta.text }}
    >
      {status}
    </span>
  );
}
