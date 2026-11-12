import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkIdentityService } from './clerk-identity.service';
import { RegisterDto, RegistrationAccountType } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const profileSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly clerkIdentityService: ClerkIdentityService,
  ) {}

  async provisionUser(clerkUserId: string, dto: RegisterDto) {
    const identity =
      await this.clerkIdentityService.getVerifiedIdentity(clerkUserId);
    const email = identity.email.trim().toLowerCase();

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const linkedUser = await tx.user.findUnique({
          where: { clerkUserId },
          select: profileSelect,
        });
        if (linkedUser) return linkedUser;

        const matchingUsers = await tx.user.findMany({
          where: { email: { equals: email, mode: 'insensitive' } },
          take: 2,
          select: {
            ...profileSelect,
            clerkUserId: true,
            tenant: { select: { userId: true } },
          },
        });
        if (matchingUsers.length > 1) {
          throw new ConflictException(
            'Multiple DormEase accounts match this email; contact an administrator',
          );
        }

        const existingUser = matchingUsers[0];
        if (existingUser) {
          if (existingUser.clerkUserId) {
            throw new ConflictException(
              'This DormEase account is linked to another Clerk identity',
            );
          }

          const linked = await tx.user.update({
            where: { id: existingUser.id },
            data: { clerkUserId },
            select: profileSelect,
          });
          if (linked.role === UserRole.TENANT && !existingUser.tenant) {
            await tx.tenant.create({ data: { userId: linked.id } });
          }
          return linked;
        }

        const role =
          dto.accountType === RegistrationAccountType.ADMIN
            ? this.authorizeAdminRegistration(dto.invitationCode)
            : UserRole.TENANT;
        const fullName =
          identity.fullName || email.slice(0, email.indexOf('@'));

        return tx.user.create({
          data: {
            fullName,
            email,
            password: null,
            clerkUserId,
            role,
            ...(role === UserRole.TENANT ? { tenant: { create: {} } } : {}),
          },
          select: profileSelect,
        });
      });

      return { user };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'This email or Clerk identity is already linked to a DormEase account',
        );
      }
      throw error;
    }
  }

  async profile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...profileSelect,
        tenant: {
          select: {
            contactNumber: true,
            address: true,
            emergencyContact: true,
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException('User account was not found');
    const { tenant, ...profile } = user;
    return {
      user: {
        ...profile,
        contactNumber: tenant?.contactNumber ?? null,
        address: tenant?.address ?? null,
        emergencyContact: tenant?.emergencyContact ?? null,
      },
    };
  }

  async updateProfile(
    userId: number,
    clerkUserId: string,
    dto: UpdateProfileDto,
  ) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!currentUser) throw new NotFoundException('User account was not found');

    const email = dto.email?.trim().toLowerCase();
    const fullName = dto.fullName?.trim();
    if (email && email !== currentUser.email.toLowerCase()) {
      const identity =
        await this.clerkIdentityService.getVerifiedIdentity(clerkUserId);
      if (email !== identity.email) {
        throw new BadRequestException(
          'Verify the new email address with Clerk before updating your profile',
        );
      }
    }

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            ...(email ? { email } : {}),
            ...(fullName ? { fullName } : {}),
          },
          select: profileSelect,
        });
        if (
          currentUser.tenant &&
          (dto.contactNumber !== undefined ||
            dto.address !== undefined ||
            dto.emergencyContact !== undefined)
        ) {
          await tx.tenant.update({
            where: { userId },
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
          });
        }
        return updatedUser;
      });
      return {
        user: {
          ...user,
          contactNumber: currentUser.tenant
            ? (dto.contactNumber ?? currentUser.tenant.contactNumber)
            : null,
          address: currentUser.tenant
            ? (dto.address ?? currentUser.tenant.address)
            : null,
          emergencyContact: currentUser.tenant
            ? (dto.emergencyContact ?? currentUser.tenant.emergencyContact)
            : null,
        },
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email address is already in use');
      }
      throw error;
    }
  }

  private authorizeAdminRegistration(invitationCode?: string) {
    const configuredCode = this.configService.get<string>(
      'ADMIN_INVITATION_CODE',
    );
    if (
      !configuredCode ||
      !invitationCode ||
      invitationCode !== configuredCode
    ) {
      throw new ForbiddenException(
        'Admin registration requires a valid invitation code',
      );
    }
    return UserRole.ADMIN;
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
