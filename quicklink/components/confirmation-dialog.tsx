'use client'

import { Loader2 } from 'lucide-react'
import ModalDialog from '@/components/modal-dialog'

export default function ConfirmationDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  busy = false,
  destructive = true,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  busy?: boolean
  destructive?: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  return <ModalDialog open={open} title={title} description={body} busy={busy} onClose={onCancel} role="alertdialog">
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <button type="button" data-autofocus disabled={busy} onClick={onCancel} className="min-h-11 rounded-xl border border-[#d8d6ce] font-semibold disabled:opacity-50">Cancel</button>
        <button type="button" disabled={busy} onClick={() => void onConfirm()} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold text-white disabled:opacity-50 ${destructive ? 'bg-red-700' : 'bg-[#1d1d1b]'}`}>
          {busy && <Loader2 size={15} className="animate-spin"/>}{confirmLabel}
        </button>
      </div>
  </ModalDialog>
}
