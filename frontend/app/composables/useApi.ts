export const useApi = () => {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase.replace(/\/+$/, "");
  const fetcher = import.meta.server ? useRequestFetch() : $fetch;
  return {
    apiBase,
    request: <T>(path: string, options: Parameters<typeof $fetch<T>>[1] = {}) =>
      fetcher<T>(`${apiBase}/${path.replace(/^\/+/, "")}`, {
        ...options,
        credentials: "include",
      }),
  };
};
