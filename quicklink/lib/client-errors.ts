type DatabaseError = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

function asDatabaseError(error: unknown): DatabaseError {
  return error && typeof error === 'object' ? error as DatabaseError : { message: error instanceof Error ? error.message : String(error) }
}

export function reportClientMutationError(context: string, error: unknown, meta?: { table?: string; keys?: string[] }) {
  if (process.env.NODE_ENV === 'production') return
  const value = asDatabaseError(error)
  console.error(`[Quicklink CRUD] ${context}`, {
    code: value.code ?? null,
    message: value.message ?? null,
    details: value.details ?? null,
    hint: value.hint ?? null,
    table: meta?.table ?? null,
    payloadKeys: meta?.keys ?? null,
  })
}

export function mutationErrorMessage(action: string, error: unknown) {
  const { code } = asDatabaseError(error)
  if (code === '42501' || code === 'PGRST301') return `You do not have permission to ${action} for this business.`
  if (code === 'PGRST204' || code === '42703' || code === '42P01') return `Quicklink's database update is not installed yet. Apply the latest Supabase migration and try again.`
  if (code === '23505') return `That record already exists. Refresh the page and try again.`
  if (code === '23502' || code === '23514' || code === '22P02') return `Review the entered values before trying to ${action}.`
  return `Could not ${action}. Please try again.`
}
