import { safeFetchText } from "./auditFetch";
import { isReviewablePage } from "./siteDiscovery";
import { robotsAllows, robotsPolicy } from "./auditHtml";

// GET requests only, same-origin public pages, bounded concurrency and time.
export async function checkInternalLinks(
  pages,
  {
    origin,
    policy,
    maxLinks = 30,
    deadline = Date.now() + 8000,
    fetchPage = safeFetchText,
    knownPages = pages,
  } = {},
) {
  const permitted = (url) =>
    isReviewablePage(url, origin) && robotsAllows(url, policy);
  const targets = [
    ...new Set(pages.flatMap((p) => p.linkTargets || [])),
  ].filter(permitted);
  const selected = targets.slice(
    0,
    Math.max(0, Math.min(50, Math.floor(maxLinks))),
  );
  const known = new Map(
    knownPages.flatMap((p) => [
      [p.url, p],
      [p.finalUrl || p.url, p],
    ]),
  );
  const checks = new Array(selected.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, selected.length) }, async () => {
      while (next < selected.length) {
        const i = next++,
          url = selected[i];
        const referringPages = pages
          .filter((p) => (p.linkTargets || []).includes(url))
          .map((p) => p.finalUrl || p.url);
        try {
          const cached = known.get(url);
          if (!cached && Date.now() >= deadline) throw new Error("Time limit");
          const response =
            cached ||
            (await fetchPage(url, {
              deadline,
              timeoutMs: 4000,
              maxBytes: 32768,
              allowUrl: permitted,
            }));
          const httpStatus = response.httpStatus ?? response.status;
          checks[i] = {
            url,
            finalUrl: response.finalUrl || response.url || url,
            referringPages,
            httpStatus: typeof httpStatus === "number" ? httpStatus : null,
            status: [404, 410].includes(httpStatus)
              ? "broken"
              : typeof httpStatus === "number" &&
                  httpStatus >= 200 &&
                  httpStatus < 400
                ? "reachable"
                : "unverified",
          };
        } catch {
          checks[i] = {
            url,
            referringPages,
            httpStatus: null,
            status: "unverified",
          };
        }
      }
    }),
  );
  return {
    checks,
    eligibleCount: targets.length,
    selectedCount: selected.length,
    brokenCount: checks.filter((c) => c.status === "broken").length,
    verifiedCount: checks.filter((c) => c.status !== "unverified").length,
    unverifiedCount: checks.filter((c) => c.status === "unverified").length,
    limited: targets.length > selected.length,
  };
}

export function brokenLinkFinding(result) {
  const broken = result.checks.filter((c) => c.status === "broken");
  if (!broken.length) return null;
  const affectedUrls = [...new Set(broken.flatMap((c) => c.referringPages))];
  return {
    id: "page-structure:broken-internal-links",
    auditId: "broken-internal-links",
    title: "Help visitors reach the right pages",
    technicalTitle: "Internal destinations returning 404 or 410",
    priority: "medium",
    source: "Public link check",
    affectedUrls,
    affectedPages: affectedUrls.length,
    finding:
      broken.length +
      " checked internal destination(s) returned HTTP 404 or 410.",
    impact: "Visitors following these links may reach a missing page.",
    action:
      "Correct the links or restore or redirect the missing pages, then check the destinations again.",
    evidence: broken.map((c) => ({
      url: c.url,
      displayValue: "HTTP " + c.httpStatus,
      referringPages: c.referringPages,
    })),
  };
}

export async function inspectPageLinks(
  page,
  {
    fetchPage = safeFetchText,
    deadline = Date.now() + 8000,
    maxLinks = 20,
  } = {},
) {
  const origin = new URL(page.finalUrl || page.url).origin;
  // Unknown robots permission is a scope limitation, never a broken-link result.
  let policy;
  try {
    const response = await fetchPage(origin + "/robots.txt", {
      deadline,
      timeoutMs: 3000,
      maxBytes: 100000,
      allowUrl: (url) => new URL(url).origin === origin,
    });
    if (response.status === 404 || response.status === 410)
      policy = robotsPolicy("");
    else if (response.status === 200 && !response.truncated)
      policy = robotsPolicy(response.text);
    else throw new Error("Robots unavailable");
  } catch {
    return {
      checks: [],
      eligibleCount: 0,
      selectedCount: 0,
      verifiedCount: 0,
      unverifiedCount: 0,
      limited: true,
      note: "Internal link checks were skipped because crawler permissions could not be confirmed.",
    };
  }
  return checkInternalLinks([page], {
    origin,
    policy,
    fetchPage,
    deadline,
    maxLinks,
  });
}