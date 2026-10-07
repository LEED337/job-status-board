import type { ReactNode } from "react";
import { cx } from "../lib/styles.ts";

type ShellProps = {
  title: string;
  subtitle: string;
  embed?: boolean;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

export function Shell({ title, subtitle, embed = false, actions, footer, children }: ShellProps) {
  return (
    <div className={embed ? "min-h-screen bg-wash p-2" : "min-h-screen px-3 py-4 sm:px-5 sm:py-6"}>
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-4">
        {!embed ? (
          <div className="flex w-full justify-center">
            <img
              src="/lee-job-adventure-banner-v2.png"
              alt="Lee's Job Adventure!"
              className="h-auto w-full max-w-[1160px] object-contain"
            />
          </div>
        ) : null}
        <div
          className={cx(
            "flex min-h-[calc(100vh-2rem)] flex-col overflow-hidden border-[3px] border-black bg-white",
            embed ? "rounded-[20px]" : "rounded-[24px] sm:rounded-[28px]",
          )}
        >
          <header
            className={cx(
              "flex flex-col gap-4 border-b-[3px] border-black sm:flex-row sm:items-center sm:justify-between",
              embed ? "px-4 py-4" : "px-5 py-5 sm:px-7 sm:py-6",
            )}
          >
            <div className="flex items-center gap-3.5">
              <Mark />
              <div>
                <h1
                  className={cx(
                    "font-semibold leading-none tracking-[-0.04em] text-ink",
                    embed ? "text-[1.35rem]" : "text-[1.7rem] sm:text-[1.85rem]",
                  )}
                >
                  {title}
                </h1>
                <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
              </div>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </header>
          <div className={cx("dot-bg flex-1", embed ? "px-3 py-3" : "px-4 py-4 sm:px-6 sm:py-6")}>
            {children}
          </div>
          {footer && !embed ? (
            <footer className="border-t-[3px] border-black px-5 py-3 text-xs text-muted sm:px-7">{footer}</footer>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Mark() {
  return (
    <div
      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
      aria-hidden="true"
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="5" cy="11" r="2.05" fill="#8fd4b4" />
        <circle cx="11" cy="11" r="2.05" fill="#ffffff" />
        <circle cx="17" cy="11" r="2.05" fill="#e7c48a" />
      </svg>
    </div>
  );
}
