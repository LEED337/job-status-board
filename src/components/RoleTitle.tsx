import { cx } from "../lib/styles.ts";

type RoleTitleProps = {
  role: string;
  jobUrl?: string;
  className?: string;
};

/** Drop classes the card CSS forces to near-black with !important, so the link color wins. */
function withoutInkOverride(className?: string) {
  if (!className) return undefined;
  const kept = className
    .split(/\s+/)
    .filter((token) => token && !token.includes("text-ink") && !token.includes("text-muted"));
  return kept.length > 0 ? kept.join(" ") : undefined;
}

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
        "text-[#0645ad] underline-offset-[3px] hover:text-[#053a91] hover:underline focus-visible:underline",
        withoutInkOverride(className),
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
