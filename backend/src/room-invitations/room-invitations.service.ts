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

  async accept(code: string, userId: number) {
    const invitation = await this.prisma.roomInvitation.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (!invitation) throw new NotFoundException('Invitation was not found');
    if (invitation.status === 'ACTIVE' && invitation.expiresAt <= new Date()) {
      await this.prisma.roomInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Invitation has expired');
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const currentInvitation = await tx.roomInvitation.findUnique({
            where: { code: code.trim().toUpperCase() },
          });
          if (!currentInvitation)
            throw new NotFoundException('Invitation was not found');
          if (currentInvitation.status !== 'ACTIVE') {
            throw new BadRequestException('Invitation is no longer active');
          }
          if (currentInvitation.expiresAt <= new Date()) {
            throw new BadRequestException('Invitation has expired');
          }

          const tenant = await tx.tenant.findUnique({ where: { userId } });
          if (!tenant) {
            throw new BadRequestException(
              'A tenant account is required to accept an invitation',
            );
          }
          const existingAssignment = await tx.roomAssignment.findFirst({
            where: { tenantId: tenant.id, status: 'ACTIVE' },
          });
          if (existingAssignment) {
            throw new BadRequestException(
              'Tenant already has an active assignment',
            );
          }
          const room = await tx.room.findUnique({
            where: { id: currentInvitation.roomId },
          });
          if (!room) throw new NotFoundException('Room was not found');
          if (room.status === 'MAINTENANCE') {
            throw new BadRequestException('Room is under maintenance');
          }
          const activeAssignments = await tx.roomAssignment.count({
            where: { roomId: room.id, status: 'ACTIVE' },
          });
          if (activeAssignments >= room.capacity) {
            throw new BadRequestException('Room has no available slots');
          }

          const assignment = await tx.roomAssignment.create({
            data: {
              tenantId: tenant.id,
              roomId: room.id,
              moveInDate: new Date(),
            },
          });
          await tx.room.update({
            where: { id: room.id },
            data: { status: 'OCCUPIED' },
          });
          await tx.roomInvitation.update({
            where: { id: currentInvitation.id },
            data: { status: 'USED', tenantId: tenant.id },
          });
          return { assignment };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Room availability changed; please try again',
        );
      }
      throw error;
    }
  }

  async reject(code: string, userId: number) {
    const tenant = await this.prisma.tenant.findUnique({ where: { userId } });
    if (!tenant) {
      throw new BadRequestException(
        'A tenant account is required to reject an invitation',
      );
    }
    const invitation = await this.prisma.roomInvitation.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (!invitation) throw new NotFoundException('Invitation was not found');
    if (invitation.status !== 'ACTIVE') {
      throw new BadRequestException('Invitation is no longer active');
    }
    if (invitation.expiresAt <= new Date()) {
      await this.prisma.roomInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Invitation has expired');
    }
    return this.prisma.roomInvitation.update({
      where: { id: invitation.id },
      data: { status: 'REJECTED', tenantId: tenant.id },
    });
  }
}
