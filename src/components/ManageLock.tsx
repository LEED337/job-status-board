import { useEffect, useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { passwordMatches, unlockManage } from "../lib/manageAuth.ts";
import { btnPrimary, btnSecondary } from "../lib/styles.ts";
import { Shell } from "./Shell.tsx";

type ManageLockProps = {
  embed?: boolean;
  onUnlock: () => void;
};

export function ManageLock({ embed = false, onUnlock }: ManageLockProps) {
  const fieldId = useId();
  const errorId = useId();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    document.title = "Manage · Job search";
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const ok = await passwordMatches(password);
      if (!ok) {
        setError("Wrong password.");
        return;
      }
      setPassword("");
      unlockManage();
      onUnlock();
    } catch {
      setError("Couldn't check the password. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Shell
      title="Manage"
      subtitle="Enter the password to edit this board."
      embed={embed}
      actions={
        embed ? null : (
          <Link to="/" className={`${btnSecondary} no-print`}>
            View shared board
          </Link>
        )
      }
    >
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        className="mx-auto max-w-md rounded-[22px] border-[3px] border-black bg-white p-5 sm:p-6"
      >
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">Unlock Manage</h2>
        <p className="mt-1.5 text-sm leading-5 text-muted">
          The shared board stays open. Editing stays locked until this password matches.
        </p>
        <label htmlFor={fieldId} className="mt-5 flex flex-col gap-1.5 text-xs font-semibold text-muted">
          Password
          <input
            id={fieldId}
            type="password"
            name="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError(null);
            }}
            className="h-11 w-full rounded-xl border-[3px] border-black bg-white px-3 text-sm text-ink outline-none"
          />
        </label>
        {error ? (
          <p id={errorId} role="alert" className="mt-3 text-sm font-semibold text-closed">
            {error}
          </p>
        ) : null}
        <button type="submit" className={`${btnPrimary} mt-5`} disabled={pending}>
          {pending ? "Checking…" : "Unlock"}
        </button>
      </form>
    </Shell>
  );
}
