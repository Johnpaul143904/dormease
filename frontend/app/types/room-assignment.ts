export type AssignmentStatus = 'ACTIVE' | 'PENDING' | 'COMPLETED'

export interface RoomAssignment {
  id: number
  tenantId: number
  roomId: number
  assignmentDate: string
  moveInDate: string
  moveOutDate: string | null
  status: AssignmentStatus
}
