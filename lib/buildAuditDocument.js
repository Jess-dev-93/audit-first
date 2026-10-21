import {
  readClientSections, buildClientNarrative, reviewScopeLine, siteScoreItems,
  linkCoverageText, scoreAvailability, pageScoreAvailability,
  websiteDisplayName, primaryScoreDevice,
} from './clientAuditReport';
import { asList, groupLighthouseFindings, isScore } from './auditReport';

// Shared by the existing single-page and full-site export callers.
// Keep the neighbouring .d.ts declaration and existing export/editor components.
export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const e = escapeHtml;
const strings = (value) => asList(value).filter((v) => typeof v === 'string' && v.trim());
const unique = (value) => [...new Set(value.filter(Boolean))];
const bullets = (value) => strings(value).length
  ? '<ul class="clean-list">' + strings(value).map((v) => '<li>' + e(v) + '</li>').join('') + '</ul>' : '';
const colour = (value) => !isScore(value) ? '#64748b' : value >= 90 ? '#15803d' : value >= 50 ? '#a16207' : '#be123c';
const score = (value, label = 'Not recorded') => isScore(value)
  ? '<span class="score" style="color:' + colour(value) + '">' + e(value) + '</span>'
  : '<span class="missing">' + e(label) + '</span>';
const paragraph = (label, value) => value ? '<p><strong>' + e(label) + '</strong> ' + e(value) + '</p>' : '';
function reportDate(value) {
  // Do not present today's date as the date of an undated stored scan.
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? 'Not recorded'
    : parsed.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' });
}
function reportTestTime(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;

  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Australia/Sydney',
    timeZoneName: 'short',
  }).format(date);
}

