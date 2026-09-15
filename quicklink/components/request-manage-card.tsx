'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, Clock3, Loader2, MessageSquareText } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/display-format'

type ManagedRequest = { id:string;customer_name:string;preferred_date:string|null;request_details:string|null;status:string;quote_amount_cents:number|null;quote_message:string|null;quote_expires_at:string|null;payment_required:boolean;payment_status:string;currency:string;created_at:string;business_name:string }

export default function RequestManageCard({ token, request, checkout }: { token:string;request:ManagedRequest;checkout?:string }) {
  const router=useRouter()
  const [status,setStatus]=useState(request.status);const[busy,setBusy]=useState(false);const[error,setError]=useState('')
  const reference=`QR-${request.id.replaceAll('-','').slice(0,6).toUpperCase()}`
  const expired=Boolean(request.quote_expires_at&&new Date(request.quote_expires_at)<=new Date())
  useEffect(()=>setStatus(request.status),[request.status])
  useEffect(()=>{if(checkout!=='returned'||request.payment_status!=='pending')return;let tries=0;const timer=window.setInterval(()=>{tries+=1;router.refresh();if(tries>=15)window.clearInterval(timer)},2000);return()=>window.clearInterval(timer)},[checkout,request.payment_status,router])
  async function act(kind:'accept'|'checkout'){setBusy(true);setError('');try{const response=await fetch(`/api/quotes/${kind}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to continue.');if(result.checkoutUrl){window.location.assign(result.checkoutUrl);return}setStatus('accepted')}catch(e){setError(e instanceof Error?e.message:'Unable to continue.')}finally{setBusy(false)}}
  const steps=['Submitted','Reviewing','Quote sent',request.payment_required?'Paid':'Accepted','Completed']
  const progress=status==='completed'?4:status==='paid'||status==='accepted'||status==='scheduled'||status==='in_progress'?3:status==='quoted'?2:status==='reviewing'||status==='contacted'?1:0
  return <main className="min-h-screen bg-[#f6f3ed] px-4 py-10 text-[#1d1d1b]"><section className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-[#ded8cc] bg-white shadow-[0_24px_70px_rgba(38,28,17,.12)]"><div className="bg-[#1d1d1b] px-6 py-7 text-white"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#d19a6a]">Quicklink request</p><h1 className="mt-2 text-2xl font-semibold">{request.business_name}</h1><p className="mt-1 text-sm text-white/60">{reference}</p></div><div className="p-6 sm:p-8">
    {checkout==='returned'&&request.payment_status==='pending'&&<p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Payment is processing. This page updates after Stripe confirms it.</p>}
    <div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#f2e8db] text-[#9a6339]"><MessageSquareText size={20}/></span><div><h2 className="text-xl font-semibold">Hi, {request.customer_name}</h2><p className="mt-1 text-sm text-[#77776f]">Submitted {formatDateTime(request.created_at)}</p></div></div>
    <ol className="mt-7 grid grid-cols-5 gap-1" aria-label="Request status">{steps.map((step,index)=><li key={step} className="text-center"><span className={`mx-auto block h-1.5 rounded-full ${index<=progress?'bg-[#9a6339]':'bg-[#e8e2d8]'}`}/><span className="mt-2 block text-[10px] text-[#77776f]">{step}</span></li>)}</ol>
    <div className="mt-6 rounded-2xl bg-[#faf8f3] p-5"><h3 className="text-xs font-semibold uppercase tracking-[.1em] text-[#77776f]">Request details</h3>{request.request_details&&<p className="mt-3 text-sm leading-6">{request.request_details}</p>}{request.preferred_date&&<p className="mt-3 flex items-center gap-2 text-sm text-[#77776f]"><Clock3 size={15}/>Preferred date: {formatDate(request.preferred_date)}</p>}</div>
    {request.quote_amount_cents!=null&&<div className="mt-5 rounded-2xl border border-[#ded8cc] p-5"><p className="text-xs font-semibold uppercase tracking-[.1em] text-[#9a6339]">Your quote</p><p className="mt-2 text-3xl font-semibold">{new Intl.NumberFormat('en-US',{style:'currency',currency:request.currency.toUpperCase()}).format(request.quote_amount_cents/100)}</p>{request.quote_message&&<p className="mt-3 text-sm leading-6 text-[#77776f]">{request.quote_message}</p>}{request.quote_expires_at&&<p className="mt-3 text-xs text-[#77776f]">Valid until {new Date(request.quote_expires_at).toLocaleDateString()}</p>}
      {status==='quoted'&&!expired&&(request.payment_required?<button disabled={busy} onClick={()=>act('checkout')} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1d1d1b] px-4 text-sm font-semibold text-white">{busy?<Loader2 className="animate-spin" size={16}/>:<>Accept &amp; pay securely <ArrowRight size={16}/></>}</button>:<button disabled={busy} onClick={()=>act('accept')} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1d1d1b] px-4 text-sm font-semibold text-white">{busy?<Loader2 className="animate-spin" size={16}/>:<>Accept quote <CheckCircle2 size={16}/></>}</button>)}
      {expired&&<p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">This quote has expired. Contact the business for an updated quote.</p>}{(status==='accepted'||status==='paid')&&<p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><CheckCircle2 size={17}/>Quote {status==='paid'?'paid':'accepted'}.</p>}</div>}
    {error&&<p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
  </div></section></main>
}
