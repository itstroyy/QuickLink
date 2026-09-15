'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function ModalDialog({ open, title, description, busy = false, onClose, children, maxWidth = 'max-w-md', role = 'dialog' }: {
  open: boolean
  title: string
  description?: string
  busy?: boolean
  onClose: () => void
  children: ReactNode
  maxWidth?: string
  role?: 'dialog' | 'alertdialog'
}) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const busyRef = useRef(busy)
  onCloseRef.current = onClose
  busyRef.current = busy

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('[data-autofocus], ' + focusable)
    window.requestAnimationFrame(() => first?.focus())

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(focusable))
      if (!items.length) return
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-4 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <div className="flex min-h-full items-center justify-center">
        <div ref={panelRef} className={`w-full ${maxWidth} max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-[#deded7] bg-white p-5 shadow-2xl sm:p-6`} role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
          <h2 id={titleId} className="text-xl font-semibold">{title}</h2>
          {description && <p id={descriptionId} className="mt-2 text-sm leading-6 text-[#67675f]">{description}</p>}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
