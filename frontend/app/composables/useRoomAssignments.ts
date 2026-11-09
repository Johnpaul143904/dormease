export const useRoomAssignments = () => {
  const data = useDormData()
  return { assignments: data.assignments, loading: ref(false), error: ref('') }
}
