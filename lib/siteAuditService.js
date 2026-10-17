import { checkInternalLinks, brokenLinkFinding } from "./auditLinks";
import {
  discoverSitePages,
  classifyPageType,
  isReviewablePage,
  selectRepresentativePages,
} from "./siteDiscovery";
import { safeFetchText } from "./auditFetch";
import { parsePage, robotsAllows, average, unique } from "./auditHtml";
import { runPageAudit } from "./pageAuditEngine";
import { detectTechStack } from "./techStack";
import { buildSiteReport, isScore } from "./auditReport";
export async function runWithLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(items.length, Math.max(1, limit)) },
      async () => {
        while (next < items.length) {
          const index = next++;
          results[index] = await worker(items[index], index);
        }
      },
    ),
  );
  return results;
}
export { buildIssueSummary } from "./auditPageChecks";
import { buildIssueSummary } from "./auditPageChecks";
export function summariseDeepAuditResults(results) {
  const successful = results.filter((r) =>
    ["mobile", "desktop"].some((d) =>
      Object.values(r.scores?.[d] || {}).some(isScore),
    ),
  );
  const mobile = successful.filter((r) =>
    Object.values(r.scores.mobile || {}).some(isScore),
  );
  const mean = (key) => average(mobile.map((r) => r.scores.mobile[key]));
  const home = successful.find((r) => r.pageType === "Homepage");
  return {
    attemptedCount: results.length,
    count: successful.length,
    failedCount: results.length - successful.length,
    partialCount: successful.filter((r) => r.scores.status === "partial")
      .length,
    mobileCount: mobile.length,
    desktopCount: successful.filter((r) =>
      Object.values(r.scores.desktop || {}).some(isScore),
    ).length,
    averageMobilePerformance: mean("performance"),
    averageSeo: mean("seo"),
    averageAccessibility: mean("accessibility"),
    averageBestPractices: mean("bestPractices"),
    scoreSampleCounts: Object.fromEntries(
      ["performance", "seo", "accessibility", "bestPractices"].map((key) => [
        key,
        mobile.filter((r) => isScore(r.scores.mobile[key])).length,
      ]),
    ),
    homepageDesktopPerformance: home?.scores.desktop?.performance ?? null,
  };
}
export async function runFullSiteAudit(
  inputUrl,
  {
    maxPages = 20,
    maxDeepPages = 5,
    budgetMs = 260000,
    checkLinks = true,
    discover = discoverSitePages,
    fetchPage = safeFetchText,
    auditPage = runPageAudit,
  } = {},
) {
  const started = Date.now(),
    deadline =
      started + Math.max(10000, Math.min(260000, Number(budgetMs) || 260000));
  const discovery = await discover(inputUrl, {
    maxPages,
    maxDeepPages,
    deadline: Math.min(deadline, started + 45000),
  });
  if (!discovery.success)
    return {
      success: false,
      error: discovery.error || "Website discovery could not complete.",
    };
  const { _snapshots, robotsPolicy: policy, ...publicDiscovery } = discovery;
  const permitted = (u) =>
    isReviewablePage(u, discovery.origin) && robotsAllows(u, policy);
  const snapshots = await runWithLimit(
    discovery.discoveredPages,
    4,
    async (url) => {
      try {
        const response =
          _snapshots.get(url) ||
          (await fetchPage(url, {
            deadline: Math.min(deadline, started + 85000),
            allowUrl: permitted,
          }));
        const page = {
          url,
          finalUrl: response.url,
          pageType: classifyPageType(response.url, discovery.origin),
          httpStatus: response.status,
          fetchTimeMs: response.elapsedMs,
          redirects: response.redirects,
        };
        if (
          response.status < 200 ||
          response.status >= 300 ||
          !/html/i.test(response.headers["content-type"])
        )
          return {
            ...page,
            status: "failed",
            error:
              response.status >= 400
                ? "HTTP " + response.status
                : "Not an HTML page",
          };
        const metrics = parsePage(
          response.buffer,
          response.url,
          response.headers,
        );
        return {
          ...page,
          ...metrics,
          status: response.truncated ? "partial" : "ok",
          truncated: response.truncated,
          error: response.truncated
            ? "HTML exceeded the size limit; negative checks excluded."
            : null,
          _html: response.text,
          _headers: response.headers,
        };
      } catch (error) {
        return {
          url,
          finalUrl: url,
          pageType: classifyPageType(url, discovery.origin),
          status: "failed",
          error: error.message,
          httpStatus: null,
        };
      }
    },
  );
  // Redirect aliases count once in page totals and duplicate-metadata checks.
  const aliases = [],
    seen = new Set(),
    deduplicated = [];
  for (const snapshot of snapshots) {
    if (seen.has(snapshot.finalUrl)) {
      aliases.push({ url: snapshot.url, finalUrl: snapshot.finalUrl });
      continue;
    }
    seen.add(snapshot.finalUrl);
    deduplicated.push(snapshot);
  }
  const html = deduplicated
    .filter((p) => p.status === "ok")
    .map((p) => p._html)
    .join("\n");
  const home = deduplicated.find((p) => p.pageType === "Homepage");
  const techStack = detectTechStack(html, home?._headers || {});
  const pages = deduplicated.map(({ _html, _headers, ...page }) => page);
  const usable = pages.filter((p) => p.status === "ok");
  if (!usable.length)
    return {
      success: false,
      error:
        "No complete public HTML page could be inspected. Try again later.",
      discovery: publicDiscovery,
      lightweightResults: pages,
    };
  const scope = [];
  if (aliases.length)
    scope.push(aliases.length + " redirect alias(es) were counted once.");
  const incomplete = pages.filter((p) => p.status !== "ok").length;
  if (incomplete)
    scope.push(
      incomplete +
        " selected page(s) could not be inspected completely; missing-element checks exclude them.",
    );
  const limited = usable.filter((p) => p.contentLimited).length;
  if (limited)
    scope.push(
      limited +
        " page(s) returned very little visible text; missing headings were treated as unknown.",
    );
  const links =
    checkLinks && Date.now() < deadline - 30000
      ? await checkInternalLinks(usable, {
          origin: discovery.origin,
          policy,
          knownPages: pages,
          fetchPage,
          deadline: Math.min(deadline - 30000, Date.now() + 8000),
          maxLinks: 30,
        })
      : {
          checks: [],
          selectedCount: 0,
          verifiedCount: 0,
          unverifiedCount: 0,
          limited: true,
        };
  const linkChecks = links.checks;
  const issueSummary = buildIssueSummary(pages);
  const broken = brokenLinkFinding(links);
  if (broken)
    issueSummary.push({
      key: "broken-internal-links",
      label: broken.technicalTitle,
      severity: broken.priority,
      count: broken.affectedUrls.length,
      denominator: usable.length,
      percentage: Math.round(
        (broken.affectedUrls.length / usable.length) * 100,
      ),
      affectedUrls: broken.affectedUrls,
      interpretation: broken.finding,
      impact: broken.impact,
      action: broken.action,
      evidence: broken.evidence,
    });
  if (links.unverifiedCount)
    scope.push(
      links.unverifiedCount +
        " selected link destination(s) could not be verified and were not counted as broken.",
    );
  if (links.limited)
    scope.push(
      "Internal link checks were limited to a permitted sample; additional destinations were not tested.",
    );
  const deepLimit = Math.max(
    1,
    Math.min(8, Math.floor(Number(maxDeepPages) || 5)),
  );
  const targets = selectRepresentativePages(
    usable.map((p) => p.finalUrl),
    discovery.origin,
    deepLimit,
  );
  const deepResults = await runWithLimit(targets, 2, async (url) => {
    const page = usable.find((p) => p.finalUrl === url),
      pageType = page.pageType;
    if (Date.now() > deadline - 5000)
      return {
        url,
        pageType,
        pageTitle: page.title,
        scores: null,
        error: "Not started before scan time limit.",
      };
    try {
      const result = await auditPage(url, {
        quick: false,
        generateAi: false,
        inspectPage: false,
        deadline: Math.min(deadline - 3000, Date.now() + 92000),
      });
      return {
        url,
        pageType,
        pageTitle: page.title,
        scores: result.scores,
        error: null,
      };
    } catch (error) {
      return {
        url,
        pageType,
        pageTitle: page.title,
        scores: null,
        error: error.message,
      };
    }
  });
  const deepSummary = summariseDeepAuditResults(deepResults);
  if (deepSummary.failedCount || deepSummary.partialCount)
    scope.push(
      "Lighthouse completed on " +
        deepSummary.count +
        " of " +
        deepSummary.attemptedCount +
        " selected pages; " +
        deepSummary.partialCount +
        " had one unavailable device test. Averages exclude unavailable scores.",
    );
  if (publicDiscovery.discoveryLimited)
    scope.push(
      "Discovery reached its time or candidate limit; additional pages may exist.",
    );
  scope.push(
    "Internal link checks covered " +
      links.verifiedCount +
      " verified permitted destinations. Other links were not tested.",
  );
  const noindex = usable.filter((p) => p.robotsNoindex);
  if (noindex.length)
    scope.push(
      noindex.length +
        " inspected page(s) declare noindex. Their intended search visibility was not verified; this was not counted as a failure.",
    );
  scope.push(...(publicDiscovery.warnings || []));
  const siteReport = buildSiteReport({
    discovery: publicDiscovery,
    pages,
    issueSummary,
    deepResults,
    deepSummary,
    techStack,
    scopeNotes: scope,
  });
  siteReport.linkCoverage = {
    selectedCount: links.selectedCount,
    verifiedCount: links.verifiedCount,
    unverifiedCount: links.unverifiedCount,
    brokenCount: linkChecks.filter((c) => c.status === "broken").length,
    limited: links.limited,
    ...(!links.selectedCount && links.limited
      ? { note: "Internal link checks were not completed in this run." }
      : {}),
  };
  const journeySummary = {
    pageTypes: unique(usable.map((p) => p.pageType)),
    formCount: 0,
    pagesWithForms: 0,
    pagesWithPhoneLinks: usable.filter((p) => p.phoneLinks.length).length,
    pagesWithEmailLinks: usable.filter((p) => p.emailLinks.length).length,
    newsletterPresent: false,
    accountEntryPoint: false,
    ctaLabels: unique(usable.flatMap((p) => p.ctaLabels)).slice(0, 16),
    observations: [],
    opportunities: [],
    recommendedEvents: [],
    analyticsDetected: unique([
      ...(techStack?.analytics || []),
      ...(techStack?.tagManagers || []),
    ]),
  };
  return {
    success: true,
    status:
      incomplete || deepSummary.failedCount || deepSummary.partialCount
        ? "partial"
        : "complete",
    generatedAt: new Date().toISOString(),
    discovery: publicDiscovery,
    lightweightResults: pages,
    issueSummary,
    selectedDeepAuditPages: targets,
    deepResults,
    deepSummary,
    techStack,
    journeySummary,
    siteReport,
    linkChecks,
    coverage: {
      pagesInspected: usable.length,
      pageCandidates: publicDiscovery.discoveredCount,
      linkDestinationsChecked: links.verifiedCount,
      linkDestinationsSelected: links.selectedCount,
      linkDestinationsUnverified: links.unverifiedCount,
      htmlOnly: true,
    },
    elapsedMs: Date.now() - started,
  };
}