function scoreSourceNote(pages, siteReview) {
  const source =
    'Score source: Google Lighthouse via the PageSpeed Insights API.';

  const runs = pages.flatMap((page) =>
    ['mobile', 'desktop'].flatMap((device) => {
      const run = page.scores?.runs?.[device];
      const time = reportTestTime(run?.testedAt);

      if (run?.status !== 'complete' || !time) return [];

      return [{
        device,
        time,
        timestamp: new Date(run.testedAt).valueOf(),
        version: run.lighthouseVersion,
      }];
    })
  );

  let timing = 'Original test times were not recorded.';

  if (runs.length && !siteReview) {
    timing = runs.map((run) =>
      `${run.device === 'mobile' ? 'Mobile' : 'Desktop'} tested: ` +
      run.time +
      (run.version ? ` (Lighthouse ${run.version})` : '')
    ).join('; ') + '.';
  } else if (runs.length) {
    const ordered = [...runs].sort(
      (a, b) => a.timestamp - b.timestamp
    );
    const first = ordered[0];
    const last = ordered[ordered.length - 1];

    timing = first.timestamp === last.timestamp
      ? `Recorded tests: ${first.time}.`
      : `Recorded tests: ${first.time} to ${last.time}.`;
  }

  return `${source} ${timing} These are simulated lab results; ` +
    'separate runs can return different scores. HTML and link checks ' +
    'are reported separately and do not change these category scores.';
}
function pathOf(value) {
  try { const u = new URL(value); return u.pathname + u.search; } catch { return String(value || ''); }
}
function pageLabel(page) {
  const path = pathOf(page.url);
  if (path === '/') return 'Homepage';
  if (page.pageType && !/^other$|^page$/i.test(page.pageType)) return page.pageType;
  if (page.pageTitle) return page.pageTitle;
  const text = path.split('?')[0].split('/').filter(Boolean).at(-1);
  return text ? text.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (v) => v.toUpperCase()) : 'Page';
}
// Translate only known automatic wording; retain reviewer content and evidence.
function clientText(value) {
  return String(value || '')
  .replace(
  /the recorded check [“"]Links do not have descriptive text[”"]/g,
  "links whose text does not clearly describe their destination"
)
    .replace(/the recorded check [“"]Document does not have a main landmark\.[”"]/g, 'a missing main-content region for assistive navigation')
    .replace(/the recorded check [“"]robots\.txt is not valid[”"]/g, 'an issue with the file that gives search engines crawling instructions')
    .replace(/Checks flagged /g, 'The checks identified ')
    .replace(/; the heading order\./g, '; and headings that need a clearer order.')
    .replace(/missing primary headings/g, 'missing main page headings')
    .replace(/repeated search descriptions/g, 'repeated page descriptions in search metadata')
    .replace(
  /^Correct the specific reported implementation and verify it on related page templates\.$/,
  "Correct the page titles, descriptions or links identified in the search findings, then repeat the checks on affected templates."
);
}
function shortPageLabel(page) {
  const path = pathOf(page.url).toLowerCase();
  if (path === '/') return 'Homepage';
  if (/\/(?:contact|enquir)/.test(path)) return 'Contact';
  if (/\/(?:our-)?team(?:\/|$)|property-team/.test(path)) return 'Team';
  if (/\/(?:our-)?services?(?:\/|$)/.test(path)) return 'Services';
  if (/\/media(?:-|\/|$)/.test(path)) return 'Media';
  return pageLabel(page);
}
function evidenceCaption(line, pages) {
  const parts = String(line || "").split(" · ");
  const last = parts.at(-1) || "";
  let location = "";

  if (/^https?:\/\//i.test(last)) {
    const page = pages.find(
      (p) =>
        p.url === last ||
        p.url?.replace(/\/$/, "") === last.replace(/\/$/, "")
    );

    location = page ? shortPageLabel(page) : pathOf(last);
    parts.pop();
  }

  const lastPart = parts.at(-1);
  const device = /^(mobile|desktop|Source HTML)$/i.test(lastPart || "")
    ? parts.pop()
    : "";

  let detail = clientText(parts.join(" · "))
    .replace(
      /^Main content visible: /,
      "Main content appeared after "
    )
    .replace(
      /No H1 was found in the source HTML\./g,
      "No main heading was detected in the inspected HTML."
    )
    .replace(
      /the recorded check [“"]Links do not have descriptive text[”"]/g,
      "links whose text does not clearly describe their destination"
    );

  if (/Affected element:/i.test(detail)) {
    if (
      /footer-social-icons|twitter-x-logo/i.test(detail) &&
      /alternative descriptions|alt attributes/i.test(detail)
    ) {
      detail =
        "A footer social icon was flagged for a missing image description.";
    } else {
      detail = detail.replace(
        /Affected element:[\s\S]*$/i,
        "An affected element was recorded in the technical evidence."
      );
    }
  }

  detail = detail.replace(
    /: Flagged in recorded evidence$/i,
    ": identified by the recorded check"
  );

  const context = [
    location,
    device === "Source HTML" ? "HTML check" : device,
  ]
    .filter(Boolean)
    .join(", ");

  return (context ? context + ": " : "") + detail;
}
const STANDARD_SCOPE_NOTES = new Set([
  'This is a sample of public pages, not an exhaustive website or functional test.',
  'HTML checks inspect the downloaded source; JavaScript-rendered content may be absent. Lighthouse renders only its selected pages.',
  'Accessibility results are automated findings and require manual verification.',
  'Form submissions, payments, sign-in and backend processing were not tested.',
  'These are simulated page tests. Results can vary between runs and do not describe every visitor’s experience.',
  'Automated accessibility checks do not establish full accessibility compliance.',
]);
function relatedCoverage(value) {
  const match = String(value || '').match(/^(\d+) reviewed pages?$/);
  if (!match) return value;
  return match[1] === '1' ? 'Related findings on this page' : 'Related findings across ' + match[1] + ' pages';
}
function samePage(a, b) {
  try {
    const normalise = (value) => { const u = new URL(value); u.hash = ''; u.pathname = u.pathname.replace(/\/$/, '') || '/'; return u.href; };
    return normalise(a) === normalise(b);
  } catch { return a === b; }
}
function diagnosticNames(findings) {
  return asList(findings).map((finding) => {
    const id = finding.auditId || String(finding.id || '').split(':').at(-1);
    const titles = {interactive:'Time to Interactive (legacy lab diagnostic)', 'max-potential-fid':'Maximum Potential First Input Delay (legacy lab diagnostic)'};
    return titles[id] ? {...finding,title:titles[id],scoreNote:[finding.scoreNote,'Legacy lab diagnostic retained as supporting evidence; not a current interaction score.'].filter(Boolean).join(' ')} : finding;
  });
}
function pageFindings(findings, url) {
  return asList(findings).flatMap((finding) => {
    const evidence = asList(finding.evidence).filter((item) => samePage(item.url, url));
    const matched = evidence.length || asList(finding.affectedUrls).some((value) => samePage(value, url));
    return matched ? [{ ...finding, evidence, affectedUrls: [url], affectedPages: 1 }] : [];
  });
}
function cleanStrength(value) {
  // Repair the known saved legacy sentence without changing unrelated editorial copy.
  if (/areas these tests do not cover(?:\.ed|ed)\./.test(value)) {
    return 'The scored automated search and accessibility checks returned full marks. Additional checks and manual review may still identify issues.';
  }
  return value;
}
function logoValue(value) {
  return typeof value === 'string' && value.length <= 600000
    && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
}
const OPTIONS = [
  ['Focused fixes', 'A contained improvement with a clearly defined scope and outcome.'],
  ['Priority improvement package', 'A selected group of high-value page, journey or technical improvements.'],
  ['Staged website project', 'Broader website improvements delivered in agreed stages.'],
  ['Ongoing support', 'Flexible technical support, testing and continuous improvement.'],
];

