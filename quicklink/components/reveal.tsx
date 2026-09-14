'use client'

import { useEffect, useRef } from 'react'

/** Content stays visible without JS; only animate when it first enters view. */
export default function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element || !('IntersectionObserver' in window)) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      if (!preference.matches) element.classList.add('ql-enter')
      observer.disconnect()
    }, { threshold: 0.12 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} className={className}>{children}</div>
}
