'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useSupabaseSession } from '../../../lib/useSupabaseSession'
import { AUTH_REQUIRED } from '../../../lib/authGuestMode'
import {
  DEFAULT_PROFILE,
  getStoredProfile,
  saveStoredProfile,
} from '../../../lib/profileStorage'
import type { UserProfile } from '../../../lib/profileStorage'
import type { TechStack } from '../../../lib/techStack'

import ReportWorkspace from '../../../components/ReportWorkspace'
import FullSiteAuditReport from '../../../components/FullSiteAuditReport'
import type { FullSiteAuditResult } from '../../../components/FullSiteAuditReport'
import AuditBrandDialog from '../../../components/AuditBrandDialog'
import PrismScanner from '../../../components/PrismScanner'
import { ArrowRight, ArrowLeft, FileText, Palette, Plus, Search, Monitor, Globe, Layers, Clock3, Trash2, PanelLeftClose, PanelLeftOpen, ChevronRight } from 'lucide-react'
import './sitebrief.css'

type View = 'new' | 'reports' | 'report'
type ScanMode = 'quick' | 'full-site'

interface DeviceScores {
  performance: number | null
  seo: number | null
  accessibility: number | null
  bestPractices: number | null
}

interface AuditScores {
  mobile: DeviceScores
  desktop: DeviceScores
  overallScore: number
  details: Record<string, unknown>
}

interface ReportContent {
  executiveSummary: string
  keyIssues: string[]
  businessImpact: string[]
  recommendations: string[]
}

interface SavedAudit {
  id: string
  url: string
  savedAt: string
  pageTitle?: string | null
  scores?: AuditScores | null
  techStack?: TechStack | null
  report?: Partial<ReportContent> | null
  overallScore?: number
  performance?: number
  mobilePerformance?: number
  desktopPerformance?: number
  seo?: number
  accessibility?: number
  bestPractices?: number
  status?: string
  notes?: string
  fullSiteResult?: FullSiteAuditResult
}

interface LegacyAudit extends SavedAudit {
  date?: string
  aiReport?: Partial<ReportContent>
}

const HISTORY_KEY = 'siteSignalAuditHistory'

const theme = {
  '--background': '#faf9f7',
  '--foreground': '#271436',
  '--card': '#ffffff',
  '--card-foreground': '#271436',
  '--popover': '#ffffff',
  '--popover-foreground': '#271436',
  '--primary': '#6135ad',
  '--primary-foreground': '#ffffff',
  '--secondary': '#f1edf5',
  '--secondary-foreground': '#493955',
  '--muted': '#f3f0f5',
  '--muted-foreground': '#756b80',
  '--accent': '#eee7f8',
  '--accent-foreground': '#6135ad',
  '--border': '#e5dfe9',
  '--input': '#e5dfe9',
  '--ring': '#6135ad',
  colorScheme: 'light',
} as CSSProperties

function normaliseUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  return /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
}

function displayUrl(value: string) {
  try {
    const url = new URL(normaliseUrl(value))
    const path = url.pathname === '/' ? '' : url.pathname

    return `${url.hostname.replace(/^www\./, '')}${path}`
  } catch {
    return value
  }
}

function reportTitle(entry: SavedAudit) {
  return entry.pageTitle?.trim() || displayUrl(entry.url)
}

function displayDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Date unavailable'

  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function normaliseReport(
  report?: Partial<ReportContent> | null
): ReportContent {
  return {
    executiveSummary: report?.executiveSummary ?? '',
    keyIssues: report?.keyIssues ?? [],
    businessImpact: report?.businessImpact ?? [],
    recommendations: report?.recommendations ?? [],
  }
}

function readHistory(): SavedAudit[] {
  const parsed: unknown = JSON.parse(
    localStorage.getItem(HISTORY_KEY) || '[]'
  )

  if (!Array.isArray(parsed)) return []

  return parsed
    .filter(
      (entry): entry is LegacyAudit =>
        entry !== null &&
        typeof entry === 'object' &&
        typeof entry.url === 'string'
    )
    .map((entry, index) => ({
      ...entry,
      id: entry.id || `legacy-${index}`,
      savedAt:
        entry.savedAt || entry.date || new Date().toISOString(),
      report: entry.report ?? entry.aiReport ?? null,
    }))
}

