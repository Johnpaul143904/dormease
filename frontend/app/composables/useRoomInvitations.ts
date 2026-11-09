export const useRoomInvitations = () => {
  const data = useDormData()
  return { invitations: data.invitations, loading: ref(false), error: ref('') }
}
