import type {
  AuditNarrative,
  Scores,
  DeepResult,
  PageResult,
  LinkCoverage,
} from "./auditTypes";
export function escapeHtml(value: unknown): string;
export const DOCUMENT_CSS: string;
export function buildAuditDocument(options?: {
  url?: string;
  pageTitle?: string;
  generatedAt?: string;
  report?: Partial<AuditNarrative>;
  scores?: Scores;
  linkCoverage?: LinkCoverage;
  deepResults?: DeepResult[];
  lightweightResults?: PageResult[];
  profile?: {
    yourName?: string;
    yourCompany?: string;
    yourWebsite?: string;
    yourLogo?: string;
  };
  typography?: { fontFamily?: string; fontFacesCss?: string };
  includeEvidence?: boolean;
}): string;
