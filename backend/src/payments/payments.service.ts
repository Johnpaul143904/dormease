import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentStatus,
  PaymentSubmissionStatus,
  UserRole,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryReceiptCleanupService } from '../cloudinary/cloudinary-receipt-cleanup.service';
import { CloudinaryReceiptStorageService } from '../cloudinary/cloudinary-receipt-storage.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePaymentSubmissionDto } from './dto/create-payment-submission.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { VerifyPaymentSubmissionDto } from './dto/verify-payment-submission.dto';
import type { PaymentProofFile } from './payment-proof-file.type';

const paymentSubmissionSelect = {
  id: true,
  paymentId: true,
  tenantId: true,
  amount: true,
  paymentMethod: true,
  paymentDate: true,
  referenceNumber: true,
  proofFileName: true,
  proofMimeType: true,
  proofSize: true,
  status: true,
  rejectionRemarks: true,
  verifiedAt: true,
  createdAt: true,
  verifiedBy: { select: { id: true, fullName: true } },
  auditTrail: {
    include: { changedBy: { select: { fullName: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
};

const MAX_PROOF_SIZE = 5 * 1024 * 1024;
const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptStorage: CloudinaryReceiptStorageService,
    private readonly receiptCleanup: CloudinaryReceiptCleanupService,
  ) {}
  findAll() {
    return this.prisma.payment.findMany({
      include: {
        tenant: {
          include: { user: { select: { fullName: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findForUser(userId: number) {
    return this.prisma.payment.findMany({
      where: { tenant: { userId } },
      include: {
        tenant: {
          include: { user: { select: { fullName: true, email: true } } },
        },
        submissions: {
          select: paymentSubmissionSelect,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAllSubmissions() {
    return this.prisma.paymentSubmission.findMany({
      select: {
        ...paymentSubmissionSelect,
        tenant: {
          select: {
            id: true,
            contactNumber: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            amountPaid: true,
            paymentStatus: true,
            dueDate: true,
            description: true,
            tenantId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submitProof(
    userId: number,
    paymentId: number,
    dto: CreatePaymentSubmissionDto,
    file: PaymentProofFile,
  ) {
    this.validateProof(file);
    const amountCents = Math.round(dto.amount * 100);
    const referenceNumber = dto.referenceNumber.trim();
    const proofFileName = file.originalname
      .split(/[\\/]/)
      .pop()
      ?.replace(/[\u0000-\u001f\u007f]/g, '')
      .slice(0, 180);
    if (!proofFileName) {
      throw new BadRequestException('Uploaded proof must have a filename');
    }
    const paymentDate = new Date(dto.paymentDate);
    if (paymentDate > new Date()) {
      throw new BadRequestException('Payment date cannot be in the future');
    }
    const asset = await this.receiptStorage.upload(file.buffer);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: {
            id: paymentId,
            tenant: { userId },
          },
          include: {
            submissions: {
              where: { status: PaymentSubmissionStatus.PENDING },
              select: { id: true },
            },
          },
        });
        if (!payment) throw new NotFoundException('Payment was not found');
        if (payment.paymentStatus === PaymentStatus.PAID) {
          throw new BadRequestException('This payment has already been paid');
        }
        if (payment.paymentStatus === PaymentStatus.CANCELLED) {
          throw new BadRequestException('This payment is cancelled');
        }
        if (payment.submissions.length) {
          throw new ConflictException(
            'A payment proof is already waiting for verification',
          );
        }

        const outstandingCents =
          Math.round(Number(payment.amount) * 100) -
          Math.round(Number(payment.amountPaid) * 100);
        if (outstandingCents <= 0) {
          throw new BadRequestException(
            'This payment has no outstanding balance',
          );
        }
        if (amountCents > outstandingCents) {
          throw new BadRequestException(
            'Submitted amount cannot exceed the outstanding balance',
          );
        }
        const submission = await tx.paymentSubmission.create({
          data: {
            paymentId: payment.id,
            tenantId: payment.tenantId,
            amount: amountCents / 100,
            paymentMethod: dto.paymentMethod,
            paymentDate,
            referenceNumber,
            proofFileName,
            proofMimeType: file.mimetype,
            proofSize: file.size,
            proofData: null,
            cloudinaryAssetId: asset.assetId,
            cloudinaryPublicId: asset.publicId,
            cloudinarySecureUrl: asset.secureUrl,
            cloudinaryResourceType: asset.resourceType,
            cloudinaryFormat: asset.format,
          },
          select: paymentSubmissionSelect,
        });
        await tx.paymentVerificationHistory.create({
          data: {
            paymentSubmissionId: submission.id,
            status: PaymentSubmissionStatus.PENDING,
          },
        });
        return submission;
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      try {
        await this.receiptStorage.delete(asset.publicId, asset.resourceType);
      } catch (deleteError) {
        this.logger.error(
          `Unable to remove uploaded Cloudinary receipt ${asset.assetId} after submission persistence failed`,
          deleteError instanceof Error ? deleteError.name : 'Unknown error',
        );
        try {
          await this.receiptCleanup.enqueue(asset);
        } catch (cleanupError) {
          this.logger.error(
            `Unable to queue Cloudinary receipt cleanup ${asset.assetId}`,
            cleanupError instanceof Error
              ? cleanupError.name
              : 'Unknown error',
          );
        }
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new ConflictException(
          error.code === 'P2002'
            ? 'This transaction reference is already used'
            : 'A payment proof is already waiting for verification',
        );
      }
      throw error;
    }
  }

  async getProof(
    submissionId: number,
    userId: number,
    role: UserRole,
  ) {
    const submission = await this.prisma.paymentSubmission.findUnique({
      where: { id: submissionId },
      select: {
        tenant: { select: { userId: true } },
        proofData: true,
        proofMimeType: true,
        proofFileName: true,
        cloudinaryPublicId: true,
        cloudinaryResourceType: true,
        cloudinaryFormat: true,
      },
    });
    if (!submission) throw new NotFoundException('Payment proof was not found');
    if (
      role === UserRole.TENANT &&
      submission.tenant.userId !== userId
    ) {
      throw new NotFoundException('Payment proof was not found');
    }
    const data = submission.proofData
      ? Buffer.from(submission.proofData)
      : submission.cloudinaryPublicId &&
          submission.cloudinaryResourceType &&
          submission.cloudinaryFormat
        ? await this.receiptStorage.download(
            submission.cloudinaryPublicId,
            submission.cloudinaryResourceType,
            submission.cloudinaryFormat,
          )
        : null;
    if (!data) throw new NotFoundException('Payment proof was not found');
    return {
      data,
      mimeType: submission.proofMimeType,
      fileName: submission.proofFileName,
    };
  }

  async verifySubmission(
    submissionId: number,
    verifierId: number,
    dto: VerifyPaymentSubmissionDto,
  ) {
    if (
      dto.status === PaymentSubmissionStatus.REJECTED &&
      !dto.remarks?.trim()
    ) {
      throw new BadRequestException('Rejection remarks are required');
    }
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const submission = await tx.paymentSubmission.findUnique({
            where: { id: submissionId },
            include: { payment: true },
          });
          if (!submission) {
            throw new NotFoundException('Payment submission was not found');
          }
          if (submission.status !== PaymentSubmissionStatus.PENDING) {
            throw new ConflictException(
              'This payment submission has already been reviewed',
            );
          }

          if (dto.status === PaymentSubmissionStatus.APPROVED) {
            const previousCents =
              Math.round(Number(submission.payment.amountPaid) * 100);
            const paidCents = Math.round(Number(submission.amount) * 100);
            const totalCents = Math.round(Number(submission.payment.amount) * 100);
            const nextCents = previousCents + paidCents;
            if (nextCents > totalCents) {
              throw new BadRequestException(
                'Approved amount would exceed the outstanding balance',
              );
            }
            await tx.payment.update({
              where: { id: submission.paymentId },
              data: {
                amountPaid: nextCents / 100,
                paymentStatus:
                  nextCents >= totalCents
                    ? PaymentStatus.PAID
                    : PaymentStatus.PARTIAL,
                paymentDate: submission.paymentDate,
                paymentMethod: submission.paymentMethod,
              },
            });
          }

          const updated = await tx.paymentSubmission.updateMany({
            where: {
              id: submissionId,
              status: PaymentSubmissionStatus.PENDING,
            },
            data: {
              status: dto.status,
              rejectionRemarks:
                dto.status === PaymentSubmissionStatus.REJECTED
                  ? dto.remarks!.trim()
                  : null,
              verifiedAt: new Date(),
              verifiedById: verifierId,
            },
          });
          if (!updated.count) {
            throw new ConflictException(
              'This payment submission has already been reviewed',
            );
          }
          await tx.paymentVerificationHistory.create({
            data: {
              paymentSubmissionId: submissionId,
              status: dto.status,
              remarks: dto.remarks?.trim() || null,
              changedById: verifierId,
            },
          });
          return tx.paymentSubmission.findUniqueOrThrow({
            where: { id: submissionId },
            select: paymentSubmissionSelect,
          });
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
          'Payment balance changed; reload and verify the submission again',
        );
      }
      throw error;
    }
  }

  private validateProof(file: PaymentProofFile) {
    if (!file) throw new BadRequestException('Payment proof is required');
    if (file.size > MAX_PROOF_SIZE) {
      throw new BadRequestException('Payment proof must be 5 MB or smaller');
    }
    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        'Payment proof must be JPG, PNG, WEBP, or PDF',
      );
    }
    const bytes = file.buffer;
    const valid =
      (file.mimetype === 'image/jpeg' &&
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff) ||
      (file.mimetype === 'image/png' &&
        bytes.subarray(0, 8).equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        )) ||
      (file.mimetype === 'image/webp' &&
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP') ||
      (file.mimetype === 'application/pdf' &&
        bytes.toString('ascii', 0, 5) === '%PDF-');
    if (!valid) {
      throw new BadRequestException(
        'The uploaded file content does not match an allowed proof format',
      );
    }
  }

  async create(dto: CreatePaymentDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant was not found');
    try {
      return await this.prisma.payment.create({
        data: {
          tenantId: dto.tenantId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod.trim(),
          description: dto.description?.trim(),
          paymentStatus: PaymentStatus.UNPAID,
          amountPaid: 0,
          paymentDate: dto.paymentDate
            ? new Date(dto.paymentDate)
            : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          referenceNumber: dto.referenceNumber?.trim() || undefined,
        },
        include: {
          tenant: {
            include: { user: { select: { fullName: true, email: true } } },
          },
        },
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Payment reference number is already in use',
        );
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdatePaymentDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment was not found');
    if (
      dto.amount !== undefined &&
      Number(payment.amountPaid) > 0 &&
      Math.round(dto.amount * 100) !== Math.round(Number(payment.amount) * 100)
    ) {
      throw new BadRequestException(
        'A bill with verified payments cannot have its amount changed',
      );
    }
    try {
      return await this.prisma.payment.update({
        where: { id },
        data: {
          amount: dto.amount,
          paymentMethod: dto.paymentMethod?.trim(),
          description: dto.description?.trim(),
          paymentDate: dto.paymentDate
            ? new Date(dto.paymentDate)
            : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          referenceNumber: dto.referenceNumber?.trim() || undefined,
        },
        include: {
          tenant: {
            include: { user: { select: { fullName: true, email: true } } },
          },
        },
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Payment reference number is already in use',
        );
      }
      throw error;
    }
  }
}
