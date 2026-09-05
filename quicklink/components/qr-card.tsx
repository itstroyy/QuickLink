'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, Download } from 'lucide-react'

export default function QrCard({ url, name }: { url: string; name: string }) {
  const [png, setPng] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => { QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: '#171715', light: '#ffffff' } }).then(setPng) }, [url])
  async function copy() { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1600) }
  async function downloadSvg() {
    const svg = await QRCode.toString(url, { type: 'svg', margin: 2, color: { dark: '#171715', light: '#ffffff' } })
    const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); anchor.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.svg`; anchor.click(); URL.revokeObjectURL(anchor.href)
  }
  return <div className="rounded-2xl border border-[#deded7] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b6b3d]">Permanent QR</p>{png && <img src={png} alt={`QR code for ${name}`} className="mx-auto mt-4 size-52"/>}<p className="mt-3 truncate rounded-lg bg-[#f6f6f3] px-3 py-2 text-xs text-[#77776f]">{url}</p><div className="mt-3 grid grid-cols-3 gap-2"><button onClick={copy} className="flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold">{copied ? <Check size={14}/> : <Copy size={14}/>} Copy</button><a href={png} download={`${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.png`} className="flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold"><Download size={14}/> PNG</a><button onClick={downloadSvg} className="flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold"><Download size={14}/> SVG</button></div></div>
}
