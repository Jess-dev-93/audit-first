import { buildClientNarrative } from "./clientAuditReport";
/* Pure report logic. No AI claims, form testing or client-specific overrides. */
export const asList = (value) => (Array.isArray(value) ? value : []);
export const isScore = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 100;
const unique = (values) => [...new Set(values.filter(Boolean))];
const rank = { high: 3, medium: 2, low: 1, review: 0 };
export const compareFindings = (a, b) =>
  (rank[b.priority] || 0) - (rank[a.priority] || 0) ||
  (b.affectedPages || 0) - (a.affectedPages || 0) ||
  (b.savingsMs || 0) - (a.savingsMs || 0) ||
  (b.savingsBytes || 0) - (a.savingsBytes || 0);
function guidance(id, category) {
  const extra = [
    [
      /^total-blocking-time$/,
      "Reduce time the page is unresponsive",
      "Long tasks can make the page slow to respond during loading.",
      "Review the reported long tasks, reduce unnecessary script execution and retest.",
    ],
    [
      /^mainthread-work-breakdown$/,
      "Reduce browser work during loading",
      "Heavy processing can delay rendering and responsiveness.",
      "Review the reported work categories and profile the tasks that consume the most time.",
    ],
    [
      /^bootup-time$/,
      "Reduce JavaScript startup time",
      "Script startup can consume time before useful interactions are ready.",
      "Review the flagged scripts and reduce code that must run when the page first opens.",
    ],

    [
      /^first-contentful-paint$/,
      "Show the first content sooner",
      "Visitors may wait before any useful content appears.",
      "Review the initial response and resources that delay the first text or image, then retest.",
    ],
    [
      /^speed-index$/,
      "Make the page look complete sooner",
      "Visitors may see an incomplete page for longer during loading.",
      "Review the loading sequence and prioritise the content visible when the page first opens.",
    ],
    [
      /label-content-name-mismatch/,
      "Match control names to their visible labels",
      "People using voice control may struggle to activate a control by its visible label.",
      "Ensure each flagged control's accessible name includes its visible text, then test it with assistive technology.",
    ],
    [
      /lcp-discovery/,
      "Help the browser find the main content earlier",
      "Late discovery of the main content resource can delay its appearance.",
      "Review the reported main-content resource and make it discoverable early in the page load.",
    ],
    [
      /lcp-breakdown|largest-contentful-paint-element/,
      "Investigate the main content's loading stages",
      "The reported loading stages help identify where the main content is delayed.",
      "Review the reported loading stages and element before selecting a fix; the diagnostic alone does not prove a cause.",
    ],
    [
      /cls-culprits|layout-shift-elements/,
      "Find the elements moving during loading",
      "Content movement can interrupt reading or make controls harder to select.",
      "Inspect the flagged elements and reserve appropriate space before they appear.",
    ],
    [
      /forced-reflow/,
      "Reduce repeated page-layout work",
      "Repeated layout calculations can increase processing during loading or interaction.",
      "Profile the flagged script locations and reduce repeated layout reads and updates where practical.",
    ],
    [
      /unminified-css/,
      "Reduce stylesheet download size",
      "Extra stylesheet bytes can increase the data needed to load the page.",
      "Enable CSS minification in the build or delivery system, then verify the reported files.",
    ],
    [
      /unused-css/,
      "Load only the styling the page needs",
      "Unused styling can add unnecessary downloads.",
      "Check the flagged stylesheets and remove unused rules or split them by page template.",
    ],
    [
      /cache|uses-long-cache-ttl/,
      "Cache reusable files more effectively",
      "Repeat visits may download resources that could be reused.",
      "Review cache headers on the flagged static files, preserving safe updates for files that change.",
    ],
    [
      /network-dependency|critical-request-chains/,
      "Shorten the chain of loading requests",
      "Dependent requests can delay resources needed to display the page.",
      "Inspect the reported request chain and shorten avoidable dependencies without breaking required features.",
    ],
    [
      /third-party-cookies/,
      "Review third-party cookie dependencies",
      "Features that depend on third-party cookies may behave differently when browsers restrict them.",
      "Identify the reported third-party providers and check whether their features still work with cookies restricted.",
    ],
    [
      /inspector-issues|errors-in-console/,
      "Review browser-reported issues",
      "Browser warnings or errors may affect reliability; their actual user impact needs verification.",
      "Inspect the specific reported browser issues and reproduce any user-facing failure before selecting a fix.",
    ],
    [
      /legacy-javascript/,
      "Avoid unnecessary code for older browsers",
      "Compatibility code may add downloads or processing for modern browsers.",
      "Review the reported compatibility code against the browsers the website needs to support.",
    ],
    [
      /total-byte-weight/,
      "Reduce the amount of data needed to load",
      "Large transfers can slow loading on constrained connections.",
      "Review the largest reported resources and reduce their size where the content and required features allow.",
    ],
    [
      /^interactive$/,
      "Time to Interactive (legacy lab diagnostic)",
      "A legacy lab timing for when a page was considered interactive; this is not a current interaction score.",
      "Use the recorded value as supporting context alongside current loading and blocking-time checks.",
    ],
    [
      /^max-potential-fid$/,
      "Maximum Potential First Input Delay (legacy lab diagnostic)",
      "A legacy lab estimate based on the longest main-thread task, not a measured delay from a real visitor.",
      "Review the recorded task alongside current blocking-time evidence; do not present it as a current field metric.",
    ],
  ];
  const match = extra.find(([pattern]) => pattern.test(id));
  if (match) return match.slice(1);

  if (/contrast/.test(id))
    return [
      "Improve text contrast",
      "Some flagged text may be difficult to read.",
      "Check the flagged foreground and background colours in their actual states and correct confirmed contrast failures.",
    ];
  if (/image-alt/.test(id))
    return [
      "Describe informative images",
      "Missing image descriptions can prevent some visitors from understanding the content.",
      "Add useful descriptions to informative images and empty alt attributes to decorative images.",
    ];
  if (/link-name|button-name/.test(id))
    return [
      "Give controls clear names",
      "Some controls may be difficult to identify with assistive technology.",
      "Give flagged links and buttons an accessible name that describes their purpose.",
    ];
  if (/largest-contentful|lcp/.test(id))
    return [
      "Show main content sooner",
      "Visitors may wait longer to see the main content on the tested pages.",
      "Inspect the reported LCP element and its loading stages, then address the measured delay and retest.",
    ];
  if (/unused-javascript/.test(id))
    return [
      "Reduce unnecessary JavaScript",
      "Extra code can increase downloads and processing on the tested pages.",
      "Trace the flagged files to their features; remove unused code or load it only when needed.",
    ];
  if (/render-blocking/.test(id))
    return [
      "Reduce blocking resources",
      "Blocking resources can delay the first useful content.",
      "Review the flagged resources and move nonessential loading out of the critical rendering path.",
    ];
  if (/image|img/.test(id) && category === "performance")
    return [
      "Deliver images more efficiently",
      "Large image transfers can slow down the tested pages.",
      "Review the affected image URLs, dimensions and formats; use appropriately sized images and retest.",
    ];
  if (/blocking-time|mainthread|bootup-time|long-tasks/.test(id))
    return [
      "Reduce work that delays interaction",
      "Long tasks can make the tested pages feel unresponsive.",
      "Profile the reported tasks and scripts, reduce unnecessary execution and retest interaction readiness.",
    ];
  if (/layout-shift|cls/.test(id))
    return [
      "Keep page content stable",
      "Unexpected movement can make content and controls harder to use.",
      "Inspect the reported shifting elements and reserve space for images, embeds and late-loading content.",
    ];
  if (category === "accessibility")
    return [
      null,
      "The automated finding may indicate a barrier for some visitors.",
      "Manually verify the affected elements, correct confirmed barriers and repeat automated and keyboard testing.",
    ];
  if (category === "seo")
    return [
      null,
      "This finding may affect how search engines understand or present the tested page.",
      "Correct the specific reported implementation and verify it on related page templates.",
    ];
  if (category === "performance")
    return [
      null,
      "This finding may delay content or interaction on the tested page.",
      "Investigate the reported resources and measured diagnostic, make a targeted change and retest.",
    ];
  return [
    null,
    "This automated finding warrants review on the affected pages.",
    "Validate the reported evidence and correct the confirmed implementation issue.",
  ];
}
export function groupLighthouseFindings(deepResults) {
  const groups = new Map();
  for (const page of asList(deepResults))
    for (const device of ["mobile", "desktop"]) {
      const evidence = page.scores?.evidence?.[device];
      for (const finding of asList(
        evidence?.findings || evidence?.topFindings,
      )) {
        const key = finding.category + ":" + finding.id;
        if (!groups.has(key)) {
          const [title, impact, action] = guidance(
            finding.id,
            finding.category,
          );
          groups.set(key, {
            id: key,
            auditId: finding.id,
            category: finding.category,
            categoryLabel: finding.categoryLabel,
            title: title || finding.title,
            technicalTitle: finding.title,
            priority: finding.priority,
            impact,
            action,
            source: "Lighthouse",
            evidence: [],
            savingsMs: 0,
            savingsBytes: 0,
          });
        }
        const group = groups.get(key);
        if ((rank[finding.priority] || 0) > (rank[group.priority] || 0))
          group.priority = finding.priority;
        group.savingsMs = Math.max(group.savingsMs, finding.savingsMs || 0);
        group.savingsBytes = Math.max(
          group.savingsBytes,
          finding.savingsBytes || 0,
        );
        if (
          !group.evidence.some((x) => x.url === page.url && x.device === device)
        )
          group.evidence.push({
            url: page.url,
            device,
            title: finding.title,
            ...(finding.id === "largest-contentful-paint" ||
            /lcp/.test(finding.id)
              ? { loadingDiagnostics: evidence.loadingDiagnostics }
              : {}),
            displayValue: finding.displayValue,
            estimatedSavingsMs: finding.savingsMs,
            estimatedSavingsBytes: finding.savingsBytes,
            items: asList(finding.items),
            affectedItemCount: finding.affectedItemCount,
            diagnostic: finding.diagnostic === true,
            numericValue: finding.numericValue,
            numericUnit: finding.numericUnit,
            scoringWeight: finding.weight,
            auditId: finding.id,
          });
      }
    }
  const pageFindings = asList(deepResults).flatMap((p) =>
    asList(p.scores?.pageFindings),
  );
  const lighthouseFindings = [...groups.values()].map((g) => {
    g.affectedUrls = unique(g.evidence.map((x) => x.url));
    g.affectedPages = g.affectedUrls.length;
    g.devices = unique(g.evidence.map((x) => x.device));
    const scope =
      g.affectedPages +
      " tested " +
      (g.affectedPages === 1 ? "page" : "pages") +
      " (" +
      g.devices.join(" and ") +
      ")";
    const measurements = unique(
      g.evidence
        .filter((v) => v.displayValue)
        .map((v) => v.device + ": " + v.displayValue),
    );
    g.finding = measurements.length
      ? g.technicalTitle +
        (g.affectedPages > 1 ? " — example measurements: " : " — ") +
        measurements.slice(0, 2).join("; ") +
        ". Recorded on " +
        scope +
        "."
      : "Lighthouse flagged " + g.technicalTitle + " on " + scope + ".";
    if (
      g.category === "accessibility" &&
      g.evidence.length &&
      g.evidence.every((v) => v.scoringWeight === 0)
    )
      g.scoreNote =
        "This additional accessibility check does not contribute to the category score. Manual validation is still required.";
    return g;
  });
  return mergeSourceFindings(lighthouseFindings, pageFindings).sort(
    compareFindings,
  );
}

