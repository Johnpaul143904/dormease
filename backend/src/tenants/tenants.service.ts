import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkIdentityService } from '../auth/clerk-identity.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clerkIdentityService: ClerkIdentityService,
  ) {}

  findAll() {
    return this.prisma.tenant.findMany({
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        assignments: { where: { status: 'ACTIVE' }, include: { room: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForUser(userId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        assignments: {
          include: { room: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant profile was not found');
    return tenant;
  }

  async findOne(id: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        assignments: { include: { room: true } },
        payments: true,
        maintenance: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant was not found');
    return tenant;
  }

  async create(dto: CreateTenantDto) {
    try {
      return await this.prisma.tenant.create({
        data: {
          contactNumber: dto.contactNumber?.trim() || null,
          address: dto.address?.trim() || null,
          emergencyContact: dto.emergencyContact?.trim() || null,
          user: {
            create: {
              fullName: dto.fullName.trim(),
              email: dto.email.trim().toLowerCase(),
              password: null,
              role: 'TENANT',
            },
          },
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateTenantDto) {
    const tenant = await this.findOne(id);
    const email = dto.email?.trim().toLowerCase();
    if (email !== undefined && email !== tenant.user.email.toLowerCase()) {
      const user = await this.prisma.user.findUnique({
        where: { id: tenant.user.id },
        select: { clerkUserId: true },
      });
      if (user?.clerkUserId) {
        const identity = await this.clerkIdentityService.getVerifiedIdentity(
          user.clerkUserId,
        );
        if (identity.email !== email) {
          throw new BadRequestException(
            'Verify the new email address with Clerk before updating this tenant',
          );
        }
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.fullName !== undefined || dto.email !== undefined) {
          await tx.user.update({
            where: { id: tenant.user.id },
            data: {
              ...(dto.fullName !== undefined
                ? { fullName: dto.fullName.trim() }
                : {}),
              ...(email !== undefined ? { email } : {}),
            },
          });
        }

        const updatedTenant = await tx.tenant.update({
          where: { id },
          data: {
            ...(dto.contactNumber !== undefined
              ? { contactNumber: dto.contactNumber.trim() || null }
              : {}),
            ...(dto.address !== undefined
              ? { address: dto.address.trim() || null }
              : {}),
            ...(dto.emergencyContact !== undefined
              ? { emergencyContact: dto.emergencyContact.trim() || null }
              : {}),
          },
          include: {
            user: {
              select: { id: true, fullName: true, email: true, role: true },
            },
          },
        });
        return updatedTenant;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const tenant = await tx.tenant.findUnique({
            where: { id },
            select: {
              id: true,
              userId: true,
              assignments: { select: { roomId: true } },
            },
          });
          if (!tenant) throw new NotFoundException('Tenant was not found');

          await tx.maintenanceRequest.deleteMany({ where: { tenantId: id } });
          await tx.payment.deleteMany({ where: { tenantId: id } });
          await tx.roomInvitation.deleteMany({ where: { tenantId: id } });
          await tx.roomAssignment.deleteMany({ where: { tenantId: id } });
          await tx.maintenanceRequest.updateMany({
            where: { assignedStaffId: tenant.userId },
            data: { assignedStaffId: null },
          });
          await tx.tenant.delete({ where: { id } });
          await tx.user.delete({ where: { id: tenant.userId } });

          const roomIds = [
            ...new Set(tenant.assignments.map(({ roomId }) => roomId)),
          ];
          for (const roomId of roomIds) {
            const room = await tx.room.findUnique({
              where: { id: roomId },
              select: { status: true },
            });
            if (!room || room.status === 'MAINTENANCE') continue;

            const activeAssignments = await tx.roomAssignment.count({
              where: { roomId, status: 'ACTIVE' },
            });
            await tx.room.update({
              where: { id: roomId },
              data: {
                status: activeAssignments > 0 ? 'OCCUPIED' : 'AVAILABLE',
              },
            });
          }
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (this.isSerializationFailure(error)) {
        throw new ConflictException(
          'Tenant data changed during deletion; please retry',
        );
      }
      throw error;
    }
    return { id };
  }

  private isSerializationFailure(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2034'
    );
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
