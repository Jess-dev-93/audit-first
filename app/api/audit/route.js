import { handleAuditRequest } from "../../../lib/auditRoute";
import { runPageAudit } from "../../../lib/pageAuditEngine";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request) {
  return handleAuditRequest(request, async (url, body) => {
    // The existing scanner expects both score objects. Unavailable values remain null.
    const result = await runPageAudit(url, {
      quick: false,
      generateAi: true,
      deadline: Date.now() + 95000,
    });
    return {
      success: true,
      ...result,
      url,
      scanMode: body.scanMode === "full" ? "full" : "quick",
      scannedAt: new Date().toISOString(),
    };
  });
}