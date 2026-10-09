import type { ApplicationStatus } from "../types.ts";
import { STATUS_META } from "../lib/status.ts";

export function StatusPill({ status }: { status: ApplicationStatus }) {
  const { color } = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold text-white"
      style={{ backgroundColor: color, color: "#ffffff" }}
    >
      {status}
    </span>
  );
}