export const DOCUMENT_CSS = `
*{box-sizing:border-box}
html{background:#e8edf4}body{margin:0;color:#253047;font:11pt/1.4 Arial,sans-serif}
main{width:210mm;margin:18px auto;background:#fff;box-shadow:0 8px 35px #1f15351a}
.report-page{padding:11mm 15mm 10mm}.report-page+.report-page{border-top:1px solid #e8e1f3}
.summary-header{display:grid;grid-template-columns:1.08fr 1fr;gap:18px;margin-bottom:18px;padding-bottom:15px;border-bottom:3px solid #7c3aed}
.brand-lockup{display:flex;align-items:center;gap:10px;min-height:22px;margin-bottom:9px}
.report-logo{max-width:130px;max-height:44px;object-fit:contain}.brand{font-size:8pt;font-weight:800;color:#7c3aed;letter-spacing:.12em;text-transform:uppercase}
h1{margin:0;font-size:25pt;line-height:1.08;letter-spacing:-.025em;color:#27123f}
.subtitle{margin:10px 0 0;color:#625873;font-size:11pt}
.summary-meta{align-self:start;padding:12px 14px;border-radius:8px;background:#f6f3ff;font-size:8.5pt;line-height:1.4;overflow-wrap:anywhere}
.summary-meta div+div{margin-top:7px}.summary-meta strong{display:block;color:#302044;font-size:8pt}
.kicker{margin:0 0 5px;color:#7c3aed;font-size:8pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
h2{margin:0 0 9px;color:#27123f;font-size:17pt;line-height:1.18;letter-spacing:-.025em}
h3{margin:0 0 6px;color:#302044;font-size:11.5pt;line-height:1.25}
p{margin:0 0 9px}.section{margin-bottom:19px}.section:last-child{margin-bottom:0}.lead{line-height:1.43;white-space:pre-line}
.note{font-size:8pt;line-height:1.4;color:#625873}.scope-line{margin-top:9px}.url{overflow-wrap:anywhere;font-size:7.5pt;color:#625873}
.score-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));margin:13px 0 7px;border-block:1px solid #ddd6fe}
.score-card{padding:9px 5px;text-align:center;break-inside:avoid}.score-card+.score-card{border-left:1px solid #e9e4f3}
.score-label{display:flex;align-items:center;justify-content:center;min-height:30px;font-size:7pt;line-height:1.25;letter-spacing:.045em;text-transform:uppercase;color:#625873;font-weight:700}
.score-value{margin:4px 0;font-size:20pt;line-height:1.1;font-weight:800}.score-count{font-size:7pt;color:#625873}.missing{font-size:7.5pt;line-height:1.3;color:#64748b;font-weight:500}
.strengths{padding:10px 12px;background:#faf8ff;border-left:3px solid #ddd6fe}.strengths h3{font-size:10pt}.strengths li{font-size:9pt}
.priority-grid,.finding-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 20px}
.priority-card{border-top:2px solid #ddd6fe;padding:9px 2px 3px;break-inside:avoid}.priority-card p{font-size:10pt;line-height:1.35}
.finding-card{padding:10px 11px;background:#fbfaff;border-left:3px solid #ddd6fe;break-inside:avoid}
.finding-card p{font-size:9.5pt;line-height:1.38;margin:0 0 5px}.finding-card p:last-child{margin-bottom:0}
.finding-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:8px;font-size:7pt;color:#625873}
.badge{padding:3px 7px;border-radius:99px;background:#eee8ff;color:#6531a4;font-weight:800;letter-spacing:.03em;text-transform:uppercase}
.finding-card .note{font-size:8pt;line-height:1.4;overflow-wrap:anywhere}
.keep-together{break-inside:avoid}.score-table-wrap{border:1px solid #e3dcf4;border-radius:7px;overflow:hidden}
table{width:100%;border-collapse:collapse;font-size:8pt;line-height:1.35;table-layout:fixed}
th{padding:7px 5px;background:#f5f1ff;border-bottom:2px solid #c4b5fd;color:#514760;font-size:7pt;text-align:center}
td{padding:7px 5px;border-bottom:1px solid #ebe6f5;vertical-align:top;text-align:center;overflow-wrap:anywhere}
th:first-child,td:first-child{width:29%;text-align:left}tbody tr:nth-child(even){background:#fbfaff}tbody tr:last-child td{border-bottom:0}
td .score{font-weight:800;font-variant-numeric:tabular-nums}.page-name{font-weight:700}.page-path{margin-top:3px;font-size:7pt;color:#625873;overflow-wrap:anywhere}
.roadmap-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:2px solid #ddd6fe;border-bottom:1px solid #ddd6fe}
.roadmap-card{padding:12px 11px}.roadmap-card+.roadmap-card{border-left:1px solid #e9e4f3}.roadmap-card li{font-size:9.5pt;line-height:1.4}
.clean-list{margin:0;padding:0;list-style:none}.clean-list li{position:relative;padding-left:13px;margin-bottom:7px}.clean-list li:before{position:absolute;left:0;color:#7c3aed;content:'•';font-weight:800}.clean-list li:last-child{margin-bottom:0}
.support{padding:15px;border-left:4px solid #7c3aed;border-radius:6px;background:#f7f5ff;break-inside:avoid}
.support>p{font-size:9.5pt}.engagement-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}
.engagement-card{padding:10px;background:#fff;border-radius:6px}.engagement-card h3{font-size:10.5pt}.engagement-card p{margin:0;font-size:9pt}
.scope-panel{border-top:1px solid #ddd6fe;padding-top:12px}.scope-panel .clean-list li{font-size:8pt;color:#625873}
.report-contact{padding-top:8px;margin-top:16px;border-top:1px solid #ddd6fe;color:#625873;font-size:8pt;overflow-wrap:anywhere}
.appendix .section+.section{margin-top:20px}.evidence-card{padding:12px 0;border-top:1px solid #ddd6fe;margin-bottom:12px}
.evidence-entry{margin:10px 0;padding:9px;background:#faf8ff}.evidence-entry p{font-size:9pt}
pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f8f5fb;padding:9px;font:7.5pt/1.45 ui-monospace,monospace}
h2,h3,.kicker{break-after:avoid}tr{break-inside:avoid}thead{display:table-header-group}a{color:inherit;text-decoration:none}
@page{size:A4;margin:12mm 0 14mm}
@media print{
 html,body{background:#fff}main{width:210mm;margin:0;box-shadow:none}
 .report-page{padding:0 15mm}.report-page+.report-page{border:0;break-before:page}
 .report-contact{break-inside:avoid}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
@media screen and (max-width:800px){main{width:100%;margin:0}.report-page{padding:24px}.summary-header{grid-template-columns:1fr}h1{font-size:24pt}.priority-grid,.finding-grid{grid-template-columns:1fr}.roadmap-grid{grid-template-columns:1fr}.roadmap-card+.roadmap-card{border-left:0;border-top:1px solid #e9e4f3}}
/* Compact the findings without reducing the main body text. */
.finding-grid {
  align-items: start;
  gap: 10px 16px;
}

@media print {
  .findings-page .section {
    margin-bottom: 12px;
  }

  .findings-page .finding-card {
    padding: 9px 10px;
  }

  .findings-page .finding-meta {
    margin-bottom: 6px;
  }

  .findings-page .finding-card .note {
    font-size: 7.5pt;
    line-height: 1.3;
  }

  .findings-page .page-score-section th,
  .findings-page .page-score-section td {
    padding: 5px;
  }

  .findings-page .page-score-section {
    break-inside: avoid;
  }
}

`;