// Combine equivalent source and Lighthouse findings so totals count unique URLs,
// retaining both sources rather than presenting one defect twice.
export function mergeSourceFindings(findings, sourceFindings) {
  const equivalent = {
    "missing-title": "document-title",
    "missing-meta-description": "meta-description",
    "missing-image-alt": "image-alt",
    "missing-language": "html-has-lang",
    "missing-viewport": "viewport",
  };
  for (const finding of sourceFindings) {
    const target = equivalent[finding.id];
    const matching = target ? findings.find((f) => f.auditId === target) : null;
    if (!matching) {
      findings.push(finding);
      continue;
    }
    matching.evidence.push(...finding.evidence);
    matching.affectedUrls = unique([
      ...matching.affectedUrls,
      ...finding.affectedUrls,
    ]);
    matching.affectedPages = matching.affectedUrls.length;
    matching.source = "Lighthouse and public HTML";
    matching.finding =
      matching.technicalTitle +
      " was flagged by Lighthouse; related HTML evidence was found across " +
      matching.affectedPages +
      (matching.affectedPages === 1 ? " inspected page." : " inspected pages.");
    if ((rank[finding.priority] || 0) > (rank[matching.priority] || 0))
      matching.priority = finding.priority;
  }
  return findings;
}

const loadingMetrics = new Set([
  "first-contentful-paint",
  "largest-contentful-paint",
  "speed-index",
]);
export function selectClientPriorities(findings, limit = 5) {
  const metrics = findings.filter((f) => loadingMetrics.has(f.auditId));
  const other = findings.filter(
    (f) =>
      !loadingMetrics.has(f.auditId) &&
      !["interactive", "max-potential-fid"].includes(f.auditId),
  );
  if (metrics.length) {
    const evidence = metrics.flatMap((f) => f.evidence || []),
      urls = unique(evidence.map((v) => v.url));
    const readings = unique(
      evidence
        .filter((v) => v.displayValue)
        .map(
          (v) =>
            (v.title || "Loading measurement") +
            " (" +
            v.device +
            "): " +
            v.displayValue,
        ),
    ).slice(0, 3);
    other.push({
      id: "loading-experience",
      category: "performance",
      categoryLabel: "Performance",
      title: "Make page content appear sooner",
      priority: metrics.sort(compareFindings)[0].priority,
      affectedPages: urls.length,
      affectedUrls: urls,
      evidence,
      finding: readings.length
        ? readings.join("; ") + "."
        : "Several loading measurements were flagged on " +
          urls.length +
          " tested " +
          (urls.length === 1 ? "page." : "pages."),
      impact: "Visitors may wait longer to see and read the page content.",
      action:
        "Use the main-content and resource-loading evidence to identify the delay, make a targeted improvement and retest.",
    });
  }
  other.sort(compareFindings);
  const selected = [];
  // Represent supported categories before filling the remaining places by priority.
  for (const category of [
    "performance",
    "accessibility",
    "seo",
    "best-practices",
    "page-structure",
  ]) {
    const match = other.find(
      (f) => f.category === category && f.priority !== "low",
    );
    if (match && selected.length < limit) selected.push(match);
  }
  for (const finding of other)
    if (selected.length < limit && !selected.includes(finding))
      selected.push(finding);
  return selected.sort(compareFindings);
}
export function buildPageReport(url, scores) {
  const findings = groupLighthouseFindings([{ url, scores }]);
  const priorities = selectClientPriorities(findings);
  const measured = ["mobile", "desktop"].filter((d) =>
    Object.values(scores[d] || {}).some(isScore),
  );
  const perf = measured
    .map(
      (d) =>
        d +
        " performance " +
        (isScore(scores[d]?.performance)
          ? scores[d].performance + "/100"
          : "not available"),
    )
    .join("; ");
  return {
    executiveSummary:
      "We reviewed this public page: " +
      url +
      ". " +
      (perf ? "Automated performance scores were " + perf + ". " : "") +
      (findings.length
        ? "The actions below address the findings from this test; they apply to this page, not the entire website."
        : "No actionable finding was returned by the available automated checks."),
    keyIssues: priorities.map((f) => f.title + ": " + f.finding),
    businessImpact: unique(priorities.map((f) => f.impact)).slice(0, 3),
    recommendations: unique(priorities.map((f) => f.action)),
    findingDetails: findings,
    linkCoverage: scores.linkCoverage,
    scopeNotes: [
      ...(scores.sourceCheckStatus === "unavailable"
        ? [
            "Downloaded HTML could not be inspected completely; source checks are unavailable.",
          ]
        : []),
      ...(scores.sourceCheckStatus === "complete"
        ? [
            "Source checks inspect downloaded HTML; JavaScript may change the rendered page.",
          ]
        : []),
      ...(scores.linkCoverage
        ? [
            scores.linkCoverage.note ||
              "Internal links: " +
                scores.linkCoverage.verifiedCount +
                " verified destinations; " +
                scores.linkCoverage.unverifiedCount +
                " unverified. Checks cover a limited same-origin public-page sample.",
          ]
        : []),
      "These are simulated page tests. Results can vary between runs and do not describe every visitor’s experience.",
      "Automated accessibility checks do not establish full accessibility compliance.",
      "Form submissions, payments, sign-in and backend processing were not tested.",
    ],
    ...buildClientNarrative(findings, {
      pages: [{ url, scores }],
      scopeLabel: "the tested page",
    }),
  };
}
export function buildSiteReport({
  discovery,
  pages,
  issueSummary,
  deepResults,
  deepSummary,
  techStack,
  scopeNotes = [],
}) {
  const completed = pages.filter((p) => p.status === "ok"),
    tested = deepSummary.count;
  const staticFindings = issueSummary.map((x) => ({
    id: x.key,
    title: x.label,
    priority: x.severity,
    category: "page-structure",
    categoryLabel: "Page checks",
    source: "Public HTML",
    finding:
      x.count +
      " of " +
      x.denominator +
      " inspected pages: " +
      x.interpretation,
    affectedPages: x.count,
    affectedUrls: x.affectedUrls,
    evidence: asList(x.evidence),
    impact: x.impact,
    action: x.action,
  }));
  const findings = groupLighthouseFindings(deepResults);
  mergeSourceFindings(findings, staticFindings);
  findings.sort(compareFindings);
  const priorities = selectClientPriorities(findings);
  const strengths = [];
  if (completed.length && completed.every((p) => p.title))
    strengths.push(
      "Document titles were detected on all " +
        completed.length +
        " inspected pages.",
    );
  if (completed.length && completed.every((p) => p.langPresent))
    strengths.push("A document language was detected on all inspected pages.");
  if (completed.length && completed.every((p) => p.viewportPresent))
    strengths.push(
      "A mobile viewport declaration was detected on all inspected pages.",
    );
  if (strengths.length === 3) {
  strengths.splice(
    0,
    3,
    `All ${completed.length} inspected pages include basic settings for page titles, language and mobile display.`,
  ); }
  const analytics = unique([
    ...asList(techStack?.analytics),
    ...asList(techStack?.tagManagers),
  ]);
  const recommendations = unique(priorities.map((f) => f.action));
  const clientNarrative = buildClientNarrative(findings, {
    pages: deepResults,
    scopeLabel:
      completed.length === 1 ? "the reviewed page" : "the reviewed pages",
  });
  return {
    executiveSummary:
      "We checked " +
      completed.length +
      " public pages selected from " +
      discovery.discoveredCount +
      " discovered URLs, and completed automated tests on " +
      tested +
      " representative page" +
      (tested === 1 ? "" : "s") +
      ". " +
      (findings.length
        ? "The priorities below address findings in this sample."
        : "No actionable issue was found in the available checks; this does not establish that every website function works."),
    keyIssues: priorities.map((f) => f.title + ": " + f.finding),
    businessImpact: unique(priorities.map((f) => f.impact)).slice(0, 3),
    recommendations,
    priorities: priorities.map((f) => ({
      title: f.title,
      finding: f.finding,
      impact: f.impact,
      action: f.action,
      tone: f.priority === "high" ? "urgent" : "important",
    })),
    findingDetails: findings,
    analyticsStatement: analytics.length
      ? "Public signals for " +
        analytics.join(", ") +
        " were detected. Tracking configuration and data quality were not verified."
      : "No identifiable analytics signal was found in the inspected HTML. This does not prove analytics is absent.",
    journeyObservations: [],
    journeyOpportunities: [],
    roadmap: {
      immediate: recommendations.slice(0, 2),
      nearTerm: recommendations.slice(2, 5),
      ongoing: [
        "Retest affected templates after changes and compare the same pages and devices.",
      ],
    },
    scopeNotes: unique([
      "This is a sample of public pages, not an exhaustive website or functional test.",
      "HTML checks inspect the downloaded source; JavaScript-rendered content may be absent. Lighthouse renders only its selected pages.",
      "Accessibility results are automated findings and require manual verification.",
      "Form submissions, payments, sign-in and backend processing were not tested.",
      ...scopeNotes,
    ]),
    ...clientNarrative,
    strengths: unique([...strengths, ...clientNarrative.strengths]).slice(0, 3),
  };
}