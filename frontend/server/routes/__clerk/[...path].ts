import { clerkFrontendApiProxy } from '@clerk/backend/proxy'
import { toWebRequest } from 'h3'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const publishableKey = config.public.clerk.publishableKey
  const secretKey = config.clerk.secretKey

  if (!publishableKey || !secretKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Clerk proxy keys are not configured',
    })
  }

  return clerkFrontendApiProxy(toWebRequest(event), {
    proxyPath: '/__clerk',
    publishableKey,
    secretKey,
  })
})
