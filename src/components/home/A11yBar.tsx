'use client'

// A11yBar.tsx — Accessibility controls bar
// Imported directly in layout.tsx so it renders on every page.

import React, { useState, useEffect, useRef } from 'react'

export default function A11yBar() {
  const [open, setOpen]         = useState(false)
  const [textSize, setTextSize] = useState(0)   // -1, 0, +1, +2
  const [contrast, setContrast] = useState(false)
  const [invert, setInvert]     = useState(false)
  const [dark, setDark]         = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sizes = [14, 16, 19, 22]
    document.documentElement.style.fontSize = sizes[textSize + 1] + 'px'
  }, [textSize])

  useEffect(() => {
    const cl = document.documentElement.classList
    cl.toggle('a11y-high-contrast', contrast)
    cl.toggle('a11y-invert', invert)
    cl.toggle('a11y-dark', dark)
  }, [contrast, invert, dark])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const btnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)',
    color: '#fff', fontFamily: 'system-ui', fontSize: '10px', fontWeight: 700,
    padding: '3px 8px', borderRadius: '4px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '4px',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
      <button style={btnStyle} onClick={() => setTextSize(t => Math.max(-1, t - 1))} title="Decrease text size" aria-label="Decrease text size">A−</button>
      <button style={btnStyle} onClick={() => setTextSize(0)}                          title="Reset text size"    aria-label="Reset text size">A</button>
      <button style={btnStyle} onClick={() => setTextSize(t => Math.min(2, t + 1))}   title="Increase text size" aria-label="Increase text size">A+</button>

      <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,.2)' }}/>

      <button onClick={() => setOpen(v => !v)} style={btnStyle}
        aria-label="More accessibility options" aria-expanded={open} aria-haspopup="true">
        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
        </svg>
        Accessibility
        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
          <path d={open ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'}/>
        </svg>
      </button>

      {open && (
        <div ref={panelRef} role="dialog" aria-label="Accessibility options"
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: '4px',
            background: '#fff', border: '1px solid var(--rule)',
            borderRadius: '8px', padding: '16px', width: '260px',
            boxShadow: '0 8px 24px rgba(0,0,0,.18)', zIndex: 100,
          }}>
          <div style={{ fontFamily: 'system-ui', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: '12px' }}>
            Accessibility Options
          </div>

          {/* Text size */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontFamily: 'system-ui', fontSize: '11px', color: 'var(--ink2)', marginBottom: '6px' }}>Text Size</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[{ label: 'A−', val: -1 }, { label: 'A', val: 0 }, { label: 'A+', val: 1 }, { label: 'A++', val: 2 }].map(({ label, val }) => (
                <button key={val} onClick={() => setTextSize(val)}
                  aria-pressed={textSize === val}
                  style={{
                    flex: 1, padding: '6px 0', fontFamily: 'system-ui', fontWeight: 700,
                    fontSize: label === 'A−' ? '11px' : label === 'A' ? '13px' : label === 'A+' ? '15px' : '17px',
                    border: '1px solid', borderRadius: '5px', cursor: 'pointer',
                    borderColor: textSize === val ? 'var(--navy)' : 'var(--rule)',
                    background: textSize === val ? 'var(--navy-lt)' : '#fff',
                    color: textSize === val ? 'var(--navy)' : 'var(--ink)',
                  }}>{label}</button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          {[
            { label: 'High Contrast',  val: contrast, set: setContrast, desc: 'Increase colour contrast' },
            { label: 'Invert Colours', val: invert,   set: setInvert,   desc: 'Invert all colours' },
            { label: 'Dark Mode',      val: dark,     set: setDark,     desc: 'Switch to dark theme' },
          ].map(({ label, val, set, desc }) => (
            <button key={label} onClick={() => set((v: boolean) => !v)} aria-pressed={val}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', marginBottom: '6px', borderRadius: '6px', cursor: 'pointer',
                border: `1px solid ${val ? 'var(--navy)' : 'var(--rule)'}`,
                background: val ? 'var(--navy-lt)' : '#fff',
              }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: 'system-ui', fontSize: '12px', fontWeight: 600, color: val ? 'var(--navy)' : 'var(--ink)' }}>{label}</div>
                <div style={{ fontFamily: 'system-ui', fontSize: '10px', color: 'var(--ink3)' }}>{desc}</div>
              </div>
              <div style={{ width: '36px', height: '20px', borderRadius: '10px', flexShrink: 0, background: val ? 'var(--navy)' : 'var(--rule)', position: 'relative', transition: 'background .2s' }}>
                <div style={{ position: 'absolute', top: '2px', left: val ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left .2s' }}/>
              </div>
            </button>
          ))}

          <button onClick={() => { setTextSize(0); setContrast(false); setInvert(false); setDark(false) }}
            style={{ width: '100%', padding: '7px', fontFamily: 'system-ui', fontSize: '11px', color: 'var(--ink3)', background: 'none', border: '1px solid var(--rule)', borderRadius: '5px', cursor: 'pointer', marginTop: '4px' }}>
            Reset all
          </button>
        </div>
      )}
    </div>
  )
}
