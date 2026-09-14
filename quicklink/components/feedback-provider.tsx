'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, CircleAlert, X } from 'lucide-react'

type Notice = { text: string; tone: 'success' | 'error'; id: number }
const FeedbackContext = createContext<(text: string, tone?: Notice['tone']) => void>(() => {})

export function useFeedback() { return useContext(FeedbackContext) }

export default function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notify = useCallback((text: string, tone: Notice['tone'] = 'success') => {
    if (timer.current) clearTimeout(timer.current)
    setNotice({ text, tone, id: Date.now() })
    timer.current = setTimeout(() => setNotice(null), tone === 'error' ? 8000 : 4500)
  }, [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return <FeedbackContext.Provider value={notify}>
    {children}
    <div className="ql-feedback-region" aria-live="polite" aria-atomic="true">
      {notice && <div key={notice.id} className="ql-feedback" data-tone={notice.tone}>
        {notice.tone === 'success' ? <CheckCircle2 size={20}/> : <CircleAlert size={20}/>}
        <span>{notice.text}</span>
        <button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={16}/></button>
      </div>}
    </div>
  </FeedbackContext.Provider>
}
