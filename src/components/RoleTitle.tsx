import { cx } from "../lib/styles.ts";

type RoleTitleProps = {
  role: string;
  jobUrl?: string;
  className?: string;
};

export function RoleTitle({ role, jobUrl, className }: RoleTitleProps) {
  if (!jobUrl) {
    return <span className={className}>{role}</span>;
  }

  return (
    <a
      href={jobUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={jobUrl}
      className={cx(
        "text-ink underline-offset-[3px] decoration-black/70 hover:underline focus-visible:underline",
        className,
      )}
    >
      {role}
      <span aria-hidden="true" className="ml-1 inline-block text-[0.85em] leading-none">
        ↗
      </span>
      <span className="sr-only"> (job posting, opens in a new tab)</span>
    </a>
  );
}
