'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { ArrowRight, CalendarDays, Camera, MapPin, Phone, Star } from 'lucide-react'
import { LinkIcon } from '@/components/link-icon'
import QuicklinkLogo from '@/components/quicklink-logo'

const templates = [
  { name: 'Fresh Cuts', category: 'Barbershop', tagline: 'Classic cuts. Modern craft.', theme: 'barber', image: '/images/barbershop-background.png', accent: '#d8aa55', initials: 'FC', actions: [['Leave a review', 'google_review'], ['Book a cut', 'booking'], ['Get directions', 'directions']] },
  { name: 'Gloss Nail Bar', category: 'Nail salon', tagline: 'A little polish goes a long way.', theme: 'beauty', image: '/images/theme-beauty.png', accent: '#e6a4bb', initials: 'GL', actions: [['Book an appointment', 'booking'], ['See our work', 'instagram'], ['Call the salon', 'phone']] },
  { name: "Joe's Auto", category: 'Auto repair', tagline: 'Straight answers. Solid work.', theme: 'automotive', image: '/images/theme-automotive.png', accent: '#ed463a', initials: 'JA', actions: [['Request service', 'website'], ['Call the shop', 'phone'], ['Find the garage', 'directions']] },
  { name: 'Pizza Palace', category: 'Restaurant', tagline: 'Hot slices. Neighborhood favorite.', theme: 'luxury', image: '/images/theme-luxury.png', accent: '#e1ad4f', initials: 'PP', actions: [['View the menu', 'menu'], ['Order online', 'website'], ['Get directions', 'directions']] },
] as const

const mergeDestinations = [
  { label: 'Google Reviews', icon: Star, x: 16, y: 23, rotation: -7 },
  { label: 'Booking', icon: CalendarDays, x: 76, y: 17, rotation: 5 },
  { label: 'Instagram', icon: Camera, x: 13, y: 66, rotation: 6 },
  { label: 'Directions', icon: MapPin, x: 80, y: 64, rotation: -5 },
  { label: 'Call', icon: Phone, x: 50, y: 84, rotation: 3 },
] as const

function DemoPhone({ compact = false }: { compact?: boolean }) {
  return <div className={`demo-phone ${compact ? 'demo-phone-compact' : ''}`}>
    <div className="demo-phone-bar"><span>9:41</span><span>•••</span></div>
    <div className="px-5 pb-6 pt-5 text-center"><div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#d2a15e] font-semibold text-white">FC</div><h3 className="mt-3 text-xl font-semibold">Fresh Cuts</h3><p className="mt-1 text-[10px] text-[#77736c]">Classic cuts. Modern craft.</p><div className="mt-4 grid gap-2">{[['Leave a review','google_review'],['Book a cut','booking'],['Instagram','instagram']].map(([label, icon], index) => <div key={label} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[10px] font-semibold ${index === 0 ? 'bg-[#171715] text-white' : 'bg-white/80'}`}><LinkIcon name={icon} size={15}/><span className="flex-1">{label}</span><ArrowRight size={11}/></div>)}</div></div>
  </div>
}

