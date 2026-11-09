export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'FULL' | 'MAINTENANCE'

export interface Room {
  id: number
  roomNumber: string
  building: string
  floor: number
  roomType: 'Single' | 'Double' | 'Shared'
  capacity: number
  currentOccupants: number
  monthlyRate: number
  status: RoomStatus
  description: string
}

export type RoomInput = Omit<Room, 'id' | 'currentOccupants'>
