export const useTenants = () => {
  const data = useDormData()
  return { tenants: data.tenants, loading: ref(false), error: ref('') }
}
