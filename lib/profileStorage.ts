export type UserProfile = {
  yourName: string;
  yourTitle: string;
  yourCompany: string;
  yourLocation: string;
  yourSpecialty: string;
  yourWebsite?: string;
  yourLinkedIn?: string;
  /** Optional, bounded raster image stored with this browser's branding. */
  yourLogo?: string;
};

export const DEFAULT_PROFILE: UserProfile = {
  yourName: "Jessica Manning",
  yourTitle: "Founder | Web Developer & Digital Solutions Specialist",
  yourCompany: "JM Sites",
  yourLocation: "Sydney, Australia",
  yourSpecialty: "Webflow, CMS Architecture & Front-End Development",
  yourWebsite: "https://jmsites.dev",
  yourLinkedIn: "https://www.linkedin.com/in/jess-manning-dev/",
};

// Preserve existing branding and its original storage key.
const STORAGE_KEY = "clientFinderProfile";
export function getProfileLogo(value: unknown): string {
  if (typeof value !== "string" || value.length > 600_000) return "";
  return /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
    value,
  )
    ? value
    : "";
}
function completeProfile(value: unknown): UserProfile {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const read = (key: keyof UserProfile) =>
    typeof record[key] === "string" && (record[key] as string).trim()
      ? (record[key] as string).trim()
      : DEFAULT_PROFILE[key] || "";
  return {
    yourName: read("yourName"),
    yourTitle: read("yourTitle"),
    yourCompany: read("yourCompany"),
    yourLocation: read("yourLocation"),
    yourSpecialty: read("yourSpecialty"),
    yourWebsite: read("yourWebsite"),
    yourLinkedIn: read("yourLinkedIn"),
    yourLogo: getProfileLogo(record.yourLogo),
  };
}
export function getStoredProfile(): UserProfile {
  if (typeof window === "undefined") return { ...DEFAULT_PROFILE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? completeProfile(JSON.parse(raw)) : { ...DEFAULT_PROFILE };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}
export function saveStoredProfile(profile: UserProfile) {
  if (typeof window === "undefined") return;
  // Let storage errors reach the dialog instead of claiming the save succeeded.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(completeProfile(profile)));
}
export function hasCompletedProfile(profile: UserProfile) {
  return Boolean(profile?.yourName?.trim() && profile?.yourCompany?.trim());
}
