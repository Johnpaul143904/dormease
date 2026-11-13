import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomInvitationDto } from './dto/create-room-invitation.dto';

@Injectable()
export class RoomInvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.roomInvitation.findMany({
      include: {
        room: true,
        tenant: {
          include: { user: { select: { fullName: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findForTenant(userId: number) {
    return this.prisma.roomInvitation.findMany({
      where: { tenant: { is: { userId } } },
      include: { room: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateRoomInvitationDto) {
    const room = await this.prisma.room.findUnique({
      where: { id: dto.roomId },
    });
    if (!room) throw new NotFoundException('Room was not found');
    if (room.status === 'MAINTENANCE') {
      throw new BadRequestException('Room is under maintenance');
    }
    const activeAssignments = await this.prisma.roomAssignment.count({
      where: { roomId: room.id, status: 'ACTIVE' },
    });
    if (activeAssignments >= room.capacity) {
      throw new BadRequestException('Room has no available slots');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (dto.expiresInDays ?? 7));
    const code = `DE-${randomBytes(16).toString('hex').toUpperCase()}`;
    return this.prisma.roomInvitation.create({
      data: { roomId: room.id, code, expiresAt },
      include: { room: true },
    });
  }

  async findByCode(code: string) {
    const invitation = await this.prisma.roomInvitation.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: { room: true },
    });
    if (!invitation) throw new NotFoundException('Invitation was not found');
    if (
      invitation.status === 'ACTIVE' &&
      invitation.expiresAt <= new Date()
    ) {
      await this.prisma.roomInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      invitation.status = 'EXPIRED';
    }
    const currentOccupants = await this.prisma.roomAssignment.count({
      where: { roomId: invitation.roomId, status: 'ACTIVE' },
    });
    return {
      code: invitation.code,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      room: {
        roomNumber: invitation.room.roomNumber,
        building: invitation.room.building,
        floor: invitation.room.floor,
        roomType: invitation.room.roomType,
        capacity: invitation.room.capacity,
        currentOccupants,
        monthlyRent: invitation.room.monthlyRent,
        description: invitation.room.description,
        status: invitation.room.status,
      },
    };
  }

  async revoke(id: number) {
    const invitation = await this.prisma.roomInvitation.findUnique({
      where: { id },
    });
    if (!invitation) throw new NotFoundException('Invitation was not found');
    if (invitation.status !== 'ACTIVE') {
      throw new BadRequestException('Only active invitations can be revoked');
    }
    return this.prisma.roomInvitation.update({
      where: { id },
      data: { status: 'REVOKED' },
    });
  }

  async requestToJoin(code: string, userId: number) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const tenant = await tx.tenant.findUnique({ where: { userId } });
          if (!tenant) {
            throw new BadRequestException(
              'A tenant account is required to request a room',
            );
          }

          const invitation = await tx.roomInvitation.findUnique({
            where: { code: code.trim().toUpperCase() },
            include: { room: true },
          });
          if (!invitation)
            throw new NotFoundException('Invitation was not found');
          if (
            invitation.status === 'PENDING' &&
            invitation.tenantId === tenant.id
          ) {
            return invitation;
          }
          if (invitation.status !== 'ACTIVE') {
            throw new ConflictException('Invitation is no longer active');
          }
          if (invitation.expiresAt <= new Date()) {
            throw new BadRequestException('Invitation has expired');
          }
          if (invitation.room.status === 'MAINTENANCE') {
            throw new BadRequestException('Room is under maintenance');
          }
          const existingAssignment = await tx.roomAssignment.findFirst({
            where: { tenantId: tenant.id, status: 'ACTIVE' },
          });
          if (existingAssignment) {
            throw new BadRequestException(
              'Tenant already has an active assignment',
            );
          }
          const activeAssignments = await tx.roomAssignment.count({
            where: { roomId: invitation.roomId, status: 'ACTIVE' },
          });
          if (activeAssignments >= invitation.room.capacity) {
            throw new BadRequestException('Room has no available slots');
          }
          const otherPendingRequest = await tx.roomInvitation.findFirst({
            where: { tenantId: tenant.id, status: 'PENDING' },
          });
          if (otherPendingRequest) {
            throw new ConflictException(
              'You already have a pending room request',
            );
          }

          const updated = await tx.roomInvitation.updateMany({
            where: {
              id: invitation.id,
              status: 'ACTIVE',
              tenantId: null,
              expiresAt: { gt: new Date() },
            },
            data: { status: 'PENDING', tenantId: tenant.id },
          });
          if (updated.count !== 1) {
            throw new ConflictException(
              'Invitation changed; please refresh and try again',
            );
          }
          return tx.roomInvitation.findUnique({
            where: { id: invitation.id },
            include: { room: true },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (this.isSerializationFailure(error)) {
        throw new ConflictException(
          'Room availability changed; please retry your request',
        );
      }
      throw error;
    }
  }

  async approve(id: number) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const invitation = await tx.roomInvitation.findUnique({
            where: { id },
            include: { room: true, tenant: true },
          });
          if (!invitation)
            throw new NotFoundException('Room request was not found');
          if (
            invitation.status !== 'PENDING' ||
            invitation.tenantId === null ||
            !invitation.tenant
          ) {
            throw new ConflictException(
              'Only pending room requests can be approved',
            );
          }
          const tenantId = invitation.tenantId;
          if (invitation.room.status === 'MAINTENANCE') {
            throw new BadRequestException('Room is under maintenance');
          }

          const existingAssignment = await tx.roomAssignment.findFirst({
            where: { tenantId, status: 'ACTIVE' },
          });
          if (existingAssignment) {
            throw new ConflictException(
              'Tenant already has an active room assignment',
            );
          }
          const activeAssignments = await tx.roomAssignment.count({
            where: { roomId: invitation.roomId, status: 'ACTIVE' },
          });
          if (activeAssignments >= invitation.room.capacity) {
            throw new BadRequestException('Room has no available slots');
          }

          const updated = await tx.roomInvitation.updateMany({
            where: { id, status: 'PENDING', tenantId },
            data: { status: 'APPROVED' },
          });
          if (updated.count !== 1) {
            throw new ConflictException(
              'Room request has already been processed',
            );
          }

          const assignment = await tx.roomAssignment.create({
            data: {
              tenantId,
              roomId: invitation.roomId,
              moveInDate: new Date(),
            },
          });
          await tx.room.update({
            where: { id: invitation.roomId },
            data: { status: 'OCCUPIED' },
          });

          const approvedInvitation = await tx.roomInvitation.findUnique({
            where: { id },
            include: {
              room: true,
              tenant: {
                include: { user: { select: { fullName: true, email: true } } },
              },
            },
          });
          return { invitation: approvedInvitation, assignment };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (this.isSerializationFailure(error)) {
        throw new ConflictException(
          'Room availability changed; request was not approved',
        );
      }
      throw error;
    }
  }

  async reject(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.roomInvitation.findUnique({
        where: { id },
      });
      if (!invitation)
        throw new NotFoundException('Room request was not found');
      if (invitation.status !== 'PENDING' || invitation.tenantId === null) {
        throw new ConflictException(
          'Only pending room requests can be rejected',
        );
      }

      const updated = await tx.roomInvitation.updateMany({
        where: { id, status: 'PENDING', tenantId: invitation.tenantId },
        data: { status: 'REJECTED' },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'Room request has already been processed',
        );
      }
      return tx.roomInvitation.findUnique({
        where: { id },
        include: { room: true },
      });
    });
  }

  private isSerializationFailure(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2034'
    );
  }
}
