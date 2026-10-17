'use client'

import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'
import './WebsiteReportArt.css'

// An illustrative website-to-report loop, not real audit results or progress.
// Preserves the existing page integration: <PrismScanner running={isRunning} />.
export default function PrismScanner({ running = false }: { running?: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = root.current
    if (!element) return
    let visible = true
    const pause = () => { element.dataset.paused = String(!visible || document.hidden) }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; pause() })
    observer.observe(element)
    document.addEventListener('visibilitychange', pause)
    pause()
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', pause) }
  }, [])

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const box = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--wr-x', `${((event.clientX - box.left) / box.width - .5) * 8}deg`)
    event.currentTarget.style.setProperty('--wr-y', `${-((event.clientY - box.top) / box.height - .5) * 6}deg`)
  }

  return (
    <div ref={root} className={`wr-art ${running ? 'wr-running' : ''}`} aria-hidden="true"
      onPointerMove={move} onPointerLeave={(event) => {
        event.currentTarget.style.removeProperty('--wr-x')
        event.currentTarget.style.removeProperty('--wr-y')
      }}>
      <div className="wr-floor-glow" />
      <div className="wr-perspective">
        <div className="wr-float">
          <div className="wr-computer">
            <div className="wr-display">
              <div className="wr-screen">
                <div className="wr-browser-bar"><span /><span /><span /><i /></div>
                <div className="wr-website">
                  <div className="wr-website-nav"><span className="wr-site-mark" /><i /><i /><i /></div>
                  <div className="wr-website-hero">
                    <div className="wr-website-copy"><b /><b /><span /><span /><i /></div>
                    <div className="wr-website-visual"><span /><i /></div>
                  </div>
                  <div className="wr-site-cards">
                    {[0, 1, 2].map((index) => <div key={index}><span /><i /><i /></div>)}
                  </div>
                  <div className="wr-website-footer"><span /><span /></div>
                </div>
                <div className="wr-scanning-grid" />
                <div className="wr-scan-beam" />
              </div>
              <div className="wr-monitor-chin"><span /></div>
            </div>
            <div className="wr-monitor-neck" />
            <div className="wr-monitor-base" />
          </div>

          <div className="wr-data-path"><span /><span /><span /></div>

          <div className="wr-output-report">
            <div className="wr-report-gloss" />
            <div className="wr-paper-corner" />
            <div className="wr-paper-title"><span /><i /></div>
            <div className="wr-paper-summary"><span /><span /></div>
            <div className="wr-paper-divider" />
            <div className="wr-paper-finding"><i /><div><span /><span /></div></div>
            <div className="wr-paper-finding"><i /><div><span /><span /></div></div>
            <div className="wr-paper-finding"><i /><div><span /><span /></div></div>
            <div className="wr-paper-chart"><i /><i /><i /><i /></div>
          </div>
        </div>
      </div>
      
    </div>
  )
}
