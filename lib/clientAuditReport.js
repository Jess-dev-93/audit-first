/* Translate retained evidence into client concerns. Never infer design quality,
   tracking configuration, backend success, revenue loss or search rankings. */
const list = (v) => (Array.isArray(v) ? v : []);
const valid = (v) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
const unique = (v) => [...new Set(v.filter(Boolean))];
const themes = {
  loading: {
    title: "Show your content sooner",
    goal: "show useful content sooner",
    observation: "Testing flagged delays in how page content appears.",
    impact: "Visitors may spend longer waiting before they can read the page.",
    help: "We can identify what delays the content, improve how it loads and repeat the same checks.",
  },
  stability: {
    title: "Keep your page steady",
    goal: "keep content steady while loading",
    observation: "Testing flagged movement of page content during loading.",
    impact:
      "Moving content can interrupt reading or make links harder to select.",
    help: "We can find the elements causing movement, adjust their layout or loading and check the result.",
  },
  interaction: {
    title: "Make browsing feel smoother",
    goal: "make the page respond more smoothly",
    observation:
      "Testing flagged processing that can delay the page’s response during loading.",
    impact:
      "Visitors may have to wait before the page responds to their actions.",
    help: "We can identify unnecessary processing, reduce it where practical and retest responsiveness.",
  },
  accessibility: {
    title: "Make your content easier to use",
    goal: "make content easier to use",
    observation:
      "Automated checks flagged elements that need an accessibility review.",
    impact:
      "Some visitors may find the affected content or controls difficult to read, identify or use.",
    help: "We can manually check the flagged elements, fix confirmed barriers and test them again.",
  },
  search: {
    title: "Make your pages clearer to search engines",
    goal: "clarify how pages are described to search engines",
    observation:
      "Checks found page information or structure that needs review.",
    impact:
      "Unclear page information can make individual pages harder to identify or present accurately.",
    help: "We can review the affected page information, correct confirmed gaps and verify the changes.",
  },
  links: {
    title: "Help visitors reach the right pages",
    goal: "repair missing destinations",
    observation: "Checked internal links returned a missing-page response.",
    impact: "Visitors following those links may reach a dead end.",
    help: "We can correct the links or restore or redirect the missing pages, then check the destinations again.",
  },
  contact: {
    title: "Make email contact details consistent",
    goal: "correct inconsistent email details",
    observation:
      "A displayed email address differs from the address its link opens.",
    impact:
      "Visitors may contact a different address from the one they expected.",
    help: "We can confirm the intended email address, align the visible text and link, and check what opens.",
  },
  mobile: {
    title: "Check how the page fits mobile screens",
    goal: "improve the mobile display settings",
    observation:
      "The inspected source did not include a mobile viewport setting.",
    impact:
      "The page may not display at the intended width on smaller screens.",
    help: "We can check the rendered page on mobile and correct its display settings where needed.",
  },
  reliability: {
    title: "Review browser-reported issues",
    goal: "address browser-reported issues",
    observation: "Automated browser checks reported issues worth reviewing.",
    impact:
      "Their effect on visitors depends on the specific issue and needs verification.",
    help: "We can investigate the reported issues, confirm which affect visitors and fix those that do.",
  },
  general: {
    title: "Review the flagged page issue",
    goal: "review the flagged page issue",
    observation:
      "An automated check returned a finding that needs verification.",
    impact: "Its effect on visitors should be confirmed before choosing a fix.",
    help: "We can review the evidence, confirm the user impact and agree on a targeted improvement.",
  },
};
function themeFor(f) {
  const id = String(f.auditId || f.id || "").toLowerCase(),
    cat = f.category || String(f.id || "").split(":")[0];
  if (/broken-internal-links/.test(id)) return "links";
  if (/email-label-mismatch/.test(id)) return "contact";
  if (/missing-viewport/.test(id)) return "mobile";
  if (cat === "accessibility" || /missing-image-alt|missing-language/.test(id))
    return "accessibility";
  if (
    cat === "seo" ||
    /missing-title|meta-description|duplicate-title|missing-h1|invalid-schema/.test(
      id,
    )
  )
    return "search";
  if (/layout-shift|cls/.test(id)) return "stability";
  if (
    /blocking-time|mainthread|bootup|long-tasks|forced-reflow|interactive|max-potential-fid/.test(
      id,
    )
  )
    return "interaction";
  if (
    cat === "performance" ||
    /contentful|speed-index|lcp|loading-experience/.test(id)
  )
    return "loading";
  if (cat === "best-practices") return "reliability";
  return "general";
}
const auditId = (f) =>
  f.auditId ||
  String(f.id || "")
    .split(":")
    .at(-1);
