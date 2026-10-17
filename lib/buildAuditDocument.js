import {
  readClientSections,
  buildClientNarrative,
  reviewScopeLine,
  siteScoreItems,
  linkCoverageText,
  scoreAvailability,
  pageScoreAvailability,
  websiteDisplayName,
  primaryScoreDevice,
} from "./clientAuditReport";
import { asList, groupLighthouseFindings, isScore } from "./auditReport";
export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
const e = escapeHtml;
const bullets = (values) =>
  asList(values).length
    ? "<ul>" +
      asList(values)
        .map((v) => "<li>" + e(v) + "</li>")
        .join("") +
      "</ul>"
    : "";
const colour = (v) =>
  !isScore(v)
    ? "#64748b"
    : v >= 90
      ? "#15803d"
      : v >= 50
        ? "#a16207"
        : "#be123c";
const score = (v, missingLabel = "Not recorded") =>
  '<span style="color:' +
  colour(v) +
  '">' +
  (isScore(v) ? v : '<span class="note">' + e(missingLabel) + "</span>") +
  "</span>";
const date = (value) => {
  const d = new Date(value || Date.now());
  return Number.isNaN(d.valueOf())
    ? "Not recorded"
    : d.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
};
export const DOCUMENT_CSS = `
* { box-sizing: border-box; }
body { margin: 0; background: #edf0f6; color: #241632; font: 18px/1.65 Arial, sans-serif; }
main { max-width: 980px; margin: auto; padding: 48px; background: #fff; }
header { border-bottom: 3px solid #8b48db; padding-bottom: 24px; margin-bottom: 30px; }
.brand-lockup { display: flex; align-items: center; gap: 22px; margin-bottom: 24px; }
.report-logo { display: block; max-width: 180px; max-height: 64px; width: auto; height: auto; object-fit: contain; }
.brand, .kicker { color: #6d28b7; font-size: 14px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
h1 { margin: 12px 0; font-size: 34px; line-height: 1.2; letter-spacing: -.025em; }
h2 { margin: 28px 0 14px; font-size: 26px; line-height: 1.3; }
h3 { margin: 8px 0 12px; font-size: 22px; line-height: 1.35; }
p { margin: 12px 0; } ul { padding-left: 24px; } li { margin: 10px 0; }
.meta, .note { font-size: 15px; line-height: 1.55; color: #62576e; }
.scope-line { margin-top: 14px; }
.card { border-top: 2px solid #e0d1f3; padding: 20px 0; margin: 22px 0; }
.badge { color: #6831a4; font-size: 14px; line-height: 1.5; font-weight: 700; text-transform: uppercase; }
.client-card { break-inside: avoid; }
.client-card p { margin: 12px 0; }
.evidence-line, .url { overflow-wrap: anywhere; }
.overview-scores { display: table; width: 100%; table-layout: fixed; margin: 18px 0; border-block: 1px solid #dfd2ef; break-inside: avoid; }
.overview-score { display: table-cell; width: 20%; padding: 14px 9px; vertical-align: top; }
.overview-score-label { min-height: 3em; font-size: 14px; line-height: 1.45; color: #62576e; }
.site-score-summary .overview-score-label { min-height: 6em; }
.overview-score-value { margin-top: 8px; font-size: 26px; line-height: 1.3; font-weight: 700; }
table { border-collapse: collapse; width: 100%; font-size: 14px; line-height: 1.5; table-layout: fixed; }
th, td { padding: 12px 8px; border-bottom: 1px solid #e5deeb; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
th { background: #f5effc; } th:first-child { width: 30%; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 14px; background: #f8f5fb; font: 13px/1.6 ui-monospace, monospace; }
.url { font-size: 13px; color: #62576e; }
a { color: #6831a4; }
h2, h3 { break-after: avoid; }
tr, .evidence-entry, .compact-evidence { break-inside: avoid; }
.appendix { margin-top: 44px; }
.report-contact { margin-top: 32px; border-top: 1px solid #dfd2ef; padding-top: 18px; font-size: 14px; color: #62576e; overflow-wrap: anywhere; }
@page { size: A4; margin: 14mm 15mm; }
@media (max-width: 700px) { main { padding: 24px; } h1 { font-size: 28px; } body { font-size: 17px; } }
@media print {
  body { background: #fff; font-size: 11.5pt; line-height: 1.5; }
  main { max-width: none; padding: 0; }
  header { padding-bottom: 14px; margin-bottom: 18px; }
  .brand-lockup { margin-bottom: 14px; }
  .report-logo { max-width: 160px; max-height: 52px; }
  h1 { font-size: 25px; margin: 8px 0; }
  h2 { font-size: 20px; margin: 20px 0 10px; }
  h3 { font-size: 17px; margin: 8px 0 10px; }
  p { margin: 9px 0; }
  .meta, .note { font-size: 9.5pt; line-height: 1.5; }
  .brand, .kicker, .badge { font-size: 9.5pt; }
  .card { padding: 12px 0; margin: 14px 0; }
  .client-card p { margin: 9px 0; }
  .overview-score { padding: 10px 6px; }
  .overview-score-label { font-size: 9pt; }
  .overview-score-value { font-size: 20px; }
  table { font-size: 9.5pt; }
  th, td { padding: 9px 6px; }
  .url { font-size: 9pt; }
  pre { font-size: 9pt; }
  thead { display: table-header-group; }
  .appendix { break-before: page; }
  .report-contact { font-size: 9.5pt; margin-top: 24px; }
  a { color: inherit; text-decoration: none; }
}
  /* Exported report: title left, logo/company right */
header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 160px;
  column-gap: 24px;
  row-gap: 10px;
  align-items: start;
}

header > * {
  grid-column: 1;
  min-width: 0;
  margin: 0;
}

header > .brand-lockup {
  grid-column: 2;
  grid-row: 1 / span 4;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  margin: 0;
  text-align: right;
}

header .report-logo {
  max-width: 150px;
  max-height: 58px;
}

header .brand {
  font-size: 13px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

header h1 {
  margin: 0;
  text-wrap: balance;
}

@media screen and (max-width: 600px) {
  header {
    grid-template-columns: minmax(0, 1fr);
  }

  header > .brand-lockup {
    grid-column: 1;
    grid-row: auto;
    align-items: flex-start;
    text-align: left;
  }
}
`;
export function buildAuditDocument({
  url = "",
  pageTitle = "",
  generatedAt,
  report = {},
  scores,
  deepResults,
  lightweightResults = [],
  profile = {},
  includeEvidence = true,
  typography = {},
  linkCoverage,
} = {}) {
  const fontFamily = String(typography.fontFamily || "Arial, sans-serif")
    .replace(/[<>{};\\]/g, "")
    .slice(0, 400);
  const fontCss = String(typography.fontFacesCss || "").replace(/</g, "\\3c ");
  const logo =
    typeof profile.yourLogo === "string" &&
    profile.yourLogo.length <= 600000 &&
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
      profile.yourLogo,
    )
      ? profile.yourLogo
      : "";
  const contact = [profile.yourName, profile.yourCompany, profile.yourWebsite]
    .filter(Boolean)
    .join(" · ");
  const pages = asList(deepResults).length
    ? deepResults
    : scores
      ? [{ url, pageType: pageTitle || "Audited page", scores }]
      : [];
  const findings = asList(report.findingDetails).length
    ? report.findingDetails
    : groupLighthouseFindings(pages);
  const isSiteReview = Array.isArray(deepResults);
  const inspectedCount = lightweightResults.filter(
    (p) => p.status === "ok",
  ).length;
  const heading = isSiteReview
    ? `Website review · ${inspectedCount} ${inspectedCount === 1 ? "page" : "pages"} inspected`
    : "Single-page review";
  const scopeLine = reviewScopeLine(
    pages,
    isSiteReview ? inspectedCount : undefined,
  )
    .split(" · ")
    .slice(1)
    .join(" · ")
    .replace(
      /\b1 representative pages tested\b/g,
      "1 representative page tested",
    );
  const summary = report.executiveSummary || "No summary was supplied.";
  const primaryDevice = primaryScoreDevice(scores);
  const scoreItems = scores
    ? [
        ["Mobile performance", "mobile", "performance"],
        ["Desktop performance", "desktop", "performance"],
        ["Search checks", primaryDevice, "seo"],
        ["Accessibility checks", primaryDevice, "accessibility"],
        ["Technical best practices", primaryDevice, "bestPractices"],
      ].map(([label, device, key]) => ({
        label,
        value: scores[device]?.[key],
        availability: scoreAvailability(scores, device, key),
      }))
    : siteScoreItems(pages);
  const briefScores = scoreItems.length
    ? '<div class="overview-scores' +
      (isSiteReview ? " site-score-summary" : "") +
      '">' +
      scoreItems
        .map(
          (item) =>
            '<div class="overview-score"><div class="overview-score-label">' +
            e(item.label) +
            (typeof item.count === "number"
              ? "<br>" +
                item.count +
                (item.count === 1 ? " scored page" : " scored pages")
              : "") +
            '</div><div class="overview-score-value">' +
            score(item.value, item.availability?.label) +
            (isScore(item.value) ? '<span class="note"> /100</span>' : "") +
            "</div></div>",
        )
        .join("") +
      '</div><p class="note">' +
      (scores
        ? "Search, accessibility and technical best-practice checks use the " +
          primaryDevice +
          " run. Scores cover automated checks for this page."
        : "Averages exclude unavailable scores. Search, accessibility and technical best-practice averages use mobile tests. Sample counts are shown per category.") +
      "</p>"
    : "";
  const linkText = linkCoverageText(
    linkCoverage || scores?.linkCoverage || report.linkCoverage,
  );
  const rows = pages
    .map((p) =>
      ["mobile", "desktop"]
        .map(
          (device) =>
            "<tr><td>" +
            e(p.pageType || p.pageTitle || "Page") +
            '<div class="url">' +
            e(p.url) +
            "</div></td><td>" +
            device +
            "</td>" +
            ["performance", "seo", "accessibility", "bestPractices"]
              .map(
                (key) =>
                  "<td>" +
                  score(
                    p.scores?.[device]?.[key],
                    pageScoreAvailability(p, device, key).label,
                  ) +
                  "</td>",
              )
              .join("") +
            "</tr>",
        )
        .join(""),
    )
    .join("");
  const client = readClientSections(report, findings);
  const strengths = Array.isArray(report.strengths)
    ? report.strengths
    : buildClientNarrative(findings, { pages }).strengths;
  const cards = client.rows
    .map(
      (row, index) =>
        '<article class="card client-card"><div class="badge">Priority ' +
        (index + 1) +
        (row.coverage ? " · " + e(row.coverage) : "") +
        "</div><h3>" +
        e(row.title) +
        "</h3><p><strong>What we found:</strong> " +
        e(row.observation) +
        "</p>" +
        (row.impact
          ? "<p><strong>Why it matters:</strong> " + e(row.impact) + "</p>"
          : "") +
        (row.help
          ? "<p><strong>How we can help:</strong> " + e(row.help) + "</p>"
          : "") +
        row.loadingContext
          .map((line) => '<p class="note evidence-line">' + e(line) + "</p>")
          .join("") +
        row.evidence
          .slice(0, 1)
          .map((line) => '<p class="note evidence-line">' + e(line) + "</p>")
          .join("") +
        "</article>",
    )
    .join("");
  const next =
    report.clientNextStep ||
    (client.rows.length && client.rows[0].help
      ? "Start with “" +
        client.rows[0].title.toLowerCase() +
        "”, confirm the necessary work and repeat the checks after changes."
      : "");
  const detailCards = findings
    .map(
      (f) =>
        '<article class="card' +
        (asList(f.evidence).length <= 1 ? " compact-evidence" : "") +
        '"><div class="badge">' +
        e(f.priority) +
        " · " +
        e(f.source || "Automated check") +
        "</div><h3>" +
        e(f.title) +
        "</h3><p>" +
        e(f.finding) +
        "</p><p><strong>Why it matters:</strong> " +
        e(f.impact) +
        "</p><p><strong>What to review:</strong> " +
        e(f.action) +
        "</p>" +
        asList(f.evidence)
          .map(
            (v) =>
              '<div class="evidence-entry"><div class="url">' +
              e(v.url) +
              (v.device ? " · " + e(v.device) : "") +
              "</div>" +
              (v.displayValue ? "<p>" + e(v.displayValue) + "</p>" : "") +
              (v.estimatedSavingsMs > 0 || v.estimatedSavingsBytes > 0
                ? '<p class="note">Estimated opportunity: ' +
                  [
                    v.estimatedSavingsMs > 0
                      ? Math.round(v.estimatedSavingsMs) + " ms"
                      : null,
                    v.estimatedSavingsBytes > 0
                      ? Math.round(v.estimatedSavingsBytes / 1024) + " KiB"
                      : null,
                  ]
                    .filter(Boolean)
                    .join(", ") +
                  ". Estimates overlap and must not be added together.</p>"
                : "") +
              asList(v.items)
                .map(
                  (item) =>
                    "<pre>" + e(JSON.stringify(item, null, 2)) + "</pre>",
                )
                .join("") +
              "</div>",
          )
          .join("") +
        "</article>",
    )
    .join("");
  const detailedScope = asList(report.scopeNotes);
  const boilerplate = new Set([
    "This is a sample of public pages, not an exhaustive website or functional test.",
    "HTML checks inspect the downloaded source; JavaScript-rendered content may be absent. Lighthouse renders only its selected pages.",
    "Accessibility results are automated findings and require manual verification.",
    "Form submissions, payments, sign-in and backend processing were not tested.",
    "These are simulated page tests. Results can vary between runs and do not describe every visitor’s experience.",
    "Automated accessibility checks do not establish full accessibility compliance.",
  ]);
  const scope = includeEvidence
    ? detailedScope
    : [
        "Sampled public-page checks; dynamic content may be absent and accessibility needs manual review.",
        "Forms, payments, sign-in and backend processing were not tested.",
        ...(scores
          ? ["Simulated results can vary between runs and visitors."]
          : []),
        ...detailedScope.filter((note) => !boilerplate.has(note)),
      ];
  const pageRows = asList(lightweightResults)
    .map(
      (p) =>
        '<tr><td colspan="2">' +
        e(p.finalUrl || p.url) +
        "</td><td>" +
        e(p.status) +
        "</td><td>" +
        e(p.httpStatus ?? "Unknown") +
        '</td><td colspan="2">' +
        e(p.error || "") +
        "</td></tr>",
    )
    .join("");
  return (
    '<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' +
    (isSiteReview ? "Website review" : "Single-page review") +
    " – " +
    e(websiteDisplayName(pageTitle, url)) +
    "</title><style>" +
    DOCUMENT_CSS +
    fontCss +
    "body{font-family:" +
    fontFamily +
    ";}" +
    '</style></head><body><main><header><div class="brand-lockup">' +
    (logo
      ? '<img class="report-logo" src="' +
        e(logo) +
        '" alt="' +
        e((profile.yourCompany || "Company") + " logo") +
        '">'
      : "") +
    '<div class="brand">' +
    e(profile.yourCompany || "AuditUnfold") +
    "</div></div><h1>" +
    e(heading) +
" for " +
e(websiteDisplayName(pageTitle, url)) +
'</h1><div class="meta">' +
    e(url) +
    "<br>Prepared by " +
    e(profile.yourName || profile.yourCompany || "Website team") +
    " · " +
    date(generatedAt) +
    '</div><p class="note scope-line">' +
    e(scopeLine) +
    "</p></header>" +
    '<div class="kicker">Overview</div><p>' +
    e(summary).replace(/\n/g, "<br>") +
    "</p>" +
    '<p class="note">' +
    e(linkText) +
    "</p>" +
    (asList(strengths).length
      ? "<h2>Your existing strengths</h2>" + bullets(strengths)
      : "") +
    "<h2>Where we can help</h2>" +
    (cards ||
      "<p>No actionable issue was returned by the available checks.</p>") +
    (client.remainingImpacts.length
      ? "<h2>Why this matters for visitors</h2>" +
        bullets(client.remainingImpacts)
      : "") +
    (client.remainingActions.length
      ? "<h2>How we can help</h2>" + bullets(client.remainingActions)
      : "") +
    (next ? "<h2>Where we would start</h2><p>" + e(next) + "</p>" : "") +
    (briefScores ? "<h2>Supporting checks</h2>" + briefScores : "") +
    (() => {
      const failures = new Map();
      for (const p of pages)
        for (const d of ["mobile", "desktop"]) {
          if (p.scores?.runs?.[d]?.status !== "failed") continue;
          const reason = scoreAvailability(p.scores, d).reason;
          const key = d + ":" + reason;
          if (!failures.has(key))
            failures.set(key, { device: d, reason, count: 0 });
          failures.get(key).count++;
        }
      return [...failures.values()]
        .map(
          (f) =>
            '<p class="note">' +
            e(
              f.device.charAt(0).toUpperCase() +
                f.device.slice(1) +
                (f.count === 1
                  ? " result unavailable"
                  : " results unavailable on " + f.count + " tested pages") +
                ": " +
                f.reason,
            ) +
            "</p>",
        )
        .join("");
    })() +
    '<p class="note"><strong>Review scope:</strong> ' +
    (scope.length
      ? scope
      : [
          "This review covers the supplied public page sample.",
          "Form submissions, payments, sign-in and backend processing were not tested.",
        ]
    )
      .map(e)
      .join(" ") +
    "</p>" +
    (includeEvidence
      ? '<section class="appendix"><div class="kicker">Supporting evidence</div><h2>Tested pages and devices</h2><p class="note">Lighthouse scores describe the tested page and device. They do not measure the whole website, search strategy or full accessibility compliance.</p><table><thead><tr><th>Page</th><th>Device</th><th>Performance</th><th>Search checks</th><th>Accessibility checks</th><th>Technical best practices</th></tr></thead><tbody>' +
        (rows ||
          '<tr><td colspan="6">No Lighthouse scores available.</td></tr>') +
        '</tbody></table><h2>Loading diagnostics</h2><p class="note">Supporting observations, not confirmed causes. Breakdown timings may use different conditions from the headline simulated metric.</p>' +
        pages
          .flatMap((p) =>
            ["mobile", "desktop"].map((d) => {
              const context = p.scores?.evidence?.[d]?.loadingDiagnostics;
              return (
                '<article class="card"><h3>' +
                e(p.pageType || "Page") +
                " · " +
                d +
                '</h3><p class="url">' +
                e(p.url) +
                "</p>" +
                (context?.audits?.length
                  ? context.audits
                      .map(
                        (a) =>
                          "<p><strong>" +
                          e(a.title) +
                          "</strong></p><pre>" +
                          e(JSON.stringify(a.items, null, 2)) +
                          "</pre>",
                      )
                      .join("")
                  : '<p class="note">Loading diagnostics were not recorded or provided.</p>') +
                "</article>"
              );
            }),
          )
          .join("") +
        "<h2>Finding details</h2>" +
        (detailCards || "<p>No detailed findings available.</p>") +
        (pageRows
          ? '<h2>HTML coverage</h2><table><thead><tr><th colspan="2">URL</th><th>Inspection</th><th>HTTP</th><th colspan="2">Note</th></tr></thead><tbody>' +
            pageRows +
            "</tbody></table>"
          : "") +
        "</section>"
      : "") +
    (contact
      ? '<footer class="report-contact">' + e(contact) + "</footer>"
      : "") +
    "</main></body></html>"
  );
}