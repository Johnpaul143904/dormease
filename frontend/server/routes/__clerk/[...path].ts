import { clerkFrontendApiProxy } from '@clerk/backend/proxy'
import { parsePublishableKey } from '@clerk/shared/keys'
import { toWebRequest } from 'h3'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const publishableKey =
    config.public.clerk?.publishableKey ||
    process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.CLERK_PUBLISHABLE_KEY
  const secretKey =
    config.clerk?.secretKey ||
    process.env.NUXT_CLERK_SECRET_KEY ||
    process.env.CLERK_SECRET_KEY

  if (!publishableKey || !secretKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Clerk proxy keys are not configured',
    })
  }

  const parsed = parsePublishableKey(publishableKey)
  const fapiUrl = parsed?.frontendApi ? `https://${parsed.frontendApi}` : undefined

  return clerkFrontendApiProxy(toWebRequest(event), {
    proxyPath: '/__clerk',
    publishableKey,
    secretKey,
    ...(fapiUrl ? { fapiUrl } : {}),
  })
})
