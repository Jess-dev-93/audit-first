export type LinkCoverage = {
  selectedCount: number;
  verifiedCount: number;
  unverifiedCount: number;
  brokenCount?: number;
  eligibleCount?: number;
  limited: boolean;
  note?: string;
};
export type DeviceScores = {
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
};
export type LoadingDiagnostics = {
  status: string;
  note: string;
  audits: Array<{
    id: string;
    title: string;
    displayValue?: string | null;
    items: EvidenceItem[];
  }>;
};
export type EvidenceItem = {
  url?: string | null;
  source?: string;
  label?: string;
  selector?: string;
  node?: { selector?: string; nodeLabel?: string; snippet?: string };
  items?: EvidenceItem[];
  reason?: string;
  explanation?: string;
  failureSummary?: string;
};
export type LighthouseFinding = {
  id: string;
  category?: string;
  categoryLabel: string;
  title: string;
  priority: "high" | "medium" | "low";
  displayValue?: string | null;
  savingsMs?: number | null;
  savingsBytes?: number | null;
  affectedItemCount?: number;
  items?: EvidenceItem[];
};
export type Scores = {
  sourceCheckStatus?: "complete" | "unavailable" | "not-requested";
  pageFindings?: FindingDetail[];
  linkCoverage?: LinkCoverage;
  mobile: DeviceScores | null;
  desktop?: DeviceScores | null;
  overallScore?: number | null;
  status?: string;
  details?: Record<string, unknown>;
  evidence?: {
    mobile?: {
      loadingDiagnostics?: LoadingDiagnostics;
      findings?: LighthouseFinding[];
      topFindings?: LighthouseFinding[];
    } | null;
    desktop?: {
      loadingDiagnostics?: LoadingDiagnostics;
      findings?: LighthouseFinding[];
      topFindings?: LighthouseFinding[];
    } | null;
  };
  runs?: Record<
    string,
    {
      status: string;
      error?: string;
      warnings?: string[];
      testedAt?: string;
      lighthouseVersion?: string | null;
    }
  >;
};
export type FindingDetail = {
  id: string;
  title: string;
  technicalTitle?: string;
  priority: string;
  finding: string;
  impact: string;
  action: string;
  affectedPages?: number;
  affectedUrls?: string[];
  devices?: string[];
  source?: string;
  scoreNote?: string;
  evidence?: Array<{
    url: string;
    device?: string;
    title?: string;
    loadingDiagnostics?: LoadingDiagnostics;
    affectedItemCount?: number;
    numericValue?: number | null;
    numericUnit?: string | null;
    scoringWeight?: number;
    displayValue?: string | null;
    estimatedSavingsMs?: number | null;
    estimatedSavingsBytes?: number | null;
    items?: EvidenceItem[];
    referringPages?: string[];
  }>;
};
export type AuditNarrative = {
  clientNextStep?: string;
  linkCoverage?: LinkCoverage;
  executiveSummary: string;
  keyIssues: string[];
  businessImpact: string[];
  recommendations: string[];
  strengths?: string[];
  scopeNotes?: string[];
  findingDetails?: FindingDetail[];
  analyticsStatement?: string;
  roadmap?: { immediate: string[]; nearTerm: string[]; ongoing: string[] };
  priorities?: Array<{
    title: string;
    finding: string;
    impact: string;
    action: string;
    tone?: string;
  }>;
};
export type PageResult = {
  url: string;
  finalUrl?: string;
  pageType: string;
  status: string;
  title?: string;
  httpStatus?: number | null;
  error?: string | null;
};
export type DeepResult = {
  url: string;
  pageType: string;
  pageTitle?: string | null;
  scores: Scores | null;
  error?: string | null;
};
export type FullSiteAuditResult = {
  linkChecks?: Array<{
    url: string;
    status: string;
    httpStatus?: number | null;
    referringPages?: string[];
  }>;
  success: boolean;
  status?: string;
  generatedAt?: string;
  error?: string;
  discovery?: {
    origin: string;
    url: string;
    discoveredCount: number;
    discoveredPages: string[];
    recommendedPages: string[];
    reviewedPageCount?: number;
    discoveryLimited?: boolean;
    source: string;
  };
  lightweightResults?: PageResult[];
  deepResults?: DeepResult[];
  selectedDeepAuditPages?: string[];
  siteReport?: AuditNarrative;
  deepSummary?: {
    count: number;
    attemptedCount: number;
    failedCount: number;
    partialCount?: number;
    mobileCount?: number;
    desktopCount?: number;
    averageMobilePerformance: number | null;
    averageSeo: number | null;
    averageAccessibility: number | null;
    averageBestPractices: number | null;
    homepageDesktopPerformance: number | null;
  };
  techStack?: unknown;
  issueSummary?: unknown[];
  journeySummary?: unknown;
  coverage?: unknown;
};
