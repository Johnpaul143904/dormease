export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'

export interface Tenant {
  id: number
  fullName: string
  email: string
  contactNumber: string
  address?: string
  emergencyContact?: string
  assignedRoomId: number | null
  registrationDate: string
  status: TenantStatus
}

export interface TenantInput {
  fullName: string
  email: string
  password?: string
  contactNumber: string
  address: string
  emergencyContact: string
}
