"use client";
import "./auditReport.css";
import { ReportBrand, ReportContact } from "./ReportBrand";
import type { ReportTypography } from "../lib/reportPresentation";
import { useReportTypography } from "../lib/reportPresentation";
import { useState } from "react";
import { getProfileFallbacks } from "../lib/templateUtils";
import type { UserProfile } from "../lib/profileStorage";
import type { FullSiteAuditResult, LinkCoverage } from "../lib/auditTypes";
import {
  readClientSections,
  reviewScopeLine,
  siteScoreItems,
  linkCoverageText,
  websiteDisplayName,
} from "../lib/clientAuditReport";
import type { ClientRow } from "../lib/clientAuditReport";
import { buildAuditDocument } from "../lib/buildAuditDocument";
import { groupLighthouseFindings } from "../lib/auditReport";
import {
  FindingEvidence,
  ScoreTable,
  LoadingDiagnostics,
  printAuditHtml,
} from "./AuditEvidence";
export type { FullSiteAuditResult } from "../lib/auditTypes";
type Props = { result: FullSiteAuditResult; profile?: Partial<UserProfile> };
const values = (v: string[] | undefined) => (Array.isArray(v) ? v : []);
function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-secondary-foreground">
      {items.map((v, i) => (
        <li key={i}>{v}</li>
      ))}
    </ul>
  );
}
function Priority({
  row,
  index,
  featured = false,
}: {
  row: ClientRow;
  index: number;
  featured?: boolean;
}) {
  return (
    <section
      className={
        featured
          ? "mt-6 border-t-2 border-violet-500/25 pt-5"
          : "border-t border-border pt-4"
      }
    >
      {featured && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-violet-500">
          First priority
        </p>
      )}
      <h4
        className={
          featured
            ? "text-lg font-semibold text-foreground"
            : "font-semibold text-foreground"
        }
      >
        {index + 1}. {row.title}
      </h4>
      {row.coverage && (
        <p className="mt-1 text-xs text-muted-foreground">{row.coverage}</p>
      )}
      <p className="mt-2 text-sm leading-7 text-secondary-foreground">
        <strong>What we found:</strong> {row.observation}
      </p>
      {row.impact && (
        <p className="mt-2 text-sm leading-7 text-secondary-foreground">
          <strong>Why it matters:</strong> {row.impact}
        </p>
      )}
      {row.help && (
        <p className="mt-2 text-sm leading-7 text-secondary-foreground">
          <strong>How we can help:</strong> {row.help}
        </p>
      )}
      {row.evidence.map((line) => (
        <p key={line} className="mt-2 break-all text-xs text-muted-foreground">
          {line}
        </p>
      ))}
      {row.loadingContext.map((line) => (
        <p key={line} className="mt-2 break-all text-xs text-muted-foreground">
          {line}
        </p>
      ))}
    </section>
  );
}