export default function HomeInteractive() {
  const [qr, setQr] = useState('')
  const [mergeProgress, setMergeProgress] = useState(0)
  const [active, setActive] = useState(0)
  const mergeRef = useRef<HTMLElement>(null)
  const template = templates[active]

  useEffect(() => {
    const demoUrl = `${window.location.origin}/fresh-cuts`
    QRCode.toDataURL(demoUrl, { width: 640, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#171715', light: '#ffffff' } }).then(setQr)
  }, [])

  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const section = mergeRef.current
        if (!section) return
        const rect = section.getBoundingClientRect()
        const travel = Math.max(section.offsetHeight - window.innerHeight, 1)
        const progress = Math.min(1, Math.max(0, -rect.top / travel))
        setMergeProgress(progress)
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const scanProgress = Math.min(1, Math.max(0, (mergeProgress - .1) / .28))
  const convergeProgress = Math.min(1, Math.max(0, (mergeProgress - .3) / .3))
  const pageProgress = Math.min(1, Math.max(0, (mergeProgress - .58) / .32))

  return <>
    <section id="demo" ref={mergeRef} className="merge-story bg-[#171715] text-white">
      <div className="merge-sticky px-6 lg:px-10">
        <div className="mx-auto grid h-full max-w-7xl gap-8 py-16 md:grid-cols-[.62fr_1.38fr] md:items-center">
          <div className="relative z-20"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#e8cdb7]">One connected journey</p><h2 className="mt-4 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Many destinations.<br/><span className="text-[#d09262]">One Quicklink.</span></h2><p className="mt-5 max-w-sm leading-7 text-[#aaa89f]">Scroll to see one real QR gather every customer action into a single branded experience.</p><div className="merge-progress mt-8" aria-hidden="true"><span style={{ transform: `scaleX(${mergeProgress})` }}/></div><p className="mt-3 text-[10px] font-semibold uppercase tracking-[.18em] text-white/45">{mergeProgress < .3 ? 'Everything in reach' : mergeProgress < .58 ? 'Scanning and connecting' : 'One branded page'}</p></div>
          <div className="merge-canvas" aria-label="A real demo QR gathers Reviews, Booking, Instagram, Call and Directions, then becomes the Fresh Cuts Quicklink page">
            <div className="merge-rings" style={{ opacity: 1 - pageProgress }} aria-hidden="true"/>
            <div className="merge-destinations" aria-hidden={pageProgress > .5}>
              {mergeDestinations.map((item) => {
                const Icon = item.icon
                const gather = 1 - convergeProgress
                const opacity = Math.max(0, 1 - pageProgress * 1.8)
                return <div key={item.label} className="merge-card" style={{ left: `${50 + (item.x - 50) * gather}%`, top: `${50 + (item.y - 50) * gather}%`, opacity, transform: `translate(-50%, -50%) rotate(${item.rotation * gather}deg) scale(${1 - convergeProgress * .2})` }}><span><Icon size={18}/></span>{item.label}</div>
              })}
            </div>
            <div className="merge-morph" style={{ width: `${250 + pageProgress * 90}px`, height: `${270 + pageProgress * 140}px`, borderRadius: `${30 - pageProgress * 6}px` }}>
              <div className="merge-qr" style={{ opacity: 1 - pageProgress, transform: `scale(${1 - pageProgress * .12})` }}>{qr ? <img src={qr} alt="Real scannable QR code for the Fresh Cuts demo"/> : <div className="merge-qr-placeholder"/>}<span className="merge-scan-beam" style={{ opacity: scanProgress < 1 ? scanProgress : Math.max(0, 1 - convergeProgress), transform: `translateY(${scanProgress * 205}px)` }} aria-hidden="true"/><small>REAL DEMO QR</small></div>
              <div className="merge-quicklink-page" style={{ opacity: pageProgress, transform: `scale(${.9 + pageProgress * .1})` }}><div className="merge-page-mark">FC</div><p>BARBERSHOP</p><h3>Fresh Cuts</h3><small>Classic cuts. Modern craft.</small><div className="merge-page-actions">{[['Leave a review','google_review'],['Book an appointment','booking'],['Instagram','instagram'],['Call us','phone'],['Get directions','directions']].map(([label, icon], index) => <div key={label} className={index === 0 ? 'is-primary' : ''}><LinkIcon name={icon} size={15}/><span>{label}</span><ArrowRight size={12}/></div>)}</div></div>
            </div>
            <div className="merge-scan-pulse" style={{ opacity: Math.max(0, Math.min(scanProgress, 1 - pageProgress)) }} aria-hidden="true"/>
            <div className="merge-stage-label merge-stage-start" style={{ opacity: Math.max(0, 1 - mergeProgress * 3) }}>One QR at the center</div>
            <div className="merge-stage-label merge-stage-end" style={{ opacity: Math.max(0, (mergeProgress - .84) / .12) }}>One scan. Everything&apos;s there.</div>
          </div>
        </div>
      </div>
    </section>

    <section className="bg-[#f5f4ef] px-6 py-24 lg:px-10"><div className="mx-auto max-w-7xl"><div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:items-center"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#b36b3e]">From counter to customer</p><h2 className="mt-4 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">The physical piece<br/>meets the digital one.</h2><p className="mt-5 max-w-md leading-7 text-[#77766e]">Place the acrylic stand where customers already pause. One scan opens a fast, branded page—no app and no searching.</p><div className="mt-8 grid gap-3 text-sm"><span className="flex items-center gap-3"><b className="step-number">01</b>Place the stand</span><span className="flex items-center gap-3"><b className="step-number">02</b>Customer scans</span><span className="flex items-center gap-3"><b className="step-number">03</b>Quicklink opens</span></div></div>
          <div className="product-illustration" aria-label="Acrylic QR stand scanning into a Quicklink phone page">
            <div className="product-grid" aria-hidden="true"/>
            <div className="acrylic-product">
              <div className="acrylic-plate"><QuicklinkLogo compact className="justify-center text-[10px]" markClassName="size-7"/>{qr ? <img src={qr} alt="Real QR code for the Fresh Cuts demo"/> : <div className="acrylic-qr-placeholder"/>}<strong>SCAN TO CONNECT</strong><span className="acrylic-beam" aria-hidden="true"/></div>
              <div className="acrylic-base"><span/></div>
            </div>
            <div className="product-path" aria-hidden="true"><span/><i/><b>scan</b></div>
            <div className="product-phone"><DemoPhone compact/><div className="product-opened"><span/>Quicklink opened</div></div>
            <p className="product-caption">Simple product visualization · photography coming later</p>
          </div>
        </div></div>
    </section>

    <section id="examples" className="bg-[#dfd4c8] px-6 py-24 lg:px-10"><div className="mx-auto max-w-7xl"><div className="flex flex-wrap items-end justify-between gap-6"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#8e603d]">One system, distinct worlds</p><h2 className="mt-4 text-4xl font-semibold tracking-[-.055em] sm:text-6xl">Make it unmistakably<br/>theirs.</h2></div><p className="max-w-sm text-sm leading-6 text-[#6f6259]">Each template changes its environment, typography, geometry, color and button treatment—not only its accent color.</p></div>
        <div className="mt-10 flex flex-wrap gap-2" role="tablist" aria-label="Example businesses">{templates.map((item, index) => <button key={item.name} role="tab" aria-selected={index === active} onClick={() => setActive(index)} className={`rounded-full px-4 py-2.5 text-xs font-semibold transition ${index === active ? 'bg-[#171715] text-white shadow-lg' : 'bg-white/55 text-[#6f6259] hover:bg-white'}`}>{item.name}</button>)}</div>
        <div className="template-stage mt-6" style={{ '--template-accent': template.accent } as React.CSSProperties}><img key={`${template.name}-background`} src={template.image} alt="" className="template-backdrop"/><div className="template-shade"/><div key={template.name} className={`template-phone template-phone-${template.theme}`}><div className="mx-auto flex size-20 items-center justify-center border-2 border-white/70 bg-black/45 text-xl font-semibold text-white shadow-2xl backdrop-blur" style={{ borderRadius: template.theme === 'beauty' ? '2rem' : template.theme === 'automotive' ? '.35rem' : '1.2rem', color: template.accent }}>{template.initials}</div><p className="mt-4 text-[9px] font-semibold uppercase tracking-[.25em]" style={{ color: template.accent }}>{template.category}</p><h3 className="template-name mt-1 text-3xl font-semibold text-white">{template.name}</h3><p className="mt-2 text-xs text-white/65">{template.tagline}</p><div className="mt-6 grid gap-2.5">{template.actions.map(([label, icon], index) => <div key={label} className={`template-action ${index === 0 ? 'template-action-primary' : ''}`}><LinkIcon name={icon} size={18}/><span>{label}</span><ArrowRight className="ml-auto" size={14}/></div>)}</div><QuicklinkLogo className="mt-6 justify-center text-[10px] text-white/60" markClassName="size-6 bg-white/10 text-[var(--template-accent)]"/></div>
          <div className="demo-analytics"><p className="text-[10px] font-semibold uppercase tracking-[.2em]" style={{ color: template.accent }}>Demo analytics</p><div><strong>1,248</strong><span>scans</span></div><div><strong>436</strong><span>review clicks</span></div><div><strong>203</strong><span>booking clicks</span></div><p>Example data for demonstration only.</p></div>
        </div>
      </div></section>
  </>
}
