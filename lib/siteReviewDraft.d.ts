import type { AuditNarrative, FullSiteAuditResult } from './auditTypes';
export type EditorialDraft = Pick<AuditNarrative, 'executiveSummary' | 'keyIssues' | 'businessImpact' | 'recommendations' | 'clientNextStep' | 'roadmap'>;
export function editorialDraft(value?: Partial<AuditNarrative>): EditorialDraft;
export function draftFingerprint(value?: Partial<AuditNarrative>): string;
export function reviewDraftKey(result: FullSiteAuditResult): string;
export function decodeReviewDraft(text: string): EditorialDraft;
export function encodeReviewDraft(value: EditorialDraft): string;
export function withEditorial(result: FullSiteAuditResult, draft: EditorialDraft): FullSiteAuditResult;