function scoresFor(entry: SavedAudit): AuditScores {
  if (entry.scores) return entry.scores

  return {
    mobile: {
      performance:
        entry.mobilePerformance ?? entry.performance ?? null,
      seo: entry.seo ?? null,
      accessibility: entry.accessibility ?? null,
      bestPractices: entry.bestPractices ?? null,
    },
    desktop: {
      performance: entry.desktopPerformance ?? null,
      seo: null,
      accessibility: null,
      bestPractices: null,
    },
    overallScore: entry.overallScore ?? 0,
    details: {},
  }
}

function ReportsTable({
  entries,
  onOpen,
  onDelete,
}: {
  entries: SavedAudit[]
  onOpen: (entry: SavedAudit) => void
  onDelete: (entry: SavedAudit) => void
}) {
  if (!entries.length) {
    return (
      <div className="prism-empty">
        <span className="prism-icon-tile">
          <FileText size={22} />
        </span>

        <div>
          <p>Create your first report</p>
          <span>
            Scan a website to get started. Your report will be saved in this browser.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="prism-report-list">
      {entries.map((entry) => (
        <div className="prism-report-row" key={entry.id}>
          <span className="prism-icon-tile">
            <FileText size={21} />
          </span>

          <span className="prism-report-name">
            <strong title={reportTitle(entry)}>
              {reportTitle(entry).split(/\s[|–—]\s/)[0]}
            </strong>
            <span>{displayUrl(entry.url)}</span>
          </span>

          <span className="prism-report-date">
            {displayDate(entry.savedAt)}
          </span>

          <span className="prism-scope-badge">
            {entry.fullSiteResult ? 'Website review' : 'Single page'}
          </span>

          <div className="prism-report-actions">
            <button
              type="button"
              className="prism-report-open"
              onClick={() => onOpen(entry)}
            >
              Open report <ArrowRight size={18} />
            </button>

            <button
              type="button"
              className="prism-delete-report"
              onClick={() => onDelete(entry)}
              aria-label={`Delete report for ${displayUrl(entry.url)}`}
              title="Delete report"
            >
              <Trash2 size={22} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AuditPage() {
  return (
    <Suspense
      fallback={
        <div className="prism-loading">
          Loading your workspace…
        </div>
      }
    >
      <AuditUnfoldWorkspace />
    </Suspense>
  )
}

function AuditUnfoldWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const {
    userId,
    email,
    loading: authLoading,
  } = useSupabaseSession()

  const [view, setView] = useState<View>('new')
  const [url, setUrl] = useState('')
  const [scanMode, setScanMode] = useState<ScanMode>('quick')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [history, setHistory] = useState<SavedAudit[]>([])
  const [audit, setAudit] = useState<SavedAudit | null>(null)
  const [fullSite, setFullSite] =
    useState<FullSiteAuditResult | null>(null)

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [brandingOpen, setBrandingOpen] = useState(false)

  const runningRef = useRef(false)
  const dirtyRef = useRef(false)
  const [elapsed, setElapsed] = useState(0)
  const queryUrl = searchParams.get('url') || ''
const navigateTo = (nextView: View, reportId?: string) => {
  const nextUrl = new URL(window.location.href)

  nextUrl.searchParams.delete('url')
  nextUrl.searchParams.delete('view')
  nextUrl.searchParams.delete('report')

  if (nextView === 'reports') {
    nextUrl.searchParams.set('view', 'reports')
  }

  if (nextView === 'report' && reportId) {
    nextUrl.searchParams.set('report', reportId)
  }

  window.history.pushState(null, '', nextUrl)
}
  useEffect(() => {
    if (!isRunning) return
    const started = Date.now()
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [isRunning])

  const canLeave = () => !dirtyRef.current || window.confirm('Leave this report without saving your changes?')
  const handleDirtyChange = useCallback((dirty: boolean) => { dirtyRef.current = dirty }, [])


  useEffect(() => {
    if (authLoading) return

    if (AUTH_REQUIRED && !userId) {
      router.replace('/signin')
      return
    }

    const storedProfile = getStoredProfile()
    if (storedProfile) setProfile(storedProfile)

    try {
      setHistory(readHistory())
    } catch {
      setError('Saved reports could not be read from this browser.')
    }
  }, [authLoading, userId, router])

  useEffect(() => {
    if (queryUrl) setUrl(queryUrl)
  }, [queryUrl])

  const refreshHistory = useCallback(() => {
    try {
      setHistory(readHistory())
    } catch {
      setError('Saved reports could not be read from this browser.')
    }
  }, [])
useEffect(() => {
  if (authLoading || (AUTH_REQUIRED && !userId)) return

  const restoreLocation = () => {
    const params = new URLSearchParams(window.location.search)
    const reportId = params.get('report')
    const requestedView = params.get('view')

    if (reportId) {
      try {
        const entry = readHistory().find((item) => item.id === reportId)

        if (entry) {
          setHistory(readHistory())
          setAudit(entry.fullSiteResult ? null : entry)
          setFullSite(entry.fullSiteResult ?? null)
          setView('report')
          return
        }
      } catch {
        setError('This saved report could not be opened.')
      }

      setError('This report is no longer available in this browser.')
      setView('reports')
      return
    }

    setAudit(null)
    setFullSite(null)
    setView(requestedView === 'reports' ? 'reports' : 'new')
  }

  restoreLocation()

  window.addEventListener('popstate', restoreLocation)

  return () => {
    window.removeEventListener('popstate', restoreLocation)
  }
}, [authLoading, userId])
  const openReport = (entry: SavedAudit) => {
    if (!canLeave()) return
    setAudit(entry.fullSiteResult ? null : entry)
    setFullSite(entry.fullSiteResult || null)
    setError(null)
    setView('report')
    navigateTo('report', entry.id)
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  const startNew = () => {
    if (runningRef.current || !canLeave()) return

    setAudit(null)
    setFullSite(null)
    setError(null)
    setUrl('')
    setView('new')
    navigateTo('new')
    refreshHistory()
  }

  const showReports = () => {
    if (runningRef.current || !canLeave()) return

    refreshHistory()
    setError(null)
    setView('reports')
    navigateTo('reports')
  }

  const runAudit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (runningRef.current || (AUTH_REQUIRED && !userId)) return

    const target = normaliseUrl(url)

    try {
      const parsed = new URL(target)

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Unsupported URL')
      }
    } catch {
      setError('Enter a valid website URL, such as example.com.au.')
      return
    }

    runningRef.current = true
    setIsRunning(true)
    setElapsed(0)
    setError(null)
    setAudit(null)
    setFullSite(null)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (userId) headers['x-user-id'] = userId

      const response = await fetch(
        scanMode === 'full-site'
          ? '/api/site-discovery'
          : '/api/audit',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            url: target,
            scanMode,
          }),
        }
      )

      const json = await response.json()

      if (!response.ok || !json.success) {
        setError(json.error || 'The scan could not finish. Please try again.')
        return
      }

      if (scanMode === 'full-site') {
        setFullSite(json)
        setView('report')
        try {
          const entry: SavedAudit = {
            id: crypto.randomUUID(),
            url: target,
            savedAt: new Date().toISOString(),
            pageTitle: displayUrl(target),
            fullSiteResult: json,
          }
          const updated = [entry, ...readHistory()].slice(0, 50)
          localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
          setHistory(updated)
          navigateTo('report', entry.id)
        } catch {
          setError('Your report is ready, but could not be saved in this browser. Export a copy before leaving.')
        }
        return
      }

      if (!json.scores?.mobile || !json.scores?.desktop) throw new Error('Incomplete audit response')

      const entry: SavedAudit = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url: json.url || target,
        savedAt: json.scannedAt || new Date().toISOString(),
        pageTitle: json.pageTitle || null,
        scores: json.scores,
        techStack: json.techStack || null,
        report: normaliseReport(json.aiReport),
        overallScore: json.scores.overallScore,
        performance: json.scores.mobile.performance,
        mobilePerformance: json.scores.mobile.performance,
        desktopPerformance: json.scores.desktop.performance,
        seo: json.scores.mobile.seo,
        accessibility: json.scores.mobile.accessibility,
        bestPractices: json.scores.mobile.bestPractices,
        status: 'Saved',
        notes: '',
      }

      setAudit(entry)
      setView('report')

      try {
        // Keep every scan as its own version so edited reports are not replaced.
        const updated = [entry, ...readHistory()].slice(0, 50)

        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
        setHistory(updated)
        navigateTo('report', entry.id)
      } catch {
        setError(
          'Your report is ready, but could not be saved in this browser. Download a copy before leaving.'
        )
      }
    } catch {
      setError(
        'The scan could not finish. Check your connection and try again. If it keeps failing, try a single-page scan.'
      )
    } finally {
      runningRef.current = false
      setIsRunning(false)
    }
  }

  const deleteReport = (entry: SavedAudit) => {
  const confirmed = window.confirm(
    `Delete the saved report for ${displayUrl(entry.url)}? This cannot be undone.`
  )

  if (!confirmed) return

  try {
    const updated = readHistory().filter(
      (item) => item.id !== entry.id
    )

    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
    setHistory(updated)
    navigateTo('report', entry.id)
    setError(null)

    if (audit?.id === entry.id) {
      setAudit(null)
    }
  } catch {
    setError('The report could not be deleted. Please try again.')
  }
}

  const filteredHistory = history.filter((entry) =>
    `${entry.pageTitle || ''} ${entry.url}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  if (authLoading || (AUTH_REQUIRED && !userId)) {
    return (
      <div className="prism-loading">
        Loading your workspace…
      </div>
    )
  }

  return (
   <div
  className={
    'prism-app' + (sidebarOpen ? '' : ' is-nav-collapsed')
  }
>
      <a href="#audit-content" className="prism-skip-link">Skip to workspace</a>
      
      <aside id="workspace-sidebar" className="prism-sidebar">
      
        <div className="prism-brand">
          <svg viewBox="0 0 56 56" fill="none" aria-hidden="true"><path d="M28 5 5 47l46 4L28 5Zm0 0v30M5 47l23-12 23 16" stroke="currentColor" strokeWidth="1.8"/><path d="m5 47 23-12 23 16" stroke="#71deef" strokeWidth="2"/></svg>
          <div><strong>AuditUnfold</strong><span>by JM Sites</span></div>
       
        </div>
        
        <nav className="prism-nav" aria-label="Workspace">
          <button type="button" onClick={startNew} disabled={isRunning} className={view === 'new' ? 'is-active' : ''} aria-current={view === 'new' ? 'page' : undefined}><Plus size={21} /><span>New audit</span></button>
          <button type="button" onClick={showReports} disabled={isRunning} className={view !== 'new' ? 'is-active' : ''} aria-current={view !== 'new' ? 'page' : undefined}><FileText size={21} /><span>Your reports</span></button>
          <button type="button" onClick={() => setBrandingOpen(true)}><Palette size={21} /><span>Export / Branding</span></button>
        
        </nav>
       
        <div className="prism-sidebar-bottom">
  <div className="prism-sidebar-tools">
    <button
      type="button"
      className="prism-nav-toggle"
      onClick={() => setSidebarOpen((open) => !open)}
      aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      aria-expanded={sidebarOpen}
      title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      {sidebarOpen ? (
        <PanelLeftClose size={24} />
      ) : (
        <PanelLeftOpen size={24} />
      )}
    </button>
  </div>

  
</div>
      </aside>
      <main id="audit-content" className="prism-main">
       

        <div className="prism-content">
          {error && <div role="alert" className="prism-error">{error}</div>}
          {view === 'new' && <>
            <section className="prism-hero" aria-labelledby="start-heading">
  <div className="prism-hero-copy">
    <span className="prism-eyebrow">
      <Layers size={14} />
      Website audits and Report previews
    </span>

    <h1 id="start-heading">
      Check the website
      <br />
      <span>Create your report</span>
    </h1>

    <p>
      Check performance, accessibility and basic SEO.
      <br className="prism-desktop-break" />
      Add your observations and recommendations, then create
      a report for your client.
    </p>
  </div>

  <PrismScanner running={isRunning} />
</section>
            <form onSubmit={runAudit} className="prism-scan-card" aria-busy={isRunning}>
              <div className="prism-form-heading"><label htmlFor="website-url">Website URL</label></div>
              <div className="prism-url-row">
                <div className="prism-url-field"><Globe size={20}/><input id="website-url" type="text" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} value={url} onChange={(event) => setUrl(event.target.value)} disabled={isRunning} required placeholder="https://example.com.au" aria-describedby="audit-helper"/></div>
                <button
  type="submit"
  disabled={isRunning || !url.trim()}
  className="prism-button-primary"
>
  {isRunning ? (
    <>
      <span className="prism-spinner" />
      Scanning…
    </>
  ) : (
    <>
      Scan website <ArrowRight size={19} />
    </>
  )}
</button>
              </div>
             <fieldset className="prism-scope-picker" disabled={isRunning}>
  <legend className="prism-sr-only">
    Choose how much of the website to check
  </legend>

  <label
    className={
      'prism-scope-tile ' +
      (scanMode === 'quick' ? 'is-selected' : '')
    }
  >
    <input
      type="radio"
      name="scan-mode"
      value="quick"
      checked={scanMode === 'quick'}
      onChange={() => setScanMode('quick')}
    />

    <span className="prism-scope-icon">
      <Monitor size={21} />
    </span>

    <span>
      <strong>Single page</strong>
      <small>Check one page on mobile and desktop</small>
    </span>
  </label>

  <label
    className={
      'prism-scope-tile ' +
      (scanMode === 'full-site' ? 'is-selected' : '')
    }
  >
    <input
      type="radio"
      name="scan-mode"
      value="full-site"
      checked={scanMode === 'full-site'}
      onChange={() => setScanMode('full-site')}
    />

    <span className="prism-scope-icon">
      <Layers size={21} />
    </span>

    <span>
      <strong>Website review</strong>
      <small>Discover public pages and scan selected pages</small>
    </span>
  </label>
</fieldset>
             <div className="prism-form-footer" id="audit-helper">
  <span>
    Review the results and add your expertise before sharing.
  </span>

  <span>
    <FileText size={14} />
    Editable Report preview
  </span>
</div>

{isRunning && (
  <div
    className="prism-run-status"
    role="status"
    aria-live="polite"
  >
    <div>
      <span className="prism-spinner" />

      <strong>
        {scanMode === 'quick'
          ? 'Checking this page on mobile and desktop…'
          : 'Finding public pages and checking selected pages…'}
      </strong>
    </div>

    <span>
      <Clock3 size={14} />
      {elapsed}s elapsed
      {elapsed > 45
        ? ' · The scan is still running. Some websites take longer.'
        : ''}
    </span>
  </div>
)}
            </form>
            <div className="prism-journey" aria-label="Report workflow">
  <span>01 <strong>Scan website</strong></span>
  <i />
  <span>02 <strong>Add your expertise</strong></span>
  <i />
  <span>03 <strong>Export report</strong></span>
</div>
            <section className="prism-recent" aria-labelledby="recent-heading">
              <div className="prism-section-heading"><h2 id="recent-heading">Recent reports</h2><button onClick={showReports} disabled={isRunning}>View all reports <ArrowRight size={16}/></button></div>
              {isRunning ? <p className="prism-muted">You can reopen saved reports after this scan finishes.</p> : <ReportsTable
  entries={history.slice(0, 3)}
  onOpen={openReport}
  onDelete={deleteReport}
/>}
            </section>
          </>}
          {view === 'reports' && <section className="prism-library">
            <div className="prism-section-heading"><div><span className="prism-eyebrow">Saved website reviews</span><h1>Your reports</h1><p className="prism-muted">Open a saved report to review its findings and continue your work. Reports are stored in this browser.</p></div><button className="prism-button-primary" onClick={startNew}><Plus size={18}/> New audit</button></div>
            <label className="prism-search"><Search size={20}/><span className="prism-sr-only">Search saved reports</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by website name or URL"/></label>
            {history.length > 0 && !filteredHistory.length ? <p className="prism-muted">No reports match your search.</p> : <ReportsTable
  entries={filteredHistory}
  onOpen={openReport}
  onDelete={deleteReport}
/>}
          </section>}
          {view === 'report' && audit && <div className="prism-report-surface" style={theme}>
            <button
  type="button"
  className="prism-back-button"
  onClick={showReports}
>
  <ArrowLeft size={18} />
  All reports
</button>
            <ReportWorkspace key={audit.id} url={audit.url} pageTitle={audit.pageTitle} auditedAt={audit.savedAt}
              scores={scoresFor(audit)} report={normaliseReport(audit.report)} profile={profile}
              onNewAudit={startNew} onDirtyChange={handleDirtyChange} onEditBranding={() => setBrandingOpen(true)}
              onSave={(report) => {
                const updatedAudit = { ...audit, report }
                const existing = readHistory()
                const found = existing.some((entry) => entry.id === audit.id)
                const updatedHistory = found ? existing.map((entry) => entry.id === audit.id ? updatedAudit : entry) : [updatedAudit, ...existing].slice(0,50)
                localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory))
                setAudit(updatedAudit)
                setHistory(updatedHistory)
              }}/>
          </div>}
          {view === 'report' && fullSite && <div className="prism-report-surface" style={theme}>
            <button
  type="button"
  className="prism-back-button"
  onClick={showReports}
>
  <ArrowLeft size={18} />
  All reports
</button>
            <div className="prism-full-heading"><h1>Website review</h1><button type="button" onClick={startNew}>New audit</button></div>
            <FullSiteAuditReport result={fullSite} profile={profile}/>
          </div>}
        </div>
      </main>
      {brandingOpen && <AuditBrandDialog profile={profile} onClose={() => setBrandingOpen(false)} onSave={(nextProfile) => {
        saveStoredProfile(nextProfile)
        setProfile(nextProfile)
        setBrandingOpen(false)
      }}/>}
    </div>
  )
}
