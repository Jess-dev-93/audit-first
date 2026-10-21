
"use client";
import ReviewedSiteWorkspace from "./ReviewedSiteWorkspace";
import { reviewDraftKey } from "../lib/siteReviewDraft";


import "./auditReport.css";
import { useState, type ReactNode } from "react";
import {
  Download,
  FileText,
  Globe,
  Layers,
  Smartphone,
  Monitor,
  Search,
  Accessibility,
  Settings2,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { ReportBrand, ReportContact } from "./ReportBrand";
import { useReportTypography } from "../lib/reportPresentation";
import type { ReportTypography } from "../lib/reportPresentation";
import { getProfileFallbacks } from "../lib/templateUtils";
import type { UserProfile } from "../lib/profileStorage";
import type {
  FullSiteAuditResult,
  LinkCoverage,
} from "../lib/auditTypes";
import type { ClientRow } from "../lib/clientAuditReport";

import {
  readClientSections,
  reviewScopeLine,
  siteScoreItems,
  linkCoverageText,
  websiteDisplayName,
} from "../lib/clientAuditReport";

import { buildAuditDocument } from "../lib/buildAuditDocument";
import { groupLighthouseFindings } from "../lib/auditReport";

import {
  FindingEvidence,
  ScoreTable,
  LoadingDiagnostics,
  printAuditHtml,
} from "./AuditEvidence";

export type { FullSiteAuditResult } from "../lib/auditTypes";

type Props = {
  result: FullSiteAuditResult;
  profile?: Partial<UserProfile>;
};

type Tab = "overview" | "recommendations" | "pages" | "evidence";

const values = (v: string[] | undefined) =>
  Array.isArray(v) ? v : [];

function Bullets({ items }: { items: string[] }) {
  if (!items.length) return null;

  return (
    <ul className="audit-site-bullets">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function Priority({
  row,
  index,
}: {
  row: ClientRow;
  index: number;
}) {
  return (
    <details className="audit-site-priority">
      <summary>
        <span className="audit-site-priority-number">
          {index + 1}
        </span>

        <span className="audit-site-priority-copy">
          <strong>{row.title}</strong>
          {row.coverage && <small>{row.coverage}</small>}
        </span>

        <ChevronRight
          size={19}
          className="audit-site-priority-arrow"
        />
      </summary>

      <div className="audit-site-priority-content">
        {row.observation && (
          <p>
            <strong>What we found: </strong>
            {row.observation}
          </p>
        )}

        {row.impact && (
          <p>
            <strong>Why it matters: </strong>
            {row.impact}
          </p>
        )}

        {row.help && (
          <p>
            <strong>How we can help: </strong>
            {row.help}
          </p>
        )}

        {row.evidence.map((line, index) => (
          <p
            key={`e-${index}`}
            className="audit-site-technical-note"
          >
            {line}
          </p>
        ))}

        {row.loadingContext.map((line, index) => (
          <p
            key={`l-${index}`}
            className="audit-site-technical-note"
          >
            {line}
          </p>
        ))}
      </div>
    </details>
  );
}

function coverageFor(
  result: FullSiteAuditResult
): LinkCoverage | undefined {
  if (result.siteReport?.linkCoverage) {
    return result.siteReport.linkCoverage;
  }

  if (!Array.isArray(result.linkChecks)) return undefined;

  return {
    selectedCount: result.linkChecks.length,
    verifiedCount: result.linkChecks.filter(
      (c) => c.status === "reachable" || c.status === "broken"
    ).length,
    unverifiedCount: result.linkChecks.filter(
      (c) => c.status === "unverified"
    ).length,
    brokenCount: result.linkChecks.filter(
      (c) => c.status === "broken"
    ).length,
    limited: true,
    ...(result.linkChecks.length
      ? {}
      : {
          note: "No internal destination results were recorded in this run.",
        }),
  };
}

export function buildReportHtml(
  result: FullSiteAuditResult,
  profile?: Partial<UserProfile>,
  includeEvidence = true,
  typography?: ReportTypography
) {
  return buildAuditDocument({
    url: result.discovery?.origin || result.discovery?.url || "",
    pageTitle: websiteDisplayName(
      result.lightweightResults?.find(
        (p) => p.pageType === "Homepage"
      )?.title,
      result.discovery?.origin || result.discovery?.url || ""
    ),
    generatedAt: result.generatedAt,
    report: result.siteReport,
    linkCoverage: coverageFor(result),
    deepResults: result.deepResults,
    lightweightResults: result.lightweightResults,
    profile: {
      ...getProfileFallbacks(profile),
      yourLogo: profile?.yourLogo,
    },
    includeEvidence,
    typography,
  });
}

function FullSiteAuditView({
  result,
  profile,
  reviewEditor,
}: Props & { reviewEditor?: ReactNode }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [message, setMessage] = useState("");

  const {
    typography,
    ready: presentationReady,
  } = useReportTypography();

  if (!result.success || !result.siteReport) return null;

  const report = result.siteReport;
  const pages = result.deepResults || [];
  const discovered = result.lightweightResults || [];

  const findings =
    report.findingDetails || groupLighthouseFindings(pages);

  const clientSections = readClientSections(report, findings);
  const scoreItems = siteScoreItems(pages);

  const inspected = discovered.filter(
    (page) => page.status === "ok"
  ).length;

  const siteUrl =
    result.discovery?.origin ||
    result.discovery?.url ||
    "";

  const homeTitle = discovered.find(
    (page) => page.pageType === "Homepage"
  )?.title;

  const siteName = websiteDisplayName(homeTitle, siteUrl);

  const brandProfile = {
    ...getProfileFallbacks(profile),
    yourLogo: profile?.yourLogo,
  };

  const priorityRows = clientSections.rows;

  const exportReport = (details: boolean) => {
    setMessage(
      printAuditHtml(
        buildReportHtml(result, profile, details, typography)
      )
        ? ""
        : "Allow pop-ups to open the printable report."
    );
  };

  const scoreIcons = [
    Smartphone,
    Monitor,
    Search,
    Accessibility,
    Settings2,
  ];

  return (
    <section className="audit-site-workspace">

      {/* PREMIUM REPORT HEADER */}
      <header className="audit-site-header">
        <div className="audit-site-header-top">
          <div className="audit-site-heading">
            <span className="audit-site-eyebrow">
              WEBSITE AUDIT REPORT
            </span>

            <h1>Website review of {siteName}</h1>

            <p className="audit-site-subtitle">
              {siteUrl}
              {result.generatedAt && (
                <>
                  {" · "}
                  {new Date(result.generatedAt).toLocaleDateString(
                    "en-AU",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }
                  )}
                </>
              )}
            </p>
          </div>

          <div className="audit-site-header-brand">
            <ReportBrand profile={brandProfile} />
          </div>
        </div>

        <div className="audit-site-header-actions">
          <button
            type="button"
            className="audit-site-primary-button"
            disabled={!presentationReady}
            onClick={() => exportReport(false)}
          >
            <Download size={19} />
            {presentationReady
              ? "Export reviewed report"
              : "Preparing PDF…"}
          </button>

          <button
            type="button"
            className="audit-site-secondary-button"
            disabled={!presentationReady}
            onClick={() => exportReport(true)}
          >
            <FileText size={19} />
            Export technical audit
          </button>

          {result.status === "partial" && (
            <span className="audit-site-partial">
              <AlertCircle size={16} />
              Some checks unavailable
            </span>
          )}
        </div>

        {message && (
          <p role="status" className="audit-site-message">
            {message}
          </p>
        )}
      </header>

      {/* SECTION TABS */}
      <nav
        className="audit-site-tabs"
        aria-label="Website review sections"
      >
        {(["overview", "recommendations", "pages", "evidence"] as const).map(
          (section) => (
            <button
              key={section}
              type="button"
              aria-current={
                tab === section ? "page" : undefined
              }
              className={tab === section ? "is-active" : ""}
              onClick={() => setTab(section)}
            >
              {section}
            </button>
          )
        )}
      </nav>

      {tab === "recommendations" && (
  <div className="audit-site-tab-content">
    {reviewEditor}
  </div>
)}

      {tab === "overview" && (
        <div className="audit-site-tab-content">

          {/* OVERVIEW FEATURE BANNER */}
          <section className="audit-site-hero">
            <div>
              <span className="audit-site-eyebrow">
                THE WEBSITE AT A GLANCE
              </span>

              <h2>
                A clearer picture of your website
              </h2>

              <p>
                {reviewScopeLine(pages, inspected)
                  .split(" · ")
                  .slice(1)
                  .join(" · ")}
              </p>
            </div>

            <div className="audit-site-hero-icon" aria-hidden="true">
              <Layers size={65} strokeWidth={1.25} />
            </div>
          </section>

          {/* COVERAGE METRICS */}
          <section
            className="audit-site-coverage"
            aria-label="Audit coverage"
          >
            <div>
              <Globe size={23} />
              <strong>{discovered.length}</strong>
              <span>Pages inspected for discovery</span>
            </div>

            <div>
              <CheckCircle2 size={23} />
              <strong>{inspected}</strong>
              <span>Pages inspected successfully</span>
            </div>

            <div>
              <Monitor size={23} />
              <strong>{pages.length}</strong>
              <span>Pages with detailed test results</span>
            </div>
          </section>

          {/* SITE SCORE STRIP */}
          <section
            className="audit-site-scores"
            aria-label="Average audit scores"
          >
            {scoreItems.map((item, index) => {
              const ScoreIcon =
                scoreIcons[index] ?? Settings2;

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
                  className={`audit-site-score audit-site-tone-${tone}`}
                >
                  <p className="audit-site-score-label">
                    {item.label}
                  </p>

                  <div className="audit-site-score-reading">
                    <span>
                      {item.value === null ? (
                        <strong className="audit-site-no-score">
                          {item.availability.label}
                        </strong>
                      ) : (
                        <>
                          <strong>{item.value}</strong>
                          <small>/100</small>
                        </>
                      )}
                    </span>

                    <span className="audit-site-score-icon">
                      <ScoreIcon size={19} />
                    </span>
                  </div>

                  <p className="audit-site-score-count">
                    {item.count} scored{" "}
                    {item.count === 1 ? "page" : "pages"}
                  </p>
                </div>
              );
            })}
          </section>

          {/* CLIENT SUMMARY + IMPROVEMENTS */}
          <section className="audit-site-overview-grid">
            <div className="audit-site-summary">
              <h3>Client overview</h3>

              <p className="audit-site-summary-text">
                {report.executiveSummary}
              </p>

              {values(report.strengths).length > 0 && (
                <details className="audit-site-strengths">
                  <summary>
                    What's already working well
                  </summary>
                  <Bullets items={values(report.strengths)} />
                </details>
              )}
            </div>

            <div className="audit-site-priorities">
              <h3>Where we can help</h3>

              <p className="audit-site-muted">
                Prioritised improvements based on the tested
                pages.
              </p>

              {priorityRows.length ? (
                priorityRows.map((row, index) => (
                  <Priority
                    key={`${row.title}-${index}`}
                    row={row}
                    index={index}
                  />
                ))
              ) : (
                <p className="audit-site-muted">
                  No prioritised recommendations were
                  returned by the available checks.
                </p>
              )}
            </div>
          </section>

          {(clientSections.remainingImpacts.length > 0 ||
            clientSections.remainingActions.length > 0) && (
            <section className="audit-site-panel">
              {clientSections.remainingImpacts.length > 0 && (
                <>
                  <h3>Additional visitor impacts</h3>
                  <Bullets
                    items={clientSections.remainingImpacts}
                  />
                </>
              )}

              {clientSections.remainingActions.length > 0 && (
                <>
                  <h3>Additional recommended actions</h3>
                  <Bullets
                    items={clientSections.remainingActions}
                  />
                </>
              )}
            </section>
          )}

          <p className="audit-site-footnote">
            Average scores describe the representative pages
            tested, not every page on the website. Unavailable
            scores are excluded. Search, accessibility and
            technical best-practice averages use mobile runs.
          </p>
        </div>
      )}

      {tab === "pages" && (
        <div className="audit-site-tab-content">
          <section className="audit-site-section-heading">
            <span className="audit-site-eyebrow">
              PAGE COVERAGE
            </span>

            <h2>Pages inspected</h2>

            <p>
              See which public pages were inspected and which
              pages received detailed testing.
            </p>
          </section>

          <div className="audit-site-panel">
            <div className="audit-site-page-list">
              {discovered.map((page, index) => (
                <div
                  className="audit-site-page-row"
                  key={`${page.url}-${index}`}
                >
                  <span className="audit-site-page-icon">
                    <FileText size={19} />
                  </span>

                  <div>
                    <strong>
                      {page.title ||
                        page.pageType ||
                        "Website page"}
                    </strong>

                    <span>{page.finalUrl || page.url}</span>
                  </div>

                  <span
                    className={
                      page.status === "ok"
                        ? "audit-site-page-status is-ok"
                        : "audit-site-page-status"
                    }
                  >
                    {page.status}
                  </span>

                  {page.httpStatus && (
                    <span className="audit-site-page-http">
                      HTTP {page.httpStatus}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {!discovered.length && (
              <p className="audit-site-muted">
                No individual page inspection records
                were returned.
              </p>
            )}
          </div>

          <section className="audit-site-panel">
            <h3>Detailed page scores</h3>
            <ScoreTable pages={pages} />
          </section>

          <p className="audit-site-footnote">
            A successful page inspection does not necessarily
            mean a detailed mobile and desktop audit was
            completed for that page.
          </p>
        </div>
      )}

      {tab === "evidence" && (
        <div className="audit-site-tab-content">
          <section className="audit-site-section-heading">
            <span className="audit-site-eyebrow">
              TECHNICAL EVIDENCE
            </span>

            <h2>Explore the supporting checks</h2>

            <p>
              Review recorded findings, performance diagnostics,
              coverage and audit limitations.
            </p>
          </section>

          <section className="audit-site-panel">
            <h3>Supporting findings</h3>
            <FindingEvidence findings={findings} />
          </section>

          <section className="audit-site-panel">
            <h3>Loading diagnostics</h3>
            <LoadingDiagnostics pages={pages} />
          </section>

          <section className="audit-site-panel">
            <h3>Link coverage</h3>
            <p className="audit-site-muted">
              {linkCoverageText(coverageFor(result))}
            </p>
          </section>

          <section className="audit-site-panel">
            <h3>Coverage and limitations</h3>
            <Bullets items={values(report.scopeNotes)} />
          </section>
        </div>
      )}

      <div className="audit-site-footer">
        <ReportContact profile={brandProfile} />
      </div>
    </section>
  );
}


export default function FullSiteAuditReport(props: Props) {
  return (
    <ReviewedSiteWorkspace
      key={reviewDraftKey(props.result)}
      result={props.result}
    >
      {(reviewedResult, reviewEditor) => (
        <FullSiteAuditView
          {...props}
          result={reviewedResult}
          reviewEditor={reviewEditor}
        />
      )}
    </ReviewedSiteWorkspace>
  );
}
