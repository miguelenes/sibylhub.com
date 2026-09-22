import type {
  CandidateChoiceAssessment,
  CandidateChoiceFactor,
} from "@sibylhub/schemas";
import type { PackageDetails } from "./adapters.js";

export type ChoiceSignal = { value: number; evidenceIds: string[] };
export type ChoiceSignals = {
  maintenance?: ChoiceSignal;
  adoption?: ChoiceSignal;
  edgeCompatibility?: ChoiceSignal;
};

function bounded(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function assessOpinionatedChoice(
  details: PackageDetails,
  signals: ChoiceSignals,
): CandidateChoiceAssessment {
  const factors: CandidateChoiceFactor[] = [];
  const download = details.downloads?.find(
    (observation) =>
      observation.priorSample !== undefined && observation.priorSample > 0,
  );
  if (download) {
    factors.push({
      name: "download-trend",
      value: bounded(0.5 + (download.value / download.priorSample! - 1) / 2),
      weight: 0.25,
      evidenceIds: download.evidenceIds,
    });
  }
  if (signals.maintenance)
    factors.push({ name: "maintenance", ...signals.maintenance, weight: 0.25 });
  if (signals.adoption)
    factors.push({ name: "adoption", ...signals.adoption, weight: 0.25 });
  else if (details.stars?.length) {
    const stars = details.stars[0];
    factors.push({
      name: "adoption",
      value: bounded(Math.log10(stars.value + 1) / 6),
      weight: 0.25,
      evidenceIds: stars.evidenceIds,
    });
  }
  if (signals.edgeCompatibility)
    factors.push({
      name: "edge-compatibility",
      ...signals.edgeCompatibility,
      weight: 0.25,
    });

  const evidenceIds = [
    ...new Set(factors.flatMap((factor) => factor.evidenceIds)),
  ];
  if (factors.length < 3)
    return {
      status: "insufficient-data",
      summary:
        "Insufficient comparable evidence for an advisory package choice.",
      factors,
      evidenceIds,
    };
  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const score =
    factors.reduce(
      (sum, factor) => sum + (factor.value ?? 0) * factor.weight,
      0,
    ) / totalWeight;
  return {
    status: "advisory",
    score: bounded(score),
    summary:
      "Advisory score derived from available comparable package signals.",
    factors,
    evidenceIds,
  };
}
