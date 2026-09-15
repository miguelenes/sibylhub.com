import { Button } from "@heroui/react";
import { useMemo, useState, type FormEvent } from "react";
import { queryMemory, type MemoryQueryMatch } from "@sibylhub/api-client";

interface Props {
  projectId: string;
  initialQuery?: string;
}

type MemoryViewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "unavailable" }
  | { kind: "no_matches" }
  | { kind: "matches"; matches: MemoryQueryMatch[] };

function formatSimilarity(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function MemoryGraphViewer({ projectId, initialQuery = "" }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<MemoryViewState>({ kind: "idle" });
  const sortedMatches = useMemo(
    () =>
      state.kind === "matches"
        ? [...state.matches].sort(
            (left, right) => right.similarityScore - left.similarityScore,
          )
        : [],
    [state],
  );

  async function runQuery(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setState({ kind: "loading" });
    const result = await queryMemory({ query, projectId, limit: 5 });
    if (!result.ok) {
      setState({
        kind:
          result.error.error.code === "INVALID_REQUEST"
            ? "invalid"
            : "unavailable",
      });
      return;
    }
    setState(
      result.data.status === "matches"
        ? { kind: "matches", matches: result.data.matches }
        : { kind: "no_matches" },
    );
  }

  return (
    <section
      className="min-w-0 rounded-lg border border-border bg-surface p-4 text-foreground"
      aria-busy={state.kind === "loading"}
    >
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={runQuery}
      >
        <div className="min-w-0">
          <label
            htmlFor="memory-query"
            className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
          >
            Query approved memory
          </label>
          <input
            id="memory-query"
            name="query"
            type="text"
            value={query}
            maxLength={256}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search architecture, policy, or context"
            className="mt-2 block min-w-0 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button
          type="submit"
          isDisabled={state.kind === "loading"}
          className="self-end"
        >
          {state.kind === "loading" ? "Searching…" : "Search memory"}
        </Button>
      </form>

      <div className="mt-4" aria-live="polite">
        {state.kind === "idle" ? (
          <p className="rounded-md border border-border/70 bg-background/40 p-3 text-sm text-muted-foreground">
            Submit a bounded query to inspect approved memory metadata. The
            server-rendered prompt remains unchanged until you submit.
          </p>
        ) : null}
        {state.kind === "loading" ? (
          <p
            className="rounded-md border border-border/70 bg-background/40 p-3 text-sm text-muted-foreground"
            role="status"
          >
            Searching approved metadata…
          </p>
        ) : null}
        {state.kind === "invalid" ? (
          <p
            className="rounded-md border border-agent-blocked/40 bg-agent-blocked/10 p-3 text-sm text-agent-blocked"
            role="alert"
          >
            Enter a non-empty query without secrets or executable directives.
          </p>
        ) : null}
        {state.kind === "unavailable" ? (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-agent-blocked/40 bg-agent-blocked/10 p-3 text-sm text-agent-blocked"
            role="alert"
          >
            <span>
              Semantic memory search is unavailable. No provider details were
              exposed.
            </span>
            <Button
              type="button"
              variant="secondary"
              onPress={() => void runQuery()}
            >
              Retry search
            </Button>
          </div>
        ) : null}
        {state.kind === "no_matches" ? (
          <p
            className="rounded-md border border-border/70 bg-background/40 p-3 text-sm text-muted-foreground"
            role="status"
          >
            No approved memories matched this query.
          </p>
        ) : null}
        {state.kind === "matches" ? (
          <ul className="grid gap-3" aria-label="Ranked memory matches">
            {sortedMatches.map((match) => (
              <li
                key={match.id}
                className="min-w-0 rounded-md border border-border/80 bg-background/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold text-foreground">
                      {match.title}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {match.category}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-xs text-primary">
                    {formatSimilarity(match.similarityScore)} match
                  </span>
                </div>
                <p className="mt-3 break-words text-sm leading-6 text-muted-foreground">
                  {match.preview}
                </p>
                <p className="mt-3 font-mono text-xs text-muted-foreground">
                  Read-only access count: {match.accessCount}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
