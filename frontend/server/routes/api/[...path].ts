import { getProxyRequestHeaders, getRequestURL, proxyRequest } from 'h3';

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  const requestUrl = getRequestURL(event);
  const upstreamBase = new URL(config.apiBaseUrl);

  if (!['http:', 'https:'].includes(upstreamBase.protocol)) {
    throw createError({
      statusCode: 500,
      statusMessage: 'API_BASE_URL must use HTTP or HTTPS',
    });
  }

  const basePath = upstreamBase.pathname.replace(/\/+$/, '');
  const apiBasePath = basePath.endsWith('/api') ? basePath : `${basePath}/api`;
  upstreamBase.pathname = `${apiBasePath}${requestUrl.pathname.slice('/api'.length)}`;
  upstreamBase.search = requestUrl.search;

  const headers = new Headers(getProxyRequestHeaders(event));
  headers.set('cookie', '');
  headers.set('x-forwarded-host', requestUrl.host);
  headers.set('x-forwarded-proto', requestUrl.protocol.slice(0, -1));
  return proxyRequest(event, upstreamBase.toString(), { headers });
});
