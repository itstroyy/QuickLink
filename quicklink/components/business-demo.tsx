'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2 } from 'lucide-react'
import { homepageDemoExamples as examples } from '@/lib/homepage-demo-data'

export default function BusinessDemo({ hero = false }: { hero?: boolean }) {
  const [active, setActive] = useState(0)
  const [step, setStep] = useState(0)
  const [item, setItem] = useState(0)
  const [choice, setChoice] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const previousStep = useRef(0)
  useEffect(() => {
    if (step !== previousStep.current) contentRef.current?.focus({ preventScroll: true })
    previousStep.current = step
  }, [step])
  const example = examples[active]
  const Icon = example.icon
  function select(index: number) { setActive(index); setStep(0); setItem(0); setChoice(0) }
  return <div className={`ql-demo ${hero ? 'ql-demo-hero' : ''}`} style={{ '--demo-accent': example.accent } as React.CSSProperties}>
    <div className="ql-demo-switch" role="group" aria-label="Choose a demo business">{examples.map((entry, index) => <button type="button" key={entry.name} aria-pressed={active === index} onClick={() => select(index)}>{entry.action}</button>)}</div>
    <div className="ql-demo-stage"><div className="ql-demo-phone">
      <div className="ql-demo-top"><span>9:41</span><span>QUICKLINK DEMO</span><span>•••</span></div>
      <div className="ql-demo-screen"><div className="ql-demo-identity"><span><Icon size={22}/></span><div><strong>{example.name}</strong><small>{example.type}</small></div></div>
        <div ref={contentRef} tabIndex={-1} aria-label={`${example.action} demo, step ${step + 1} of 3`} key={`${active}-${step}`} className="ql-demo-content ql-enter">
          {step === 0 && <><p className="ql-demo-eyebrow">{example.subtitle}</p><h3>{example.title}</h3><p className="ql-demo-hint">{active === 0 ? 'Find your service. Make it yours.' : active === 1 ? 'Pick a favourite. Collect locally.' : 'Choose a service. We’ll take it from here.'}</p>
            <div className="ql-demo-options" role="group" aria-label="Choose a demo item">{example.items.map(([label, price], index) => <button type="button" key={label} onClick={() => setItem(index)} aria-pressed={item === index}><span><strong>{label}</strong><small>{price}</small></span><span className="ql-demo-check">{item === index && <Check size={13}/>}</span></button>)}</div>
            <button type="button" className="ql-demo-cta" onClick={() => setStep(1)}>{example.cta}<ArrowRight size={16}/></button></>}
          {step === 1 && <><button type="button" className="ql-demo-back" onClick={() => setStep(0)}><ArrowLeft size={14}/> Back</button><h3>{active === 0 ? 'Make time for you.' : active === 1 ? 'Ready when you are.' : 'When works for you?'}</h3><p className="ql-demo-hint">{example.items[item][0]}</p>
            <div className="ql-demo-options" role="group" aria-label="Choose a demo time">{example.choices.map((label, index) => <button type="button" key={label} aria-pressed={choice === index} onClick={() => setChoice(index)}><span>{label}</span><CalendarDays size={16}/></button>)}</div>
            <button type="button" className="ql-demo-cta" onClick={() => setStep(2)}>{example.confirm}<ArrowRight size={16}/></button></>}
          {step === 2 && <div className="ql-demo-success" role="status"><CheckCircle2 size={36}/><h3>{example.done}</h3><p>{example.items[item][0]}<br/>{example.choices[choice]}</p><small>This is a demo. Nothing was submitted.</small><button type="button" className="ql-demo-back" onClick={() => setStep(0)}>Try again <ArrowRight size={14}/></button></div>}
        </div><p className="ql-demo-footnote">Fictional business · Interactive product demo</p>
      </div></div>
      <aside className="ql-demo-inbox" aria-label="Demo business activity"><p className="ql-demo-eyebrow">THE BUSINESS SIDE</p><h4>One place to manage it.</h4><div key={`${active}-${step === 2}`} className="ql-demo-inbox-row ql-enter"><span className="ql-demo-inbox-icon"><Icon size={18}/></span><div><strong>{step === 2 ? example.activity : 'Ready for your next customer'}</strong><small>{step === 2 ? example.items[item][0] : 'Try the action on the phone'}</small></div>{step === 2 && <span className="ql-demo-new">New</span>}</div><p>{step === 2 ? example.detail : 'Bookings, orders and requests arrive in your business activity.'}</p><small>Demo activity only</small></aside>
    </div>
  </div>
}
