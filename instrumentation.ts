import type { Instrumentation } from 'next'

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const message = error instanceof Error ? error.message : String(error)
  const digest = typeof error === 'object' && error !== null && 'digest' in error ? String(error.digest) : undefined

  console.error('[Quicklink/Next server error]', {
    message,
    digest,
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
  })
}
