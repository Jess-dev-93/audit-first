import { sourceFindings } from "./auditPageChecks";
import { inspectPageLinks, brokenLinkFinding } from "./auditLinks";
import { safeFetchText, resolvePublicUrl } from "./auditFetch";
import { parsePage } from "./auditHtml";
import { detectTechStack } from "./techStack";
import { buildPageReport, compareFindings, isScore } from "./auditReport";
const categories = {
  performance: "Performance",
  seo: "SEO",
  accessibility: "Accessibility",
  "best-practices": "Best Practices",
};
const number = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const clean = (v) =>
  String(v || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
const emptyScores = () => ({
  performance: null,
  seo: null,
  accessibility: null,
  bestPractices: null,
});
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function itemEvidence(item, depth = 0, maxItems = 3) {
  if (!item || typeof item !== "object" || depth > 2) return null;
  const result = {};
  for (const key of [
    "url",
    "source",
    "label",
    "selector",
    "resourceType",
    "reason",
    "name",
    "explanation",
    "failureSummary",
    "phase",
    "subpart",
    "percent",
    "type",
  ])
    if (typeof item[key] === "string") result[key] = item[key].slice(0, 500);
  for (const key of [
    "transferSize",
    "totalBytes",
    "wastedBytes",
    "wastedMs",
    "duration",
    "cacheLifetimeMs",
    "totalTime",
    "startTime",
    "timing",
    "value",
  ])
    if (number(item[key]) !== null) result[key] = item[key];
  if (item.node) {
    result.node = {};
    for (const key of ["selector", "nodeLabel", "snippet"])
      if (typeof item.node[key] === "string")
        result.node[key] = clean(item.node[key]).slice(0, 400);
  }
  if (Array.isArray(item.headings))
    result.headings = item.headings
      .slice(0, 8)
      .map((h) =>
        Object.fromEntries(
          ["key", "valueType", "label"]
            .filter((k) => typeof h[k] === "string")
            .map((k) => [k, clean(h[k]).slice(0, 200)]),
        ),
      );
  const children = item.subItems?.items || item.items;
  if (Array.isArray(children))
    result.items = children
      .slice(0, maxItems)
      .map((x) => itemEvidence(x, depth + 1, maxItems))
      .filter(Boolean);
  return Object.keys(result).length ? result : null;
}
export function extractLoadingDiagnostics(data) {
  const audits = data?.lighthouseResult?.audits || {};
  const ids = [
    "lcp-breakdown-insight",
    "lcp-discovery-insight",
    "largest-contentful-paint-element",
    "lcp-lazy-loaded",
    "prioritize-lcp-image",
  ];
  const context = ids.flatMap((id) => {
    const audit = audits[id];
    if (
      !audit ||
      ["error", "notApplicable", "manual"].includes(audit.scoreDisplayMode)
    )
      return [];
    const items = (
      Array.isArray(audit.details?.items) ? audit.details.items : []
    )
      .slice(0, 8)
      .map((item) => itemEvidence(item, 0, 8))
      .filter(Boolean);
    if (!items.length) return [];
    return [
      {
        id,
        title: clean(audit.title) || id,
        displayValue: audit.displayValue || null,
        items,
      },
    ];
  });
  return {
    status: context.length ? "available" : "not-provided",
    audits: context,
    note: "Supporting diagnostic evidence, not a separate failed check or confirmed cause. Breakdown timings may use different test conditions from the headline simulated metric.",
  };
}
export function extractLighthouseEvidence(data) {
  const lh = data?.lighthouseResult || {},
    seen = new Set(),
    findings = [];
  for (const [category, categoryLabel] of Object.entries(categories))
    for (const ref of lh.categories?.[category]?.auditRefs || []) {
      const audit = lh.audits?.[ref.id],
        key = category + ":" + ref.id;
      if (!audit || seen.has(key)) continue;
      seen.add(key);
      const mode = audit.scoreDisplayMode,
        score = number(audit.score),
        savingsMs = number(audit.details?.overallSavingsMs),
        savingsBytes = number(audit.details?.overallSavingsBytes);
      if (["manual", "notApplicable", "error"].includes(mode)) continue;
      // Informative diagnostics are retained only when they report explicit savings.
      const diagnostic = score === null || mode === "informative";
      if (diagnostic && !(savingsMs > 0 || savingsBytes > 0)) continue;
      if (!diagnostic && score >= 0.9) continue;
      const items = Array.isArray(audit.details?.items)
        ? audit.details.items
        : [];
      const weight = number(ref.weight) || 0;
      const priority =
        savingsMs >= 1000 ||
        savingsBytes >= 500000 ||
        (weight >= 10 && score !== null && score < 0.5) ||
        (category === "accessibility" && score === 0)
          ? "high"
          : (score !== null && score < 0.5) || weight >= 3 || savingsMs >= 250
            ? "medium"
            : "low";
      findings.push({
        id: ref.id,
        category,
        categoryLabel,
        title: clean(audit.title) || ref.id,
        description: clean(audit.description),
        score: score === null ? null : Math.round(score * 100),
        rawScore: score,
        scoreDisplayMode: mode,
        diagnostic,
        displayValue: audit.displayValue || null,
        numericValue: number(audit.numericValue),
        numericUnit: audit.numericUnit || null,
        weight,
        savingsMs,
        savingsBytes,
        affectedItemCount: items.length,
        items: items
          .slice(0, 5)
          .map((x) => itemEvidence(x))
          .filter(Boolean),
        priority,
      });
    }
  findings.sort(compareFindings);
  return {
    loadingDiagnostics: extractLoadingDiagnostics(data),
    findings,
    topFindings: findings.slice(0, 10),
    totalFindings: findings.length,
  };
}
export function extractScores(data) {
  const c = data?.lighthouseResult?.categories || {},
    score = (key) => {
      const value = number(c[key]?.score);
      return value !== null && value >= 0 && value <= 1
        ? Math.round(value * 100)
        : null;
    };
  return {
    performance: score("performance"),
    seo: score("seo"),
    accessibility: score("accessibility"),
    bestPractices: score("best-practices"),
  };
}
function extractDetails(data, url) {
  const lh = data.lighthouseResult,
  
    a = lh.audits || {},
    result = {};
  const keys = {
    interactive: "interactive",
    firstContentfulPaint: "first-contentful-paint",
    largestContentfulPaint: "largest-contentful-paint",
    totalBlockingTime: "total-blocking-time",
    cumulativeLayoutShift: "cumulative-layout-shift",
    speedIndex: "speed-index",
    totalByteWeight: "total-byte-weight",
  };
  result.metrics = {};
  for (const [key, id] of Object.entries(keys)) {
    result[key] = a[id]?.displayValue || "Not available";
    result.metrics[key] = {
      value: number(a[id]?.numericValue),
      unit: a[id]?.numericUnit || null,
    };
  }
  result.loadTime = result.interactive;
  for (const [key, id] of [
    ["hasMetaDescription", "meta-description"],
    ["hasTitle", "document-title"],
    ["fontSizeOk", "font-size"],
    ["tapTargetsOk", "tap-targets"],
  ]) {
    const audit = a[id],
      score = number(audit?.score);
    result[key] =
      score === null ||
      ["manual", "notApplicable", "informative", "error"].includes(
        audit?.scoreDisplayMode,
      )
        ? null
        : score >= 0.9;
  }
  result.isHttps =
    new URL(lh.finalDisplayedUrl || lh.finalUrl || url).protocol === "https:";
  return result;
}
export async function requestPageSpeed(
  url,
  strategy,
  { deadline = Date.now() + 95000, signal, fetchImpl = fetch } = {},
) {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) throw new Error("PageSpeed is not configured on this server.");
  const endpoint = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
  );
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("key", apiKey);
  Object.keys(categories).forEach((category) =>
    endpoint.searchParams.append("category", category),
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 1500 || signal?.aborted)
      throw new Error("Lighthouse testing reached the scan time limit.");
    const timed = AbortSignal.timeout(Math.min(45000, remaining)),
      combined = signal ? AbortSignal.any([signal, timed]) : timed;
    let retry = false;
    try {
      const response = await fetchImpl(endpoint.toString(), {
        signal: combined,
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.error) {
        retry = [408, 429].includes(response.status) || response.status >= 500;
        if (!retry || attempt === 1)
          throw new Error(
            "PageSpeed could not complete the " +
              strategy +
              " test (HTTP " +
              response.status +
              ").",
          );
      } else if (
        !data?.lighthouseResult ||
        data.lighthouseResult.runtimeError
      ) {
        retry = true;
        if (attempt === 1)
          throw new Error(
            "Lighthouse could not render the " + strategy + " page.",
          );
      } else if (!Object.values(extractScores(data)).some(isScore)) {
        throw new Error("Lighthouse returned no usable category scores.");
      } else {
  if (process.env.PAGESPEED_DEBUG === "1") {
    try {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const path = await import("node:path");

      const folder = path.join(tmpdir(), "auditunfold-pagespeed-debug");
      await mkdir(folder, { recursive: true });

      const filename = path.join(
        folder,
        `${strategy}-${Date.now()}.json`,
      );

      await writeFile(filename, JSON.stringify(data, null, 2), "utf8");
      console.info("[PageSpeed debug file]", filename);
    } catch (error) {
      console.warn("[PageSpeed debug] Could not save response:", error);
    }
  }

  return data;
}
    } catch (error) {
      if (signal?.aborted) throw new Error("Lighthouse testing was cancelled.");
      retry =
        retry ||
        ["TimeoutError", "AbortError", "TypeError"].includes(error?.name);
      if (!retry || attempt === 1) throw error;
    }
    if (deadline - Date.now() < 2000)
      throw new Error("Lighthouse testing reached the scan time limit.");
    await pause(1000);
  }
}
export async function getLighthouseScores(
  url,
  {
    quick = false,
    deadline = Date.now() + 95000,
    signal,
    fetchImpl = fetch,
    validateUrl = resolvePublicUrl,
    allowUnavailable = false,
  } = {},
) {
  let validationTimer;
  try {
    await Promise.race([
      validateUrl(url),
      new Promise((_, reject) => {
        validationTimer = setTimeout(
          () => reject(new Error("Website address validation timed out.")),
          Math.max(1, Math.min(10000, deadline - Date.now())),
        );
      }),
    ]);
  } finally {
    clearTimeout(validationTimer);
  }
  const devices = quick ? ["mobile"] : ["mobile", "desktop"];
  const runs = await Promise.allSettled(
    devices.map((device) =>
      requestPageSpeed(url, device, { deadline, signal, fetchImpl }),
    ),
  );
  const scores = {
    mobile: emptyScores(),
    desktop: quick ? null : emptyScores(),
    evidence: { mobile: null, desktop: null },
    details: { mobile: null, desktop: null },
    runs: {},
    overallScore: null,
  };
  if (quick) scores.runs.desktop = { status: "not-requested" };
  let succeeded = 0;
  for (let index = 0; index < devices.length; index++) {
    const device = devices[index],
      run = runs[index];
    if (run.status === "rejected") {
      scores.runs[device] = {
        status: "failed",
        error: run.reason?.message || "Test unavailable",
      };
      continue;
    }
    const data = run.value,
      lh = data.lighthouseResult;
      console.info(
  "[Lighthouse score check]",
  JSON.stringify(
    {
      device,
      testedUrl: lh.finalDisplayedUrl || lh.finalUrl || url,
      testedAt: lh.fetchTime,
      lighthouseVersion: lh.lighthouseVersion,
      googleScores: Object.fromEntries(
        Object.keys(categories).map((category) => [
          category,
          lh.categories?.[category]?.score ?? null,
        ]),
      ),
      convertedScores: extractScores(data),
      configSettings: lh.configSettings,
    },
    null,
    2,
  ),
);
    succeeded++;
    scores[device] = extractScores(data);
    scores.evidence[device] = extractLighthouseEvidence(data);
    scores.details[device] = extractDetails(data, url);
    scores.runs[device] = {
      status: "complete",
      testedAt: lh.fetchTime || new Date().toISOString(),
      lighthouseVersion: lh.lighthouseVersion || null,
      configSettings: lh.configSettings || null,
environment: lh.environment || null,
sourceCategoryScores: Object.fromEntries(
  Object.keys(categories).map((category) => [
    category,
    lh.categories?.[category]?.score ?? null,
  ]),
),
      finalUrl: lh.finalDisplayedUrl || lh.finalUrl || url,
      warnings: Array.isArray(lh.runWarnings)
        ? lh.runWarnings.slice(0, 8).map(clean)
        : [],
    };
  }
  
  if (!succeeded && !allowUnavailable)
    throw new Error("No Lighthouse test completed. Try again later.");
  const main = scores.details.mobile || scores.details.desktop || {};
  scores.details = {
    ...main,
    mobile: scores.details.mobile,
    desktop: scores.details.desktop,
  };
  const mobileValues = Object.values(scores.mobile);
  scores.overallScore = mobileValues.every(isScore)
    ? Math.round(mobileValues.reduce((a, b) => a + b, 0) / 4)
    : null;
  scores.status = succeeded === devices.length ? "complete" : "partial";
  return scores;
}
export function buildIssuesList(scores) {
  return buildPageReport("", scores).keyIssues;
}
export function generateFallbackReport(url, scores) {
  return buildPageReport(url, scores);
}
// Compatibility export: report wording is deterministic and grounded in the retained evidence.
export async function generateAIReport(url, scores) {
  return buildPageReport(url, scores);
}
export async function runPageAudit(
  url,
  {
    quick = false,
    generateAi = true,
    inspectPage = true,
    checkLinks = true,
    fetchSource = safeFetchText,
    ...options
  } = {},
) {
  const [scores, snapshot] = await Promise.all([
    getLighthouseScores(url, { quick, ...options, allowUnavailable: true }),
    inspectPage
      ? fetchSource(url, { deadline: options.deadline }).catch(() => null)
      : Promise.resolve(null),
  ]);
  const valid =
    snapshot &&
    snapshot.status >= 200 &&
    snapshot.status < 300 &&
    !snapshot.truncated &&
    /html/i.test(snapshot.headers["content-type"]);
  const page = valid
    ? parsePage(snapshot.buffer, snapshot.url, snapshot.headers)
    : null;
  scores.sourceCheckStatus = !inspectPage
    ? "not-requested"
    : page
      ? "complete"
      : "unavailable";
  scores.pageFindings = page
    ? sourceFindings([{ ...page, url, finalUrl: snapshot.url, status: "ok" }])
    : [];
  if (page && checkLinks) {
    const links = await inspectPageLinks(
      { ...page, url, finalUrl: snapshot.url, httpStatus: snapshot.status },
      {
        deadline: Math.min(options.deadline || Infinity, Date.now() + 8000),
      },
    );
    const finding = brokenLinkFinding(links);
    if (finding) scores.pageFindings.push(finding);
    scores.linkCoverage = { ...links, checks: undefined };
  }
  if (
    inspectPage &&
    !page &&
    !["mobile", "desktop"].some((device) =>
      Object.values(scores[device] || {}).some(isScore),
    )
  )
    throw new Error(
      "Neither Lighthouse nor public HTML inspection completed. Try again later.",
    );
  return {
    scores,
    techStack: valid ? detectTechStack(snapshot.text, snapshot.headers) : null,
    pageTitle: page?.title || null,
    aiReport: generateAi ? buildPageReport(url, scores) : null,
  };
}