export function buildAuditDocument({
  url = '', pageTitle = '', generatedAt, report = {}, scores, deepResults,
  lightweightResults = [], profile = {}, includeEvidence = true,
  typography = {}, linkCoverage, reportMode,
} = {}) {
  const fontFamily = String(typography.fontFamily || 'Arial, sans-serif').replace(/[<>{};\\]/g, '').slice(0, 400);
  const fontCss = String(typography.fontFacesCss || '').replace(/</g, '\\3c ');
  const mode = reportMode || (Array.isArray(deepResults) ? (includeEvidence ? 'technical' : 'reviewed') : 'quick');
  if (!['quick', 'reviewed', 'technical'].includes(mode)) throw new Error('Unknown report mode: ' + mode);
  const automatic = mode !== 'reviewed';
  includeEvidence = mode === 'technical';
  const siteReview = mode !== 'quick';
  const suppliedPages = asList(deepResults);
  let pages;
  if (mode === 'quick') {
    const selected = suppliedPages.find((page) => samePage(page.url, url));
    pages = scores ? [{ url, pageType: pathOf(url) === '/' ? 'Homepage' : 'Audited page', pageTitle, scores }]
      : selected ? [selected] : [];
    scores = pages[0]?.scores;
    lightweightResults = asList(lightweightResults).filter((page) => samePage(page.finalUrl || page.url, url));
  } else {
    pages = suppliedPages.length ? suppliedPages
      : scores ? [{ url, pageType: pathOf(url) === '/' ? 'Homepage' : 'Audited page', pageTitle, scores }] : [];
  }
  const retainedFindings = diagnosticNames(asList(report.findingDetails).length ? report.findingDetails : groupLighthouseFindings(pages));
  const findings = mode === 'quick' ? pageFindings(retainedFindings, url) : retainedFindings;
  const inspected = asList(lightweightResults).filter((page) => page.status === 'ok').length;
  const generated = buildClientNarrative(findings, { pages, scopeLabel: siteReview ? 'the tested pages' : 'the tested page' });
  // An automatic export must never merge the editable narrative back into scan output.
  // Recommendation fields remain stored; this selection does not mutate the report.
  const editorial = automatic ? {} : report;
  // Existing keyIssues / impacts / recommendations are authoritative editor inputs.
  // Use structured priorities only for reports that predate those editable arrays.
  const narrative = { ...generated, ...editorial };
  if (!Array.isArray(editorial.keyIssues) && asList(editorial.priorities).length) {
    narrative.keyIssues = editorial.priorities.map((p) => p.title + ': ' + (p.finding || ''));
    if (!Array.isArray(editorial.businessImpact)) narrative.businessImpact = editorial.priorities.map((p) => p.title + ': ' + (p.impact || ''));
    if (!Array.isArray(editorial.recommendations)) narrative.recommendations = editorial.priorities.map((p) => p.title + ': ' + (p.action || ''));
  }
  const client = readClientSections(narrative, findings);
  const allRows = asList(client.rows);
  const featured = allRows.slice(0, 4);
  const strengths = strings(narrative.strengths).map(cleanStrength);
  const company = websiteDisplayName(pageTitle, url);
  const logo = logoValue(profile.yourLogo);
  const contact = [profile.yourName, profile.yourCompany, profile.yourWebsite].filter(Boolean).join(' · ');
  const footer = contact ? '<footer class="report-contact">' + e(contact) + '</footer>' : '';
  const scopeLine = reviewScopeLine(pages, siteReview ? inspected : undefined)
    .replace(/\b1 public pages inspected\b/g, '1 public page inspected')
    .replace(/\b1 representative pages tested\b/g, '1 representative page tested');
  const primaryDevice = primaryScoreDevice(scores);
  const scoreItems = scores && !siteReview ? [
    ['Mobile performance', 'mobile', 'performance'], ['Desktop performance', 'desktop', 'performance'],
    ['Search checks', primaryDevice, 'seo'], ['Accessibility checks', primaryDevice, 'accessibility'],
    ['Technical best practices', primaryDevice, 'bestPractices'],
  ].map(([label, device, key]) => ({ label, value: scores[device]?.[key], count: isScore(scores[device]?.[key]) ? 1 : 0,
    availability: scoreAvailability(scores, device, key) })) : siteScoreItems(pages);
  const scoreStrip = '<div class="score-grid">' + scoreItems.map((item) =>
    '<div class="score-card"><div class="score-label">' + e(item.label) + '</div><div class="score-value">'
    + score(item.value, item.availability?.label) + '</div><div class="score-count">'
    + e(item.count ?? 0) + ((item.count ?? 0) === 1 ? ' scored page' : ' scored pages') + '</div></div>').join('') + '</div>';
  const scoreNote = scores && !siteReview
    ? 'Scores cover automated checks for this page. Search, accessibility and best-practice scores use the ' + primaryDevice + ' run.'
    : 'Averages cover the tested sample and exclude unavailable scores. Search, accessibility and best-practice averages use mobile runs; counts are shown per category.';
  const sourceNote = scoreSourceNote(pages, siteReview);
    const overviewCards = featured.map((row, i) => '<article class="priority-card"><h3>' + e(row.title)
    + '</h3><p>' + e(clientText(row.observation)) + '</p>' + '</article>').join('');
  const findingCard = (row, index) => '<article class="finding-card"><div class="finding-meta"><span class="badge">Priority '
    + (index + 1) + '</span>' + (row.coverage ? '<span>' + e(relatedCoverage(row.coverage)) + '</span>' : '') + '</div><h3>' + e(row.title)
    + '</h3>' + paragraph('What we found:', clientText(row.observation)) + paragraph('Why it matters:', row.impact)
    + paragraph('Recommended action:', clientText(row.help))
    + unique([...strings(row.loadingContext), ...strings(row.evidence)])
      .filter((line) => !/Review secondary interaction timing:/i.test(line)).slice(0, 2)
      .map((line) => '<p class="note">' + e(evidenceCaption(line, pages)) + '</p>').join('') + '</article>';
  const pageNames = pages.map(shortPageLabel);
  const compactRows = pages.map((p) => {
    const device = siteReview ? 'mobile' : primaryScoreDevice(p.scores);
    return '<tr><td><div class="page-name">' + e(shortPageLabel(p)) + '</div>'
      + (pageNames.filter((name) => name === shortPageLabel(p)).length > 1 ? '<div class="page-path">' + e(pathOf(p.url)) + '</div>' : '') + '</td>' + [ ['mobile', 'performance'], ['desktop', 'performance'], [device, 'seo'], [device, 'accessibility'], [device, 'bestPractices'] ]
        .map(([d,k]) => '<td>' + score(p.scores?.[d]?.[k], pageScoreAvailability(p,d,k).label) + '</td>').join('') + '</tr>';
  }).join('');
  const compactTable = '<div class="score-table-wrap"><table><thead><tr><th>Page tested</th><th>Mobile speed</th><th>Desktop speed</th><th>Search checks</th><th>Accessibility</th><th>Best practices</th></tr></thead><tbody>'
    + (compactRows || '<tr><td colspan="6">No detailed page scores were recorded.</td></tr>') + '</tbody></table></div>';
  const defaultRoadmap = {
    immediate: [narrative.clientNextStep || (featured.length ? 'Validate the evidence for “' + featured[0].title + '” and agree the first scope.' : 'Confirm the main visitor tasks and any further review needed.'), 'Confirm affected pages, a baseline and how success will be checked.'],
    nearTerm: ['Implement the agreed priority improvements.', 'Retest the affected pages and verify the intended visitor actions.'],
    ongoing: ['Compare results after changes using equivalent test settings.', 'Use verified results and visitor feedback to choose the next improvements.'],
  };
  const roadmap = narrative.roadmap || defaultRoadmap;
  const roadmapHtml = [['Start here','immediate'], ['Improve next','nearTerm'], ['Measure and grow','ongoing']].map(([title,key]) =>
    '<article class="roadmap-card"><h3>' + e(title) + '</h3>' + (strings(roadmap[key]).length ? bullets(strings(roadmap[key]).map(clientText)) : '<p class="note">No actions supplied for this stage.</p>') + '</article>').join('');
  const scope = unique([
    'This is a sample of public pages, not an exhaustive website or functional test. Automated scores do not establish full accessibility compliance or overall search performance.',
    'Source HTML checks may omit dynamically rendered content. Form submissions, payments, sign-in and backend processing were not tested.',
    'Simulated page-test results can vary between runs and visitors.',
    ...strings(narrative.scopeNotes).map((note) => note.replace(/^(\d+) redirect alias\(es\) were counted once\.$/, '$1 alternative URLs redirected to pages already included and were not counted again.')).filter((note) => !STANDARD_SCOPE_NOTES.has(note.trim())
      && !((linkCoverage || scores?.linkCoverage || narrative.linkCoverage) && /^Internal link checks covered \d+ verified permitted destinations\. Other links were not tested\.$/.test(note.trim()))),
  ]);
  const failures = [];
  for (const p of pages) for (const d of ['mobile','desktop']) {
    if (p.scores?.runs?.[d]?.status === 'failed') failures.push(pageLabel(p) + ' (' + d + '): ' + scoreAvailability(p.scores,d).reason);
    else if (!p.scores && p.error && d === 'mobile') failures.push(pageLabel(p) + ': ' + p.error);
  }
  const extraClient = (strings(client.remainingImpacts).length ? '<section class="section"><h2>Additional visitor impacts</h2>' + bullets(client.remainingImpacts) + '</section>' : '')
    + (strings(client.remainingActions).length ? '<section class="section"><h2>Additional recommended actions</h2>' + bullets(client.remainingActions) + '</section>' : '');
  const main = '<section class="report-page summary-page"><header class="summary-header"><div><div class="brand-lockup">'
    + (logo ? '<img class="report-logo" src="' + e(logo) + '" alt="' + e((profile.yourCompany || 'Company') + ' logo') + '">'
      : '<span class="brand">' + e(profile.yourCompany || 'AuditUnfold') + '</span>')
    + '</div><h1>Detailed Website<br>Review Summary</h1><p class="subtitle">Prepared for ' + e(company)
    + '</p></div><div class="summary-meta"><div><strong>Website</strong>' + e(url) + '</div><div><strong>Prepared by</strong>'
    + e(profile.yourName || profile.yourCompany || 'Website team') + '</div><div><strong>Review date</strong>' + e(reportDate(generatedAt))
    + '</div><div><strong>Review scope</strong>' + e(mode === 'quick' ? 'Automated single-page scan' : mode === 'technical' ? 'Automated site audit with evidence' : 'Sampled website audit') + '</div></div></header>'
    + '<section class="section"><div class="kicker">Opportunity overview</div><h2>Where the website could deliver more value</h2><p class="lead">'
    + e(narrative.executiveSummary || 'No overview was supplied.') + '</p><p class="note scope-line">' + e(scopeLine) + '</p>' + scoreStrip + '<p class="note">'
+ e(scoreNote + ' ' + sourceNote)
+ '</p></section>'
    + (strengths.length ? '<section class="section strengths"><h3>What is already working well</h3>' + bullets(strengths) + '</section>' : '')
    + '<section class="section"><div class="kicker">Focused opportunities</div><h2>Where improvements could add the most value</h2>'
    + (featured.length ? '<div class="priority-grid">' + overviewCards + '</div>' : '<p>No prioritised recommendations were supplied. This does not establish that the site is issue-free.</p>')
    + (allRows.length > featured.length ? '<p class="note">The first four priorities are summarised here; all supplied priorities appear in the findings.</p>' : '') + '</section>' + footer + '</section>'
    + '<section class="report-page findings-page"><section class="section"><div class="kicker">Website findings</div><h2>What we found and how it could be improved</h2><p class="note">' + (automatic ? 'The suggestions below are generated from the recorded automated checks. No personal reviewer recommendations are included.' : 'The findings below bring together recorded checks and any recommendations added by the reviewer.') + (includeEvidence ? ' Detailed technical checks follow in the appendix.' : '') + '</p>'
    + (allRows.length ? '<div class="finding-grid">' + allRows.map(findingCard).join('') + '</div>' : '<p>No client findings were supplied.</p>') + '</section>'
    + extraClient + '<section class="section page-score-section' + (pages.length <= 6 ? ' keep-together' : '') + '"><div class="kicker">Supporting checks</div><h2>Page-level score comparison</h2>' + compactTable
    + '<p class="note scope-line">'
+ (siteReview
  ? 'Search, accessibility and best-practice columns use mobile results only. Unavailable mobile scores are excluded from the overview averages.'
  : 'Search, accessibility and best-practice columns use the '
    + primaryDevice + ' run.')
+ (includeEvidence ? ' The appendix lists each device separately.' : '')
+ ' Automated results do not assess overall SEO or full accessibility.</p>'
    + (failures.length ? '<h3>Unavailable results</h3>' + bullets(unique(failures)) : '') + '</section>' + footer + '</section>'
    + '<section class="report-page final-page"><section class="section"><div class="kicker">Practical roadmap</div><h2>A sensible path from findings to improvement</h2><div class="roadmap-grid">'
    + roadmapHtml + '</div></section>'
    + (narrative.analyticsStatement ? '<section class="section"><h3>Measurement and insight</h3><p>' + e(narrative.analyticsStatement) + '</p></section>' : '')
    + '<section class="section support"><div class="kicker">Ways to work together</div><h2>Support matched to the priority and budget</h2><p>The next step can be a focused improvement or a staged scope. The appropriate work is confirmed after reviewing the findings together.</p><div class="engagement-grid">'
    + OPTIONS.map(([title,text]) => '<article class="engagement-card"><h3>' + e(title) + '</h3><p>' + e(text) + '</p></article>').join('') + '</div></section>'
    + '<section class="section scope-panel"><h3>Coverage and interpretation</h3><p class="note">' + e(linkCoverageText(linkCoverage || scores?.linkCoverage || narrative.linkCoverage)) + '</p>'
    + bullets(scope) + '</section>' + footer + '</section>';
  const appendix = includeEvidence ? renderAppendix({ pages, findings, lightweightResults, footer }) : '';
  return '<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Detailed Website Review Summary - '
    + e(company) + '</title><style>' + DOCUMENT_CSS + '\n' + fontCss + '\nbody{font-family:' + fontFamily + ';}</style></head><body><main>' + main + appendix + '</main></body></html>';
}

