'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'

function vapidKey(value: string) {
  const normalized = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0))
}

export default function PushNotificationControl({ slug, token }: { slug: string; token: string }) {
  const [supported, setSupported] = useState(true)
  const [configured, setConfigured] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [publicKey, setPublicKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [iosInstall, setIosInstall] = useState(false)

  useEffect(() => {
    const canPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(canPush)
    setIosInstall(/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches)
    if (!canPush) return
    fetch(`/api/client-activity/push?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`).then((response) => response.json()).then(async (result) => {
      setConfigured(Boolean(result.configured)); setPublicKey(result.publicKey || '')
      const registration = await navigator.serviceWorker.register('/quicklink-sw.js')
      setEnabled(Boolean(await registration.pushManager.getSubscription()))
    }).catch(() => setSupported(false))
  }, [slug, token])

  async function toggle() {
    setBusy(true); setMessage('')
    try {
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      if (existing) {
        await fetch('/api/client-activity/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, token, endpoint: existing.endpoint }) })
        await existing.unsubscribe(); setEnabled(false); setMessage('Notifications disabled on this device.')
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') throw new Error('Notifications were not allowed in this browser.')
        const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey(publicKey) })
        const response = await fetch('/api/client-activity/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, token, subscription: subscription.toJSON() }) })
        if (!response.ok) { await subscription.unsubscribe(); throw new Error('Unable to save this device.') }
        setEnabled(true); setMessage('Notifications enabled on this device.')
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update notifications.') }
    setBusy(false)
  }

  if (!configured || !supported) return null
  return <div className="rounded-2xl border border-[#deded7] bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Activity notifications</p><p className="mt-1 text-xs text-[#77776f]">Get new order, booking and service request alerts on this device.</p></div><button type="button" disabled={busy || iosInstall} onClick={toggle} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1d1d1b] px-4 text-sm font-semibold text-white disabled:opacity-50">{enabled ? <BellOff size={15}/> : <Bell size={15}/>} {busy ? 'Updating…' : enabled ? 'Disable notifications' : 'Enable notifications'}</button></div>
    {iosInstall && <p className="mt-3 text-xs text-[#8b6b3d]">On iPhone or iPad, first open Share → Add to Home Screen, then enable notifications from the installed Quicklink app.</p>}
    {message && <p role="status" className="mt-3 text-xs text-[#77776f]">{message}</p>}
  </div>
}
