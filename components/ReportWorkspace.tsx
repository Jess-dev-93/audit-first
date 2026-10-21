"use client";

import "./auditReport.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Palette, Plus, Smartphone, Monitor, Search, Accessibility, Settings2, ChevronRight } from "lucide-react";
import { ReportBrand, ReportContact } from "./ReportBrand";
import { useReportTypography } from "../lib/reportPresentation";
import { getProfileFallbacks } from "../lib/templateUtils";
import type { UserProfile } from "../lib/profileStorage";
import type { AuditNarrative, Scores } from "../lib/auditTypes";
import { overviewScoreItems } from "../lib/auditOverview";
import { buildPageReport } from "../lib/auditReport";
import { readClientSections, reviewScopeLine, websiteDisplayName } from "../lib/clientAuditReport";
import { buildAuditDocument } from "../lib/buildAuditDocument";
import { FindingEvidence, LoadingDiagnostics, ScoreTable, SourceCheckCoverage, pageEvidence, printAuditHtml } from "./AuditEvidence";

type Props = {
  url: string;
  pageTitle?: string | null;
  auditedAt?: string;
  scores: Scores;
  report: AuditNarrative;
  profile: UserProfile;
  // Retained for compatibility with the existing page caller. Quick scans do not edit/save narrative.
  onSave: (report: AuditNarrative) => void | Promise<void>;
  onNewAudit: () => void;
  onEditBranding: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};
type Tab = "overview" | "technical" | "preview";

