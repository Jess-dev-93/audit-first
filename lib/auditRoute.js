import { NextResponse } from "next/server";
import { normaliseAuditUrl } from "./normaliseAuditUrl";
import { isPublicAuditUrl } from "./auditFetch";
import { getUserIdFromRequest } from "./getUserId";
import { getUserPlan, incrementUsage } from "./getUserPlan";
export async function handleAuditRequest(request, scan) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Provide a valid JSON request." },
      { status: 400 },
    );
  }
  if (!body || Array.isArray(body) || typeof body.url !== "string")
    return NextResponse.json(
      { error: "Please provide a website URL." },
      { status: 400 },
    );
  let url;
  try {
    url = normaliseAuditUrl(body.url);
  } catch {
    url = null;
  }
  if (!url || !isPublicAuditUrl(url))
    return NextResponse.json(
      { error: "Enter a valid public website URL, such as example.com.au." },
      { status: 400 },
    );
  try {
    const userId = await getUserIdFromRequest(request);
    if (userId) {
      const plan = await getUserPlan(userId);
      if (plan.auditLimitReached)
        return NextResponse.json(
          {
            error:
              "You have used all " +
              plan.auditLimit +
              " audits this month. Upgrade your plan to continue.",
            limitReached: true,
            limitType: "audit",
            used: plan.auditCount,
            limit: plan.auditLimit,
            plan: plan.plan,
          },
          { status: 403 },
        );
    }
    const result = await scan(url, body);
    if (!result.success) return NextResponse.json(result, { status: 502 });
    if (userId) await incrementUsage(userId, "audit");
    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "Audit request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "The audit could not complete. Please try again." },
      { status: 502 },
    );
  }
}