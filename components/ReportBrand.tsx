"use client";

import { useState } from "react";
import type { UserProfile } from "../lib/profileStorage";
import { getProfileLogo } from "../lib/profileStorage";

export function ReportBrand({ profile }: { profile?: Partial<UserProfile> }) {
  const logo = getProfileLogo(profile?.yourLogo);
  const [failed, setFailed] = useState("");
  const showLogo = Boolean(logo && failed !== logo);
  const company = profile?.yourCompany || "AuditUnfold";

  return (
    <div className="audit-report-brand">
      {showLogo ? (
        <img
          className="audit-report-logo"
          src={logo}
          alt={`${company} logo`}
          onError={() => setFailed(logo)}
        />
      ) : (
        <span className="audit-report-brand-name">{company}</span>
      )}
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
