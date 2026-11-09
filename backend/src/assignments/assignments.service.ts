import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.roomAssignment.findMany({
      include: {
        tenant: {
          include: { user: { select: { fullName: true, email: true } } },
        },
        room: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateAssignmentDto) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const tenant = await tx.tenant.findUnique({
            where: { id: dto.tenantId },
          });
          const room = await tx.room.findUnique({ where: { id: dto.roomId } });
          if (!tenant || !room)
            throw new NotFoundException('Tenant or room was not found');
          if (room.status === 'MAINTENANCE')
            throw new BadRequestException('Room is under maintenance');

          const activeAssignments = await tx.roomAssignment.count({
            where: { roomId: dto.roomId, status: 'ACTIVE' },
          });
          if (activeAssignments >= room.capacity) {
            throw new BadRequestException('Room has no available slots');
          }

          const existing = await tx.roomAssignment.findFirst({
            where: { tenantId: dto.tenantId, status: 'ACTIVE' },
          });
          if (existing)
            throw new BadRequestException(
              'Tenant already has an active assignment',
            );

          const assignment = await tx.roomAssignment.create({
            data: {
              tenantId: dto.tenantId,
              roomId: dto.roomId,
              moveInDate: new Date(dto.moveInDate),
            },
          });
          await tx.room.update({
            where: { id: room.id },
            data: { status: 'OCCUPIED' },
          });
          return assignment;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (this.isSerializationFailure(error)) {
        throw new BadRequestException(
          'Room availability changed; please retry the assignment',
        );
      }
      throw error;
    }
  }

  async terminate(id: number) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const assignment = await tx.roomAssignment.findUnique({
            where: { id },
          });
          if (!assignment)
            throw new NotFoundException('Assignment was not found');
          if (assignment.status !== 'ACTIVE') {
            throw new BadRequestException('Assignment is not active');
          }

          const completed = await tx.roomAssignment.update({
            where: { id },
            data: { status: 'COMPLETED', moveOutDate: new Date() },
          });
          const remainingAssignments = await tx.roomAssignment.count({
            where: { roomId: assignment.roomId, status: 'ACTIVE' },
          });
          const room = await tx.room.findUnique({
            where: { id: assignment.roomId },
          });
          if (room && room.status !== 'MAINTENANCE') {
            await tx.room.update({
              where: { id: room.id },
              data: {
                status: remainingAssignments > 0 ? 'OCCUPIED' : 'AVAILABLE',
              },
            });
          }
          return completed;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (this.isSerializationFailure(error)) {
        throw new BadRequestException(
          'Assignment changed concurrently; please retry',
        );
      }
      throw error;
    }
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
