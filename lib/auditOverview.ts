import { scoreAvailability, primaryScoreDevice } from "./clientAuditReport";
import type { FindingDetail, Scores } from "./auditTypes";
export type OverviewHighlight = {
  key: string;
  title: string;
  detail: string;
  action: string;
};
const valid = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
export function overviewHighlights(
  findings: FindingDetail[],
  limit = 3,
): OverviewHighlight[] {
  const mapped = findings.map((f) => {
    const id = f.id.toLowerCase();
    let key = id,
      title = f.title;
    if (/first-contentful|largest-contentful|speed-index|lcp/.test(id)) {
      key = "loading";
      title = "Make page content appear sooner";
    } else if (/blocking-time|mainthread|bootup|long-tasks/.test(id)) {
      key = "responsiveness";
      title = "Help the page respond sooner";
    } else if (/layout-shift|cls/.test(id)) {
      key = "stability";
      title = "Keep content steady while loading";
    }
    return {
      key,
      title,
      detail: f.finding,
      action: f.action,
      source: f,
      category: id.split(":")[0],
    };
  });
  const selected: typeof mapped = [];
  const add = (f: (typeof mapped)[number] | undefined) => {
    if (f && selected.length < limit && !selected.some((x) => x.key === f.key))
      selected.push(f);
  };
  // Keep a supported non-performance concern visible when loading metrics dominate.
  add(mapped[0]);
  add(mapped.find((f) => f.category === "accessibility"));
  add(
    mapped.find((f) =>
      ["seo", "best-practices", "page-structure"].includes(f.category),
    ),
  );
  mapped.forEach(add);
  return selected.map(({ key, title, detail, action }) => ({
    key,
    title,
    detail,
    action,
  }));
}
export function suggestedOverview(
  scores: Scores,
  highlights: OverviewHighlight[],
): string {
  const readings = [
    ["mobile", scores.mobile?.performance],
    ["desktop", scores.desktop?.performance],
  ] as const;
  const available = readings.filter(
    (entry): entry is readonly ["mobile" | "desktop", number] =>
      valid(entry[1]),
  );
  const first = available.length
    ? "This page scored " +
      available
        .map(([device, value]) => value + "/100 for " + device + " performance")
        .join(" and ") +
      " in this automated test."
    : "This review covers the available automated checks for one public page.";
  if (!highlights.length)
    return (
      first +
      " No actionable finding was returned by these checks; manual review is still needed."
    );
  const names = highlights.map(
    (h) => h.title.charAt(0).toLowerCase() + h.title.slice(1),
  );
  const joined =
    names.length === 1
      ? names[0]
      : names.slice(0, -1).join(", ") + " and " + names.at(-1);
  return first + " The findings suggest practical next steps: " + joined + ".";
}
export function overviewScoreItems(scores: Scores) {
  const device = primaryScoreDevice(scores);
  const primary = scores[device];
  return [
    {
      label: "Mobile performance",
      value: scores.mobile?.performance,
      kind: "performance",
    },
    {
      label: "Desktop performance",
      value: scores.desktop?.performance,
      kind: "performance",
    },
    { label: "Search checks", value: primary?.seo, kind: "checks" },
    {
      label: "Accessibility checks",
      value: primary?.accessibility,
      kind: "checks",
    },
    {
      label: "Technical best practices",
      value: primary?.bestPractices,
      kind: "checks",
    },
  ].map((item) => ({
    ...item,
    value: valid(item.value) ? item.value : null,
    device: item.kind === "checks" ? device : null,
    availability: scoreAvailability(
      scores,
      item.label === "Mobile performance"
        ? "mobile"
        : item.label === "Desktop performance"
          ? "desktop"
          : device,
      item.label === "Search checks"
        ? "seo"
        : item.label === "Accessibility checks"
          ? "accessibility"
          : item.label === "Technical best practices"
            ? "bestPractices"
            : "performance",
    ),
    meaning: !valid(item.value)
      ? scoreAvailability(
          scores,
          item.label === "Mobile performance"
            ? "mobile"
            : item.label === "Desktop performance"
              ? "desktop"
              : device,
          item.label === "Search checks"
            ? "seo"
            : item.label === "Accessibility checks"
              ? "accessibility"
              : item.label === "Technical best practices"
                ? "bestPractices"
                : "performance",
        ).label
      : item.kind === "performance"
        ? item.value >= 90
          ? "Strong result in this test"
          : item.value >= 50
            ? "Room to improve"
            : "Needs attention"
        : item.value === 100
          ? "Scored checks passed"
          : "Some checks need review",
    colour: !valid(item.value)
      ? "#64748b"
      : item.value >= 90
        ? "#15803d"
        : item.value >= 50
          ? "#a16207"
          : "#be123c",
  }));
}
