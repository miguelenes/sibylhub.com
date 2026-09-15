import { Button } from "@heroui/react";
import { useState } from "react";

export function StatusIsland() {
  const [expanded, setExpanded] = useState(false);
  return (
    <section
      aria-labelledby="status-heading"
      className="rounded-2xl border border-cyan-300/30 bg-slate-900/70 p-6"
    >
      <h2 id="status-heading" className="text-lg font-semibold text-cyan-200">
        Local platform status
      </h2>
      <p className="mt-2 text-sm text-slate-300">
        The public route renders without remote bindings.
      </p>
      <Button
        className="mt-4"
        aria-expanded={expanded}
        onPress={() => setExpanded((value) => !value)}
      >
        {expanded ? "Hide details" : "Show details"}
      </Button>
      {expanded && (
        <p className="mt-3 text-sm text-violet-200" role="status">
          D1, R2, and Vectorize are optional for this baseline route.
        </p>
      )}
    </section>
  );
}
