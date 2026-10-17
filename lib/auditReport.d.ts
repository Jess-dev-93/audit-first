import type {
  FindingDetail,
  DeepResult,
  Scores,
  AuditNarrative,
} from "./auditTypes";
export function asList<T>(value: T[] | undefined | null): T[];
export function isScore(value: unknown): value is number;
export function groupLighthouseFindings(results: DeepResult[]): FindingDetail[];
export function buildPageReport(url: string, scores: Scores): AuditNarrative;
