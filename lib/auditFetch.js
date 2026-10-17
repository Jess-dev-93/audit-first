import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { createGunzip, createBrotliDecompress, createInflate } from "node:zlib";
import { isIP } from "node:net";

export function isPublicAddress(address) {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(ip) === 4) {
    const [a, b, c] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  return (
    isIP(ip) === 6 &&
    /^[23][0-9a-f]{0,3}:/.test(ip) &&
    !/^2001:(?:db8|0|10|20):/i.test(ip)
  );
}
export function isPublicAuditUrl(value) {
  try {
    const u = new URL(value),
      host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      !["http:", "https:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      (u.port && !["80", "443"].includes(u.port))
    )
      return false;
    if (isIP(host)) return isPublicAddress(host);
    return (
      host.includes(".") &&
      !/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)
    );
  } catch {
    return false;
  }
}
export async function resolvePublicUrl(value) {
  if (!isPublicAuditUrl(value))
    throw new Error("Use a public HTTP or HTTPS website URL.");
  const host = new URL(value).hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((x) => !isPublicAddress(x.address)))
    throw new Error("This address is not available for a public website scan.");
  return addresses[0];
}
export async function safeFetchText(value, options = {}) {
  const started = Date.now(),
    deadline = Math.min(
      options.deadline || Infinity,
      started + (options.timeoutMs || 12000),
    );
  let url = new URL(value).toString();
  const redirects = [];
  for (let hop = 0; hop <= 5; hop++) {
    if (options.allowUrl && !options.allowUrl(url))
      throw new Error("Redirect is outside the permitted crawl scope.");
    if (Date.now() >= deadline) throw new Error("Page request timed out.");
    let dnsTimer;
    const address = await Promise.race([
      resolvePublicUrl(url),
      new Promise((_, reject) => {
        dnsTimer = setTimeout(
          () => reject(new Error("Address lookup timed out.")),
          deadline - Date.now(),
        );
      }),
    ]).finally(() => clearTimeout(dnsTimer));
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Page request timed out.");
    const response = await new Promise((resolve, reject) => {
      const u = new URL(url),
        transport = u.protocol === "https:" ? https : http;
      const req = transport.request(
        u,
        {
          method: "GET",
          agent: false,
          headers: {
            "User-Agent": "AuditUnfold/2.0 (+https://jmsites.dev)",
            Accept: options.accept || "text/html,application/xhtml+xml;q=0.9",
            "Accept-Encoding": "identity",
          },
          lookup: (_host, opts, cb) =>
            opts?.all
              ? cb(null, [address])
              : cb(null, address.address, address.family),
        },
        (res) => {
          const status = res.statusCode || 0,
            headers = {};
          for (const key of [
            "content-type",
            "location",
            "x-robots-tag",
            "content-encoding",
          ])
            headers[key] = String(res.headers[key] || "");
          if ([301, 302, 303, 307, 308].includes(status) && headers.location) {
            res.resume();
            resolve({
              status,
              headers,
              buffer: Buffer.alloc(0),
              truncated: false,
            });
            return;
          }
          const enc = headers["content-encoding"].toLowerCase();
          const decoder =
            enc === "gzip"
              ? createGunzip()
              : enc === "br"
                ? createBrotliDecompress()
                : enc === "deflate"
                  ? createInflate()
                  : null;
          if (enc && enc !== "identity" && !decoder) {
            res.resume();
            reject(new Error("Unsupported compressed response."));
            return;
          }
          const body = decoder ? res.pipe(decoder) : res;
          const chunks = [];
          let bytes = 0,
            completed = false;
          const finish = (truncated) => {
            if (completed) return;
            completed = true;
            resolve({
              status,
              headers,
              buffer: Buffer.concat(chunks),
              truncated,
            });
          };
          body.on("data", (chunk) => {
            const cap = options.maxBytes || 1500000,
              available = cap - bytes;
            if (chunk.length > available) {
              if (available > 0) chunks.push(chunk.subarray(0, available));
              finish(true);
              res.destroy();
              if (decoder) decoder.destroy();
            } else {
              chunks.push(chunk);
              bytes += chunk.length;
            }
          });
          body.on("end", () => finish(false));
          if (decoder)
            decoder.on("error", (err) => {
              res.destroy();
              if (!completed) reject(err);
            });
          res.on("error", (err) => {
            if (!completed) reject(err);
          });
          res.on("aborted", () => {
            if (!completed) reject(new Error("Page response was interrupted."));
          });
        },
      );
      const timer = setTimeout(
        () => req.destroy(new Error("Page request timed out.")),
        remaining,
      );
      req.on("close", () => clearTimeout(timer));
      req.on("error", reject);
      req.end();
    });
    if (
      [301, 302, 303, 307, 308].includes(response.status) &&
      response.headers.location
    ) {
      if (hop === 5) throw new Error("Too many redirects.");
      const next = new URL(response.headers.location, url).toString();
      redirects.push({ from: url, to: next, status: response.status });
      url = next;
      continue;
    }
    return {
      ...response,
      url,
      redirects,
      elapsedMs: Date.now() - started,
      text: response.buffer.toString("utf8"),
    };
  }
  throw new Error("Page request could not finish.");
}