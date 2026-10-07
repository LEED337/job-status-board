import {
  countByStatus,
  formatConcrete,
  nextUpcoming,
  relativeDayLabel,
  upcomingCount,
} from "../lib/board.ts";
import { STATUS_META } from "../lib/status.ts";
import { STATUSES, type Application } from "../types.ts";
import { CalendarIcon } from "./Icons.tsx";
import { RoleTitle } from "./RoleTitle.tsx";

type SummaryProps = {
  applications: Application[];
  now: Date;
};

export function Summary({ applications, now }: SummaryProps) {
  const counts = countByStatus(applications);
  const total = applications.length;
  const upcoming = nextUpcoming(applications, now);
  const scheduled = upcomingCount(applications, now);

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]" aria-label="Summary">
      <div className="rounded-[22px] bg-white p-5  border-[3px] border-black sm:p-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-6">
          {STATUSES.map((status) => {
            const meta = STATUS_META[status];
            return (
              <div key={status}>
                <p className="num text-[2.05rem] font-semibold leading-none tracking-[-0.045em] text-ink">
                  {counts[status]}
                </p>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.bar }} />
                  <p className="text-[13px] font-medium leading-4 text-ink">{status}</p>
                </div>
                <p className="mt-1 text-xs text-muted">{meta.caption}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-6">
          <div className="mb-2.5 flex items-baseline justify-between gap-3 text-sm">
            <p className="font-medium text-ink">
              <span className="num">{total}</span> {total === 1 ? "application" : "applications"}
            </p>
            <p className="text-muted">
              <span className="num">{counts.Interviewing}</span> interviewing now
            </p>
          </div>
          <div className="flex h-2 gap-1 overflow-hidden rounded-full bg-[#d0d0d0]" aria-hidden="true">
            {STATUSES.map((status) =>
              counts[status] > 0 ? (
                <div
                  key={status}
                  className="h-full rounded-full"
                  style={{ flex: counts[status], background: STATUS_META[status].bar }}
                />
              ) : null,
            )}
          </div>
        </div>
      </div>

      <div className="flex h-full flex-col rounded-[22px] border-[3px] border-black bg-[#d4f3e4] p-5 text-ink sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Next interview</p>
          <CalendarIcon className="h-4 w-4 text-live" />
        </div>
        {upcoming ? (
          <div className="mt-6 flex flex-1 flex-col">
            <p className="text-[1.85rem] font-semibold leading-none tracking-[-0.04em] text-ink">
              {relativeDayLabel(upcoming.interview.at, now)}
            </p>
            <p className="mt-2 text-sm text-muted">{formatConcrete(upcoming.interview.at)}</p>
            <div className="mt-auto border-t border-black/15 pt-4">
              <p className="font-medium text-ink">{upcoming.application.company}</p>
              <p className="mt-0.5 text-sm text-muted">
                <RoleTitle role={upcoming.application.role} jobUrl={upcoming.application.jobUrl} />
              </p>
              <p className="mt-3 inline-flex rounded-full border-[2px] border-black/20 bg-white/70 px-2.5 py-1 text-xs font-medium text-ink">
                {upcoming.interview.kind}
              </p>
              <p className="mt-3 text-xs text-muted">
                {scheduled > 1 ? `Soonest of ${scheduled} scheduled` : "On the calendar"}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <p className="text-[1.7rem] font-semibold leading-[1.1] tracking-[-0.04em] text-ink">Nothing on the calendar</p>
            <p className="mt-3 max-w-[16rem] text-sm leading-5 text-muted">
              The next scheduled conversation will show here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
