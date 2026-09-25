import type { CandidateObservation } from "@sibylhub/schemas";

export type ObservationConflict = {
  kind: CandidateObservation["kind"];
  values: string[];
  evidenceIds: string[];
};

export function normalizeObservations(observations: CandidateObservation[]): {
  observations: CandidateObservation[];
  conflicts: ObservationConflict[];
} {
  const groups = new Map<string, CandidateObservation[]>();
  for (const observation of observations) {
    const values = groups.get(observation.kind) ?? [];
    values.push(observation);
    groups.set(observation.kind, values);
  }
  const conflicts = [...groups.entries()]
    .flatMap(([kind, values]) => {
      const uniqueValues = [
        ...new Set(values.map((value) => String(value.value))),
      ].sort();
      if (uniqueValues.length < 2) return [];
      return [
        {
          kind: kind as CandidateObservation["kind"],
          values: uniqueValues,
          evidenceIds: [
            ...new Set(values.flatMap((value) => value.evidenceIds)),
          ].sort(),
        },
      ];
    })
    .sort((a, b) => a.kind.localeCompare(b.kind));
  return { observations: [...observations], conflicts };
}
