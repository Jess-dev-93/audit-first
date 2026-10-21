"use client";

import "./siteReviewEditor.css";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { FullSiteAuditResult } from '../lib/auditTypes';
import { editorialDraft, draftFingerprint, reviewDraftKey, decodeReviewDraft, encodeReviewDraft, withEditorial } from '../lib/siteReviewDraft';
import type { EditorialDraft } from '../lib/siteReviewDraft';

type Props = { result: FullSiteAuditResult; children: (result: FullSiteAuditResult, reviewEditor: ReactNode) => ReactNode };
const listKeys = ['keyIssues','businessImpact','recommendations'] as const;
const roadKeys = ['immediate','nearTerm','ongoing'] as const;

export default function ReviewedSiteWorkspace({ result, children }: Props) {
  const key = reviewDraftKey(result);
  const [draft, setDraft] = useState<EditorialDraft>(() => editorialDraft(result.siteReport));
  const [saved, setSaved] = useState(() => draftFingerprint(result.siteReport));
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const latestResult = useRef(result);
  latestResult.current = result;

  useEffect(() => {
    let next = editorialDraft(latestResult.current.siteReport);
    let status = '';
    try {
      const value = window.localStorage.getItem(key);
      if (value) { next = decodeReviewDraft(value); status = 'Saved recommendations loaded from this browser.'; }
    } catch { status = 'A saved browser draft could not be loaded. The original scan is shown.'; }
    setDraft(next); setSaved(draftFingerprint(next)); setMessage(status); setReady(true);
  }, [key]);

  const dirty = draftFingerprint(draft) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === key) setMessage('Recommendations changed in another tab. Your current draft is retained; saving here will replace that browser draft.');
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [key]);

  const save = () => {
    const cleaned = editorialDraft(draft);
    cleaned.keyIssues = cleaned.keyIssues.map((v) => v.trim()).filter(Boolean);
    cleaned.businessImpact = cleaned.businessImpact.map((v) => v.trim()).filter(Boolean);
    cleaned.recommendations = cleaned.recommendations.map((v) => v.trim()).filter(Boolean);
    try {
      window.localStorage.setItem(key, encodeReviewDraft(cleaned));
      setDraft(cleaned); setSaved(draftFingerprint(cleaned));
      setMessage('Recommendations saved on this browser.');
    } catch { setMessage('Saving on this browser failed. Keep this page open and export your current reviewed report.'); }
  };
  const reviewed = useMemo(() => withEditorial(result, draft), [result, draft]);
  const exportDraft = () => {
    const blob = new Blob([encodeReviewDraft(draft)], {type:'application/json'});
    const href = URL.createObjectURL(blob);
    const link = window.document.createElement('a'); link.href = href; link.download = 'website-review-recommendations.json'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  if (!result.success || !result.siteReport) return <>{children(result, null)}</>;

  const editor = (
    <section className="audit-review-editor" aria-labelledby="site-review-title">
      <header className="audit-review-intro">
        <span className="audit-review-eyebrow">YOUR WEBSITE REVIEW</span>
        <h2 id="site-review-title">Add your recommendations</h2>
        <p>Shape the overview, priorities and roadmap for your reviewed client report.</p>
        <p className="audit-review-note">Your edits appear in the reviewed report. Quick scans and technical exports use the automated findings.</p>
      </header>

      <div className="audit-review-field">
        <label htmlFor="site-review-overview">Client overview</label>
        <p id="site-review-overview-help">Give the client a short summary of what matters most.</p>
        <textarea id="site-review-overview" aria-describedby="site-review-overview-help" rows={5} value={draft.executiveSummary} onChange={(event) => setDraft((previous) => ({...previous, executiveSummary:event.target.value}))} />
      </div>

      <section className="audit-review-section" aria-labelledby="site-review-priorities-title">
        <h3 id="site-review-priorities-title">Findings and recommended actions</h3>
        <p className="audit-review-help" id="site-review-format">Use one entry per line: <strong>Title: explanation</strong>. Repeat the same title in each box to link the observation, impact and action in the report.</p>
        <div className="audit-review-grid">
          {listKeys.map((field, index) => (
            <div className="audit-review-field" key={field}>
              <label htmlFor={'site-review-'+field}>{['Priorities and observations','Why it matters','Recommended actions'][index]}</label>
              <p id={'site-review-help-'+field}>{['Describe what you found.','Explain the effect on visitors.','Describe the improvement you recommend.'][index]}</p>
              <textarea id={'site-review-'+field} aria-describedby={'site-review-help-'+field+' site-review-format'} rows={8} value={draft[field].join('\n')} onChange={(event) => setDraft((previous) => ({...previous, [field]:event.target.value.split('\n'), clientNextStep:undefined}))} />
            </div>
          ))}
        </div>
      </section>

      <section className="audit-review-section" aria-labelledby="site-review-roadmap-title">
        <h3 id="site-review-roadmap-title">Practical roadmap</h3>
        <p className="audit-review-help" id="site-review-roadmap-help">Group the work into practical stages. Add one action per line.</p>
        <div className="audit-review-grid">
          {roadKeys.map((field, index) => (
            <div className="audit-review-field" key={field}>
              <label htmlFor={'site-roadmap-'+field}>{['Start here','Improve next','Measure and grow'][index]}</label>
              <textarea id={'site-roadmap-'+field} aria-describedby="site-review-roadmap-help" rows={5} value={(draft.roadmap?.[field] || []).join('\n')} onChange={(event) => setDraft((previous) => ({...previous, roadmap:{immediate:[], nearTerm:[], ongoing:[], ...previous.roadmap, [field]:event.target.value.split('\n')}}))} />
            </div>
          ))}
        </div>
      </section>

      <footer className="audit-review-save">
        <div className="audit-review-actions">
          <button type="button" className="audit-review-primary" disabled={!ready || !dirty} onClick={save}>Save recommendations</button>
          <button type="button" disabled={!ready} onClick={exportDraft}>Download backup</button>
          <label className="audit-review-import">Import backup
            <input type="file" accept="application/json,.json" disabled={!ready} onChange={async (event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              if (!file) return;
              try { setDraft(decodeReviewDraft(await file.text())); setMessage('Backup imported. Review it and save recommendations for this scan.'); }
              catch { setMessage('This file could not be read as a recommendation backup. Your current draft was retained.'); }
              input.value = '';
            }} />
          </label>
        </div>
        <p role="status" aria-live="polite" className="audit-review-status">{dirty ? 'Unsaved recommendations. ' : ''}{message || (dirty ? '' : 'No unsaved changes.')}</p>
        <p className="audit-review-help">Saved in this browser for this scan. Download a backup before switching computers or clearing browser data. Your current edits are included when you export the reviewed report.</p>
      </footer>
    </section>
  );

  return <>{ready ? children(reviewed, editor) : <p role="status">Loading saved recommendations…</p>}</>;
}
