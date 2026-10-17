import { safeFetchText, isPublicAuditUrl } from "./auditFetch";
import {
  parsePage,
  parseSitemap,
  robotsPolicy,
  robotsAllows,
  absoluteUrl,
  unique,
} from "./auditHtml";
export { isPublicAuditUrl } from "./auditFetch";
export function normaliseDiscoveredUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = /^https?:\/\//i.test(value.trim())
    ? value.trim()
    : "https://" + value.trim();
  const u = absoluteUrl(raw, raw);
  return u && isPublicAuditUrl(u) ? u : null;
}
export function classifyPageType(value, origin) {
  try {
    const u = new URL(value),
      p = u.pathname.toLowerCase().replace(/\/+$/, "") || "/",
      depth = p.split("/").filter(Boolean).length;
    if (u.origin === origin && p === "/") return "Homepage";
    if (/\/(?:(?:our-)?services?|solutions?|capabilities?)(?:\/|$)/.test(p))
      return "Services";
    if (
      /\/(?:case-studies|case-study|work|portfolio|projects?)(?:\/|$)/.test(p)
    )
      return depth > 1 ? "Case study" : "Projects";
    if (/\/(?:products?|shop)(?:\/|$)/.test(p))
      return depth > 1 ? "Product detail" : "Products";
    if (/\/(?:properties|property|listings?)(?:\/|$)/.test(p))
      return depth > 1 ? "Property detail" : "Property listing";
    if (/\/(?:contact(?:-us)?|get-in-touch|enquire|quote)(?:\/|$)/.test(p))
      return "Contact";
    if (/\/(?:about(?:-us)?|company|our-story|who-we-are)(?:\/|$)/.test(p))
      return "About";
    if (/\/(?:team|our-team|leadership)(?:\/|$)/.test(p)) return "Team";
    if (/\/(?:news|blog|articles?|insights?|resources?)(?:\/|$)/.test(p))
      return depth > 1 ? "Article" : "News or resources";
    if (/\/(?:pricing|plans)(?:\/|$)/.test(p)) return "Pricing";
    return "Other";
  } catch {
    return "Other";
  }
}
export function isReviewablePage(value, origin) {
  try {
    const u = new URL(value);
    return (
      u.origin === origin &&
      isPublicAuditUrl(value) &&
      !/\.(?:png|jpe?g|gif|svg|webp|avif|ico|pdf|docx?|xlsx?|pptx?|zip|mp[34]|css|js|json|xml|txt|woff2?)$/i.test(
        u.pathname,
      ) &&
      !/\/(?:wp-admin|wp-login(?:\.php)?|admin|api|wp-json|graphql|checkout|cart|basket|logout|signout|sign-out|login|signin|sign-in|account|my-account|oauth|feed)(?:\/|$)/i.test(
        u.pathname,
      ) &&
      !/[?&](?:action|delete|remove|add-to-cart|logout)=/i.test(u.search)
    );
  } catch {
    return false;
  }
}
export function selectRepresentativePages(urls, origin, limit = 5) {
  const order = [
    "Homepage",
    "Services",
    "Products",
    "Projects",
    "Case study",
    "Pricing",
    "Contact",
    "About",
    "Team",
    "Property listing",
    "Property detail",
    "News or resources",
    "Article",
    "Other",
  ];
  const selected = [],
    seen = new Set(),
    sorted = [...urls].sort(
      (a, b) => new URL(a).pathname.length - new URL(b).pathname.length,
    );
  const add = (u) => {
    if (u && !seen.has(u) && selected.length < limit) {
      seen.add(u);
      selected.push(u);
    }
  };
  for (const type of order)
    add(sorted.find((u) => classifyPageType(u, origin) === type));
  for (const u of sorted) add(u);
  return selected;
}
export async function discoverSitePages(
  inputUrl,
  { maxPages = 20, deadline = Date.now() + 45000, maxDeepPages = 5 } = {},
) {
  const rootUrl = normaliseDiscoveredUrl(inputUrl);
  if (!rootUrl)
    return { success: false, error: "Enter a valid public website URL." };
  const limit = Math.max(1, Math.min(50, Math.floor(Number(maxPages) || 20)));
  const warnings = [],
    excluded = [],
    candidates = new Set(),
    snapshots = new Map();
  let origin = new URL(rootUrl).origin,
    first;
  try {
    first = await safeFetchText(origin + "/", { deadline });
    if (first.status < 200 || first.status >= 300)
      throw new Error("Homepage returned HTTP " + first.status);
    if (!/html/i.test(first.headers["content-type"] || ""))
      throw new Error("Homepage did not return HTML.");
    origin = new URL(first.url).origin;
    snapshots.set(first.url, first);
    candidates.add(first.url);
  } catch (err) {
    return {
      success: false,
      error: err.message,
      discoveredPages: [],
      recommendedPages: [],
      discoveredCount: 0,
      source: "none",
      url: rootUrl,
      origin,
    };
  }
  let policy = { rules: [], sitemaps: [] };
  try {
    const robots = await safeFetchText(origin + "/robots.txt", {
      deadline,
      timeoutMs: 6000,
      accept: "text/plain",
    });
    if (robots.status === 200 && !robots.truncated)
      policy = robotsPolicy(robots.text);
    else if (robots.status === 401 || robots.status === 403)
      return {
        success: false,
        error: "The website restricts crawler access through robots.txt.",
      };
    else if (robots.status >= 500 || robots.truncated)
      return {
        success: false,
        error:
          "Crawler instructions could not be checked completely. Try again later.",
      };
  } catch {
    return {
      success: false,
      error: "Crawler instructions could not be checked. Try again later.",
    };
  }
  const add = (u) => {
    if (!isReviewablePage(u, origin)) return;
    if (!robotsAllows(u, policy)) {
      if (excluded.length < 30)
        excluded.push({ url: u, reason: "Excluded by robots.txt" });
      return;
    }
    if (candidates.size < 250) candidates.add(u);
  };
  for (const u of [...candidates])
    if (!robotsAllows(u, policy)) {
      candidates.delete(u);
      excluded.push({ url: u, reason: "Excluded by robots.txt" });
    }
  const entry = new URL(rootUrl);
  entry.protocol = new URL(origin).protocol;
  entry.host = new URL(origin).host;
  add(entry.toString());
  if (first.truncated)
    warnings.push("Homepage HTML was truncated; discovery may be incomplete.");
  else
    parsePage(first.buffer, first.url, first.headers).linkTargets.forEach(add);
  const queue = unique([
    ...policy.sitemaps.map((u) => absoluteUrl(u, origin)),
    origin + "/sitemap.xml",
    origin + "/sitemap_index.xml",
  ]);
  const visited = new Set();
  let sitemapUsed = false;
  while (
    queue.length &&
    visited.size < 8 &&
    candidates.size < 250 &&
    Date.now() < deadline - 3000
  ) {
    const u = queue.shift();
    if (
      !u ||
      visited.has(u) ||
      new URL(u).origin !== origin ||
      !robotsAllows(u, policy)
    )
      continue;
    visited.add(u);
    try {
      const response = await safeFetchText(u, {
        deadline,
        timeoutMs: 6000,
        allowUrl: (v) =>
          new URL(v).origin === origin && robotsAllows(v, policy),
        accept: "application/xml,text/xml",
      });
      if (response.status !== 200) continue;
      if (response.truncated) {
        warnings.push("A sitemap exceeded the scan size limit.");
        continue;
      }
      const xml = parseSitemap(response.text);
      if (xml.index)
        for (const href of xml.urls) {
          const child = absoluteUrl(href, u);
          if (child && new URL(child).origin === origin) queue.push(child);
        }
      else {
        sitemapUsed = sitemapUsed || xml.urls.length > 0;
        xml.urls
          .map((href) => absoluteUrl(href, u))
          .filter(Boolean)
          .forEach(add);
      }
    } catch {
      warnings.push("A sitemap could not be read: " + u);
    }
  }
  const crawled = new Set(snapshots.keys());
  while (
    crawled.size < 8 &&
    candidates.size < 250 &&
    Date.now() < deadline - 3000
  ) {
    const next = selectRepresentativePages([...candidates], origin, 250).find(
      (u) => !crawled.has(u),
    );
    if (!next) break;
    crawled.add(next);
    try {
      const response = await safeFetchText(next, {
        deadline,
        timeoutMs: 6000,
        allowUrl: (u) => isReviewablePage(u, origin) && robotsAllows(u, policy),
      });
      snapshots.set(next, response);
      if (
        response.status === 200 &&
        !response.truncated &&
        /html/i.test(response.headers["content-type"])
      )
        parsePage(
          response.buffer,
          response.url,
          response.headers,
        ).linkTargets.forEach(add);
    } catch {
      /* The selected-page review will record failures. */
    }
  }
  const all = [...candidates].filter((u) => isReviewablePage(u, origin)),
    review = selectRepresentativePages(all, origin, limit);
  if (!review.length)
    return {
      success: false,
      error: "No public pages were available within the permitted scan scope.",
    };
  return {
    success: true,
    discoveredPages: review,
    recommendedPages: selectRepresentativePages(review, origin, maxDeepPages),
    discoveredCount: all.length,
    reviewedPageCount: review.length,
    discoveryLimited:
      all.length >= 250 || queue.length > 0 || Date.now() >= deadline - 3000,
    source: sitemapUsed ? "sitemap+links" : "links",
    url: rootUrl,
    origin,
    excludedPages: excluded,
    warnings: unique(warnings),
    robotsPolicy: policy,
    _snapshots: snapshots,
  };
}