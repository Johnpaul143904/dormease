import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}
  async summary() {
    const [
      totalRooms,
      availableRooms,
      occupiedRooms,
      totalTenants,
      activeAssignments,
      pendingPayments,
      paidPayments,
      overduePayments,
      maintenanceRequests,
      paidTotal,
    ] = await Promise.all([
      this.prisma.room.count(),
      this.prisma.room.count({ where: { status: 'AVAILABLE' } }),
      this.prisma.room.count({ where: { status: 'OCCUPIED' } }),
      this.prisma.tenant.count(),
      this.prisma.roomAssignment.count({ where: { status: 'ACTIVE' } }),
      this.prisma.payment.count({
        where: {
          paymentStatus: { in: ['UNPAID', 'PENDING', 'PARTIAL'] },
          OR: [{ dueDate: null }, { dueDate: { gte: new Date() } }],
        },
      }),
      this.prisma.payment.count({ where: { paymentStatus: 'PAID' } }),
      this.prisma.payment.count({
        where: {
          paymentStatus: { in: ['UNPAID', 'PENDING', 'PARTIAL'] },
          dueDate: { lt: new Date() },
        },
      }),
      this.prisma.maintenanceRequest.count({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }),
      this.prisma.payment.aggregate({
        where: { paymentStatus: 'PAID' },
        _sum: { amount: true },
      }),
    ]);
    return {
      totalRooms,
      availableRooms,
      occupiedRooms,
      totalTenants,
      activeAssignments,
      pendingPayments,
      paidPayments,
      overduePayments,
      paidTotal: Number(paidTotal._sum.amount ?? 0),
      maintenanceRequests,
      occupancyRate:
        totalRooms === 0 ? 0 : Math.round((occupiedRooms / totalRooms) * 100),
    };
  }
}
