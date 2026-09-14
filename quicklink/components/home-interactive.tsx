'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ArrowRight, QrCode } from 'lucide-react'
import BusinessInboxDemo from '@/components/business-inbox-demo'
import Reveal from '@/components/reveal'

export default function HomeInteractive() {
  const [qr, setQr] = useState('')
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(`${window.location.origin}/#demo`, { width: 256, margin: 2, color: { dark: '#171715', light: '#ffffff' } })
      .then((image) => { if (!cancelled) setQr(image) }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  return <section id="demo" className="ql-story px-6 py-20 lg:px-10">
    <div id="examples" className="mx-auto max-w-7xl">
      <Reveal className="ql-story-heading"><div><p className="ql-demo-eyebrow">THE BUSINESS SIDE</p><h2>Every action lands<br/>in one inbox.</h2></div><p>The same booking, order or request you tried above arrives here — where you change its status and the customer knows they've been taken care of.</p></Reveal>
      <Reveal><BusinessInboxDemo/></Reveal>
      <Reveal className="ql-qr-story"><div className="ql-qr-image">{qr ? <img width={104} height={104} src={qr} alt="Scan to open this interactive Quicklink demo"/> : <QrCode size={64} aria-label="Quicklink demo QR"/>}</div><div><p className="ql-demo-eyebrow">A PERMANENT WAY IN</p><h3>Your business changes. Your QR stays.</h3><p>Update services, products and offers behind the same business URL.</p><a href="#contact">Bring Quicklink to your business <ArrowRight size={15}/></a></div><span className="ql-qr-label">Scan to try this demo</span></Reveal>
    </div>
  </section>
}
