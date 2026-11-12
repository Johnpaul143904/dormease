export const useApi = () => {
  const config = useRuntimeConfig();
  const clerkAuth = useAuth();
  const apiBase = config.public.apiBase.replace(/\/+$/, "");
  const fetcher: typeof $fetch = import.meta.server
    ? useRequestFetch()
    : $fetch;
  return {
    apiBase,
    request: async <T>(
      path: string,
      options: Parameters<typeof $fetch<T>>[1] = {},
    ) => {
      const token = await clerkAuth.getToken.value();
      const headers = new Headers(options.headers);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      } else {
        headers.delete("Authorization");
      }

      return fetcher<T>(`${apiBase}/${path.replace(/^\/+/, "")}`, {
        ...options,
        headers,
        credentials: "omit",
      });
    },
  };
};