function coverageFor(result: FullSiteAuditResult): LinkCoverage | undefined {
  if (result.siteReport?.linkCoverage) return result.siteReport.linkCoverage;
  if (!Array.isArray(result.linkChecks)) return undefined;
  return {
    selectedCount: result.linkChecks.length,
    verifiedCount: result.linkChecks.filter(
      (c) => c.status === "reachable" || c.status === "broken",
    ).length,
    unverifiedCount: result.linkChecks.filter((c) => c.status === "unverified")
      .length,
    brokenCount: result.linkChecks.filter((c) => c.status === "broken").length,
    limited: true,
    ...(result.linkChecks.length
      ? {}
      : { note: "No internal destination results were recorded in this run." }),
  };
}
export function buildReportHtml(
  result: FullSiteAuditResult,
  profile?: Partial<UserProfile>,
  includeEvidence = true,
  typography?: ReportTypography,
) {
  return buildAuditDocument({
    url: result.discovery?.origin || result.discovery?.url || "",
    pageTitle: websiteDisplayName(
      result.lightweightResults?.find((p) => p.pageType === "Homepage")?.title,
      result.discovery?.origin || result.discovery?.url || "",
    ),
    generatedAt: result.generatedAt,
    report: result.siteReport,
    linkCoverage: coverageFor(result),
    deepResults: result.deepResults,
    lightweightResults: result.lightweightResults,
    profile: { ...getProfileFallbacks(profile), yourLogo: profile?.yourLogo },
    includeEvidence,
    typography,
  });
}
export default function FullSiteAuditReport({ result, profile }: Props) {
  const [message, setMessage] = useState("");
  const { typography, ready: presentationReady } = useReportTypography();
  const brandProfile = {
    ...getProfileFallbacks(profile),
    yourLogo: profile?.yourLogo,
  };
  if (!result.success || !result.siteReport) return null;
  const report = result.siteReport,
    pages = result.deepResults || [],
    findings = report.findingDetails || groupLighthouseFindings(pages);
  const clientSections = readClientSections(report, findings);
  const scoreItems = siteScoreItems(pages);
  const inspected =
    result.lightweightResults?.filter((p) => p.status === "ok").length || 0;
  const exportReport = (details: boolean) =>
    setMessage(
      printAuditHtml(buildReportHtml(result, profile, details, typography))
        ? ""
        : "Allow pop-ups to open the printable report.",
    );
  return (
    <section className="audit-report-workspace space-y-6">
      <header className="audit-report-header rounded-2xl border border-border bg-card p-6">
  <ReportBrand profile={brandProfile} />

  <h2 className="text-2xl font-bold text-foreground">
    Website review · {inspected}{" "}
    {inspected === 1 ? "page" : "pages"} inspected
  </h2>

  <p className="break-all text-sm text-muted-foreground">
    {result.discovery?.origin || result.discovery?.url}
  </p>

  <p className="text-xs text-muted-foreground">
    {reviewScopeLine(pages, inspected)
      .split(" · ")
      .slice(1)
      .join(" · ")
      .replace(
        /\b1 representative pages tested\b/g,
        "1 representative page tested",
      )}
    {result.status === "partial" ? " · Some checks unavailable" : ""}
  </p>

  <p className="text-xs text-muted-foreground">
    {linkCoverageText(coverageFor(result))}
  </p>

  <div className="audit-report-actions">
    <button
      type="button"
      disabled={!presentationReady}
      onClick={() => exportReport(false)}
    >
      {presentationReady ? "Export client summary" : "Preparing PDF…"}
    </button>

    <button
      type="button"
      disabled={!presentationReady}
      onClick={() => exportReport(true)}
    >
      Export with evidence
    </button>
  </div>

  {message && (
    <p role="status" className="text-sm text-muted-foreground">
      {message}
    </p>
  )}
</header>
      <article className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.03] p-6 sm:p-8">
        <h3 className="text-lg font-semibold text-foreground">Overview</h3>
        <p className="mt-3 text-sm leading-7 text-secondary-foreground">
          {report.executiveSummary}
        </p>
        {clientSections.rows[0] && (
          <Priority row={clientSections.rows[0]} index={0} featured />
        )}
        {values(report.strengths).length > 0 && (
          <>
            <h4 className="mb-2 mt-5 font-semibold">Your existing strengths</h4>
            <Bullets items={values(report.strengths)} />
          </>
        )}
      </article>
      {(clientSections.rows.length > 1 ||
        clientSections.remainingImpacts.length > 0 ||
        clientSections.remainingActions.length > 0) && (
        <article className="rounded-2xl border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            Other priorities
          </h3>
          <div className="space-y-5">
            {clientSections.rows.slice(1).map((row, index) => (
              <Priority key={row.title + index} row={row} index={index + 1} />
            ))}
          </div>
          {clientSections.remainingImpacts.length > 0 && (
            <>
              <h4 className="mb-2 mt-5 font-semibold">
                Why this matters for visitors
              </h4>
              <Bullets items={clientSections.remainingImpacts} />
            </>
          )}
          {clientSections.remainingActions.length > 0 && (
            <>
              <h4 className="mb-2 mt-5 font-semibold">How we can help</h4>
              <Bullets items={clientSections.remainingActions} />
            </>
          )}
        </article>
      )}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground">
          Supporting checks across tested pages
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-5 lg:grid-cols-5">
          {scoreItems.map((item) => (
            <div key={item.label}>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {item.value ?? item.availability.label}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.count} scored {item.count === 1 ? "page" : "pages"}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-6 text-muted-foreground">
          Averages cover the representative pages tested. Unavailable scores are
          excluded. Search, accessibility and technical best-practice averages
          use mobile runs.
        </p>
      </section>
      <details className="rounded-2xl border border-border bg-card p-6">
        <summary className="cursor-pointer font-semibold text-foreground">
          Technical evidence and page coverage
        </summary>
        <div className="mt-5 space-y-6">
          <ScoreTable pages={pages} />
          <FindingEvidence findings={findings} />
          <LoadingDiagnostics pages={pages} />
          <ul className="space-y-2 text-xs text-muted-foreground">
            {result.lightweightResults?.map((p) => (
              <li key={p.url} className="break-all">
                {p.finalUrl || p.url} · {p.status}
                {p.httpStatus ? " · HTTP " + p.httpStatus : ""}
                {p.error ? " · " + p.error : ""}
              </li>
            ))}
          </ul>
        </div>
      </details>
      <article className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-3 font-semibold text-foreground">
          Coverage and limitations
        </h3>
        <Bullets items={values(report.scopeNotes)} />
      </article>
      <ReportContact profile={brandProfile} />
    </section>
  );
}
