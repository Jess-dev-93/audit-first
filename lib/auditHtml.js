import { load, loadBuffer } from "cheerio";
const text = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();
export const unique = (values) => [...new Set(values.filter(Boolean))];
export const average = (values) => {
  const v = values.filter((x) => typeof x === "number" && Number.isFinite(x));
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};
export function absoluteUrl(href, base) {
  if (typeof href !== "string" || !href.trim()) return null;
  try {
    const u = new URL(href, base);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    u.hash = "";
    for (const key of [...u.searchParams.keys()])
      if (
        /^utm_/i.test(key) ||
        ["gclid", "fbclid", "msclkid"].includes(key.toLowerCase())
      )
        u.searchParams.delete(key);
    return u.toString();
  } catch {
    return null;
  }
}
export function parsePage(input, pageUrl, headers = {}) {
  const $ = Buffer.isBuffer(input) ? loadBuffer(input) : load(input);
  const baseHref = $("base[href]").first().attr("href"),
    base = baseHref ? absoluteUrl(baseHref, pageUrl) || pageUrl : pageUrl;
  const meta = (name) =>
    $("meta")
      .toArray()
      .filter((el) => String($(el).attr("name") || "").toLowerCase() === name)
      .map((el) => $(el).attr("content") || "")
      .join(", ");
  const h1Texts = $("h1")
    .toArray()
    .map((el) => text($(el).text()))
    .filter(Boolean);
  const canonical = $("link")
    .toArray()
    .find((el) =>
      String($(el).attr("rel") || "")
        .toLowerCase()
        .split(/\s+/)
        .includes("canonical"),
    );
  const canonicalValue = canonical
    ? absoluteUrl($(canonical).attr("href"), base) || ""
    : "";
  const links = [],
    malformedLinks = [],
    phoneLinks = [],
    emailLinks = [],
    ctaLabels = [],
    emailLabelMismatches = [],
    missingAnchorTargets = [];
  const identifiers = new Set(
    $("[id],a[name]")
      .toArray()
      .flatMap((el) => [
        $(el).attr("id"),
        $(el).is("a") ? $(el).attr("name") : null,
      ])
      .filter(Boolean),
  );
  $("a[href]").each((_, el) => {
    const href = text($(el).attr("href")),
      label = text($(el).attr("aria-label") || $(el).text());
    if (/^tel:/i.test(href)) {
      phoneLinks.push(href.slice(4));
      return;
    }
    if (/^mailto:/i.test(href)) {
      const destination = href.slice(7).split("?")[0];
      emailLinks.push(destination);
      let address = destination;
      try {
        address = decodeURIComponent(destination);
      } catch {
        /* Keep original text. */
      }
      const shown = text($(el).text());
      if (
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shown) &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) &&
        shown.toLowerCase() !== address.toLowerCase()
      )
        emailLabelMismatches.push({
          label: shown.slice(0, 200),
          url: href.slice(0, 500),
          reason: "Displayed address and email destination differ.",
        });
      return;
    }
    if (
      href.startsWith("#") &&
      href.length > 1 &&
      absoluteUrl(href, base) === absoluteUrl(pageUrl, pageUrl)
    ) {
      let id = href.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        /* Use the original identifier. */
      }
      if (!identifiers.has(id))
        missingAnchorTargets.push({
          label: label.slice(0, 200),
          url: href.slice(0, 500),
          reason:
            "Target not found in source HTML; it may be created by JavaScript.",
        });
    }
    if (
      !href ||
      href.startsWith("#") ||
      /^(?:javascript|data|sms):/i.test(href)
    )
      return;
    const target = absoluteUrl(href, base);
    if (!target) {
      malformedLinks.push({ href, label });
      return;
    }
    links.push({ url: target, label });
    if (
      /\b(contact|enquire|book|view|learn|request|download|start)\b/i.test(
        label,
      )
    )
      ctaLabels.push(label);
  });
  const imageItems = [];
  $("img").each((_, el) => {
    if ($(el).attr("alt") === undefined)
      imageItems.push({
        url: absoluteUrl($(el).attr("src") || "", base),
        snippet: $.html(el).slice(0, 400),
      });
  });
  const types = [],
    schemaErrors = [];
  let structuredDataBlocks = 0;
  let schemaNodes = 0;
  function walk(v, depth = 0) {
    if (!v || typeof v !== "object" || depth > 40 || ++schemaNodes > 10000)
      return;
    if (typeof v["@type"] === "string") types.push(v["@type"]);
    else if (Array.isArray(v["@type"]))
      types.push(...v["@type"].filter((x) => typeof x === "string"));
    for (const [key, child] of Object.entries(v))
      if (key !== "@context" && child && typeof child === "object") {
        if (Array.isArray(child))
          child.forEach((item) => walk(item, depth + 1));
        else walk(child, depth + 1);
      }
  }
  $("script").each((_, el) => {
    if (
      String($(el).attr("type") || "").toLowerCase() !== "application/ld+json"
    )
      return;
    structuredDataBlocks++;
    try {
      walk(JSON.parse($(el).text()));
    } catch {
      schemaErrors.push(
        "JSON-LD block " + structuredDataBlocks + " could not be parsed.",
      );
    }
  });
  const micro = $("[itemtype]")
    .toArray()
    .map((el) => $(el).attr("itemtype"))
    .filter(Boolean);
  const rdfa = $("[typeof]")
    .toArray()
    .map((el) => $(el).attr("typeof"))
    .filter(Boolean);
  const robots = text(
    meta("robots") +
      ", " +
      meta("googlebot") +
      ", " +
      (headers["x-robots-tag"] || ""),
  );
  const internal = links.filter(
    (x) => new URL(x.url).origin === new URL(pageUrl).origin,
  );
  const lang = text($("html").attr("lang")),
    viewport = meta("viewport");
  const bodyText = text(
    $("body").clone().find("script,style,noscript").remove().end().text(),
  );
  return {
    title: text($("title").first().text()),
    metaDescription: meta("description"),
    h1Count: $("h1").length,
    h1Texts,
    canonicalPresent: Boolean(canonicalValue),
    canonicalValue,
    robotsNoindex: /\b(?:noindex|none)\b/i.test(robots),
    robotsValue: robots,
    langPresent: Boolean(lang),
    documentLanguage: lang,
    viewportPresent: Boolean(viewport),
    viewportValue: viewport,
    imageCount: $("img").length,
    imagesMissingAlt: imageItems.length,
    missingAltItems: imageItems.slice(0, 8),
    structuredDataPresent:
      structuredDataBlocks > 0 || micro.length > 0 || rdfa.length > 0,
    structuredDataTypes: unique([...types, ...micro, ...rdfa]).slice(0, 20),
    structuredDataErrors: schemaErrors,
    ogPresent: $('meta[property="og:title"]').length > 0,
    internalLinks: unique(internal.map((x) => x.url)).length,
    externalLinks: unique(
      links.filter((x) => !internal.includes(x)).map((x) => x.url),
    ).length,
    linkTargets: unique(internal.map((x) => x.url)).slice(0, 300),
    links: links.slice(0, 300),
    malformedLinks: malformedLinks.slice(0, 8),
    phoneLinks: unique(phoneLinks),
    emailLinks: unique(emailLinks),
    emailLabelMismatches: emailLabelMismatches.slice(0, 8),
    missingAnchorTargets: missingAnchorTargets.slice(0, 8),
    ctaLabels: unique(ctaLabels).slice(0, 12),
    formCount: 0,
    formActions: [],
    newsletterPresent: false,
    accountEntryPoint: false,
    contentLimited: bodyText.length < 80,
  };
}
export function parseSitemap(input) {
  const $ = load(input, { xmlMode: true });
  return {
    index: $("sitemapindex").length > 0,
    urls: $("loc")
      .toArray()
      .map((el) => text($(el).text()))
      .filter(Boolean),
  };
}
export function robotsPolicy(source) {
  const groups = [];
  let agents = [],
    rules = [];
  const commit = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };
  const sitemaps = [];
  for (const line of source.split(/\r?\n/)) {
    const cleaned = line.replace(/#.*$/, "").trim(),
      i = cleaned.indexOf(":");
    if (i < 0) continue;
    const key = cleaned.slice(0, i).trim().toLowerCase(),
      value = cleaned.slice(i + 1).trim();
    if (key === "sitemap") {
      sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      if (rules.length) commit();
      agents.push(value.toLowerCase());
    } else if (["allow", "disallow"].includes(key) && agents.length && value)
      rules.push({ allow: key === "allow", path: value });
  }
  commit();
  const specific = groups.filter((g) =>
    g.agents.some((a) => a !== "*" && "auditunfold".includes(a)),
  );
  return {
    sitemaps,
    rules: (specific.length
      ? specific
      : groups.filter((g) => g.agents.includes("*"))
    ).flatMap((g) => g.rules),
  };
}
export function robotsAllows(url, policy) {
  const u = new URL(url),
    path = u.pathname + u.search;
  const matches = (policy?.rules || [])
    .filter((r) => {
      const terminal = r.path.endsWith("$");
      const raw = terminal ? r.path.slice(0, -1) : r.path;
      const pattern = raw
        .split("*")
        .map((s) => s.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&"))
        .join(".*");
      return new RegExp("^" + pattern + (terminal ? "$" : "")).test(path);
    })
    .sort(
      (a, b) =>
        b.path.replace(/\*/g, "").length - a.path.replace(/\*/g, "").length ||
        Number(b.allow) - Number(a.allow),
    );
  return matches.length ? matches[0].allow : true;
}