export default function ReportWorkspace({ url, pageTitle, auditedAt, scores, profile, onNewAudit, onEditBranding, onDirtyChange }: Props) {
  const { typography, ready: presentationReady } = useReportTypography();
  const [tab, setTab] = useState<Tab>("overview");
  const [message, setMessage] = useState("");
  const [previewHeight, setPreviewHeight] = useState(1000);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const brandProfile = { ...getProfileFallbacks(profile), yourLogo: profile.yourLogo };
  const generated = useMemo(() => buildPageReport(url, scores), [url, scores]);
  const findings = useMemo(() => pageEvidence(url, scores), [url, scores]);
  const sections = useMemo(() => readClientSections(generated, findings), [generated, findings]);
  const scoreItems = useMemo(() => overviewScoreItems(scores), [scores]);
  const pages = useMemo(() => [{ url, pageType: pageTitle || "Audited page", scores }], [url, pageTitle, scores]);
  const scope = reviewScopeLine(pages);
  const document = useMemo(() => buildAuditDocument({
    url, pageTitle: pageTitle || "", generatedAt: auditedAt,
    report: generated, scores, profile: brandProfile,
    includeEvidence: false, typography,
  }), [url, pageTitle, auditedAt, generated, scores, profile, typography]);

  useEffect(() => {
    onDirtyChange?.(false);
    setMessage("");
    setTab("overview");
  }, [url, auditedAt, onDirtyChange]);

  const resizePreview = useCallback((event: MessageEvent) => {
    if (event.source !== previewFrameRef.current?.contentWindow || event.data?.type !== "audit-preview-height") return;
    const height = Number(event.data.height);
    if (Number.isFinite(height) && height > 0 && height < 100000) setPreviewHeight(Math.ceil(height) + 16);
  }, []);
  useEffect(() => {
    window.addEventListener("message", resizePreview);
    return () => window.removeEventListener("message", resizePreview);
  }, [resizePreview]);

  return (
    <section className="audit-report-workspace">
      <header className="audit-report-header">
        <div className="audit-report-heading-row">
          <div className="audit-report-heading-copy">
            <span className="audit-report-kicker">AUTOMATED QUICK SCAN</span>
            <h1>Page review of {websiteDisplayName(pageTitle, url)}</h1>
            <p className="audit-report-subtitle">{url}{auditedAt ? " · " + new Date(auditedAt).toLocaleDateString("en-AU") : ""}</p>
          </div>
          <div className="audit-report-header-brand"><ReportBrand profile={brandProfile} /></div>
        </div>
        <div className="audit-report-toolbar"><div className="audit-report-actions">
          <button type="button" className="audit-export-button" disabled={!presentationReady} onClick={() => setMessage(printAuditHtml(document) ? "" : "Allow pop-ups to open the printable report.")}>
            <Download size={19} />{presentationReady ? "Export quick scan" : "Preparing PDF…"}
          </button>
          <button type="button" onClick={onEditBranding}><Palette size={19} />Edit branding</button>
          <button type="button" onClick={onNewAudit}><Plus size={19} />New audit</button>
        </div></div>
        <p className="audit-report-subtitle">Automated findings for this URL. Personal recommendations are added in the full website audit.</p>
        {message && <p role="status">{message}</p>}
      </header>
      <nav aria-label="Quick scan sections" className="audit-report-tabs">
        {(["overview", "technical", "preview"] as const).map((value) => <button type="button" key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === "technical" ? "Evidence" : value === "overview" ? "Overview" : "Preview"}</button>)}
      </nav>
      <div className="audit-report-body">
        {tab === "overview" && <div className="audit-overview">
          <section className="audit-overview-hero"><div className="audit-overview-hero-copy">
            <span className="audit-overview-eyebrow">THE PAGE AT A GLANCE</span>
            <h2>A clearer picture of this page</h2>
            <p>{scope}</p>
          </div></section>
          <section className="audit-overview-scores" aria-label="Page audit scores">
            {scoreItems.map((item, index) => {
              const Icon = [Smartphone, Monitor, Search, Accessibility, Settings2][index] || Settings2;
              const tone = item.value === null ? "neutral" : item.value >= 90 ? "good" : item.value >= 50 ? "warning" : "poor";
              return <div key={item.label} className={`audit-overview-score audit-tone-${tone}`}>
                <p className="audit-overview-score-label">{item.label}</p>
                <div className="audit-overview-score-middle"><div className="audit-overview-score-value" style={{ color: item.value === null ? undefined : item.colour }}>
                  {item.value === null ? <span className="audit-score-unavailable">{item.availability.label}</span> : <><strong>{item.value}</strong><span>/100</span></>}
                </div><span className="audit-overview-score-icon"><Icon size={20} /></span></div>
                <p className="audit-overview-score-meaning">{item.meaning}</p>
                {item.value === null && item.availability.reason && <p className="audit-overview-score-reason">{item.availability.reason}</p>}
              </div>;
            })}
          </section>
          <section className="audit-overview-details">
            <div className="audit-overview-summary"><h3>Automated overview</h3><p className="audit-overview-description">{generated.executiveSummary}</p>
              {!!generated.strengths?.length && <details className="audit-overview-strengths"><summary>What is already working well</summary><ul>{generated.strengths.map((text, i) => <li key={i}>{text}</li>)}</ul></details>}
            </div>
            <div className="audit-overview-priorities"><h3>Suggested improvements</h3><p className="audit-overview-priorities-intro">Based on the recorded scan evidence.</p>
              <div className="audit-priority-list">{sections.rows.map((row, index) => <details className="audit-priority-item" key={`${row.title}-${index}`}>
                <summary className="audit-priority-trigger"><span className="audit-priority-number">{index + 1}</span><span className="audit-priority-title"><strong>{row.title}</strong></span><ChevronRight size={19} /></summary>
                <div className="audit-priority-content"><p><strong>What we found: </strong>{row.observation}</p>{row.impact && <p><strong>Why it matters: </strong>{row.impact}</p>}{row.help && <p><strong>Recommended action: </strong>{row.help}</p>}</div>
              </details>)}</div>
              {!sections.rows.length && <p>No prioritised issues were returned by the available checks. This does not establish that the page is issue-free.</p>}
            </div>
          </section>
        </div>}
        {tab === "technical" && <div className="audit-evidence-workspace">
          <div className="audit-evidence-heading"><h2>Recorded evidence</h2><p>These checks cover the tested URL. A full-site technical export is available from the website audit.</p></div>
          <section className="audit-evidence-results"><h3>Page and device scores</h3><ScoreTable pages={pages} /></section>
          <section className="audit-evidence-results"><h3>Source-check coverage</h3><SourceCheckCoverage scores={scores} /></section>
          <section className="audit-evidence-results"><h3>Supporting findings</h3><FindingEvidence findings={findings} /></section>
          <section className="audit-evidence-results"><h3>Loading diagnostics</h3><LoadingDiagnostics pages={pages} /></section>
        </div>}
        {tab === "preview" && <iframe ref={previewFrameRef} title="Automated quick scan preview" sandbox="allow-scripts" scrolling="no" className="audit-preview-frame" style={{height:`${previewHeight}px`}} srcDoc={`${document}<script>
          const sendHeight=()=>window.parent.postMessage({type:'audit-preview-height',height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)},'*');
          window.addEventListener('load',sendHeight);new ResizeObserver(sendHeight).observe(document.documentElement);
        </script>`} />}
        <p className="audit-overview-disclaimer">Automated public-page checks do not test form submissions, payments, sign-in or backend processing. Existing saved notes are retained but are excluded from this quick scan.</p>
        <ReportContact profile={brandProfile} />
      </div>
    </section>
  );
}