const issueLabels = {
  "color-contrast": "text and background colour contrast",
  "link-name": "links without clear accessible names",
  "button-name": "buttons without clear accessible names",
  "image-alt": "images without alternative descriptions",
  "missing-image-alt": "images without alt attributes",
  "html-has-lang": "the page language declaration",
  "missing-language": "the page language declaration",
  "heading-order": "the heading order",
  "label-content-name-mismatch":
    "controls whose accessible names do not match their visible labels",
  label: "input labels",
  "aria-allowed-role": "accessibility roles used on unsuitable elements",
  "aria-input-field-name": "input fields without accessible names",
  "aria-toggle-field-name": "toggle controls without accessible names",
  "aria-command-name": "interactive controls without accessible names",
  "aria-required-attr": "missing required accessibility attributes",
  "aria-required-children":
    "missing required elements within accessibility roles",
  "aria-required-parent":
    "accessibility roles without their required parent elements",
  "aria-roles": "invalid accessibility roles",
  "aria-tooltip-name": "tooltips without accessible names",
  "aria-dialog-name": "dialogs without accessible names",
  "duplicate-id-aria": "duplicate identifiers used by accessibility attributes",
  "frame-title": "embedded frames without descriptive titles",
  "select-name": "selection controls without accessible names",
  "meta-viewport": "settings that may restrict mobile zoom",
  "aria-valid-attr": "invalid accessibility attributes",
  "aria-valid-attr-value": "invalid accessibility attribute values",
  "aria-allowed-attr": "accessibility attributes used on unsuitable elements",
  "aria-hidden-focus": "focusable controls hidden from assistive technology",
  "target-size": "controls that may be difficult to tap",
  "tap-targets": "controls that may be difficult to tap",
  "meta-description": "missing search descriptions",
  "missing-meta-description": "missing search descriptions",
  "duplicate-meta-description": "repeated search descriptions",
  "document-title": "missing document titles",
  "missing-title": "missing document titles",
  "duplicate-title": "repeated document titles",
  "missing-h1": "missing primary headings",
  "invalid-schema": "unreadable structured page information",
};
function describeConcern(g) {
  const ids = g.findings.map(auditId);
  const labels = unique(
    g.findings.map(
      (f) =>
        issueLabels[auditId(f)] ||
        (g.key === "accessibility" ||
        g.key === "search" ||
        g.key === "reliability"
          ? f.technicalTitle || f.title
            ? "the recorded check “" + (f.technicalTitle || f.title) + "”"
            : null
          : null),
    ),
  ).slice(0, 3);
  if (labels.length)
    g.observation = "Checks flagged " + labels.join("; ") + ".";
  if (g.key === "accessibility") {
    const additional = g.findings.some(
      (f) =>
        f.scoreNote ||
        (list(f.evidence).length &&
          list(f.evidence).every((e) => e.scoringWeight === 0)),
    );
    if (additional)
      g.observation +=
        " Includes additional checks outside the displayed accessibility score.";
    const impacts = [];
    if (ids.includes("color-contrast"))
      impacts.push("Some text may be difficult to read against its background");
    if (ids.some((id) => ["link-name", "button-name"].includes(id)))
      impacts.push(
        "Visitors using screen readers may not know what a link or button does",
      );
    if (ids.includes("label-content-name-mismatch"))
      impacts.push(
        "Visitors using voice control may struggle to select controls by their visible names",
      );
    if (ids.includes("heading-order"))
      impacts.push("Navigating by headings may be harder with a screen reader");
    if (ids.some((id) => ["image-alt", "missing-image-alt"].includes(id)))
      impacts.push(
        "Visitors using screen readers may miss information conveyed by images",
      );
    if (impacts.length) g.impact = impacts.slice(0, 2).join(". ") + ".";
    const actionLabels = {
      "label-content-name-mismatch":
        "match control names to their visible labels",
      "heading-order": "correct the heading order",
      "color-contrast": "improve text contrast",
      "image-alt": "add appropriate image descriptions",
      "missing-image-alt": "add appropriate image descriptions",
      "link-name": "give links clear accessible names",
      "button-name": "give buttons clear accessible names",
    };
    const fixes = unique(
      ids.map(
        (id) =>
          actionLabels[id] ||
          (issueLabels[id] ? "review " + issueLabels[id] : null),
      ),
    ).slice(0, 3);
    g.help =
      "We can check the affected elements, " +
      (fixes.length
        ? fixes.join(" and ")
        : "correct confirmed accessibility barriers") +
      ", then repeat automated and manual testing.";
  }
  return g;
}
export function clientConcerns(findings, limit = 3) {
  const groups = new Map(),
    rank = { high: 3, medium: 2, low: 1, review: 0 };
  for (const f of list(findings)) {
    if (f.priority === "review" || /^(interactive|max-potential-fid)$/.test(auditId(f))) continue;
    const key = themeFor(f);
    if (!groups.has(key))
      groups.set(key, {
        key,
        ...themes[key],
        priority: f.priority || "low",
        findings: [],
        affectedUrls: [],
      });
    const g = groups.get(key);
    g.findings.push(f);
    g.affectedUrls = unique([...g.affectedUrls, ...list(f.affectedUrls)]);
    if ((rank[f.priority] || 0) > (rank[g.priority] || 0))
      g.priority = f.priority;
  }
  const ranked = [...groups.values()].sort(
    (a, b) =>
      (rank[b.priority] || 0) - (rank[a.priority] || 0) ||
      b.affectedUrls.length - a.affectedUrls.length,
  );
  const selected = [];
  const add = (g) => {
    if (g && selected.length < limit && !selected.includes(g)) selected.push(g);
  };
  add(ranked[0]);
  add(ranked.find((g) => g.key === "accessibility"));
  add(ranked.find((g) => g.key === "links"));
  ranked.forEach(add);
  return selected
    .map(describeConcern)
    .sort((a, b) => (rank[b.priority] || 0) - (rank[a.priority] || 0));
}
export function buildClientNarrative(
  findings,
  { pages = [], scopeLabel = "the reviewed page" } = {},
) {
  const concerns = clientConcerns(findings),
    strengths = [];
  const scored = list(pages).filter((p) => p.scores);
  const allScores = (key) =>
    scored
      .flatMap((p) => ["mobile", "desktop"].map((d) => p.scores?.[d]?.[key]))
      .filter(valid);
  const performance = allScores("performance"),
    seo = allScores("seo"),
    accessibility = allScores("accessibility");
  if (performance.length && performance.every((v) => v >= 90))
    strengths.push(
      "The tested pages returned strong automated loading-performance scores.",
    );
  if (seo.length && seo.every((v) => v >= 90))
    strengths.push(
      "The scored automated search checks returned strong results.",
    );
  if (accessibility.length && accessibility.every((v) => v === 100))
    strengths.push(
      "The scored automated accessibility checks passed. Additional and manual checks may still be needed.",
    );
  if (
    seo.length &&
    accessibility.length &&
    seo.every((v) => v === 100) &&
    accessibility.every((v) => v === 100)
  ) {
    const retained = strengths.filter(
      (s) =>
        !s.includes("search checks") && !s.includes("accessibility checks"),
    );
    strengths.splice(
      0,
      strengths.length,
      ...retained,
      "The page passed the automated search and accessibility checks included in this scan. A manual review can check areas these tests do not covered. Additional and manual checks may still find issues.",
    );
  }
  const topicNames = {
    loading: "loading speed",
    stability: "page stability",
    interaction: "responsiveness",
    accessibility: "ease of use",
    search: "page information for search",
    links: "link destinations",
    contact: "email contact details",
    mobile: "mobile display settings",
    reliability: "technical reliability",
    general: "the flagged page issue",
  };
  const goals = concerns.map((c) => topicNames[c.key] || c.goal),
    joined =
      goals.length < 2
        ? goals[0]
        : goals.slice(0, -1).join(", ") + " and " + goals.at(-1);
  const summary = concerns.length
    ? "The review found opportunities to improve " +
      joined +
      " on " +
      scopeLabel +
      ". We can investigate the recorded issues, make focused improvements and retest."
    : "No actionable issue was returned by the available automated checks for " +
      scopeLabel +
      ". A manual review can help assess areas these checks do not cover.";
  return {
    executiveSummary: summary,
    strengths,
    keyIssues: concerns.map((c) => c.title + ": " + c.observation),
    businessImpact: concerns.map((c) => c.title + ": " + c.impact),
    recommendations: concerns.map((c) => c.title + ": " + c.help),
    priorities: concerns.map((c) => ({
      title: c.title,
      finding: c.observation,
      impact: c.impact,
      action: c.help,
      tone: c.priority === "high" ? "urgent" : "important",
    })),
    clientNextStep: concerns.length
      ? "Start with “" +
        concerns[0].title.toLowerCase() +
        "”, confirm the cause and necessary work, then retest " +
        scopeLabel +
        "."
      : "Confirm the website’s main visitor tasks and choose any additional manual review from those needs.",
  };
}
function split(value) {
  const text = String(value || "").trim(),
    at = text.indexOf(": ");
  return at > 0
    ? { title: text.slice(0, at), text: text.slice(at + 2) }
    : { title: null, text };
}
export function clientEvidenceLines(findings) {
  const labels = {
    "first-contentful-paint": "First visible content",
    "largest-contentful-paint": "Main content visible",
    "speed-index": "Visual loading",
    "cumulative-layout-shift": "Content movement score",
    "total-blocking-time": "Processing that blocks interaction",
  };
  const preferred = [...list(findings)].sort(
    (a, b) =>
      Number(String(b.auditId || b.id).includes("largest-contentful-paint")) -
      Number(String(a.auditId || a.id).includes("largest-contentful-paint")),
  );
  const entries = preferred.flatMap((f) =>
    list(f.evidence)
      .map((e) => {
        const element = list(e.items)
          .map((item) => item.node?.nodeLabel || item.label)
          .find(Boolean);
        const value =
          e.displayValue ||
          (element
            ? "Affected element: " + String(element).slice(0, 100)
            : typeof e.affectedItemCount === "number" && e.affectedItemCount > 0
              ? e.affectedItemCount + " returned evidence item(s)"
              : e.url
                ? "Flagged in recorded evidence"
                : null);
        if (!value) return null;
        const id =
          f.auditId ||
          String(f.id || "")
            .split(":")
            .at(-1);
        const label =
          labels[id] || issueLabels[id] || f.title || "Recorded check";
        const line =
          id === "broken-internal-links"
            ? "Missing destination: " + e.url + " (" + value + ")"
            : label +
              ": " +
              value +
              " · " +
              (e.device || "Source HTML") +
              " · " +
              e.url;
        return { url: e.url, line };
      })
      .filter(Boolean),
  );
  // Prefer two distinct pages before showing another device on the same page.
  const selected = [],
    seen = new Set();
  for (const entry of entries)
    if (!seen.has(entry.url)) {
      selected.push(entry.line);
      seen.add(entry.url);
    }
  for (const entry of entries)
    if (!selected.includes(entry.line)) selected.push(entry.line);
  return selected.slice(0, 2);
}
export function siteScoreItems(pages) {
  return [
    ["Mobile performance average", "mobile", "performance"],
    ["Desktop performance average", "desktop", "performance"],
    ["Search checks average", "mobile", "seo"],
    ["Accessibility checks average", "mobile", "accessibility"],
    ["Technical best practices average", "mobile", "bestPractices"],
  ].map(([label, device, key]) => {
    const values = list(pages)
      .map((p) => p.scores?.[device]?.[key])
      .filter(valid);
    return {
      label,
      device,
      availability:
        list(pages)
          .map((p) => pageScoreAvailability(p, device, key))
          .find((s) => s.label === "Result unavailable") ||
        (list(pages).length &&
        list(pages).every(
          (p) => p.scores?.runs?.[device]?.status === "not-requested",
        )
          ? {
              label: "Not tested",
              reason: "This device test was not requested.",
            }
          : {
              label: "Not recorded",
              reason: "No available scores were recorded for this category.",
            }),
      count: values.length,
      value: values.length
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        : null,
    };
  });
}
export function linkCoverageText(coverage) {
  if (!coverage)
    return "Internal link checks: coverage was not recorded for this report.";
  if (coverage.note) return coverage.note;
  const count = coverage.verifiedCount;
  if (typeof count !== "number")
    return "Internal link checks: coverage was not recorded for this report.";
  const broken = coverage.brokenCount;
  return (
    "Internal links: " +
    count +
    (count === 1 ? " destination checked" : " destinations checked") +
    (typeof broken === "number"
      ? broken === 0
        ? "; no missing destinations found in this sample"
        : "; " +
          broken +
          (broken === 1
            ? " missing destination found"
            : " missing destinations found")
      : "; missing-destination count not recorded") +
    (coverage.unverifiedCount > 0
      ? "; " +
        coverage.unverifiedCount +
        (coverage.unverifiedCount === 1
          ? " destination unverified"
          : " destinations unverified")
      : "") +
    ". This covers a permitted sample, not every website link."
  );
}
export function scoreAvailability(scores, device, key = "performance") {
  const run = scores?.runs?.[device];
  if (valid(scores?.[device]?.[key])) return { label: "Available", reason: "" };
  if (run?.status === "not-requested")
    return {
      label: "Not tested",
      reason: "This device test was not requested.",
    };
  if (run?.status === "failed")
    return {
      label: "Result unavailable",
      reason: run.error || "The requested device test did not complete.",
    };
  if (run?.status === "complete" || scores?.[device])
    return {
      label: "Result unavailable",
      reason: "This category score was not returned.",
    };
  return {
    label: "Not recorded",
    reason: "This report does not record whether this device test ran.",
  };
}
export function pageScoreAvailability(page, device, key = "performance") {
  if (!page?.scores && page?.error)
    return {
      label: page.error.startsWith("Not started")
        ? "Not tested"
        : "Result unavailable",
      reason: page.error,
    };
  return scoreAvailability(page?.scores, device, key);
}
export function websiteDisplayName(title, url) {
  const parts = String(title || "")
    .split(/\s*[|–—]\s*|\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const first = parts.find(
    (s) => !/^(home|homepage|welcome|public website review)$/i.test(s),
  );
  if (first && first.length <= 80) return first;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return first || "Website review";
  }
}
function findReportedNode(items) {
  for (const item of list(items)) {
    if (item.node?.nodeLabel || item.node?.selector) return item.node;
    const nested = findReportedNode(item.items);
    if (nested) return nested;
  }
  return null;
}
export function loadingContextLines(findings) {
  const lines = [];
  for (const f of list(findings))
    for (const e of list(f.evidence)) {
      const diagnostic = e.loadingDiagnostics;
      if (!diagnostic) continue;
      const node = findReportedNode(
        list(diagnostic.audits).flatMap((a) => list(a.items)),
      );
      if (node?.nodeLabel)
        lines.push(
          "Reported main-content element: " +
            String(node.nodeLabel).slice(0, 120) +
            " · " +
            e.device +
            " · " +
            e.url,
        );
      else if (node?.selector)
        lines.push(
          "A main-content element selector was recorded. See loading diagnostics in the evidence view.",
        );
    }
  return unique(lines).slice(0, 1);
}
export function reviewScopeLine(pages, inspectedCount) {
  const devices = unique(
    list(pages).flatMap((p) =>
      ["mobile", "desktop"].filter((d) =>
        Object.values(p.scores?.[d] || {}).some(valid),
      ),
    ),
  );
  const tested = list(pages).filter((p) =>
    ["mobile", "desktop"].some((d) =>
      Object.values(p.scores?.[d] || {}).some(valid),
    ),
  ).length;
  return (
    (typeof inspectedCount === "number"
      ? inspectedCount +
        " public pages inspected · " +
        tested +
        " representative pages tested"
      : "Single-page review") +
    " · " +
    (devices.length
      ? devices.join(" and ") + " results available"
      : "Device tests unavailable") +
    " · Automated public-page checks"
  );
}
export function readClientSections(report = {}, findings = []) {
  const impacts = list(report.businessImpact).map(split),
    actions = list(report.recommendations).map(split),
    usedI = new Set(),
    usedA = new Set();
  const take = (items, used, title) => {
    if (!title) return "";
    const index = items.findIndex(
      (x, i) => !used.has(i) && x.title?.toLowerCase() === title.toLowerCase(),
    );
    if (index < 0) return "";
    used.add(index);
    return items[index].text;
  };
  const rows = list(report.keyIssues)
    .filter((x) => typeof x === "string" && x.trim())
    .map((value, index) => {
      const p = split(value);
      const concern = clientConcerns(findings, 99).find(
        (c) => c.title.toLowerCase() === p.title?.toLowerCase(),
      );
      return {
        loadingContext: loadingContextLines(concern?.findings || []),
        coverage: concern?.affectedUrls.length
          ? concern.affectedUrls.length +
            " reviewed " +
            (concern.affectedUrls.length === 1 ? "page" : "pages")
          : "",
        title: p.title || "Priority " + (index + 1),
        observation: p.text,
        impact: take(impacts, usedI, p.title),
        help: take(actions, usedA, p.title),
        evidence: clientEvidenceLines(
          clientConcerns(findings, 99).find(
            (c) => c.title.toLowerCase() === p.title?.toLowerCase(),
          )?.findings ||
            list(findings).filter(
              (f) => f.title?.toLowerCase() === p.title?.toLowerCase(),
            ),
        ),
      };
    });
  return {
    rows,
    remainingImpacts: impacts
      .filter((_, i) => !usedI.has(i))
      .map((x) => (x.title ? x.title + ": " + x.text : x.text))
      .filter(Boolean),
    remainingActions: actions
      .filter((_, i) => !usedA.has(i))
      .map((x) => (x.title ? x.title + ": " + x.text : x.text))
      .filter(Boolean),
  };
}

// Prefer a device with actual results. If neither has results, keep missing
// category labels tied to the requested run rather than an unrequested fallback.
export function primaryScoreDevice(scores) {
  if (Object.values(scores?.mobile || {}).some(valid)) return "mobile";
  if (Object.values(scores?.desktop || {}).some(valid)) return "desktop";
  return scores?.runs?.mobile?.status === "not-requested"
    ? "desktop"
    : "mobile";
}