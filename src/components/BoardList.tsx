import { useMemo, useState, type ReactNode } from "react";
import {
  avatarStyle,
  countByStatus,
  formatApplied,
  formatLong,
  formatTime,
  initialDir,
  initials,
  interviewDate,
  matchesQuery,
  nextInterview,
  relativeDayLabel,
  sortApplications,
  type SortKey,
  type SortState,
} from "../lib/board.ts";
import { cx } from "../lib/styles.ts";
import { STATUSES, type Application, type ApplicationStatus } from "../types.ts";
import { ChevronIcon, CloseIcon, SearchIcon } from "./Icons.tsx";
import { StatusPill } from "./StatusPill.tsx";

type BoardListProps = {
  applications: Application[];
  now: Date;
  showNotes?: boolean;
  onEdit?: (application: Application) => void;
  onDelete?: (application: Application) => void;
  onAdd?: () => void;
};

type Filter = ApplicationStatus | "All";

export function BoardList({ applications, now, showNotes = false, onEdit, onDelete, onAdd }: BoardListProps) {
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const searched = useMemo(
    () => applications.filter((app) => matchesQuery(app, query)),
    [applications, query],
  );
  const counts = useMemo(() => countByStatus(searched), [searched]);
  const filtered = filter === "All" ? searched : searched.filter((app) => app.status === filter);
  const rows = useMemo(() => sortApplications(filtered, sort, now), [filtered, sort, now]);

  const toggleSort = (key: SortKey) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, dir: initialDir(key) };
      return { key, dir: current.dir === "asc" ? "desc" : "asc" };
    });
  };

  const toggleOpen = (id: string) => {
    setOpen((current) => ({ ...current, [id]: !current[id] }));
  };

  if (applications.length === 0) {
    return (
      <section className="rounded-[22px] bg-white px-6 py-16 text-center  border-[3px] border-black">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">No applications yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          {onAdd
            ? "Add the first company and it will stay in this browser until you export."
            : "Nothing has been published to the shared board."}
        </p>
        {onAdd ? (
          <button type="button" onClick={onAdd} className="mt-5 text-sm font-semibold text-ink underline decoration-black/20 underline-offset-4">
            Add an application
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[22px] bg-white  border-[3px] border-black">
      <div className="flex flex-col gap-3 border-b-[3px] border-black px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Filter by status">
          <FilterChip active={filter === "All"} onClick={() => setFilter("All")}>
            All <span className="num">{searched.length}</span>
          </FilterChip>
          {STATUSES.map((status) => (
            <FilterChip key={status} active={filter === status} onClick={() => setFilter(status)}>
              {status} <span className="num">{counts[status]}</span>
            </FilterChip>
          ))}
        </div>
        <div className="relative w-full lg:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company or role"
            aria-label="Search company or role"
            autoComplete="off"
            className="h-10 w-full rounded-full border-[3px] border-black bg-white pr-9 pl-9 text-sm text-ink outline-none placeholder:text-muted focus:border-ink/20 focus:ring-2 focus:ring-ink/10"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-soft hover:text-ink"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="font-semibold">No applications match</p>
          <p className="mt-1 text-sm text-muted">
            {query.trim() ? `Nothing for “${query.trim()}”.` : "Nothing in this status."}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("All");
            }}
            className="mt-4 text-sm font-semibold underline decoration-black/20 underline-offset-4"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="hidden lg:block">
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">Job applications</caption>
              <colgroup>
                {(onEdit || onDelete
                  ? ["25%", "15%", "16%", "9%", "11%", "10%", "14%"]
                  : ["28%", "18%", "18%", "11%", "11%", "14%"]
                ).map((width, index) => (
                  <col key={`${width}-${index}`} style={{ width }} />
                ))}
              </colgroup>
              <thead>
                <tr className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
                  <SortHeader label="Company" sortKey="company" sort={sort} onSort={toggleSort} className="pr-3 pl-5" />
                  <SortHeader label="Role" sortKey="role" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Applied" sortKey="applied" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Interviews" sortKey="interviews" sort={sort} onSort={toggleSort} />
                  <SortHeader
                    label="Next interview"
                    sortKey="next"
                    sort={sort}
                    onSort={toggleSort}
                    className={onEdit || onDelete ? "" : "pr-5"}
                  />
                  {onEdit || onDelete ? (
                    <th scope="col" className="px-3 py-3 text-left font-semibold">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((app) => (
                  <ApplicationRow
                    key={app.id}
                    application={app}
                    now={now}
                    open={Boolean(open[app.id])}
                    showNotes={showNotes}
                    onToggle={() => toggleOpen(app.id)}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-line lg:hidden">
            {rows.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                now={now}
                open={Boolean(open[app.id])}
                showNotes={showNotes}
                onToggle={() => toggleOpen(app.id)}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "rounded-full px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors",
        active ? "bg-ink text-white" : "bg-soft text-ink hover:bg-[#dcdcdc]",
      )}
    >
      {children}
    </button>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState | null;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cx("px-3 py-3 font-semibold", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="block w-full text-left leading-tight uppercase hover:text-ink"
      >
        {label}
        {active ? <span aria-hidden="true">{sort.dir === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
}

function Avatar({ name }: { name: string }) {
  const colors = avatarStyle(name);
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-semibold"
      style={{ background: colors.bg, color: colors.fg }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function NextCell({ application, now }: { application: Application; now: Date }) {
  const next = nextInterview(application, now);
  if (!next) {
    if (application.status === "Interviewing") {
      return <span className="text-xs font-semibold text-quiet">Not scheduled</span>;
    }
    return <span className="text-muted">—</span>;
  }
  return (
    <div>
      <p className="font-medium text-ink">{relativeDayLabel(next.at, now)}</p>
      <p className="num mt-0.5 text-xs text-muted" title={next.kind}>
        {formatTime(next.at)}
      </p>
    </div>
  );
}

function Timeline({ application, showNotes, now }: { application: Application; showNotes: boolean; now: Date }) {
  const interviews = [...application.interviews].sort(
    (a, b) => interviewDate(a.at).getTime() - interviewDate(b.at).getTime(),
  );
  return (
    <div className="rounded-2xl bg-sheet px-4 py-4">
      {interviews.length === 0 ? (
        <p className="text-sm text-muted">No interviews scheduled yet.</p>
      ) : (
        <ol className="space-y-3">
          {interviews.map((interview) => {
            const upcoming = interviewDate(interview.at).getTime() >= now.getTime();
            return (
              <li key={interview.id} className="flex gap-3">
                <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", upcoming ? "bg-live" : "bg-ink/20")} />
                <div>
                  <p className="text-sm font-medium text-ink">
                    {interview.kind}
                    {upcoming ? <span className="ml-2 text-xs font-semibold text-live">Upcoming</span> : null}
                  </p>
                  <p className="num text-xs text-muted">{formatLong(interview.at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {showNotes && application.notes ? (
        <p className="mt-4 border-t-[3px] border-black pt-3 text-sm leading-5 text-ink">
          <span className="font-semibold">Private note. </span>
          {application.notes}
        </p>
      ) : null}
    </div>
  );
}

function RowActions({
  application,
  onEdit,
  onDelete,
}: {
  application: Application;
  onEdit?: (application: Application) => void;
  onDelete?: (application: Application) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!onEdit && !onDelete) return null;
  if (confirming && onDelete) {
    return (
      <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <span className="text-xs text-muted">Delete?</span>
        <button type="button" className="text-xs font-semibold text-closed" onClick={() => onDelete(application)}>
          Delete
        </button>
        <button type="button" className="text-xs font-semibold text-muted" onClick={() => setConfirming(false)}>
          Keep
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-nowrap items-center gap-1" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      {onEdit ? (
        <button
          type="button"
          onClick={() => onEdit(application)}
          className="rounded-full px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap border-[3px] border-black hover:bg-soft"
        >
          Edit
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-full px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-muted hover:text-closed"
        >
          Delete
        </button>
      ) : null}
    </div>
  );
}

function ApplicationRow({
  application,
  now,
  open,
  showNotes,
  onToggle,
  onEdit,
  onDelete,
}: {
  application: Application;
  now: Date;
  open: boolean;
  showNotes: boolean;
  onToggle: () => void;
  onEdit?: (application: Application) => void;
  onDelete?: (application: Application) => void;
}) {
  const panelId = `interviews-${application.id}`;
  const colSpan = onEdit || onDelete ? 7 : 6;
  return (
    <>
      <tr className={cx("border-t-[3px] border-black", open ? "bg-[#ececec]" : "hover:bg-[#ececec]")}>
        <td className="overflow-hidden py-3.5 pr-3 pl-5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={`${open ? "Hide" : "Show"} interviews for ${application.company}`}
              onClick={onToggle}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-black/5 hover:text-ink"
            >
              <ChevronIcon className={cx("h-4 w-4 transition-transform", open && "rotate-90")} />
            </button>
            <Avatar name={application.company} />
            <div className="min-w-0">
              <p className="font-medium leading-5 text-ink" title={application.company}>
                {application.company}
              </p>
              <p className="text-xs leading-4 text-muted" title={application.location}>
                {application.location || "Location not set"}
              </p>
            </div>
          </div>
        </td>
        <td className="overflow-hidden px-3 py-3.5 text-ink">
          <p className="leading-5" title={application.role}>
            {application.role}
          </p>
        </td>
        <td className="px-3 py-3.5">
          <StatusPill status={application.status} />
        </td>
        <td className="num px-3 py-3.5 whitespace-nowrap text-muted">{formatApplied(application.appliedOn, now)}</td>
        <td className="num px-3 py-3.5">
          {application.interviews.length > 0 ? (
            application.interviews.length
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>
        <td className="overflow-hidden px-3 py-3.5">
          <NextCell application={application} now={now} />
        </td>
        {onEdit || onDelete ? (
          <td className="py-3.5 pr-5 pl-3">
            <RowActions application={application} onEdit={onEdit} onDelete={onDelete} />
          </td>
        ) : null}
      </tr>
      {open ? (
        <tr className="bg-[#ececec]">
          <td id={panelId} colSpan={colSpan} className="px-5 pt-0 pb-4">
            <Timeline application={application} showNotes={showNotes} now={now} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ApplicationCard({
  application,
  now,
  open,
  showNotes,
  onToggle,
  onEdit,
  onDelete,
}: {
  application: Application;
  now: Date;
  open: boolean;
  showNotes: boolean;
  onToggle: () => void;
  onEdit?: (application: Application) => void;
  onDelete?: (application: Application) => void;
}) {
  const panelId = `interviews-card-${application.id}`;
  const next = nextInterview(application, now);
  return (
    <li className="px-4 py-4">
      <div className="flex items-start gap-3">
        <Avatar name={application.company} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-5 text-ink">{application.company}</p>
          <p className="mt-0.5 text-sm leading-5 text-muted">{application.role}</p>
          {application.location ? <p className="mt-0.5 text-xs text-muted">{application.location}</p> : null}
          <div className="mt-2.5">
            <StatusPill status={application.status} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-muted">Applied</dt>
              <dd className="num mt-0.5 font-medium text-ink">{formatApplied(application.appliedOn, now)}</dd>
            </div>
            <div>
              <dt className="text-muted">Interviews</dt>
              <dd className="num mt-0.5 font-medium text-ink">{application.interviews.length}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted">Next interview</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {next ? (
                  <>
                    <span className="block">{relativeDayLabel(next.at, now)}</span>
                    <span className="num mt-0.5 block font-normal text-muted">
                      {formatTime(next.at)} · {next.kind}
                    </span>
                  </>
                ) : application.status === "Interviewing" ? (
                  <span className="text-quiet">Not scheduled</span>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={onToggle}
              className="text-xs font-semibold text-ink underline decoration-black/20 underline-offset-4"
            >
              {open ? "Hide interviews" : "Show interviews"}
            </button>
            <RowActions application={application} onEdit={onEdit} onDelete={onDelete} />
          </div>
          {open ? (
            <div id={panelId} className="mt-3">
              <Timeline application={application} showNotes={showNotes} now={now} />
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
