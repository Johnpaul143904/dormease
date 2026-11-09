import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MaintenanceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveMaintenanceDto } from './dto/approve-maintenance.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { CreateTenantMaintenanceDto } from './dto/create-tenant-maintenance.dto';
import { RejectMaintenanceDto } from './dto/reject-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';

const adminInclude = {
  tenant: {
    include: {
      user: { select: { id: true, fullName: true, email: true } },
    },
  },
  room: true,
  statusHistory: {
    include: { changedBy: { select: { fullName: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
};

const ownRequestInclude = {
  room: true,
  statusHistory: {
    select: { status: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.maintenanceRequest.findMany({
      include: adminInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  findForUser(userId: number) {
    return this.prisma.maintenanceRequest.findMany({
      where: { tenant: { userId } },
      include: ownRequestInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  findPublicAnnouncements() {
    return this.prisma.maintenanceRequest.findMany({
      where: {
        isPublic: true,
        status: {
          in: [
            MaintenanceStatus.APPROVED,
            MaintenanceStatus.IN_PROGRESS,
            MaintenanceStatus.RESOLVED,
          ],
        },
        announcementTitle: { not: null },
        announcementDescription: { not: null },
      },
      select: {
        announcementTitle: true,
        announcementDescription: true,
        publicLocation: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        statusHistory: {
          where: {
            status: {
              in: [
                MaintenanceStatus.APPROVED,
                MaintenanceStatus.IN_PROGRESS,
                MaintenanceStatus.RESOLVED,
              ],
            },
          },
          select: { status: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(dto: CreateMaintenanceDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.maintenanceRequest.create({
        data: {
          tenantId: dto.tenantId,
          roomId: dto.roomId,
          title: dto.title.trim(),
          description: dto.description.trim(),
          priority: dto.priority,
        },
      });
      await tx.maintenanceStatusHistory.create({
        data: {
          maintenanceRequestId: request.id,
          status: MaintenanceStatus.PENDING,
          changedById: actorId,
        },
      });
      return request;
    });
  }

  async createForUser(userId: number, dto: CreateTenantMaintenanceDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant profile was not found');
    const assignment = tenant.assignments[0];
    if (!assignment) {
      throw new BadRequestException(
        'An active room assignment is required to request maintenance',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.maintenanceRequest.create({
        data: {
          tenantId: tenant.id,
          roomId: assignment.roomId,
          title: dto.title.trim(),
          description: dto.description.trim(),
          priority: dto.priority,
        },
      });
      await tx.maintenanceStatusHistory.create({
        data: {
          maintenanceRequestId: request.id,
          status: MaintenanceStatus.PENDING,
        },
      });
      return request;
    });
  }

  async approve(
    id: number,
    actorId: number,
    dto: ApproveMaintenanceDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.maintenanceRequest.findUnique({
        where: { id },
      });
      if (!existing)
        throw new NotFoundException('Maintenance request was not found');
      if (existing.status !== MaintenanceStatus.PENDING) {
        throw new BadRequestException('Only pending requests can be approved');
      }

      const changed = await tx.maintenanceRequest.updateMany({
        where: { id, status: MaintenanceStatus.PENDING },
        data: {
          status: MaintenanceStatus.APPROVED,
          isPublic: true,
          announcementTitle: dto.announcementTitle?.trim() || 'Maintenance notice',
          announcementDescription:
            dto.announcementDescription?.trim() ||
            'Approved maintenance work will be carried out in this area.',
          publicLocation: dto.publicLocation?.trim() || null,
        },
      });
      if (!changed.count) {
        throw new BadRequestException('This request has already been reviewed');
      }
      await tx.maintenanceStatusHistory.create({
        data: {
          maintenanceRequestId: id,
          status: MaintenanceStatus.APPROVED,
          changedById: actorId,
        },
      });
      return tx.maintenanceRequest.findUniqueOrThrow({
        where: { id },
        include: adminInclude,
      });
    });
  }

  async reject(id: number, actorId: number, dto: RejectMaintenanceDto) {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.maintenanceRequest.updateMany({
        where: { id, status: MaintenanceStatus.PENDING },
        data: { status: MaintenanceStatus.REJECTED, isPublic: false },
      });
      if (!changed.count) {
        const existing = await tx.maintenanceRequest.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!existing)
          throw new NotFoundException('Maintenance request was not found');
        throw new BadRequestException('Only pending requests can be rejected');
      }
      await tx.maintenanceStatusHistory.create({
        data: {
          maintenanceRequestId: id,
          status: MaintenanceStatus.REJECTED,
          note: dto.note?.trim() || null,
          changedById: actorId,
        },
      });
      return tx.maintenanceRequest.findUniqueOrThrow({
        where: { id },
        include: adminInclude,
      });
    });
  }

  async update(id: number, actorId: number, dto: UpdateMaintenanceDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.maintenanceRequest.findUnique({
        where: { id },
      });
      if (!existing)
        throw new NotFoundException('Maintenance request was not found');
      if (!existing.isPublic) {
        throw new BadRequestException(
          'Only explicitly approved public announcements can be updated',
        );
      }
      if (
        existing.status !== MaintenanceStatus.APPROVED &&
        existing.status !== MaintenanceStatus.IN_PROGRESS &&
        existing.status !== MaintenanceStatus.RESOLVED
      ) {
        throw new BadRequestException(
          'Only approved announcements can be updated',
        );
      }

      if (
        dto.status &&
        dto.status !== MaintenanceStatus.IN_PROGRESS &&
        dto.status !== MaintenanceStatus.RESOLVED
      ) {
        throw new BadRequestException(
          'Approved requests can only be marked in progress or completed',
        );
      }
      if (
        dto.status === MaintenanceStatus.IN_PROGRESS &&
        existing.status === MaintenanceStatus.RESOLVED
      ) {
        throw new BadRequestException(
          'Completed maintenance cannot return to in progress',
        );
      }
      if (
        dto.announcementTitle !== undefined &&
        existing.status === MaintenanceStatus.APPROVED &&
        dto.status === MaintenanceStatus.IN_PROGRESS
      ) {
        throw new BadRequestException(
          'Edit the announcement separately from changing its status',
        );
      }

      const updated = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.announcementTitle !== undefined
            ? { announcementTitle: dto.announcementTitle.trim() }
            : {}),
          ...(dto.announcementDescription !== undefined
            ? { announcementDescription: dto.announcementDescription.trim() }
            : {}),
          ...(dto.publicLocation !== undefined
            ? { publicLocation: dto.publicLocation.trim() || null }
            : {}),
        },
      });
      if (dto.status && dto.status !== existing.status) {
        await tx.maintenanceStatusHistory.create({
          data: {
            maintenanceRequestId: id,
            status: dto.status,
            changedById: actorId,
          },
        });
      }
      return tx.maintenanceRequest.findUniqueOrThrow({
        where: { id: updated.id },
        include: adminInclude,
      });
    });
  }
}