function renderAppendix({ pages, findings, lightweightResults, footer }) {
  const deviceRows = pages.flatMap((p) => ['mobile','desktop'].map((device) => '<tr><td><strong>' + e(pageLabel(p))
    + '</strong><div class="page-path">' + e(p.url) + '</div></td><td>' + e(device) + '</td>'
    + ['performance','seo','accessibility','bestPractices'].map((key) => '<td>' + score(p.scores?.[device]?.[key],pageScoreAvailability(p,device,key).label) + '</td>').join('') + '</tr>')).join('');
  const diagnostics = pages.flatMap((p) => ['mobile','desktop'].map((device) => {
    const context = p.scores?.evidence?.[device]?.loadingDiagnostics;
    const run = p.scores?.runs?.[device];
    return '<article class="evidence-card"><h3>' + e(pageLabel(p)) + ' - ' + e(device) + '</h3><p class="url">' + e(p.url)
      + '</p>' + (run ? '<p class="note">' + e([ 'Run: ' + run.status, run.testedAt ? 'Tested: ' + run.testedAt : '', run.lighthouseVersion ? 'Lighthouse: ' + run.lighthouseVersion : '', run.error || '', ...strings(run.warnings) ].filter(Boolean).join(' · ')) + '</p>' : '')
      + (context ? '<p class="note">' + e([context.status,context.note].filter(Boolean).join(' · ')) + '</p>' : '')
      + (asList(context?.audits).length ? context.audits.map((audit) => '<h3>' + e(audit.title) + '</h3>'
        + (audit.displayValue ? '<p>' + e(audit.displayValue) + '</p>' : '') + '<pre>' + e(JSON.stringify(audit.items || [], null, 2)) + '</pre>').join('')
        : '<p class="note">Loading diagnostics were not recorded or provided.</p>') + '</article>';
  })).join('');
  const details = findings.map((f) => '<article class="evidence-card"><div class="kicker">' + e(f.priority || 'Review') + ' · ' + e(f.source || 'Recorded finding') + '</div><h3>' + e(f.title)
    + '</h3>' + paragraph('What was recorded:',f.finding) + paragraph('Why it matters:',f.impact) + paragraph('What to review:',f.action)
    + (f.scoreNote ? '<p class="note">' + e(f.scoreNote) + '</p>' : '')
    + asList(f.evidence).map((v) => '<div class="evidence-entry"><p class="url">' + e(v.url) + (v.device ? ' · ' + e(v.device) : '') + '</p>'
      + (v.title ? '<p>' + e(v.title) + '</p>' : '')
      + (v.displayValue ? '<p>' + e(v.displayValue) + '</p>' : typeof v.numericValue === 'number' && Number.isFinite(v.numericValue) ? '<p>' + e(v.numericValue) + ' ' + e(v.numericUnit || '') + '</p>' : '')
      + (typeof v.affectedItemCount === 'number' ? '<p class="note">' + e(v.affectedItemCount) + ' returned evidence items</p>' : '')
      + (v.estimatedSavingsMs > 0 || v.estimatedSavingsBytes > 0 ? '<p class="note">Estimated opportunity: '
        + e([v.estimatedSavingsMs > 0 ? Math.round(v.estimatedSavingsMs) + ' ms' : '', v.estimatedSavingsBytes > 0 ? Math.round(v.estimatedSavingsBytes/1024) + ' KiB' : ''].filter(Boolean).join(', '))
        + '. Estimates overlap and must not be added together.</p>' : '')
      + (asList(v.referringPages).length ? '<h3>Referring pages</h3>' + bullets(v.referringPages) : '')
      + asList(v.items).map((item) => '<pre>' + e(JSON.stringify(item,null,2)) + '</pre>').join('')
      + (v.loadingDiagnostics ? '<h3>Recorded loading context</h3><pre>' + e(JSON.stringify(v.loadingDiagnostics,null,2)) + '</pre>' : '') + '</div>').join('') + '</article>').join('');
  const coverage = asList(lightweightResults).map((p) => '<tr><td colspan="2">' + e(p.finalUrl || p.url) + '</td><td>' + e(p.status)
    + '</td><td>' + e(p.httpStatus ?? 'Unknown') + '</td><td colspan="2">' + e(p.error || '') + '</td></tr>').join('');
  return '<section class="report-page appendix"><section class="section"><div class="kicker">Technical appendix</div><h2>Tested pages and devices</h2><p class="note">These results cover the recorded page and device sample. Missing and failed results are labelled separately.</p><div class="score-table-wrap"><table><thead><tr><th>Page</th><th>Device</th><th>Performance</th><th>Search checks</th><th>Accessibility</th><th>Best practices</th></tr></thead><tbody>'
    + (deviceRows || '<tr><td colspan="6">No detailed scores were recorded.</td></tr>') + '</tbody></table></div></section><section class="section"><h2>Loading diagnostics</h2><p class="note">Supporting observations, not confirmed causes. Breakdown timings may use different conditions from headline simulated metrics.</p>'
    + (diagnostics || '<p>No loading diagnostics were recorded.</p>') + '</section><section class="section"><h2>Finding details</h2>'
    + (details || '<p>No detailed findings were recorded.</p>') + '</section>'
    + (coverage ? '<section class="section"><h2>HTML inspection coverage</h2><table><thead><tr><th colspan="2">URL</th><th>Inspection</th><th>HTTP</th><th colspan="2">Note</th></tr></thead><tbody>' + coverage + '</tbody></table></section>' : '') + footer + '</section>';
}
