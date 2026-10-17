"use client";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { X } from "lucide-react";
import { getProfileLogo } from "../lib/profileStorage";
import type { UserProfile } from "../lib/profileStorage";
import "./auditReport.css";

async function logoFromFile(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose a PNG, JPG or WebP logo.");
  if (file.size > 2_000_000)
    throw new Error("Choose an image smaller than 2 MB.");
  const image = await createImageBitmap(file);
  try {
    if (
      !image.width ||
      !image.height ||
      image.width * image.height > 25_000_000
    )
      throw new Error("Choose a smaller logo image.");
    const scale = Math.min(1, 1200 / image.width, 500 / image.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the logo.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL("image/png");
    if (data.length > 500_000) data = canvas.toDataURL("image/webp", 0.88);
    if (!getProfileLogo(data))
      throw new Error("The logo is too large to save. Choose a smaller image.");
    return data;
  } finally {
    image.close();
  }
}

export default function AuditBrandDialog({
  profile,
  onClose,
  onSave,
}: {
  profile: UserProfile;
  onClose: () => void;
  onSave: (profile: UserProfile) => void | Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(profile),
    [error, setError] = useState("");
  const [saving, setSaving] = useState(false),
    [processing, setProcessing] = useState(false);
  const [failedLogo, setFailedLogo] = useState("");
  const uploadVersion = useRef(0);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      uploadVersion.current++;
      element?.close();
    };
  }, []);
  const fields: {
    key: Exclude<keyof UserProfile, "yourLogo">;
    label: string;
    required?: boolean;
  }[] = [
    { key: "yourName", label: "Your name", required: true },
    { key: "yourCompany", label: "Company", required: true },
    { key: "yourTitle", label: "Role / title" },
    { key: "yourLocation", label: "Location" },
    { key: "yourSpecialty", label: "Speciality" },
    { key: "yourWebsite", label: "Website" },
    { key: "yourLinkedIn", label: "LinkedIn" },
  ];
  const chooseLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const version = ++uploadVersion.current;
    setProcessing(true);
    setError("");
    try {
      const logo = await logoFromFile(file);
      if (version === uploadVersion.current) {
        setDraft((prev) => ({ ...prev, yourLogo: logo }));
        setFailedLogo("");
      }
    } catch (err) {
      if (version === uploadVersion.current)
        setError(
          err instanceof Error ? err.message : "The logo could not be opened.",
        );
    } finally {
      if (version === uploadVersion.current) setProcessing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (processing || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave({ ...draft, yourLogo: getProfileLogo(draft.yourLogo) });
    } catch {
      setError(
        "Your details could not be saved in this browser. Please try again, or remove the logo if browser storage is full.",
      );
    } finally {
      setSaving(false);
    }
  };
  const logo = getProfileLogo(draft.yourLogo);
  return (
    <dialog
      ref={dialog}
      className="prism-brand-dialog"
      aria-labelledby="brand-heading"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="prism-dialog-heading">
          <h2 id="brand-heading">Make the report yours</h2>
          <button
            type="button"
            className="prism-icon-button"
            onClick={onClose}
            aria-label="Close branding"
          >
            <X size={20} />
          </button>
        </div>
        <p className="prism-muted">
          Your logo and professional details appear in the report and PDF.
        </p>
        <div className="prism-brand-fields">
          <div className="audit-logo-field prism-field-wide">
            <label htmlFor="audit-logo">
              <span>Company logo (optional)</span>
              <input
                ref={fileInput}
                id="audit-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={chooseLogo}
                disabled={processing || saving}
              />
            </label>
            <p className="audit-brand-help">
              PNG, JPG or WebP, up to 2 MB. A transparent or dark logo works
              best on the white report. Branding is saved in this browser.
            </p>
            {processing && (
              <p role="status" className="audit-brand-help">
                Preparing your logo…
              </p>
            )}
            {logo && failedLogo !== logo && (
              <div className="audit-logo-preview">
                <img
                  src={logo}
                  alt="Your report logo preview"
                  onError={() => setFailedLogo(logo)}
                />
              </div>
            )}
            {failedLogo === logo && logo && (
              <p className="audit-brand-help">
                This saved logo could not be displayed. Choose another image or
                remove it.
              </p>
            )}
            {logo && (
              <button
                type="button"
                className="prism-button-secondary"
                disabled={saving}
                onClick={() => {
                  uploadVersion.current++;
                  setProcessing(false);
                  setDraft((prev) => ({ ...prev, yourLogo: "" }));
                }}
              >
                Remove logo
              </button>
            )}
          </div>
          {fields.map(({ key, label, required }) => (
            <label
              key={key}
              className={key === "yourSpecialty" ? "prism-field-wide" : ""}
            >
              <span>{label}</span>
              <input
                value={draft[key] || ""}
                required={required}
                autoFocus={key === "yourName"}
                disabled={saving}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, [key]: event.target.value }))
                }
              />
            </label>
          ))}
        </div>
        {error && (
          <p className="prism-error" role="alert">
            {error}
          </p>
        )}
        <div className="prism-dialog-actions">
          <button
            type="button"
            className="prism-button-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="prism-button-primary"
            disabled={saving || processing}
          >
            {saving ? "Saving…" : "Save details"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
