export const useRooms = () => {
  const data = useDormData()
  return { rooms: data.rooms, loading: ref(false), error: ref('') }
}
