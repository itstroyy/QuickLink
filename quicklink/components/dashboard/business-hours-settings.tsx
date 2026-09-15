'use client'

import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useFeedback } from '@/components/feedback-provider'
import type { BusinessHour } from '@/lib/types'
import { mutationErrorMessage, reportClientMutationError } from '@/lib/client-errors'

const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function BusinessHoursSettings({businessId,initial}:{businessId:string;initial:BusinessHour[]}){
  const[hours,setHours]=useState(initial);const[busy,setBusy]=useState<number|null>(null);const notify=useFeedback()
  function rowFor(day:number):BusinessHour{return hours.find((item)=>item.day_of_week===day)||{id:crypto.randomUUID(),business_id:businessId,day_of_week:day,open_time:'09:00',close_time:'17:00',closed:day===0}}
  function update(day:number,changes:Partial<BusinessHour>){const row=rowFor(day);setHours([...hours.filter((item)=>item.day_of_week!==day),{...row,...changes}])}
  async function save(day:number){setBusy(day);const row=rowFor(day);const{data,error}=await createClient().from('business_hours').upsert({...row,business_id:businessId}).select().single();if(error){reportClientMutationError('save business hours',error);notify(mutationErrorMessage('save business hours',error),'error')}else{setHours([...hours.filter((item)=>item.day_of_week!==day),data as BusinessHour]);notify(`${days[day]} hours saved.`)}setBusy(null)}
  return <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6"><h2 className="font-semibold">Business hours</h2><p className="mt-1 text-xs text-[#77776f]">Used for the public schedule, open status, and booking availability. Public visibility is controlled in Page settings.</p><div className="mt-5 grid gap-2">{days.map((day,index)=>{const row=rowFor(index);return <div key={day} className="grid items-center gap-2 rounded-xl border border-[#e4e2da] p-3 sm:grid-cols-[120px_1fr_1fr_auto_auto]"><strong className="text-sm">{day}</strong><input type="time" className="form-control" value={row.open_time?.slice(0,5)||''} disabled={row.closed} onChange={(event)=>update(index,{open_time:event.target.value})}/><input type="time" className="form-control" value={row.close_time?.slice(0,5)||''} disabled={row.closed} onChange={(event)=>update(index,{close_time:event.target.value})}/><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={row.closed} onChange={(event)=>update(index,{closed:event.target.checked})}/>Closed</label><button type="button" disabled={busy!==null} className="icon-button" onClick={()=>save(index)} aria-label={`Save ${day}`}>{busy===index?<Loader2 size={15} className="animate-spin"/>:<Save size={15}/>}</button></div>})}</div></section>
}
