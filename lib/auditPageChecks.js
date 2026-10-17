/* Shared source checks for single-page and full-site scans. Observations apply
   to downloaded HTML; they do not establish rendered or backend behaviour. */
const definitions = [
  [
    "missing-title",
    "Pages without document titles",
    "high",
    (p) => !p.title,
    "No document title was found in the downloaded HTML.",
    "Pages may be harder to identify in search results and browser tabs.",
    "Add a descriptive, distinct title to each affected page.",
  ],
  [
    "missing-meta-description",
    "Pages without meta descriptions",
    "medium",
    (p) => !p.metaDescription,
    "No meta description was found in the downloaded HTML.",
    "Search engines may choose a different page excerpt.",
    "Write a useful page-specific description where it improves search presentation.",
  ],
  [
    "missing-h1",
    "Pages without a primary heading",
    "medium",
    (p) => !p.contentLimited && p.h1Count === 0,
    "No H1 was found in the source HTML.",
    "A missing semantic heading can make page structure harder to understand.",
    "Check the rendered page and add a meaningful primary heading where needed.",
  ],
  [
    "missing-image-alt",
    "Images without alt attributes",
    "high",
    (p) => p.imagesMissingAlt > 0,
    "At least one image has no alt attribute.",
    "Image information may be unavailable to visitors using assistive technology.",
    "Describe informative images and mark decorative images with an empty alt attribute.",
  ],
  [
    "missing-language",
    "Pages without a document language",
    "medium",
    (p) => !p.langPresent,
    "No document language was found.",
    "Assistive technology may pronounce content incorrectly.",
    "Set a valid HTML language appropriate to each affected page.",
  ],
  [
    "missing-viewport",
    "Pages without a mobile viewport",
    "high",
    (p) => !p.viewportPresent,
    "No viewport declaration was found.",
    "Mobile layout may not use the intended device width.",
    "Validate the affected pages on mobile and add an appropriate viewport declaration.",
  ],
  [
    "invalid-schema",
    "Pages with unreadable JSON-LD",
    "medium",
    (p) => (p.structuredDataErrors || []).length > 0,
    "A JSON-LD block could not be parsed.",
    "Search engines may be unable to use the affected structured data.",
    "Correct the JSON syntax, then validate the schema against the page content.",
  ],
  [
    "email-label-mismatch",
    "Email links that display a different address",
    "medium",
    (p) => (p.emailLabelMismatches || []).length > 0,
    "An email address displayed in a link differs from its mailto destination.",
    "Visitors may contact a different address from the one they expected.",
    "Confirm the intended address and make the displayed address and email destination agree.",
  ],
  [
    "missing-anchor-target",
    "In-page links with no source target",
    "review",
    (p) => (p.missingAnchorTargets || []).length > 0,
    "An in-page link points to an identifier not found in the downloaded HTML.",
    "The shortcut may not reach its intended section; JavaScript may add the target later.",
    "Check the shortcut on the rendered page before correcting its target identifier.",
  ],
];
export function buildIssueSummary(pages) {
  const complete = pages.filter((p) => p.status === "ok"),
    issues = [];
  function add(key, label, severity, affected, interpretation, impact, action) {
    if (!affected.length) return;
    issues.push({
      key,
      label,
      severity,
      count: affected.length,
      denominator: complete.length,
      percentage: Math.round((affected.length / complete.length) * 100),
      affectedUrls: affected.map((p) => p.finalUrl || p.url),
      interpretation,
      impact,
      action,
      evidence: affected.map((p) => ({
        url: p.finalUrl || p.url,
        displayValue:
          key === "missing-image-alt"
            ? `${p.imagesMissingAlt} ${p.imagesMissingAlt === 1 ? "image has" : "images have"} no alt attribute`
            : interpretation,
        items:
          key === "missing-image-alt"
            ? p.missingAltItems || []
            : key === "invalid-schema"
              ? (p.structuredDataErrors || []).map((reason) => ({ reason }))
              : key === "email-label-mismatch"
                ? p.emailLabelMismatches || []
                : key === "missing-anchor-target"
                  ? p.missingAnchorTargets || []
                  : [],
      })),
    });
  }
  for (const [key, label, severity, test, note, impact, action] of definitions)
    add(key, label, severity, complete.filter(test), note, impact, action);
  for (const [field, key, label] of [
    ["title", "duplicate-title", "Pages sharing document titles"],
    [
      "metaDescription",
      "duplicate-meta-description",
      "Pages sharing meta descriptions",
    ],
  ]) {
    const groups = new Map();
    for (const p of complete) {
      const value = String(p[field] || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
      if (value) groups.set(value, [...(groups.get(value) || []), p]);
    }
    add(
      key,
      label,
      "low",
      [...groups.values()].filter((g) => g.length > 1).flat(),
      "The same text occurs on more than one inspected page.",
      "Distinct pages may be less clearly differentiated in search results.",
      "Confirm whether these pages serve different purposes and make their metadata distinct where appropriate.",
    );
  }
  return issues;
}
export function sourceFindings(pages) {
  return buildIssueSummary(pages).map((x) => ({
    id: x.key,
    title: x.label,
    technicalTitle: x.label,
    priority: x.severity,
    category: "page-structure",
    categoryLabel: "Page checks",
    source: "Public HTML",
    finding: `${x.count} of ${x.denominator} inspected ${x.denominator === 1 ? "page" : "pages"}: ${x.interpretation}`,
    affectedPages: x.count,
    affectedUrls: x.affectedUrls,
    evidence: x.evidence,
    impact: x.impact,
    action: x.action,
  }));
}