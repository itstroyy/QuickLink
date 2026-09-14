'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import QuicklinkLogo from '@/components/quicklink-logo'
import Link from 'next/link'

type Stage =
  | { kind: 'checking' }
  | { kind: 'ready'; businessName?: string; role?: string }
  | { kind: 'sign-in-required' }
  | { kind: 'expired' }
  | { kind: 'invalid' }
  | { kind: 'already-accepted'; businessName?: string }
  | { kind: 'email-mismatch' }
  | { kind: 'revoked' }
  | { kind: 'error' }

export default function FinishAuth() {
  const [stage, setStage] = useState<Stage>({ kind: 'checking' })
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    async function finish() {
      const supabase = createClient()
      const query = new URLSearchParams(window.location.search)
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const linkError = hash.get('error_code') || query.get('error_code') || hash.get('error') || query.get('error')

      try {
        if (query.has('code')) {
          const { error } = await supabase.auth.exchangeCodeForSession(query.get('code')!)
          if (error) throw error
        } else if (hash.has('access_token') && hash.has('refresh_token')) {
          const { error } = await supabase.auth.setSession({ access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token')! })
          if (error) throw error
        } else if (linkError) {
          setStage(/expired/i.test(linkError) ? { kind: 'expired' } : { kind: 'invalid' })
          return
        } else {
          // No token in the URL at all — either they're already signed in
          // (revisiting this page) or they arrived here with nothing.
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) { setStage({ kind: 'sign-in-required' }); return }
        }
        window.history.replaceState(null, '', '/auth/finish')

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setStage({ kind: 'sign-in-required' }); return }

        const { data: statusData } = await supabase.rpc('my_invitation_status')
        const status = statusData as { status: string; business_name?: string; role?: string; email?: string } | null

        const { error: claimError } = await supabase.rpc('claim_business_invitations')
        if (claimError) { setStage({ kind: 'error' }); return }

        if (status?.status === 'accepted') { setStage({ kind: 'ready', businessName: status.business_name, role: status.role }); return }
        if (status?.status === 'pending') { setStage({ kind: 'ready', businessName: status.business_name, role: status.role }); return }
        if (status?.status === 'expired') { setStage({ kind: 'expired' }); return }
        if (status?.status === 'none') {
          // No invitation on file for this verified email at all. If they
          // already belong to a business some other way (e.g. re-visiting a
          // sign-in link after already finishing setup), let them through;
          // otherwise this is either a revoked invite or a mismatched email.
          const { count } = await supabase.from('business_members').select('business_id', { count: 'exact', head: true })
          if (count && count > 0) { setStage({ kind: 'ready' }); return }
          setStage({ kind: 'revoked' })
          return
        }
        setStage({ kind: 'ready' })
      } catch {
        setStage({ kind: 'expired' })
      }
    }
    void finish()
  }, [])

  async function save() {
    if (busy) return
    setBusy(true)
    const { error } = await createClient().auth.updateUser({ password })
    setBusy(false)
    if (error) setSaveMessage(error.message)
    else window.location.assign('/dashboard')
  }

  return <main className="grid min-h-screen place-items-center bg-[#f5f4ef] p-5">
    <div className="w-full max-w-md rounded-3xl border bg-white p-7">
      <QuicklinkLogo/>
      <ErrorOrForm stage={stage} password={password} setPassword={setPassword} busy={busy} save={save} saveMessage={saveMessage}/>
    </div>
  </main>
}

function ErrorOrForm({ stage, password, setPassword, busy, save, saveMessage }: { stage: Stage; password: string; setPassword: (value: string) => void; busy: boolean; save: () => void; saveMessage: string }) {
  if (stage.kind === 'checking') return <><h1 className="mt-8 text-2xl font-semibold">Checking your invitation…</h1><p className="mt-2 text-sm text-[#77776f]">One moment.</p></>

  if (stage.kind === 'ready') return <>
    <h1 className="mt-8 text-2xl font-semibold">{stage.businessName ? `You're in — welcome to ${stage.businessName}.` : "You're signed in."}</h1>
    <p className="mt-2 text-sm text-[#77776f]">{stage.businessName ? `Set a password to finish setting up your ${stage.role === 'manager' ? 'manager' : 'owner'} access, or continue with secure email sign-in.` : 'Set a password, or continue with secure email sign-in.'}</p>
    <form onSubmit={(event) => { event.preventDefault(); save() }} className="mt-6 grid gap-4">
      <label>New password<input className="form-control mt-2" type="password" minLength={12} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)}/></label>
      <button disabled={busy} className="dashboard-primary">{busy ? 'Saving…' : 'Set password and continue'}</button>
    </form>
    {saveMessage && <p role="alert" className="mt-3 text-sm text-red-600">{saveMessage}</p>}
    <a href="/dashboard" className="dashboard-secondary mt-3 block text-center">Continue to dashboard</a>
  </>

  if (stage.kind === 'sign-in-required') return <ErrorPanel title="Sign in required" body="This link didn't include a valid session. Sign in below, or ask your administrator to resend your invitation." primary={{ href: '/login', label: 'Go to sign in' }}/>

  if (stage.kind === 'expired') return <ErrorPanel title="This invitation has expired" body="Invitations are valid for 7 days. Ask the business administrator to resend your invitation." primary={{ href: '/login', label: 'Back to sign in' }}/>

  if (stage.kind === 'already-accepted') return <ErrorPanel title="Already accepted" body={`This invitation${stage.businessName ? ` for ${stage.businessName}` : ''} has already been accepted. Sign in to continue.`} primary={{ href: '/login', label: 'Go to sign in' }}/>

  if (stage.kind === 'email-mismatch') return <ErrorPanel title="Email doesn't match" body="This invitation was sent to a different email address than the one you're signed in with. Sign in with the invited email, or ask your administrator to resend it to the right address." primary={{ href: '/login', label: 'Back to sign in' }}/>

  if (stage.kind === 'revoked') return <ErrorPanel title="This invitation isn't available" body="This link may have been revoked, already used, or is no longer valid. Ask the business administrator to resend your invitation." primary={{ href: '/login', label: 'Back to sign in' }}/>

  return <ErrorPanel title="Something went wrong" body="We couldn't finish setting up your account. Please try again, or contact your administrator." primary={{ href: '/login', label: 'Back to sign in' }}/>
}

function ErrorPanel({ title, body, primary }: { title: string; body: string; primary: { href: string; label: string } }) {
  return <>
    <h1 className="mt-8 text-2xl font-semibold">{title}</h1>
    <p className="mt-2 text-sm text-[#77776f]">{body}</p>
    <Link href={primary.href} className="dashboard-secondary mt-6 block text-center">{primary.label}</Link>
  </>
}
