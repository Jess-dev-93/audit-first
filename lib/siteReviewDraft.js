// Browser-local editorial sidecar. Raw scan evidence is never stored or replaced here.
const array = (value) => Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
export function editorialDraft(value = {}) {
  return {
    executiveSummary: typeof value.executiveSummary === 'string' ? value.executiveSummary : '',
    keyIssues: [...array(value.keyIssues)],
    businessImpact: [...array(value.businessImpact)],
    recommendations: [...array(value.recommendations)],
    clientNextStep: typeof value.clientNextStep === 'string' ? value.clientNextStep : undefined,
    roadmap: value.roadmap ? {
      immediate: [...array(value.roadmap.immediate)],
      nearTerm: [...array(value.roadmap.nearTerm)],
      ongoing: [...array(value.roadmap.ongoing)],
    } : undefined,
  };
}
export function draftFingerprint(value) { return JSON.stringify(editorialDraft(value)); }
export function reviewDraftKey(result) {
  const url = result.discovery?.origin || result.discovery?.url || '';
  const source = result.generatedAt || JSON.stringify([result.deepResults, result.lightweightResults]);
  let hash = 2166136261;
  for (const character of String(source)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return 'auditunfold:site-review:v1:' + encodeURIComponent(url) + ':' + (hash >>> 0).toString(16);
}
export function decodeReviewDraft(text) {
  const data = JSON.parse(text);
  if (data?.version !== 1 || typeof data.editorial?.executiveSummary !== 'string'
    || !['keyIssues','businessImpact','recommendations'].every((key) => Array.isArray(data.editorial[key]) && data.editorial[key].every((v) => typeof v === 'string'))) {
    throw new Error('The saved recommendation draft has an unsupported format.');
  }
  return editorialDraft(data.editorial);
}
export function encodeReviewDraft(value) {
  return JSON.stringify({version:1,editorial:editorialDraft(value)});
}
export function withEditorial(result, draft) {
  return {...result, siteReport:{...result.siteReport,...editorialDraft(draft)}};
}
