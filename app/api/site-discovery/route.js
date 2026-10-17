import { handleAuditRequest } from "../../../lib/auditRoute";
import { runFullSiteAudit } from "../../../lib/siteAuditService";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request) {
  return handleAuditRequest(request, (url) =>
    runFullSiteAudit(url, { maxPages: 20, maxDeepPages: 5 }),
  );
}