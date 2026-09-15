'use client'
import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import CommerceManager from '@/components/commerce-manager'
import { createClient } from '@/lib/supabase/client'
import { useFeedback } from '@/components/feedback-provider'
import type { NotificationSettings } from '@/lib/types'
import { mutationErrorMessage, reportClientMutationError } from '@/lib/client-errors'

export default function NotificationIntegrationsSettings({businessId,initial}:{businessId:string;initial:NotificationSettings}){const[value,setValue]=useState(initial);const[busy,setBusy]=useState(false);const notify=useFeedback();async function save(){setBusy(true);const{error}=await createClient().from('business_notification_settings').upsert({...value,business_id:businessId});setBusy(false);if(error){reportClientMutationError('save notification settings',error);notify(mutationErrorMessage('save notification settings',error),'error')}else notify('Notification settings saved.')}return <div className="mt-8 grid gap-4"><CommerceManager businessId={businessId} ready showProducts={false} initialProducts={[]} notifications={value} onNotificationsChange={setValue}/><button onClick={save} disabled={busy} className="dashboard-primary ml-auto inline-flex items-center gap-2">{busy?<Loader2 size={15} className="animate-spin"/>:<Save size={15}/>}Save notification settings</button></div>}
