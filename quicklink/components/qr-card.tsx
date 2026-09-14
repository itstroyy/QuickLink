'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, Download, Loader2 } from 'lucide-react'
import { useFeedback } from '@/components/feedback-provider'

export default function QrCard({ url, name }: { url: string; name: string }) {
  const [png, setPng] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notify = useFeedback()
  const filename = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr`
  useEffect(() => {
    let cancelled = false
    setPng(''); setError('')
    QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: '#171715', light: '#ffffff' } })
      .then((image) => { if (!cancelled) setPng(image) })
      .catch(() => { if (!cancelled) setError('Unable to generate QR. Please try again.') })
    return () => { cancelled = true }
  }, [url, attempt])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true); notify('Business URL copied.')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1800)
    } catch { notify('Could not copy. Select the business URL and copy it manually.', 'error') }
  }
  async function download(format: 'png' | 'svg') {
    if (!png || busy) return
    setBusy(true)
    let objectUrl: string | undefined
    try {
      const anchor = document.createElement('a')
      if (format === 'svg') {
        const svg = await QRCode.toString(url, { type: 'svg', margin: 2, color: { dark: '#171715', light: '#ffffff' } })
        objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      }
      anchor.href = objectUrl || png; anchor.download = `${filename}.${format}`
      document.body.appendChild(anchor); anchor.click(); anchor.remove()
      // Browsers do not expose whether the user completed saving a download.
      notify(`${format.toUpperCase()} ready. Download started.`)
    } catch { notify('Could not prepare the QR download. Please try again.', 'error') }
    finally { if (objectUrl) { const resource = objectUrl; setTimeout(() => URL.revokeObjectURL(resource), 1000) } setBusy(false) }
  }
  return <div className="rounded-2xl border border-[#deded7] bg-white p-5">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b6b3d]">Permanent QR</p>
    {png ? <img width={208} height={208} src={png} alt={`QR code for ${name}`} className="mx-auto mt-4 size-52 ql-enter"/> : <div className="ql-skeleton mx-auto mt-4 size-52" role="status" aria-label={error || 'Generating QR code'}/>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error} <button type="button" className="underline min-h-11" onClick={() => setAttempt((value) => value + 1)}>Retry</button></p>}
    <p className="mt-3 break-all rounded-lg bg-[#f6f6f3] px-3 py-2 text-xs text-[#77776f]">{url}</p>
    <div className="mt-3 grid grid-cols-3 gap-2"><button type="button" onClick={copy} className="flex min-h-11 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold">{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Copied' : 'Copy'}</button>{(['png', 'svg'] as const).map((format) => <button type="button" key={format} disabled={!png || busy} onClick={() => download(format)} aria-label={`Download QR as ${format.toUpperCase()}`} className="flex min-h-11 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold">{busy ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>} {format.toUpperCase()}</button>)}</div>
    {!png && <p className="mt-2 text-xs text-[#77776f]">Downloads become available when the QR is ready.</p>}
  </div>
}
