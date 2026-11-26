export const useApi = () => {
  const config = useRuntimeConfig();
  const clerkAuth = useAuth();
  const apiBase = config.public.apiBase.replace(/\/+$/, "");
  const fetcher: typeof $fetch = import.meta.server
    ? useRequestFetch()
    : $fetch;

  async function getSessionToken() {
    if (import.meta.client && !clerkAuth.isLoaded.value) {
      await new Promise<void>((resolve) => {
        const stop = watch(clerkAuth.isLoaded, (isLoaded) => {
          if (isLoaded) {
            stop();
            resolve();
          }
        });
      });
    }

    const token =
      (await clerkAuth.getToken.value()) ??
      (await clerkAuth.getToken.value({ skipCache: true }));

    return token;
  }

  return {
    apiBase,
    request: async <T>(
      path: string,
      options: Parameters<typeof $fetch<T>>[1] = {},
      requestOptions: { requiresAuth?: boolean } = {},
    ) => {
      const requiresAuth = requestOptions.requiresAuth ?? true;
      const token = requiresAuth ? await getSessionToken() : null;
      if (requiresAuth && !token) {
        throw new Error(
          "Clerk did not provide an active session token. Please sign in again.",
        );
      }

      const headers = new Headers(options.headers);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      return fetcher<T>(`${apiBase}/${path.replace(/^\/+/, "")}`, {
        ...options,
        headers,
        credentials: "omit",
      });
    },
  };
};
