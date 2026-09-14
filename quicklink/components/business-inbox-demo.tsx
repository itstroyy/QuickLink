'use client'

import { useState } from 'react'
import { ArrowRight, Check, ChevronRight } from 'lucide-react'
import { homepageDemoExamples as examples } from '@/lib/homepage-demo-data'

const stages = ['New', 'In progress', 'Served'] as const
const stageTone = ['ql-inbox-dot-new', 'ql-inbox-dot-progress', 'ql-inbox-dot-served'] as const

/**
 * The business-side half of the story: the same three example customer
 * actions from the hero demo, now shown arriving in the owner's Business
 * Inbox and moving through a real status change to "served". This replaces
 * a second copy of the customer-facing phone demo that used to repeat here.
 */
export default function BusinessInboxDemo() {
  const [stageByRow, setStageByRow] = useState<number[]>(() => examples.map(() => 0))

  function advance(index: number) {
    setStageByRow((current) => current.map((stage, i) => i === index ? Math.min(stage + 1, stages.length - 1) : stage))
  }
  function reset() { setStageByRow(examples.map(() => 0)) }

  const allServed = stageByRow.every((stage) => stage === stages.length - 1)

  return <div className="ql-inbox-demo">
    <div className="ql-inbox-window">
      <div className="ql-inbox-titlebar"><span/><span/><span/><strong>Business Inbox</strong></div>
      <div className="ql-inbox-rows">
        {examples.map((example, index) => {
          const Icon = example.icon
          const stage = stageByRow[index]
          const served = stage === stages.length - 1
          return <div key={example.name} className="ql-inbox-row">
            <span className="ql-inbox-icon" style={{ '--row-accent': example.accent } as React.CSSProperties}><Icon size={17}/></span>
            <span className="ql-inbox-row-main">
              <strong>{served ? example.servedLabel : example.inboxLabel}</strong>
              <small>{example.name} · {example.items[0][0]}</small>
            </span>
            <span className={`ql-inbox-status ${stageTone[stage]}`}><span className="ql-inbox-status-dot"/>{stages[stage]}</span>
            {!served
              ? <button type="button" onClick={() => advance(index)} className="ql-inbox-advance">Mark {stages[stage + 1].toLowerCase()} <ChevronRight size={13}/></button>
              : <span className="ql-inbox-done"><Check size={14}/></span>}
          </div>
        })}
      </div>
      <p className="ql-inbox-footnote">{allServed ? <button type="button" onClick={reset} className="ql-inbox-replay">Replay the demo <ArrowRight size={13}/></button> : 'Tap a row to move it through your real status stages.'}</p>
    </div>
  </div>
}
