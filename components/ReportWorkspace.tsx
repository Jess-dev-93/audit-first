"use client";
import "./auditReport.css";
import { ReportBrand, ReportContact } from "./ReportBrand";
import { useReportTypography } from "../lib/reportPresentation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getProfileFallbacks,
  applyProfilePlaceholdersDeep,
} from "../lib/templateUtils";
import type { UserProfile } from "../lib/profileStorage";
import type { AuditNarrative, Scores } from "../lib/auditTypes";
import { overviewScoreItems } from "../lib/auditOverview";
import { buildPageReport } from "../lib/auditReport";
import { ClipboardCheck, CheckCircle2 } from "lucide-react";
import { Download, Palette, Plus, FileText, Info } from "lucide-react";
import {
  Smartphone,
  Monitor,
  Search,
  Accessibility,
  Settings2,
  ChevronRight,
  Pencil,
} from "lucide-react";
import {
  readClientSections,
  reviewScopeLine,
  linkCoverageText,
  websiteDisplayName,
} from "../lib/clientAuditReport";
import { buildAuditDocument } from "../lib/buildAuditDocument";
import {
  FindingEvidence,
  LoadingDiagnostics,
  ScoreTable,
  SourceCheckCoverage,
  pageEvidence,
  printAuditHtml,
} from "./AuditEvidence";
type Props = {
  url: string;
  pageTitle?: string | null;
  auditedAt?: string;
  scores: Scores;
  report: AuditNarrative;
  profile: UserProfile;
  onSave: (report: AuditNarrative) => void | Promise<void>;
  onNewAudit: () => void;
  onEditBranding: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};
const clone = (report: AuditNarrative): AuditNarrative => ({
  ...report,
  keyIssues: [...(report.keyIssues || [])],
  businessImpact: [...(report.businessImpact || [])],
  recommendations: [...(report.recommendations || [])],
});
const cleanDraft = (report: AuditNarrative): AuditNarrative => ({
  ...report,
  keyIssues: report.keyIssues.map((v) => v.trim()).filter(Boolean),
  businessImpact: report.businessImpact.map((v) => v.trim()).filter(Boolean),
  recommendations: report.recommendations.map((v) => v.trim()).filter(Boolean),
});
const comparable = (report: AuditNarrative) =>
  JSON.stringify([
    report.executiveSummary,
    report.keyIssues,
    report.businessImpact,
    report.recommendations,
  ]);
export default function ReportWorkspace({
  url,
  pageTitle,
  auditedAt,
  scores,
  report,
  profile,
  onSave,
  onNewAudit,
  onEditBranding,
  onDirtyChange,
  
}: Props) {
  const { typography, ready: presentationReady } = useReportTypography();
  const brandProfile = {
    ...getProfileFallbacks(profile),
    yourLogo: profile.yourLogo,
  };
 
const [previewHeight, setPreviewHeight] = useState(1000);

// Reference to the report preview
const previewFrameRef = useRef<HTMLIFrameElement>(null);

// Receive the preview height
const resizePreview = useCallback((event: MessageEvent) => {
  if (event.source !== previewFrameRef.current?.contentWindow) return;
  if (event.data?.type !== "audit-preview-height") return;

  const height = Number(event.data.height);

  if (
    Number.isFinite(height) &&
    height > 0 &&
    height < 100000
  ) {
    setPreviewHeight(Math.ceil(height) + 16);
  }
}, []);

// Listen for preview height updates
useEffect(() => {
  window.addEventListener("message", resizePreview);

  return () => {
    window.removeEventListener("message", resizePreview);
  };
}, [resizePreview]);

  const prepared = useMemo(
    () => applyProfilePlaceholdersDeep(report, profile) as AuditNarrative,
    [report, profile],
  );
  const [draft, setDraft] = useState(() => clone(prepared)),
    [saved, setSaved] = useState(() => comparable(prepared)),
    [tab, setTab] = useState("overview"),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false),
    [includeEvidence, setIncludeEvidence] = useState(false),
    [editingOverview, setEditingOverview] = useState(false);
  const lastSubmitted = useRef<string | null>(null);
  const [reviewChecks, setReviewChecks] = useState<boolean[]>(
  () => [false, false, false, false, false]
);

