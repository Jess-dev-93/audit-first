import type {
  AuditNarrative,
  DeepResult,
  FindingDetail,
  LinkCoverage,
  Scores,
  DeviceScores,
} from "./auditTypes";
export type ClientRow = {
  title: string;
  coverage: string;
  observation: string;
  impact: string;
  help: string;
  evidence: string[];
  loadingContext: string[];
};
export function buildClientNarrative(
  findings: FindingDetail[],
  options?: { pages?: DeepResult[]; scopeLabel?: string },
): AuditNarrative & { clientNextStep: string };
export function readClientSections(
  report?: Partial<AuditNarrative>,
  findings?: FindingDetail[],
): {
  rows: ClientRow[];
  remainingImpacts: string[];
  remainingActions: string[];
};

export function clientEvidenceLines(findings: FindingDetail[]): string[];
export function reviewScopeLine(
  pages: DeepResult[],
  inspectedCount?: number,
): string;

export function siteScoreItems(pages: DeepResult[]): Array<{
  label: string;
  device: string;
  count: number;
  value: number | null;
  availability: { label: string; reason: string };
}>;
export function linkCoverageText(coverage?: LinkCoverage): string;

export function scoreAvailability(
  scores: Scores | null | undefined,
  device: "mobile" | "desktop",
  key?: keyof DeviceScores,
): { label: string; reason: string };
export function websiteDisplayName(
  title: string | null | undefined,
  url: string,
): string;
export function loadingContextLines(findings: FindingDetail[]): string[];

export function pageScoreAvailability(
  page: DeepResult,
  device: "mobile" | "desktop",
  key?: keyof DeviceScores,
): { label: string; reason: string };

export function primaryScoreDevice(
  scores?: Scores | null,
): "mobile" | "desktop";
