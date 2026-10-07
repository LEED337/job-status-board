import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BoardList } from "../components/BoardList.tsx";
import { Shell } from "../components/Shell.tsx";
import { BoardSkeleton } from "../components/Skeleton.tsx";
import { Summary } from "../components/Summary.tsx";
import { formatUpdated } from "../lib/board.ts";
import { loadPublished } from "../lib/load.ts";
import { readDraft } from "../lib/storage.ts";
import type { BoardFile } from "../types.ts";

export function SharePage() {
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";
  const [now] = useState(() => new Date());
  const [board, setBoard] = useState<BoardFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftWaiting] = useState(() => readDraft() !== null);

  const reload = () => {
    setLoading(true);
    setError(null);
    loadPublished()
      .then((file) => {
        setBoard(file);
        setError(null);
      })
      .catch((err: unknown) => {
        setBoard(null);
        setError(err instanceof Error ? err.message : "Could not load the board.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    loadPublished()
      .then((file) => {
        if (cancelled) return;
        setBoard(file);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load the board.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const owner = board?.owner;
    document.title = owner ? `Job search · ${owner}` : "Job search";
  }, [board?.owner]);

  const owner = board?.owner ?? "Job search";

  return (
    <Shell
      title="Job search"
      subtitle={board ? `${owner} · where each application stands` : "Loading the shared board"}
      embed={embed}
      actions={
        <div className="flex items-center gap-4">
          {board ? <p className="text-sm text-muted">Updated {formatUpdated(board.updatedAt)}</p> : null}
          {embed ? null : (
            <Link to="/manage" className="no-print relative text-sm font-semibold text-ink">
              Manage
              {draftWaiting ? (
                <span
                  className="absolute -top-1 -right-2 h-1.5 w-1.5 rounded-full bg-[#d0893a]"
                  title="Unpublished edits in this browser"
                />
              ) : null}
            </Link>
          )}
        </div>
      }
      footer={<p>Read-only share. Private notes stay off this page.</p>}
    >
      {loading ? <BoardSkeleton /> : null}
      {!loading && error ? (
        <div className="rounded-[22px] bg-white px-6 py-16 text-center border-[3px] border-black">
          <h2 className="text-lg font-semibold">The board didn't load</h2>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <button type="button" onClick={reload} className="mt-5 text-sm font-semibold underline underline-offset-4">
            Try again
          </button>
        </div>
      ) : null}
      {!loading && board ? (
        <div className="space-y-4">
          <Summary applications={board.applications} now={now} />
          <BoardList applications={board.applications} now={now} />
        </div>
      ) : null}
    </Shell>
  );
}