const reviewItems = [
  "Confirm flagged issues on the actual website",
  "Test mobile usability and keyboard navigation",
  "Review messaging and calls to action",
  "Add your observations and recommendations",
  "Check the final PDF against the evidence",
];

const completedReviews = reviewChecks.filter(Boolean).length;

const toggleReview = (index: number) => {
  setReviewChecks((previous) =>
    previous.map((checked, i) =>
      i === index ? !checked : checked
    )
  );
};
  const previousReport = useRef(report);
  const scanIdentity = useRef(url + "|" + (auditedAt || ""));
  useEffect(() => {
    const identity = url + "|" + (auditedAt || "");
    const sameScan = identity === scanIdentity.current;
    scanIdentity.current = identity;
    const sameReport = previousReport.current === report;
    previousReport.current = report;
    if (sameScan && sameReport) return;
    if (sameScan && lastSubmitted.current === comparable(prepared)) {
      // A save acknowledgement must not replace edits typed after that save.
      setSaved(comparable(prepared));
      return;
    }
    lastSubmitted.current = null;
    setDraft(clone(prepared));
    setSaved(comparable(prepared));
    setMessage("");
  }, [prepared, report, url, auditedAt]);
  const dirty = comparable(draft) !== saved;
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const findings = useMemo(() => pageEvidence(url, scores), [url, scores]);
  const clientSections = useMemo(
    () => readClientSections(cleanDraft(draft), findings),
    [draft, findings],
  );
  const highlights = useMemo(
    () =>
      clientSections.rows.slice(0, 3).map((row) => ({
        key: row.title,
        title: row.title,
        action: row.help,
        observation: row.observation,
        impact: row.impact,
        evidence: row.evidence,
        coverage: row.coverage,
        loadingContext: row.loadingContext,
      })),
    [clientSections],
  );
  const generatedClient = useMemo(
    () => buildPageReport(url, scores),
    [url, scores],
  );
  const suggestion = generatedClient.executiveSummary;
  const scoreItems = useMemo(() => overviewScoreItems(scores), [scores]);
  const document = useMemo(
    () =>
      buildAuditDocument({
        url,
        pageTitle: pageTitle || "",
        generatedAt: auditedAt,
        report: cleanDraft(draft),
        scores,
        profile: {
          ...getProfileFallbacks(profile),
          yourLogo: profile?.yourLogo,
        },
        includeEvidence,
        typography,
      }),
    [
      url,
      pageTitle,
      auditedAt,
      draft,
      scores,
      profile,
      includeEvidence,
      typography,
    ],
  );
  const updateList = (
    key: "keyIssues" | "businessImpact" | "recommendations",
    value: string,
  ) =>
    setDraft((prev) => ({
      ...prev,
      [key]: value.split("\n"),
      clientNextStep: undefined,
    }));
  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const submitted = comparable(draft);
      const cleaned = cleanDraft(draft);
      lastSubmitted.current = comparable(cleaned);
      await onSave(cleaned);
      // Preserve any typing that happened while the save request was pending.
      setDraft((current) =>
        comparable(current) === submitted ? cleaned : current,
      );
      setSaved(comparable(cleaned));
      setMessage("Changes saved.");
    } catch {
      lastSubmitted.current = null;
      setMessage(
        "The report could not be saved. You can still export your current edits.",
      );
    } finally {
      setSaving(false);
    }
  };
  
  const newAudit = () => {
    if (
      dirty &&
      !window.confirm("Start a new audit without saving these edits?")
    )
      return;
    onNewAudit();
  };
  return (
    <section className="audit-report-workspace">
      

<header className="audit-report-header">
  <div className="audit-report-heading-row">
    <div className="audit-report-heading-copy">
      <span className="audit-report-kicker">
        WEBSITE AUDIT REPORT
      </span>

      <h1>
        Single-page review of {websiteDisplayName(pageTitle, url)}
      </h1>

      <p className="audit-report-subtitle">
        {url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        {auditedAt && (
          <>
            {" · "}
            {new Date(auditedAt).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </>
        )}
      </p>
    </div>

    <div className="audit-report-header-brand">
      <ReportBrand profile={brandProfile} />
    </div>
  </div>

  <div className="audit-report-toolbar">
    <div className="audit-report-actions">
      <button
        type="button"
        className="audit-export-button"
        disabled={!presentationReady}
        onClick={() =>
          setMessage(
            printAuditHtml(document)
              ? ""
              : "Allow pop-ups to open the printable report."
          )
        }
      >
        <Download size={19} />
        {presentationReady ? "Export PDF" : "Preparing PDF…"}
      </button>

      <button type="button" onClick={onEditBranding}>
        <Palette size={19} />
        Edit branding
      </button>

      <button type="button" onClick={newAudit}>
        <Plus size={19} />
        New audit
      </button>
    </div>

    <label className="audit-evidence-option">
      <input
        type="checkbox"
        checked={includeEvidence}
        onChange={(event) => setIncludeEvidence(event.target.checked)}
      />
      <span>Detailed findings in PDF</span>

      <span
        className="audit-evidence-info"
        title="Include detailed technical findings in the exported PDF."
      >
        <Info size={16} />
      </span>
    </label>
  </div>
</header>


      <nav aria-label="Report sections" className="audit-report-tabs">
        {["overview", "findings", "technical", "preview"].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={
              "rounded-lg border px-4 py-2 text-sm capitalize " +
              (tab === value
                ? "border-violet-500 bg-violet-500/10"
                : "border-border")
            }
          >
            {value === "technical" ? "Evidence" : value}
          </button>
        ))}
      </nav>
      <div className="audit-report-body">
      
{tab === "overview" && (
  <div className="audit-overview">

    {/* Overview heading */}
    <section className="audit-overview-hero">
      <div className="audit-overview-hero-copy">
        <span className="audit-overview-eyebrow">
          THE PAGE AT A GLANCE
        </span>

        <h2>A smoother experience for your visitors</h2>

        <p>
          Mobile and desktop results available
          <span aria-hidden="true"> · </span>
          Automated public-page checks
        </p>
      </div>

      {/* Decorative browser illustration */}
      <div className="audit-overview-art" aria-hidden="true">
        <div className="audit-art-orbit" />
        <div className="audit-art-browser">
          <div className="audit-art-browser-top">
            <i /><i /><i />
          </div>
          <div className="audit-art-browser-body">
            <div className="audit-art-image">
              <span />
            </div>
            <div className="audit-art-lines">
              <i /><i /><i /><i />
            </div>
          </div>
        </div>
        <div className="audit-art-phone">
          <div />
          <i /><i /><i />
        </div>
        <span className="audit-art-sparkle audit-art-sparkle-one">✦</span>
        <span className="audit-art-sparkle audit-art-sparkle-two">✦</span>
      </div>
    </section>

    {/* Dynamic audit scores */}
    <section
      className="audit-overview-scores"
      aria-label="Website audit scores"
    >
      {scoreItems.map((item, index) => {
        const ScoreIcon = [
          Smartphone,
          Monitor,
          Search,
          Accessibility,
          Settings2,
        ][index] ?? Settings2;

        const tone =
          item.value === null
            ? "neutral"
            : item.value >= 90
              ? "good"
              : item.value >= 50
                ? "warning"
                : "poor";

        return (
          <div
            key={item.label}
            className={`audit-overview-score audit-tone-${tone}`}
          >
            <p className="audit-overview-score-label">
              {item.label}
            </p>

            <div className="audit-overview-score-middle">
              <div
                className="audit-overview-score-value"
                style={{
                  color: item.value === null
                    ? undefined
                    : item.colour,
                }}
              >
                {item.value === null ? (
                  <span className="audit-score-unavailable">
                    {item.availability.label}
                  </span>
                ) : (
                  <>
                    <strong>{item.value}</strong>
                    <span>/100</span>
                  </>
                )}
              </div>

              <span className="audit-overview-score-icon">
                <ScoreIcon size={20} strokeWidth={1.9} />
              </span>
            </div>

            <p className="audit-overview-score-meaning">
              {item.meaning}
            </p>

            {item.value === null &&
              item.availability.reason && (
                <p className="audit-overview-score-reason">
                  {item.availability.reason}
                </p>
              )}
          </div>
        );
      })}
    </section>

    {/* Client-facing summary */}
    <section className="audit-overview-details">

      <div className="audit-overview-summary">
        <div className="audit-overview-section-heading">
          <h3>Client overview</h3>

          <button
            type="button"
            className="audit-overview-edit"
            onClick={() => setEditingOverview((v) => !v)}
          >
            <Pencil size={17} />
            {editingOverview ? "Done editing" : "Edit overview"}
          </button>
        </div>

        {editingOverview ? (
          <textarea
            aria-label="Client overview"
            rows={7}
            value={draft.executiveSummary}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                executiveSummary: event.target.value,
              }))
            }
            className="audit-overview-textarea"
          />
        ) : (
          <p className="audit-overview-description">
            {draft.executiveSummary ||
              "Add a short client-friendly overview of the audit results."}
          </p>
        )}

        <button
          type="button"
          className="audit-overview-suggestion"
          onClick={() => {
            setDraft((prev) => ({
              ...prev,
              executiveSummary: suggestion,
            }));
            setEditingOverview(true);
            setMessage(
              "Suggested overview added. Save changes to keep it."
            );
          }}
        >
          Use suggested overview
        </button>

        {generatedClient.strengths?.length ? (
          <details className="audit-overview-strengths">
            <summary>What is already working well</summary>

            <ul>
              {generatedClient.strengths.map((strength, index) => (
                <li key={index}>{strength}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <div className="audit-overview-priorities">
        <div className="audit-overview-section-heading">
          <h3>Where we can help</h3>
        </div>

        <p className="audit-overview-priorities-intro">
          Focused improvements suggested by the scan evidence.
        </p>

        {highlights.length ? (
          <div className="audit-priority-list">
            {highlights.map((highlight, index) => (
              <details
                className="audit-priority-item"
                key={`${highlight.key}-${index}`}
              >
                <summary className="audit-priority-trigger">
                  <span className="audit-priority-number">
                    {index + 1}
                  </span>

                  <span className="audit-priority-title">
                    <strong>{highlight.title}</strong>
                    {highlight.coverage && (
                      <small>{highlight.coverage}</small>
                    )}
                  </span>

                  <ChevronRight
                    className="audit-priority-chevron"
                    size={19}
                  />
                </summary>

                <div className="audit-priority-content">
                  {highlight.observation && (
                    <p>
                      <strong>What we found: </strong>
                      {highlight.observation}
                    </p>
                  )}

                  {highlight.impact && (
                    <p>
                      <strong>Why it matters: </strong>
                      {highlight.impact}
                    </p>
                  )}

                  {highlight.action && (
                    <p>
                      <strong>Recommended action: </strong>
                      {highlight.action}
                    </p>
                  )}

                  {highlight.loadingContext.map((line, i) => (
                    <p className="audit-priority-evidence" key={`l-${i}`}>
                      {line}
                    </p>
                  ))}

                  {highlight.evidence.map((line, i) => (
                    <p className="audit-priority-evidence" key={`e-${i}`}>
                      {line}
                    </p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="audit-overview-empty">
            No actionable issues were returned by the available
            checks. A manual review is still recommended.
          </p>
        )}
      </div>
    </section>

    <p className="audit-overview-disclaimer">
      Automated results reflect the checks performed at scan time.
      Passing scores do not guarantee that every issue has been
      identified. Additional manual review may be needed.
    </p>
  </div>
)}

      {tab === "findings" && (
  <div className="audit-findings">
    <div className="audit-findings-heading">
      <div>
        <span className="audit-findings-eyebrow">
          REPORT CONTENT
        </span>
        <h2>Shape your recommendations</h2>
        <p>
          Review and refine the findings before sharing your
          report with a client.
        </p>
      </div>
    </div>
          {(["keyIssues", "businessImpact", "recommendations"] as const).map(
            (key, index) => (
              <article
                key={key}
                className="audit-findings-card"
              >
                <label htmlFor={"audit-" + key} className="block font-semibold">
                  {
                    [
                      "Priorities",
                      "Why this matters for visitors",
                      "Recommended actions",
                    ][index]
                  }
                </label>
                <p
                  id={"audit-help-" + key}
                  className="mt-2 max-w-[75ch] text-xs leading-6 text-muted-foreground"
                >
                  {key === "keyIssues"
                    ? "Press Enter after each priority. The PDF adds the numbering for you."
                    : "Press Enter after each point. The PDF adds the bullet points for you."}
                </p>
                <textarea
                  id={"audit-" + key}
                  rows={5}
                  aria-describedby={"audit-help-" + key}
                  value={draft[key].join("\n")}
                  onChange={(event) => updateList(key, event.target.value)}
                  className="audit-findings-textarea"
                />
              </article>
            ),
          )}
        </div>
      )}
      
{tab === "technical" && (
  <div className="audit-evidence-workspace">

    <div className="audit-evidence-heading">
      <span className="audit-findings-eyebrow">
        TECHNICAL EVIDENCE
      </span>

      <h2>Understand the results</h2>

      <p>
        Explore the checks behind your report and confirm
        important findings before sharing.
      </p>
    </div>

    {/* Human review checklist */}
    <section className="audit-review-checklist">
      <div className="audit-review-checklist-header">
        <div className="audit-review-checklist-heading">
          <span className="audit-review-checklist-icon">
            <ClipboardCheck size={23} />
          </span>

          <div>
            <h3>Before you share your report</h3>
            <p>
              Five recommended manual checks to help validate
              your audit.
            </p>
          </div>
        </div>

        <span className="audit-review-count">
          {completedReviews} / {reviewItems.length} completed
        </span>
      </div>

      <div
        className="audit-review-progress"
        role="progressbar"
        aria-label="Manual review progress"
        aria-valuemin={0}
        aria-valuemax={reviewItems.length}
        aria-valuenow={completedReviews}
      >
        <div
          style={{
            width: `${
              (completedReviews / reviewItems.length) * 100
            }%`,
          }}
        />
      </div>

      <div className="audit-review-items">
        {reviewItems.map((item, index) => (
          <label
            key={item}
            className={
              "audit-review-item " +
              (reviewChecks[index] ? "is-complete" : "")
            }
          >
            <input
              type="checkbox"
              checked={reviewChecks[index]}
              onChange={() => toggleReview(index)}
            />

            <span>{item}</span>

            {reviewChecks[index] && (
              <CheckCircle2 size={19} />
            )}
          </label>
        ))}
      </div>

      <p className="audit-review-note">
        These checks are completed manually. They are not
        verified by the automated scanner.
      </p>
    </section>

    {/* Existing technical evidence */}
    <section className="audit-evidence-results">
      <h3>Score breakdown</h3>

      <ScoreTable
        pages={[
          {
            url,
            pageType: pageTitle || "Audited page",
            scores,
          },
        ]}
      />
    </section>

    <section className="audit-evidence-results">
      <h3>Check coverage</h3>
      <SourceCheckCoverage scores={scores} />
    </section>

    <section className="audit-evidence-results">
      <h3>Supporting findings</h3>
      <FindingEvidence findings={findings} />
    </section>

    <section className="audit-evidence-results">
      <h3>Loading diagnostics</h3>

      <LoadingDiagnostics
        pages={[
          {
            url,
            pageType: pageTitle || "Audited page",
            scores,
          },
        ]}
      />
    </section>

  </div>
)}

      {tab === "preview" && (
  <iframe
    ref={previewFrameRef}
    title="Printable client report preview"
    sandbox="allow-scripts"
    srcDoc={`
      ${document}
      <script>
        const sendHeight = () => {
          const height = Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight
          );

          window.parent.postMessage({
            type: "audit-preview-height",
            height
          }, "*");
        };

        window.addEventListener("load", sendHeight);

        new ResizeObserver(sendHeight).observe(
          document.documentElement
        );
      </script>
    `}
    scrolling="no"
    style={{ height: `${previewHeight}px` }}
    className="audit-preview-frame"
  />
)}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <div>
          <p
            role="status"
            aria-live="polite"
            className="text-sm text-secondary-foreground"
          >
            {message.includes("could not") || message.includes("Allow pop-ups")
              ? message
              : dirty
                ? "Unsaved changes"
                : message || "No unsaved changes"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Save changes keeps your edits in this report.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </footer>
        
      <p className="text-xs leading-6 text-muted-foreground">
        Automated public-page review. Form submissions, payments, sign-in and
        backend processing were not tested.
      </p>

      <ReportContact profile={brandProfile} />
      </div>
    </section>
  );
}
