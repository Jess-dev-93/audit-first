"use client";
import { useState } from "react";
import type { UserProfile } from "../lib/profileStorage";
import { getProfileLogo } from "../lib/profileStorage";

export function ReportBrand({ profile }: { profile?: Partial<UserProfile> }) {
  const logo = getProfileLogo(profile?.yourLogo);
  const [failed, setFailed] = useState("");
  return (
    <div className="audit-report-brand">
      {logo && failed !== logo && (
        <img
          className="audit-report-logo"
          src={logo}
          alt={`${profile?.yourCompany || "Company"} logo`}
          onError={() => setFailed(logo)}
        />
      )}
      <span className="audit-report-brand-name">
        {profile?.yourCompany || "AuditUnfold"}
      </span>
    </div>
  );
}
export function ReportContact({ profile }: { profile?: Partial<UserProfile> }) {
  const parts = [
    profile?.yourName,
    profile?.yourCompany,
    profile?.yourWebsite,
  ].filter(Boolean);
  return parts.length ? (
    <p className="audit-report-footer">{parts.join(" · ")}</p>
  ) : null;
}
