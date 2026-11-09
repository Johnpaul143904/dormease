import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.room.findMany({
      include: { assignments: { where: { status: 'ACTIVE' } } },
      orderBy: { roomNumber: 'asc' },
    });
  }

  async findOne(id: number) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        assignments: { include: { tenant: { include: { user: true } } } },
      },
    });
    if (!room) throw new NotFoundException('Room was not found');
    return room;
  }

  async create(dto: CreateRoomDto) {
    try {
      return await this.prisma.room.create({
        data: {
          roomNumber: dto.roomNumber.trim(),
          building: dto.building?.trim() || 'Dormitory',
          floor: dto.floor ?? 1,
          roomType: dto.roomType ?? 'Shared',
          capacity: dto.capacity,
          monthlyRent: dto.monthlyRent,
          description: dto.description?.trim(),
          status: dto.status,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Room number is already in use');
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateRoomDto) {
    const room = await this.findOne(id);
    if (
      dto.capacity !== undefined &&
      dto.capacity <
        room.assignments.filter((item) => item.status === 'ACTIVE').length
    ) {
      throw new BadRequestException(
        'Room capacity cannot be less than its active assignment count',
      );
    }
    try {
      return await this.prisma.room.update({
        where: { id },
        data: {
          roomNumber: dto.roomNumber?.trim(),
          building: dto.building?.trim(),
          floor: dto.floor,
          roomType: dto.roomType,
          capacity: dto.capacity,
          monthlyRent: dto.monthlyRent,
          description: dto.description,
          status: dto.status,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Room number is already in use');
      }
      throw error;
    }
  }

  async remove(id: number) {
    const room = await this.findOne(id);
    if (room.assignments.length > 0) {
      throw new BadRequestException(
        'Rooms with assignment history cannot be deleted',
      );
    }
    const requests = await this.prisma.maintenanceRequest.count({
      where: { roomId: id },
    });
    if (requests > 0) {
      throw new BadRequestException(
        'Rooms with maintenance history cannot be deleted',
      );
    }
    return this.prisma.room.delete({ where: { id } });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
