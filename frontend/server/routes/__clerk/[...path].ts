import { clerkFrontendApiProxy } from '@clerk/backend/proxy'
import { toWebRequest } from 'h3'

function getFapiUrl(publishableKey: string): string {
  try {
    // pk_test_<base64> or pk_live_<base64>
    const base64Part = publishableKey.replace(/^pk_(test|live)_/, '')
    const decoded = Buffer.from(base64Part, 'base64').toString('utf8').replace(/\$$/, '')
    if (decoded && decoded.includes('.')) {
      return `https://${decoded}`
    }
  } catch {}
  return 'https://frontend-api.clerk.dev'
}

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

  const fapiUrl = getFapiUrl(publishableKey)

  return clerkFrontendApiProxy(toWebRequest(event), {
    proxyPath: '/__clerk',
    publishableKey,
    secretKey,
    fapiUrl,
  })
})
