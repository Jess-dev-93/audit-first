"use client";
import { useEffect, useState } from "react";

export type ReportTypography = { fontFamily: string; fontFacesCss: string };
export const DEFAULT_REPORT_TYPOGRAPHY: ReportTypography = {
  fontFamily: "Arial, sans-serif",
  fontFacesCss: "",
};

/** Copy only the active app font faces. Embed same-origin font assets so the
 * sandboxed preview and print window do not depend on the parent document. */
export async function captureReportTypography(): Promise<ReportTypography> {
  if (typeof document === "undefined") return DEFAULT_REPORT_TYPOGRAPHY;
  const target = document.querySelector(".prism-app") || document.body;
  const computed = getComputedStyle(target);
  const fontFamily =
    computed.getPropertyValue("--font-sans").trim() ||
    computed.fontFamily ||
    "Arial, sans-serif";
  const faces: { style: CSSStyleDeclaration; base: string }[] = [];
  const visit = (rules: CSSRuleList, base: string, depth = 0) => {
    if (depth > 5 || faces.length >= 8) return;
    for (const rule of Array.from(rules)) {
      if (faces.length >= 8) break;
      if (rule.type === 5) {
        const style = (rule as CSSFontFaceRule).style;
        const family = style
          .getPropertyValue("font-family")
          .replace(/["']/g, "")
          .trim();
        if (family && fontFamily.toLowerCase().includes(family.toLowerCase()))
          faces.push({ style, base });
      } else if ("cssRules" in rule) {
        try {
          visit((rule as CSSGroupingRule).cssRules, base, depth + 1);
        } catch {
          /* Inaccessible stylesheet. */
        }
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules, sheet.href || document.baseURI);
    } catch {
      /* Cross-origin styles may be inaccessible. */
    }
  }
  let totalBytes = 0;
  const deadline = Date.now() + 4500;
  const downloads = new Map<string, Promise<string>>();
  const embed = (url: URL): Promise<string> => {
    if (!downloads.has(url.href))
      downloads.set(
        url.href,
        (async () => {
          const controller = new AbortController();
          const timer = setTimeout(
            () => controller.abort(),
            Math.max(1, deadline - Date.now()),
          );
          try {
            const response = await fetch(url.href, {
              signal: controller.signal,
              credentials: "same-origin",
            });
            if (!response.ok || !response.body) return "";
            const reader = response.body.getReader(),
              chunks: Uint8Array[] = [];
            let bytes = 0;
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              bytes += value.byteLength;
              totalBytes += value.byteLength;
              if (bytes > 1_500_000 || totalBytes > 4_000_000) {
                await reader.cancel();
                return "";
              }
              chunks.push(value);
            }
            const buffer = new Uint8Array(bytes);
            let offset = 0;
            for (const chunk of chunks) {
              buffer.set(chunk, offset);
              offset += chunk.length;
            }
            let binary = "";
            for (let i = 0; i < buffer.length; i += 32768)
              binary += String.fromCharCode(...buffer.subarray(i, i + 32768));
            const type = url.pathname.toLowerCase().endsWith(".woff2")
              ? "font/woff2"
              : url.pathname.toLowerCase().endsWith(".woff")
                ? "font/woff"
                : "font/ttf";
            return `data:${type};base64,${btoa(binary)}`;
          } catch {
            return "";
          } finally {
            clearTimeout(timer);
          }
        })(),
      );
    return downloads.get(url.href)!;
  };
  const css = await Promise.all(
    faces.map(async ({ style, base }) => {
      const matches = [
        ...style
          .getPropertyValue("src")
          .matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g),
      ];
      for (const match of matches) {
        let url: URL;
        try {
          url = new URL((match[1] || match[2] || match[3] || "").trim(), base);
        } catch {
          continue;
        }
        if (
          url.origin !== location.origin ||
          !/\.(?:woff2?|ttf|otf)$/i.test(url.pathname)
        )
          continue;
        const data = await embed(url);
        if (!data) continue;
        const descriptors = [
          "font-family",
          "font-style",
          "font-weight",
          "font-stretch",
          "unicode-range",
        ]
          .map((key) =>
            style.getPropertyValue(key)
              ? `${key}:${style.getPropertyValue(key)};`
              : "",
          )
          .join("");
        return `@font-face{${descriptors}font-display:swap;src:url("${data}");}`;
      }
      return "";
    }),
  );
  return { fontFamily, fontFacesCss: css.join("\n") };
}

export function useReportTypography() {
  const [typography, setTypography] = useState(DEFAULT_REPORT_TYPOGRAPHY);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    captureReportTypography()
      .then((value) => {
        if (active) setTypography(value);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return { typography, ready };
}
