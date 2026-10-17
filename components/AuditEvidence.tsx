"use client";
import { useId, useRef } from "react";
import type { DeepResult, FindingDetail, Scores } from "../lib/auditTypes";
import { groupLighthouseFindings, isScore } from "../lib/auditReport";
import { pageScoreAvailability } from "../lib/clientAuditReport";
export function printAuditHtml(html: string) {
  const popup = window.open("", "_blank");
  if (!popup) return false;
  popup.opener = null;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  // Give the embedded font and logo time to decode before opening Print.
  const print = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.all([
        popup.document.fonts?.ready || Promise.resolve(),
        ...Array.from(popup.document.images).map(
          (img) => img.decode?.().catch(() => {}) || Promise.resolve(),
        ),
      ]),
      new Promise((resolve) => {
        timer = setTimeout(resolve, 5000);
      }),
    ]).catch(() => {});
    clearTimeout(timer);
    if (!popup.closed) {
      popup.focus();
      popup.print();
    }
  };
  if (popup.document.readyState === "complete")
    window.setTimeout(() => {
      void print();
    }, 50);
  else
    popup.addEventListener(
      "load",
      () =>
        window.setTimeout(() => {
          void print();
        }, 50),
      {
        once: true,
      },
    );
  return true;
}
export function ScoreTable({ pages }: { pages: DeepResult[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="mb-3 text-left text-xs text-muted-foreground">
          Scores out of 100 from simulated mobile and desktop tests. Missing
          results distinguish tests not requested from unavailable or unrecorded
          results.
        </caption>
        <thead>
          <tr>
            {[
              "Page / device",
              "Performance",
              "Search checks",
              "Accessibility checks",
              "Technical best practices",
            ].map((label) => (
              <th
                key={label}
                className="border-b border-border p-3 font-medium"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pages.flatMap((page) =>
            (["mobile", "desktop"] as const).map((device) => (
              <tr key={page.url + device}>
                <td className="border-b border-border p-3">
                  <strong>{page.pageType}</strong> · {device}
                  <div className="max-w-xs break-all text-xs text-muted-foreground">
                    {page.url}
                  </div>
                  {page.error && (
                    <div className="text-xs text-muted-foreground">
                      {page.error}
                    </div>
                  )}
                  {page.scores?.runs?.[device]?.error && (
                    <div className="text-xs text-muted-foreground">
                      {page.scores.runs[device].error}
                    </div>
                  )}
                </td>
                {(
                  [
                    "performance",
                    "seo",
                    "accessibility",
                    "bestPractices",
                  ] as const
                ).map((key) => {
                  const value =
                    page.scores?.[device as "mobile" | "desktop"]?.[key];
                  return (
                    <td key={key} className="border-b border-border p-3">
                      {isScore(value) ? (
                        value
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {pageScoreAvailability(page, device, key).label}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            )),
          )}
        </tbody>
      </table>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        A score of 100 covers the scored automated checks. Additional findings
        and manual checks may remain. These scores do not establish full
        accessibility or search visibility.
      </p>
    </div>
  );
}
export function SourceCheckCoverage({ scores }: { scores: Scores }) {
  const status = scores.sourceCheckStatus;
  return (
    <p className="text-xs leading-6 text-muted-foreground">
      {status === "complete"
        ? "Public HTML inspected for page titles, search descriptions, headings, image descriptions, language, mobile settings, structured data, email link consistency and section shortcuts. JavaScript may change the rendered page."
        : status === "unavailable"
          ? "Public HTML inspection was unavailable or incomplete. Missing source elements were not reported as defects."
          : status === "not-requested"
            ? "A separate public HTML inspection was not requested for this page test."
            : "Public HTML inspection coverage was not recorded in this saved scan."}
    </p>
  );
}
export function LoadingDiagnostics({ pages }: { pages: DeepResult[] }) {
  const container = useRef<HTMLElement>(null);
  const containerId = useId();
  const setAll = (open: boolean) =>
    container.current?.querySelectorAll("details").forEach((element) => {
      element.open = open;
    });
  const hasDiagnostics = pages.some((page) =>
    ["mobile", "desktop"].some(
      (device) =>
        page.scores?.evidence?.[device as "mobile" | "desktop"]
          ?.loadingDiagnostics?.audits.length,
    ),
  );
  return (
    <section ref={container} id={containerId} className="space-y-3">
      <h4 className="font-semibold text-foreground">Loading diagnostics</h4>
      {hasDiagnostics && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-controls={containerId}
            onClick={() => setAll(true)}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            Expand loading details
          </button>
          <button
            type="button"
            aria-controls={containerId}
            onClick={() => setAll(false)}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            Collapse loading details
          </button>
        </div>
      )}
      <p className="text-xs leading-6 text-muted-foreground">
        These are supporting observations, not confirmed causes. Breakdown
        timings may use different conditions from the headline simulated metric.
      </p>
      {pages.flatMap((page) =>
        (["mobile", "desktop"] as const).map((device) => {
          const context = page.scores?.evidence?.[device]?.loadingDiagnostics;
          if (!context?.audits.length)
            return (
              <p
                key={page.url + device}
                className="break-all text-xs text-muted-foreground"
              >
                {page.url} · {device}: loading diagnostics were not recorded or
                provided.
              </p>
            );
          return (
            <details
              key={page.url + device}
              className="rounded-lg border border-border p-4"
            >
              <summary className="cursor-pointer break-all text-sm font-semibold">
                {page.pageType} · {device} · {page.url}
              </summary>
              {context.audits.map((audit) => (
                <div key={audit.id} className="mt-4">
                  <p className="text-sm font-semibold">{audit.title}</p>
                  <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-muted-foreground">
                    {JSON.stringify(audit.items, null, 2)}
                  </pre>
                </div>
              ))}
            </details>
          );
        }),
      )}
    </section>
  );
}
export function FindingEvidence({ findings }: { findings: FindingDetail[] }) {
  const container = useRef<HTMLDivElement>(null);
  const containerId = useId();
  const setAll = (open: boolean) =>
    container.current
      ?.querySelectorAll<HTMLDetailsElement>("details[data-audit-finding]")
      .forEach((element) => {
        element.open = open;
      });
  if (!findings.length)
    return (
      <p className="text-sm text-muted-foreground">
        No actionable finding was returned by the available checks.
      </p>
    );
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          aria-controls={containerId}
          onClick={() => setAll(true)}
          className="rounded-lg border border-border px-3 py-2 text-sm text-foreground"
        >
          Expand all
        </button>
        <button
          type="button"
          aria-controls={containerId}
          onClick={() => setAll(false)}
          className="rounded-lg border border-border px-3 py-2 text-sm text-foreground"
        >
          Collapse all
        </button>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Suggested priorities are assigned by AuditUnfold to help plan the
        review.
      </p>
      <div ref={container} id={containerId} className="space-y-3">
        {findings.map((finding) => (
          <details
            key={finding.id}
            data-audit-finding="true"
            className="rounded-xl border border-border p-4"
          >
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              {finding.title}{" "}
              <span className="font-normal text-muted-foreground">
                · {finding.affectedPages ?? finding.affectedUrls?.length ?? 1}{" "}
                {(finding.affectedPages ??
                  finding.affectedUrls?.length ??
                  1) === 1
                  ? "affected page"
                  : "affected pages"}{" "}
                ·{" "}
                {finding.priority === "review"
                  ? "needs manual review"
                  : finding.priority + " suggested priority"}
              </span>
            </summary>
            <div className="mt-4 space-y-3 text-sm text-secondary-foreground">
              {finding.technicalTitle &&
                finding.technicalTitle !== finding.title && (
                  <p className="text-xs text-muted-foreground">
                    Recorded check: {finding.technicalTitle}
                  </p>
                )}
              <p>
                <strong>What the test found:</strong> {finding.finding}
              </p>
              {finding.scoreNote && (
                <p className="text-xs text-muted-foreground">
                  {finding.scoreNote}
                </p>
              )}
              <p>
                <strong>Why it matters:</strong> {finding.impact}
              </p>
              <p>
                <strong>What to review:</strong> {finding.action}
              </p>
              {finding.evidence?.map((evidence, index) => (
                <div
                  key={evidence.url + index}
                  className="rounded-lg bg-secondary/30 p-3"
                >
                  <p className="break-all text-xs">
                    {evidence.url}
                    {evidence.device ? " · " + evidence.device : ""}
                  </p>
                  {typeof evidence.affectedItemCount === "number" &&
                    evidence.affectedItemCount > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {evidence.affectedItemCount} evidence{" "}
                        {evidence.affectedItemCount === 1 ? "entry" : "entries"}{" "}
                        reported; showing {evidence.items?.length || 0} retained
                        examples.
                      </p>
                    )}
                  {evidence.displayValue && (
                    <p className="mt-2">{evidence.displayValue}</p>
                  )}
                  {(evidence.estimatedSavingsMs ?? 0) > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Estimated opportunity:{" "}
                      {Math.round(evidence.estimatedSavingsMs!)} ms. Estimates
                      can overlap.
                    </p>
                  )}
                  {(evidence.estimatedSavingsBytes ?? 0) > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Estimated transfer reduction:{" "}
                      {Math.round(evidence.estimatedSavingsBytes! / 1024)} KiB.
                    </p>
                  )}
                  {evidence.items?.map((item, i) => (
                    <div key={i} className="mt-3 border-t border-border pt-3">
                      <p className="break-all text-xs font-medium">
                        {item.node?.nodeLabel ||
                          item.label ||
                          item.url ||
                          item.source ||
                          item.node?.selector ||
                          item.selector ||
                          "Evidence entry " + (i + 1)}
                      </p>
                      {(item.reason ||
                        item.explanation ||
                        item.failureSummary) && (
                        <p className="mt-1 text-xs">
                          {item.reason ||
                            item.explanation ||
                            item.failureSummary}
                        </p>
                      )}
                      <details className="mt-2 text-xs text-muted-foreground">
                        <summary className="cursor-pointer">
                          View technical details
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap break-all">
                          {JSON.stringify(item, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
export function pageEvidence(url: string, scores: Scores): FindingDetail[] {
  return groupLighthouseFindings([{ url, pageType: "Audited page", scores }]);
}
