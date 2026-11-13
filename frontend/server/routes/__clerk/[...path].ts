import { clerkFrontendApiProxy } from '@clerk/backend/proxy'
import { toWebRequest, sendRedirect } from 'h3'

function getFapiUrl(publishableKey: string): string {
  try {
    const key = (publishableKey || '').trim()
    const parts = key.split('_')
    if (parts.length >= 3) {
      const base64Part = parts.slice(2).join('_')
      const decoded = Buffer.from(base64Part, 'base64').toString('utf8').replace(/[\$]$/, '')
      if (decoded && decoded.includes('.')) {
        return `https://${decoded}`
      }
    }
  } catch {}
  return 'https://frontend-api.clerk.dev'
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const publishableKey =
    config.public?.clerk?.publishableKey ||
    process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.CLERK_PUBLISHABLE_KEY ||
    ''

  const secretKey =
    config.clerk?.secretKey ||
    process.env.NUXT_CLERK_SECRET_KEY ||
    process.env.CLERK_SECRET_KEY ||
    ''

  if (!publishableKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Clerk publishable key is not configured',
    })
  }

  const fapiUrl = getFapiUrl(publishableKey)
  const req = toWebRequest(event)
  const url = new URL(req.url)
  const targetPath = url.pathname.replace(/^\/__clerk/, '') || '/'

  // 1. Static Clerk JS / UI SDK assets: serve directly without requiring a secret key
  if (targetPath.startsWith('/npm/')) {
    const assetUrl = `${fapiUrl}${targetPath}${url.search}`
    try {
      const assetResponse = await fetch(assetUrl, {
        method: req.method,
        headers: {
          'Accept': req.headers.get('accept') || '*/*',
          'User-Agent': req.headers.get('user-agent') || 'DormEase-Clerk-Proxy',
        },
      })
      if (assetResponse.ok) {
        return assetResponse
      }
      return sendRedirect(event, assetUrl, 307)
    } catch {
      return sendRedirect(event, assetUrl, 307)
    }
  }

  // 2. If secretKey is available, attempt standard clerkFrontendApiProxy
  if (secretKey) {
    try {
      const proxyResponse = await clerkFrontendApiProxy(req, {
        proxyPath: '/__clerk',
        publishableKey,
        secretKey,
        fapiUrl,
      })
      if (proxyResponse.status < 500) {
        return proxyResponse
      }
    } catch {
      // Fall through to direct proxy fallback on error
    }
  }

  // 3. Fallback: forward API request directly to Clerk FAPI
  const targetUrl = `${fapiUrl}${targetPath}${url.search}`
  const forwardHeaders = new Headers()
  req.headers.forEach((val, key) => {
    const k = key.toLowerCase()
    if (!['host', 'connection', 'content-length', 'clerk-proxy-url', 'clerk-secret-key'].includes(k)) {
      forwardHeaders.set(key, val)
    }
  })
  forwardHeaders.set('Host', new URL(fapiUrl).host)
  if (secretKey) {
    forwardHeaders.set('Clerk-Secret-Key', secretKey)
  }

  try {
    const hasBody = !['GET', 'HEAD'].includes(req.method)
    return await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: hasBody ? req.body : undefined,
      // @ts-ignore
      duplex: 'half',
    })
  } catch (error: any) {
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to reach Clerk API: ${error?.message || 'Network error'}`,
    })
  }
})
