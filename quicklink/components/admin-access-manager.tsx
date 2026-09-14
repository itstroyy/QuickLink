'use client'

import { useState } from 'react'
import { Loader2, Mail, ShieldOff, UserPlus } from 'lucide-react'
import { useFeedback } from '@/components/feedback-provider'

type Member = { user_id: string; role: 'owner' | 'manager'; email: string; created_at: string }
type Invitation = { id: string; email: string; role: 'owner' | 'manager'; expires_at: string; created_at: string }

export default function AdminAccessManager({ businessId, members: initialMembers, invitations: initialInvitations }: { businessId: string; members: Member[]; invitations: Invitation[] }) {
  const [members, setMembers] = useState(initialMembers)
  const [invitations, setInvitations] = useState(initialInvitations)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'owner' | 'manager'>('owner')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const notify = useFeedback()

  async function invite(targetEmail: string, targetRole: 'owner' | 'manager') {
    if (!targetEmail.trim()) return
    setBusy('invite'); setMessage('')
    try {
      const response = await fetch('/api/admin/access/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId, email: targetEmail.trim(), role: targetRole }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to send invitation.')
      if (result.emailSent) notify('Invitation email sent.')
      else if (result.acceptUrl) { notify(result.reason || 'Invitation saved.'); setMessage(`Email could not be sent. Share this link with them directly: ${result.acceptUrl}`) }
      else notify(result.reason || 'Invitation saved.')
      setEmail('')
      setInvitations((rows) => {
        const withoutExisting = rows.filter((row) => row.email !== targetEmail.trim().toLowerCase())
        return [...withoutExisting, { id: crypto.randomUUID(), email: targetEmail.trim().toLowerCase(), role: targetRole, expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), created_at: new Date().toISOString() }]
      })
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to send invitation.') }
    finally { setBusy('') }
  }

  async function changeRole(userId: string, newRole: 'owner' | 'manager') {
    setBusy(`role-${userId}`)
    try {
      const response = await fetch('/api/admin/access/revoke', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId, userId, newRole }) })
      if (!response.ok) throw new Error('Unable to change role.')
      setMembers((rows) => rows.map((row) => row.user_id === userId ? { ...row, role: newRole } : row))
      notify('Role updated.')
    } catch { setMessage('Could not change this person’s role. Please try again.') }
    finally { setBusy('') }
  }

  async function revokeMember(userId: string) {
    if (!confirm('Revoke this person’s access to this business?')) return
    setBusy(`member-${userId}`)
    try {
      const response = await fetch('/api/admin/access/revoke', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId, userId }) })
      if (!response.ok) throw new Error('Unable to revoke access.')
      setMembers((rows) => rows.filter((row) => row.user_id !== userId))
      notify('Access revoked.')
    } catch { setMessage('Could not revoke access. Please try again.') }
    finally { setBusy('') }
  }

  async function cancelInvitation(id: string) {
    setBusy(`invite-${id}`)
    try {
      const response = await fetch('/api/admin/access/revoke', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId, invitationId: id }) })
      if (!response.ok) throw new Error('Unable to cancel invitation.')
      setInvitations((rows) => rows.filter((row) => row.id !== id))
      notify('Invitation cancelled.')
    } catch { setMessage('Could not cancel this invitation. Please try again.') }
    finally { setBusy('') }
  }

  return <div className="grid gap-6">
    {message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}

    <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
      <h2 className="font-semibold">Invite a business owner</h2>
      <p className="mt-1 text-xs text-[#77776f]">They&apos;ll sign in at /login with this email and only ever see this business.</p>
      <form onSubmit={(event) => { event.preventDefault(); void invite(email, role) }} className="mt-4 flex flex-wrap gap-3">
        <input className="form-control min-w-0 flex-1" type="email" required placeholder="owner@business.com" value={email} onChange={(event) => setEmail(event.target.value)}/>
        <select className="form-control w-32" value={role} onChange={(event) => setRole(event.target.value as 'owner' | 'manager')}><option value="owner">Owner</option><option value="manager">Manager</option></select>
        <button type="submit" disabled={busy === 'invite'} className="dashboard-primary inline-flex items-center gap-2">{busy === 'invite' ? <Loader2 size={15} className="animate-spin"/> : <UserPlus size={15}/>} Invite</button>
      </form>
    </section>

    <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
      <h2 className="font-semibold">Has access</h2>
      <div className="mt-3 divide-y">
        {members.map((member) => <div key={member.user_id} className="flex items-center justify-between gap-3 py-3">
          <div><p className="text-sm font-medium">{member.email}</p><p className="mt-0.5 text-xs text-[#77776f]"><span className="inline-flex items-center gap-1.5 font-medium text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-600"/> {member.role === 'owner' ? 'Owner active' : 'Manager active'}</span> · since {new Date(member.created_at).toLocaleDateString()}</p></div>
          <div className="flex items-center gap-2">
            <select aria-label={`Change role for ${member.email}`} value={member.role} disabled={busy === `role-${member.user_id}`} onChange={(event) => changeRole(member.user_id, event.target.value as 'owner' | 'manager')} className="form-control h-9 w-28 text-xs"><option value="owner">Owner</option><option value="manager">Manager</option></select>
            <button type="button" disabled={busy === `member-${member.user_id}`} onClick={() => revokeMember(member.user_id)} className="icon-button text-red-600" aria-label="Revoke access"><ShieldOff size={15}/></button>
          </div>
        </div>)}
        {members.length === 0 && <p className="py-6 text-center text-sm text-[#77776f]"><span className="font-medium text-[#1d1d1b]">No owner.</span> Invite one above.</p>}
      </div>
    </section>

    {invitations.length > 0 && <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
      <h2 className="font-semibold">Pending invitations</h2>
      <div className="mt-3 divide-y">{invitations.map((invitation) => {
        const expired = new Date(invitation.expires_at).getTime() < Date.now()
        return <div key={invitation.id} className="flex items-center justify-between gap-3 py-3">
          <div><p className="text-sm font-medium">{invitation.email}</p><p className="mt-0.5 text-xs text-[#77776f]"><span className={`inline-flex items-center gap-1.5 font-medium ${expired ? 'text-red-600' : 'text-amber-600'}`}><span className={`size-1.5 rounded-full ${expired ? 'bg-red-600' : 'bg-amber-500'}`}/> {expired ? 'Invite expired' : 'Invite pending'}</span> · {invitation.role} · {expired ? 'expired' : 'expires'} {new Date(invitation.expires_at).toLocaleDateString()}</p></div>
          <div className="flex gap-2"><button type="button" disabled={busy === 'invite'} onClick={() => invite(invitation.email, invitation.role)} className="icon-button" aria-label="Resend invitation"><Mail size={15}/></button><button type="button" disabled={busy === `invite-${invitation.id}`} onClick={() => cancelInvitation(invitation.id)} className="icon-button text-red-600" aria-label="Revoke invitation"><ShieldOff size={15}/></button></div>
        </div>
      })}</div>
    </section>}
  </div>
}
