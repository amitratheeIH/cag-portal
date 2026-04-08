'use client'
// NavigationProgress.tsx
// Thin top progress bar that animates on every client-side navigation.
// Uses usePathname to detect route changes — no external libraries needed.

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function NavigationProgress() {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [progress,  setProgress]  = useState(0)
  const [visible,   setVisible]   = useState(false)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const completeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Start bar on mount and every route change
  useEffect(() => {
    // Clear any running animation
    if (timerRef.current)   clearInterval(timerRef.current)
    if (completeRef.current) clearTimeout(completeRef.current)

    // Show and start moving
    setVisible(true)
    setProgress(0)

    // Quickly jump to 20% then slowly crawl to 85%
    let current = 0
    timerRef.current = setInterval(() => {
      current += current < 20 ? 10 : current < 50 ? 4 : current < 80 ? 1 : 0.3
      if (current >= 85) {
        clearInterval(timerRef.current!)
        current = 85
      }
      setProgress(current)
    }, 50)

    // Complete — jump to 100% then fade out
    completeRef.current = setTimeout(() => {
      clearInterval(timerRef.current!)
      setProgress(100)
      setTimeout(() => setVisible(false), 300)
    }, 500)

    return () => {
      clearInterval(timerRef.current!)
      clearTimeout(completeRef.current!)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  if (!visible) return null

  return (
    <div style={{
      position:  'fixed',
      top:       0,
      left:      0,
      width:     progress + '%',
      height:    '3px',
      background:'linear-gradient(90deg, #f59e0b, #fbbf24)',
      zIndex:    9999,
      transition: progress === 100
        ? 'width .15s ease-out, opacity .3s .15s ease'
        : 'width .15s ease-out',
      opacity:   progress === 100 ? 0 : 1,
      boxShadow: '0 0 8px rgba(245,158,11,.6)',
    }} />
  )
}
