'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { X } from 'lucide-react'
import type { UserProfile } from '../lib/profileStorage'

export default function AuditBrandDialog({ profile, onClose, onSave }: {
  profile: UserProfile
  onClose: () => void
  onSave: (profile: UserProfile) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState(profile)
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { element?.close() }
  }, [])

  const fields: { key: keyof UserProfile; label: string; required?: boolean }[] = [
    { key: 'yourName', label: 'Your name', required: true },
    { key: 'yourCompany', label: 'Company', required: true },
    { key: 'yourTitle', label: 'Role / title' },
    { key: 'yourLocation', label: 'Location' },
    { key: 'yourSpecialty', label: 'Speciality' },
    { key: 'yourWebsite', label: 'Website' },
    { key: 'yourLinkedIn', label: 'LinkedIn' },
  ]
  const submit = (event: FormEvent) => {
    event.preventDefault()
    try { onSave(draft) } catch { setError('Your details could not be saved in this browser. Please try again.') }
  }
  return (
    <dialog ref={dialog} className="prism-brand-dialog" aria-labelledby="brand-heading" onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
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
        <h2 id="brand-heading">Make the report yours</h2>
        <p className="prism-muted">Your professional details appear on the Report preview.</p>
        <div className="prism-brand-fields">
          {fields.map(({ key, label, required }) => (
            <label key={key} className={key === 'yourSpecialty' ? 'prism-field-wide' : ''}>
              <span>{label}</span>
              <input value={draft[key] || ''} required={required} autoFocus={key === 'yourName'}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
            </label>
          ))}
        </div>
        {error && <p className="prism-error" role="alert">{error}</p>}
        <div className="prism-dialog-actions">
          <button type="button" className="prism-button-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="prism-button-primary">Save details</button>
        </div>
      </form>
    </dialog>
  )
}
